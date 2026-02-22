<?php
/**
 * PrintEditor — Database Class
 * 
 * Обёртка над SQLite через PDO.
 * Создаёт таблицы при первом подключении.
 */

class Database
{
    /** @var PDO */
    private $pdo;

    /** @var Database|null Singleton */
    private static $instance = null;

    /**
     * Получить единственный экземпляр подключения
     */
    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            $config = require BACKEND_ROOT . '/config.php';
            self::$instance = new self($config['db']['path']);
        }
        return self::$instance;
    }

    /**
     * Приватный конструктор (Singleton)
     */
    private function __construct(string $dbPath)
    {
        // Создаём директорию для БД, если не существует
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Включаем WAL-режим для лучшей производительности
        $this->pdo->exec('PRAGMA journal_mode=WAL');
        // Включаем foreign keys
        $this->pdo->exec('PRAGMA foreign_keys=ON');

        // Создаём таблицы
        $this->migrate();
    }

    /**
     * Получить PDO объект
     */
    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    /**
     * Выполнить SELECT-запрос и вернуть все строки
     */
    public function fetchAll(string $sql, array $params = []): array
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Выполнить SELECT-запрос и вернуть одну строку
     */
    public function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Выполнить INSERT / UPDATE / DELETE
     * @return int Количество затронутых строк
     */
    public function execute(string $sql, array $params = []): int
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /**
     * Выполнить INSERT и вернуть ID новой записи
     */
    public function insert(string $sql, array $params = []): int
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return (int)$this->pdo->lastInsertId();
    }

    /**
     * Начать транзакцию
     */
    public function beginTransaction(): void
    {
        $this->pdo->beginTransaction();
    }

    /**
     * Подтвердить транзакцию
     */
    public function commit(): void
    {
        $this->pdo->commit();
    }

    /**
     * Откатить транзакцию
     */
    public function rollback(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    /**
     * Создание таблиц (миграция)
     */
    private function migrate(): void
    {
        $this->pdo->exec("PRAGMA foreign_keys = ON;");
        $this->pdo->exec("
            -- Пользователи
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Дизайны (сохранённые проекты)
            CREATE TABLE IF NOT EXISTS designs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                garment_type TEXT NOT NULL DEFAULT 'tshirt',
                garment_color TEXT DEFAULT '#ffffff',
                canvas_json TEXT,
                svg_data TEXT,
                preview_path TEXT,
                highres_path TEXT,
                print_area_json TEXT,
                title TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Оригиналы загруженных файлов
            CREATE TABLE IF NOT EXISTS design_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                design_id INTEGER NOT NULL,
                original_filename TEXT,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER DEFAULT 0,
                asset_type TEXT DEFAULT 'image',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE
            );

            -- Корзина
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                design_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                size TEXT DEFAULT 'M',
                notes TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE
            );

            -- Заказы
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                session_id TEXT,
                customer_name TEXT DEFAULT '',
                customer_email TEXT DEFAULT '',
                customer_phone TEXT DEFAULT '',
                customer_address TEXT DEFAULT '',
                status TEXT DEFAULT 'new',
                total_items INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                admin_notes TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Позиции заказа
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                design_id INTEGER,
                garment_type TEXT NOT NULL,
                garment_color TEXT DEFAULT '#ffffff',
                size TEXT DEFAULT 'M',
                quantity INTEGER DEFAULT 1,
                preview_path TEXT,
                highres_path TEXT,
                canvas_json TEXT,
                svg_data TEXT,
                notes TEXT DEFAULT '',
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            );

            -- Администраторы
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Типы одежды (управляются из админки)
            CREATE TABLE IF NOT EXISTS garments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                image_path TEXT NOT NULL,
                icon_path TEXT DEFAULT '',
                print_area_top REAL DEFAULT 30,
                print_area_left REAL DEFAULT 35,
                print_area_width REAL DEFAULT 30,
                print_area_height REAL DEFAULT 30,
                available_colors TEXT DEFAULT '[]',
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Индексы для быстрого поиска
            CREATE INDEX IF NOT EXISTS idx_designs_session ON designs(session_id);
            CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
            CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
            CREATE INDEX IF NOT EXISTS idx_garments_active ON garments(is_active, sort_order);
        ");

        // Создаём администратора по умолчанию, если нет ни одного
        $adminCount = $this->fetchOne("SELECT COUNT(*) as cnt FROM admins");
        if ($adminCount && (int)$adminCount['cnt'] === 0) {
            $config = require BACKEND_ROOT . '/config.php';
            $hash = password_hash($config['admin']['default_password'], PASSWORD_BCRYPT);
            $this->insert(
                "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
            [$config['admin']['default_username'], $hash]
            );
        }

        // Начальное заполнение типов одежды
        $garmentCount = $this->fetchOne("SELECT COUNT(*) as cnt FROM garments");
        if ($garmentCount && (int)$garmentCount['cnt'] === 0) {
            $defaultColors = json_encode([
                '#ffffff',
                '#1a1a2e',
                '#cccccc',
                '#e74c3c',
                '#3498db',
                '#2ecc71',
                '#f39c12',
                '#9b59b6',
                '#c8a876',
                '#7f8c8d',
                '#e84393',
                '#00cec9'
            ]);

            $defaults = [
                ['tshirt', 'Футболка', 'assets/garments/tshirt.png', 34, 36, 28, 30, 0],
                ['hoodie', 'Худи', 'assets/garments/hoodie.png', 35, 34, 32, 25, 1],
                ['sweatshirt', 'Свитшот', 'assets/garments/sweatshirt.png', 30, 34, 32, 28, 2],
                ['polo', 'Поло', 'assets/garments/polo.png', 38, 37, 26, 26, 3],
                ['tank', 'Майка', 'assets/garments/tank.png', 32, 33, 34, 32, 4],
            ];

            foreach ($defaults as $g) {
                $this->insert(
                    "INSERT INTO garments (slug, name, image_path, print_area_top, print_area_left, 
                     print_area_width, print_area_height, available_colors, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$g[0], $g[1], $g[2], $g[3], $g[4], $g[5], $g[6], $defaultColors, $g[7]]
                );
            }
        }
    }
}
