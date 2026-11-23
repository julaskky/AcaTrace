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

function respond($success, $message = "", $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

/**
 * Insert a notification or update the existing notification
 * for the same student and source key.
 *
 * Uses the existing student_notifications table.
 */
function saveMeetingNotification(
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
            "Meeting",
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
            "Meeting",
            $priority,
            $requiresAction ? 1 : 0,
            $sourceKey
        ]);
    }
}

$userId = $_SESSION["user_id"] ?? null;
$role = $_SESSION["role"] ?? $_SESSION["user_type"] ?? "";

if (!$userId || $role !== "supervisor") {
    respond(false, "Please log in with a supervisor account.", [], 401);
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
        respond(false, "Supervisor profile not found.", [], 403);
    }

    $supervisorId = (int)$supervisor["id"];

    // --------------------------------------------------
    // GET: Load meetings and projects
    // --------------------------------------------------
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $sql = "
            SELECT
                m.*,
                rp.title AS project_title,
                s.id AS student_record_id,
                s.student_number,
                s.programme,
                u.first_name,
                u.last_name,
                u.email AS student_email
            FROM meetings m
            INNER JOIN research_projects rp
                ON rp.id = m.research_project_id
            INNER JOIN students s
                ON s.id = m.student_id
            INNER JOIN users u
                ON u.id = s.user_id
            WHERE m.supervisor_id = ?
            ORDER BY m.meeting_date DESC, m.start_time DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$supervisorId]);
        $meetings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            SELECT
                rp.id AS project_id,
                rp.title AS project_title,
                s.id AS student_id,
                s.student_number,
                s.programme,
                u.first_name,
                u.last_name,
                u.email
            FROM research_projects rp
            INNER JOIN students s ON s.id = rp.student_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE rp.supervisor_id = ?
            ORDER BY u.last_name, u.first_name
        ");
        $stmt->execute([$supervisorId]);
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respond(true, "Meetings loaded.", [
            "meetings" => $meetings,
            "projects" => $projects
        ]);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(false, "Method not allowed.", [], 405);
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        respond(false, "Invalid JSON request.", [], 400);
    }

    $action = $input["action"] ?? "";

    // --------------------------------------------------
    // CREATE: Schedule meeting and notify student
    // --------------------------------------------------
    if ($action === "create") {
        $projectId = (int)($input["research_project_id"] ?? 0);
        $title = trim($input["title"] ?? "");
        $agenda = trim($input["agenda"] ?? "");
        $date = $input["meeting_date"] ?? "";
        $start = $input["start_time"] ?? "";
        $end = $input["end_time"] ?? "";
        $mode = $input["meeting_mode"] ?? "Online";
        $location = trim($input["meeting_location"] ?? "");
        $link = trim($input["meeting_link"] ?? "");

        if (!$projectId || !$title || !$date || !$start || !$end) {
            respond(
                false,
                "Project, title, date, start time and end time are required.",
                [],
                422
            );
        }

        if (!in_array($mode, ["Online", "In-person"], true)) {
            respond(false, "Invalid meeting mode.", [], 422);
        }

        if ($start >= $end) {
            respond(false, "End time must be later than start time.", [], 422);
        }

        // Confirm the project belongs to this supervisor
        // and obtain the student's users.id.
        $stmt = $pdo->prepare("
            SELECT
                rp.id,
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
            respond(
                false,
                "You can only schedule meetings for your assigned research projects.",
                [],
                403
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO meetings (
                research_project_id,
                supervisor_id,
                student_id,
                title,
                agenda,
                meeting_date,
                start_time,
                end_time,
                meeting_mode,
                meeting_location,
                meeting_link,
                status,
                notes,
                requested_by,
                response_status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                'Scheduled', NULL, 'supervisor', 'Accepted'
            )
        ");

        $stmt->execute([
            $projectId,
            $supervisorId,
            $project["student_id"],
            $title,
            $agenda ?: null,
            $date,
            $start,
            $end,
            $mode,
            $location ?: null,
            $link ?: null
        ]);

        $meetingId = (int)$pdo->lastInsertId();

        saveMeetingNotification(
            $pdo,
            (int)$project["student_user_id"],
            "meeting_{$meetingId}_scheduled",
            "New Meeting Scheduled",
            "Your supervisor has scheduled '{$title}' for {$date}, from {$start} to {$end}. Mode: {$mode}.",
            "Normal",
            false
        );

        $pdo->commit();

        respond(true, "Meeting scheduled and student notified.", [
            "meeting_id" => $meetingId
        ]);
    }

    // --------------------------------------------------
    // Retrieve the meeting and its student's user ID
    // --------------------------------------------------
    $meetingId = (int)($input["meeting_id"] ?? 0);

    if (!$meetingId) {
        respond(false, "Meeting ID is required.", [], 422);
    }

    $stmt = $pdo->prepare("
        SELECT
            m.id,
            m.student_id,
            m.title,
            m.meeting_date,
            m.start_time,
            m.end_time,
            m.status,
            m.response_status,
            m.requested_by,
            s.user_id AS student_user_id
        FROM meetings m
        INNER JOIN students s ON s.id = m.student_id
        WHERE m.id = ? AND m.supervisor_id = ?
        LIMIT 1
    ");
    $stmt->execute([$meetingId, $supervisorId]);
    $meeting = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$meeting) {
        respond(false, "Meeting not found or access denied.", [], 404);
    }

    $studentUserId = (int)$meeting["student_user_id"];
    $meetingTitle = $meeting["title"];

    // --------------------------------------------------
    // RESPOND: Accept or decline a student's request
    // --------------------------------------------------
    if ($action === "respond") {
        $response = $input["response"] ?? "";
        $responseNote = trim($input["response_note"] ?? "");

        if (!in_array($response, ["Accepted", "Declined"], true)) {
            respond(false, "Response must be Accepted or Declined.", [], 422);
        }

        if (
            $meeting["requested_by"] !== "student" ||
            $meeting["response_status"] !== "Pending"
        ) {
            respond(
                false,
                "This meeting has no pending student request.",
                [],
                422
            );
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE meetings
            SET response_status = ?,
                response_note = ?,
                status = CASE
                    WHEN ? = 'Declined' THEN 'Cancelled'
                    ELSE status
                END
            WHERE id = ? AND supervisor_id = ?
        ");

        $stmt->execute([
            $response,
            $responseNote ?: null,
            $response,
            $meetingId,
            $supervisorId
        ]);

        $notificationMessage = $response === "Accepted"
            ? "Your supervisor accepted your meeting request for '{$meetingTitle}'."
            : "Your supervisor declined your meeting request for '{$meetingTitle}'.";

        if ($responseNote !== "") {
            $notificationMessage .= " Supervisor's note: {$responseNote}";
        }

        saveMeetingNotification(
            $pdo,
            $studentUserId,
            "meeting_{$meetingId}_response",
            "Meeting Request {$response}",
            $notificationMessage,
            $response === "Declined" ? "High" : "Normal",
            false
        );

        $pdo->commit();

        respond(
            true,
            "Meeting request " . strtolower($response) . "; student notified."
        );
    }

    // --------------------------------------------------
    // UPDATE STATUS: Scheduled, Completed, Cancelled
    // --------------------------------------------------
    if ($action === "update_status") {
        $status = $input["status"] ?? "";

        if (!in_array($status, ["Scheduled", "Completed", "Cancelled"], true)) {
            respond(false, "Invalid meeting status.", [], 422);
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE meetings
            SET status = ?
            WHERE id = ? AND supervisor_id = ?
        ");
        $stmt->execute([$status, $meetingId, $supervisorId]);

        $notificationTitle = "Meeting Status Updated";
        $notificationMessage = "The status of your meeting '{$meetingTitle}' has been updated to {$status}.";
        $notificationPriority = "Normal";

        if ($status === "Completed") {
            $notificationTitle = "Meeting Completed";
            $notificationMessage = "Your meeting '{$meetingTitle}' has been marked as completed by your supervisor.";
        } elseif ($status === "Cancelled") {
            $notificationTitle = "Meeting Cancelled";
            $notificationMessage = "Your meeting '{$meetingTitle}' scheduled for {$meeting["meeting_date"]} has been cancelled by your supervisor.";
            $notificationPriority = "High";
        }

        saveMeetingNotification(
            $pdo,
            $studentUserId,
            "meeting_{$meetingId}_status",
            $notificationTitle,
            $notificationMessage,
            $notificationPriority,
            false
        );

        $pdo->commit();

        respond(true, "Meeting status updated and student notified.");
    }

    // --------------------------------------------------
    // UPDATE NOTES: Save meeting outcome and notify student
    // --------------------------------------------------
    if ($action === "update_notes") {
        $notes = trim($input["notes"] ?? "");

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE meetings
            SET notes = ?
            WHERE id = ? AND supervisor_id = ?
        ");
        $stmt->execute([
            $notes !== "" ? $notes : null,
            $meetingId,
            $supervisorId
        ]);

        saveMeetingNotification(
            $pdo,
            $studentUserId,
            "meeting_{$meetingId}_outcome",
            "Meeting Outcome Recorded",
            "Your supervisor has saved the outcome for meeting '{$meetingTitle}'."
                . ($notes !== "" ? " Outcome: {$notes}" : ""),
            "Normal",
            false
        );

        $pdo->commit();

        respond(true, "Meeting outcome saved and student notified.");
    }

    respond(false, "Unknown action.", [], 400);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor meetings API error: " . $e->getMessage());
    respond(
        false,
        "A database error occurred. Check the PHP error log.",
        [],
        500
    );
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Supervisor meetings error: " . $e->getMessage());
    respond(
        false,
        "An unexpected server error occurred.",
        [],
        500
    );
}
