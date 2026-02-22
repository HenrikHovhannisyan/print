<?php
/**
 * PrintEditor — CartController
 * 
 * Управление корзиной покупок.
 * Корзина привязана к session_id браузера.
 */

class CartController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Добавить товар в корзину
     * POST /cart
     * 
     * Body JSON:
     *   session_id — ID сессии браузера
     *   design_id  — ID сохранённого дизайна
     *   size       — размер одежды (S, M, L, XL...)
     *   quantity   — количество
     *   notes      — заметки
     */
    public function add(array $params): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $sessionId = $input['session_id'] ?? '';
        $designId = (int) ($input['design_id'] ?? 0);
        $size = $input['size'] ?? 'M';
        $quantity = max(1, (int) ($input['quantity'] ?? 1));
        $notes = $input['notes'] ?? '';

        if (empty($sessionId) || $designId === 0) {
            Response::error('session_id и design_id обязательны', 400);
            return;
        }

        // Проверяем, что дизайн существует
        $design = $this->db->fetchOne("SELECT id FROM designs WHERE id = ?", [$designId]);
        if (!$design) {
            Response::error('Дизайн не найден', 404);
            return;
        }

        // Проверяем, нет ли уже в корзине с тем же размером
        $existing = $this->db->fetchOne(
            "SELECT id, quantity FROM cart_items WHERE session_id = ? AND design_id = ? AND size = ?",
            [$sessionId, $designId, $size]
        );

        if ($existing) {
            // Обновляем количество
            $newQty = $existing['quantity'] + $quantity;
            $this->db->execute(
                "UPDATE cart_items SET quantity = ?, notes = ? WHERE id = ?",
                [$newQty, $notes, $existing['id']]
            );
            $itemId = $existing['id'];
        } else {
            // Добавляем новый
            $itemId = $this->db->insert(
                "INSERT INTO cart_items (session_id, design_id, quantity, size, notes) VALUES (?, ?, ?, ?, ?)",
                [$sessionId, $designId, $quantity, $size, $notes]
            );
        }

        // Возвращаем обновлённую корзину
        $cart = $this->getCartItems($sessionId);

        Response::success([
            'item_id' => $itemId,
            'cart_items' => $cart,
            'cart_count' => array_sum(array_column($cart, 'quantity')),
        ], 'Добавлено в корзину');
    }

    /**
     * Получить содержимое корзины
     * GET /cart?session_id=xxx
     */
    public function get(array $params): void
    {
        $sessionId = $_GET['session_id'] ?? '';

        if (empty($sessionId)) {
            Response::error('session_id обязателен', 400);
            return;
        }

        $cart = $this->getCartItems($sessionId);

        Response::success([
            'items' => $cart,
            'cart_count' => array_sum(array_column($cart, 'quantity')),
        ]);
    }

    /**
     * Обновить позицию в корзине
     * PUT /cart/{id}
     */
    public function update(array $params): void
    {
        $itemId = (int) ($params['id'] ?? 0);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $sessionId = $input['session_id'] ?? '';
        $quantity = isset($input['quantity']) ? max(1, (int) $input['quantity']) : null;
        $size = $input['size'] ?? null;
        $notes = $input['notes'] ?? null;

        $item = $this->db->fetchOne(
            "SELECT * FROM cart_items WHERE id = ? AND session_id = ?",
            [$itemId, $sessionId]
        );

        if (!$item) {
            Response::error('Позиция не найдена', 404);
            return;
        }

        $updates = [];
        $values = [];

        if ($quantity !== null) {
            $updates[] = 'quantity = ?';
            $values[] = $quantity;
        }
        if ($size !== null) {
            $updates[] = 'size = ?';
            $values[] = $size;
        }
        if ($notes !== null) {
            $updates[] = 'notes = ?';
            $values[] = $notes;
        }

        if (!empty($updates)) {
            $values[] = $itemId;
            $this->db->execute(
                "UPDATE cart_items SET " . implode(', ', $updates) . " WHERE id = ?",
                $values
            );
        }

        $cart = $this->getCartItems($sessionId);
        Response::success([
            'items' => $cart,
            'cart_count' => array_sum(array_column($cart, 'quantity')),
        ], 'Корзина обновлена');
    }

    /**
     * Удалить позицию из корзины
     * DELETE /cart/{id}
     */
    public function remove(array $params): void
    {
        $itemId = (int) ($params['id'] ?? 0);
        $sessionId = $_GET['session_id'] ?? '';

        $item = $this->db->fetchOne(
            "SELECT * FROM cart_items WHERE id = ? AND session_id = ?",
            [$itemId, $sessionId]
        );

        if (!$item) {
            Response::error('Позиция не найдена', 404);
            return;
        }

        $this->db->execute("DELETE FROM cart_items WHERE id = ?", [$itemId]);

        $cart = $this->getCartItems($sessionId);
        Response::success([
            'items' => $cart,
            'cart_count' => array_sum(array_column($cart, 'quantity')),
        ], 'Удалено из корзины');
    }

    /**
     * Очистить корзину
     * DELETE /cart?session_id=xxx
     */
    public function clear(array $params): void
    {
        $sessionId = $_GET['session_id'] ?? '';

        if (empty($sessionId)) {
            Response::error('session_id обязателен', 400);
            return;
        }

        $this->db->execute("DELETE FROM cart_items WHERE session_id = ?", [$sessionId]);

        Response::success(null, 'Корзина очищена');
    }

    /**
     * Получить позиции корзины с данными дизайна
     */
    private function getCartItems(string $sessionId): array
    {
        return $this->db->fetchAll(
            "SELECT ci.*, d.garment_type, d.garment_color, d.preview_path, d.highres_path, d.canvas_json, d.svg_data, d.title
             FROM cart_items ci
             JOIN designs d ON d.id = ci.design_id
             WHERE ci.session_id = ?
             ORDER BY ci.created_at DESC",
            [$sessionId]
        );
    }
}
