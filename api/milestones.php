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

$userId = (int) $_SESSION["user_id"];
$method = $_SERVER["REQUEST_METHOD"];


/*
|--------------------------------------------------------------------------
| GET MILESTONES
|--------------------------------------------------------------------------
*/

if ($method === "GET") {

    try {

        $sql = "
            SELECT
                m.id,
                m.research_project_id,
                m.title,
                m.description,
                m.due_date,
                m.status,
                m.completed_at,
                m.created_at,
                m.updated_at,
                rp.title AS project_title
            FROM research_milestones m
            INNER JOIN research_projects rp
                ON m.research_project_id = rp.id
            WHERE
                EXISTS (
                    SELECT 1
                    FROM students s
                    WHERE s.id = rp.student_id
                    AND s.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM supervisors sp
                    WHERE sp.id = rp.supervisor_id
                    AND sp.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM users u
                    WHERE u.id = ?
                    AND u.role = 'admin'
                )
            ORDER BY
                m.due_date IS NULL,
                m.due_date ASC,
                m.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$userId, $userId, $userId]);

        echo json_encode([
            "success" => true,
            "milestones" => $stmt->fetchAll()
        ]);

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to load milestones"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| POST - CREATE MILESTONE
|--------------------------------------------------------------------------
*/

if ($method === "POST") {

    $input = json_decode(file_get_contents("php://input"), true);

    $projectId = isset($input["research_project_id"])
        ? (int) $input["research_project_id"]
        : 0;

    $title = trim($input["title"] ?? "");
    $description = trim($input["description"] ?? "");
    $dueDate = $input["due_date"] ?? null;

    if (!$projectId || !$title) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Research project and milestone title are required"
        ]);

        exit;
    }

    try {

        // Only supervisors and administrators can create milestones
        $roleStmt = $pdo->prepare("
            SELECT role
            FROM users
            WHERE id = ?
        ");

        $roleStmt->execute([$userId]);
        $user = $roleStmt->fetch();

        if (!$user || !in_array($user["role"], ["supervisor", "admin"])) {

            http_response_code(403);

            echo json_encode([
                "success" => false,
                "message" => "You do not have permission to create milestones"
            ]);

            exit;
        }


        // Verify project access
        if ($user["role"] === "supervisor") {

            $check = $pdo->prepare("
                SELECT id
                FROM research_projects rp
                WHERE rp.id = ?
                AND EXISTS (
                    SELECT 1
                    FROM supervisors sp
                    WHERE sp.id = rp.supervisor_id
                    AND sp.user_id = ?
                )
            ");

            $check->execute([$projectId, $userId]);

        } else {

            $check = $pdo->prepare("
                SELECT id
                FROM research_projects
                WHERE id = ?
            ");

            $check->execute([$projectId]);
        }

        if (!$check->fetch()) {

            http_response_code(403);

            echo json_encode([
                "success" => false,
                "message" => "You do not have access to this research project"
            ]);

            exit;
        }


        $stmt = $pdo->prepare("
            INSERT INTO research_milestones
            (
                research_project_id,
                title,
                description,
                due_date
            )
            VALUES (?, ?, ?, ?)
        ");

        $stmt->execute([
            $projectId,
            $title,
            $description ?: null,
            $dueDate ?: null
        ]);

        echo json_encode([
            "success" => true,
            "message" => "Milestone created successfully",
            "id" => $pdo->lastInsertId()
        ]);

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to create milestone"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| PUT - UPDATE MILESTONE
|--------------------------------------------------------------------------
*/

if ($method === "PUT") {

    $input = json_decode(file_get_contents("php://input"), true);

    $id = isset($input["id"]) ? (int) $input["id"] : 0;

    if (!$id) {
        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Milestone ID is required"
        ]);

        exit;
    }

    try {

        $roleStmt = $pdo->prepare("
            SELECT role
            FROM users
            WHERE id = ?
        ");

        $roleStmt->execute([$userId]);
        $user = $roleStmt->fetch();

        if (!$user) {
            throw new Exception("User not found");
        }


        // Student can only update status
        if ($user["role"] === "student") {

            $status = $input["status"] ?? "Pending";

            if (!in_array(
                $status,
                ["Pending", "In Progress", "Completed"]
            )) {
                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "message" => "Invalid milestone status"
                ]);

                exit;
            }

            $check = $pdo->prepare("
                SELECT m.id
                FROM research_milestones m
                INNER JOIN research_projects rp
                    ON m.research_project_id = rp.id
                INNER JOIN students s
                    ON rp.student_id = s.id
                WHERE m.id = ?
                AND s.user_id = ?
            ");

            $check->execute([$id, $userId]);

            if (!$check->fetch()) {
                http_response_code(403);

                echo json_encode([
                    "success" => false,
                    "message" => "You do not have access to this milestone"
                ]);

                exit;
            }

            $completedAt = $status === "Completed"
                ? date("Y-m-d H:i:s")
                : null;

            $stmt = $pdo->prepare("
                UPDATE research_milestones
                SET status = ?, completed_at = ?
                WHERE id = ?
            ");

            $stmt->execute([
                $status,
                $completedAt,
                $id
            ]);

        } else {

            // Supervisor/Admin
            $title = trim($input["title"] ?? "");
            $description = trim($input["description"] ?? "");
            $dueDate = $input["due_date"] ?? null;
            $status = $input["status"] ?? "Pending";

            if (!$title) {
                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "message" => "Milestone title is required"
                ]);

                exit;
            }

            if ($user["role"] === "supervisor") {

                $check = $pdo->prepare("
                    SELECT m.id
                    FROM research_milestones m
                    INNER JOIN research_projects rp
                        ON m.research_project_id = rp.id
                    INNER JOIN supervisors sp
                        ON rp.supervisor_id = sp.id
                    WHERE m.id = ?
                    AND sp.user_id = ?
                ");

                $check->execute([$id, $userId]);

            } else {

                $check = $pdo->prepare("
                    SELECT id
                    FROM research_milestones
                    WHERE id = ?
                ");

                $check->execute([$id]);
            }

            if (!$check->fetch()) {

                http_response_code(403);

                echo json_encode([
                    "success" => false,
                    "message" => "You do not have access to this milestone"
                ]);

                exit;
            }

            $completedAt = $status === "Completed"
                ? date("Y-m-d H:i:s")
                : null;

            $stmt = $pdo->prepare("
                UPDATE research_milestones
                SET
                    title = ?,
                    description = ?,
                    due_date = ?,
                    status = ?,
                    completed_at = ?
                WHERE id = ?
            ");

            $stmt->execute([
                $title,
                $description ?: null,
                $dueDate ?: null,
                $status,
                $completedAt,
                $id
            ]);
        }

        echo json_encode([
            "success" => true,
            "message" => "Milestone updated successfully"
        ]);

    } catch (Exception $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to update milestone"
        ]);
    }

    exit;
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

if ($method === "DELETE") {

    $input = json_decode(file_get_contents("php://input"), true);

    $id = isset($input["id"]) ? (int) $input["id"] : 0;

    try {

        $stmt = $pdo->prepare("
            SELECT u.role
            FROM users u
            WHERE u.id = ?
        ");

        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !in_array($user["role"], ["supervisor", "admin"])) {

            http_response_code(403);

            echo json_encode([
                "success" => false,
                "message" => "You do not have permission to delete milestones"
            ]);

            exit;
        }

        if ($user["role"] === "supervisor") {

            $check = $pdo->prepare("
                SELECT m.id
                FROM research_milestones m
                INNER JOIN research_projects rp
                    ON m.research_project_id = rp.id
                INNER JOIN supervisors sp
                    ON rp.supervisor_id = sp.id
                WHERE m.id = ?
                AND sp.user_id = ?
            ");

            $check->execute([$id, $userId]);

            if (!$check->fetch()) {

                http_response_code(403);

                echo json_encode([
                    "success" => false,
                    "message" => "You do not have access to this milestone"
                ]);

                exit;
            }
        }

        $delete = $pdo->prepare("
            DELETE FROM research_milestones
            WHERE id = ?
        ");

        $delete->execute([$id]);

        echo json_encode([
            "success" => true,
            "message" => "Milestone deleted successfully"
        ]);

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Unable to delete milestone"
        ]);
    }

    exit;
}


http_response_code(405);

echo json_encode([
    "success" => false,
    "message" => "Method not allowed"
]);