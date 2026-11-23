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

function validateTimetableData(array $data): array
{
    $title = trim((string)($data["title"] ?? ""));
    $defenseDate = trim((string)($data["defense_date"] ?? ""));
    $startTime = trim((string)($data["start_time"] ?? ""));
    $endTime = trim((string)($data["end_time"] ?? ""));
    $venue = trim((string)($data["venue"] ?? ""));
    $meetingLink = trim((string)($data["meeting_link"] ?? ""));
    $instructions = trim((string)($data["instructions"] ?? ""));

    if (
        $title === "" ||
        $defenseDate === "" ||
        $startTime === "" ||
        $venue === ""
    ) {
        throw new InvalidArgumentException(
            "Title, defense date, start time, and venue are required."
        );
    }

    if (strlen($title) > 255 || strlen($venue) > 255) {
        throw new InvalidArgumentException(
            "The title and venue must not exceed 255 characters."
        );
    }

    if (strlen($meetingLink) > 500) {
        throw new InvalidArgumentException(
            "The meeting link must not exceed 500 characters."
        );
    }

    // Validate the date.
    $date = DateTime::createFromFormat("!Y-m-d", $defenseDate);
    $dateErrors = DateTime::getLastErrors();

    if (
        !$date ||
        ($dateErrors !== false &&
            ($dateErrors["warning_count"] > 0 ||
             $dateErrors["error_count"] > 0)) ||
        $date->format("Y-m-d") !== $defenseDate
    ) {
        throw new InvalidArgumentException(
            "Enter a valid defense date."
        );
    }

    // Accept times from HTML time inputs in HH:MM format.
    if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $startTime)) {
        throw new InvalidArgumentException(
            "Enter a valid start time."
        );
    }

    $startTime .= ":00";

    if ($endTime !== "") {
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $endTime)) {
            throw new InvalidArgumentException(
                "Enter a valid end time."
            );
        }

        $endTime .= ":00";

        if ($endTime <= $startTime) {
            throw new InvalidArgumentException(
                "The end time must be later than the start time."
            );
        }
    } else {
        $endTime = null;
    }

    if (
        $meetingLink !== "" &&
        (
            !filter_var($meetingLink, FILTER_VALIDATE_URL) ||
            !in_array(
                strtolower((string)parse_url($meetingLink, PHP_URL_SCHEME)),
                ["http", "https"],
                true
            )
        )
    ) {
        throw new InvalidArgumentException(
            "Enter a valid HTTP or HTTPS meeting link."
        );
    }

    return [
        "title" => $title,
        "defense_date" => $defenseDate,
        "start_time" => $startTime,
        "end_time" => $endTime,
        "venue" => $venue,
        "meeting_link" => $meetingLink !== "" ? $meetingLink : null,
        "instructions" => $instructions !== "" ? $instructions : null
    ];
}

/**
 * Get the user accounts of all students currently supervised
 * by this supervisor. DISTINCT prevents duplicate recipients
 * when a student has multiple research-project records.
 */
