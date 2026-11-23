
<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

session_start();

require_once dirname(__DIR__, 2) . "/api/config/database.php";

function fail(int $status, string $message): void {
    http_response_code($status);
    header("Content-Type: text/plain; charset=UTF-8");
    exit($message);
}

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower((string)($_SESSION["role"] ?? $_SESSION["user_type"] ?? ""));

if ($userId <= 0 || $role !== "supervisor") {
    fail(401, "Please log in with your supervisor account.");
}

$documentId = (int)($_GET["id"] ?? 0);
$mode = (($_GET["mode"] ?? "download") === "inline") ? "inline" : "attachment";

if ($documentId <= 0) {
    fail(400, "Invalid document ID.");
}

try {
    $stmt = $pdo->prepare("
        SELECT d.stored_filename, d.original_filename, d.mime_type
        FROM student_documents d
        INNER JOIN users u ON u.id = d.student_id
        INNER JOIN students s ON s.user_id = u.id
        INNER JOIN research_projects rp
            ON rp.id = d.research_project_id
            AND rp.student_id = s.id
        INNER JOIN supervisors sp
            ON sp.id = rp.supervisor_id
        WHERE d.id = ?
          AND sp.user_id = ?
        LIMIT 1
    ");

    $stmt->execute([$documentId, $userId]);
    $document = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$document) {
        fail(404, "Document not found or access denied.");
    }

    $storage = dirname(__DIR__, 2) . "/storage/student_documents";
    $storedFilename = basename($document["stored_filename"]);
    $filePath = $storage . DIRECTORY_SEPARATOR . $storedFilename;

    if (!is_file($filePath)) {
        fail(404, "The stored document file could not be found.");
    }

    $mime = (string)$document["mime_type"];

    // Only PDF files may be displayed inline in the browser.
    if ($mode === "inline" && $mime !== "application/pdf") {
        $mode = "attachment";
    }

    $originalName = basename((string)$document["original_filename"]);
    $safeName = str_replace(["\r", "\n", '"'], "", $originalName);

    header("Content-Type: " . $mime);
    header("Content-Length: " . filesize($filePath));
    header(
        'Content-Disposition: ' . $mode .
        '; filename="' . $safeName . '"'
    );
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: private, no-store");

    readfile($filePath);
    exit;

} catch (Throwable $e) {
    error_log("Supervisor document file error: " . $e->getMessage());
    fail(500, "Unable to retrieve the document.");
}
