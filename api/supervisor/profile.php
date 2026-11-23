<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

session_start();
require_once __DIR__ . "/../config/database.php";

$userId = (int) ($_SESSION["user_id"] ?? 0);
$role = $_SESSION["role"] ?? $_SESSION["user_type"] ?? null;

if (!$userId || $role !== "supervisor") {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Please log in with a supervisor account."
    ]);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];

if (!in_array($method, ["GET", "PUT"], true)) {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

try {
    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.status AS account_status,

                s.id AS supervisor_id,
                s.staff_number,
                s.academic_title,
                s.specialization,
                s.phone,
                s.office,
                s.qualifications,
                s.research_interests,
                s.bio,
                s.university_id,
                s.department_id,

                un.name AS university_name,
                d.name AS department_name

            FROM users u
            INNER JOIN supervisors s ON s.user_id = u.id
            LEFT JOIN universities un ON un.id = s.university_id
            LEFT JOIN departments d ON d.id = s.department_id

            WHERE u.id = ?
            LIMIT 1
        ");

        $stmt->execute([$userId]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "message" => "Supervisor profile not found."
            ]);
            exit;
        }

        echo json_encode([
            "success" => true,
            "profile" => $profile
        ]);
        exit;
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid request data."
        ]);
        exit;
    }

    $firstName = trim($input["first_name"] ?? "");
    $lastName = trim($input["last_name"] ?? "");
    $email = trim($input["email"] ?? "");

    if ($firstName === "" || $lastName === "" || $email === "") {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "First name, last name and email are required."
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

    $stmt = $pdo->prepare("
        SELECT id FROM users
        WHERE email = ? AND id != ?
        LIMIT 1
    ");
    $stmt->execute([$email, $userId]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "This email address is already in use."
        ]);
        exit;
    }

    $allowedFields = [
        "staff_number",
        "academic_title",
        "specialization",
        "phone",
        "office",
        "qualifications",
        "research_interests",
        "bio"
    ];

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        UPDATE users
        SET first_name = ?, last_name = ?, email = ?
        WHERE id = ?
    ");
    $stmt->execute([$firstName, $lastName, $email, $userId]);

    $updates = [];
    $values = [];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $updates[] = "`$field` = ?";
            $values[] = trim((string) ($input[$field] ?? ""));
            if ($values[count($values) - 1] === "") {
                $values[count($values) - 1] = null;
            }
        }
    }

    // Validate university and department IDs before updating.
    $stmt = $pdo->prepare("
        SELECT id FROM supervisors WHERE user_id = ? LIMIT 1
    ");
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        throw new RuntimeException("Supervisor profile not found.");
    }

    $supervisorId = (int) $supervisor["id"];

    foreach (["university_id" => "universities",
              "department_id" => "departments"] as $field => $table) {
        if (array_key_exists($field, $input)) {
            $value = $input[$field] !== "" && $input[$field] !== null
                ? (int) $input[$field]
                : null;

            if ($value !== null) {
                $check = $pdo->prepare("SELECT id FROM `$table` WHERE id = ? LIMIT 1");
                $check->execute([$value]);

                if (!$check->fetch()) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid " . str_replace("_", " ", $field) . "."
                    ]);
                    exit;
                }
            }

            $updates[] = "`$field` = ?";
            $values[] = $value;
        }
    }

    if ($updates) {
        $values[] = $supervisorId;

        $stmt = $pdo->prepare("
            UPDATE supervisors
            SET " . implode(", ", $updates) . "
            WHERE id = ?
        ");
        $stmt->execute($values);
    }

    $pdo->commit();

    $_SESSION["first_name"] = $firstName;
    $_SESSION["last_name"] = $lastName;
    $_SESSION["email"] = $email;

    echo json_encode([
        "success" => true,
        "message" => "Supervisor profile updated successfully."
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor profile error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to process the supervisor profile."
    ]);
}
