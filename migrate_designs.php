<?php
$db = new PDO('sqlite:data/printeditor.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    // Добавляем поля для задней стороны в дизайны
    $db->exec("ALTER TABLE designs ADD COLUMN canvas_json_back TEXT");
    $db->exec("ALTER TABLE designs ADD COLUMN svg_data_back TEXT");
    $db->exec("ALTER TABLE designs ADD COLUMN preview_back_path TEXT");
    $db->exec("ALTER TABLE designs ADD COLUMN highres_back_path TEXT");

    // Добавляем флаг двухсторонней печати
    $db->exec("ALTER TABLE designs ADD COLUMN is_double_sided INTEGER DEFAULT 0");

    // Добавляем цену в позиции корзины (чтобы фиксировать цену на момент добавления)
    $db->exec("ALTER TABLE cart_items ADD COLUMN price INTEGER DEFAULT 0");

    echo "Migration successful: Double-sided support added to designs and price added to cart_items.\n";
}
catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
