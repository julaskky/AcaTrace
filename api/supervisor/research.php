<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

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

require_once __DIR__ . "/../config/database.php";

$userId = $_SESSION["user_id"] ?? null;
$role = $_SESSION["role"] ?? $_SESSION["user_type"] ?? null;

if (!$userId || $role !== "supervisor") {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Please log in with a supervisor account."
    ]);
    exit;
}

try {
    // Resolve the supervisor profile from the authenticated user.
    $stmt = $pdo->prepare(
        "SELECT id FROM supervisors WHERE user_id = ? LIMIT 1"
    );
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Supervisor profile not found."
        ]);
        exit;
    }

    $supervisorId = (int) $supervisor["id"];

    $sql = "
        SELECT
            rp.id AS project_id,
            rp.title,
            rp.description,
            rp.research_area,
            rp.methodology,
            rp.status,
            rp.start_date,
            rp.expected_completion_date,
            rp.created_at,
            s.id AS student_id,
            s.student_number,
            s.programme,
            s.academic_level,
            u.first_name,
            u.last_name,
            u.email,
            d.name AS department_name,
            un.name AS university_name
        FROM research_projects rp
        INNER JOIN students s ON s.id = rp.student_id
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN universities un ON un.id = s.university_id
        WHERE rp.supervisor_id = ?
        ORDER BY rp.created_at DESC, rp.id DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$supervisorId]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "projects" => $projects,
        "total" => count($projects)
    ]);

} catch (Throwable $e) {
    error_log("Supervisor research API error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to load supervised research projects."
    ]);
}