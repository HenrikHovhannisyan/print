<?php
/**
 * PrintEditor — AdminAuth
 * 
 * Аутентификация администратора.
 * Использует простой token-based подход.
 */

class AdminAuth
{
    private $db;
    private $config;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->config = require BACKEND_ROOT . '/config.php';
    }

    /**
     * Вход администратора
     * POST /admin/login
     * 
     * Body JSON: { username, password }
     */
    public function login(array $params): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            Response::error('Логин и пароль обязательны', 400);
            return;
        }

        $admin = $this->db->fetchOne(
            "SELECT * FROM admins WHERE username = ?",
            [$username]
        );

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            Response::error('Неверный логин или пароль', 401);
            return;
        }

        // Генерируем токен
        $token = $this->generateToken($admin['id'], $admin['username']);

        Response::success([
            'token' => $token,
            'username' => $admin['username'],
            'expires' => time() + $this->config['admin']['token_lifetime'],
        ], 'Вход выполнен');
    }

    /**
     * Проверить авторизацию (middleware)
     * Возвращает данные администратора или null
     */
    public function authenticate(): ?array
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

        if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
            return null;
        }

        $token = substr($authHeader, 7);
        return $this->verifyToken($token);
    }

    /**
     * Middleware: требует авторизации
     * Используется в Router->use()
     */
    public function requireAuth(): callable
    {
        return function (string $method, string $uri): bool {
            // Только для /admin/* маршрутов (кроме /admin/login)
            if (strpos($uri, '/admin/') !== 0 || $uri === '/admin/login') {
                return true; // Пропускаем
            }

            $admin = $this->authenticate();
            if (!$admin) {
                Response::error('Требуется авторизация', 401);
                return false; // Прерываем цепочку
            }

            // Сохраняем данные админа в глобальное пространство
            $GLOBALS['current_admin'] = $admin;
            return true;
        };
    }

    /**
     * Сменить пароль
     * PUT /admin/password
     */
    public function changePassword(array $params): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $admin = $GLOBALS['current_admin'] ?? null;

        if (!$admin) {
            Response::error('Не авторизован', 401);
            return;
        }

        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';

        if (empty($currentPassword) || empty($newPassword)) {
            Response::error('Текущий и новый пароль обязательны', 400);
            return;
        }

        if (strlen($newPassword) < 6) {
            Response::error('Новый пароль должен содержать минимум 6 символов', 400);
            return;
        }

        // Проверяем текущий пароль
        $adminData = $this->db->fetchOne(
            "SELECT * FROM admins WHERE id = ?",
            [$admin['id']]
        );

        if (!password_verify($currentPassword, $adminData['password_hash'])) {
            Response::error('Неверный текущий пароль', 400);
            return;
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->db->execute(
            "UPDATE admins SET password_hash = ? WHERE id = ?",
            [$newHash, $admin['id']]
        );

        Response::success(null, 'Пароль изменён');
    }

    /**
     * Генерация токена (HMAC-based)
     */
    private function generateToken(int $adminId, string $username): string
    {
        $payload = json_encode([
            'id' => $adminId,
            'username' => $username,
            'exp' => time() + $this->config['admin']['token_lifetime'],
        ]);

        $encoded = base64_encode($payload);
        $signature = hash_hmac('sha256', $encoded, $this->config['admin']['secret_key']);

        return $encoded . '.' . $signature;
    }

    /**
     * Проверка токена
     */
    private function verifyToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2)
            return null;

        [$encoded, $signature] = $parts;

        // Проверяем подпись
        $expectedSignature = hash_hmac('sha256', $encoded, $this->config['admin']['secret_key']);
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        // Декодируем payload
        $payload = json_decode(base64_decode($encoded), true);
        if (!$payload)
            return null;

        // Проверяем срок действия
        if (($payload['exp'] ?? 0) < time()) {
            return null;
        }

        return $payload;
    }
}
