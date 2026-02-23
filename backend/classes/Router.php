<?php
/**
 * PrintEditor — Router Class
 * 
 * Простой маршрутизатор для REST API.
 * Поддерживает параметры в URL ({id}) и middleware.
 */

class Router
{
    /** @var array Зарегистрированные маршруты */
    private $routes = [];

    /** @var array Глобальные middleware */
    private $middleware = [];

    /**
     * Зарегистрировать GET-маршрут
     */
    public function get(string $path, callable $handler): self
    {
        return $this->addRoute('GET', $path, $handler);
    }

    /**
     * Зарегистрировать POST-маршрут
     */
    public function post(string $path, callable $handler): self
    {
        return $this->addRoute('POST', $path, $handler);
    }

    /**
     * Зарегистрировать PUT-маршрут
     */
    public function put(string $path, callable $handler): self
    {
        return $this->addRoute('PUT', $path, $handler);
    }

    /**
     * Зарегистрировать DELETE-маршрут
     */
    public function delete(string $path, callable $handler): self
    {
        return $this->addRoute('DELETE', $path, $handler);
    }

    /**
     * Добавить глобальный middleware
     */
    public function use (callable $middleware): self
    {
        $this->middleware[] = $middleware;
        return $this;
    }

    /**
     * Обработать входящий запрос
     */
    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];

        // Эмуляция методов (PUT/DELETE) через заголовок или POST-поле
        $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? $_POST['_method'] ?? null;
        if ($method === 'POST' && $override) {
            $emulated = strtoupper($override);
            if (in_array($emulated, ['PUT', 'DELETE', 'PATCH'])) {
                $method = $emulated;
            }
        }

        $uri = $this->getRequestUri();

        // Обработка OPTIONS (CORS preflight)
        if ($method === 'OPTIONS') {
            Response::cors();
            Response::json(null, 204);
            return;
        }

        // Применяем глобальные middleware
        foreach ($this->middleware as $mw) {
            $result = $mw($method, $uri);
            if ($result === false) {
                return; // middleware прервал цепочку
            }
        }

        // Ищем подходящий маршрут
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $params = $this->matchPath($route['path'], $uri);
            if ($params !== false) {
                try {
                    call_user_func($route['handler'], $params);
                }
                catch (Exception $e) {
                    Response::error('Внутренняя ошибка сервера: ' . $e->getMessage(), 500);
                }
                return;
            }
        }

        // Маршрут не найден
        Response::error('Маршрут не найден: ' . $method . ' ' . $uri, 404);
    }

    /**
     * Добавить маршрут
     */
    private function addRoute(string $method, string $path, callable $handler): self
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
        ];
        return $this;
    }

    /**
     * Сопоставить путь с шаблоном и извлечь параметры
     * 
     * Пример: matchPath('/orders/{id}', '/orders/42') => ['id' => '42']
     * Пример: matchPath('/orders', '/users') => false
     */
    private function matchPath(string $pattern, string $uri): mixed
    {
        // Преобразуем {param} в regex
        $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
        $regex = '#^' . $regex . '$#';

        if (preg_match($regex, $uri, $matches)) {
            // Возвращаем только именованные параметры
            return array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        }

        return false;
    }

    /**
     * Получить URI запроса (без query string и без /api/ префикса)
     */
    private function getRequestUri(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        // Убираем /api/ префикс, если есть
        if (strpos($uri, '/api/') === 0) {
            $uri = substr($uri, 4); // '/api/orders' -> '/orders'
        }

        // Убираем trailing slash
        $uri = rtrim($uri, '/');
        if ($uri === '') {
            $uri = '/';
        }

        return $uri;
    }
}
