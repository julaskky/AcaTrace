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

$universityId = isset($_GET["university_id"])
    ? (int) $_GET["university_id"]
    : 0;

if ($universityId <= 0) {
    echo json_encode([
        "success" => true,
        "departments" => []
    ]);

    exit;
}

try {

    $query = $pdo->prepare("
        SELECT id, name
        FROM departments
        WHERE university_id = :university_id
        AND status = 'active'
        ORDER BY name ASC
    ");

    $query->execute([
        ":university_id" => $universityId
    ]);

    echo json_encode([
        "success" => true,
        "departments" => $query->fetchAll()
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load departments."
    ]);
}