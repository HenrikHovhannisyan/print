<?php
require_once __DIR__ . '/backend/bootstrap.php';

try {
    $db = Database::getInstance();
    $db->execute("UPDATE garments SET price_one_side = 1500 WHERE price_one_side = 0 OR price_one_side IS NULL");
    $db->execute("UPDATE garments SET price_two_sides = 2500 WHERE price_two_sides = 0 OR price_two_sides IS NULL");
    echo "Migration successful!\n";
}
catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
