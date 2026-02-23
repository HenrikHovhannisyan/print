<?php
require_once __DIR__ . '/backend/bootstrap.php';

try {
    $db = Database::getInstance();
    $garments = $db->fetchAll("SELECT id, slug, name, price_one_side, price_two_sides, image_back_path FROM garments");
    echo "ID | SLUG | NAME | PRICE1 | PRICE2 | BACK_PATH\n";
    echo "---|------|------|--------|--------|----------\n";
    foreach ($garments as $g) {
        printf("%d | %s | %s | %d | %d | %s\n",
            $g['id'],
            $g['slug'],
            $g['name'],
            $g['price_one_side'],
            $g['price_two_sides'],
            $g['image_back_path'] ?: 'NULL'
        );
    }
}
catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
