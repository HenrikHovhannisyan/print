<?php
/**
 * PrintEditor — API Entry Point
 * 
 * Все API-запросы (/api/*) направляются сюда.
 * Маршруты определяются ниже.
 */

require_once __DIR__ . '/../backend/bootstrap.php';

// CORS заголовки для всех запросов
Response::cors();

// --- Контроллеры ---
$design = new DesignController();
$cart = new CartController();
$order = new OrderController();
$garment = new GarmentController();
$auth = new AdminAuth();
$user = new UserController();

// --- Маршрутизатор ---
$router = new Router();

// Middleware: авторизация для /admin/*
$router->use($auth->requireAuth());

// =====================
// Пользователи
// =====================
$router->post('/users', [$user, 'create']);

// =====================
// Типы одежды (публичный — для фронтенда)
// =====================
$router->get('/garments', [$garment, 'listActive']);

// =====================
// Дизайны (публичные)
// =====================
$router->post('/designs', [$design, 'save']);
$router->get('/designs', [$design, 'list']);
$router->get('/designs/{id}', [$design, 'get']);
$router->post('/designs/{id}/upload', [$design, 'uploadAsset']);
$router->delete('/designs/{id}', [$design, 'delete']);

// =====================
// Корзина (публичная)
// =====================
$router->post('/cart', [$cart, 'add']);
$router->get('/cart', [$cart, 'get']);
$router->put('/cart/{id}', [$cart, 'update']);
$router->delete('/cart/{id}', [$cart, 'remove']);
$router->delete('/cart', [$cart, 'clear']);

// =====================
// Заказы (публичные — создание и просмотр)
// =====================
$router->post('/orders', [$order, 'create']);
$router->get('/orders', [$order, 'listMyOrders']);
$router->get('/orders/{id}', [$order, 'get']);
$router->get('/orders/by-number/{number}', [$order, 'getByNumber']);

// =====================
// Админ-панель
// =====================
$router->post('/admin/login', [$auth, 'login']);
$router->put('/admin/password', [$auth, 'changePassword']);
$router->get('/admin/orders', [$order, 'listAll']);
$router->get('/admin/users', [$user, 'listAll']);
$router->get('/admin/users/{id}', [$user, 'get']);
$router->get('/admin/orders/{id}', [$order, 'get']);
$router->put('/admin/orders/{id}', [$order, 'update']);
$router->delete('/admin/orders/{id}', [$order, 'delete']);
$router->get('/admin/stats', [$order, 'stats']);
$router->get('/admin/designs/{id}', [$design, 'get']);

// Управление одеждой (админ)
$router->get('/admin/garments', [$garment, 'listAll']);
$router->get('/admin/garments/{id}', [$garment, 'get']);
$router->post('/admin/garments', [$garment, 'create']);
$router->put('/admin/garments/{id}', [$garment, 'update']);
$router->post('/admin/garments/{id}', [$garment, 'update']); // Поддержка POST для обновлений с картинками
$router->delete('/admin/garments/{id}', [$garment, 'delete']);
$router->post('/admin/garments/{id}/image', [$garment, 'uploadImage']);

// =====================
// Запуск
// =====================
$router->dispatch();
