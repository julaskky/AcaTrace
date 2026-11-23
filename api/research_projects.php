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


$userId = $_SESSION["user_id"];
$role = $_SESSION["role"];

$method = $_SERVER["REQUEST_METHOD"];

try {

    /*
    |--------------------------------------------------------------------------
    | GET PROJECTS
    |--------------------------------------------------------------------------
    */

    if ($method === "GET") {

        if ($role === "student") {

            $stmt = $pdo->prepare("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,

                    s.id AS student_id,

                    CONCAT(
                        su.first_name,
                        ' ',
                        su.last_name
                    ) AS supervisor_name

                FROM research_projects rp

                INNER JOIN students s
                    ON rp.student_id = s.id

                LEFT JOIN supervisors sp
                    ON rp.supervisor_id = sp.id

                LEFT JOIN users su
                    ON sp.user_id = su.id

                WHERE s.user_id = ?

                ORDER BY rp.created_at DESC
            ");

            $stmt->execute([$userId]);

        } elseif ($role === "supervisor") {

            $stmt = $pdo->prepare("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,

                    CONCAT(
                        stu.first_name,
                        ' ',
                        stu.last_name
                    ) AS student_name,

                    CONCAT(
                        su.first_name,
                        ' ',
                        su.last_name
                    ) AS supervisor_name

                FROM research_projects rp

                INNER JOIN students st
                    ON rp.student_id = st.id

                INNER JOIN users stu
                    ON st.user_id = stu.id

                INNER JOIN supervisors sp
                    ON rp.supervisor_id = sp.id

                INNER JOIN users su
                    ON sp.user_id = su.id

                WHERE sp.user_id = ?

                ORDER BY rp.created_at DESC
            ");

            $stmt->execute([$userId]);

        } else {

            $stmt = $pdo->query("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,

                    CONCAT(
                        stu.first_name,
                        ' ',
                        stu.last_name
                    ) AS student_name,

                    CONCAT(
                        su.first_name,
                        ' ',
                        su.last_name
                    ) AS supervisor_name

                FROM research_projects rp

                INNER JOIN students st
                    ON rp.student_id = st.id

                INNER JOIN users stu
                    ON st.user_id = stu.id

                LEFT JOIN supervisors sp
                    ON rp.supervisor_id = sp.id

                LEFT JOIN users su
                    ON sp.user_id = su.id

                ORDER BY rp.created_at DESC
            ");
        }

        $projects = $stmt->fetchAll();

        echo json_encode([
            "success" => true,
            "projects" => $projects
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE PROJECT
    |--------------------------------------------------------------------------
    */

    if ($method === "POST") {

        if ($role !== "student" && $role !== "admin") {
            http_response_code(403);

            echo json_encode([
                "success" => false,
                "message" => "You do not have permission to create research projects"
            ]);

            exit;
        }

        $input = json_decode(file_get_contents("php://input"), true);

        $title = trim($input["title"] ?? "");
        $description = trim($input["description"] ?? "");
        $researchArea = trim($input["research_area"] ?? "");
        $methodology = trim($input["methodology"] ?? "");
        $status = trim($input["status"] ?? "Proposed");
        $startDate = $input["start_date"] ?? null;
        $expectedCompletionDate = $input["expected_completion_date"] ?? null;
        $supervisorId = !empty($input["supervisor_id"])
            ? (int)$input["supervisor_id"]
            : null;

        if ($title === "") {
            http_response_code(422);

            echo json_encode([
                "success" => false,
                "message" => "Research project title is required"
            ]);

            exit;
        }

        $allowedStatuses = [
            "Proposed",
            "Active",
            "Completed",
            "On Hold",
            "Cancelled"
        ];

        if (!in_array($status, $allowedStatuses, true)) {
            http_response_code(422);

            echo json_encode([
                "success" => false,
                "message" => "Invalid project status"
            ]);

            exit;
        }

        /*
        |--------------------------------------------------------------------------
        | Determine student
        |--------------------------------------------------------------------------
        */

        if ($role === "student") {

            $stmt = $pdo->prepare("
                SELECT id
                FROM students
                WHERE user_id = ?
                LIMIT 1
            ");

            $stmt->execute([$userId]);

            $student = $stmt->fetch();

            if (!$student) {
                http_response_code(422);

                echo json_encode([
                    "success" => false,
                    "message" => "Student profile not found"
                ]);

                exit;
            }

            $studentId = $student["id"];

        } else {

            $studentId = (int)($input["student_id"] ?? 0);

            if ($studentId <= 0) {
                http_response_code(422);

                echo json_encode([
                    "success" => false,
                    "message" => "Student is required"
                ]);

                exit;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Validate supervisor
        |--------------------------------------------------------------------------
        */

        if ($supervisorId !== null) {

            $stmt = $pdo->prepare("
                SELECT id
                FROM supervisors
                WHERE id = ?
                LIMIT 1
            ");

            $stmt->execute([$supervisorId]);

            if (!$stmt->fetch()) {
                http_response_code(422);

                echo json_encode([
                    "success" => false,
                    "message" => "Selected supervisor does not exist"
                ]);

                exit;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Insert
        |--------------------------------------------------------------------------
        */

        $stmt = $pdo->prepare("
            INSERT INTO research_projects (
                student_id,
                supervisor_id,
                title,
                description,
                research_area,
                methodology,
                status,
                start_date,
                expected_completion_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $studentId,
            $supervisorId,
            $title,
            $description ?: null,
            $researchArea ?: null,
            $methodology ?: null,
            $status,
            $startDate ?: null,
            $expectedCompletionDate ?: null
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Research project created successfully",
            "project_id" => $pdo->lastInsertId()
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE PROJECT
    |--------------------------------------------------------------------------
    */

    if ($method === "PUT") {

    $input = json_decode(file_get_contents("php://input"), true);

    $projectId = (int)($input["id"] ?? 0);

    if ($projectId <= 0) {
        http_response_code(422);

        echo json_encode([
            "success" => false,
            "message" => "Invalid project ID"
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | Get existing project
    |--------------------------------------------------------------------------
    */

    $stmt = $pdo->prepare("
        SELECT
            rp.*,
            st.user_id AS student_user_id,
            sp.user_id AS supervisor_user_id
        FROM research_projects rp
        INNER JOIN students st
            ON rp.student_id = st.id
        LEFT JOIN supervisors sp
            ON rp.supervisor_id = sp.id
        WHERE rp.id = ?
        LIMIT 1
    ");

    $stmt->execute([$projectId]);

    $existingProject = $stmt->fetch();

    if (!$existingProject) {
        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Research project not found"
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | Check permission
    |--------------------------------------------------------------------------
    */

    $allowed = false;

    if ($role === "admin") {
        $allowed = true;
    }

    if (
        $role === "student" &&
        (int)$existingProject["student_user_id"] === (int)$userId
    ) {
        $allowed = true;
    }

    if (
        $role === "supervisor" &&
        (int)$existingProject["supervisor_user_id"] === (int)$userId
    ) {
        $allowed = true;
    }

    if (!$allowed) {
        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "You do not have permission to update this project"
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | Supervisor assignment only
    |--------------------------------------------------------------------------
    */

    if (
        $role === "admin" &&
        array_key_exists("supervisor_id", $input) &&
        !array_key_exists("title", $input)
    ) {

        $supervisorId = !empty($input["supervisor_id"])
            ? (int)$input["supervisor_id"]
            : null;

        if ($supervisorId !== null) {

            $stmt = $pdo->prepare("
                SELECT id
                FROM supervisors
                WHERE id = ?
                LIMIT 1
            ");

            $stmt->execute([$supervisorId]);

            if (!$stmt->fetch()) {
                http_response_code(422);

                echo json_encode([
                    "success" => false,
                    "message" => "Invalid supervisor"
                ]);

                exit;
            }
        }

        $stmt = $pdo->prepare("
            UPDATE research_projects
            SET supervisor_id = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $supervisorId,
            $projectId
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Supervisor assigned successfully"
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | Normal project update
    |--------------------------------------------------------------------------
    */

    $title = trim($input["title"] ?? $existingProject["title"]);
    $description = trim(
        $input["description"] ?? ($existingProject["description"] ?? "")
    );
    $researchArea = trim(
        $input["research_area"] ?? ($existingProject["research_area"] ?? "")
    );
    $methodology = trim(
        $input["methodology"] ?? ($existingProject["methodology"] ?? "")
    );
    $status = trim(
        $input["status"] ?? $existingProject["status"]
    );

    $startDate = $input["start_date"]
        ?? $existingProject["start_date"];

    $expectedCompletionDate = $input["expected_completion_date"]
        ?? $existingProject["expected_completion_date"];

    $supervisorId = array_key_exists("supervisor_id", $input)
        ? (!empty($input["supervisor_id"])
            ? (int)$input["supervisor_id"]
            : null)
        : $existingProject["supervisor_id"];

    if ($title === "") {
        http_response_code(422);

        echo json_encode([
            "success" => false,
            "message" => "Research project title is required"
        ]);

        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE research_projects
        SET
            title = ?,
            description = ?,
            research_area = ?,
            methodology = ?,
            status = ?,
            start_date = ?,
            expected_completion_date = ?,
            supervisor_id = ?
        WHERE id = ?
    ");

    $stmt->execute([
        $title,
        $description ?: null,
        $researchArea ?: null,
        $methodology ?: null,
        $status,
        $startDate ?: null,
        $expectedCompletionDate ?: null,
        $supervisorId,
        $projectId
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Research project updated successfully"
    ]);

    exit;
}

    /*
    |--------------------------------------------------------------------------
    | DELETE PROJECT
    |--------------------------------------------------------------------------
    */

    if ($method === "DELETE") {

        $input = json_decode(file_get_contents("php://input"), true);

        $projectId = (int)($input["id"] ?? 0);

        if ($projectId <= 0) {
            http_response_code(422);

            echo json_encode([
                "success" => false,
                "message" => "Invalid project ID"
            ]);

            exit;
        }

        $stmt = $pdo->prepare("
            SELECT
                rp.id,
                st.user_id AS student_user_id
            FROM research_projects rp
            INNER JOIN students st
                ON rp.student_id = st.id
            WHERE rp.id = ?
            LIMIT 1
        ");

        $stmt->execute([$projectId]);

        $project = $stmt->fetch();

        if (!$project) {
            http_response_code(404);

            echo json_encode([
                "success" => false,
                "message" => "Research project not found"
            ]);

            exit;
        }

        if (
            $role !== "admin" &&
            !(
                $role === "student" &&
                (int)$project["student_user_id"] === (int)$userId
            )
        ) {
            http_response_code(403);

            echo json_encode([
                "success" => false,
                "message" => "You do not have permission to delete this project"
            ]);

            exit;
        }

        $stmt = $pdo->prepare("
            DELETE FROM research_projects
            WHERE id = ?
        ");

        $stmt->execute([$projectId]);

        echo json_encode([
            "success" => true,
            "message" => "Research project deleted successfully"
        ]);

        exit;
    }


    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server error"
    ]);
}