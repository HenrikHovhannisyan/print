<?php
/**
 * PrintEditor — UserController
 * 
 * Управление пользователями (сохранение email при логине, просмотр в админке).
 */

class UserController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Создать запись пользователя (при логине на фронте)
     * POST /users
     * 
     * Body JSON:
     *   email — email пользователя
     */
    public function create(array $params): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = trim($input['email'] ?? '');
        $name = trim($input['name'] ?? '');

        if (empty($email)) {
            Response::error('email обязателен', 400);
            return;
        }

        // Проверяем, существует ли уже такой email
        $existing = $this->db->fetchOne("SELECT id, name FROM users WHERE email = ?", [$email]);

        if (!$existing) {
            $this->db->insert("INSERT INTO users (email, name) VALUES (?, ?)", [$email, $name]);
        }
        else if (!empty($name) && empty($existing['name'])) {
            // Если пользователя создали раньше без имени (например, через заказ), обновим имя
            $this->db->execute("UPDATE users SET name = ? WHERE email = ?", [$name, $email]);
        }

        // Возвращаем данные пользователя для фронтенда
        $user = $this->db->fetchOne("SELECT * FROM users WHERE email = ?", [$email]);
        Response::success($user, 'Пользователь сохранён', 200);
    }

    /**
     * Список пользователей (админ)
     * GET /admin/users
     */
    public function listAll(array $params): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        // Общее количество
        $countRow = $this->db->fetchOne("SELECT COUNT(*) as total FROM users");
        $total = (int)$countRow['total'];

        $users = $this->db->fetchAll(
            "SELECT u.*, 
                    COUNT(o.id) as total_orders,
                    SUM(CASE WHEN o.status IN ('new', 'confirmed', 'processing', 'printing', 'ready') THEN 1 ELSE 0 END) as active_orders
             FROM users u
             LEFT JOIN orders o ON u.email = o.customer_email
             GROUP BY u.id
             ORDER BY u.created_at DESC 
             LIMIT ? OFFSET ?",
        [$limit, $offset]
        );

        // SQLite SUM might return null if 0 rows, fix that
        foreach ($users as &$u) {
            $u['active_orders'] = (int)$u['active_orders'];
            $u['total_orders'] = (int)$u['total_orders'];
        }

        Response::success([
            'users' => $users,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit),
        ]);
    }

    /**
     * Детали пользователя и список его заказов
     * GET /admin/users/{id}
     */
    public function get(array $params): void
    {
        $id = (int)($params['id'] ?? 0);

        $user = $this->db->fetchOne("SELECT * FROM users WHERE id = ?", [$id]);
        if (!$user) {
            Response::error('Пользователь не найден', 404);
            return;
        }

        $orders = $this->db->fetchAll(
            "SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC",
        [$user['email']]
        );

        $user['orders'] = $orders;
        $user['total_orders'] = count($orders);
        $user['active_orders'] = 0;
        foreach ($orders as $o) {
            if (in_array($o['status'], ['new', 'confirmed', 'processing', 'printing', 'ready'])) {
                $user['active_orders']++;
            }
        }

        Response::success($user);

    }
}
