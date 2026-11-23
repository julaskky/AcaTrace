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

function respond($success, $message, $data = [], $code = 200)
{
    http_response_code($code);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

/**
 * Create a student notification.
 * Call inside the transaction for the associated operation.
 */
function createStudentNotification(
    PDO $pdo,
    int $userId,
    string $title,
    string $message,
    string $type = "General",
    string $priority = "Normal",
    bool $requiresAction = false,
    ?string $actionUrl = null,
    ?string $sourceKey = null
): void {
    if ($userId <= 0) {
        throw new RuntimeException("Invalid notification recipient.");
    }

    // Avoid duplicate notifications for the same source event.
    if ($sourceKey !== null) {
        $check = $pdo->prepare(
            "SELECT id FROM student_notifications
             WHERE source_key = ?
             LIMIT 1"
        );
        $check->execute([$sourceKey]);

        if ($check->fetchColumn()) {
            return;
        }
    }

    $stmt = $pdo->prepare(
        "INSERT INTO student_notifications
            (
                user_id,
                title,
                message,
                notification_type,
                priority,
                requires_action,
                action_url,
                source_key
            )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $stmt->execute([
        $userId,
        $title,
        $message,
        $type,
        $priority,
        $requiresAction ? 1 : 0,
        $actionUrl,
        $sourceKey
    ]);
}

/**
 * Map milestone priority to the notification table's priority values.
 */
function notificationPriority(string $priority): string
{
    if ($priority === "High") {
        return "High";
    }

    return "Normal";
}

$userId = $_SESSION["user_id"] ?? null;
$role = strtolower(
    $_SESSION["role"] ?? $_SESSION["user_type"] ?? ""
);

if (!$userId || $role !== "supervisor") {
    respond(
        false,
        "Please log in with a supervisor account.",
        [],
        401
    );
}

try {
    // Resolve the logged-in supervisor's database ID.
    $stmt = $pdo->prepare(
        "SELECT id FROM supervisors
         WHERE user_id = ?
         LIMIT 1"
    );
    $stmt->execute([$userId]);
    $supervisor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$supervisor) {
        respond(false, "Supervisor profile not found.", [], 403);
    }

    $supervisorId = (int) $supervisor["id"];
    $method = $_SERVER["REQUEST_METHOD"];

    $allowedStatuses = [
        "Pending",
        "In Progress",
        "Completed"
    ];

    $allowedPriorities = [
        "Low",
        "Medium",
        "High"
    ];

    // Confirm that a project belongs to this supervisor.
    $checkProject = function ($projectId) use ($pdo, $supervisorId) {
        $stmt = $pdo->prepare(
            "SELECT id
             FROM research_projects
             WHERE id = ? AND supervisor_id = ?
             LIMIT 1"
        );

        $stmt->execute([$projectId, $supervisorId]);

        return (bool) $stmt->fetchColumn();
    };

    // Confirm that a milestone belongs to this supervisor.
    $checkMilestone = function ($milestoneId) use ($pdo, $supervisorId) {
        $stmt = $pdo->prepare(
            "SELECT m.id
             FROM research_milestones m
             INNER JOIN research_projects p
                ON p.id = m.research_project_id
             WHERE m.id = ? AND p.supervisor_id = ?
             LIMIT 1"
        );

        $stmt->execute([$milestoneId, $supervisorId]);

        return (bool) $stmt->fetchColumn();
    };

    /*
    |--------------------------------------------------------------------------
    | GET: Load milestones, projects and statistics
    |--------------------------------------------------------------------------
    */
    if ($method === "GET") {
        $sql = "
            SELECT
                m.id,
                m.research_project_id,
                m.title,
                m.description,
                m.due_date,
                m.priority,
                m.status,
                m.completed_at,
                p.title AS project_title,
                p.student_id,
                CONCAT(u.first_name, ' ', u.last_name)
                    AS student_name,
                s.id AS submission_id,
                s.submission_text,
                s.file_path,
                s.status AS submission_status,
                s.supervisor_feedback,
                s.submitted_at
            FROM research_milestones m
            INNER JOIN research_projects p
                ON p.id = m.research_project_id
            INNER JOIN students st
                ON st.id = p.student_id
            INNER JOIN users u
                ON u.id = st.user_id
            LEFT JOIN milestone_submissions s
                ON s.id = (
                    SELECT s2.id
                    FROM milestone_submissions s2
                    WHERE s2.milestone_id = m.id
                    ORDER BY s2.submitted_at DESC, s2.id DESC
                    LIMIT 1
                )
            WHERE p.supervisor_id = ?
            ORDER BY
                CASE
                    WHEN s.status = 'Pending Review' THEN 0
                    WHEN m.due_date < CURDATE()
                         AND m.status <> 'Completed' THEN 1
                    ELSE 2
                END,
                m.due_date ASC,
                m.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$supervisorId]);
        $milestones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Projects assigned to this supervisor.
        $stmt = $pdo->prepare(
            "SELECT
                p.id,
                p.title AS project_title,
                p.student_id,
                CONCAT(u.first_name, ' ', u.last_name)
                    AS student_name
             FROM research_projects p
             INNER JOIN students st ON st.id = p.student_id
             INNER JOIN users u ON u.id = st.user_id
             WHERE p.supervisor_id = ?
             ORDER BY p.title ASC"
        );

        $stmt->execute([$supervisorId]);
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stats = [
            "total" => count($milestones),
            "completed" => 0,
            "in_progress" => 0,
            "overdue" => 0,
            "pending_reviews" => 0
        ];

        foreach ($milestones as &$milestone) {
            $status = $milestone["status"] ?? "Pending";

            if ($status === "Completed") {
                $stats["completed"]++;
            } elseif (
                !empty($milestone["due_date"]) &&
                $milestone["due_date"] < date("Y-m-d")
            ) {
                $stats["overdue"]++;
            } elseif ($status === "In Progress") {
                $stats["in_progress"]++;
            }

            if (
                ($milestone["submission_status"] ?? "") ===
                "Pending Review"
            ) {
                $stats["pending_reviews"]++;
            }

            $milestone["is_overdue"] =
                !empty($milestone["due_date"]) &&
                $milestone["due_date"] < date("Y-m-d") &&
                $status !== "Completed";
        }

        unset($milestone);

        respond(true, "Milestones loaded.", [
            "milestones" => $milestones,
            "projects" => $projects,
            "stats" => $stats
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | POST: Create, update or review
    |--------------------------------------------------------------------------
    */
    if ($method !== "POST") {
        respond(false, "Method not allowed.", [], 405);
    }

    $input = json_decode(
        file_get_contents("php://input"),
        true
    ) ?? [];

    $action = $input["action"] ?? "";

    /*
    |--------------------------------------------------------------------------
    | CREATE OR UPDATE MILESTONE
    |--------------------------------------------------------------------------
    */
    if ($action === "create" || $action === "update") {
        $projectId = (int) ($input["research_project_id"] ?? 0);
        $title = trim($input["title"] ?? "");
        $description = trim($input["description"] ?? "");
        $dueDate = trim($input["due_date"] ?? "");

        $priority = $input["priority"] ?? "Medium";
        $status = $input["status"] ?? "Pending";

        if (!$projectId || !$checkProject($projectId)) {
            respond(
                false,
                "Select a valid project assigned to you.",
                [],
                403
            );
        }

        if ($title === "" || mb_strlen($title) > 255) {
            respond(
                false,
                "Enter a milestone title of up to 255 characters.",
                [],
                422
            );
        }

        if (!in_array($priority, $allowedPriorities, true)) {
            respond(
                false,
                "Choose Low, Medium or High priority.",
                [],
                422
            );
        }

        if (!in_array($status, $allowedStatuses, true)) {
            respond(
                false,
                "Choose Pending, In Progress or Completed status.",
                [],
                422
            );
        }

        if ($dueDate === "") {
            respond(false, "A milestone due date is required.", [], 422);
        }

        $date = DateTime::createFromFormat("!Y-m-d", $dueDate);

        if (
            !$date ||
            $date->format("Y-m-d") !== $dueDate
        ) {
            respond(false, "Enter a valid due date.", [], 422);
        }

        // Find the student's user ID for notifications.
        $stmt = $pdo->prepare(
            "SELECT st.user_id
             FROM research_projects p
             INNER JOIN students st ON st.id = p.student_id
             WHERE p.id = ? AND p.supervisor_id = ?
             LIMIT 1"
        );

        $stmt->execute([$projectId, $supervisorId]);
        $studentUserId = (int) $stmt->fetchColumn();

        if (!$studentUserId) {
            respond(
                false,
                "The student account for this project was not found.",
                [],
                404
            );
        }

        if ($action === "create") {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare(
                "INSERT INTO research_milestones
                    (
                        research_project_id,
                        title,
                        description,
                        due_date,
                        priority,
                        status,
                        completed_at
                    )
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );

            $completedAt = $status === "Completed"
                ? date("Y-m-d H:i:s")
                : null;

            $stmt->execute([
                $projectId,
                $title,
                $description ?: null,
                $dueDate,
                $priority,
                $status,
                $completedAt
            ]);

            $milestoneId = (int) $pdo->lastInsertId();

            createStudentNotification(
                $pdo,
                $studentUserId,
                "New Research Milestone",
                "Your supervisor assigned the milestone \"" .
                    $title . "\". Due date: " . $dueDate .
                    ". Priority: " . $priority .
                    ". Status: " . $status . ".",
                "Milestone",
                notificationPriority($priority),
                true,
                null,
                "milestone_created_" . $milestoneId
            );

            $pdo->commit();

            respond(
                true,
                "Milestone created and student notified successfully.",
                ["id" => $milestoneId],
                201
            );
        }

        // UPDATE
        $milestoneId = (int) ($input["id"] ?? 0);

        if (
            !$milestoneId ||
            !$checkMilestone($milestoneId)
        ) {
            respond(
                false,
                "Milestone not found or access denied.",
                [],
                404
            );
        }

        $stmt = $pdo->prepare(
            "SELECT
                research_project_id,
                title,
                due_date,
                priority,
                status
             FROM research_milestones
             WHERE id = ?
             LIMIT 1"
        );

        $stmt->execute([$milestoneId]);
        $old = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$old) {
            respond(false, "Milestone not found.", [], 404);
        }

        $changed =
            (string) $old["research_project_id"] !== (string) $projectId ||
            (string) $old["title"] !== $title ||
            (string) ($old["due_date"] ?? "") !== $dueDate ||
            (string) ($old["priority"] ?? "Medium") !== $priority ||
            (string) ($old["status"] ?? "Pending") !== $status ||
            (string) ($old["description"] ?? "") !== $description;

        $completedAt = $status === "Completed"
            ? date("Y-m-d H:i:s")
            : null;

        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            "UPDATE research_milestones
             SET research_project_id = ?,
                 title = ?,
                 description = ?,
                 due_date = ?,
                 priority = ?,
                 status = ?,
                 completed_at = ?
             WHERE id = ?"
        );

        $stmt->execute([
            $projectId,
            $title,
            $description ?: null,
            $dueDate,
            $priority,
            $status,
            $completedAt,
            $milestoneId
        ]);

        if ($changed) {
            createStudentNotification(
                $pdo,
                $studentUserId,
                "Research Milestone Updated",
                "The milestone \"" . $title .
                    "\" has been updated. Due date: " . $dueDate .
                    ". Priority: " . $priority .
                    ". Status: " . $status . ".",
                "Milestone",
                notificationPriority($priority),
                true,
                null,
                "milestone_updated_" . $milestoneId . "_" .
                    date("YmdHis")
            );
        }

        $pdo->commit();

        respond(
            true,
            $changed
                ? "Milestone updated and student notified successfully."
                : "No milestone changes were made."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | REVIEW SUBMISSION
    |--------------------------------------------------------------------------
    */
    if ($action === "review") {
        $submissionId = (int) ($input["submission_id"] ?? 0);
        $reviewStatus = $input["status"] ?? "";
        $feedback = trim($input["supervisor_feedback"] ?? "");

        if (
            !in_array(
                $reviewStatus,
                ["Approved", "Revision Required"],
                true
            )
        ) {
            respond(
                false,
                "Choose Approve or Request Revisions.",
                [],
                422
            );
        }

        if (
            $reviewStatus === "Revision Required" &&
            $feedback === ""
        ) {
            respond(
                false,
                "Provide feedback when requesting revisions.",
                [],
                422
            );
        }

        $stmt = $pdo->prepare(
            "SELECT
                s.id,
                s.milestone_id,
                m.title AS milestone_title,
                p.student_id,
                st.user_id AS student_user_id
             FROM milestone_submissions s
             INNER JOIN research_milestones m
                ON m.id = s.milestone_id
             INNER JOIN research_projects p
                ON p.id = m.research_project_id
             INNER JOIN students st
                ON st.id = p.student_id
             WHERE s.id = ? AND p.supervisor_id = ?
             LIMIT 1"
        );

        $stmt->execute([$submissionId, $supervisorId]);
        $submission = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$submission) {
            respond(
                false,
                "Submission not found or access denied.",
                [],
                404
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            "UPDATE milestone_submissions
             SET status = ?,
                 supervisor_feedback = ?,
                 reviewed_at = NOW()
             WHERE id = ?"
        );

        $stmt->execute([
            $reviewStatus,
            $feedback ?: null,
            $submissionId
        ]);

        if ($reviewStatus === "Approved") {
            $stmt = $pdo->prepare(
                "UPDATE research_milestones
                 SET status = 'Completed',
                     completed_at = NOW()
                 WHERE id = ?"
            );

            $stmt->execute([$submission["milestone_id"]]);

            createStudentNotification(
                $pdo,
                (int) $submission["student_user_id"],
                "Milestone Approved",
                "Your submission for \"" .
                    $submission["milestone_title"] .
                    "\" has been approved. The milestone is now completed.",
                "Milestone",
                "Normal",
                false,
                null,
                "submission_review_" . $submissionId . "_approved"
            );
        } else {
            $stmt = $pdo->prepare(
                "UPDATE research_milestones
                 SET status = 'In Progress',
                     completed_at = NULL
                 WHERE id = ?"
            );

            $stmt->execute([$submission["milestone_id"]]);

            createStudentNotification(
                $pdo,
                (int) $submission["student_user_id"],
                "Milestone Revisions Required",
                "Your submission for \"" .
                    $submission["milestone_title"] .
                    "\" requires revisions. Supervisor feedback: " .
                    $feedback,
                "Milestone",
                "High",
                true,
                null,
                "submission_review_" . $submissionId . "_revision"
            );
        }

        $pdo->commit();

        respond(
            true,
            $reviewStatus === "Approved"
                ? "Submission approved. Milestone completed and student notified."
                : "Revision requested. Feedback saved and student notified."
        );
    }

    respond(false, "Unsupported action.", [], 400);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor milestones API: " . $e->getMessage());

    respond(
        false,
        "A server error occurred. Check the PHP error log and database schema.",
        [],
        500
    );
}
