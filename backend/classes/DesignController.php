<?php
/**
 * PrintEditor — DesignController
 * 
 * Сохранение и управление дизайнами.
 * Каждый дизайн содержит: canvas JSON, SVG, high-res PNG, превью, оригиналы.
 */

class DesignController
{
    private $db;
    private $fileManager;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->fileManager = new FileManager();
    }

    /**
     * Сохранить дизайн (создание или обновление)
     * POST /designs
     * 
     * Body JSON:
     *   session_id      — ID сессии браузера
     *   garment_type    — тип одежды (tshirt, hoodie, ...)
     *   garment_color   — HEX цвет (#ffffff)
     *   canvas_json     — JSON из Fabric.js canvas.toJSON()
     *   svg_data        — SVG из canvas.toSVG()
     *   highres_data    — dataURL из canvas.toDataURL({multiplier: 4})
     *   preview_data    — dataURL мокапа (одежда + дизайн)
     *   print_area      — объект {top, left, width, height}
     *   title           — название дизайна (опционально)
     *   design_id       — ID существующего дизайна (для обновления)
     */
    public function save(array $params): void
    {
        $input = $this->getJsonInput();

        // Валидация обязательных полей
        $sessionId = $input['session_id'] ?? '';
        if (empty($sessionId)) {
            Response::error('session_id обязателен', 400);
            return;
        }

        $garmentType = $input['garment_type'] ?? 'tshirt';
        $garmentColor = $input['garment_color'] ?? '#ffffff';
        $canvasJson = $input['canvas_json'] ?? null;
        $svgData = $input['svg_data'] ?? null;
        $highresData = $input['highres_data'] ?? null;
        $previewData = $input['preview_data'] ?? null;
        $printArea = $input['print_area'] ?? null;
        $title = $input['title'] ?? '';
        $designId = $input['design_id'] ?? null;

        try {
            $this->db->beginTransaction();

            // Генерируем уникальное имя для файлов
            $filePrefix = date('Ymd_His') . '_' . bin2hex(random_bytes(4));

            // Сохраняем Canvas JSON как файл
            $canvasFile = null;
            if ($canvasJson) {
                $jsonStr = is_string($canvasJson) ? $canvasJson : json_encode($canvasJson, JSON_UNESCAPED_UNICODE);
                $canvasFile = $this->fileManager->saveText($jsonStr, 'designs', 'json', $filePrefix . '_canvas');
            }

            // Сохраняем SVG
            $svgFile = null;
            if ($svgData) {
                $svgFile = $this->fileManager->saveText($svgData, 'designs', 'svg', $filePrefix . '_design');
            }

            // Сохраняем high-res PNG
            $highresFile = null;
            if ($highresData) {
                $highresFile = $this->fileManager->saveDataUrl($highresData, 'highres', $filePrefix . '_highres');
            }

            // Сохраняем превью мокапа
            $previewFile = null;
            if ($previewData) {
                $previewFile = $this->fileManager->saveDataUrl($previewData, 'mockups', $filePrefix . '_mockup');
            }

            $printAreaJson = $printArea ? json_encode($printArea) : null;
            $canvasJsonStr = $canvasJson ? (is_string($canvasJson) ? $canvasJson : json_encode($canvasJson)) : null;

            if ($designId) {
                // Обновление существующего дизайна
                $existing = $this->db->fetchOne(
                    "SELECT * FROM designs WHERE id = ? AND session_id = ?",
                    [$designId, $sessionId]
                );

                if (!$existing) {
                    $this->db->rollback();
                    Response::error('Дизайн не найден', 404);
                    return;
                }

                $updateFields = [
                    'garment_type' => $garmentType,
                    'garment_color' => $garmentColor,
                    'canvas_json' => $canvasJsonStr,
                    'updated_at' => date('Y-m-d H:i:s'),
                ];

                if ($svgData)
                    $updateFields['svg_data'] = $svgData;
                if ($previewFile)
                    $updateFields['preview_path'] = $previewFile['path'];
                if ($highresFile)
                    $updateFields['highres_path'] = $highresFile['path'];
                if ($printAreaJson)
                    $updateFields['print_area_json'] = $printAreaJson;
                if ($title)
                    $updateFields['title'] = $title;

                $setClauses = [];
                $values = [];
                foreach ($updateFields as $key => $value) {
                    $setClauses[] = "$key = ?";
                    $values[] = $value;
                }
                $values[] = $designId;

                $this->db->execute(
                    "UPDATE designs SET " . implode(', ', $setClauses) . " WHERE id = ?",
                    $values
                );
            } else {
                // Создание нового дизайна
                $designId = $this->db->insert(
                    "INSERT INTO designs (session_id, garment_type, garment_color, canvas_json, svg_data, 
                     preview_path, highres_path, print_area_json, title)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $sessionId,
                        $garmentType,
                        $garmentColor,
                        $canvasJsonStr,
                        $svgData,
                        $previewFile ? $previewFile['path'] : null,
                        $highresFile ? $highresFile['path'] : null,
                        $printAreaJson,
                        $title,
                    ]
                );
            }

            $this->db->commit();

            // Получаем сохранённый дизайн
            $design = $this->db->fetchOne("SELECT * FROM designs WHERE id = ?", [$designId]);

            Response::success([
                'design_id' => (int) $designId,
                'design' => $design,
                'files' => [
                    'canvas_json' => $canvasFile ? $canvasFile['path'] : null,
                    'svg' => $svgFile ? $svgFile['path'] : null,
                    'highres' => $highresFile ? $highresFile['path'] : null,
                    'preview' => $previewFile ? $previewFile['path'] : null,
                ],
            ], 'Дизайн сохранён');

        } catch (Exception $e) {
            $this->db->rollback();
            Response::error('Ошибка сохранения: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Загрузить оригинал изображения для дизайна
     * POST /designs/{id}/upload
     */
    public function uploadAsset(array $params): void
    {
        $designId = (int) ($params['id'] ?? 0);

        if (empty($_FILES['file'])) {
            Response::error('Файл не предоставлен', 400);
            return;
        }

        // Проверяем существование дизайна
        $design = $this->db->fetchOne("SELECT * FROM designs WHERE id = ?", [$designId]);
        if (!$design) {
            Response::error('Дизайн не найден', 404);
            return;
        }

        try {
            $fileInfo = $this->fileManager->saveUploadedFile($_FILES['file'], 'originals');

            $assetId = $this->db->insert(
                "INSERT INTO design_assets (design_id, original_filename, stored_filename, 
                 file_path, file_type, file_size, asset_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    $designId,
                    $fileInfo['original_filename'],
                    $fileInfo['filename'],
                    $fileInfo['path'],
                    $fileInfo['mime_type'],
                    $fileInfo['size'],
                    'image',
                ]
            );

            Response::success([
                'asset_id' => $assetId,
                'file' => $fileInfo,
            ], 'Файл загружен');

        } catch (Exception $e) {
            Response::error('Ошибка загрузки: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Получить дизайн по ID
     * GET /designs/{id}
     */
    public function get(array $params): void
    {
        $designId = (int) ($params['id'] ?? 0);

        $design = $this->db->fetchOne("SELECT * FROM designs WHERE id = ?", [$designId]);
        if (!$design) {
            Response::error('Дизайн не найден', 404);
            return;
        }

        // Получаем связанные файлы
        $assets = $this->db->fetchAll(
            "SELECT * FROM design_assets WHERE design_id = ? ORDER BY created_at",
            [$designId]
        );

        $design['assets'] = $assets;

        Response::success($design);
    }

    /**
     * Список дизайнов для сессии
     * GET /designs?session_id=xxx
     */
    public function list(array $params): void
    {
        $sessionId = $_GET['session_id'] ?? '';

        if (empty($sessionId)) {
            Response::error('session_id обязателен', 400);
            return;
        }

        $designs = $this->db->fetchAll(
            "SELECT id, garment_type, garment_color, preview_path, title, canvas_json, created_at, updated_at 
             FROM designs WHERE session_id = ? ORDER BY updated_at DESC",
            [$sessionId]
        );

        Response::success($designs);
    }

    /**
     * Удалить дизайн
     * DELETE /designs/{id}
     */
    public function delete(array $params): void
    {
        $designId = (int) ($params['id'] ?? 0);
        $sessionId = $_GET['session_id'] ?? '';

        $design = $this->db->fetchOne(
            "SELECT * FROM designs WHERE id = ? AND session_id = ?",
            [$designId, $sessionId]
        );

        if (!$design) {
            Response::error('Дизайн не найден', 404);
            return;
        }

        // Удаляем файлы
        if ($design['preview_path'])
            $this->fileManager->deleteFile($design['preview_path']);
        if ($design['highres_path'])
            $this->fileManager->deleteFile($design['highres_path']);

        $assets = $this->db->fetchAll(
            "SELECT file_path FROM design_assets WHERE design_id = ?",
            [$designId]
        );
        foreach ($assets as $asset) {
            $this->fileManager->deleteFile($asset['file_path']);
        }

        // Удаляем из БД (каскадно удалит assets)
        $this->db->execute("DELETE FROM designs WHERE id = ?", [$designId]);

        Response::success(null, 'Дизайн удалён');
    }

    /**
     * Получить JSON из тела запроса
     */
    private function getJsonInput(): array
    {
        $rawBody = file_get_contents('php://input');
        $decoded = json_decode($rawBody, true);
        return is_array($decoded) ? $decoded : [];
    }
}
