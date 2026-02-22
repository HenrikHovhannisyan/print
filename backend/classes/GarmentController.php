<?php
/**
 * PrintEditor — GarmentController
 * 
 * CRUD для типов одежды.
 * Позволяет администратору добавлять/редактировать виды одежды,
 * загружать изображения и настраивать printArea координаты.
 * 
 * Публичный API: список активных типов для фронтенда.
 */

class GarmentController
{
    private $db;
    private $fileManager;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->fileManager = new FileManager();
    }

    /**
     * Публичный: получить все активные типы одежды
     * GET /garments
     * 
     * Возвращает данные в формате GARMENT_CONFIG для фронтенда
     */
    public function listActive(array $params): void
    {
        $garments = $this->db->fetchAll(
            "SELECT * FROM garments WHERE is_active = 1 ORDER BY sort_order ASC"
        );

        // Формируем формат для фронтенда
        $config = [];
        foreach ($garments as $g) {
            $config[$g['slug']] = [
                'id' => (int) $g['id'],
                'name' => $g['name'],
                'image' => $g['image_path'],
                'icon' => $g['icon_path'] ?: $g['image_path'],
                'printArea' => [
                    'top' => (float) $g['print_area_top'],
                    'left' => (float) $g['print_area_left'],
                    'width' => (float) $g['print_area_width'],
                    'height' => (float) $g['print_area_height'],
                ],
                'colors' => json_decode($g['available_colors'], true) ?: [],
            ];
        }

        Response::success($config);
    }

    /**
     * Админ: список ВСЕХ типов (включая неактивные)
     * GET /admin/garments
     */
    public function listAll(array $params): void
    {
        $garments = $this->db->fetchAll(
            "SELECT * FROM garments ORDER BY sort_order ASC"
        );

        // Декодируем JSON-поля
        foreach ($garments as &$g) {
            $g['available_colors'] = json_decode($g['available_colors'], true) ?: [];
        }

        Response::success($garments);
    }

    /**
     * Админ: получить один тип
     * GET /admin/garments/{id}
     */
    public function get(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        if (!$garment) {
            Response::error('Тип одежды не найден', 404);
            return;
        }

        $garment['available_colors'] = json_decode($garment['available_colors'], true) ?: [];

        Response::success($garment);
    }

    /**
     * Админ: создать новый тип одежды
     * POST /admin/garments
     * 
     * Принимает multipart/form-data (с файлом) или JSON
     */
    public function create(array $params): void
    {
        // Определяем формат запроса
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

        if (strpos($contentType, 'multipart/form-data') !== false) {
            $input = $_POST;
        } else {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
        }

        $slug = $input['slug'] ?? '';
        $name = $input['name'] ?? '';

        if (empty($slug) || empty($name)) {
            Response::error('slug и name обязательны', 400);
            return;
        }

        // Проверяем уникальность slug
        $existing = $this->db->fetchOne("SELECT id FROM garments WHERE slug = ?", [$slug]);
        if ($existing) {
            Response::error('Тип с таким slug уже существует', 400);
            return;
        }

        // Обработка изображения
        $imagePath = $input['image_path'] ?? '';
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            try {
                $fileInfo = $this->fileManager->saveUploadedFile($_FILES['image'], 'originals');
                $imagePath = $fileInfo['path'];
            } catch (Exception $e) {
                Response::error('Ошибка загрузки изображения: ' . $e->getMessage(), 400);
                return;
            }
        }

        if (empty($imagePath)) {
            Response::error('Изображение одежды обязательно (image_path или файл image)', 400);
            return;
        }

        // Иконка (опционально)
        $iconPath = $input['icon_path'] ?? '';
        if (!empty($_FILES['icon']) && $_FILES['icon']['error'] === UPLOAD_ERR_OK) {
            try {
                $fileInfo = $this->fileManager->saveUploadedFile($_FILES['icon'], 'originals');
                $iconPath = $fileInfo['path'];
            } catch (Exception $e) {
                // Иконка не критична — продолжаем
                $iconPath = '';
            }
        }

        $colors = $input['available_colors'] ?? null;
        if (is_string($colors)) {
            $colors = json_decode($colors, true);
        }
        if (!is_array($colors)) {
            $colors = ['#ffffff', '#1a1a2e', '#cccccc', '#e74c3c', '#3498db', '#2ecc71'];
        }

        $maxOrder = $this->db->fetchOne("SELECT MAX(sort_order) as max_order FROM garments");
        $sortOrder = (int) ($input['sort_order'] ?? (($maxOrder['max_order'] ?? 0) + 1));

        $id = $this->db->insert(
            "INSERT INTO garments (slug, name, image_path, icon_path, 
             print_area_top, print_area_left, print_area_width, print_area_height,
             available_colors, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $slug,
                $name,
                $imagePath,
                $iconPath,
                (float) ($input['print_area_top'] ?? 30),
                (float) ($input['print_area_left'] ?? 35),
                (float) ($input['print_area_width'] ?? 30),
                (float) ($input['print_area_height'] ?? 30),
                json_encode($colors),
                $sortOrder,
                (int) ($input['is_active'] ?? 1),
            ]
        );

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        $garment['available_colors'] = json_decode($garment['available_colors'], true);

        Response::success($garment, 'Тип одежды создан', 201);
    }

    /**
     * Админ: обновить тип одежды
     * PUT /admin/garments/{id}
     */
    public function update(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        if (!$garment) {
            Response::error('Тип одежды не найден', 404);
            return;
        }

        // Поддерживаем и JSON и form-data
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'multipart/form-data') !== false) {
            $input = $_POST;
        } else {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
        }

        // Обработка изображения
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            try {
                $fileInfo = $this->fileManager->saveUploadedFile($_FILES['image'], 'originals');
                $input['image_path'] = $fileInfo['path'];
            } catch (Exception $e) {
                Response::error('Ошибка загрузки: ' . $e->getMessage(), 400);
                return;
            }
        }

        // Иконка
        if (!empty($_FILES['icon']) && $_FILES['icon']['error'] === UPLOAD_ERR_OK) {
            try {
                $fileInfo = $this->fileManager->saveUploadedFile($_FILES['icon'], 'originals');
                $input['icon_path'] = $fileInfo['path'];
            } catch (Exception $e) {
                // Не критично
            }
        }

        $updates = [];
        $values = [];

        $allowedFields = [
            'name',
            'slug',
            'image_path',
            'icon_path',
            'print_area_top',
            'print_area_left',
            'print_area_width',
            'print_area_height',
            'sort_order',
            'is_active',
        ];

        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "$field = ?";
                $values[] = $input[$field];
            }
        }

        // Цвета
        if (isset($input['available_colors'])) {
            $colors = $input['available_colors'];
            if (is_string($colors)) {
                $colors = json_decode($colors, true);
            }
            $updates[] = 'available_colors = ?';
            $values[] = json_encode($colors);
        }

        if (empty($updates)) {
            Response::error('Нет данных для обновления', 400);
            return;
        }

        $updates[] = 'updated_at = ?';
        $values[] = date('Y-m-d H:i:s');
        $values[] = $id;

        $this->db->execute(
            "UPDATE garments SET " . implode(', ', $updates) . " WHERE id = ?",
            $values
        );

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        $garment['available_colors'] = json_decode($garment['available_colors'], true);

        Response::success($garment, 'Тип одежды обновлён');
    }

    /**
     * Админ: удалить тип одежды
     * DELETE /admin/garments/{id}
     */
    public function delete(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        if (!$garment) {
            Response::error('Тип одежды не найден', 404);
            return;
        }

        $this->db->execute("DELETE FROM garments WHERE id = ?", [$id]);

        Response::success(null, 'Тип одежды удалён');
    }

    /**
     * Админ: загрузить изображение одежды
     * POST /admin/garments/{id}/image
     */
    public function uploadImage(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);

        $garment = $this->db->fetchOne("SELECT * FROM garments WHERE id = ?", [$id]);
        if (!$garment) {
            Response::error('Тип одежды не найден', 404);
            return;
        }

        if (empty($_FILES['image'])) {
            Response::error('Файл не предоставлен', 400);
            return;
        }

        try {
            $fileInfo = $this->fileManager->saveUploadedFile($_FILES['image'], 'originals');

            $this->db->execute(
                "UPDATE garments SET image_path = ?, updated_at = ? WHERE id = ?",
                [$fileInfo['path'], date('Y-m-d H:i:s'), $id]
            );

            Response::success([
                'image_path' => $fileInfo['path'],
            ], 'Изображение загружено');

        } catch (Exception $e) {
            Response::error('Ошибка загрузки: ' . $e->getMessage(), 500);
        }
    }
}
