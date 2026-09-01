<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Percobaan - Light Smooth</title>
	<link rel="icon" type="image/ico" sizes="32x32" href="http://localhost/favicon.ico">
    <style>
        /* === RESET & TEMA LIGHT SMOOTH === */
        :root {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --accent-color: #3b82f6;
            --accent-hover: #2563eb;
            --box-bg: #f1f5f9;
        }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }

        /* === KARTU UTAMA DENGAN SHADOW LEMBUT === */
        .container {
            background-color: var(--card-bg);
            padding: 40px 35px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.02);
            max-width: 480px;
            width: 100%;
            text-align: center;
            animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(30px);
        }

        h1 {
            margin: 0 0 15px 0;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        p {
            font-size: 15px;
            line-height: 1.6;
            color: var(--text-muted);
            margin-bottom: 25px;
        }

        /* === KOTAK INFORMASI PHP === */
        .info-box {
            background-color: var(--box-bg);
            padding: 20px;
            border-radius: 12px;
            text-align: left;
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
        }

        .info-box .item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px dashed #cbd5e1;
            font-size: 14px;
        }

        .info-box .item:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .info-box .label {
            color: var(--text-muted);
            font-weight: 500;
        }

        .info-box .value {
            color: var(--text-main);
            font-weight: 600;
            font-family: 'Consolas', monospace;
            font-size: 13px;
        }

        /* === TOMBOL ELEGANT === */
        .btn {
            display: inline-block;
            padding: 12px 28px;
            background-color: var(--accent-color);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .btn:hover {
            background-color: var(--accent-hover);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        /* === ANIMASI === */
        @keyframes slideUpFade {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>

    <div class="container">
        <h1>✨ Percobaan Berhasil!</h1>
        <p>Welcome bro! Kalau halaman ini tampil dengan <i>smooth</i>, berarti Nginx dan PHP lo udah berjalan sempurna di dalam <b>NgAppIDServ</b>.</p>
        
        <div class="info-box">
            <div class="item">
                <span class="label">🌐 Domain Aktif</span>
                <span class="value"><?php echo $_SERVER['HTTP_HOST']; ?></span>
            </div>
            <div class="item">
                <span class="label">🐘 Versi PHP</span>
                <span class="value">v<?php echo phpversion(); ?></span>
            </div>
            <div class="item">
                <span class="label">🚀 Web Server</span>
                <span class="value">
                    <?php 
                        $serverSoft = $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'; 
                        // Ambil kata pertama aja (misal: nginx/1.30.4)
                        echo explode(' ', $serverSoft)[0];
                    ?>
                </span>
            </div>
            <div class="item">
                <span class="label">⏰ Waktu Server</span>
                <span class="value"><?php echo date('H:i:s'); ?></span>
            </div>
        </div>
        
        <a href="javascript:location.reload();" class="btn">🔄 Muat Ulang</a>
    </div>

</body>
</html>