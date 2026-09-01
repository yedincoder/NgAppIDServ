package main

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx       context.Context
	processes map[string]*exec.Cmd
}

func NewApp() *App {
	return &App{
		processes: make(map[string]*exec.Cmd),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(ctx context.Context) {
	a.StopAll()
}

// ==== GAYA GO: HELPER LOG & KILL PROCESS ====
func (a *App) emitLog(msg string) {
	runtime.EventsEmit(a.ctx, "server-log", msg)
}

func (a *App) emitStatus(id string, status string) {
	runtime.EventsEmit(a.ctx, "server-status", map[string]string{"id": id, "status": status})
}

func (a *App) killProcess(name string, exeName string) {
	if cmd, exists := a.processes[name]; exists && cmd != nil {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		delete(a.processes, name)
	}
	if exeName != "" {
		cmdKill := exec.Command("taskkill", "/F", "/IM", exeName)
		cmdKill.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		cmdKill.Run()
	}
}

func (a *App) isPortInUse(port int) bool {
	timeout := 500 * time.Millisecond
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func (a *App) OpenExternal(url string) { runtime.BrowserOpenURL(a.ctx, url) }
func (a *App) OpenPMA()                { runtime.BrowserOpenURL(a.ctx, "http://localhost/phpmyadmin") }
func (a *App) GetAppVersion() string   { return "1.0.9" }

// ==== SETTING.INI ====
type Config struct {
	PHP   string `json:"php"`
	MySQL string `json:"mysql"`
}

func (a *App) readSettings() Config {
	cwd, _ := os.Getwd()
	settingPath := filepath.Join(cwd, "setting.ini")
	config := Config{PHP: "php-8.3.32-nts-Win32-vs16-x64", MySQL: "mariadb"}

	if _, err := os.Stat(settingPath); os.IsNotExist(err) {
		os.WriteFile(settingPath, []byte("[DEFAULT_ENGINE]\r\nphp=php-8.3.32-nts-Win32-vs16-x64\r\nmysql=mariadb\r\n"), 0644)
		return config
	}
	contentBytes, _ := os.ReadFile(settingPath)
	content := string(contentBytes)

	if m := regexp.MustCompile(`(?m)^php\s*=\s*(.+)$`).FindStringSubmatch(content); len(m) > 1 {
		config.PHP = strings.TrimSpace(m[1])
	}
	if m := regexp.MustCompile(`(?m)^mysql\s*=\s*(.+)$`).FindStringSubmatch(content); len(m) > 1 {
		config.MySQL = strings.TrimSpace(m[1])
	}
	return config
}

func (a *App) SaveSettings(data map[string]string) map[string]any {
	cwd, _ := os.Getwd()
	settingPath := filepath.Join(cwd, "setting.ini")
	current := a.readSettings()
	if php, ok := data["php"]; ok && php != "" {
		current.PHP = php
	}
	if mysql, ok := data["mysql"]; ok && mysql != "" {
		current.MySQL = mysql
	}
	newIni := fmt.Sprintf("[DEFAULT_ENGINE]\r\nphp=%s\r\nmysql=%s\r\n", current.PHP, current.MySQL)
	if err := os.WriteFile(settingPath, []byte(newIni), 0644); err != nil {
		return map[string]any{"success": false, "message": "Gagal menyimpan"}
	}
	return map[string]any{"success": true, "message": "Engine berhasil diubah!"}
}

// ==== DETEKSI VERSI ====
func (a *App) GetVersions() map[string]any {
	cwd, _ := os.Getwd()
	cfg := a.readSettings()
	versions := map[string]any{"nginx": "Unknown", "php": []map[string]any{}, "mysql": []map[string]any{}}

	cmdNginx := exec.Command(filepath.Join(cwd, "bin", "nginx", "nginx.exe"), "-v")
	cmdNginx.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if out, err := cmdNginx.CombinedOutput(); err == nil {
		if m := regexp.MustCompile(`nginx/([\d.]+)`).FindStringSubmatch(string(out)); len(m) > 1 {
			versions["nginx"] = "v" + m[1]
		}
	}
	
	if entries, err := os.ReadDir(filepath.Join(cwd, "bin", "php")); err == nil {
		var phpList []map[string]any
		for _, e := range entries {
			if e.IsDir() {
				exe := filepath.Join(cwd, "bin", "php", e.Name(), "php.exe")
				cmdPhp := exec.Command(exe, "-v")
				cmdPhp.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
				if out, err := cmdPhp.Output(); err == nil {
					if m := regexp.MustCompile(`PHP ([\d.]+)`).FindStringSubmatch(string(out)); len(m) > 1 {
						phpList = append(phpList, map[string]any{"folder": e.Name(), "versi": m[1], "isDefault": e.Name() == cfg.PHP})
					}
				}
			}
		}
		versions["php"] = phpList
	}
	
	if entries, err := os.ReadDir(filepath.Join(cwd, "bin", "mysql")); err == nil {
		var dbList []map[string]any
		for _, e := range entries {
			if e.IsDir() {
				exe := filepath.Join(cwd, "bin", "mysql", e.Name(), "bin", "mysqld.exe")
				cmdDb := exec.Command(exe, "-V")
				cmdDb.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
				if out, err := cmdDb.Output(); err == nil {
					if m := regexp.MustCompile(`Ver ([\d.]+)-?(MariaDB)?`).FindStringSubmatch(string(out)); len(m) > 1 {
						isMaria := ""
						if len(m) > 2 && m[2] != "" {
							isMaria = " (MariaDB)"
						}
						dbList = append(dbList, map[string]any{"folder": e.Name(), "versi": m[1] + isMaria, "isDefault": e.Name() == cfg.MySQL})
					}
				}
			}
		}
		versions["mysql"] = dbList
	}
	return versions
}

// ==== AUTO VHOST & SYNC HOSTS ====
func (a *App) generateVirtualHosts(webPort int) {
	cwd, _ := os.Getwd()
	wwwPath := filepath.Join(cwd, "www")
	vhostDir := filepath.Join(cwd, "bin", "nginx", "vhosts") 
	sslDir := filepath.Join(cwd, "bin", "nginx", "ssl")

	sslCert := strings.ReplaceAll(filepath.Join(sslDir, "server.crt"), "\\", "/")
	sslKey := strings.ReplaceAll(filepath.Join(sslDir, "server.key"), "\\", "/")

	os.MkdirAll(vhostDir, 0755)

	files, _ := os.ReadDir(vhostDir)
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".conf") {
			os.Remove(filepath.Join(vhostDir, f.Name()))
		}
	}

	localhostConf := fmt.Sprintf(`server {
    listen %d default_server; listen 443 ssl; server_name localhost 127.0.0.1;
    root "%s"; index index.php index.html index.htm; autoindex on;
    ssl_certificate "%s"; ssl_certificate_key "%s";
    location / { try_files $uri $uri/ =404; }
    location ~ \.php$ { fastcgi_pass 127.0.0.1:9000; fastcgi_index index.php; fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; include fastcgi_params; }
}`, webPort, strings.ReplaceAll(wwwPath, "\\", "/"), sslCert, sslKey)
	os.WriteFile(filepath.Join(vhostDir, "localhost.conf"), []byte(localhostConf), 0644)

	entries, _ := os.ReadDir(wwwPath)
	var domainList []string
	for _, entry := range entries {
		if entry.IsDir() && entry.Name() != "phpmyadmin" {
			domain := entry.Name() + ".test"
			domainList = append(domainList, domain)
			basePath := filepath.Join(wwwPath, entry.Name())
			docRoot := strings.ReplaceAll(basePath, "\\", "/")
			
			if _, err := os.Stat(filepath.Join(basePath, "public")); err == nil {
				docRoot += "/public"
			}

			vhostConf := fmt.Sprintf(`server {
    listen %d; listen 443 ssl; server_name %s; root "%s"; index index.php index.html index.htm;
    ssl_certificate "%s"; ssl_certificate_key "%s";
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ { fastcgi_pass 127.0.0.1:9000; fastcgi_index index.php; fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; include fastcgi_params; }
}`, webPort, domain, docRoot, sslCert, sslKey)
			os.WriteFile(filepath.Join(vhostDir, entry.Name()+".conf"), []byte(vhostConf), 0644)
		}
	}

	a.emitLog("🚀 Memulai sinkronisasi file hosts...")
	hostsPath := `C:\Windows\System32\drivers\etc\hosts`
	hostsBytes, _ := os.ReadFile(hostsPath)
	var newHostsLines []string
	for _, line := range strings.Split(string(hostsBytes), "\n") {
		cleanLine := strings.TrimRight(line, "\r")
		if !strings.Contains(cleanLine, "#magic ngappidserv") {
			newHostsLines = append(newHostsLines, cleanLine)
		}
	}
	newHostsLines = append(newHostsLines, "")
	for _, domain := range domainList {
		newHostsLines = append(newHostsLines, fmt.Sprintf("127.0.0.1 %s #magic ngappidserv", domain))
	}

	isiHostsBaru := strings.Join(newHostsLines, "\r\n") + "\r\n"
	if err := os.WriteFile(hostsPath, []byte(isiHostsBaru), 0666); err != nil {
		a.emitLog("⚠️ Memaksa mode Administrator Tertinggi (UAC)...")
		winTemp := filepath.Join(cwd, "hosts_temp.txt")
		batPath := filepath.Join(cwd, "bypass_hosts.bat")
		os.WriteFile(winTemp, []byte(isiHostsBaru), 0644)
		os.WriteFile(batPath, []byte(fmt.Sprintf(`@echo off
attrib -r -s -h "%s"
copy /y "%s" "%s"
ipconfig /flushdns`, hostsPath, winTemp, hostsPath)), 0644)

		cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", fmt.Sprintf(`Start-Process cmd.exe -ArgumentList '/c ""%s""' -Verb RunAs -WindowStyle Hidden -Wait`, batPath))
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		if cmd.Run() == nil {
			a.emitLog("✅ Sukses merewrite hosts via Administrator Bypass!")
		}
		os.Remove(winTemp)
		os.Remove(batPath)
	} else {
		cmdDns := exec.Command("ipconfig", "/flushdns")
		cmdDns.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		cmdDns.Run()
		a.emitLog("✅ Sukses menulis hosts murni!")
	}
}

// ==== START/STOP WEB (NGINX & PHP) ====
func (a *App) Start(port int) {
	if a.processes["nginx"] != nil || a.processes["php"] != nil {
		a.emitLog("Server sudah berjalan!")
		return
	}
	if port == 0 {
		port = 80
	}

	a.emitLog(fmt.Sprintf("🔍 Mengecek ketersediaan Port %d...", port))
	if a.isPortInUse(port) {
		a.emitLog(fmt.Sprintf("❌ GAGAL BUKA NGINX: Port %d sedang dipakai aplikasi lain.", port))
		a.emitStatus("lampuWeb", "off")
		return
	}

	cwd, _ := os.Getwd()

	// 1. SSL GENERATOR
	sslDir := filepath.Join(cwd, "bin", "nginx", "ssl")
	sslCert := filepath.Join(sslDir, "server.crt")
	sslKey := filepath.Join(sslDir, "server.key")

	if _, err := os.Stat(sslCert); os.IsNotExist(err) {
		a.emitLog("⚙️ Sertifikat SSL belum ada. Membuat otomatis...")
		mkcert := filepath.Join(sslDir, "mkcert.exe")
		
		domainArgs := []string{"-cert-file", sslCert, "-key-file", sslKey, "localhost", "127.0.0.1"}
		entries, _ := os.ReadDir(filepath.Join(cwd, "www"))
		for _, e := range entries {
			if e.IsDir() && e.Name() != "phpmyadmin" {
				domainArgs = append(domainArgs, e.Name()+".test")
			}
		}

		cmdInstall := exec.Command(mkcert, "-install")
		cmdInstall.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		cmdInstall.Run()

		cmdSSL := exec.Command(mkcert, domainArgs...)
		cmdSSL.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		
		out, err := cmdSSL.CombinedOutput()
		if err != nil {
			a.emitLog(fmt.Sprintf("❌ Gagal membuat SSL: %s", string(out)))
			return 
		}
		a.emitLog("✅ SSL Certificate berhasil dibuat!")
	}

	a.generateVirtualHosts(port)
	a.emitLog(fmt.Sprintf("🌐 Auto Virtual Host diperbarui (Port: %d)!", port))

	cfg := a.readSettings()
	phpExe := filepath.Join(cwd, "bin", "php", cfg.PHP, "php-cgi.exe")
	if _, err := os.Stat(phpExe); os.IsNotExist(err) {
		phpExe = filepath.Join(cwd, "bin", "php", "php-cgi.exe") 
	}

	// 2. AUTO-FIX PHP.INI (SESSION & EXTENSION PATH)
	phpIniPath := filepath.Join(filepath.Dir(phpExe), "php.ini")
	extPath := strings.ReplaceAll(filepath.Join(filepath.Dir(phpExe), "ext"), "\\", "/")
	
	// Bikin folder tmp khusus untuk session PHP
	tmpPath := filepath.Join(cwd, "bin", "php", "tmp")
	os.MkdirAll(tmpPath, 0755)
	tmpPathStr := strings.ReplaceAll(tmpPath, "\\", "/")

	if b, err := os.ReadFile(phpIniPath); err == nil {
		content := string(b)
		
		// Fix Extension Dir
		if strings.Contains(content, "extension_dir") {
			content = regexp.MustCompile(`(?m)^[\s#]*extension_dir\s*=.*`).ReplaceAllString(content, fmt.Sprintf(`extension_dir = "%s"`, extPath))
		} else {
			content += fmt.Sprintf("\nextension_dir = \"%s\"\n", extPath)
		}
		
		// Fix Session Path (Biar phpMyAdmin jalan)
		if strings.Contains(content, "session.save_path") {
			content = regexp.MustCompile(`(?m)^[\s#]*session\.save_path\s*=.*`).ReplaceAllString(content, fmt.Sprintf(`session.save_path = "%s"`, tmpPathStr))
		} else {
			content += fmt.Sprintf("\nsession.save_path = \"%s\"\n", tmpPathStr)
		}

		// Fix Upload Tmp Dir (Biar bisa upload file/database besar)
		if strings.Contains(content, "upload_tmp_dir") {
			content = regexp.MustCompile(`(?m)^[\s#]*upload_tmp_dir\s*=.*`).ReplaceAllString(content, fmt.Sprintf(`upload_tmp_dir = "%s"`, tmpPathStr))
		} else {
			content += fmt.Sprintf("\nupload_tmp_dir = \"%s\"\n", tmpPathStr)
		}

		os.WriteFile(phpIniPath, []byte(content), 0644)
	}

	// Kill sisa zombie
	cmdKillPHP := exec.Command("taskkill", "/F", "/IM", "php-cgi.exe")
	cmdKillPHP.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	cmdKillPHP.Run()

	cmdKillNginx := exec.Command("taskkill", "/F", "/IM", "nginx.exe")
	cmdKillNginx.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	cmdKillNginx.Run()

	phpCmd := exec.Command(phpExe, "-b", "127.0.0.1:9000")
	phpCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := phpCmd.Start(); err != nil {
		a.emitLog(fmt.Sprintf("❌ Gagal start PHP: %v", err))
		return
	}
	a.processes["php"] = phpCmd

	nginxExe := filepath.Join(cwd, "bin", "nginx", "nginx.exe")
	nginxDir := filepath.Join(cwd, "bin", "nginx")
	
	os.MkdirAll(filepath.Join(nginxDir, "logs"), 0755)
	os.MkdirAll(filepath.Join(nginxDir, "temp"), 0755)

	nginxCmd := exec.Command(nginxExe, "-p", nginxDir)
	nginxCmd.Dir = nginxDir 
	nginxCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	
	stderr, _ := nginxCmd.StderrPipe()

	if err := nginxCmd.Start(); err != nil {
		a.killProcess("php", "php-cgi.exe")
		a.emitLog(fmt.Sprintf("❌ Gagal start Nginx: %v", err))
		return
	}
	a.processes["nginx"] = nginxCmd

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			a.emitLog("🔴 [NGINX ERROR] " + scanner.Text())
		}
		nginxCmd.Wait()
		a.emitLog("⚠️ NGINX TIBA-TIBA BERHENTI (CRASH)!")
		a.emitStatus("lampuWeb", "off")
	}()

	a.emitLog(fmt.Sprintf("🚀 Nginx & PHP-CGI Aktif (Port %d)", port))
	a.emitStatus("lampuWeb", "on")
}

