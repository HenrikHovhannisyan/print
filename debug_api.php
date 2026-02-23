<?php
require_once __DIR__ . '/backend/bootstrap.php';

try {
    $ctrl = new GarmentController();
    $db = Database::getInstance();
    $garments = $db->fetchAll("SELECT * FROM garments WHERE is_active = 1 ORDER BY sort_order ASC");

    $config = [];
    foreach ($garments as $g) {
        $config[$g['slug']] = [
            'id' => (int)$g['id'],
            'name' => $g['name'],
            'image' => $g['image_path'],
            'imageBack' => $g['image_back_path'] ?? '',
            'price' => [
                'oneSide' => (int)($g['price_one_side'] ?? 1500),
                'twoSides' => (int)($g['price_two_sides'] ?? 2500),
            ],
        ];
    }
    echo json_encode($config, JSON_PRETTY_PRINT);
}
catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
