<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

if (!isset($_SESSION["user_id"])) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "message" => "Not authenticated."
    ]);

    exit;
}

echo json_encode([
    "success" => true,
    "authenticated" => true,
    "user" => [
        "id" => $_SESSION["user_id"],
        "first_name" => $_SESSION["first_name"],
        "last_name" => $_SESSION["last_name"],
        "email" => $_SESSION["email"],
        "role" => $_SESSION["role"]
    ]
]);