func (a *App) Stop() {
	cwd, _ := os.Getwd()
	cmdQuit := exec.Command(filepath.Join(cwd, "bin", "nginx", "nginx.exe"), "-s", "quit", "-p", filepath.Join(cwd, "bin", "nginx"))
	cmdQuit.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	cmdQuit.Run()

	a.killProcess("nginx", "nginx.exe")
	a.killProcess("php", "php-cgi.exe")
	a.emitLog("🛑 Nginx & PHP Dimatikan")
	a.emitStatus("lampuWeb", "off")
}

// ==== START/STOP DB (MYSQL) ====
func (a *App) StartDB(port int) {
	if a.processes["mysql"] != nil {
		a.emitLog("MySQL sudah berjalan!")
		return
	}
	if port == 0 {
		port = 3307
	}
	if a.isPortInUse(port) {
		a.emitLog(fmt.Sprintf("❌ GAGAL: Port %d sudah digunakan.", port))
		a.emitStatus("lampuDB", "off")
		return
	}

	cwd, _ := os.Getwd()
	cfg := a.readSettings()
	dataDir := filepath.Join(cwd, "data", "mysql")
	os.MkdirAll(dataDir, 0755)

	mysqlExe := filepath.Join(cwd, "bin", "mysql", cfg.MySQL, "bin", "mysqld.exe")
	if _, err := os.Stat(mysqlExe); os.IsNotExist(err) {
		mysqlExe = filepath.Join(cwd, "bin", "mysql", "mysqld.exe")
	}

	dbCmd := exec.Command(mysqlExe, "--console", fmt.Sprintf("--datadir=%s", dataDir), fmt.Sprintf("--port=%d", port))
	dbCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := dbCmd.Start(); err != nil {
		a.emitLog(fmt.Sprintf("❌ Gagal start MySQL: %v", err))
		return
	}
	a.processes["mysql"] = dbCmd

	a.emitLog(fmt.Sprintf("🐬 Database %s Aktif di Port %d", cfg.MySQL, port))
	a.emitStatus("lampuDB", "on")
}

