<?php
/**
 * PrintEditor — FileManager
 * 
 * Управление файлами: загрузка, сохранение, удаление.
 * Поддержка base64, dataURL, файлов.
 */

class FileManager
{
    private $config;

    public function __construct()
    {
        $this->config = require BACKEND_ROOT . '/config.php';
        $this->ensureDirectories();
    }

    /**
     * Создать все необходимые директории
     */
    private function ensureDirectories(): void
    {
        foreach ($this->config['storage'] as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    /**
     * Сохранить dataURL как файл
     * Примеры dataURL: "data:image/png;base64,iVBOR..." / "data:image/svg+xml;base64,..."
     * 
     * @param string $dataUrl
     * @param string $category — designs|mockups|highres|originals|exports
     * @param string|null $filename — имя файла (без расширения). Если null — генерируется
     * @return array ['path' => относительный путь, 'full_path' => абсолютный, 'filename' => имя]
     */
    public function saveDataUrl(string $dataUrl, string $category, ?string $filename = null): array
    {
        // Парсим dataURL
        if (!preg_match('/^data:([^;]+);base64,(.+)$/', $dataUrl, $matches)) {
            throw new Exception('Невалидный dataURL формат');
        }

        $mimeType = $matches[1];
        $base64Data = $matches[2];
        $binaryData = base64_decode($base64Data);

        if ($binaryData === false) {
            throw new Exception('Ошибка декодирования base64');
        }

        // Определяем расширение по MIME
        $ext = $this->mimeToExtension($mimeType);
        if ($filename === null) {
            $filename = $this->generateFilename();
        }

        $fullFilename = $filename . '.' . $ext;
        $dir = $this->config['storage'][$category] ?? $this->config['storage']['base_path'];
        $fullPath = $dir . '/' . $fullFilename;
        $relativePath = 'uploads/' . $category . '/' . $fullFilename;

        file_put_contents($fullPath, $binaryData);

        return [
            'path' => $relativePath,
            'full_path' => $fullPath,
            'filename' => $fullFilename,
            'mime_type' => $mimeType,
            'size' => strlen($binaryData),
        ];
    }

    /**
     * Сохранить текстовые данные (SVG, JSON) как файл
     */
    public function saveText(string $content, string $category, string $extension, ?string $filename = null): array
    {
        if ($filename === null) {
            $filename = $this->generateFilename();
        }

        $fullFilename = $filename . '.' . $extension;
        $dir = $this->config['storage'][$category] ?? $this->config['storage']['base_path'];
        $fullPath = $dir . '/' . $fullFilename;
        $relativePath = 'uploads/' . $category . '/' . $fullFilename;

        file_put_contents($fullPath, $content);

        $mimeTypes = [
            'svg' => 'image/svg+xml',
            'json' => 'application/json',
            'pdf' => 'application/pdf',
        ];

        return [
            'path' => $relativePath,
            'full_path' => $fullPath,
            'filename' => $fullFilename,
            'mime_type' => $mimeTypes[$extension] ?? 'text/plain',
            'size' => strlen($content),
        ];
    }

    /**
     * Сохранить загруженный файл ($_FILES)
     */
    public function saveUploadedFile(array $file, string $category): array
    {
        // Валидация
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Ошибка загрузки файла: код ' . $file['error']);
        }

        if ($file['size'] > $this->config['upload']['max_file_size']) {
            throw new Exception('Файл слишком большой. Максимум: ' .
                ($this->config['upload']['max_file_size'] / 1024 / 1024) . ' MB');
        }

        $mimeType = mime_content_type($file['tmp_name']);
        if (!in_array($mimeType, $this->config['upload']['allowed_types'])) {
            throw new Exception('Недопустимый тип файла: ' . $mimeType);
        }

        $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = $this->generateFilename() . '_' . $this->sanitize($originalName);
        $fullFilename = $filename . '.' . $ext;

        $dir = $this->config['storage'][$category] ?? $this->config['storage']['base_path'];
        $fullPath = $dir . '/' . $fullFilename;
        $relativePath = 'uploads/' . $category . '/' . $fullFilename;

        move_uploaded_file($file['tmp_name'], $fullPath);

        return [
            'path' => $relativePath,
            'full_path' => $fullPath,
            'filename' => $fullFilename,
            'original_filename' => $file['name'],
            'mime_type' => $mimeType,
            'size' => $file['size'],
        ];
    }

    /**
     * Удалить файл
     */
    public function deleteFile(string $relativePath): bool
    {
        $fullPath = APP_ROOT . '/' . $relativePath;
        if (file_exists($fullPath)) {
            return unlink($fullPath);
        }
        return false;
    }

    /**
     * Копировать существующий файл в новую категорию (для изоляции заказа)
     * @param string $relativePath — относительный путь источника (uploads/...)
     * @param string $category — целевая категория (designs|mockups|orders...)
     * @return string|null — Новый относительный путь или null при ошибке
     */
    public function copyFile(string $relativePath, string $category): ?string
    {
        $srcFullPath = APP_ROOT . '/' . $relativePath;
        if (!file_exists($srcFullPath)) {
            return null;
        }

        $ext = pathinfo($srcFullPath, PATHINFO_EXTENSION);
        $newFilename = $this->generateFilename() . '.' . $ext;

        $dir = $this->config['storage'][$category] ?? $this->config['storage']['base_path'];
        $destFullPath = $dir . '/' . $newFilename;
        $destRelativePath = 'uploads/' . $category . '/' . $newFilename;

        if (copy($srcFullPath, $destFullPath)) {
            return $destRelativePath;
        }

        return null;
    }

    /**
     * Генерация уникального имени файла
     */
    private function generateFilename(): string
    {
        return date('Ymd_His') . '_' . bin2hex(random_bytes(4));
    }

    /**
     * Очистить имя файла от опасных символов
     */
    private function sanitize(string $name): string
    {
        $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $name);
        return substr($name, 0, 50);
    }

    /**
     * MIME-тип → расширение файла
     */
    private function mimeToExtension(string $mime): string
    {
        $map = [
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/svg+xml' => 'svg',
            'image/webp' => 'webp',
            'application/json' => 'json',
            'application/pdf' => 'pdf',
        ];

        return $map[$mime] ?? 'bin';
    }
}
