<?php
/**
 * PrintEditor — Конфигурация бэкенда
 * 
 * Все настройки приложения в одном месте.
 * В продакшене можно загружать из .env файла.
 * 
 * Константы APP_ROOT и BACKEND_ROOT определяются в bootstrap.php
 */


return [
    // --- База данных ---
    'db' => [
        'path' => APP_ROOT . '/data/printeditor.db',
    ],

    // --- Хранилище файлов ---
    'storage' => [
        'base_path' => APP_ROOT . '/uploads',
        'designs' => APP_ROOT . '/uploads/designs',     // SVG, Canvas JSON
        'mockups' => APP_ROOT . '/uploads/mockups',     // Превью мокапов
        'highres' => APP_ROOT . '/uploads/highres',     // High-res PNG
        'originals' => APP_ROOT . '/uploads/originals',   // Загруженные пользователем
        'exports' => APP_ROOT . '/uploads/exports',     // PDF экспорты
        'orders' => APP_ROOT . '/uploads/orders',       // Обособленные файлы для заказов
    ],

    // --- Лимиты загрузки ---
    'upload' => [
        'max_file_size' => 20 * 1024 * 1024,  // 20 MB
        'allowed_types' => [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp',
            'application/pdf',
        ],
        'allowed_extensions' => ['png', 'jpg', 'jpeg', 'svg', 'webp', 'pdf'],
    ],

    // --- Админ-панель ---
    'admin' => [
        'default_username' => 'admin',
        'default_password' => 'printeditor2024',  // Изменить при деплое!
        'token_lifetime' => 86400,               // 24 часа
        'secret_key' => 'pe_secret_key_change_in_production_2024',
    ],

    // --- Статусы заказов ---
    'order_statuses' => [
        'new' => 'Новый',
        'confirmed' => 'Подтверждён',
        'processing' => 'В обработке',
        'printing' => 'Печать',
        'ready' => 'Готов',
        'shipped' => 'Отправлен',
        'done' => 'Завершён',
        'cancelled' => 'Отменён',
    ],

    // --- Размеры одежды ---
    'garment_sizes' => ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],

    // --- CORS (для dev-режима) ---
    'cors' => [
        'allowed_origins' => ['*'],
        'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Session-ID'],
    ],
];