func (a *App) StopDB() {
	a.killProcess("mysql", "mysqld.exe")
	a.emitLog("🛑 Database MySQL Dimatikan")
	a.emitStatus("lampuDB", "off")
}

// ==== START/STOP REDIS ====
func (a *App) StartRedis() {
	if a.processes["redis"] != nil {
		return
	}
	cwd, _ := os.Getwd()
	cmd := exec.Command(filepath.Join(cwd, "bin", "redis", "redis-server.exe"))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := cmd.Start(); err == nil {
		a.processes["redis"] = cmd
		a.emitLog("⚡ Database Redis Aktif di Port 6379")
		a.emitStatus("lampuRedis", "on")
	}
}

func (a *App) StopRedis() {
	a.killProcess("redis", "redis-server.exe")
	a.emitStatus("lampuRedis", "off")
}

// ==== START/STOP MAILPIT ====
func (a *App) StartMail() {
	if a.processes["mail"] != nil {
		return
	}
	cwd, _ := os.Getwd()
	cmd := exec.Command(filepath.Join(cwd, "bin", "mail", "mailpit.exe"))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := cmd.Start(); err == nil {
		a.processes["mail"] = cmd
		a.emitLog("✉️ Mail Catcher Aktif! Web UI: http://localhost:8025")
		a.emitStatus("lampuMail", "on")
	}
}

