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
    // Resolve the logged-in user's supervisor profile.
    $stmt = $pdo->prepare("
        SELECT id
        FROM supervisors
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "No supervisor profile is linked to this account."
        ]);
        exit;
    }

    $supervisorId = (int) $supervisor["id"];

    // Dashboard statistics.
    $stmt = $pdo->prepare("
        SELECT
            COUNT(DISTINCT rp.student_id) AS students,
            COUNT(DISTINCT rp.id) AS projects,

            (
                SELECT COUNT(*)
                FROM tasks t
                INNER JOIN research_projects p
                    ON p.id = t.research_project_id
                WHERE p.supervisor_id = ?
                  AND t.status NOT IN ('Completed', 'Complete', 'Cancelled')
            ) AS pending_tasks,

            (
                SELECT COUNT(*)
                FROM meetings m
                WHERE m.supervisor_id = ?
                  AND m.status = 'Scheduled'
                  AND m.meeting_date >= CURDATE()
            ) AS upcoming_meetings,

            (
                SELECT COUNT(*)
                FROM research_milestones rm
                INNER JOIN research_projects p
                    ON p.id = rm.research_project_id
                WHERE p.supervisor_id = ?
                  AND rm.status IN ('Pending', 'In Progress', 'Overdue')
            ) AS outstanding_milestones,

            (
                SELECT COUNT(*)
                FROM student_documents d
                INNER JOIN research_projects p
                    ON p.id = d.research_project_id
                WHERE p.supervisor_id = ?
                  AND d.status IN ('Pending Review', 'Under Review')
            ) AS documents_to_review

        FROM research_projects rp
        WHERE rp.supervisor_id = ?
    ");

    $stmt->execute([
        $supervisorId,
        $supervisorId,
        $supervisorId,
        $supervisorId,
        $supervisorId
    ]);

    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    // Assigned research projects and student information.
    $stmt = $pdo->prepare("
        SELECT
            rp.id,
            rp.title,
            rp.research_area,
            rp.status,
            rp.start_date,
            rp.expected_completion_date,
            rp.updated_at,
            s.id AS student_id,
            s.student_number,
            s.programme,
            s.academic_level,
            s.status AS student_status,
            u.first_name AS student_first_name,
            u.last_name AS student_last_name
        FROM research_projects rp
        INNER JOIN students s ON s.id = rp.student_id
        INNER JOIN users u ON u.id = s.user_id
        WHERE rp.supervisor_id = ?
        ORDER BY rp.updated_at DESC, rp.id DESC
        LIMIT 10
    ");

    $stmt->execute([$supervisorId]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Upcoming meetings.
    $stmt = $pdo->prepare("
        SELECT
            m.id,
            m.title,
            m.meeting_date,
            m.start_time,
            m.end_time,
            m.meeting_mode,
            m.status,
            m.response_status,
            m.meeting_location,
            m.meeting_link,
            rp.title AS research_title,
            u.first_name AS student_first_name,
            u.last_name AS student_last_name
        FROM meetings m
        INNER JOIN research_projects rp
            ON rp.id = m.research_project_id
        INNER JOIN students s ON s.id = m.student_id
        INNER JOIN users u ON u.id = s.user_id
        WHERE m.supervisor_id = ?
          AND m.status = 'Scheduled'
          AND m.meeting_date >= CURDATE()
        ORDER BY m.meeting_date ASC, m.start_time ASC
        LIMIT 5
    ");

    $stmt->execute([$supervisorId]);
    $meetings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Latest milestones across the supervisor's projects.
    $stmt = $pdo->prepare("
        SELECT
            rm.id,
            rm.title,
            rm.due_date,
            rm.status,
            rp.title AS research_title
        FROM research_milestones rm
        INNER JOIN research_projects rp
            ON rp.id = rm.research_project_id
        WHERE rp.supervisor_id = ?
        ORDER BY
            CASE WHEN rm.due_date IS NULL THEN 1 ELSE 0 END,
            rm.due_date ASC,
            rm.updated_at DESC
        LIMIT 5
    ");

    $stmt->execute([$supervisorId]);
    $milestones = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "stats" => [
            "students" => (int) $stats["students"],
            "projects" => (int) $stats["projects"],
            "pending_tasks" => (int) $stats["pending_tasks"],
            "upcoming_meetings" => (int) $stats["upcoming_meetings"],
            "outstanding_milestones" =>
                (int) $stats["outstanding_milestones"],
            "documents_to_review" =>
                (int) $stats["documents_to_review"]
        ],
        "projects" => $projects,
        "meetings" => $meetings,
        "milestones" => $milestones
    ]);

} catch (Throwable $e) {
    error_log("Supervisor dashboard error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to load the supervisor dashboard."
    ]);
}
