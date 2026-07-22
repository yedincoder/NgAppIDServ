// Tambahin 'dialog' di dalam kurung kurawal ini
const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http'); 
const { autoUpdater } = require('electron-updater');
const baseDir = app.isPackaged ? process.resourcesPath : __dirname;

let mainWindow;
let phpCgiServer; 
let nginxServer;  
let mysqlServer; 
let redisServer; 
let mailServer; 
let ngrokServer; 
let lisensiWindow;
let isPro = false;
let tray = null;
let isQuiting = false;

const { machineIdSync } = require('node-machine-id');
const { createClient } = require('@supabase/supabase-js');

// Masukkan URL dan Anon Key dari dashboard Supabase kamu
const supabaseUrl = 'https://lyhzefifpfkouvvzdvwr.supabase.co';
const supabaseKey = 'sb_publishable_qh6G0sDdr9fjcLRjfZEjlQ_6-xT-Hk1';
const supabase = createClient(supabaseUrl, supabaseKey);

const net = require('net');

// Fungsi cerdas buat ngecek port kosong atau kepakai (Asynchronous)
function isPortInUse(port) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        
        tester.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true); // Port lagi dipakai aplikasi lain
            } else {
                resolve(false);
            }
        });

        tester.once('listening', () => {
            tester.close();
            resolve(false); // Port aman & kosong
        });

        tester.listen(port, '127.0.0.1');
    });
}
const util = require('util');
const execAsync = util.promisify(require('child_process').exec);

// --- FITUR AUTO-DETEKSI VERSI MESIN ---
ipcMain.handle('get-versions', async () => {
    let versions = { nginx: 'Unknown', php: 'Unknown', mysql: 'Unknown' };

    try {
        // 1. Cek Versi Nginx (Nginx ngeluarin log versi di stderr)
        const nginxPath = path.join(baseDir, 'bin', 'nginx', 'nginx.exe');
        if (fs.existsSync(nginxPath)) {
            const { stderr } = await execAsync(`"${nginxPath}" -v`).catch(e => e);
            const match = stderr.match(/nginx\/([\d.]+)/);
            if (match) versions.nginx = 'v' + match[1];
        }
    } catch (e) {}

    try {
        // 2. Cek Versi PHP (Otomatis nyari folder apapun di dalam bin/php/)
        const phpDir = path.join(baseDir, 'bin', 'php');
        if (fs.existsSync(phpDir)) {
            const folders = fs.readdirSync(phpDir);
            if (folders.length > 0) {
                const phpExe = path.join(phpDir, folders[0], 'php.exe');
                if (fs.existsSync(phpExe)) {
                    const { stdout } = await execAsync(`"${phpExe}" -v`);
                    const match = stdout.match(/PHP ([\d.]+)/);
                    if (match) versions.php = 'v' + match[1];
                }
            }
        }
    } catch (e) {}

    try {
        // 3. Cek Versi MariaDB/MySQL
        const mysqlDir = path.join(baseDir, 'bin', 'mysql');
        if (fs.existsSync(mysqlDir)) {
            const folders = fs.readdirSync(mysqlDir);
            if (folders.length > 0) {
                const mysqlExe = path.join(mysqlDir, folders[0], 'bin', 'mysqld.exe');
                if (fs.existsSync(mysqlExe)) {
                    const { stdout } = await execAsync(`"${mysqlExe}" -V`);
                    // Contoh Output MariaDB: mysqld  Ver 11.4.2-MariaDB for Win64
                    const match = stdout.match(/Ver ([\d.]+)-?(MariaDB)?/i);
                    if (match) {
                        const isMaria = match[2] ? ' (MariaDB)' : '';
                        versions.mysql = 'v' + match[1] + isMaria;
                    }
                }
            }
        }
    } catch (e) {}

    return versions;
});
// ==========================================
// 🛡️ AUTO-WHITELIST WINDOWS FIREWALL
// ==========================================
function setupFirewallRules() {
    // Ambil path absolut dari file .exe Nginx dan MySQL
    const nginxPath = path.join(baseDir, 'bin', 'nginx', 'nginx.exe');
    const mysqlPath = path.join(baseDir, 'bin', 'mysql', 'mariadb', 'bin', 'mysqld.exe');

    // Command bawaan Windows (netsh) untuk mendaftarkan aplikasi ke Firewall
    const cmdNginx = `netsh advfirewall firewall add rule name="NgAppIDServ - Nginx" dir=in action=allow program="${nginxPath}" enable=yes profile=any`;
    const cmdMysql = `netsh advfirewall firewall add rule name="NgAppIDServ - MySQL" dir=in action=allow program="${mysqlPath}" enable=yes profile=any`;

    // Eksekusi secara background (Asynchronous)
    exec(cmdNginx, (err) => {
        if (err) console.error("Gagal menambahkan Nginx ke Firewall:", err.message);
        else console.log("✅ Nginx berhasil di-whitelist Firewall!");
    });
    
    exec(cmdMysql, (err) => {
        if (err) console.error("Gagal menambahkan MySQL ke Firewall:", err.message);
        else console.log("✅ MySQL berhasil di-whitelist Firewall!");
    });
}

