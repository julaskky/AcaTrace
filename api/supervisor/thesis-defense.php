<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

session_start();

require_once dirname(__DIR__, 2) . "/api/config/database.php";

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

/**
 * Insert or update the notification associated with a thesis defense.
 */
function saveDefenseNotification(
    PDO $pdo,
    int $studentUserId,
    int $defenseId,
    string $projectTitle,
    string $status,
    ?string $scheduledAt,
    ?string $venue,
    ?string $meetingLink,
    ?string $outcome,
    ?string $feedback
): void {
    $sourceKey = "thesis_defense_" . $defenseId . "_update";
    $title = "Thesis Defense Update";

    $message = "Your thesis defense for \"" . $projectTitle . "\" has been updated. ";

    switch ($status) {
        case "Approved":
            $message .= "Your defense request has been approved.";
            break;

        case "Scheduled":
            $dateText = $scheduledAt
                ? date("d M Y, h:i A", strtotime($scheduledAt))
                : "Not specified";

            $message .= "Your defense has been scheduled for " .
                $dateText . ". Venue: " .
                ($venue ?: "Not specified") . ".";

            if ($meetingLink) {
                $message .= " Meeting link: " . $meetingLink;
            }
            break;

        case "Completed":
            $message .= "Your defense has been completed. Outcome: " .
                ($outcome ?: "Not specified") . ".";

            if ($feedback) {
                $message .= " Supervisor feedback: " . $feedback;
            }
            break;

        case "Cancelled":
            $message .= "Your thesis defense has been cancelled.";
            break;

        default:
            $message .= "Current status: " . $status . ".";
    }

    $requiresAction = in_array(
        $outcome,
        ["Passed with Revisions", "Re-examination Required", "Failed"],
        true
    );

    $priority = (
        $status === "Cancelled" ||
        in_array(
            $outcome,
            ["Passed with Revisions", "Re-examination Required", "Failed"],
            true
        )
    ) ? "High" : "Normal";

    $find = $pdo->prepare("
        SELECT id
        FROM student_notifications
        WHERE user_id = ?
          AND source_key = ?
        LIMIT 1
    ");
    $find->execute([$studentUserId, $sourceKey]);

    $existingId = $find->fetchColumn();

    if ($existingId) {
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
            "Thesis Defense",
            $priority,
            $requiresAction ? 1 : 0,
            (int)$existingId
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
            "Thesis Defense",
            $priority,
            $requiresAction ? 1 : 0,
            $sourceKey
        ]);
    }
}

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower(
    (string)($_SESSION["role"] ?? $_SESSION["user_type"] ?? "")
);

if ($userId <= 0 || $role !== "supervisor") {
    respond(401, [
        "success" => false,
        "message" => "Please log in with your supervisor account."
    ]);
}