func (a *App) StopMail() {
	a.killProcess("mail", "mailpit.exe")
	a.emitStatus("lampuMail", "off")
}

// ==== LOCALTUNNEL CUSTOM SUBDOMAIN (YEDIN-NGAPPID STYLE) ====
type TunnelData struct {
	Domain string `json:"domain"`
	Port   any    `json:"port"`
}

func (a *App) StartTunnel(data TunnelData) {
	if a.processes["tunnel"] != nil {
		return
	}
	
	// 1. Parsing Port
	portInt := 80
	switch v := data.Port.(type) {
	case float64:
		portInt = int(v)
	case int:
		portInt = v
	case string:
		if parsed, err := strconv.Atoi(v); err == nil {
			portInt = parsed
		}
	}
	if portInt == 0 {
		portInt = 80
	}

	// 2. Generate Custom Subdomain
	domainTarget := data.Domain
	if domainTarget == "" {
		domainTarget = "percobaan.test"
	}
	baseName := strings.TrimSuffix(domainTarget, ".test")
	baseName = strings.TrimSuffix(baseName, ".local")
	baseName = strings.ToLower(baseName)
	randNum := 10 + time.Now().UnixNano()%90 
	customSubdomain := fmt.Sprintf("%s-%d-yedin-ngappid", baseName, randNum)

	a.emitLog(fmt.Sprintf("⏳ Menghubungkan Localtunnel [%s.loca.lt]...", customSubdomain))
	
	// 3. Eksekusi Node Portable Anti-Bentrok
	cwd, _ := os.Getwd()
	nodeExe := filepath.Join(cwd, "bin", "localtunnel", "lt-node.exe")
	ltScript := filepath.Join(cwd, "bin", "localtunnel", "node_modules", "localtunnel", "bin", "lt.js")

	// Tambahkan argumen "--local-host", domainTarget agar tunnel masuk ke vhost yang tepat
	cmd := exec.Command(nodeExe, ltScript, "--port", fmt.Sprintf("%d", portInt), "--subdomain", customSubdomain, "--local-host", domainTarget)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err == nil {
		a.processes["tunnel"] = cmd
	} else {
		a.emitLog(fmt.Sprintf("❌ Gagal: %v. Pastikan lt-node.exe ada di bin/localtunnel.", err))
		return
	}

	// 4. Goroutine Tangkap Output Sukses
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "your url is:") {
				parts := strings.Split(line, "is: ")
				if len(parts) > 1 {
					publicUrl := strings.TrimSpace(parts[1])
					a.emitLog(fmt.Sprintf("🌍 Localtunnel Aktif: %s", publicUrl))
					runtime.EventsEmit(a.ctx, "tunnel-url", publicUrl)
					a.emitStatus("lampuTunnel", "on")
				}
			}
		}
	}()

	// 5. Goroutine Tangkap Error
	go func() {
		scannerErr := bufio.NewScanner(stderr)
		for scannerErr.Scan() {
			a.emitLog("🔴 [Localtunnel Error]: " + scannerErr.Text())
		}
	}()
}