async function validasiLisensi() {
    try {
        const hwid = machineIdSync();
        
        const { data, error } = await supabase
            .from('lisensi')
            .select('*')
            .eq('hwid', hwid)
            .single();

        // Kalau lisensi valid dan aktif, jadikan PRO
        if (!error && data && data.status === 'aktif') {
            isPro = true;
            console.log("Lisensi PRO Aktif!");
        } else {
            isPro = false; // Tetap Free
        }
    } catch (err) {
        isPro = false;
    }
}

function bukaJendelaAktivasi(hwid) {
    if (lisensiWindow) {
        lisensiWindow.focus();
        return;
    }

    lisensiWindow = new BrowserWindow({
        width: 350, // Ukuran ideal untuk jendela Pop-Up Lisensi
        height: 450,
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolated: true,
            preload: path.join(__dirname, 'preload.js') // Preload aman pakai __dirname
        }
    });

    lisensiWindow.loadFile('lisensi.html');

    lisensiWindow.webContents.on('did-finish-load', () => {
        lisensiWindow.webContents.send('receive-hwid', hwid);
    });

    lisensiWindow.on('closed', () => {
        lisensiWindow = null;
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 750, // Layar utama sudah Horizontal / Dashboard
        height: 550, 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    mainWindow.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            mainWindow.webContents.send('server-log', '🔽 Aplikasi disembunyikan ke System Tray.');
        }
        return false;
    });
}

app.whenReady().then(() => {
    validasiLisensi(); 
    createWindow();
	setupFirewallRules(); // 👈 PANGGIL FUNGSINYA DI SINI
	autoUpdater.checkForUpdatesAndNotify();

    const iconPath = path.join(__dirname, 'icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('NgAppIDServ');

    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Buka NgAppIDServ', 
            click: function () { if(mainWindow) mainWindow.show(); } 
        },
        { 
            label: 'Matikan Server & Keluar', 
            click: function () {
                isQuiting = true;
                if (phpCgiServer) phpCgiServer.kill();
                if (mysqlServer) mysqlServer.kill();
                if (redisServer) redisServer.kill();
                if (mailServer) mailServer.kill(); 
    // Hapus blok try-catch execSync yang lama, ganti dengan ini:
    const daftarProses = [
        'nginx.exe', 'php-cgi.exe', 'mysqld.exe', 
        'redis-server.exe', 'mailpit.exe', 'ngrok.exe'
    ];

    daftarProses.forEach((proses) => {
        // Berjalan async di background, UI nggak bakal freeze
        exec(`taskkill /F /IM ${proses}`, (error) => {
            // Abaikan error kalau prosesnya memang sudah mati
        });
    });
                app.quit(); 
            } 
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        if(mainWindow) mainWindow.show();
    });
});

ipcMain.on('buka-lisensi', () => {
    const hwid = machineIdSync();
    bukaJendelaAktivasi(hwid);
});

ipcMain.handle('get-hwid', () => {
    return machineIdSync();
});

ipcMain.on('submit-license', async (event, data) => {
    const { hwid, license } = data;
    
    try {
        // Jangan pakai .select() lalu .update() secara terpisah.
        // Langsung panggil RPC function yang aman di sisi server.
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('claim_lisensi', {
                p_kode_lisensi: license,
                p_hwid: hwid
            });

        if (rpcError) {
            event.reply('license-result', { success: false, message: 'Gagal menghubungi server lisensi.' });
            return;
        }

        // rpcData akan berisi pesan sukses/error dari Postgres
        if (rpcData.startsWith('success')) {
            isPro = true;
            event.reply('license-result', { success: true, message: 'Aktivasi Berhasil! Membuka aplikasi...' });
            
            setTimeout(() => {
                if (lisensiWindow) lisensiWindow.close();
            }, 2000);
        } else {
            // Contoh kembalian: 'error: Lisensi sudah digunakan di perangkat lain.'
            event.reply('license-result', { success: false, message: rpcData.replace('error: ', '') });
        }
    } catch (error) {
        event.reply('license-result', { success: false, message: 'Terjadi kesalahan sistem.' });
    }
});

