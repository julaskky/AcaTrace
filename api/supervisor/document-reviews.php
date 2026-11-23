<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

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
 * Insert a notification for this document or update its existing
 * notification, so repeated reviews do not create duplicate alerts.
 */
function saveDocumentNotification(
    PDO $pdo,
    int $studentUserId,
    int $documentId,
    string $documentTitle,
    string $reviewStatus,
    string $feedbackText
): void {
    $sourceKey = "document_" . $documentId . "_review";

    $title = "Document Review Updated";

    $message = "Your document \"" . $documentTitle .
        "\" has been reviewed. Status: " . $reviewStatus .
        ". Supervisor feedback: " . $feedbackText;

    $priority = $reviewStatus === "Revision Required"
        ? "High"
        : "Normal";

    $requiresAction = $reviewStatus === "Revision Required" ? 1 : 0;

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
        $update = $pdo->prepare("
            UPDATE student_notifications
            SET title = ?,
                message = ?,
                notification_type = ?,
                priority = ?,
                requires_action = ?,
                action_url = NULL
            WHERE id = ?
        ");

        $update->execute([
            $title,
            $message,
            "Document Review",
            $priority,
            $requiresAction,
            (int)$existingId
        ]);
    } else {
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
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        ");

        $insert->execute([
            $studentUserId,
            $title,
            $message,
            "Document Review",
            $priority,
            $requiresAction,
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
            "message" => "No supervisor profile was found for this account."
        ]);
    }

    /*
     * GET: Retrieve documents assigned to this supervisor.
     */
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $sql = "
            SELECT
                d.id,
                d.title,
                d.document_type,
                d.original_filename,
                d.mime_type,
                d.file_size,
                d.status,
                d.uploaded_at,
                d.updated_at,
                rp.title AS project_title,
                u.id AS student_user_id,
                CONCAT_WS(' ', u.first_name, u.last_name)
                    AS student_name,
                u.email AS student_email,
                f.feedback_text AS latest_feedback,
                f.review_status AS latest_review_status,
                f.created_at AS last_reviewed_at
            FROM student_documents d
            INNER JOIN users u
                ON u.id = d.student_id
            INNER JOIN students s
                ON s.user_id = u.id
            INNER JOIN research_projects rp
                ON rp.id = d.research_project_id
                AND rp.student_id = s.id
                AND rp.supervisor_id = ?
            LEFT JOIN (
                SELECT df1.*
                FROM document_feedback df1
                INNER JOIN (
                    SELECT document_id, MAX(id) AS latest_id
                    FROM document_feedback
                    GROUP BY document_id
                ) latest
                    ON latest.latest_id = df1.id
            ) f
                ON f.document_id = d.id
            ORDER BY
                CASE
                    WHEN d.status = 'Pending Review' THEN 0
                    ELSE 1
                END,
                d.uploaded_at DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$supervisorId]);

        $documents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($documents as &$document) {
            $document["file_size"] = (int)$document["file_size"];
            $document["id"] = (int)$document["id"];

            $document["preview_url"] =
                "http://localhost/acatrace/api/supervisor/document-file.php?id=" .
                $document["id"] . "&mode=inline";

            $document["download_url"] =
                "http://localhost/acatrace/api/supervisor/document-file.php?id=" .
                $document["id"] . "&mode=download";
        }

        unset($document);

        respond(200, [
            "success" => true,
            "documents" => $documents
        ]);
    }

    /*
     * POST: Save a document review and notify its student.
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

        $documentId = (int)($input["document_id"] ?? 0);
        $reviewStatus = trim(
            (string)($input["review_status"] ?? "")
        );
        $feedbackText = trim(
            (string)($input["feedback_text"] ?? "")
        );

        $allowedStatuses = [
            "Under Review",
            "Revision Required",
            "Approved"
        ];

        if (
            $documentId <= 0 ||
            !in_array($reviewStatus, $allowedStatuses, true)
        ) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid document and review status."
            ]);
        }

        if ($feedbackText === "") {
            respond(422, [
                "success" => false,
                "message" => "Please enter feedback for the student."
            ]);
        }

        /*
         * Confirm that the document belongs to a student supervised
         * by the currently authenticated supervisor.
         */
        $check = $pdo->prepare("
            SELECT
                d.id,
                d.title,
                d.student_id AS student_user_id
            FROM student_documents d
            INNER JOIN users u
                ON u.id = d.student_id
            INNER JOIN students s
                ON s.user_id = u.id
            INNER JOIN research_projects rp
                ON rp.id = d.research_project_id
                AND rp.student_id = s.id
            WHERE d.id = ?
              AND rp.supervisor_id = ?
            LIMIT 1
        ");

        $check->execute([$documentId, $supervisorId]);
        $document = $check->fetch(PDO::FETCH_ASSOC);

        if (!$document) {
            respond(404, [
                "success" => false,
                "message" => "Document not found or not assigned to you."
            ]);
        }

        $studentUserId = (int)$document["student_user_id"];
        $documentTitle = (string)$document["title"];

        if ($studentUserId <= 0) {
            respond(500, [
                "success" => false,
                "message" => "Could not identify the student for this document."
            ]);
        }

        $pdo->beginTransaction();

        // Update the document's current review status.
        $update = $pdo->prepare("
            UPDATE student_documents
            SET status = ?
            WHERE id = ?
        ");

        $update->execute([$reviewStatus, $documentId]);

        // Preserve the review history.
        $insertFeedback = $pdo->prepare("
            INSERT INTO document_feedback (
                document_id,
                supervisor_id,
                feedback_text,
                review_status
            )
            VALUES (?, ?, ?, ?)
        ");

        $insertFeedback->execute([
            $documentId,
            $supervisorId,
            $feedbackText,
            $reviewStatus
        ]);

        // Insert or update the student's notification.
        saveDocumentNotification(
            $pdo,
            $studentUserId,
            $documentId,
            $documentTitle,
            $reviewStatus,
            $feedbackText
        );

        $pdo->commit();

        respond(200, [
            "success" => true,
            "message" => "Document review saved and student notification updated."
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
        "Supervisor document reviews error: " . $e->getMessage()
    );

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing document reviews."
    ]);
}