func (a *App) StopTunnel() {
	a.killProcess("tunnel", "lt-node.exe")
	a.emitLog("🛑 Tunnel Dimatikan")
	a.emitStatus("lampuTunnel", "off")
	runtime.EventsEmit(a.ctx, "tunnel-url", nil)
}

func (a *App) StopAll() {
	a.Stop()
	a.StopDB()
	a.StopRedis()
	a.StopMail()
	a.StopTunnel()
	a.emitLog("🛑 SEMUA LAYANAN BERHASIL DIMATIKAN!")
}

// ==== PROJECT MANAGER ====

func (a *App) getWwwPath() string {
	exePath, _ := os.Executable()
	return filepath.Join(filepath.Dir(exePath), "www")
}

func (a *App) GetProjects() []string {
	projs := []string{}
	entries, _ := os.ReadDir(a.getWwwPath())
	
	for _, e := range entries {
		if e.IsDir() && e.Name() != "phpmyadmin" {
			projs = append(projs, e.Name())
		}
	}
	return projs
}

func (a *App) OpenFolder(projectName string) {
	// Dapatkan path akurat
	targetPath := filepath.Join(a.getWwwPath(), projectName)
	
	// Panggil native Explorer Windows (nggak butuh trik cmd hide lagi)
	err := exec.Command("explorer", targetPath).Start()
	
	if err != nil {
		a.emitLog(fmt.Sprintf("❌ Gagal membuka folder: %v", err))
	} else {
		a.emitLog(fmt.Sprintf("📂 Membuka folder: %s", projectName))
	}
}