const fsPromises = require('fs').promises;
// Tambahkan kata 'async' di depan fungsi
async function generateVirtualHosts(port) {
    const webPort = port || 80;
    const hostsFilePath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    const wwwPath = path.join(baseDir, 'www');
    const vhostDir = path.join(baseDir, 'bin', 'nginx', 'vhosts');
    const sslDir = path.join(baseDir, 'bin', 'nginx', 'ssl');
    
    const sslCertPath = path.join(sslDir, 'server.crt').replace(/\\/g, '/');
    const sslKeyPath = path.join(sslDir, 'server.key').replace(/\\/g, '/');

    // Pakai metode async/await buat I/O
    if (!fs.existsSync(vhostDir)) {
        await fsPromises.mkdir(vhostDir, { recursive: true });
    }

    if (!fs.existsSync(wwwPath)) return;

    const localhostConfPath = path.join(vhostDir, 'localhost.conf');
    const localhostConfig = `
server {
    listen ${webPort} default_server;
    server_name localhost 127.0.0.1;
    root "${wwwPath.replace(/\\/g, '/')}";
    index index.php index.html index.htm;
    autoindex on;

    location / { try_files $uri $uri/ =404; }
    location ~ \\.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
`;
    // Write file async
    await fsPromises.writeFile(localhostConfPath, localhostConfig);

    // Read dir async
    const dirents = await fsPromises.readdir(wwwPath, { withFileTypes: true });
    const folders = dirents.filter(dirent => dirent.isDirectory() && dirent.name !== 'phpmyadmin')
                           .map(dirent => dirent.name);

    // Read hosts file async
    let hostsContent = await fsPromises.readFile(hostsFilePath, 'utf8');
    let hostsModified = false;

    // Loop tulis file async
    for (const folder of folders) {
        const domain = `${folder}.test`;
        const projectPath = path.join(wwwPath, folder).replace(/\\/g, '/');
        const confPath = path.join(vhostDir, `${folder}.conf`);

        const vhostConfig = `
server {
    listen ${webPort};
    listen 443 ssl;
    server_name ${domain};
    root "${projectPath}";
    index index.php index.html index.htm;
    ssl_certificate "${sslCertPath}";
    ssl_certificate_key "${sslKeyPath}";

    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \\.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
`;
        await fsPromises.writeFile(confPath, vhostConfig);

        if (!hostsContent.includes(domain)) {
            hostsContent += `\n127.0.0.1 ${domain}`;
            hostsModified = true;
        }
    }

    if (hostsModified) {
        try {
            await fsPromises.writeFile(hostsFilePath, hostsContent, 'utf8');
        } catch (err) {
            console.error('Gagal menulis ke file hosts. Jalankan sebagai Admin!');
        }
    }
}

// Tambahkan kata async di sini 👇
ipcMain.on('start-server', async (event, port) => {
    const targetPort = port || 80;

    if (nginxServer || phpCgiServer) {
        event.reply('server-log', 'Server sudah berjalan!');
        return;
    }

    // 🛡️ PRE-FLIGHT PORT CHECKER 
    event.reply('server-log', `🔍 Mengecek ketersediaan Port ${targetPort}...`);
    const portTerpakai = await isPortInUse(targetPort);
    
    if (portTerpakai) {
        event.reply('server-log', `❌ GAGAL BUKA NGINX: Port ${targetPort} sedang dipakai aplikasi lain (Skype/VMWare/IIS).`);
        event.reply('server-log', `💡 Solusi: Ganti angka port di aplikasi lalu klik Start lagi.`);
        event.reply('server-status', { id: 'lampuWeb', status: 'off' });
        return; // Stop proses sampai di sini, Nginx batal jalan!
    }

    const sslDir = path.join(baseDir, 'bin', 'nginx', 'ssl');
    const sslCertPath = path.join(sslDir, 'server.crt');
    const sslKeyPath = path.join(sslDir, 'server.key');
    const mkcertPath = path.join(sslDir, 'mkcert.exe');

    if (!fs.existsSync(sslCertPath) || !fs.existsSync(sslKeyPath)) {
        // ... (Kode sebelumnya saat lo nge-spawn ngrokServer) ...
        event.reply('server-log', `⏳ Meng-online-kan project [${targetDomain}] di Port ${targetPort}...`);
        ngrokServer = spawn(ngrokExe, ['http', targetPort, `--host-header=${targetDomain}`], { cwd: ngrokPath });

        // --- HAPUS BLOK setTimeout LAMA, GANTI DENGAN POLLING INI ---
        let retries = 0;
        const maxRetries = 15; // Maksimal nunggu 15 detik

        const checkNgrok = setInterval(() => {
            retries++;
            
            http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (parsed.tunnels && parsed.tunnels.length > 0) {
                            // SUKSES! Ngrok udah ngasih URL
                            clearInterval(checkNgrok); // Hentikan timer
                            
                            const publicUrl = parsed.tunnels[0].public_url;
                            event.reply('server-log', `🌍 Ngrok Sukses Terkoneksi!`);
                            event.reply('ngrok-url', publicUrl);
                            event.reply('server-status', { id: 'lampuNgrok', status: 'on' });
                        }
                    } catch (e) {
                        // Kalau parse JSON gagal, berarti API belum siap. Biarkan interval lanjut.
                    }
                });
            }).on('error', (err) => {
                // Koneksi ke API lokal Ngrok ditolak (belum up)
                if (retries >= maxRetries) {
                    clearInterval(checkNgrok);
                    event.reply('server-log', '❌ Timeout: Gagal terhubung ke server Ngrok setelah 15 detik. Coba lagi.');
                    
                    // Kill process karena kelamaan
                    if (ngrokServer) {
                        ngrokServer.kill();
                        ngrokServer = null;
                    }
                    event.reply('server-status', { id: 'lampuNgrok', status: 'off' });
                }
            });

            // Safety catch kalau melebihi batas waktu (misal HTTP get nge-hang)
            if (retries >= maxRetries) {
                clearInterval(checkNgrok);
            }
        }, 1000); // Mengecek API Ngrok setiap 1000ms (1 detik)

        ngrokServer.on('close', () => { 
            ngrokServer = null; 
            clearInterval(checkNgrok); // Pastikan timer mati kalau user close Ngrok mendadak
        });
        // -------------------------------------------------------------
    }

    generateVirtualHosts(port); 
    event.reply('server-log', `🌐 Auto Virtual Host diperbarui (Port: ${port || 80})!`);
    
    const phpPathCgi = path.join(baseDir, 'bin', 'php', 'php-8.3', 'php-cgi.exe');
    const nginxPath = path.join(baseDir, 'bin', 'nginx', 'nginx.exe');
    const nginxDir = path.join(baseDir, 'bin', 'nginx');

    phpCgiServer = spawn(phpPathCgi, ['-b', '127.0.0.1:9000']);
    nginxServer = spawn(nginxPath, ['-p', nginxDir]);
    
    event.reply('server-log', `🚀 Nginx & PHP-CGI Aktif di HTTP & HTTPS (Port ${port || 80})`);
    event.reply('server-status', { id: 'lampuWeb', status: 'on' }); 

    nginxServer.stdout.on('data', (data) => event.reply('server-log', `[Nginx] ${data.toString()}`));
    nginxServer.stderr.on('data', (data) => event.reply('server-log', `[Nginx Error] ${data.toString()}`));
});

