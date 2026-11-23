<?php
declare(strict_types=1);

// File: api/student/documents.php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . "/../config/database.php";

function respond(int $status, array $data): void
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

function getStudentId(PDO $pdo, int $userId): int
{
    $stmt = $pdo->prepare("
        SELECT id
        FROM students
        WHERE user_id = ?
        LIMIT 1
    ");

    $stmt->execute([$userId]);

    return (int) $stmt->fetchColumn();
}

$userId = (int) ($_SESSION["user_id"] ?? 0);
$role = strtolower(
    trim((string) ($_SESSION["role"] ?? $_SESSION["user_type"] ?? ""))
);
$method = $_SERVER["REQUEST_METHOD"];

if ($userId <= 0 || $role !== "student") {
    respond(401, [
        "success" => false,
        "message" => "Please log in with your student account."
    ]);
}

$storage = dirname(__DIR__, 2) . "/storage/student_documents";

try {
    $studentId = getStudentId($pdo, $userId);

    if ($studentId <= 0) {
        respond(403, [
            "success" => false,
            "message" => "Your student profile could not be found."
        ]);
    }

    if (
        !is_dir($storage) &&
        !mkdir($storage, 0750, true) &&
        !is_dir($storage)
    ) {
        throw new RuntimeException(
            "Document storage could not be created."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | GET: Retrieve this student's documents and supervisor feedback
    |--------------------------------------------------------------------------
    */
    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                d.id,
                d.research_project_id,
                d.title,
                d.document_type,
                d.original_filename,
                d.file_size,
                d.status,
                d.uploaded_at,
                d.updated_at,
                rp.title AS project_title
            FROM student_documents d
            LEFT JOIN research_projects rp
                ON rp.id = d.research_project_id
            WHERE d.student_id = ?
            ORDER BY d.uploaded_at DESC, d.id DESC
        ");

        $stmt->execute([$studentId]);

        $documents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $feedbackStmt = $pdo->prepare("
            SELECT
                f.id,
                f.document_id,
                f.feedback_text,
                f.review_status,
                f.created_at,
                COALESCE(
                    NULLIF(
                        TRIM(
                            CONCAT_WS(
                                ' ',
                                u.first_name,
                                u.last_name
                            )
                        ),
                        ''
                    ),
                    'Supervisor'
                ) AS supervisor_name
            FROM document_feedback f
            INNER JOIN student_documents d
                ON d.id = f.document_id
            LEFT JOIN supervisors s
                ON s.id = f.supervisor_id
            LEFT JOIN users u
                ON u.id = s.user_id
            WHERE d.student_id = ?
            ORDER BY f.created_at DESC, f.id DESC
        ");

        $feedbackStmt->execute([$studentId]);

        respond(200, [
            "success" => true,
            "documents" => $documents,
            "feedback" => $feedbackStmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | POST: Upload a document and notify the assigned supervisor
    |--------------------------------------------------------------------------
    */
    if ($method === "POST") {
        $title = trim((string) ($_POST["title"] ?? ""));
        $type = trim((string) ($_POST["document_type"] ?? ""));
        $projectId = (int) ($_POST["research_project_id"] ?? 0);

        $allowedTypes = [
            "Thesis Chapter",
            "Research Proposal",
            "Research Paper",
            "Other"
        ];

        if ($title === "" || mb_strlen($title) > 255) {
            respond(422, [
                "success" => false,
                "message" =>
                    "Enter a document title of up to 255 characters."
            ]);
        }

        if (!in_array($type, $allowedTypes, true)) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid document type."
            ]);
        }

        if ($projectId <= 0) {
            respond(422, [
                "success" => false,
                "message" =>
                    "Please select the research project for this document."
            ]);
        }

        /*
         * Confirm that the project belongs to this student and
         * retrieve its assigned supervisor profile ID.
         */
        $projectStmt = $pdo->prepare("
            SELECT
                rp.id,
                rp.title AS project_title,
                rp.supervisor_id
            FROM research_projects rp
            WHERE rp.id = ?
              AND rp.student_id = ?
            LIMIT 1
        ");

        $projectStmt->execute([$projectId, $studentId]);

        $project = $projectStmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(403, [
                "success" => false,
                "message" =>
                    "The selected research project does not belong to you."
            ]);
        }

        if (empty($project["supervisor_id"])) {
            respond(422, [
                "success" => false,
                "message" =>
                    "This research project has no assigned supervisor. Please contact your department."
            ]);
        }

        $supervisorId = (int) $project["supervisor_id"];

        /*
         * Confirm the assigned supervisor profile exists.
         */
        $supervisorStmt = $pdo->prepare("
            SELECT id
            FROM supervisors
            WHERE id = ?
            LIMIT 1
        ");

        $supervisorStmt->execute([$supervisorId]);

        if (!$supervisorStmt->fetchColumn()) {
            respond(422, [
                "success" => false,
                "message" =>
                    "The assigned supervisor profile could not be found."
            ]);
        }

        if (!isset($_FILES["document"])) {
            respond(422, [
                "success" => false,
                "message" => "Choose a file to upload."
            ]);
        }

        $file = $_FILES["document"];

        if (
            !isset(
                $file["error"],
                $file["size"],
                $file["tmp_name"],
                $file["name"]
            ) ||
            (int) $file["error"] !== UPLOAD_ERR_OK
        ) {
            respond(422, [
                "success" => false,
                "message" =>
                    "The upload failed. Please select the file again."
            ]);
        }

        $fileSize = (int) $file["size"];

        if ($fileSize <= 0 || $fileSize > 10 * 1024 * 1024) {
            respond(422, [
                "success" => false,
                "message" =>
                    "Files must be larger than zero and no bigger than 10 MB."
            ]);
        }

        if (!is_uploaded_file($file["tmp_name"])) {
            respond(422, [
                "success" => false,
                "message" => "The uploaded file is invalid."
            ]);
        }

        $extension = strtolower(
            pathinfo((string) $file["name"], PATHINFO_EXTENSION)
        );

        $allowedMime = [
            "pdf" => [
                "application/pdf"
            ],
            "doc" => [
                "application/msword",
                "application/CDFV2",
                "application/x-ole-storage"
            ],
            "docx" => [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip",
                "application/x-zip",
                "application/octet-stream"
            ]
        ];

        if (!isset($allowedMime[$extension])) {
            respond(422, [
                "success" => false,
                "message" =>
                    "Only PDF, DOC, and DOCX files are allowed."
            ]);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file["tmp_name"]);

        if (
            $mime === false ||
            !in_array($mime, $allowedMime[$extension], true)
        ) {
            respond(422, [
                "success" => false,
                "message" =>
                    "The file content does not match its file type."
            ]);
        }

        $originalName = basename((string) $file["name"]);

        $originalName = preg_replace(
            '/[\x00-\x1F\x7F]/u',
            '',
            $originalName
        ) ?? ("document." . $extension);

        $originalName = substr($originalName, 0, 255);

        $storedName = bin2hex(random_bytes(24)) . "." . $extension;
        $destination = $storage . "/" . $storedName;

        if (!move_uploaded_file($file["tmp_name"], $destination)) {
            respond(500, [
                "success" => false,
                "message" =>
                    "The uploaded file could not be saved."
            ]);
        }

        $pdo->beginTransaction();

        try {
            /*
             * Save the document using students.id, not users.id.
             */
            $insert = $pdo->prepare("
                INSERT INTO student_documents (
                    student_id,
                    research_project_id,
                    title,
                    document_type,
                    original_filename,
                    stored_filename,
                    mime_type,
                    file_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $insert->execute([
                $studentId,
                $projectId,
                $title,
                $type,
                $originalName,
                $storedName,
                $mime,
                $fileSize
            ]);

            $documentId = (int) $pdo->lastInsertId();

            /*
             * Retrieve the student's name for the notification.
             */
            $studentNameStmt = $pdo->prepare("
                SELECT
                    TRIM(
                        CONCAT_WS(
                            ' ',
                            first_name,
                            last_name
                        )
                    ) AS student_name
                FROM users
                WHERE id = ?
                LIMIT 1
            ");

            $studentNameStmt->execute([$userId]);

            $studentName = trim(
                (string) $studentNameStmt->fetchColumn()
            );

            if ($studentName === "") {
                $studentName = "A student";
            }

            /*
             * Notify the assigned supervisor.
             * supervisor_notifications.supervisor_id stores
             * supervisors.id, as used by the Meetings feature.
             */
            $notificationTitle = "New Research Document Submitted";

            $notificationMessage =
                $studentName .
                " has submitted \"" .
                $title .
                "\" (" .
                $type .
                ") for the research project \"" .
                (string) $project["project_title"] .
                "\". Please review the document in your research documents section.";

            $sourceKey = "document_submission_" . $documentId;

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
                    'Document',
                    'High',
                    :source_key
                )
                ON DUPLICATE KEY UPDATE id = id
            ");

            $notificationStmt->execute([
                "supervisor_id" => $supervisorId,
                "title" => $notificationTitle,
                "message" => $notificationMessage,
                "source_key" => $sourceKey
            ]);

            $pdo->commit();

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            // Remove the file if saving the document/notification fails.
            if (is_file($destination)) {
                unlink($destination);
            }

            throw $e;
        }

        respond(201, [
            "success" => true,
            "message" =>
                "Document uploaded successfully. Your supervisor has been notified.",
            "document_id" => $documentId,
            "notification_sent" => true
        ]);
    }

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $e) {
    error_log("Student documents API: " . $e->getMessage());

    respond(500, [
        "success" => false,
        "message" =>
            "A server error occurred while processing documents."
    ]);
}
