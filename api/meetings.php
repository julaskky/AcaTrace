
<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

session_start();
require_once __DIR__ . "/config/database.php";

function respond($status, $data) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function inputData() {
    $data = json_decode(file_get_contents("php://input"), true);
    return is_array($data) ? $data : [];
}

function validDate($value) {
    if (!is_string($value)) return false;
    $date = DateTime::createFromFormat("!Y-m-d", $value);
    return $date && $date->format("Y-m-d") === $value;
}

function validTime($value) {
    if (!is_string($value)) return false;
    $time = DateTime::createFromFormat("!H:i", substr($value, 0, 5));
    return $time && $time->format("H:i") === substr($value, 0, 5);
}

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    respond(401, [
        "success" => false,
        "message" => "Please log in."
    ]);
}

$userId = (int) $_SESSION["user_id"];
$role = $_SESSION["role"];
$method = $_SERVER["REQUEST_METHOD"];

try {
    /*
    |----------------------------------------------------------
    | LIST MEETINGS
    |----------------------------------------------------------
    */
    if ($method === "GET") {
        $sql = "
            SELECT
                m.*,
                rp.title AS project_title,
                CONCAT(su.first_name, ' ', su.last_name)
                    AS supervisor_name,
                CONCAT(stu.first_name, ' ', stu.last_name)
                    AS student_name
            FROM meetings m
            INNER JOIN research_projects rp
                ON rp.id = m.research_project_id
            INNER JOIN students s
                ON s.id = m.student_id
            INNER JOIN users stu
                ON stu.id = s.user_id
            INNER JOIN supervisors sp
                ON sp.id = m.supervisor_id
            INNER JOIN users su
                ON su.id = sp.user_id
        ";

        $params = [];

        if ($role === "student") {
            $sql .= " WHERE s.user_id = ?";
            $params[] = $userId;
        } elseif ($role === "supervisor") {
            $sql .= " WHERE sp.user_id = ?";
            $params[] = $userId;
        } elseif ($role !== "admin") {
            respond(403, [
                "success" => false,
                "message" => "Access denied."
            ]);
        }

        $sql .= " ORDER BY m.meeting_date DESC, m.start_time DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        respond(200, [
            "success" => true,
            "meetings" => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    /*
    |----------------------------------------------------------
    | CREATE MEETING
    |----------------------------------------------------------
    */
    if ($method === "POST") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can schedule meetings."
            ]);
        }

        $data = inputData();

        $projectId = (int) ($data["research_project_id"] ?? 0);
        $title = trim($data["title"] ?? "");
        $agenda = trim($data["agenda"] ?? "");
        $date = $data["meeting_date"] ?? "";
        $start = $data["start_time"] ?? "";
        $end = $data["end_time"] ?? "";
        $mode = $data["meeting_mode"] ?? "Online";
        $location = trim($data["meeting_location"] ?? "");
        $link = trim($data["meeting_link"] ?? "");

        if (!$projectId || $title === "" || !validDate($date) ||
            !validTime($start)) {
            respond(422, [
                "success" => false,
                "message" => "Project, title, valid date, and start time are required."
            ]);
        }

        if ($end !== "" && !validTime($end)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid end time."
            ]);
        }

        if ($end !== "" && substr($end, 0, 5) <= substr($start, 0, 5)) {
            respond(422, [
                "success" => false,
                "message" => "End time must be later than start time."
            ]);
        }

        if (!in_array($mode, ["Online", "In-person"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid meeting mode."
            ]);
        }

        if ($mode === "Online" && $link !== "" &&
            !filter_var($link, FILTER_VALIDATE_URL)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid meeting URL."
            ]);
        }

        $stmt = $pdo->prepare("
            SELECT id, student_id, supervisor_id
            FROM research_projects
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([$projectId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, [
                "success" => false,
                "message" => "Research project not found."
            ]);
        }

        if (!$project["supervisor_id"]) {
            respond(422, [
                "success" => false,
                "message" => "Assign a supervisor to this project before scheduling a meeting."
            ]);
        }

        if ($role === "supervisor") {
            $stmt = $pdo->prepare("
                SELECT id FROM supervisors
                WHERE user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            $currentSupervisorId = (int) $stmt->fetchColumn();

            if (!$currentSupervisorId ||
                $currentSupervisorId !== (int) $project["supervisor_id"]) {
                respond(403, [
                    "success" => false,
                    "message" => "You can only schedule meetings for your assigned projects."
                ]);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO meetings (
                research_project_id, supervisor_id, student_id,
                title, agenda, meeting_date, start_time, end_time,
                meeting_mode, meeting_location, meeting_link
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $projectId,
            (int) $project["supervisor_id"],
            (int) $project["student_id"],
            $title,
            $agenda ?: null,
            $date,
            substr($start, 0, 5),
            $end !== "" ? substr($end, 0, 5) : null,
            $mode,
            $location ?: null,
            $link ?: null
        ]);

        respond(201, [
            "success" => true,
            "message" => "Meeting scheduled successfully.",
            "meeting_id" => (int) $pdo->lastInsertId()
        ]);
    }

    /*
    |----------------------------------------------------------
    | UPDATE MEETING
    |----------------------------------------------------------
    */
    if ($method === "PUT") {
        $data = inputData();
        $meetingId = (int) ($data["id"] ?? 0);

        if (!$meetingId) {
            respond(422, [
                "success" => false,
                "message" => "A valid meeting ID is required."
            ]);
        }

        $stmt = $pdo->prepare("
            SELECT
                m.*,
                sp.user_id AS supervisor_user_id,
                s.user_id AS student_user_id
            FROM meetings m
            INNER JOIN supervisors sp ON sp.id = m.supervisor_id
            INNER JOIN students s ON s.id = m.student_id
            WHERE m.id = ?
            LIMIT 1
        ");
        $stmt->execute([$meetingId]);
        $meeting = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$meeting) {
            respond(404, [
                "success" => false,
                "message" => "Meeting not found."
            ]);
        }

        $isAdmin = $role === "admin";
        $isSupervisor = $role === "supervisor" &&
            (int) $meeting["supervisor_user_id"] === $userId;
        $isStudent = $role === "student" &&
            (int) $meeting["student_user_id"] === $userId;

        if (!$isAdmin && !$isSupervisor && !$isStudent) {
            respond(403, [
                "success" => false,
                "message" => "You cannot update this meeting."
            ]);
        }

        // Students may add or update notes, but cannot alter meeting details.
        if ($isStudent && !$isAdmin && !$isSupervisor) {
            if (array_key_exists("notes", $data)) {
                $notes = trim($data["notes"] ?? "");
                $stmt = $pdo->prepare("
                    UPDATE meetings SET notes = ? WHERE id = ?
                ");
                $stmt->execute([$notes ?: null, $meetingId]);
            }

            respond(200, [
                "success" => true,
                "message" => "Meeting notes updated successfully."
            ]);
        }

        $title = trim($data["title"] ?? $meeting["title"]);
        $agenda = trim($data["agenda"] ?? ($meeting["agenda"] ?? ""));
        $date = $data["meeting_date"] ?? $meeting["meeting_date"];
        $start = $data["start_time"] ?? $meeting["start_time"];
        $end = $data["end_time"] ?? ($meeting["end_time"] ?? "");
        $mode = $data["meeting_mode"] ?? $meeting["meeting_mode"];
        $location = trim(
            $data["meeting_location"] ?? ($meeting["meeting_location"] ?? "")
        );
        $link = trim($data["meeting_link"] ?? ($meeting["meeting_link"] ?? ""));
        $status = $data["status"] ?? $meeting["status"];
        $notes = trim($data["notes"] ?? ($meeting["notes"] ?? ""));

        if ($title === "" || !validDate($date) || !validTime($start)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid title, date, and start time."
            ]);
        }

        if ($end !== "" && !validTime($end)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid end time."
            ]);
        }

        if ($end !== "" && substr($end, 0, 5) <= substr($start, 0, 5)) {
            respond(422, [
                "success" => false,
                "message" => "End time must be later than start time."
            ]);
        }

        if (!in_array($mode, ["Online", "In-person"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid meeting mode."
            ]);
        }

        if (!in_array($status, ["Scheduled", "Completed", "Cancelled"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid meeting status."
            ]);
        }

        if ($mode === "Online" && $link !== "" &&
            !filter_var($link, FILTER_VALIDATE_URL)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid meeting URL."
            ]);
        }

        $stmt = $pdo->prepare("
            UPDATE meetings
            SET title = ?, agenda = ?, meeting_date = ?,
                start_time = ?, end_time = ?, meeting_mode = ?,
                meeting_location = ?, meeting_link = ?,
                status = ?, notes = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $title,
            $agenda ?: null,
            $date,
            substr($start, 0, 5),
            $end !== "" ? substr($end, 0, 5) : null,
            $mode,
            $location ?: null,
            $link ?: null,
            $status,
            $notes ?: null,
            $meetingId
        ]);

        respond(200, [
            "success" => true,
            "message" => "Meeting updated successfully."
        ]);
    }

    /*
    |----------------------------------------------------------
    | DELETE MEETING
    |----------------------------------------------------------
    */
    if ($method === "DELETE") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can delete meetings."
            ]);
        }

        $data = inputData();
        $meetingId = (int) ($data["id"] ?? 0);

        if (!$meetingId) {
            respond(422, [
                "success" => false,
                "message" => "A valid meeting ID is required."
            ]);
        }

        $stmt = $pdo->prepare("
            SELECT m.id, sp.user_id AS supervisor_user_id
            FROM meetings m
            INNER JOIN supervisors sp ON sp.id = m.supervisor_id
            WHERE m.id = ?
            LIMIT 1
        ");
        $stmt->execute([$meetingId]);
        $meeting = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$meeting) {
            respond(404, [
                "success" => false,
                "message" => "Meeting not found."
            ]);
        }

        if ($role === "supervisor" &&
            (int) $meeting["supervisor_user_id"] !== $userId) {
            respond(403, [
                "success" => false,
                "message" => "You can only delete your own meetings."
            ]);
        }

        $stmt = $pdo->prepare("DELETE FROM meetings WHERE id = ?");
        $stmt->execute([$meetingId]);

        respond(200, [
            "success" => true,
            "message" => "Meeting deleted successfully."
        ]);
    }

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $e) {
    error_log("Meetings API error: " . $e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing the meeting."
    ]);
}