ipcMain.on('stop-server', (event) => {	
    let stopped = false;
    
    if (phpCgiServer) {
        phpCgiServer.kill(); 
        phpCgiServer = null;
        stopped = true;
    }
    
    if (nginxServer) {
        // Perbaikan: Menggunakan baseDir secara konsisten
        const nginxPath = path.join(baseDir, 'bin', 'nginx', 'nginx.exe');
        const nginxDir = path.join(baseDir, 'bin', 'nginx');
        execSync(`"${nginxPath}" -s quit -p "${nginxDir}"`);
        
        nginxServer.kill();
        nginxServer = null;
        stopped = true;
    }

    if (stopped) {
        event.reply('server-log', '🛑 Nginx & PHP Dimatikan');
        event.reply('server-status', { id: 'lampuWeb', status: 'off' }); 
    } else {
        event.reply('server-log', 'Server memang sedang mati.');
    }
});

// --- MESIN MYSQL ---
ipcMain.on('start-db', async (event, port) => {
    const dbPort = port || 3307; 
    
    if (mysqlServer) {
        event.reply('server-log', 'Database sudah berjalan!');
        return;
    }

    // (Opsional) PRE-FLIGHT PORT CHECKER yang tadi kita buat
    event.reply('server-log', `🔍 Mengecek ketersediaan Port ${dbPort}...`);
    const portTerpakai = await isPortInUse(dbPort);
    if (portTerpakai) {
        event.reply('server-log', `❌ GAGAL: Port ${dbPort} sudah digunakan oleh aplikasi database lain.`);
        event.reply('server-status', { id: 'lampuDB', status: 'off' });
        return;
    }

    // Path baru mengarah ke folder mariadb
    const mysqlPath = path.join(baseDir, 'bin', 'mysql', 'mariadb', 'bin', 'mysqld.exe');
    const installDbPath = path.join(baseDir, 'bin', 'mysql', 'mariadb', 'bin', 'mysql_install_db.exe');
    const dataPath = path.join(baseDir, 'data', 'mysql');

    if (!fs.existsSync(dataPath) || fs.readdirSync(dataPath).length === 0) {
        event.reply('server-log', '⚙️ Data kosong! Menginisialisasi MariaDB secara otomatis. Loading...');
        
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }

        try {
            // PERBEDAAN KRUSIAL: MariaDB pakai mysql_install_db.exe
            execSync(`"${installDbPath}" --datadir="${dataPath}"`);
            event.reply('server-log', '✅ Inisialisasi otomatis berhasil!');
        } catch (error) {
            event.reply('server-log', '❌ Gagal inisialisasi MariaDB: ' + error.message);
            return; 
        }
    }

    mysqlServer = spawn(mysqlPath, ['--console', `--datadir=${dataPath}`, `--port=${dbPort}`]);
    event.reply('server-log', `🐬 Database MariaDB Aktif di Port ${dbPort}`);
    event.reply('server-status', { id: 'lampuDB', status: 'on' });

    mysqlServer.stdout.on('data', (data) => event.reply('server-log', `[DB] ${data.toString()}`));
    mysqlServer.stderr.on('data', (data) => event.reply('server-log', `[DB] ${data.toString()}`));
});

ipcMain.on('stop-db', (event) => {
    if (mysqlServer) {
        mysqlServer.kill(); 
        mysqlServer = null;
        event.reply('server-log', '🛑 Database MySQL Dimatikan');
        event.reply('server-status', { id: 'lampuDB', status: 'off' }); 
    } else {
        event.reply('server-log', 'MySQL memang sedang mati.');
    }
});