try {
    $stmt = $pdo->prepare("
        SELECT id
        FROM supervisors
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $supervisorId = (int)$stmt->fetchColumn();

    if ($supervisorId <= 0) {
        respond(403, [
            "success" => false,
            "message" => "No supervisor profile was found."
        ]);
    }

    /*
     * GET: Retrieve thesis defenses and their uploaded documents.
     */
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $sql = "
            SELECT
                td.id,
                td.student_id,
                td.research_project_id,
                td.requested_date,
                td.scheduled_at,
                td.venue,
                td.meeting_link,
                td.status,
                td.outcome,
                td.outcome_feedback,
                td.created_at,
                td.updated_at,
                rp.title AS project_title,
                s.student_number,
                s.programme,
                CONCAT_WS(' ', u.first_name, u.last_name) AS student_name,
                u.email AS student_email
            FROM thesis_defenses td
            INNER JOIN research_projects rp
                ON rp.id = td.research_project_id
                AND rp.supervisor_id = ?
            INNER JOIN students s
                ON s.id = rp.student_id
            INNER JOIN users u
                ON u.id = s.user_id
            ORDER BY
                CASE td.status
                    WHEN 'Requested' THEN 0
                    WHEN 'Approved' THEN 1
                    WHEN 'Scheduled' THEN 2
                    ELSE 3
                END,
                td.created_at DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$supervisorId]);
        $defenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($defenses as &$defense) {
            $defense["id"] = (int)$defense["id"];
            $defense["student_id"] = (int)$defense["student_id"];
            $defense["research_project_id"] =
                (int)$defense["research_project_id"];

            $docStmt = $pdo->prepare("
                SELECT
                    id,
                    title,
                    original_filename,
                    mime_type,
                    file_size,
                    uploaded_at
                FROM thesis_defense_documents
                WHERE defense_id = ?
                ORDER BY uploaded_at DESC
            ");

            $docStmt->execute([$defense["id"]]);
            $defense["documents"] =
                $docStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        unset($defense);

        respond(200, [
            "success" => true,
            "defenses" => $defenses
        ]);
    }

    /*
     * POST: Approve, schedule, complete, or cancel a defense.
     */
    if ($_SERVER["REQUEST_METHOD"] === "POST") {
        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($input)) {
            respond(400, [
                "success" => false,
                "message" => "Invalid request data."
            ]);
        }

        $defenseId = (int)($input["defense_id"] ?? 0);
        $action = trim((string)($input["action"] ?? ""));
        $scheduledAt = trim((string)($input["scheduled_at"] ?? ""));
        $venue = trim((string)($input["venue"] ?? ""));
        $meetingLink = trim((string)($input["meeting_link"] ?? ""));
        $outcome = trim((string)($input["outcome"] ?? "Pending"));
        $feedback = trim((string)($input["outcome_feedback"] ?? ""));

        $allowedActions = [
            "approve",
            "schedule",
            "complete",
            "cancel"
        ];

        if (
            $defenseId <= 0 ||
            !in_array($action, $allowedActions, true)
        ) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid defense and action."
            ]);
        }

        /*
         * Retrieve the defense, student account, and project details.
         * The supervisor ownership check is retained.
         */
        $check = $pdo->prepare("
            SELECT
                td.id,
                td.status,
                td.scheduled_at,
                td.venue,
                td.meeting_link,
                td.outcome,
                td.outcome_feedback,
                rp.title AS project_title,
                s.user_id AS student_user_id
            FROM thesis_defenses td
            INNER JOIN research_projects rp
                ON rp.id = td.research_project_id
            INNER JOIN students s
                ON s.id = rp.student_id
            WHERE td.id = ?
              AND rp.supervisor_id = ?
            LIMIT 1
        ");

        $check->execute([$defenseId, $supervisorId]);
        $defense = $check->fetch(PDO::FETCH_ASSOC);

        if (!$defense) {
            respond(404, [
                "success" => false,
                "message" => "Defense not found or not assigned to you."
            ]);
        }

        $currentStatus = $defense["status"];

        if (in_array($currentStatus, ["Completed", "Cancelled"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Completed or cancelled defenses cannot be changed."
            ]);
        }

        $newStatus = $currentStatus;
        $newScheduledAt = $defense["scheduled_at"];
        $newVenue = $defense["venue"];
        $newMeetingLink = $defense["meeting_link"];
        $newOutcome = $defense["outcome"];
        $newFeedback = $defense["outcome_feedback"];

        if ($action === "approve") {
            if (!in_array($currentStatus, ["Requested", "Approved"], true)) {
                respond(422, [
                    "success" => false,
                    "message" => "Only requested defenses can be approved."
                ]);
            }

            $newStatus = "Approved";
        }

        if ($action === "schedule") {
            if (
                !in_array(
                    $currentStatus,
                    ["Requested", "Approved", "Scheduled"],
                    true
                ) ||
                $scheduledAt === "" ||
                $venue === ""
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "Provide a valid date/time and venue or meeting location."
                ]);
            }

            $date = DateTime::createFromFormat(
                "Y-m-d\TH:i",
                $scheduledAt
            );

            if (
                !$date ||
                $date->format("Y-m-d\TH:i") !== $scheduledAt
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "Invalid defense date or time."
                ]);
            }

            if ($date <= new DateTime()) {
                respond(422, [
                    "success" => false,
                    "message" => "The defense must be scheduled for a future date and time."
                ]);
            }

            if (
                $meetingLink !== "" &&
                !filter_var($meetingLink, FILTER_VALIDATE_URL)
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "Enter a valid meeting link."
                ]);
            }

            $newStatus = "Scheduled";
            $newScheduledAt = $date->format("Y-m-d H:i:s");
            $newVenue = $venue;
            $newMeetingLink = $meetingLink !== ""
                ? $meetingLink
                : null;
        }

        if ($action === "complete") {
            $allowedOutcomes = [
                "Passed",
                "Passed with Revisions",
                "Re-examination Required",
                "Failed"
            ];

            if (
                $currentStatus !== "Scheduled" ||
                !in_array($outcome, $allowedOutcomes, true)
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "Schedule the defense first and select a valid outcome."
                ]);
            }

            if ($feedback === "") {
                respond(422, [
                    "success" => false,
                    "message" => "Enter feedback before completing the defense."
                ]);
            }

            $newStatus = "Completed";
            $newOutcome = $outcome;
            $newFeedback = $feedback;
        }

        if ($action === "cancel") {
            $newStatus = "Cancelled";
        }

        /*
         * Update the defense and notification atomically.
         */
        $pdo->beginTransaction();

        if ($action === "approve") {
            $update = $pdo->prepare("
                UPDATE thesis_defenses
                SET status = 'Approved'
                WHERE id = ?
            ");
            $update->execute([$defenseId]);
        }

        if ($action === "schedule") {
            $update = $pdo->prepare("
                UPDATE thesis_defenses
                SET status = 'Scheduled',
                    scheduled_at = ?,
                    venue = ?,
                    meeting_link = ?
                WHERE id = ?
            ");

            $update->execute([
                $newScheduledAt,
                $newVenue,
                $newMeetingLink,
                $defenseId
            ]);
        }

        if ($action === "complete") {
            $update = $pdo->prepare("
                UPDATE thesis_defenses
                SET status = 'Completed',
                    outcome = ?,
                    outcome_feedback = ?
                WHERE id = ?
            ");

            $update->execute([
                $newOutcome,
                $newFeedback,
                $defenseId
            ]);
        }

        if ($action === "cancel") {
            $update = $pdo->prepare("
                UPDATE thesis_defenses
                SET status = 'Cancelled'
                WHERE id = ?
            ");
            $update->execute([$defenseId]);
        }

        saveDefenseNotification(
            $pdo,
            (int)$defense["student_user_id"],
            $defenseId,
            (string)$defense["project_title"],
            $newStatus,
            $newScheduledAt,
            $newVenue,
            $newMeetingLink,
            $newOutcome,
            $newFeedback
        );

        $pdo->commit();

        respond(200, [
            "success" => true,
            "message" => "Thesis defense updated and student notification saved."
        ]);
    }

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "Supervisor thesis defense error: " . $e->getMessage()
    );

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing thesis defenses."
    ]);
}
