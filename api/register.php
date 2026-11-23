<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle browser preflight request
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once __DIR__ . "/config/database.php";

try {

    // Only allow POST requests
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        http_response_code(405);

        echo json_encode([
            "success" => false,
            "message" => "Method not allowed."
        ]);

        exit;
    }

    // Get JSON request
    $input = json_decode(file_get_contents("php://input"), true);

    if (!$input) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid request data."
        ]);

        exit;
    }

    // Get form values
    $firstName = trim($input["first_name"] ?? "");
    $lastName = trim($input["last_name"] ?? "");
    $email = trim($input["email"] ?? "");
    $role = trim($input["role"] ?? "");
    $academicLevel = trim($input["academic_level"] ?? "");
    $password = $input["password"] ?? "";

    // Validate required fields
    if ($firstName === "" || $lastName === "" || $email === "" || $role === "" || $password === "") {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please complete all required fields."
        ]);

        exit;
    }

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid email address."
        ]);

        exit;
    }

    // Validate password
    if (strlen($password) < 8) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Password must be at least 8 characters."
        ]);

        exit;
    }

    // Validate role
    $allowedRoles = [
        "student",
        "supervisor",
        "admin"
    ];

    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid account type."
        ]);

        exit;
    }

    // Validate academic level for students
    $allowedAcademicLevels = [
        "Diploma",
        "Undergraduate",
        "Postgraduate"
    ];

    if ($role === "student") {

        if ($academicLevel === "") {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Please select your academic level."
            ]);

            exit;
        }

        if (!in_array($academicLevel, $allowedAcademicLevels, true)) {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Invalid academic level."
            ]);

            exit;
        }
    }

    // Check whether email already exists
    $checkEmail = $pdo->prepare(
        "SELECT id FROM users WHERE email = :email LIMIT 1"
    );

    $checkEmail->execute([
        ":email" => $email
    ]);

    if ($checkEmail->fetch()) {
        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" => "An account with this email already exists."
        ]);

        exit;
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Start database transaction
    $pdo->beginTransaction();

    // Create user
    $userQuery = $pdo->prepare("
        INSERT INTO users (
            first_name,
            last_name,
            email,
            password_hash,
            role,
            status
        )
        VALUES (
            :first_name,
            :last_name,
            :email,
            :password_hash,
            :role,
            'active'
        )
    ");

    $userQuery->execute([
        ":first_name" => $firstName,
        ":last_name" => $lastName,
        ":email" => $email,
        ":password_hash" => $passwordHash,
        ":role" => $role
    ]);

    $userId = $pdo->lastInsertId();

    // Create student profile
    if ($role === "student") {

        $studentQuery = $pdo->prepare("
            INSERT INTO students (
                user_id,
                academic_level,
                status
            )
            VALUES (
                :user_id,
                :academic_level,
                'active'
            )
        ");

        $studentQuery->execute([
            ":user_id" => $userId,
            ":academic_level" => $academicLevel
        ]);
    }

    // Commit transaction
    $pdo->commit();

    http_response_code(201);

    echo json_encode([
        "success" => true,
        "message" => "Account created successfully.",
        "user_id" => (int) $userId
    ]);

} catch (PDOException $e) {

    // Roll back if transaction is active
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Registration failed. Please try again."
    ]);

} catch (Exception $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "An unexpected error occurred."
    ]);
}