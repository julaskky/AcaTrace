<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

require_once __DIR__ . "/config/database.php";

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "You are not authenticated."
    ]);
    exit;
}

if (!isset($_SESSION["role"]) || $_SESSION["role"] !== "admin") {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);
    exit;
}

try {

    /*
    |--------------------------------------------------------------------------
    | GET departments
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "GET") {

        $search = trim($_GET["search"] ?? "");
        $institutionId = (int) ($_GET["university_id"] ?? 0);

        $sql = "
            SELECT
                d.id,
                d.university_id,
                d.name,
                d.status,
                d.created_at,
                d.updated_at,
                u.name AS institution_name,
                u.country AS institution_country
            FROM departments d
            INNER JOIN universities u
                ON d.university_id = u.id
            WHERE 1 = 1
        ";

        $params = [];

        if ($institutionId > 0) {
            $sql .= " AND d.university_id = :university_id ";
            $params[":university_id"] = $institutionId;
        }

        if ($search !== "") {
            $sql .= "
                AND (
                    d.name LIKE :search
                    OR u.name LIKE :search
                )
            ";

            $params[":search"] = "%" . $search . "%";
        }

        $sql .= "
            ORDER BY u.name ASC, d.name ASC
        ";

        $query = $pdo->prepare($sql);
        $query->execute($params);

        echo json_encode([
            "success" => true,
            "departments" => $query->fetchAll()
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | POST - Add department
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "POST") {

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

        $universityId = (int) ($input["university_id"] ?? 0);
        $name = trim($input["name"] ?? "");

        if ($universityId <= 0 || $name === "") {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Institution and department name are required."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Verify institution
        |--------------------------------------------------------------------------
        */

        $institutionCheck = $pdo->prepare("
            SELECT id
            FROM universities
            WHERE id = :id
            AND status = 'active'
            LIMIT 1
        ");

        $institutionCheck->execute([
            ":id" => $universityId
        ]);

        if (!$institutionCheck->fetch()) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Selected institution does not exist or is inactive."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Duplicate department check
        |--------------------------------------------------------------------------
        */

        $duplicate = $pdo->prepare("
            SELECT id
            FROM departments
            WHERE university_id = :university_id
            AND name = :name
            LIMIT 1
        ");

        $duplicate->execute([
            ":university_id" => $universityId,
            ":name" => $name
        ]);

        if ($duplicate->fetch()) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "This department already exists in the selected institution."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Insert
        |--------------------------------------------------------------------------
        */

        $query = $pdo->prepare("
            INSERT INTO departments (
                university_id,
                name,
                status
            )
            VALUES (
                :university_id,
                :name,
                'active'
            )
        ");

        $query->execute([
            ":university_id" => $universityId,
            ":name" => $name
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Department added successfully.",
            "department_id" => $pdo->lastInsertId()
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | PUT - Update department
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "PUT") {

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

        $id = (int) ($input["id"] ?? 0);
        $universityId = (int) ($input["university_id"] ?? 0);
        $name = trim($input["name"] ?? "");
        $status = trim($input["status"] ?? "");

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Invalid department ID."
            ]);
            exit;
        }

        if ($universityId <= 0 || $name === "") {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Institution and department name are required."
            ]);
            exit;
        }

        if (!in_array($status, ["active", "inactive"], true)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Invalid department status."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Verify institution
        |--------------------------------------------------------------------------
        */

        $institutionCheck = $pdo->prepare("
            SELECT id
            FROM universities
            WHERE id = :id
            LIMIT 1
        ");

        $institutionCheck->execute([
            ":id" => $universityId
        ]);

        if (!$institutionCheck->fetch()) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Selected institution does not exist."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Duplicate check
        |--------------------------------------------------------------------------
        */

        $duplicate = $pdo->prepare("
            SELECT id
            FROM departments
            WHERE university_id = :university_id
            AND name = :name
            AND id != :id
            LIMIT 1
        ");

        $duplicate->execute([
            ":university_id" => $universityId,
            ":name" => $name,
            ":id" => $id
        ]);

        if ($duplicate->fetch()) {
            http_response_code(409);
            echo json_encode([
                "success" => false,
                "message" => "Another department with this name already exists in the selected institution."
            ]);
            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Update
        |--------------------------------------------------------------------------
        */

        $query = $pdo->prepare("
            UPDATE departments
            SET
                university_id = :university_id,
                name = :name,
                status = :status
            WHERE id = :id
        ");

        $query->execute([
            ":university_id" => $universityId,
            ":name" => $name,
            ":status" => $status,
            ":id" => $id
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Department updated successfully."
        ]);

        exit;
    }

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to process department request."
    ]);
}