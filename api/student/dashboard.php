
<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

require_once __DIR__ . "/../config/database.php";

// Require authentication.
if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "message" => "Please log in to continue."
    ]);
    exit;
}

// Allow students only.
if ($_SESSION["role"] !== "student") {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Student access only."
    ]);
    exit;
}

try {
    $userId = (int) $_SESSION["user_id"];

    // Load the authenticated student account.
    $query = $pdo->prepare("
        SELECT id, first_name, last_name, email, role, status
        FROM users
        WHERE id = :id
        LIMIT 1
    ");

    $query->execute([":id" => $userId]);
    $user = $query->fetch(PDO::FETCH_ASSOC);

    if (!$user || $user["role"] !== "student" ||
        $user["status"] !== "active") {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "authenticated" => false,
            "message" => "Your account is unavailable."
        ]);
        exit;
    }

    // Load the student's academic information.
    $studentQuery = $pdo->prepare("
        SELECT id, academic_level, student_number, programme, status
        FROM students
        WHERE user_id = :user_id
        LIMIT 1
    ");

    $studentQuery->execute([":user_id" => $userId]);
    $student = $studentQuery->fetch(PDO::FETCH_ASSOC);

    if (!$student) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Student profile not found."
        ]);
        exit;
    }

    $studentId = (int) $student["id"];

    // Count the student's research projects.
    $projectQuery = $pdo->prepare("
        SELECT COUNT(*)
        FROM research_projects
        WHERE student_id = :student_id
    ");

    $projectQuery->execute([":student_id" => $studentId]);
    $projects = (int) $projectQuery->fetchColumn();

    // Count the student's milestones and completed milestones.
    $milestoneQuery = $pdo->prepare("
        SELECT
            COUNT(*) AS total,
            COALESCE(SUM(rm.status = 'Completed'), 0) AS completed
        FROM research_milestones rm
        INNER JOIN research_projects rp
            ON rm.research_project_id = rp.id
        WHERE rp.student_id = :student_id
    ");

    $milestoneQuery->execute([":student_id" => $studentId]);
    $milestoneResult = $milestoneQuery->fetch(PDO::FETCH_ASSOC);

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
            "academic_level" => $student["academic_level"],
            "student_number" => $student["student_number"],
            "programme" => $student["programme"],
            "student_status" => $student["status"]
        ],

        "statistics" => [
            "projects" => $projects,
            "milestones" => (int) $milestoneResult["total"],
            "completed_milestones" =>
                (int) $milestoneResult["completed"],
            "meetings" => 0,
            "pending_tasks" => 0
        ]
    ]);

} catch (PDOException $e) {
    error_log("Student dashboard error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to load the student dashboard."
    ]);
}