func (a *App) DeleteProject(projectName string) {
	wwwPath := a.getWwwPath()
	vhostPath := filepath.Join(filepath.Dir(wwwPath), "bin", "nginx", "vhosts", projectName+".conf")
	
	os.RemoveAll(filepath.Join(wwwPath, projectName))
	os.Remove(vhostPath)
	a.emitLog(fmt.Sprintf("🗑️ Project [%s] berhasil dihapus permanen!", projectName))
}


// ==== BACKUP DB ====
func (a *App) BackupDB(port int) {
	if port == 0 {
		port = 3307
	}
	cwd, _ := os.Getwd()
	cfg := a.readSettings()
	dumpPath := filepath.Join(cwd, "bin", "mysql", cfg.MySQL, "bin", "mysqldump.exe")
	if _, err := os.Stat(dumpPath); os.IsNotExist(err) {
		dumpPath = filepath.Join(cwd, "bin", "mysql", "mysqldump.exe")
	}

	backupDir := filepath.Join(cwd, "data", "backup_mysql")
	os.MkdirAll(backupDir, 0755)

	dateStr := time.Now().Format("2006-01-02_15-04-05")
	backupFile := filepath.Join(backupDir, fmt.Sprintf("backup_%s.sql", dateStr))

	a.emitLog("⏳ Memulai proses backup seluruh database...")
	cmd := exec.Command("cmd", "/c", fmt.Sprintf(`"%s" -u root --port=%d --all-databases > "%s"`, dumpPath, port, backupFile))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := cmd.Run(); err != nil {
		a.emitLog(fmt.Sprintf("❌ Gagal mem-backup database: %v", err))
	} else {
		a.emitLog(fmt.Sprintf("✅ Sukses! Database berhasil dibackup ke: data/backup_mysql/backup_%s.sql", dateStr))
	}
}

