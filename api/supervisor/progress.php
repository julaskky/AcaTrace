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

require_once __DIR__ . "/../config/database.php";

function respond($success, $message, $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

try {
    if (!isset($_SESSION["user_id"])) {
        respond(false, "Please log in to continue.", [], 401);
    }

    $role = $_SESSION["role"] ?? $_SESSION["user_type"] ?? "";
    if ($role !== "supervisor") {
        respond(false, "Supervisor access is required.", [], 403);
    }

    $userId = (int) $_SESSION["user_id"];

    $stmt = $pdo->prepare(
        "SELECT id FROM supervisors WHERE user_id = ? LIMIT 1"
    );
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        respond(false, "Supervisor profile was not found.", [], 404);
    }

    $supervisorId = (int) $supervisor["id"];

    /*
     * Only research projects assigned to the logged-in supervisor
     * are included.
     */
    $stmt = $pdo->prepare("
        SELECT
            rp.id AS project_id,
            rp.title AS project_title,
            rp.status AS project_status,
            rp.start_date,
            rp.expected_completion_date,
            s.id AS student_id,
            s.student_number,
            s.programme,
            s.academic_level,
            s.status AS student_status,
            u.first_name,
            u.last_name,
            u.email
        FROM research_projects rp
        INNER JOIN students s ON s.id = rp.student_id
        INNER JOIN users u ON u.id = s.user_id
        WHERE rp.supervisor_id = ?
        ORDER BY u.last_name ASC, u.first_name ASC, rp.title ASC
    ");
    $stmt->execute([$supervisorId]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $students = [];
    $summary = [
        "total_students" => 0,
        "active_projects" => 0,
        "average_progress" => 0,
        "overdue_items" => 0,
        "pending_reviews" => 0,
        "completed_projects" => 0
    ];

    foreach ($projects as $project) {
        $projectId = (int) $project["project_id"];
        $studentId = (int) $project["student_id"];

        // Milestones belonging to this project.
        $milestoneStmt = $pdo->prepare("
            SELECT id, title, description, due_date, status, completed_at
            FROM research_milestones
            WHERE research_project_id = ?
            ORDER BY
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                due_date ASC, id ASC
        ");
        $milestoneStmt->execute([$projectId]);
        $milestones = $milestoneStmt->fetchAll(PDO::FETCH_ASSOC);

        $milestoneTotal = count($milestones);
        $milestoneCompleted = 0;
        $milestoneOverdue = 0;
        $milestonePendingReview = 0;

        foreach ($milestones as &$milestone) {
            $status = strtolower(trim($milestone["status"] ?? ""));
            $isCompleted = in_array($status, ["completed", "approved"], true);

            if ($isCompleted) {
                $milestoneCompleted++;
            }

            if (
                !$isCompleted &&
                !empty($milestone["due_date"]) &&
                $milestone["due_date"] < date("Y-m-d")
            ) {
                $milestoneOverdue++;
                $milestone["is_overdue"] = true;
            } else {
                $milestone["is_overdue"] = false;
            }

            // Count milestones awaiting review using the submissions table.
            $reviewStmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM milestone_submissions
                WHERE milestone_id = ?
                  AND student_id = ?
                  AND status = 'Pending Review'
            ");
            $reviewStmt->execute([
                (int) $milestone["id"],
                $studentId
            ]);

            $milestone["pending_review"] =
                (int) $reviewStmt->fetchColumn() > 0;

            if ($milestone["pending_review"]) {
                $milestonePendingReview++;
            }
        }
        unset($milestone);

        $milestoneProgress = $milestoneTotal > 0
            ? (int) round(($milestoneCompleted / $milestoneTotal) * 100)
            : 0;

        // Tasks assigned to this student for this project.
        $taskStmt = $pdo->prepare("
            SELECT id, title, description, priority, status, due_date,
                   submitted_at
            FROM tasks
            WHERE research_project_id = ?
              AND assigned_to = ?
            ORDER BY
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                due_date ASC, id ASC
        ");
        $taskStmt->execute([$projectId, $studentId]);
        $tasks = $taskStmt->fetchAll(PDO::FETCH_ASSOC);

        $taskTotal = count($tasks);
        $taskCompleted = 0;
        $taskOverdue = 0;
        $taskPendingReview = 0;

        foreach ($tasks as &$task) {
            $status = strtolower(trim($task["status"] ?? ""));
            $isCompleted = $status === "completed";

            if ($isCompleted) {
                $taskCompleted++;
            }

            if (
                !$isCompleted &&
                !empty($task["due_date"]) &&
                $task["due_date"] < date("Y-m-d")
            ) {
                $taskOverdue++;
                $task["is_overdue"] = true;
            } else {
                $task["is_overdue"] = false;
            }

            $task["pending_review"] = $status === "submitted";
            if ($task["pending_review"]) {
                $taskPendingReview++;
            }
        }
        unset($task);

        $taskProgress = $taskTotal > 0
            ? (int) round(($taskCompleted / $taskTotal) * 100)
            : 0;

        // Overall progress weights milestones and tasks equally.
        $progressParts = [];
        if ($milestoneTotal > 0) {
            $progressParts[] = $milestoneProgress;
        }
        if ($taskTotal > 0) {
            $progressParts[] = $taskProgress;
        }

        $overallProgress = count($progressParts) > 0
            ? (int) round(array_sum($progressParts) / count($progressParts))
            : 0;

        // Most recent meeting for this student and project.
        $meetingStmt = $pdo->prepare("
            SELECT title, meeting_date, start_time, status
            FROM meetings
            WHERE research_project_id = ?
              AND student_id = ?
            ORDER BY meeting_date DESC, start_time DESC, id DESC
            LIMIT 1
        ");
        $meetingStmt->execute([$projectId, $studentId]);
        $latestMeeting = $meetingStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        $overdueCount = $milestoneOverdue + $taskOverdue;
        $pendingReviewCount = $milestonePendingReview + $taskPendingReview;

        $studentRecord = [
            "project_id" => $projectId,
            "student_id" => $studentId,
            "student_name" => trim(
                ($project["first_name"] ?? "") . " " .
                ($project["last_name"] ?? "")
            ),
            "email" => $project["email"],
            "student_number" => $project["student_number"],
            "programme" => $project["programme"],
            "academic_level" => $project["academic_level"],
            "student_status" => $project["student_status"],
            "project_title" => $project["project_title"],
            "project_status" => $project["project_status"],
            "start_date" => $project["start_date"],
            "expected_completion_date" =>
                $project["expected_completion_date"],
            "milestone_total" => $milestoneTotal,
            "milestone_completed" => $milestoneCompleted,
            "milestone_progress" => $milestoneProgress,
            "task_total" => $taskTotal,
            "task_completed" => $taskCompleted,
            "task_progress" => $taskProgress,
            "overall_progress" => $overallProgress,
            "overdue_count" => $overdueCount,
            "pending_review_count" => $pendingReviewCount,
            "latest_meeting" => $latestMeeting,
            "milestones" => $milestones,
            "tasks" => $tasks
        ];

        $students[] = $studentRecord;

        $summary["active_projects"] +=
            strtolower(trim($project["project_status"] ?? "")) === "active"
            ? 1 : 0;

        $summary["completed_projects"] +=
            strtolower(trim($project["project_status"] ?? "")) === "completed"
            ? 1 : 0;

        $summary["overdue_items"] += $overdueCount;
        $summary["pending_reviews"] += $pendingReviewCount;
    }

    // Count unique students even if one student has multiple projects.
    $uniqueStudents = [];
    foreach ($students as $student) {
        $uniqueStudents[$student["student_id"]] = true;
    }
    $summary["total_students"] = count($uniqueStudents);

    $summary["average_progress"] = count($students) > 0
        ? (int) round(
            array_sum(array_column($students, "overall_progress")) /
            count($students)
        )
        : 0;

    respond(true, "Student progress loaded successfully.", [
        "summary" => $summary,
        "students" => $students
    ]);

} catch (Throwable $e) {
    
error_log("Supervisor progress API error: " . $e->getMessage());
    respond(
        false,
        "Unable to load student progress. Check the server error log if the problem continues.",
        [],
        500
    );
}
