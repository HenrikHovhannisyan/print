<?php
$db = new PDO('sqlite:data/printeditor.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    // Добавляем поля для задней стороны
    $db->exec("ALTER TABLE garments ADD COLUMN image_back_path TEXT");
    $db->exec("ALTER TABLE garments ADD COLUMN print_area_back_top FLOAT DEFAULT 25");
    $db->exec("ALTER TABLE garments ADD COLUMN print_area_back_left FLOAT DEFAULT 35");
    $db->exec("ALTER TABLE garments ADD COLUMN print_area_back_width FLOAT DEFAULT 30");
    $db->exec("ALTER TABLE garments ADD COLUMN print_area_back_height FLOAT DEFAULT 30");

    // Добавляем поля цен
    $db->exec("ALTER TABLE garments ADD COLUMN price_one_side INTEGER DEFAULT 1500");
    $db->exec("ALTER TABLE garments ADD COLUMN price_two_sides INTEGER DEFAULT 2500");

    echo "Migration successful: Back-side support and pricing added to garments table.\n";
}
catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
