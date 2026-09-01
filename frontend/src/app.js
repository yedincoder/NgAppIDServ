function updateLog(msg) {
    document.getElementById('log-message').innerText = msg;
}

function setDot(dotId, active) {
    const dot = document.getElementById(dotId);
    if (active) {
        dot.classList.add('active');
    } else {
        dot.classList.remove('active');
    }
}

document.getElementById('btn-php').addEventListener('click', async () => {
    const port = parseInt(document.getElementById('port-php').value) || 80;
    try {
        if (window.go && window.go.main && window.go.main.App) {
            const res = await window.go.main.App.StartNginxPHP(port);
            updateLog('☕ ' + res);
            setDot('dot-php', true);
        } else {
            updateLog('☕ [Simulasi] Nginx & PHP aktif di port ' + port);
            setDot('dot-php', true);
        }
    } catch (err) {
        updateLog('❌ ' + err);
    }
});

document.getElementById('btn-mysql').addEventListener('click', async () => {
    const port = parseInt(document.getElementById('port-mysql').value) || 3307;
    try {
        if (window.go && window.go.main && window.go.main.App) {
            const res = await window.go.main.App.StartMySQL(port);
            updateLog('☕ ' + res);
            setDot('dot-mysql', true);
        } else {
            updateLog('☕ [Simulasi] MySQL Server aktif di port ' + port);
            setDot('dot-mysql', true);
        }
    } catch (err) {
        updateLog('❌ ' + err);
    }
});

document.getElementById('btn-redis').addEventListener('click', async () => {
    try {
        if (window.go && window.go.main && window.go.main.App) {
            const res = await window.go.main.App.StartRedis();
            updateLog('☕ ' + res);
            setDot('dot-redis', true);
        } else {
            updateLog('☕ [Simulasi] Redis Cache aktif');
            setDot('dot-redis', true);
        }
    } catch (err) {
        updateLog('❌ ' + err);
    }
});

document.getElementById('btn-stop-all').addEventListener('click', async () => {
    try {
        if (window.go && window.go.main && window.go.main.App) {
            const res = await window.go.main.App.StopAllServices();
            updateLog('☕ ' + res);
        } else {
            updateLog('☕ [Simulasi] Semua service dimatikan');
        }
        document.querySelectorAll('.status-dot').forEach(d => d.classList.remove('active'));
    } catch (err) {
        updateLog('❌ ' + err);
    }
});
