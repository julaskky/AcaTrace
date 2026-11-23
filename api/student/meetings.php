<?php
// File: api/student/meetings.php

session_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../config/database.php";

function respond($success, $message, $data = null, $code = 200)
{
    http_response_code($code);

    $response = [
        "success" => $success,
        "message" => $message
    ];

    if ($data !== null) {
        $response["data"] = $data;
    }

    echo json_encode($response);
    exit;
}

function getInput()
{
    $input = json_decode(file_get_contents("php://input"), true);
    return is_array($input) ? $input : [];
}

function getStudentId(PDO $pdo, $userId)
{
    $stmt = $pdo->prepare(
        "SELECT id FROM students WHERE user_id = :user_id LIMIT 1"
    );

    $stmt->execute(["user_id" => $userId]);

    $student = $stmt->fetch(PDO::FETCH_ASSOC);

    return $student ? (int) $student["id"] : null;
}

try {
    if (empty($_SESSION["user_id"])) {
        respond(false, "Please log in to continue.", null, 401);
    }

    $userId = (int) $_SESSION["user_id"];
    $role = strtolower(trim($_SESSION["role"] ?? $_SESSION["user_type"] ?? ""));

    if (!in_array($role, ["student", "job_seeker"], true)) {
        respond(false, "This endpoint is for student accounts only.", null, 403);
    }

    $studentId = getStudentId($pdo, $userId);

    if (!$studentId) {
        respond(false, "No student profile is linked to your account.", null, 403);
    }

    $method = $_SERVER["REQUEST_METHOD"];

    /*
    |--------------------------------------------------------------------------
    | GET: Retrieve the student's meetings and history
    |--------------------------------------------------------------------------
    */
    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                m.id,
                m.research_project_id,
                m.title,
                m.agenda,
                m.meeting_date,
                m.start_time,
                m.end_time,
                m.meeting_mode,
                m.meeting_location,
                m.meeting_link,
                m.status,
                m.notes,
                m.request_reason,
                m.response_note,
                m.requested_by,
                m.response_status,
                m.created_at,
                rp.title AS project_title,
                s.id AS supervisor_id,
                CONCAT(
                    COALESCE(su.first_name, ''),
                    ' ',
                    COALESCE(su.last_name, '')
                ) AS supervisor_name
            FROM meetings m
            LEFT JOIN research_projects rp
                ON rp.id = m.research_project_id
            LEFT JOIN supervisors s
                ON s.id = m.supervisor_id
            LEFT JOIN users su
                ON su.id = s.user_id
            WHERE m.student_id = :student_id
            ORDER BY m.meeting_date DESC, m.start_time DESC, m.id DESC
        ");

        $stmt->execute(["student_id" => $studentId]);

        respond(
            true,
            "Meetings retrieved successfully.",
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    /*
    |--------------------------------------------------------------------------
    | POST: Request a meeting and notify the assigned supervisor
    |--------------------------------------------------------------------------
    */
    if ($method === "POST") {
        $input = getInput();

        $projectId = filter_var(
            $input["research_project_id"] ?? null,
            FILTER_VALIDATE_INT
        );

        $title = trim($input["title"] ?? "");
        $reason = trim($input["request_reason"] ?? "");
        $meetingDate = trim($input["meeting_date"] ?? "");
        $startTime = trim($input["start_time"] ?? "");
        $endTime = trim($input["end_time"] ?? "");
        $meetingMode = trim($input["meeting_mode"] ?? "Online");
        $location = trim($input["meeting_location"] ?? "");
        $meetingLink = trim($input["meeting_link"] ?? "");
        $agenda = trim($input["agenda"] ?? "");

        if (
            !$projectId ||
            $title === "" ||
            $reason === "" ||
            $meetingDate === "" ||
            $startTime === "" ||
            $endTime === ""
        ) {
            respond(
                false,
                "Project, meeting title, reason, date, start time and end time are required.",
                null,
                422
            );
        }

        if (!in_array($meetingMode, ["Online", "In-person"], true)) {
            respond(false, "Invalid meeting mode.", null, 422);
        }

        $dateObject = DateTime::createFromFormat("!Y-m-d", $meetingDate);

        if (!$dateObject || $dateObject->format("Y-m-d") !== $meetingDate) {
            respond(false, "Please provide a valid meeting date.", null, 422);
        }

        if (
            !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $startTime) ||
            !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $endTime) ||
            $startTime >= $endTime
        ) {
            respond(false, "Please provide valid meeting times.", null, 422);
        }

        if ($meetingDate < date("Y-m-d")) {
            respond(false, "A meeting request must use a future date.", null, 422);
        }

        if (
            $meetingMode === "Online" &&
            $meetingLink !== "" &&
            !filter_var($meetingLink, FILTER_VALIDATE_URL)
        ) {
            respond(false, "Please enter a valid meeting link.", null, 422);
        }

        /*
         * Confirm that the research project belongs to the student.
         */
        $projectStmt = $pdo->prepare("
            SELECT id, supervisor_id
            FROM research_projects
            WHERE id = :project_id
              AND student_id = :student_id
            LIMIT 1
        ");

        $projectStmt->execute([
            "project_id" => $projectId,
            "student_id" => $studentId
        ]);

        $project = $projectStmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(
                false,
                "The selected research project was not found in your account.",
                null,
                404
            );
        }

        if (empty($project["supervisor_id"])) {
            respond(
                false,
                "This project does not have an assigned supervisor.",
                null,
                422
            );
        }

        /*
         * Save the meeting and supervisor notification together.
         * If either operation fails, both are rolled back.
         */
        $pdo->beginTransaction();

        try {
            $insert = $pdo->prepare("
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
                    request_reason,
                    response_note,
                    requested_by,
                    response_status
                ) VALUES (
                    :project_id,
                    :supervisor_id,
                    :student_id,
                    :title,
                    :agenda,
                    :meeting_date,
                    :start_time,
                    :end_time,
                    :meeting_mode,
                    :meeting_location,
                    :meeting_link,
                    'Scheduled',
                    NULL,
                    :request_reason,
                    NULL,
                    'student',
                    'Pending'
                )
            ");

            $insert->execute([
                "project_id" => $projectId,
                "supervisor_id" => (int) $project["supervisor_id"],
                "student_id" => $studentId,
                "title" => $title,
                "agenda" => $agenda,
                "meeting_date" => $meetingDate,
                "start_time" => $startTime,
                "end_time" => $endTime,
                "meeting_mode" => $meetingMode,
                "meeting_location" => $location,
                "meeting_link" => $meetingLink,
                "request_reason" => $reason
            ]);

            $meetingId = (int) $pdo->lastInsertId();

            /*
             * Notify the supervisor assigned to this research project.
             * source_key uniquely identifies this meeting request.
             */
            $sourceKey = "meeting_request_" . $meetingId;

            $notificationTitle = "New Meeting Request";

            $notificationMessage =
                "A student has requested a meeting titled \"" .
                $title .
                "\" for " .
                $meetingDate .
                " from " .
                substr($startTime, 0, 5) .
                " to " .
                substr($endTime, 0, 5) .
                ". Please review the request in your Meetings section.";

            $notificationStmt = $pdo->prepare("
                INSERT INTO supervisor_notifications (
                    supervisor_id,
                    title,
                    message,
                    notification_type,
                    priority,
                    source_key
                ) VALUES (
                    :supervisor_id,
                    :title,
                    :message,
                    'Meeting',
                    'High',
                    :source_key
                )
                ON DUPLICATE KEY UPDATE id = id
            ");

            $notificationStmt->execute([
                "supervisor_id" => (int) $project["supervisor_id"],
                "title" => $notificationTitle,
                "message" => $notificationMessage,
                "source_key" => $sourceKey
            ]);

            $pdo->commit();

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }

        respond(
            true,
            "Your meeting request has been submitted to your supervisor.",
            ["id" => $meetingId],
            201
        );
    }

    /*
    |--------------------------------------------------------------------------
    | PUT: Respond to a supervisor's meeting or update personal notes
    |--------------------------------------------------------------------------
    */
    if ($method === "PUT") {
        $input = getInput();

        $meetingId = filter_var(
            $input["id"] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$meetingId) {
            respond(false, "A valid meeting ID is required.", null, 422);
        }

        $stmt = $pdo->prepare("
            SELECT id, requested_by, response_status
            FROM meetings
            WHERE id = :meeting_id
              AND student_id = :student_id
            LIMIT 1
        ");

        $stmt->execute([
            "meeting_id" => $meetingId,
            "student_id" => $studentId
        ]);

        $meeting = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$meeting) {
            respond(false, "Meeting not found in your account.", null, 404);
        }

        $action = strtolower(trim($input["action"] ?? ""));

        if ($action === "respond") {
            $decision = trim($input["response_status"] ?? "");
            $responseNote = trim($input["response_note"] ?? "");

            if (!in_array($decision, ["Accepted", "Declined"], true)) {
                respond(
                    false,
                    "Your response must be Accepted or Declined.",
                    null,
                    422
                );
            }

            if ($decision === "Declined" && $responseNote === "") {
                respond(
                    false,
                    "Please provide a reason for declining the meeting.",
                    null,
                    422
                );
            }

            if ($meeting["requested_by"] === "student") {
                respond(
                    false,
                    "You cannot accept or decline your own meeting request.",
                    null,
                    403
                );
            }

            if ($meeting["response_status"] !== "Pending") {
                respond(
                    false,
                    "You have already responded to this meeting.",
                    null,
                    409
                );
            }

            $update = $pdo->prepare("
                UPDATE meetings
                SET response_status = :response_status,
                    response_note = :response_note
                WHERE id = :meeting_id
                  AND student_id = :student_id
                  AND requested_by = 'supervisor'
                  AND response_status = 'Pending'
            ");

            $update->execute([
                "response_status" => $decision,
                "response_note" => $responseNote !== "" ? $responseNote : null,
                "meeting_id" => $meetingId,
                "student_id" => $studentId
            ]);

            if ($update->rowCount() === 0) {
                respond(
                    false,
                    "The meeting response could not be saved. Please refresh and try again.",
                    null,
                    409
                );
            }

            respond(
                true,
                $decision === "Accepted"
                    ? "You have accepted the meeting."
                    : "You have declined the meeting."
            );
        }

        if ($action === "notes") {
            $notes = trim($input["notes"] ?? "");

            $update = $pdo->prepare("
                UPDATE meetings
                SET notes = :notes
                WHERE id = :meeting_id
                  AND student_id = :student_id
            ");

            $update->execute([
                "notes" => $notes !== "" ? $notes : null,
                "meeting_id" => $meetingId,
                "student_id" => $studentId
            ]);

            respond(true, "Your personal meeting notes have been saved.");
        }

        respond(
            false,
            "Invalid action. Use 'respond' or 'notes'.",
            null,
            422
        );
    }

    respond(false, "Method not allowed.", null, 405);

} catch (PDOException $e) {
    error_log("Student meetings database error: " . $e->getMessage());

    respond(
        false,
        "A database error occurred while processing meetings. Check the PHP error log for details.",
        null,
        500
    );
} catch (Throwable $e) {
    error_log("Student meetings API error: " . $e->getMessage());

    respond(
        false,
        "An unexpected error occurred while processing meetings.",
        null,
        500
    );
}
