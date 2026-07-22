const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serverAPI', {
	start: (port) => ipcRenderer.send('start-server', port),
    stop: () => ipcRenderer.send('stop-server'),
    startDB: (port) => ipcRenderer.send('start-db', port),
    stopDB: () => ipcRenderer.send('stop-db'),
    startRedis: () => ipcRenderer.send('start-redis'),
    stopRedis: () => ipcRenderer.send('stop-redis'),
    startMail: () => ipcRenderer.send('start-mail'),
    stopMail: () => ipcRenderer.send('stop-mail'),
    openPMA: () => ipcRenderer.send('open-pma'),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    deleteProject: (projectName) => ipcRenderer.send('delete-project', projectName), // <--- TAMBAHIN BARIS INI
    rebuildSSL: () => ipcRenderer.send('rebuild-ssl'),
    stopAll: () => ipcRenderer.send('stop-all'),
	installApp: (appName) => ipcRenderer.send('install-app', appName),
	// 👇 TAMBAHIN BARIS INI BUAT JEMBATAN BACKUP 👇
    backupDB: (port) => ipcRenderer.send('backup-db', port),
	// Ubah baris ini biar bisa nerima data berbentuk objek (appName dan projectName)
    installApp: (data) => ipcRenderer.send('install-app', data),
	getHWID: () => ipcRenderer.invoke('get-hwid'), // <--- TAMBAHIN BARIS INI
    onReceiveHWID: (callback) => ipcRenderer.on('receive-hwid', callback),
    submitLicense: (data) => ipcRenderer.send('submit-license', data),
    onLicenseResult: (callback) => ipcRenderer.on('license-result', callback),
    startNgrok: (data) => ipcRenderer.send('start-ngrok', data),
    stopNgrok: () => ipcRenderer.send('stop-ngrok'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
	// 👇 TAMBAHIN BARIS INI 👇
    openFolder: (projectName) => ipcRenderer.send('open-folder', projectName),
	getVersions: () => ipcRenderer.invoke('get-versions'),
	
    onLog: (callback) => ipcRenderer.on('server-log', callback),
    onStatus: (callback) => ipcRenderer.on('server-status', callback),
    onNgrokUrl: (callback) => ipcRenderer.on('ngrok-url', callback)
});