// ==== REBUILD SSL ====
func (a *App) RebuildSSL() {
	a.emitLog("🔐 Memulai proses Rebuild SSL...")
	cwd, _ := os.Getwd()
	sslDir := filepath.Join(cwd, "bin", "nginx", "ssl")
	os.Remove(filepath.Join(sslDir, "server.crt"))
	os.Remove(filepath.Join(sslDir, "server.key"))

	domainArgs := []string{"-cert-file", filepath.Join(sslDir, "server.crt"), "-key-file", filepath.Join(sslDir, "server.key"), "localhost", "127.0.0.1"}
	entries, _ := os.ReadDir(filepath.Join(cwd, "www"))
	for _, e := range entries {
		if e.IsDir() && e.Name() != "phpmyadmin" {
			domainArgs = append(domainArgs, e.Name()+".test")
		}
	}

	mkcert := filepath.Join(sslDir, "mkcert.exe")
	
	cmdInstall := exec.Command(mkcert, "-install")
	cmdInstall.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	cmdInstall.Run()

	cmdSSL := exec.Command(mkcert, domainArgs...)
	cmdSSL.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	
	out, err := cmdSSL.CombinedOutput()
	if err != nil {
		a.emitLog(fmt.Sprintf("❌ Gagal Rebuild SSL: %s", string(out)))
		return
	}

	a.generateVirtualHosts(80)
	a.emitLog("✅ Rebuild SSL Sukses! Silakan STOP PHP lalu START PHP kembali.")
}

// ==== AUTO INSTALLER ====
type InstallData struct {
	AppName     string `json:"appName"`
	ProjectName string `json:"projectName"`
}

