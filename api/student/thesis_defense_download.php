<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . "/../config/database.php";

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower((string)(
    $_SESSION["role"] ?? $_SESSION["user_type"] ?? ""
));
$documentId = (int)($_GET["id"] ?? 0);

if ($userId <= 0 || $role !== "student" || $documentId <= 0) {
    http_response_code(403);
    exit("Access denied.");
}

try {
    $stmt = $pdo->prepare("
        SELECT doc.stored_filename, doc.original_filename, doc.mime_type
        FROM thesis_defense_documents doc
        INNER JOIN thesis_defenses d ON d.id = doc.defense_id
        INNER JOIN students s ON s.id = d.student_id
        WHERE doc.id = ? AND s.user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$documentId, $userId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$doc) {
        http_response_code(404);
        exit("Document not found.");
    }

    $storage = dirname(__DIR__, 2) . "/storage/thesis_defense";
    $path = $storage . "/" . basename($doc["stored_filename"]);

    if (!is_file($path)) {
        http_response_code(404);
        exit("Stored file not found.");
    }

    $name = str_replace(
        ["\r", "\n", '"'],
        ["", "", "'"],
        basename($doc["original_filename"])
    );

    header("Content-Type: " . $doc["mime_type"]);
    header("Content-Length: " . filesize($path));
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: private, no-store");

    readfile($path);
    exit;
} catch (Throwable $e) {
    error_log("Thesis defense download: " . $e->getMessage());
    http_response_code(500);
    exit("Unable to download document.");
}
