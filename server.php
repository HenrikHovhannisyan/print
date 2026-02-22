<?php
/**
 * PrintEditor — PHP Built-in Server Router
 * 
 * Использование:
 *   php -S localhost:8080 server.php
 * 
 * Этот файл маршрутизирует запросы:
 *   /api/*      → api/index.php
 *   /admin/*    → admin/ (статические файлы)
 *   /uploads/*  → uploads/ (файлы)
 *   остальное   → статические файлы фронтенда
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// ============================================
// 1. API-запросы → api/index.php
// ============================================
if (preg_match('#^/api(/.*)?$#', $uri)) {
    require __DIR__ . '/api/index.php';
    return true;
}

// ============================================
// 2. Статические файлы — если файл существует
// ============================================
$filePath = __DIR__ . $uri;

if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    // Устанавливаем правильный Content-Type
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'pdf' => 'application/pdf',
    ];

    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }

    return false; // PHP built-in server отдаст файл сам
}

// ============================================
// 3. Admin панель (SPA)
// ============================================
if (preg_match('#^/admin(/.*)?$#', $uri)) {
    $adminFile = __DIR__ . '/admin/index.html';
    if (file_exists($adminFile)) {
        header('Content-Type: text/html');
        readfile($adminFile);
        return true;
    }
}

// ============================================
// 4. Fallback — главная страница (SPA)
// ============================================
$indexFile = __DIR__ . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html');
    readfile($indexFile);
    return true;
}

http_response_code(404);
echo "404 — Файл не найден";
return true;
