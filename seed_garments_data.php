<?php
$db = new PDO('sqlite:data/printeditor.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Список стандартных цен
$prices = [
    'tshirt' => [1500, 2500],
    'hoodie' => [3500, 4500],
    'polo' => [2000, 3000],
    'sweatshirt' => [3000, 4000],
    'tank' => [1200, 2000]
];

try {
    $garments = $db->query("SELECT id, slug, image_path FROM garments")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($garments as $g) {
        $p = $prices[$g['slug']] ?? [1500, 2500];

        $sql = "UPDATE garments SET 
                image_back_path = ?, 
                price_one_side = ?, 
                price_two_sides = ?,
                print_area_back_top = 20,
                print_area_back_left = 30,
                print_area_back_width = 40,
                print_area_back_height = 45
                WHERE id = ?";

        $stmt = $db->prepare($sql);
        // Пока используем ту же картинку для зада
        $stmt->execute([$g['image_path'], $p[0], $p[1], $g['id']]);
        echo "Updated garment: {$g['slug']}\n";
    }
}
catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