// --- MESIN REDIS ---
ipcMain.on('start-redis', (event) => {
    if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Redis Cache khusus pengguna PRO. Silakan klik Donasi di bawah.');
        return;
    }
    if (redisServer) {
        event.reply('server-log', 'Redis sudah berjalan!');
        return;
    }
    
    const redisPath = path.join(baseDir, 'bin', 'redis', 'redis-server.exe');
    const redisConfPath = path.join(baseDir, 'bin', 'redis', 'redis.windows.conf');

    if (!fs.existsSync(redisPath)) {
        event.reply('server-log', '❌ File redis-server.exe tidak ditemukan!');
        return;
    }

    let args = [];
    if (fs.existsSync(redisConfPath)) {
        args.push(redisConfPath);
    }

    redisServer = spawn(redisPath, args);
    event.reply('server-log', '⚡ Database Redis Aktif di Port 6379');
    event.reply('server-status', { id: 'lampuRedis', status: 'on' }); 

    redisServer.stdout.on('data', (data) => event.reply('server-log', `[Redis] ${data.toString()}`));
    redisServer.stderr.on('data', (data) => event.reply('server-log', `[Redis] ${data.toString()}`));
});

ipcMain.on('stop-redis', (event) => {
    if (redisServer) {
        redisServer.kill(); 
        redisServer = null;
        event.reply('server-log', '🛑 Database Redis Dimatikan');
        event.reply('server-status', { id: 'lampuRedis', status: 'off' }); 
    } else {
        event.reply('server-log', 'Redis memang sedang mati.');
    }
});

// --- MESIN MAIL CATCHER (MAILPIT) ---
ipcMain.on('start-mail', (event) => {
    if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Mail Catcher (MailPit) khusus pengguna PRO. Silakan klik Donasi di bawah.');
        return;
    }
    if (mailServer) {
        event.reply('server-log', 'Mail Catcher sudah berjalan!');
        return;
    }
    
    const mailPath = path.join(baseDir, 'bin', 'mail', 'mailpit.exe');

    if (!fs.existsSync(mailPath)) {
        event.reply('server-log', '❌ File mailpit.exe tidak ditemukan!');
        return;
    }

    mailServer = spawn(mailPath);
    event.reply('server-log', '✉️ Mail Catcher Aktif! Web UI: http://localhost:8025');
    event.reply('server-status', { id: 'lampuMail', status: 'on' }); 

    mailServer.stderr.on('data', (data) => event.reply('server-log', `[Mail] ${data.toString()}`));
});

ipcMain.on('stop-mail', (event) => {
    if (mailServer) {
        mailServer.kill(); 
        mailServer = null;
        event.reply('server-log', '🛑 Mail Catcher Dimatikan');
        event.reply('server-status', { id: 'lampuMail', status: 'off' }); 
    } else {
        event.reply('server-log', 'Mail Catcher memang sedang mati.');
    }
});

// --- JALUR PINTAS BROWSER ---
ipcMain.on('open-pma', (event) => {
    shell.openExternal('https://phpmyadmin.test');
    event.reply('server-log', '🌐 Membuka phpMyAdmin di browser...');
});

// --- JALUR PINTAS BUKA LINK NGROK ---
ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// --- MESIN NGROK (SHARE KE PUBLIK) ---
ipcMain.on('start-ngrok', (event, data) => {
    if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Tunnel Ngrok khusus pengguna PRO. Silakan klik Donasi di bawah.');
        return;
    }
    if (ngrokServer) {
        event.reply('server-log', 'Ngrok sudah berjalan!');
        return;
    }

    const ngrokPath = path.join(baseDir, 'bin', 'ngrok');
    const ngrokExe = path.join(ngrokPath, 'ngrok.exe');

    if (!fs.existsSync(ngrokExe)) {
        event.reply('server-log', '❌ File ngrok.exe tidak ditemukan di bin/ngrok!');
        return;
    }

    try {
        // Bongkar data domain dan port yang dikirim dari UI
        const targetDomain = data.domain || 'localhost';
        const targetPort = data.port || 80;

        event.reply('server-log', `⏳ Meng-online-kan project [${targetDomain}] di Port ${targetPort}...`);
        
        // KUNCI PERBAIKANNYA ADA DI SINI: Tambahkan --host-header
        ngrokServer = spawn(ngrokExe, ['http', targetPort, `--host-header=${targetDomain}`], { cwd: ngrokPath });

        setTimeout(() => {
            http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.tunnels && parsed.tunnels.length > 0) {
                            const publicUrl = parsed.tunnels[0].public_url;
                            event.reply('server-log', `🌍 Ngrok Sukses Terkoneksi!`);
                            
                            event.reply('ngrok-url', publicUrl);
                            event.reply('server-status', { id: 'lampuNgrok', status: 'on' });
                        } else {
                            event.reply('server-log', '❌ Gagal mendapatkan link Ngrok.');
                        }
                    } catch (e) {}
                });
            }).on('error', (err) => {
                event.reply('server-log', '❌ API Ngrok tidak merespon.');
            });
        }, 3000);

        ngrokServer.on('close', () => { ngrokServer = null; });

    } catch (error) {
        event.reply('server-log', '❌ Gagal menjalankan Ngrok: ' + error.message);
    }
});

