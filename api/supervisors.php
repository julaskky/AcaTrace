<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

session_start();

require_once __DIR__ . "/config/database.php";



try {

    $stmt = $pdo->query("
        SELECT
            sp.id,
            sp.staff_number,
            sp.academic_title,
            sp.specialization,

            u.first_name,
            u.last_name,

            CONCAT(
                u.first_name,
                ' ',
                u.last_name
            ) AS full_name

        FROM supervisors sp

        INNER JOIN users u
            ON sp.user_id = u.id

        WHERE u.status = 'active'

        ORDER BY u.first_name, u.last_name
    ");

    $supervisors = $stmt->fetchAll();

    echo json_encode([
        "success" => true,
        "supervisors" => $supervisors
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load supervisors"
    ]);
}