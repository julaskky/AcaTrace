
<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET, OPTIONS");

    respond(405, [
        "success" => false,
        "message" => "This endpoint is read-only."
    ]);
}

session_start();

require_once __DIR__ . "/../config/database.php";

if (empty($_SESSION["user_id"])) {
    respond(401, [
        "success" => false,
        "message" => "Authentication required. Please log in."
    ]);
}

$userId = (int) $_SESSION["user_id"];

try {
    // Confirm that the authenticated account is a student.
    $userStmt = $pdo->prepare("
        SELECT role
        FROM users
        WHERE id = ?
        LIMIT 1
    ");

    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        respond(401, [
            "success" => false,
            "message" => "Your account could not be verified."
        ]);
    }

    if (strtolower((string) $user["role"]) !== "student") {
        respond(403, [
            "success" => false,
            "message" => "This endpoint is available to student accounts only."
        ]);
    }

    // Return only milestones belonging to the logged-in student's projects.
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
        FROM research_milestones AS m
        INNER JOIN research_projects AS rp
            ON rp.id = m.research_project_id
        INNER JOIN students AS s
            ON s.id = rp.student_id
        WHERE s.user_id = ?
        ORDER BY
            m.due_date IS NULL ASC,
            m.due_date ASC,
            m.id DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId]);

    $milestones = $stmt->fetchAll(PDO::FETCH_ASSOC);

    respond(200, [
        "success" => true,
        "milestones" => $milestones
    ]);

} catch (Throwable $e) {
    error_log("Student milestones error: " . $e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "Unable to load milestones. Please try again later."
    ]);
}