function getSupervisedStudentUserIds(
    PDO $pdo,
    int $supervisorId
): array {
    $stmt = $pdo->prepare("
        SELECT DISTINCT s.user_id
        FROM research_projects rp
        INNER JOIN students s ON s.id = rp.student_id
        WHERE rp.supervisor_id = ?
          AND s.user_id IS NOT NULL
    ");

    $stmt->execute([$supervisorId]);

    return array_map(
        "intval",
        $stmt->fetchAll(PDO::FETCH_COLUMN)
    );
}

/**
 * Create or update notifications for the timetable's recipients.
 *
 * Previously notified students remain recipients for updates and
 * cancellations, even if their supervision assignment later changes.
 */
function notifyTimetableStudents(
    PDO $pdo,
    int $supervisorId,
    array $timetable,
    string $event
): int {
    $timetableId = (int)$timetable["id"];
    $sourceKey = "defense_timetable_" . $timetableId;

    $studentIds = getSupervisedStudentUserIds(
        $pdo,
        $supervisorId
    );

    // Include existing recipients so they also receive later changes.
    $existingRecipients = $pdo->prepare("
        SELECT DISTINCT user_id
        FROM student_notifications
        WHERE source_key = ?
    ");
    $existingRecipients->execute([$sourceKey]);

    $studentIds = array_unique(array_merge(
        $studentIds,
        array_map(
            "intval",
            $existingRecipients->fetchAll(PDO::FETCH_COLUMN)
        )
    ));

    $studentIds = array_values(array_filter(
        $studentIds,
        fn($id) => $id > 0
    ));

    $dateText = date(
        "d M Y",
        strtotime((string)$timetable["defense_date"])
    );

    $startText = date(
        "h:i A",
        strtotime((string)$timetable["start_time"])
    );

    $timeText = $startText;

    if (!empty($timetable["end_time"])) {
        $timeText .= " - " . date(
            "h:i A",
            strtotime((string)$timetable["end_time"])
        );
    }

    $status = (string)$timetable["status"];

    if ($status === "Cancelled") {
        $title = "Thesis Defense Timetable Cancelled";
        $priority = "High";
        $message = "The thesis defense timetable \"" .
            $timetable["title"] . "\" scheduled for " .
            $dateText . " has been cancelled.";
    } elseif ($event === "published") {
        $title = "Thesis Defense Timetable Published";
        $priority = "Normal";
        $message = "A thesis defense timetable has been published: \"" .
            $timetable["title"] . "\". Date: " . $dateText .
            ". Time: " . $timeText .
            ". Venue: " . $timetable["venue"] . ".";
    } else {
        $title = "Thesis Defense Timetable Updated";
        $priority = "Normal";
        $message = "The thesis defense timetable \"" .
            $timetable["title"] . "\" has been updated. Date: " .
            $dateText . ". Time: " . $timeText .
            ". Venue: " . $timetable["venue"] . ".";
    }

    if ($status !== "Cancelled" && !empty($timetable["meeting_link"])) {
        $message .= " Online meeting link: " .
            $timetable["meeting_link"] . ".";
    }

    if ($status !== "Cancelled" && !empty($timetable["instructions"])) {
        $message .= " Instructions: " . $timetable["instructions"];
    }

    $find = $pdo->prepare("
        SELECT id
        FROM student_notifications
        WHERE user_id = ?
          AND source_key = ?
        ORDER BY id ASC
        LIMIT 1
    ");

    $insert = $pdo->prepare("
        INSERT INTO student_notifications (
            user_id,
            title,
            message,
            notification_type,
            priority,
            requires_action,
            action_url,
            source_key
        ) VALUES (?, ?, ?, 'Thesis Defense', ?, 0, NULL, ?)
    ");

    $update = $pdo->prepare("
        UPDATE student_notifications
        SET title = ?,
            message = ?,
            notification_type = 'Thesis Defense',
            priority = ?,
            requires_action = 0,
            action_url = NULL,
            is_read = 0,
            read_at = NULL,
            dismissed_at = NULL
        WHERE id = ?
    ");

    foreach ($studentIds as $studentId) {
        $find->execute([$studentId, $sourceKey]);
        $notificationId = $find->fetchColumn();

        if ($notificationId) {
            $update->execute([
                $title,
                $message,
                $priority,
                (int)$notificationId
            ]);
        } else {
            $insert->execute([
                $studentId,
                $title,
                $message,
                $priority,
                $sourceKey
            ]);
        }
    }

    return count($studentIds);
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
     * GET: List this supervisor's timetables.
     */
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                t.*,
                (
                    SELECT COUNT(DISTINCT s.user_id)
                    FROM research_projects rp
                    INNER JOIN students s ON s.id = rp.student_id
                    WHERE rp.supervisor_id = t.supervisor_id
                ) AS supervised_student_count
            FROM thesis_defense_timetables t
            WHERE t.supervisor_id = ?
            ORDER BY t.defense_date DESC, t.start_time DESC, t.id DESC
        ");

        $stmt->execute([$supervisorId]);

        respond(200, [
            "success" => true,
            "timetables" => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, [
            "success" => false,
            "message" => "Method not allowed."
        ]);
    }

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

    $action = trim((string)($input["action"] ?? ""));
    $timetableId = (int)($input["timetable_id"] ?? 0);

    $allowedActions = [
        "create",
        "update",
        "publish",
        "cancel"
    ];

    if (!in_array($action, $allowedActions, true)) {
        respond(422, [
            "success" => false,
            "message" => "Invalid timetable action."
        ]);
    }

    /*
     * CREATE: Save a new timetable as a draft.
     * Drafts do not send student notifications.
     */
    if ($action === "create") {
        try {
            $data = validateTimetableData($input);
        } catch (InvalidArgumentException $e) {
            respond(422, [
                "success" => false,
                "message" => $e->getMessage()
            ]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO thesis_defense_timetables (
                supervisor_id,
                title,
                defense_date,
                start_time,
                end_time,
                venue,
                meeting_link,
                instructions,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft')
        ");

        $stmt->execute([
            $supervisorId,
            $data["title"],
            $data["defense_date"],
            $data["start_time"],
            $data["end_time"],
            $data["venue"],
            $data["meeting_link"],
            $data["instructions"]
        ]);

        respond(201, [
            "success" => true,
            "message" => "Defense timetable saved as a draft.",
            "timetable_id" => (int)$pdo->lastInsertId()
        ]);
    }

    if ($timetableId <= 0) {
        respond(422, [
            "success" => false,
            "message" => "A valid timetable ID is required."
        ]);
    }

    $stmt = $pdo->prepare("
        SELECT *
        FROM thesis_defense_timetables
        WHERE id = ?
          AND supervisor_id = ?
        LIMIT 1
    ");

    $stmt->execute([$timetableId, $supervisorId]);
    $timetable = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$timetable) {
        respond(404, [
            "success" => false,
            "message" => "Timetable not found or not assigned to you."
        ]);
    }

    if ($timetable["status"] === "Cancelled") {
        respond(422, [
            "success" => false,
            "message" => "A cancelled timetable cannot be changed or republished."
        ]);
    }

    /*
     * UPDATE: Update timetable information.
     * Published timetable changes also update notifications.
     */
    if ($action === "update") {
        $merged = $input;

        foreach ([
            "title",
            "defense_date",
            "start_time",
            "venue"
        ] as $requiredField) {
            if (!array_key_exists($requiredField, $merged)) {
                $merged[$requiredField] = $timetable[$requiredField];
            }
        }

        foreach ([
            "end_time",
            "meeting_link",
            "instructions"
        ] as $optionalField) {
            if (!array_key_exists($optionalField, $merged)) {
                $merged[$optionalField] = $timetable[$optionalField] ?? "";
            }
        }

        // Convert existing database time values to HTML time format.
        if (isset($merged["start_time"])) {
            $merged["start_time"] = substr(
                (string)$merged["start_time"],
                0,
                5
            );
        }

        if (!empty($merged["end_time"])) {
            $merged["end_time"] = substr(
                (string)$merged["end_time"],
                0,
                5
            );
        }

        try {
            $data = validateTimetableData($merged);
        } catch (InvalidArgumentException $e) {
            respond(422, [
                "success" => false,
                "message" => $e->getMessage()
            ]);
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE thesis_defense_timetables
            SET title = ?,
                defense_date = ?,
                start_time = ?,
                end_time = ?,
                venue = ?,
                meeting_link = ?,
                instructions = ?
            WHERE id = ?
              AND supervisor_id = ?
        ");

        $stmt->execute([
            $data["title"],
            $data["defense_date"],
            $data["start_time"],
            $data["end_time"],
            $data["venue"],
            $data["meeting_link"],
            $data["instructions"],
            $timetableId,
            $supervisorId
        ]);

        if ($timetable["status"] === "Published") {
            $timetable = array_merge($timetable, $data);

            notifyTimetableStudents(
                $pdo,
                $supervisorId,
                $timetable,
                "updated"
            );
        }

        $pdo->commit();

        respond(200, [
            "success" => true,
            "message" => "Defense timetable updated successfully."
        ]);
    }

    /*
     * PUBLISH: Publish a draft or refresh notifications
     * for an already published timetable.
     */
    if ($action === "publish") {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE thesis_defense_timetables
            SET status = 'Published'
            WHERE id = ?
              AND supervisor_id = ?
        ");

        $stmt->execute([$timetableId, $supervisorId]);

        $timetable["status"] = "Published";

        $recipientCount = notifyTimetableStudents(
            $pdo,
            $supervisorId,
            $timetable,
            $timetable["status"] === "Published" &&
            ($timetable["created_at"] ?? "") === ""
                ? "published"
                : "published"
        );

        $pdo->commit();

        respond(200, [
            "success" => true,
            "message" => "Defense timetable published and student notifications updated.",
            "notified_students" => $recipientCount
        ]);
    }

    /*
     * CANCEL: Cancel the timetable and update existing notifications.
     */
    if ($action === "cancel") {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE thesis_defense_timetables
            SET status = 'Cancelled'
            WHERE id = ?
              AND supervisor_id = ?
        ");

        $stmt->execute([$timetableId, $supervisorId]);

        $timetable["status"] = "Cancelled";

        $recipientCount = 0;

        // Do not announce cancellation of a draft that was never published.
        if ($timetable["status"] === "Cancelled") {
            $existing = $pdo->prepare("
                SELECT COUNT(*)
                FROM student_notifications
                WHERE source_key = ?
            ");
            $existing->execute([
                "defense_timetable_" . $timetableId
            ]);

            $hasPreviousNotifications = (int)$existing->fetchColumn() > 0;

            if ($hasPreviousNotifications) {
                $recipientCount = notifyTimetableStudents(
                    $pdo,
                    $supervisorId,
                    $timetable,
                    "cancelled"
                );
            }
        }

        $pdo->commit();

        respond(200, [
            "success" => true,
            "message" => "Defense timetable cancelled successfully.",
            "notified_students" => $recipientCount
        ]);
    }

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "Defense timetable API error: " . $e->getMessage()
    );

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing the defense timetable."
    ]);
}
