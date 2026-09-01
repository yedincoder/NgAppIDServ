package service

import (
"fmt"
"net"
"os/exec"
"syscall"
"time"
)

type ServiceType string

const (
NginxPHP ServiceType = "NGINX_PHP"
MySQL    ServiceType = "MYSQL"
Redis    ServiceType = "REDIS"
Mail     ServiceType = "MAIL"
Ngrok    ServiceType = "NGROK"
)

type ProcessManager struct {
processes map[ServiceType]*exec.Cmd
}

func NewProcessManager() *ProcessManager {
return &ProcessManager{
processes: make(map[ServiceType]*exec.Cmd),
}
}

func (m *ProcessManager) IsPortAvailable(port int) bool {
timeout := 500 * time.Millisecond
conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), timeout)
if err != nil {
return true
}
conn.Close()
return false
}

func (m *ProcessManager) StartService(svc ServiceType, binaryPath string, args ...string) error {
cmd := exec.Command(binaryPath, args...)
cmd.SysProcAttr = &syscall.SysProcAttr{
HideWindow:    true,
CreationFlags: 0x08000000,
}

if err := cmd.Start(); err != nil {
return fmt.Errorf("gagal start %s: %w", svc, err)
}

m.processes[svc] = cmd
return nil
}

func (m *ProcessManager) StopService(svc ServiceType, processName string) error {
killCmd := exec.Command("taskkill", "/F", "/T", "/IM", processName)
killCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
_ = killCmd.Run()

delete(m.processes, svc)
return nil
}

func (m *ProcessManager) StopAll() {
services := []string{"nginx.exe", "php-cgi.exe", "mysqld.exe", "redis-server.exe", "ngrok.exe"}
for _, proc := range services {
killCmd := exec.Command("taskkill", "/F", "/T", "/IM", proc)
killCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
_ = killCmd.Run()
}
m.processes = make(map[ServiceType]*exec.Cmd)
}
