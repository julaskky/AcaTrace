<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

session_start();

require_once __DIR__ . "/config/database.php";

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Not authenticated."
    ]);

    exit;
}

try {

    $query = $pdo->query("
        SELECT id, name, country
        FROM universities
        WHERE status = 'active'
        ORDER BY name ASC
    ");

    echo json_encode([
        "success" => true,
        "universities" => $query->fetchAll()
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load institutions."
    ]);
}