ipcMain.on('stop-ngrok', (event) => {
    let stopped = false;
    
    if (ngrokServer) {
        ngrokServer.kill(); 
        ngrokServer = null;
        stopped = true;
    }
    
    try {
        execSync('taskkill /F /IM ngrok.exe');
        stopped = true;
    } catch (e) {}

    if (stopped) {
        event.reply('server-log', '🛑 Ngrok Dimatikan');
        event.reply('server-status', { id: 'lampuNgrok', status: 'off' });
        
        event.reply('ngrok-url', null); 
    } else {
        event.reply('server-log', 'Ngrok memang sedang mati.');
    }
});

// --- FITUR MASTER: STOP ALL ---
ipcMain.on('stop-all', (event) => {
	if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Stop All khusus pengguna PRO. Silakan klik Donasi di bawah.');
        return;
    }
    let pesanLog = '🛑 [STOP ALL] Mematikan seluruh layanan...';
    
    if (phpCgiServer) { phpCgiServer.kill(); phpCgiServer = null; }
    if (nginxServer) { nginxServer.kill(); nginxServer = null; }
    if (mysqlServer) { mysqlServer.kill(); mysqlServer = null; }
    if (redisServer) { redisServer.kill(); redisServer = null; }
    if (mailServer) { mailServer.kill(); mailServer = null; }
    if (ngrokServer) { ngrokServer.kill(); ngrokServer = null; }

    try {
        execSync('taskkill /F /IM nginx.exe');
        execSync('taskkill /F /IM php-cgi.exe');
        execSync('taskkill /F /IM mysqld.exe');
        execSync('taskkill /F /IM redis-server.exe');
        execSync('taskkill /F /IM mailpit.exe');
        execSync('taskkill /F /IM ngrok.exe');
    } catch (e) {
    }

    event.reply('server-log', '🛑 SEMUA LAYANAN BERHASIL DIMATIKAN!');
    
    event.reply('server-status', { id: 'lampuWeb', status: 'off' });
    event.reply('server-status', { id: 'lampuDB', status: 'off' });
    event.reply('server-status', { id: 'lampuRedis', status: 'off' });
    event.reply('server-status', { id: 'lampuMail', status: 'off' });
    event.reply('server-status', { id: 'lampuNgrok', status: 'off' });
    
    event.reply('ngrok-url', null);
});

// --- FITUR BACA FOLDER PROJECT ---
ipcMain.handle('get-projects', () => {
    const wwwPath = path.join(baseDir, 'www');
    if (!fs.existsSync(wwwPath)) return [];
    
    return fs.readdirSync(wwwPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'phpmyadmin')
        .map(dirent => dirent.name);
});
// --- JALUR PINTAS BUKA FOLDER PROJECT ---
ipcMain.on('open-folder', (event, projectName) => {
    // Kalau projectName kosong (dari localhost), dia bakal buka folder www
    const folderPath = path.join(baseDir, 'www', projectName || '');
    
    if (fs.existsSync(folderPath)) {
        shell.openPath(folderPath);
    } else {
        event.reply('server-log', `❌ Folder [${projectName || 'www'}] tidak ditemukan!`);
    }
});
// --- FITUR HAPUS PROJECT ---
ipcMain.on('delete-project', (event, projectName) => {
    try {
        const wwwPath = path.join(baseDir, 'www');
        const targetPath = path.join(wwwPath, projectName);
        const vhostDir = path.join(baseDir, 'bin', 'nginx', 'vhosts');
        const confPath = path.join(vhostDir, `${projectName}.conf`);

        // 1. Hapus folder project beserta seluruh isinya secara paksa (recursive)
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        
        // 2. Hapus juga file konfigurasi Virtual Host Nginx-nya biar bersih
        if (fs.existsSync(confPath)) {
            fs.rmSync(confPath, { force: true });
        }
        
        event.reply('server-log', `🗑️ Project [${projectName}] beserta file config-nya berhasil dihapus permanen!`);
        event.reply('server-log', `⚠️ Disarankan klik STOP PHP lalu START PHP agar server kembali segar.`);
    } catch (error) {
        event.reply('server-log', `❌ Gagal menghapus project [${projectName}]. Pastikan file tidak sedang dibuka di VSCode/Text Editor. Error: ${error.message}`);
    }
});


