<?php
/**
 * PrintEditor — Response Helper
 * 
 * Единообразные JSON-ответы для API.
 */

class Response
{
    /**
     * Отправить JSON-ответ
     */
    public static function json($data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');

        if ($data !== null) {
            echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        }
        exit;
    }

    /**
     * Успешный ответ с данными
     */
    public static function success($data = null, string $message = 'OK', int $statusCode = 200): void
    {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $statusCode);
    }

    /**
     * Ответ с ошибкой
     */
    public static function error(string $message, int $statusCode = 400, $details = null): void
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($details !== null) {
            $response['details'] = $details;
        }

        self::json($response, $statusCode);
    }

    /**
     * Установить CORS-заголовки
     */
    public static function cors(): void
    {
        $config = require BACKEND_ROOT . '/config.php';
        $cors = $config['cors'];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';

        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: ' . implode(', ', $cors['allowed_methods']));
        header('Access-Control-Allow-Headers: ' . implode(', ', $cors['allowed_headers']));
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
    }

    /**
     * Отправить файл для скачивания
     */
    public static function download(string $filePath, string $filename): void
    {
        if (!file_exists($filePath)) {
            self::error('Файл не найден', 404);
            return;
        }

        $mime = mime_content_type($filePath);
        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }
}
