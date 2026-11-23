<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once __DIR__ . "/config/database.php";

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

try {

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        http_response_code(405);

        echo json_encode([
            "success" => false,
            "message" => "Method not allowed."
        ]);

        exit;
    }

    $input = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!$input) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid request data."
        ]);

        exit;
    }

    $email = trim($input["email"] ?? "");
    $password = $input["password"] ?? "";

    if ($email === "" || $password === "") {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Email and password are required."
        ]);

        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid email address."
        ]);

        exit;
    }

    $query = $pdo->prepare("
        SELECT
            id,
            first_name,
            last_name,
            email,
            password_hash,
            role,
            status
        FROM users
        WHERE email = :email
        LIMIT 1
    ");

    $query->execute([
        ":email" => $email
    ]);

    $user = $query->fetch();

    if (!$user) {
        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }

    if (!password_verify($password, $user["password_hash"])) {
        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }

    if ($user["status"] !== "active") {
        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Your account is not active. Please contact the administrator."
        ]);

        exit;
    }

    session_regenerate_id(true);

    $_SESSION["user_id"] = (int) $user["id"];
    $_SESSION["first_name"] = $user["first_name"];
    $_SESSION["last_name"] = $user["last_name"];
    $_SESSION["email"] = $user["email"];
    $_SESSION["role"] = $user["role"];

    unset($user["password_hash"]);

    http_response_code(200);

    echo json_encode([
        "success" => true,
        "message" => "Login successful.",
        "user" => [
            "id" => (int) $user["id"],
            "first_name" => $user["first_name"],
            "last_name" => $user["last_name"],
            "email" => $user["email"],
            "role" => $user["role"],
            "status" => $user["status"]
        ]
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Login failed. Please try again."
    ]);
}