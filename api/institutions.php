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

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (!isset($_SESSION["user_id"])) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You are not authenticated."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| Administrator authorization
|--------------------------------------------------------------------------
*/

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
    | GET - List institutions
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "GET") {

        $search = trim($_GET["search"] ?? "");

        if ($search !== "") {

            $query = $pdo->prepare("
                SELECT
                    id,
                    name,
                    country,
                    website,
                    status,
                    created_at,
                    updated_at
                FROM universities
                WHERE name LIKE :search
                   OR country LIKE :search
                ORDER BY name ASC
            ");

            $query->execute([
                ":search" => "%" . $search . "%"
            ]);

        } else {

            $query = $pdo->query("
                SELECT
                    id,
                    name,
                    country,
                    website,
                    status,
                    created_at,
                    updated_at
                FROM universities
                ORDER BY name ASC
            ");
        }

        $institutions = $query->fetchAll();

        echo json_encode([
            "success" => true,
            "institutions" => $institutions
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | POST - Create institution
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

        $name = trim($input["name"] ?? "");
        $country = trim($input["country"] ?? "");
        $website = trim($input["website"] ?? "");

        if ($name === "" || $country === "") {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Institution name and country are required."
            ]);

            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Check duplicate institution
        |--------------------------------------------------------------------------
        */

        $duplicate = $pdo->prepare("
            SELECT id
            FROM universities
            WHERE name = :name
            LIMIT 1
        ");

        $duplicate->execute([
            ":name" => $name
        ]);

        if ($duplicate->fetch()) {

            http_response_code(409);

            echo json_encode([
                "success" => false,
                "message" => "This institution already exists."
            ]);

            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Insert
        |--------------------------------------------------------------------------
        */

        $query = $pdo->prepare("
            INSERT INTO universities (
                name,
                country,
                website,
                status
            )
            VALUES (
                :name,
                :country,
                :website,
                'active'
            )
        ");

        $query->execute([
            ":name" => $name,
            ":country" => $country,
            ":website" => $website !== "" ? $website : null
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Institution added successfully.",
            "institution_id" => $pdo->lastInsertId()
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | PUT - Update institution
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
        $name = trim($input["name"] ?? "");
        $country = trim($input["country"] ?? "");
        $website = trim($input["website"] ?? "");
        $status = trim($input["status"] ?? "");

        if ($id <= 0) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Invalid institution ID."
            ]);

            exit;
        }

        if ($name === "" || $country === "") {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Institution name and country are required."
            ]);

            exit;
        }

        if (!in_array($status, ["active", "inactive"], true)) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Invalid institution status."
            ]);

            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Check duplicate name
        |--------------------------------------------------------------------------
        */

        $duplicate = $pdo->prepare("
            SELECT id
            FROM universities
            WHERE name = :name
            AND id != :id
            LIMIT 1
        ");

        $duplicate->execute([
            ":name" => $name,
            ":id" => $id
        ]);

        if ($duplicate->fetch()) {

            http_response_code(409);

            echo json_encode([
                "success" => false,
                "message" => "Another institution already has this name."
            ]);

            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Update
        |--------------------------------------------------------------------------
        */

        $query = $pdo->prepare("
            UPDATE universities
            SET
                name = :name,
                country = :country,
                website = :website,
                status = :status
            WHERE id = :id
        ");

        $query->execute([
            ":name" => $name,
            ":country" => $country,
            ":website" => $website !== "" ? $website : null,
            ":status" => $status,
            ":id" => $id
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Institution updated successfully."
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | Unsupported method
    |--------------------------------------------------------------------------
    */

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to process institution request."
    ]);
}