func (a *App) InstallApp(data InstallData) {
	cwd, _ := os.Getwd()
	targetPath := filepath.Join(cwd, "www", data.ProjectName)
	if _, err := os.Stat(targetPath); err == nil {
		a.emitLog(fmt.Sprintf("❌ Gagal: Folder project %s sudah ada!", data.ProjectName))
		return
	}

	a.emitLog(fmt.Sprintf("📦 Menyiapkan instalasi [%s]...", strings.ToUpper(data.AppName)))
	cfg := a.readSettings()
	phpExe := filepath.Join(cwd, "bin", "php", cfg.PHP, "php.exe")
	if _, err := os.Stat(phpExe); os.IsNotExist(err) {
		phpExe = filepath.Join(cwd, "bin", "php", "php.exe")
	}

	scriptPath := filepath.Join(cwd, fmt.Sprintf("install_%s.ps1", data.ProjectName))
	var psScript string
	isComposer := false

	if data.AppName == "wordpress" {
		zip := filepath.Join(cwd, "www", data.ProjectName+"_temp.zip")
		ext := filepath.Join(cwd, "www", data.ProjectName+"_ext")
		psScript = fmt.Sprintf(`$ErrorActionPreference = 'Stop'; Invoke-WebRequest -Uri 'https://wordpress.org/latest.zip' -OutFile '%s'; Expand-Archive -Path '%s' -DestinationPath '%s' -Force; New-Item -ItemType Directory -Force -Path '%s'; Copy-Item -Path '%s\wordpress\*' -Destination '%s' -Recurse -Force; Remove-Item -Path '%s' -Recurse -Force; Remove-Item -Path '%s' -Force`, zip, zip, ext, targetPath, ext, targetPath, ext, zip)
	} else if data.AppName == "joomla" {
		zip := filepath.Join(cwd, "www", data.ProjectName+"_temp.zip")
		psScript = fmt.Sprintf(`$ErrorActionPreference = 'Stop'; Invoke-WebRequest -Uri 'https://github.com/joomla/joomla-cms/releases/download/5.1.0/Joomla_5.1.0-Stable-Full_Package.zip' -OutFile '%s'; Expand-Archive -Path '%s' -DestinationPath '%s' -Force; Remove-Item -Path '%s' -Force`, zip, zip, targetPath, zip)
	} else if data.AppName == "laravel" || data.AppName == "ci4" {
		isComposer = true
		composer := filepath.Join(cwd, "www", fmt.Sprintf("composer_%s.phar", data.ProjectName))
		cmdApp := "codeigniter4/appstarter"
		if data.AppName == "laravel" {
			cmdApp = "laravel/laravel"
		}
		psScript = fmt.Sprintf(`$ErrorActionPreference = 'Continue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile '%s'; & '%s' '%s' create-project %s '%s' --no-interaction; Set-Location -Path '%s'; & '%s' '%s' install --no-interaction; & '%s' '%s' update --no-interaction; Remove-Item -Path '%s' -Force`, composer, phpExe, composer, cmdApp, targetPath, targetPath, phpExe, composer, phpExe, composer, composer)
	}

	os.WriteFile(scriptPath, []byte(psScript), 0644)
	go func() {
		cmd := exec.Command("powershell.exe", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		cmd.Run()
		os.Remove(scriptPath)
		if _, err := os.Stat(targetPath); err == nil {
			a.emitLog(fmt.Sprintf("✅ %s berhasil diinstal di www/%s!", strings.ToUpper(data.AppName), data.ProjectName))
			if isComposer {
				a.emitLog(fmt.Sprintf("🌐 Akses via: https://%s.test/public", data.ProjectName))
			} else {
				a.emitLog(fmt.Sprintf("🌐 Akses via: https://%s.test", data.ProjectName))
			}
		} else {
			a.emitLog("❌ GAGAL: Aplikasi tidak terinstal.")
		}
	}()
}

// ==== TOOLS & LOGS ====
func (a *App) OpenCmdWWW() {
	cwd, _ := os.Getwd()
	wwwPath := filepath.Join(cwd, "www")
	// Ini dibiarkan muncul karena tujuannya emang ngebuka Console untuk interaksi user
	cmd := exec.Command("cmd", "/c", "start", "NgAppIDServ Console", "cmd.exe", "/k", fmt.Sprintf(`chcp 65001 >nul & color 0A & title NgAppIDServ Console & echo ================================================== & echo. & echo        🚀 WELCOME TO NgAppIDServ CONSOLE 🚀 & echo. & echo ================================================== & echo. & cd /d "%s"`, wwwPath))
	cmd.Run()
	a.emitLog("⌨️ Membuka NgAppIDServ Console di folder www...")
}

func (a *App) OpenLog(logType string) {
	cwd, _ := os.Getwd()
	cfg := a.readSettings()
	logPath := filepath.Join(cwd, "crash_log.txt")

	if logType == "nginx" {
		logPath = filepath.Join(cwd, "bin", "nginx", "logs", "error.log")
	} else if logType == "php" {
		logPath = filepath.Join(cwd, "bin", "php", cfg.PHP, "php_errors.log")
		if _, err := os.Stat(logPath); os.IsNotExist(err) {
			logPath = filepath.Join(cwd, "bin", "php", "php_errors.log")
		}
	} else if logType == "mysql" {
		logPath = filepath.Join(cwd, "data", "mysql", "mysql_error.log")
	}

	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		os.MkdirAll(filepath.Dir(logPath), 0755)
		os.WriteFile(logPath, []byte(fmt.Sprintf("=== Log %s (Belum Ada Error) ===\n\n", strings.ToUpper(logType))), 0644)
	}
	// Ini dibiarkan muncul karena tujuannya ngebuka Notepad
	cmd := exec.Command("cmd", "/c", "start", `""`, logPath)
	cmd.Run()
	a.emitLog(fmt.Sprintf("📖 Membuka file log %s...", strings.ToUpper(logType)))
}