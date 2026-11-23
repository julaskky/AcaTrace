<?php
declare(strict_types=1);

session_start();

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
    echo json_encode($data);
    exit;
}

$userId = (int)($_SESSION["user_id"] ?? 0);
$role = strtolower((string)(
    $_SESSION["role"] ?? $_SESSION["user_type"] ?? ""
));

if ($userId <= 0 || $role !== "supervisor") {
    respond(401, [
        "success" => false,
        "message" => "Please log in with a supervisor account."
    ]);
}

try {
    // Resolve the logged-in supervisor's profile.
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
            "message" => "Supervisor profile not found."
        ]);
    }

    $method = $_SERVER["REQUEST_METHOD"];

    // GET: Return notifications and unread count.
    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM supervisor_notifications
            WHERE supervisor_id = ?
              AND is_read = 0
        ");
        $stmt->execute([$supervisorId]);
        $unreadCount = (int)$stmt->fetchColumn();

        $limit = isset($_GET["limit"])
            ? (int)$_GET["limit"]
            : 50;

        $limit = max(1, min($limit, 100));

        $stmt = $pdo->prepare("
            SELECT
                id,
                title,
                message,
                notification_type,
                priority,
                is_read,
                read_at,
                created_at,
                source_key
            FROM supervisor_notifications
            WHERE supervisor_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT {$limit}
        ");
        $stmt->execute([$supervisorId]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($notifications as &$notification) {
            $notification["id"] = (int)$notification["id"];
            $notification["is_read"] =
                (bool)$notification["is_read"];
        }
        unset($notification);

        respond(200, [
            "success" => true,
            "unread_count" => $unreadCount,
            "notifications" => $notifications
        ]);
    }

    // POST: Mark one or all notifications as read.
    if ($method === "POST") {
        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($input)) {
            $input = $_POST;
        }

        $action = (string)($input["action"] ?? "");

        if ($action === "mark_read") {
            $notificationId = (int)(
                $input["notification_id"] ?? 0
            );

            if ($notificationId <= 0) {
                respond(422, [
                    "success" => false,
                    "message" => "A valid notification ID is required."
                ]);
            }

            $stmt = $pdo->prepare("
                UPDATE supervisor_notifications
                SET is_read = 1,
                    read_at = COALESCE(read_at, NOW())
                WHERE id = ?
                  AND supervisor_id = ?
            ");
            $stmt->execute([
                $notificationId,
                $supervisorId
            ]);

            if ($stmt->rowCount() === 0) {
                $check = $pdo->prepare("
                    SELECT id, is_read
                    FROM supervisor_notifications
                    WHERE id = ?
                      AND supervisor_id = ?
                    LIMIT 1
                ");
                $check->execute([
                    $notificationId,
                    $supervisorId
                ]);

                $existing = $check->fetch(PDO::FETCH_ASSOC);

                if (!$existing) {
                    respond(404, [
                        "success" => false,
                        "message" => "Notification not found."
                    ]);
                }
            }

            respond(200, [
                "success" => true,
                "message" => "Notification marked as read."
            ]);
        }

        if ($action === "mark_all_read") {
            $stmt = $pdo->prepare("
                UPDATE supervisor_notifications
                SET is_read = 1,
                    read_at = NOW()
                WHERE supervisor_id = ?
                  AND is_read = 0
            ");
            $stmt->execute([$supervisorId]);

            respond(200, [
                "success" => true,
                "message" => "All notifications marked as read.",
                "updated_count" => $stmt->rowCount()
            ]);
        }

        respond(422, [
            "success" => false,
            "message" => "Invalid action."
        ]);
    }

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $e) {
    error_log("Supervisor notifications API: " . $e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "Unable to process notifications."
    ]);
}
