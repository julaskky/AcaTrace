<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../config/database.php";

function taskRespond($success, $message = "", $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function saveTaskNotification(
    PDO $pdo,
    int $studentUserId,
    string $sourceKey,
    string $title,
    string $message,
    string $priority = "Normal",
    bool $requiresAction = false
): void {
    $stmt = $pdo->prepare("
        SELECT id
        FROM student_notifications
        WHERE user_id = ? AND source_key = ?
        LIMIT 1
    ");
    $stmt->execute([$studentUserId, $sourceKey]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        $stmt = $pdo->prepare("
            UPDATE student_notifications
            SET title = ?,
                message = ?,
                notification_type = ?,
                priority = ?,
                requires_action = ?,
                action_url = NULL
            WHERE id = ?
        ");

        $stmt->execute([
            $title,
            $message,
            "Task",
            $priority,
            $requiresAction ? 1 : 0,
            $existing["id"]
        ]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO student_notifications (
                user_id,
                title,
                message,
                notification_type,
                priority,
                requires_action,
                action_url,
                source_key
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        ");

        $stmt->execute([
            $studentUserId,
            $title,
            $message,
            "Task",
            $priority,
            $requiresAction ? 1 : 0,
            $sourceKey
        ]);
    }
}

function taskNotificationPriority(string $priority): string {
    if ($priority === "Urgent") {
        return "Urgent";
    }

    if ($priority === "High") {
        return "High";
    }

    return "Normal";
}

function validateTaskDueDate($dueDate): ?string {
    if ($dueDate === "" || $dueDate === null) {
        return null;
    }

    if (!is_string($dueDate)) {
        taskRespond(false, "Invalid deadline date.", [], 422);
    }

    $date = DateTime::createFromFormat("!Y-m-d", $dueDate);

    if (!$date || $date->format("Y-m-d") !== $dueDate) {
        taskRespond(false, "Invalid deadline date.", [], 422);
    }

    return $dueDate;
}

$userId = $_SESSION["user_id"] ?? null;
$role = $_SESSION["role"] ?? $_SESSION["user_type"] ?? "";

if (!$userId || $role !== "supervisor") {
    taskRespond(false, "Please log in with a supervisor account.", [], 401);
}

try {
    $stmt = $pdo->prepare("
        SELECT id
        FROM supervisors
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        taskRespond(false, "Supervisor profile not found.", [], 403);
    }

    $supervisorId = (int)$supervisor["id"];

    // --------------------------------------------------
    // GET: Load tasks and supervised projects
    // --------------------------------------------------
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                t.*,
                rp.title AS project_title,
                s.id AS student_record_id,
                s.student_number,
                s.programme,
                u.first_name,
                u.last_name,
                u.email AS student_email,
                COALESCE(
                    (
                        SELECT ts.submission_text
                        FROM task_submissions ts
                        WHERE ts.task_id = t.id
                        ORDER BY ts.submitted_at DESC, ts.id DESC
                        LIMIT 1
                    ),
                    t.submission_notes
                ) AS latest_submission_text,
                (
                    SELECT ts.file_path
                    FROM task_submissions ts
                    WHERE ts.task_id = t.id
                    ORDER BY ts.submitted_at DESC, ts.id DESC
                    LIMIT 1
                ) AS latest_submission_file,
                (
                    SELECT ts.submitted_at
                    FROM task_submissions ts
                    WHERE ts.task_id = t.id
                    ORDER BY ts.submitted_at DESC, ts.id DESC
                    LIMIT 1
                ) AS latest_submission_at
            FROM tasks t
            INNER JOIN research_projects rp
                ON rp.id = t.research_project_id
            INNER JOIN students s
                ON s.id = t.assigned_to
            INNER JOIN users u
                ON u.id = s.user_id
            WHERE rp.supervisor_id = ?
            ORDER BY
                CASE t.status
                    WHEN 'Submitted' THEN 0
                    WHEN 'Revision Required' THEN 1
                    WHEN 'In Progress' THEN 2
                    WHEN 'Pending' THEN 3
                    ELSE 4
                END,
                t.due_date ASC,
                t.created_at DESC
        ");
        $stmt->execute([$supervisorId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            SELECT
                rp.id AS project_id,
                rp.title AS project_title,
                s.id AS student_id,
                s.student_number,
                s.programme,
                u.first_name,
                u.last_name
            FROM research_projects rp
            INNER JOIN students s ON s.id = rp.student_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE rp.supervisor_id = ?
            ORDER BY u.last_name, u.first_name
        ");
        $stmt->execute([$supervisorId]);
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        taskRespond(true, "Tasks loaded.", [
            "tasks" => $tasks,
            "projects" => $projects
        ]);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        taskRespond(false, "Method not allowed.", [], 405);
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        taskRespond(false, "Invalid JSON request.", [], 400);
    }

    $action = $input["action"] ?? "";

    // --------------------------------------------------
    // CREATE: Create a task and notify the student
    // --------------------------------------------------
    if ($action === "create") {
        $projectId = (int)($input["research_project_id"] ?? 0);
        $title = trim($input["title"] ?? "");
        $description = trim($input["description"] ?? "");
        $priority = $input["priority"] ?? "Medium";
        $dueDate = validateTaskDueDate($input["due_date"] ?? null);

        if (!$projectId || $title === "") {
            taskRespond(
                false,
                "Research project and task title are required.",
                [],
                422
            );
        }

        if (!in_array($priority, ["Low", "Medium", "High", "Urgent"], true)) {
            taskRespond(false, "Invalid task priority.", [], 422);
        }

        $stmt = $pdo->prepare("
            SELECT
                rp.id,
                rp.title AS project_title,
                rp.student_id,
                s.user_id AS student_user_id
            FROM research_projects rp
            INNER JOIN students s ON s.id = rp.student_id
            WHERE rp.id = ? AND rp.supervisor_id = ?
            LIMIT 1
        ");
        $stmt->execute([$projectId, $supervisorId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            taskRespond(
                false,
                "You can only create tasks for your assigned research projects.",
                [],
                403
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO tasks (
                research_project_id,
                title,
                description,
                assigned_by,
                assigned_to,
                priority,
                status,
                due_date
            ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
        ");

        $stmt->execute([
            $projectId,
            $title,
            $description ?: null,
            $userId,
            $project["student_id"],
            $priority,
            $dueDate
        ]);

        $taskId = (int)$pdo->lastInsertId();
        $deadline = $dueDate ? " Deadline: {$dueDate}." : "";

        saveTaskNotification(
            $pdo,
            (int)$project["student_user_id"],
            "task_{$taskId}_assigned",
            "New Task Assigned",
            "Your supervisor assigned you '{$title}' for the research project '{$project["project_title"]}'. Priority: {$priority}.{$deadline}",
            taskNotificationPriority($priority),
            true
        );

        $pdo->commit();

        taskRespond(true, "Task created, assigned, and student notified.", [
            "task_id" => $taskId
        ]);
    }

    // --------------------------------------------------
    // Load task and verify ownership
    // --------------------------------------------------
    $taskId = (int)($input["task_id"] ?? 0);

    if (!$taskId) {
        taskRespond(false, "Task ID is required.", [], 422);
    }

    $stmt = $pdo->prepare("
        SELECT
            t.*,
            rp.title AS project_title,
            s.user_id AS student_user_id
        FROM tasks t
        INNER JOIN research_projects rp
            ON rp.id = t.research_project_id
        INNER JOIN students s
            ON s.id = t.assigned_to
        WHERE t.id = ? AND rp.supervisor_id = ?
        LIMIT 1
    ");
    $stmt->execute([$taskId, $supervisorId]);
    $task = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$task) {
        taskRespond(false, "Task not found or access denied.", [], 404);
    }

    $studentUserId = (int)$task["student_user_id"];
    $taskTitle = $task["title"];

    // --------------------------------------------------
    // EDIT: Update task details and notify student
    // --------------------------------------------------
    if ($action === "edit") {
        if (in_array($task["status"], ["Submitted", "Completed"], true)) {
            taskRespond(
                false,
                "Submitted or completed tasks cannot be edited.",
                [],
                422
            );
        }

        $projectId = (int)($input["research_project_id"] ?? 0);
        $title = trim($input["title"] ?? "");
        $description = trim($input["description"] ?? "");
        $priority = $input["priority"] ?? "Medium";
        $dueDate = validateTaskDueDate($input["due_date"] ?? null);

        if (!$projectId || $title === "") {
            taskRespond(
                false,
                "Research project and task title are required.",
                [],
                422
            );
        }

        if (!in_array($priority, ["Low", "Medium", "High", "Urgent"], true)) {
            taskRespond(false, "Invalid task priority.", [], 422);
        }

        $stmt = $pdo->prepare("
            SELECT
                rp.id,
                rp.title AS project_title,
                rp.student_id,
                s.user_id AS student_user_id
            FROM research_projects rp
            INNER JOIN students s ON s.id = rp.student_id
            WHERE rp.id = ? AND rp.supervisor_id = ?
            LIMIT 1
        ");
        $stmt->execute([$projectId, $supervisorId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            taskRespond(
                false,
                "You can only assign tasks to your supervised research projects.",
                [],
                403
            );
        }

        $oldStudentUserId = $studentUserId;
        $newStudentUserId = (int)$project["student_user_id"];

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE tasks
            SET research_project_id = ?,
                assigned_to = ?,
                title = ?,
                description = ?,
                priority = ?,
                due_date = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $projectId,
            $project["student_id"],
            $title,
            $description ?: null,
            $priority,
            $dueDate,
            $taskId
        ]);

        // Update the old student's assignment notification if
        // the task has been reassigned to a different student.
        if ($oldStudentUserId !== $newStudentUserId) {
            saveTaskNotification(
                $pdo,
                $oldStudentUserId,
                "task_{$taskId}_assigned",
                "Task Reassigned",
                "The task '{$taskTitle}' has been reassigned to another student.",
                "Normal",
                false
            );
        }

        $deadlineMessage = $dueDate
            ? "Deadline: {$dueDate}."
            : "No deadline has been set.";

        // Insert or update the current student's task notification.
        saveTaskNotification(
            $pdo,
            $newStudentUserId,
            "task_{$taskId}_assigned",
            "Task Updated",
            "The task '{$title}' for '{$project["project_title"]}' has been updated by your supervisor. Priority: {$priority}. {$deadlineMessage}",
            taskNotificationPriority($priority),
            true
        );

        $pdo->commit();

        taskRespond(true, "Task updated and student notification saved.");
    }

    // --------------------------------------------------
    // REVIEW: Approve submission or request revisions
    // --------------------------------------------------
    if ($action === "review") {
        if ($task["status"] !== "Submitted") {
            taskRespond(false, "Only submitted tasks can be reviewed.", [], 422);
        }

        $decision = $input["decision"] ?? "";
        $feedback = trim($input["supervisor_feedback"] ?? "");

        if (!in_array($decision, ["Completed", "Revision Required"], true)) {
            taskRespond(false, "Choose Completed or Revision Required.", [], 422);
        }

        if ($decision === "Revision Required" && $feedback === "") {
            taskRespond(
                false,
                "Provide feedback when requesting revisions.",
                [],
                422
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE tasks
            SET status = ?,
                supervisor_feedback = ?,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            $decision,
            $feedback ?: null,
            $taskId
        ]);

        if ($decision === "Completed") {
            $notificationTitle = "Task Submission Approved";
            $notificationMessage =
                "Your submission for '{$taskTitle}' has been approved. The task is now completed.";
            $notificationPriority = "Normal";
            $requiresAction = false;
        } else {
            $notificationTitle = "Task Revision Required";
            $notificationMessage =
                "Your supervisor has requested revisions to '{$taskTitle}'. Feedback: {$feedback}";
            $notificationPriority = "High";
            $requiresAction = true;
        }

        saveTaskNotification(
            $pdo,
            $studentUserId,
            "task_{$taskId}_review",
            $notificationTitle,
            $notificationMessage,
            $notificationPriority,
            $requiresAction
        );

        $pdo->commit();

        taskRespond(
            true,
            $decision === "Completed"
                ? "Submission approved, task completed, and student notified."
                : "Revision requested, feedback saved, and student notified."
        );
    }

    // --------------------------------------------------
    // UPDATE STATUS: Update status and notify student
    // --------------------------------------------------
    if ($action === "update_status") {
        $status = $input["status"] ?? "";

        if (!in_array($status, [
            "Pending",
            "In Progress",
            "Completed"
        ], true)) {
            taskRespond(false, "Invalid task status.", [], 422);
        }

        if ($task["status"] === "Submitted") {
            taskRespond(
                false,
                "Review the submitted work before changing its status.",
                [],
                422
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE tasks
            SET status = ?
            WHERE id = ?
        ");
        $stmt->execute([$status, $taskId]);

        $notificationTitle = "Task Status Updated";
        $notificationMessage =
            "The status of your task '{$taskTitle}' has been changed to {$status}.";
        $notificationPriority = taskNotificationPriority(
            $task["priority"] ?? "Medium"
        );
        $requiresAction = in_array(
            $status,
            ["Pending", "In Progress"],
            true
        );

        if ($status === "Completed") {
            $notificationTitle = "Task Completed";
            $notificationMessage =
                "Your task '{$taskTitle}' has been marked as completed by your supervisor.";
            $notificationPriority = "Normal";
            $requiresAction = false;
        } elseif ($status === "In Progress") {
            $notificationTitle = "Task In Progress";
            $notificationMessage =
                "Your task '{$taskTitle}' is now marked as In Progress.";
        } else {
            $notificationTitle = "Task Pending";
            $notificationMessage =
                "Your task '{$taskTitle}' is now marked as Pending. Please review its requirements.";
        }

        saveTaskNotification(
            $pdo,
            $studentUserId,
            "task_{$taskId}_status",
            $notificationTitle,
            $notificationMessage,
            $notificationPriority,
            $requiresAction
        );

        $pdo->commit();

        taskRespond(true, "Task status updated and student notified.");
    }

    taskRespond(false, "Unknown action.", [], 400);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor tasks API error: " . $e->getMessage());

    taskRespond(
        false,
        "A database error occurred. Check the PHP error log.",
        [],
        500
    );
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor tasks error: " . $e->getMessage());

    taskRespond(
        false,
        "An unexpected server error occurred.",
        [],
        500
    );
}
