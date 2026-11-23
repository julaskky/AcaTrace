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

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Authentication required"
    ]);
    exit;
}

$adminId = (int) $_SESSION["user_id"];

$roleStmt = $pdo->prepare("
    SELECT role
    FROM users
    WHERE id = ?
");

$roleStmt->execute([$adminId]);
$currentUser = $roleStmt->fetch();

if (!$currentUser || $currentUser["role"] !== "admin") {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Administrator access required"
    ]);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
*/

if ($method === "GET") {

    $action = $_GET["action"] ?? "list";

    try {

        /*
        |--------------------------------------------------------------------------
        | GET SUPERVISORS
        |--------------------------------------------------------------------------
        */

        if ($action === "list") {

            $stmt = $pdo->query("
                SELECT
                    sp.id,
                    sp.user_id,
                    sp.university_id,
                    sp.department_id,
                    sp.staff_number,
                    sp.academic_title,
                    sp.specialization,

                    u.first_name,
                    u.last_name,
                    u.email,
                    u.status AS user_status,

                    un.name AS institution_name,
                    un.country,

                    d.name AS department_name,

                    (
                        SELECT COUNT(*)
                        FROM research_projects rp
                        WHERE rp.supervisor_id = sp.id
                    ) AS project_count

                FROM supervisors sp

                INNER JOIN users u
                    ON sp.user_id = u.id

                LEFT JOIN universities un
                    ON sp.university_id = un.id

                LEFT JOIN departments d
                    ON sp.department_id = d.id

                ORDER BY u.first_name, u.last_name
            ");

            echo json_encode([
                "success" => true,
                "supervisors" => $stmt->fetchAll()
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | GET INSTITUTIONS
        |--------------------------------------------------------------------------
        */

        if ($action === "institutions") {

            $stmt = $pdo->query("
                SELECT id, name, country
                FROM universities
                WHERE status = 'active'
                ORDER BY name
            ");

            echo json_encode([
                "success" => true,
                "institutions" => $stmt->fetchAll()
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | GET DEPARTMENTS
        |--------------------------------------------------------------------------
        */

        if ($action === "departments") {

            $universityId = (int) ($_GET["university_id"] ?? 0);

            if (!$universityId) {
                echo json_encode([
                    "success" => true,
                    "departments" => []
                ]);
                exit;
            }

            $stmt = $pdo->prepare("
                SELECT id, name
                FROM departments
                WHERE university_id = ?
                AND status = 'active'
                ORDER BY name
            ");

            $stmt->execute([$universityId]);

            echo json_encode([
                "success" => true,
                "departments" => $stmt->fetchAll()
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | GET PROJECTS
        |--------------------------------------------------------------------------
        */

        if ($action === "projects") {

            $stmt = $pdo->query("
                SELECT
                    rp.id,
                    rp.title,
                    rp.status,

                    s.id AS student_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS student_name,

                    rp.supervisor_id

                FROM research_projects rp

                INNER JOIN students s
                    ON rp.student_id = s.id

                INNER JOIN users u
                    ON s.user_id = u.id

                ORDER BY rp.created_at DESC
            ");

            echo json_encode([
                "success" => true,
                "projects" => $stmt->fetchAll()
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | GET SUPERVISOR DETAILS
        |--------------------------------------------------------------------------
        */

        if ($action === "details") {

            $id = (int) ($_GET["id"] ?? 0);

            $stmt = $pdo->prepare("
                SELECT
                    sp.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.status AS user_status,
                    un.name AS institution_name,
                    d.name AS department_name
                FROM supervisors sp
                INNER JOIN users u
                    ON sp.user_id = u.id
                LEFT JOIN universities un
                    ON sp.university_id = un.id
                LEFT JOIN departments d
                    ON sp.department_id = d.id
                WHERE sp.id = ?
            ");

            $stmt->execute([$id]);

            echo json_encode([
                "success" => true,
                "supervisor" => $stmt->fetch()
            ]);

            exit;
        }

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to load supervisor information"
        ]);

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| POST — CREATE SUPERVISOR
|--------------------------------------------------------------------------
*/

if ($method === "POST") {

    $input = json_decode(file_get_contents("php://input"), true);

    $firstName = trim($input["first_name"] ?? "");
    $lastName = trim($input["last_name"] ?? "");
    $email = trim($input["email"] ?? "");
    $password = $input["password"] ?? "";

    $universityId = !empty($input["university_id"])
        ? (int) $input["university_id"]
        : null;

    $departmentId = !empty($input["department_id"])
        ? (int) $input["department_id"]
        : null;

    $staffNumber = trim($input["staff_number"] ?? "");
    $academicTitle = trim($input["academic_title"] ?? "");
    $specialization = trim($input["specialization"] ?? "");

    if (!$firstName || !$lastName || !$email || !$password) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "First name, last name, email and password are required"
        ]);

        exit;
    }

    try {

        $pdo->beginTransaction();

        /*
        |--------------------------------------------------------------------------
        | Check Email
        |--------------------------------------------------------------------------
        */

        $checkEmail = $pdo->prepare("
            SELECT id
            FROM users
            WHERE email = ?
        ");

        $checkEmail->execute([$email]);

        if ($checkEmail->fetch()) {

            $pdo->rollBack();

            http_response_code(409);

            echo json_encode([
                "success" => false,
                "message" => "A user with this email already exists"
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | Validate Department
        |--------------------------------------------------------------------------
        */

        if ($departmentId && $universityId) {

            $departmentCheck = $pdo->prepare("
                SELECT id
                FROM departments
                WHERE id = ?
                AND university_id = ?
            ");

            $departmentCheck->execute([
                $departmentId,
                $universityId
            ]);

            if (!$departmentCheck->fetch()) {

                $pdo->rollBack();

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "message" => "Selected department does not belong to the selected institution"
                ]);

                exit;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Create User
        |--------------------------------------------------------------------------
        */

        $passwordHash = password_hash(
            $password,
            PASSWORD_DEFAULT
        );

        $userStmt = $pdo->prepare("
            INSERT INTO users
            (
                first_name,
                last_name,
                email,
                password_hash,
                role,
                status
            )
            VALUES (?, ?, ?, ?, 'supervisor', 'active')
        ");

        $userStmt->execute([
            $firstName,
            $lastName,
            $email,
            $passwordHash
        ]);

        $userId = $pdo->lastInsertId();


        /*
        |--------------------------------------------------------------------------
        | Create Supervisor Profile
        |--------------------------------------------------------------------------
        */

        $supervisorStmt = $pdo->prepare("
            INSERT INTO supervisors
            (
                user_id,
                university_id,
                department_id,
                staff_number,
                academic_title,
                specialization
            )
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $supervisorStmt->execute([
            $userId,
            $universityId,
            $departmentId,
            $staffNumber ?: null,
            $academicTitle ?: null,
            $specialization ?: null
        ]);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Supervisor created successfully"
        ]);

    } catch (PDOException $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to create supervisor"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| PUT — UPDATE SUPERVISOR
|--------------------------------------------------------------------------
*/

if ($method === "PUT") {

    $input = json_decode(file_get_contents("php://input"), true);

    $supervisorId = (int) ($input["id"] ?? 0);

    if (!$supervisorId) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Supervisor ID is required"
        ]);

        exit;
    }

    try {

        $stmt = $pdo->prepare("
            SELECT user_id
            FROM supervisors
            WHERE id = ?
        ");

        $stmt->execute([$supervisorId]);

        $supervisor = $stmt->fetch();

        if (!$supervisor) {
            http_response_code(404);

            echo json_encode([
                "success" => false,
                "message" => "Supervisor not found"
            ]);

            exit;
        }

        $firstName = trim($input["first_name"] ?? "");
        $lastName = trim($input["last_name"] ?? "");
        $email = trim($input["email"] ?? "");

        $universityId = !empty($input["university_id"])
            ? (int) $input["university_id"]
            : null;

        $departmentId = !empty($input["department_id"])
            ? (int) $input["department_id"]
            : null;

        $staffNumber = trim($input["staff_number"] ?? "");
        $academicTitle = trim($input["academic_title"] ?? "");
        $specialization = trim($input["specialization"] ?? "");
        $status = $input["status"] ?? "active";


        if (!$firstName || !$lastName || !$email) {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "First name, last name and email are required"
            ]);

            exit;
        }


        $pdo->beginTransaction();


        $userStmt = $pdo->prepare("
            UPDATE users
            SET
                first_name = ?,
                last_name = ?,
                email = ?,
                status = ?
            WHERE id = ?
        ");

        $userStmt->execute([
            $firstName,
            $lastName,
            $email,
            $status,
            $supervisor["user_id"]
        ]);


        $supervisorStmt = $pdo->prepare("
            UPDATE supervisors
            SET
                university_id = ?,
                department_id = ?,
                staff_number = ?,
                academic_title = ?,
                specialization = ?
            WHERE id = ?
        ");

        $supervisorStmt->execute([
            $universityId,
            $departmentId,
            $staffNumber ?: null,
            $academicTitle ?: null,
            $specialization ?: null,
            $supervisorId
        ]);


        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Supervisor updated successfully"
        ]);

    } catch (PDOException $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to update supervisor"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| DELETE — REMOVE SUPERVISOR
|--------------------------------------------------------------------------
*/

if ($method === "DELETE") {

    $input = json_decode(file_get_contents("php://input"), true);

    $supervisorId = (int) ($input["id"] ?? 0);

    try {

        $stmt = $pdo->prepare("
            SELECT user_id
            FROM supervisors
            WHERE id = ?
        ");

        $stmt->execute([$supervisorId]);

        $supervisor = $stmt->fetch();

        if (!$supervisor) {
            http_response_code(404);

            echo json_encode([
                "success" => false,
                "message" => "Supervisor not found"
            ]);

            exit;
        }


        /*
         * Do not delete the user.
         * Simply deactivate the account.
         */

        $update = $pdo->prepare("
            UPDATE users
            SET status = 'inactive'
            WHERE id = ?
        ");

        $update->execute([
            $supervisor["user_id"]
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Supervisor deactivated successfully"
        ]);

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to deactivate supervisor"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| Unsupported Method
|--------------------------------------------------------------------------
*/

http_response_code(405);

echo json_encode([
    "success" => false,
    "message" => "Method not allowed"
]);