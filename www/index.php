<?php
// ==========================
// BASIC ENV DETECTION
// ==========================
$isLocal = in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1'], true);

// ==========================
// QUERY HANDLING (SAFE)
// ==========================
if (isset($_GET['q'])) {
    $query = $_GET['q'];

    // Allow-list approach
    if ($query === 'info') {

        // phpinfo allowed ONLY on localhost
        if ($isLocal) {
            phpinfo();
            exit;
        }

        http_response_code(403);
        exit('Forbidden! phpinfo allowed ONLY on localhost');
    }

    // Unknown query
    http_response_code(404);
    exit('Invalid query parameter.');
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World - NgAppIDServ</title>
	<link rel="icon" type="image/ico" sizes="32x32" href="favicon.ico">
    <style>
        /* CSS Variabel untuk tema */
        :root {
            --bg-dark: #121212;
            --card-bg: #1e1e1e;
            --text-main: #E0E0E0;
            --text-muted: #888888;
            --accent-orange: #F57C00;
            --accent-hover: #FF9800;
            --green-success: #43A047;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
        }

        /* Container Card dengan efek smooth & glass */
        .container {
            background-color: var(--card-bg);
            padding: 40px 50px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            text-align: center;
            border-top: 4px solid var(--accent-orange);
            animation: fadeIn 0.8s ease-out forwards;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            max-width: 500px;
            width: 100%;
        }

        .container:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
        }

        /* Styling Typography */
        h1 {
            font-size: 3rem;
            margin: 0 0 5px 0;
            background: linear-gradient(90deg, #ffffff, #aaaaaa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -1px;
        }

        p.author {
            font-size: 1.1rem;
            color: var(--text-muted);
            margin: 0 0 25px 0;
            font-weight: 500;
        }

        p.author span {
            color: var(--accent-orange);
            font-weight: bold;
            text-shadow: 0 0 10px rgba(245, 124, 0, 0.3);
        }

        /* Styling Area Informasi Server */
        .info {
            background-color: #121212;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 15px 20px;
            margin-bottom: 25px;
            text-align: left;
        }

        .info p {
            margin: 10px 0;
            font-size: 0.95rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px dashed #2a2a2a;
            padding-bottom: 10px;
        }
        
        .info p:last-child {
            border-bottom: none;
            padding-bottom: 0;
            margin-bottom: 0;
        }

        .info strong {
            color: var(--text-muted);
            font-weight: 500;
        }

        .info code {
            font-family: 'Consolas', 'Courier New', monospace;
            color: var(--accent-hover);
            background: #1a1a1a;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85rem;
        }

        /* Tombol Mini */
        .btn-mini {
            display: inline-block;
            margin-left: 10px;
            padding: 4px 10px;
            color: #121212;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
            transition: 0.2s;
        }
        
        .btn-orange { background-color: var(--accent-orange); }
        .btn-orange:hover { background-color: var(--accent-hover); color: #fff; }

        .btn-green { background-color: var(--green-success); color: #fff; }
        .btn-green:hover { background-color: #2E7D32; }

        /* Badge Powered By */
        .badge {
            display: inline-block;
            padding: 8px 20px;
            background-color: rgba(245, 124, 0, 0.1);
            color: var(--accent-orange);
            border-radius: 30px;
            font-size: 0.9rem;
            font-weight: 600;
            letter-spacing: 0.5px;
            border: 1px solid rgba(245, 124, 0, 0.2);
            transition: 0.3s ease;
        }

        .badge:hover { background-color: rgba(245, 124, 0, 0.2); }
        .badge a { color: #fff; text-decoration: none; transition: 0.2s; }
        .badge a:hover { color: var(--accent-hover); }

        @keyframes fadeIn {
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>

    <div class="container">
        <?php
            // Setup Variabel
            $title = "Hello World!";
            $author = "@Yedincoder";
            $serverName = "NgAppIDServ";
        ?>
        
        <h1><?= $title ?></h1>
        <p class="author">by <span><?= $author ?></span></p>
        
        <div class="info">
            <?php if ($isLocal): ?>
                <p>
                    <strong>Web Server:</strong> 
                    <code><?= htmlspecialchars($_SERVER['SERVER_SOFTWARE'], ENT_QUOTES, 'UTF-8'); ?></code>
                </p>
                <p>
                    <strong>PHP Version:</strong> 
                    <span>
                        <code>v<?= htmlspecialchars(PHP_VERSION, ENT_QUOTES, 'UTF-8'); ?></code>
                        <a class="btn-mini btn-orange" title="Lihat Detail Konfigurasi PHP" href="/?q=info">PHP Info</a>
                    </span>
                </p>
                <p>
                    <strong>Document Root:</strong> 
                    <code><?= htmlspecialchars($_SERVER['DOCUMENT_ROOT'], ENT_QUOTES, 'UTF-8'); ?></code>
                </p>
                <!-- BARIS BARU UNTUK TEST MYSQL -->
                <p>
                    <strong>MySQL Test:</strong> 
                    <span style="display: flex; align-items: center;">
                        <i style="font-size: 0.75rem; color: #777; margin-right: 8px;">(Aktifkan dulu MySQL)</i>
                        <a class="btn-mini btn-green" title="Test Koneksi Database" href="test-db.php">Cek DB</a>
                    </span>
                </p>
            <?php else: ?>
                <p>
                    <strong>Status:</strong> 
                    <span style="color: #4CAF50; font-weight:bold;">Server is running</span>
                </p>
                <p>
                    <strong>PHP Engine:</strong> 
                    <span style="color: #4CAF50; font-weight:bold;">Enabled</span>
                </p>
            <?php endif; ?>
        </div>

        <div class="badge">
            🚀 Powered by <a title="<?= $serverName ?>" target="_blank" href="https://ngappid.com"><?= $serverName ?></a>
        </div>
    </div>

</body>
</html>