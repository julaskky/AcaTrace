<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

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
        "authenticated" => false,
        "message" => "You are not authenticated."
    ]);

    exit;
}

try {

    $userId = (int) $_SESSION["user_id"];
    $role = $_SESSION["role"];

    /* ---------------------------------------------------------
       USER
    --------------------------------------------------------- */

    $query = $pdo->prepare("
        SELECT
            id,
            first_name,
            last_name,
            email,
            role,
            status
        FROM users
        WHERE id = :id
        LIMIT 1
    ");

    $query->execute([
        ":id" => $userId
    ]);

    $user = $query->fetch();

    if (!$user) {
        http_response_code(401);

        echo json_encode([
            "success" => false,
            "authenticated" => false,
            "message" => "User account not found."
        ]);

        exit;
    }

    /* ---------------------------------------------------------
       STUDENT INFORMATION
    --------------------------------------------------------- */

    $academicLevel = null;
    $studentNumber = null;
    $programme = null;
    $studentStatus = null;

    $studentId = null;
    $supervisorId = null;

    if ($role === "student") {

        $studentQuery = $pdo->prepare("
            SELECT
                id,
                academic_level,
                student_number,
                programme,
                status
            FROM students
            WHERE user_id = :user_id
            LIMIT 1
        ");

        $studentQuery->execute([
            ":user_id" => $userId
        ]);

        $student = $studentQuery->fetch();

        if ($student) {
            $studentId = (int) $student["id"];
            $academicLevel = $student["academic_level"];
            $studentNumber = $student["student_number"];
            $programme = $student["programme"];
            $studentStatus = $student["status"];
        }
    }

    /* ---------------------------------------------------------
       SUPERVISOR INFORMATION
    --------------------------------------------------------- */

    if ($role === "supervisor") {

        $supervisorQuery = $pdo->prepare("
            SELECT id
            FROM supervisors
            WHERE user_id = :user_id
            LIMIT 1
        ");

        $supervisorQuery->execute([
            ":user_id" => $userId
        ]);

        $supervisor = $supervisorQuery->fetch();

        if ($supervisor) {
            $supervisorId = (int) $supervisor["id"];
        }
    }

    /* ---------------------------------------------------------
       RESEARCH PROJECT STATISTICS
    --------------------------------------------------------- */

    $projects = 0;

    if ($role === "admin") {

        $stmt = $pdo->query("
            SELECT COUNT(*) 
            FROM research_projects
        ");

        $projects = (int) $stmt->fetchColumn();

    } elseif ($role === "student" && $studentId) {

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM research_projects
            WHERE student_id = ?
        ");

        $stmt->execute([$studentId]);

        $projects = (int) $stmt->fetchColumn();

    } elseif ($role === "supervisor" && $supervisorId) {

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM research_projects
            WHERE supervisor_id = ?
        ");

        $stmt->execute([$supervisorId]);

        $projects = (int) $stmt->fetchColumn();
    }

    /* ---------------------------------------------------------
       MILESTONE STATISTICS
    --------------------------------------------------------- */

    $milestones = 0;
    $completedMilestones = 0;

    if ($role === "admin") {

        $stmt = $pdo->query("
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Completed') AS completed
            FROM research_milestones
        ");

        $result = $stmt->fetch();

        $milestones = (int) ($result["total"] ?? 0);
        $completedMilestones = (int) ($result["completed"] ?? 0);

    } elseif ($role === "student" && $studentId) {

        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) AS total,
                SUM(rm.status = 'Completed') AS completed
            FROM research_milestones rm
            INNER JOIN research_projects rp
                ON rm.research_project_id = rp.id
            WHERE rp.student_id = ?
        ");

        $stmt->execute([$studentId]);

        $result = $stmt->fetch();

        $milestones = (int) ($result["total"] ?? 0);
        $completedMilestones = (int) ($result["completed"] ?? 0);

    } elseif ($role === "supervisor" && $supervisorId) {

        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) AS total,
                SUM(rm.status = 'Completed') AS completed
            FROM research_milestones rm
            INNER JOIN research_projects rp
                ON rm.research_project_id = rp.id
            WHERE rp.supervisor_id = ?
        ");

        $stmt->execute([$supervisorId]);

        $result = $stmt->fetch();

        $milestones = (int) ($result["total"] ?? 0);
        $completedMilestones = (int) ($result["completed"] ?? 0);
    }

    /* ---------------------------------------------------------
       RESPONSE
    --------------------------------------------------------- */

    echo json_encode([
        "success" => true,
        "authenticated" => true,

        "user" => [
            "id" => (int) $user["id"],
            "first_name" => $user["first_name"],
            "last_name" => $user["last_name"],
            "email" => $user["email"],
            "role" => $user["role"],
            "status" => $user["status"],
            "academic_level" => $academicLevel,
            "student_number" => $studentNumber,
            "programme" => $programme,
            "student_status" => $studentStatus
        ],

        "statistics" => [
            "projects" => $projects,
            "milestones" => $milestones,
            "completed_milestones" => $completedMilestones,
            "meetings" => 0,
            "pending_tasks" => 0
        ]
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load dashboard."
    ]);
}