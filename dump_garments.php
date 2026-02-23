<?php
require_once __DIR__ . '/backend/bootstrap.php';
$garments = Database::getInstance()->fetchAll("SELECT slug, image_path, image_back_path FROM garments");
file_put_contents('garments_debug.json', json_encode($garments, JSON_PRETTY_PRINT));
print_r($garments);
