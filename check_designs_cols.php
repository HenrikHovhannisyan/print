<?php
$dbFile = __DIR__ . '/data/printeditor.db';
if (!file_exists($dbFile)) {
    die("Database not found at $dbFile\n");
}
$db = new PDO('sqlite:' . $dbFile);
$res = $db->query("PRAGMA table_info(designs)")->fetchAll(PDO::FETCH_ASSOC);
if (!$res) {
    die("Table designs not found\n");
}
foreach ($res as $row) {
    echo $row['name'] . "\n";
}
