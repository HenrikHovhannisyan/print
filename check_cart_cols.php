<?php
$dbFile = __DIR__ . '/data/printeditor.db';
$db = new PDO('sqlite:' . $dbFile);
$res = $db->query("PRAGMA table_info(cart_items)")->fetchAll(PDO::FETCH_ASSOC);
foreach ($res as $row) {
    echo $row['name'] . "\n";
}
