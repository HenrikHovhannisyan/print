<?php
$db = new PDO('sqlite:data/printeditor.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    // Добавляем поля для задней стороны в позиции заказов
    $db->exec("ALTER TABLE order_items ADD COLUMN preview_back_path TEXT");
    $db->exec("ALTER TABLE order_items ADD COLUMN highres_back_path TEXT");
    $db->exec("ALTER TABLE order_items ADD COLUMN canvas_json_back TEXT");
    $db->exec("ALTER TABLE order_items ADD COLUMN svg_data_back TEXT");

    // Добавляем цену в позиции заказов
    $db->exec("ALTER TABLE order_items ADD COLUMN price INTEGER DEFAULT 0");

    // Добавляем общую сумму в заказы
    $db->exec("ALTER TABLE orders ADD COLUMN total_price INTEGER DEFAULT 0");

    echo "Migration successful: Double-sided support and pricing added to orders/order_items.\n";
}
catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
