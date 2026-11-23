<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

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

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Create a supervisor notification.
 * Notification errors are logged without cancelling the
 * student's successful defense request or document upload.
 */
function notifySupervisor(
    PDO $pdo,
    int $supervisorId,
    string $title,
    string $message,
    string $sourceKey,
    string $priority = "Normal"
): void {
    if ($supervisorId <= 0) {
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO supervisor_notifications
                (
                    supervisor_id,
                    title,
                    message,
                    notification_type,
                    priority,
                    is_read,
                    source_key
                )
            VALUES (?, ?, ?, 'Thesis Defense', ?, 0, ?)
        ");

        $stmt->execute([
            $supervisorId,
            $title,
            $message,
            $priority,
            $sourceKey
        ]);
    } catch (Throwable $e) {
        error_log(
            "Could not create supervisor notification: "
            . $e->getMessage()
        );
    }
}

/**
 * Get the logged-in student's name.
 */
function getStudentName(PDO $pdo, int $userId): string
{
    $stmt = $pdo->prepare("
        SELECT first_name, last_name
        FROM users
        WHERE id = ?
        LIMIT 1
    ");

    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        return "A student";
    }

    $name = trim(
        (string)($user["first_name"] ?? "")
        . " "
        . (string)($user["last_name"] ?? "")
    );

    return $name !== "" ? $name : "A student";
}

// --------------------------------------------------
// Authentication
// --------------------------------------------------

$userId = (int)($_SESSION["user_id"] ?? 0);

$role = strtolower((string)(
    $_SESSION["role"] ?? $_SESSION["user_type"] ?? ""
));

if ($userId <= 0 || $role !== "student") {
    respond(403, [
        "success" => false,
        "message" => "Student login required."
    ]);
}

$method = $_SERVER["REQUEST_METHOD"];

if (!in_array($method, ["GET", "POST"], true)) {
    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);
}