// --- FITUR REBUILD SSL OTOMATIS ---
ipcMain.on('rebuild-ssl', (event) => {
	if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Rebuild SSL khusus pengguna PRO. Silakan klik Donasi di bawah.');
        return;
    }
    const sslDir = path.join(baseDir, 'bin', 'nginx', 'ssl');
    const wwwPath = path.join(baseDir, 'www');
    const sslCertPath = path.join(sslDir, 'server.crt');
    const sslKeyPath = path.join(sslDir, 'server.key');
    const mkcertPath = path.join(sslDir, 'mkcert.exe');

    if (fs.existsSync(mkcertPath)) {
        try {
            event.reply('server-log', '🔐 Memulai proses Rebuild SSL...');
            
            if (fs.existsSync(sslCertPath)) fs.unlinkSync(sslCertPath);
            if (fs.existsSync(sslKeyPath)) fs.unlinkSync(sslKeyPath);

            let daftarDomain = "localhost 127.0.0.1";
            
            if (fs.existsSync(wwwPath)) {
                const folders = fs.readdirSync(wwwPath, { withFileTypes: true })
                                  .filter(dirent => dirent.isDirectory() && dirent.name !== 'phpmyadmin')
                                  .map(dirent => `"${dirent.name}.test"`);
                
                if (folders.length > 0) {
                    daftarDomain += " " + folders.join(" ");
                }
            }

            execSync(`"${mkcertPath}" -install`);
            execSync(`"${mkcertPath}" -cert-file "${sslCertPath}" -key-file "${sslKeyPath}" ${daftarDomain}`);
            
            event.reply('server-log', `✅ Rebuild SSL Sukses! Domain terdaftar: ${daftarDomain}`);
            event.reply('server-log', '⚠️ Silakan klik STOP PHP lalu START PHP kembali agar SSL baru terbaca.');
        } catch (error) {
            event.reply('server-log', '❌ Gagal Rebuild SSL: Pastikan Server dalam keadaan mati sebelum rebuild. Error: ' + error.message);
        }
    } else {
        event.reply('server-log', '❌ mkcert.exe tidak ditemukan di folder ssl!');
    }
});

// --- FITUR AUTO INSTALLER (SUPPORT ALL & ANTI SUKSES PALSU) ---
ipcMain.on('install-app', (event, data) => {
    const { appName, projectName } = data;

    // 1. Cek lisensi PRO
    if (!isPro) {
        event.reply('server-log', `🔒 Akses Ditolak! Fitur Auto Install khusus pengguna PRO. Silakan klik Donasi.`);
        return;
    }
    
    const wwwPath = path.join(baseDir, 'www');
    const targetPath = path.join(wwwPath, projectName);

    // 2. Cek apakah folder sudah ada
    if (fs.existsSync(targetPath)) {
        event.reply('server-log', `❌ Gagal: Folder project "${projectName}" sudah ada! Silakan gunakan nama lain.`);
        return;
    }

    event.reply('server-log', `📦 Menyiapkan instalasi [${appName.toUpperCase()}]... (Proses ini butuh waktu, jangan dimatikan)`);
    
    const phpExe = path.join(baseDir, 'bin', 'php', 'php-8.3', 'php.exe');
    let psScript = '';
    let scriptPath = path.join(baseDir, `install_${projectName}.ps1`);
    let isComposer = false;

    // 3. Logika PowerShell (Ditambah $ErrorActionPreference = 'Stop' agar error langsung berhenti)
    if (appName === 'wordpress') {
        const zipPath = path.join(wwwPath, `${projectName}_temp.zip`);
        const extPath = path.join(wwwPath, `${projectName}_ext`);
        psScript = `
$ErrorActionPreference = 'Stop';
Invoke-WebRequest -Uri 'https://wordpress.org/latest.zip' -OutFile '${zipPath}'
Expand-Archive -Path '${zipPath}' -DestinationPath '${extPath}' -Force
New-Item -ItemType Directory -Force -Path '${targetPath}'
Copy-Item -Path '${extPath}\\wordpress\\*' -Destination '${targetPath}' -Recurse -Force
Remove-Item -Path '${extPath}' -Recurse -Force
Remove-Item -Path '${zipPath}' -Force
        `;
    } 
    else if (appName === 'joomla') {
        const zipPath = path.join(wwwPath, `${projectName}_temp.zip`);
        psScript = `
$ErrorActionPreference = 'Stop';
Invoke-WebRequest -Uri 'https://github.com/joomla/joomla-cms/releases/download/5.1.0/Joomla_5.1.0-Stable-Full_Package.zip' -OutFile '${zipPath}'
Expand-Archive -Path '${zipPath}' -DestinationPath '${targetPath}' -Force
Remove-Item -Path '${zipPath}' -Force
        `;
    } 
    else if (appName === 'laravel' || appName === 'ci4') {
        isComposer = true;
        const composerPath = path.join(wwwPath, `composer_${projectName}.phar`);
        const projectCmd = appName === 'laravel' ? 'laravel/laravel' : 'codeigniter4/appstarter';
        
        psScript = `
$ErrorActionPreference = 'Stop';
Invoke-WebRequest -Uri 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile '${composerPath}'
& '${phpExe}' '${composerPath}' create-project ${projectCmd} '${targetPath}'
Remove-Item -Path '${composerPath}' -Force
        `;
    }

    fs.writeFileSync(scriptPath, psScript);

    const ps = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);

    // 4. Tangkap error asli dari PowerShell kalau ada masalah
    ps.stderr.on('data', (data) => {
        const errorMsg = data.toString().trim();
        if (errorMsg) event.reply('server-log', `⚠️ [Sistem]: ${errorMsg.substring(0, 80)}...`);
    });

    ps.on('close', (code) => {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath); 
        
        // 5. PENGECEKAN FINAL: Buktikan foldernya beneran ada dan isinya nggak kosong!
        if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
            event.reply('server-log', `✅ ${appName.toUpperCase()} berhasil diinstal di folder "www/${projectName}"!`);
            
            if (isComposer) {
                event.reply('server-log', `🌐 Akses Laravel/CI4 via: https://${projectName}.test/public`);
            } else {
                event.reply('server-log', `🌐 Akses via: https://${projectName}.test`);
            }
            event.reply('server-log', `⚠️ Jangan lupa klik STOP PHP lalu START PHP agar terdeteksi.`);
        } else {
            // Bersihkan sisa-sisa kalau gagal di tengah jalan
            if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
            
            event.reply('server-log', `❌ GAGAL: ${appName.toUpperCase()} tidak terinstal.`);
            event.reply('server-log', `💡 Tips: Cek koneksi internet, atau pastikan ekstensi 'zip', 'openssl', dan 'curl' aktif di php.ini.`);
        }
    });
});

