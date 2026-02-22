<?php
/**
 * PrintEditor — Bootstrap
 * 
 * Автозагрузка классов и начальная инициализация.
 */

// Определяем корневые пути
define('APP_ROOT', dirname(__DIR__));
define('BACKEND_ROOT', __DIR__);

// Автозагрузка классов
spl_autoload_register(function ($className) {
    $file = BACKEND_ROOT . '/classes/' . $className . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Устанавливаем обработчик ошибок
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Внутренняя ошибка сервера',
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()) . ':' . $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
