<?php
require_once __DIR__ . '/backend/bootstrap.php';

try {
    $db = Database::getInstance();
    $garments = $db->fetchAll("SELECT slug, name, image_back_path, price_one_side, price_two_sides FROM garments");
    echo json_encode($garments, JSON_PRETTY_PRINT);
}
catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