try {
    // --------------------------------------------------
    // Resolve student profile
    // --------------------------------------------------

    $stmt = $pdo->prepare("
        SELECT id
        FROM students
        WHERE user_id = ?
        LIMIT 1
    ");

    $stmt->execute([$userId]);
    $studentId = (int)$stmt->fetchColumn();

    if ($studentId <= 0) {
        respond(404, [
            "success" => false,
            "message" => "Student profile not found."
        ]);
    }

    $studentName = getStudentName($pdo, $userId);

    // --------------------------------------------------
    // GET: Load projects, defenses and documents
    // --------------------------------------------------

    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT id, title
            FROM research_projects
            WHERE student_id = ?
            ORDER BY id DESC
        ");

        $stmt->execute([$studentId]);
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            SELECT
                d.*,
                rp.title AS project_title
            FROM thesis_defenses d
            INNER JOIN research_projects rp
                ON rp.id = d.research_project_id
            WHERE d.student_id = ?
            ORDER BY d.created_at DESC
        ");

        $stmt->execute([$studentId]);
        $defenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            SELECT
                doc.id,
                doc.defense_id,
                doc.title,
                doc.original_filename,
                doc.file_size,
                doc.uploaded_at
            FROM thesis_defense_documents doc
            INNER JOIN thesis_defenses d
                ON d.id = doc.defense_id
            WHERE d.student_id = ?
            ORDER BY doc.uploaded_at DESC
        ");

        $stmt->execute([$studentId]);
        $documents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respond(200, [
            "success" => true,
            "projects" => $projects,
            "defenses" => $defenses,
            "documents" => $documents
        ]);
    }

    // --------------------------------------------------
    // POST: Read JSON or multipart/form-data
    // --------------------------------------------------

    $input = [];

    $contentType = strtolower(
        (string)($_SERVER["CONTENT_TYPE"] ?? "")
    );

    if (strpos($contentType, "application/json") !== false) {
        $rawBody = file_get_contents("php://input");
        $decoded = json_decode($rawBody, true);

        if (!is_array($decoded)) {
            respond(400, [
                "success" => false,
                "message" => "Invalid JSON request."
            ]);
        }

        $input = $decoded;
    } else {
        $input = $_POST;
    }

    $action = trim((string)($input["action"] ?? ""));

    // --------------------------------------------------
    // ACTION: REQUEST THESIS DEFENSE
    // --------------------------------------------------

    if ($action === "request") {
        $projectId = (int)(
            $input["research_project_id"] ?? 0
        );

        $requestedDate = trim(
            (string)($input["requested_date"] ?? "")
        );

        if ($projectId <= 0) {
            respond(422, [
                "success" => false,
                "message" => "Select a research project."
            ]);
        }

        // Ensure the project belongs to this student.
        $stmt = $pdo->prepare("
            SELECT
                id,
                title,
                supervisor_id
            FROM research_projects
            WHERE id = ?
              AND student_id = ?
            LIMIT 1
        ");

        $stmt->execute([$projectId, $studentId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(403, [
                "success" => false,
                "message" => "Invalid research project."
            ]);
        }

        // Validate optional requested date.
        $date = null;

        if ($requestedDate !== "") {
            $parsed = DateTime::createFromFormat(
                "!Y-m-d",
                $requestedDate
            );

            $dateErrors = DateTime::getLastErrors();

            $hasDateErrors = is_array($dateErrors)
                && (
                    $dateErrors["warning_count"] > 0
                    || $dateErrors["error_count"] > 0
                );

            if (
                !$parsed
                || $parsed->format("Y-m-d") !== $requestedDate
                || $hasDateErrors
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "Invalid requested date."
                ]);
            }

            $date = $requestedDate;
        }

        // Save the defense request.
        $stmt = $pdo->prepare("
            INSERT INTO thesis_defenses
                (
                    student_id,
                    research_project_id,
                    requested_date
                )
            VALUES (?, ?, ?)
        ");

        $stmt->execute([
            $studentId,
            $projectId,
            $date
        ]);

        $defenseId = (int)$pdo->lastInsertId();

        // Notify the assigned supervisor.
        $supervisorId = (int)(
            $project["supervisor_id"] ?? 0
        );

        if ($supervisorId > 0) {
            $projectTitle = (string)$project["title"];

            $message = $studentName
                . " has submitted a thesis defense request for "
                . '"' . $projectTitle . '".';

            if ($date !== null) {
                $message .= " Requested date: " . $date . ".";
            }

            notifySupervisor(
                $pdo,
                $supervisorId,
                "New Thesis Defense Request",
                $message,
                "thesis_defense_request_" . $defenseId,
                "High"
            );
        }

        respond(201, [
            "success" => true,
            "message" => "Defense request submitted successfully.",
            "defense_id" => $defenseId
        ]);
    }

    // --------------------------------------------------
    // ACTION: UPLOAD DEFENSE DOCUMENT
    // --------------------------------------------------

    if ($action === "upload") {
        $defenseId = (int)(
            $input["defense_id"] ?? 0
        );

        $title = trim(
            (string)($input["title"] ?? "")
        );

        if (
            $defenseId <= 0
            || $title === ""
            || !isset($_FILES["document"])
            || !is_array($_FILES["document"])
        ) {
            respond(422, [
                "success" => false,
                "message" => "Complete all required fields."
            ]);
        }

        // Confirm ownership and find the assigned supervisor.
        $stmt = $pdo->prepare("
            SELECT
                d.id,
                rp.title AS project_title,
                rp.supervisor_id
            FROM thesis_defenses d
            INNER JOIN research_projects rp
                ON rp.id = d.research_project_id
            WHERE d.id = ?
              AND d.student_id = ?
            LIMIT 1
        ");

        $stmt->execute([
            $defenseId,
            $studentId
        ]);

        $defense = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$defense) {
            respond(403, [
                "success" => false,
                "message" => "Invalid defense request."
            ]);
        }

        $file = $_FILES["document"];

        if (
            !isset($file["error"], $file["size"], $file["tmp_name"], $file["name"])
            || (int)$file["error"] !== UPLOAD_ERR_OK
        ) {
            respond(422, [
                "success" => false,
                "message" => "File upload failed."
            ]);
        }

        if (
            !is_uploaded_file($file["tmp_name"])
            || (int)$file["size"] <= 0
            || (int)$file["size"] > 10 * 1024 * 1024
        ) {
            respond(422, [
                "success" => false,
                "message" => "File must be under 10 MB."
            ]);
        }

        $original = basename((string)$file["name"]);

        $extension = strtolower(
            pathinfo($original, PATHINFO_EXTENSION)
        );

        $allowed = ["pdf", "doc", "docx"];

        if (!in_array($extension, $allowed, true)) {
            respond(422, [
                "success" => false,
                "message" => "Only PDF, DOC, and DOCX files are allowed."
            ]);
        }

        // Check the actual file MIME type.
        $finfo = new finfo(FILEINFO_MIME_TYPE);

        $mime = $finfo->file($file["tmp_name"])
            ?: "application/octet-stream";

        $allowedMimes = [
            "pdf" => [
                "application/pdf"
            ],
            "doc" => [
                "application/msword",
                "application/octet-stream"
            ],
            "docx" => [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip",
                "application/octet-stream"
            ]
        ];

        if (!in_array($mime, $allowedMimes[$extension], true)) {
            respond(422, [
                "success" => false,
                "message" => "The file content does not match its extension."
            ]);
        }

        // Save files outside the public API directory.
        $storage = dirname(__DIR__, 2)
            . "/storage/thesis_defense";

        if (
            !is_dir($storage)
            && !mkdir($storage, 0750, true)
            && !is_dir($storage)
        ) {
            respond(500, [
                "success" => false,
                "message" => "Storage folder could not be created."
            ]);
        }

        $stored = bin2hex(random_bytes(24))
            . "."
            . $extension;

        $destination = $storage . "/" . $stored;

        if (!move_uploaded_file(
            $file["tmp_name"],
            $destination
        )) {
            respond(500, [
                "success" => false,
                "message" => "Could not save the uploaded file."
            ]);
        }

        try {
            // Save document metadata.
            $stmt = $pdo->prepare("
                INSERT INTO thesis_defense_documents
                    (
                        defense_id,
                        title,
                        original_filename,
                        stored_filename,
                        mime_type,
                        file_size
                    )
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $defenseId,
                $title,
                $original,
                $stored,
                $mime,
                (int)$file["size"]
            ]);

            $documentId = (int)$pdo->lastInsertId();

        } catch (Throwable $e) {
            if (is_file($destination)) {
                unlink($destination);
            }

            throw $e;
        }

        // Notify the assigned supervisor.
        $supervisorId = (int)(
            $defense["supervisor_id"] ?? 0
        );

        if ($supervisorId > 0) {
            $projectTitle = (string)$defense["project_title"];

            $message = $studentName
                . " uploaded the document "
                . '"' . $title . '"'
                . " for the thesis defense of "
                . '"' . $projectTitle . '".';

            notifySupervisor(
                $pdo,
                $supervisorId,
                "Thesis Defense Document Uploaded",
                $message,
                "thesis_defense_document_" . $documentId,
                "Normal"
            );
        }

        respond(201, [
            "success" => true,
            "message" => "Defense document uploaded successfully.",
            "document_id" => $documentId
        ]);
    }

    respond(422, [
        "success" => false,
        "message" => "Invalid action."
    ]);

} catch (Throwable $e) {
    error_log(
        "Student thesis defense API error: "
        . $e->getMessage()
    );

    respond(500, [
        "success" => false,
        "message" => "A server error occurred. Check the PHP error log."
    ]);
}
