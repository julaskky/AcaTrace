<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . "/../config/database.php";

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower(
    (string)($_SESSION["role"] ?? $_SESSION["user_type"] ?? "")
);
$documentId = (int)($_GET["id"] ?? 0);

if ($userId <= 0 || $role !== "student" || $documentId <= 0) {
    http_response_code(403);
    exit("Access denied.");
}

try {
    // Resolve the logged-in user's student profile ID.
    $profileStmt = $pdo->prepare(
        "SELECT id FROM students WHERE user_id = ? LIMIT 1"
    );
    $profileStmt->execute([$userId]);
    $studentId = (int)$profileStmt->fetchColumn();

    if ($studentId <= 0) {
        http_response_code(403);
        exit("Student profile not found.");
    }

    // Only the document's owner may download it.
    $stmt = $pdo->prepare("
        SELECT stored_filename, original_filename, mime_type
        FROM student_documents
        WHERE id = ? AND student_id = ?
        LIMIT 1
    ");
    $stmt->execute([$documentId, $studentId]);
    $document = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$document) {
        http_response_code(404);
        exit("Document not found.");
    }

    $storage = dirname(__DIR__, 2) . "/storage/student_documents";
    $storedName = basename((string)$document["stored_filename"]);
    $path = $storage . "/" . $storedName;

    if (!is_file($path)) {
        http_response_code(404);
        exit("The stored file could not be found.");
    }

    $downloadName = basename((string)$document["original_filename"]);
    $downloadName = str_replace(
        ["\r", "\n", '"', "\\"],
        ["", "", "'", ""],
        $downloadName
    );

    $mime = (string)$document["mime_type"];

    // Use a safe fallback if the stored MIME value is empty.
    if ($mime === "") {
        $mime = "application/octet-stream";
    }

    header("Content-Type: " . $mime);
    header("Content-Length: " . filesize($path));
    header(
        'Content-Disposition: attachment; filename="' .
        $downloadName . '"'
    );
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: private, no-store");

    readfile($path);
    exit;

} catch (Throwable $e) {
    error_log("Document download: " . $e->getMessage());
    http_response_code(500);
    exit("Unable to download this document.");
}
