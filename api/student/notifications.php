<?php
declare(strict_types=1);

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

function notificationResponse(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower((string)(
    $_SESSION["role"] ?? $_SESSION["user_type"] ?? ""
));

if ($userId <= 0 || $role !== "student") {
    notificationResponse(403, [
        "success" => false,
        "message" => "Student login required."
    ]);
}

try {
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $stmt = $pdo->prepare("
            SELECT id, title, message, notification_type,
                   action_url, is_read, created_at, read_at
            FROM student_notifications
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 100
        ");
        $stmt->execute([$userId]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM student_notifications
            WHERE user_id = ? AND is_read = 0
        ");
        $stmt->execute([$userId]);

        notificationResponse(200, [
            "success" => true,
            "notifications" => $notifications,
            "unread_count" => (int)$stmt->fetchColumn()
        ]);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        notificationResponse(405, [
            "success" => false,
            "message" => "Method not allowed."
        ]);
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        notificationResponse(400, [
            "success" => false,
            "message" => "Invalid request body."
        ]);
    }

    $action = (string)($input["action"] ?? "");

    if ($action === "mark_read") {
        $id = (int)($input["id"] ?? 0);

        if ($id <= 0) {
            notificationResponse(422, [
                "success" => false,
                "message" => "Invalid notification."
            ]);
        }

        $stmt = $pdo->prepare("
            UPDATE student_notifications
            SET is_read = 1, read_at = COALESCE(read_at, NOW())
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$id, $userId]);

        notificationResponse(200, [
            "success" => true,
            "message" => "Notification marked as read."
        ]);
    }

    if ($action === "mark_all_read") {
        $stmt = $pdo->prepare("
            UPDATE student_notifications
            SET is_read = 1, read_at = COALESCE(read_at, NOW())
            WHERE user_id = ? AND is_read = 0
        ");
        $stmt->execute([$userId]);

        notificationResponse(200, [
            "success" => true,
            "message" => "All notifications marked as read."
        ]);
    }

    if ($action === "delete") {
        $id = (int)($input["id"] ?? 0);

        if ($id <= 0) {
            notificationResponse(422, [
                "success" => false,
                "message" => "Invalid notification."
            ]);
        }

        $stmt = $pdo->prepare("
            DELETE FROM student_notifications
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$id, $userId]);

        if ($stmt->rowCount() === 0) {
            notificationResponse(404, [
                "success" => false,
                "message" => "Notification not found."
            ]);
        }

        notificationResponse(200, [
            "success" => true,
            "message" => "Notification deleted."
        ]);
    }

    notificationResponse(422, [
        "success" => false,
        "message" => "Unknown notification action."
    ]);

} catch (Throwable $e) {
    error_log("Student notifications API: " . $e->getMessage());

    notificationResponse(500, [
        "success" => false,
        "message" => "Unable to process notifications."
    ]);
}
