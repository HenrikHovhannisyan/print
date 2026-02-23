<?php
require 'backend/bootstrap.php';
$db = Database::getInstance();
$columns = $db->fetchAll("PRAGMA table_info(order_items)");
foreach ($columns as $c) {
    echo $c['name'] . "\n";
}
