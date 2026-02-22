<?php
/**
 * PrintEditor — OrderController
 * 
 * Управление заказами.
 * Создание из корзины, обновление статусов, админ-функции.
 */

class OrderController
{
    private $db;
    private $fileManager;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->fileManager = new FileManager();
    }

    /**
     * Оформить заказ из корзины
     * POST /orders
     * 
     * Body JSON:
     *   session_id       — ID сессии
     *   customer_name    — имя
     *   customer_email   — email
     *   customer_phone   — телефон
     *   customer_address — адрес
     *   notes            — примечания
     */
    public function create(array $params): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $sessionId = $input['session_id'] ?? '';

        if (empty($sessionId)) {
            Response::error('session_id обязателен', 400);
            return;
        }

        // Проверяем наличие позиций в корзине
        $cartItems = $this->db->fetchAll(
            "SELECT ci.*, d.garment_type, d.garment_color, d.preview_path, d.highres_path
             FROM cart_items ci
             JOIN designs d ON d.id = ci.design_id
             WHERE ci.session_id = ?",
            [$sessionId]
        );

        if (empty($cartItems)) {
            Response::error('Корзина пуста', 400);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Генерируем уникальный номер заказа: PE-YYMMDD-XXXX
            $orderNumber = 'PE-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(2)));

            $totalItems = array_sum(array_column($cartItems, 'quantity'));

            // Создаём заказ
            $orderId = $this->db->insert(
                "INSERT INTO orders (order_number, session_id, customer_name, customer_email, 
                 customer_phone, customer_address, status, total_items, notes)
                 VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)",
                [
                    $orderNumber,
                    $sessionId,
                    $input['customer_name'] ?? '',
                    $input['customer_email'] ?? '',
                    $input['customer_phone'] ?? '',
                    $input['customer_address'] ?? '',
                    $totalItems,
                    $input['notes'] ?? '',
                ]
            );

            // Переносим позиции корзины в позиции заказа
            foreach ($cartItems as $item) {
                // Изолируем файлы: копируем их из папок дизайнов в отдельную папку заказов
                $orderPreview = $item['preview_path'] ? $this->fileManager->copyFile($item['preview_path'], 'orders') : null;
                $orderHighres = $item['highres_path'] ? $this->fileManager->copyFile($item['highres_path'], 'orders') : null;

                // Изолируем ассеты (картинки), используемые в дизайне
                $canvasJson = $item['canvas_json'] ?? null;
                $svgData = $item['svg_data'] ?? null;

                $assets = $this->db->fetchAll("SELECT * FROM design_assets WHERE design_id = ?", [$item['design_id']]);
                foreach ($assets as $asset) {
                    $oldAssetPath = $asset['file_path'];
                    if ($oldAssetPath) {
                        $newAssetPath = $this->fileManager->copyFile($oldAssetPath, 'orders');
                        if ($newAssetPath) {
                            if ($canvasJson)
                                $canvasJson = str_replace($oldAssetPath, $newAssetPath, $canvasJson);
                            if ($svgData)
                                $svgData = str_replace($oldAssetPath, $newAssetPath, $svgData);
                        }
                    }
                }

                $this->db->insert(
                    "INSERT INTO order_items (order_id, design_id, garment_type, garment_color, 
                     size, quantity, preview_path, highres_path, canvas_json, svg_data, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $orderId,
                        $item['design_id'],
                        $item['garment_type'],
                        $item['garment_color'],
                        $item['size'],
                        $item['quantity'],
                        $orderPreview,
                        $orderHighres,
                        $canvasJson,
                        $svgData,
                        $item['notes'] ?? '',
                    ]
                );
            }

            // Очищаем корзину
            $this->db->execute("DELETE FROM cart_items WHERE session_id = ?", [$sessionId]);

            $this->db->commit();

            // Получаем полный заказ
            $order = $this->getOrderWithItems($orderId);

            Response::success($order, 'Заказ оформлен', 201);

        } catch (Exception $e) {
            $this->db->rollback();
            Response::error('Ошибка оформления заказа: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Получить заказ по ID
     * GET /orders/{id}
     */
    public function get(array $params): void
    {
        $orderId = (int) ($params['id'] ?? 0);

        $order = $this->getOrderWithItems($orderId);
        if (!$order) {
            Response::error('Заказ не найден', 404);
            return;
        }

        Response::success($order);
    }

    /**
     * Получить заказ по номеру
     * GET /orders/by-number/{number}
     */
    public function getByNumber(array $params): void
    {
        $number = $params['number'] ?? '';

        $order = $this->db->fetchOne("SELECT * FROM orders WHERE order_number = ?", [$number]);
        if (!$order) {
            Response::error('Заказ не найден', 404);
            return;
        }

        $order['items'] = $this->db->fetchAll(
            "SELECT * FROM order_items WHERE order_id = ?",
            [$order['id']]
        );

        Response::success($order);
    }

    /**
     * Список заказов (публичный — по email)
     * GET /orders?email=...
     */
    public function listMyOrders(array $params): void
    {
        $email = $_GET['email'] ?? '';
        if (empty($email)) {
            Response::error('Email обязателен', 400);
            return;
        }

        $orders = $this->db->fetchAll(
            "SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC",
            [$email]
        );

        foreach ($orders as &$order) {
            $order['items'] = $this->db->fetchAll(
                "SELECT * FROM order_items WHERE order_id = ?",
                [$order['id']]
            );
        }

        Response::success($orders);
    }

    /**
     * Список заказов (админ)
     * GET /admin/orders?status=new&page=1&limit=20
     */
    public function listAll(array $params): void
    {
        $status = $_GET['status'] ?? null;
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where = '';
        $queryParams = [];

        if ($status) {
            $where = 'WHERE o.status = ?';
            $queryParams[] = $status;
        }

        // Общее количество
        $countRow = $this->db->fetchOne(
            "SELECT COUNT(*) as total FROM orders o $where",
            $queryParams
        );
        $total = (int) $countRow['total'];

        // Заказы
        $queryParams[] = $limit;
        $queryParams[] = $offset;

        $orders = $this->db->fetchAll(
            "SELECT o.*, 
                    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
             FROM orders o $where
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?",
            $queryParams
        );

        Response::success([
            'orders' => $orders,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit),
        ]);
    }

    /**
     * Обновить заказ (админ)
     * PUT /admin/orders/{id}
     */
    public function update(array $params): void
    {
        $orderId = (int) ($params['id'] ?? 0);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $order = $this->db->fetchOne("SELECT * FROM orders WHERE id = ?", [$orderId]);
        if (!$order) {
            Response::error('Заказ не найден', 404);
            return;
        }

        $updates = [];
        $values = [];
        $allowedFields = [
            'status',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_address',
            'notes',
            'admin_notes'
        ];

        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "$field = ?";
                $values[] = $input[$field];
            }
        }

        if (empty($updates)) {
            Response::error('Нет полей для обновления', 400);
            return;
        }

        $updates[] = 'updated_at = ?';
        $values[] = date('Y-m-d H:i:s');
        $values[] = $orderId;

        $this->db->execute(
            "UPDATE orders SET " . implode(', ', $updates) . " WHERE id = ?",
            $values
        );

        $order = $this->getOrderWithItems($orderId);
        Response::success($order, 'Заказ обновлён');
    }

    /**
     * Удалить заказ (админ)
     * DELETE /admin/orders/{id}
     */
    public function delete(array $params): void
    {
        $orderId = (int) ($params['id'] ?? 0);

        $order = $this->db->fetchOne("SELECT * FROM orders WHERE id = ?", [$orderId]);
        if (!$order) {
            Response::error('Заказ не найден', 404);
            return;
        }

        $this->db->execute("DELETE FROM orders WHERE id = ?", [$orderId]);

        Response::success(null, 'Заказ удалён');
    }

    /**
     * Статистика заказов (админ)
     * GET /admin/stats
     */
    public function stats(array $params): void
    {
        $totalOrders = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM orders")['cnt'];
        $newOrders = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM orders WHERE status = 'new'")['cnt'];
        $processingOrders = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('confirmed','processing','printing')")['cnt'];
        $doneOrders = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM orders WHERE status = 'done'")['cnt'];
        $totalDesigns = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM designs")['cnt'];

        $recentOrders = $this->db->fetchAll(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5"
        );

        $statusCounts = $this->db->fetchAll(
            "SELECT status, COUNT(*) as count FROM orders GROUP BY status"
        );

        Response::success([
            'total_orders' => (int) $totalOrders,
            'new_orders' => (int) $newOrders,
            'processing_orders' => (int) $processingOrders,
            'done_orders' => (int) $doneOrders,
            'total_designs' => (int) $totalDesigns,
            'recent_orders' => $recentOrders,
            'status_counts' => $statusCounts,
        ]);
    }

    /**
     * Получить заказ с позициями
     */
    private function getOrderWithItems(int $orderId): ?array
    {
        $order = $this->db->fetchOne("SELECT * FROM orders WHERE id = ?", [$orderId]);
        if (!$order)
            return null;

        $order['items'] = $this->db->fetchAll(
            "SELECT *, 
                    svg_data IS NOT NULL as has_svg, 
                    canvas_json IS NOT NULL as has_canvas
             FROM order_items 
             WHERE order_id = ?",
            [$orderId]
        );

        return $order;
    }
}