// --- FITUR PRO: BACKUP DATABASE ---
ipcMain.on('backup-db', (event, port) => {
    if (!isPro) {
        event.reply('server-log', '🔒 Gagal! Fitur Backup Database khusus pengguna PRO. Silakan klik Donasi.');
        return;
    }

    const dbPort = port || 3307;
	
    const dumpPath = path.join(baseDir, 'bin', 'mysql', 'mariadb', 'bin', 'mysqld.exe');
    const backupDir = path.join(baseDir, 'data', 'backup_mysql');

    // Cek apakah mysqldump.exe ada
    if (!fs.existsSync(dumpPath)) {
        event.reply('server-log', '❌ File mysqldump.exe tidak ditemukan di folder bin/mysql!');
        return;
    }

    // Buat folder backup kalau belum ada
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    // Bikin nama file backup berdasarkan tanggal (contoh: backup_2026-07-22_18-45-20.sql)
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const backupFile = path.join(backupDir, `backup_${dateStr}.sql`);

    event.reply('server-log', '⏳ Memulai proses backup seluruh database...');

    // Asumsi user 'root' tanpa password (sesuai setup awal lo)
    const cmd = `"${dumpPath}" -u root --port=${dbPort} --all-databases > "${backupFile}"`;

    exec(cmd, (error) => {
        if (error) {
            event.reply('server-log', `❌ Gagal mem-backup database: ${error.message}`);
        } else {
            event.reply('server-log', `✅ Sukses! Database berhasil dibackup ke: data/backup_mysql/backup_${dateStr}.sql`);
        }
    });
});

// ==========================================
// 🛡️ GLOBAL ERROR HANDLER & CRASH LOGGER
// ==========================================

// Menangkap error fatal (Synchronous)
process.on('uncaughtException', (error) => {
    console.error('💥 FATAL ERROR:', error);
    
    // 1. Tulis log error ke dalam file crash_log.txt biar gampang di-debug
    const logPath = path.join(baseDir, 'crash_log.txt');
    const timeStamp = new Date().toISOString();
    const logMessage = `[${timeStamp}] UNCAUGHT EXCEPTION:\n${error.stack || error.message}\n\n`;
    
    try {
        fs.appendFileSync(logPath, logMessage);
    } catch (e) {
        console.error('Gagal menulis log:', e);
    }

    // 2. Tampilkan Pop-up ke User
    dialog.showErrorBox(
        'NgAppIDServ - Terjadi Kesalahan Sistem',
        `Maaf, aplikasi mengalami masalah fatal dan berhasil dicegah agar tidak tertutup paksa.\n\nPesan Error:\n${error.message}\n\nDetail lengkap telah disimpan di: crash_log.txt`
    );
});

// Menangkap error fatal dari Promise (Asynchronous)
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
    
    const logPath = path.join(baseDir, 'crash_log.txt');
    const timeStamp = new Date().toISOString();
    const logMessage = `[${timeStamp}] UNHANDLED REJECTION:\n${reason.stack || reason}\n\n`;
    
    try {
        fs.appendFileSync(logPath, logMessage);
    } catch (e) {
        console.error('Gagal menulis log:', e);
    }
});

// ==========================================
// 🔄 AUTO UPDATER CONFIGURATION
// ==========================================
autoUpdater.on('checking-for-update', () => {
    console.log('Mengecek pembaruan...');
});

autoUpdater.on('update-available', (info) => {
    // Ngasih tahu user lewat log terminal di UI
    if (mainWindow) {
        mainWindow.webContents.send('server-log', `✨ Versi baru (${info.version}) tersedia! Sedang mengunduh di latar belakang...`);
    }
});

autoUpdater.on('update-downloaded', () => {
    // Munculin pop-up kalau download udah selesai
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Siap Diinstal',
        message: 'Versi terbaru NgAppIDServ telah berhasil diunduh. Aplikasi akan ditutup untuk proses instalasi sekarang.',
        buttons: ['Install & Restart']
    }).then(() => {
        setImmediate(() => autoUpdater.quitAndInstall());
    });
});

autoUpdater.on('error', (err) => {
    console.error('Error saat update:', err);
});