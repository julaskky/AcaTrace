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

function validTaskDate($date) {
    if ($date === null || $date === "") return true;
    if (!is_string($date)) return false;
    $d = DateTime::createFromFormat("!Y-m-d", $date);
    return $d && $d->format("Y-m-d") === $date;
}

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    respond(401, ["success" => false, "message" => "Please log in."]);
}

$userId = (int) $_SESSION["user_id"];
$role = $_SESSION["role"];
$method = $_SERVER["REQUEST_METHOD"];

$priorities = ["Low", "Medium", "High", "Urgent"];
$statuses = [
    "Pending", "In Progress", "Submitted",
    "Completed", "Revision Required"
];

try {
    /*
     * GET: List tasks visible to the current user.
     */
    if ($method === "GET") {
        if (!in_array($role, ["student", "supervisor", "admin"], true)) {
            respond(403, ["success" => false, "message" => "Access denied."]);
        }

        $sql = "
            SELECT
                t.*,
                rp.title AS project_title,
                CONCAT(student.first_name, ' ', student.last_name)
                    AS student_name,
                CONCAT(assigner.first_name, ' ', assigner.last_name)
                    AS assigned_by_name
            FROM tasks t
            INNER JOIN research_projects rp
                ON rp.id = t.research_project_id
            INNER JOIN students st
                ON st.user_id = t.assigned_to
                AND st.id = rp.student_id
            INNER JOIN users student
                ON student.id = st.user_id
            INNER JOIN users assigner
                ON assigner.id = t.assigned_by
        ";

        $params = [];

        if ($role === "student") {
            $sql .= " WHERE t.assigned_to = ?";
            $params[] = $userId;
        } elseif ($role === "supervisor") {
            $sql .= "
                INNER JOIN supervisors sp
                    ON sp.user_id = ?
                    AND sp.id = rp.supervisor_id
            ";
            $params[] = $userId;
        }

        $sql .= " ORDER BY
            CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
            t.due_date ASC,
            t.created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        respond(200, [
            "success" => true,
            "role" => $role,
            "tasks" => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    /*
     * POST: Create and assign a task.
     */
    if ($method === "POST") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can assign tasks."
            ]);
        }

        $data = inputData();
        $projectId = (int) ($data["research_project_id"] ?? 0);
        $title = trim($data["title"] ?? "");
        $description = trim($data["description"] ?? "");
        $priority = $data["priority"] ?? "Medium";
        $dueDate = $data["due_date"] ?? null;

        if ($projectId <= 0 || $title === "") {
            respond(422, [
                "success" => false,
                "message" => "Project and task title are required."
            ]);
        }

        if (!in_array($priority, $priorities, true)) {
            respond(422, ["success" => false, "message" => "Invalid priority."]);
        }

        if (!validTaskDate($dueDate)) {
            respond(422, ["success" => false, "message" => "Invalid due date."]);
        }

        $stmt = $pdo->prepare("
            SELECT rp.id, rp.student_id, rp.supervisor_id, st.user_id AS student_user_id
            FROM research_projects rp
            INNER JOIN students st ON st.id = rp.student_id
            WHERE rp.id = ?
            LIMIT 1
        ");
        $stmt->execute([$projectId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, ["success" => false, "message" => "Project not found."]);
        }

        if ($role === "supervisor") {
            $stmt = $pdo->prepare("
                SELECT id FROM supervisors WHERE user_id = ? LIMIT 1
            ");
            $stmt->execute([$userId]);
            $supervisorId = (int) $stmt->fetchColumn();

            if (!$supervisorId ||
                $supervisorId !== (int) $project["supervisor_id"]) {
                respond(403, [
                    "success" => false,
                    "message" => "You can only assign tasks to your own research projects."
                ]);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO tasks (
                research_project_id, title, description,
                assigned_by, assigned_to, priority, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $projectId,
            $title,
            $description ?: null,
            $userId,
            (int) $project["student_user_id"],
            $priority,
            $dueDate ?: null
        ]);

        respond(201, [
            "success" => true,
            "message" => "Task assigned successfully.",
            "task_id" => (int) $pdo->lastInsertId()
        ]);
    }

    /*
     * PUT: Student progress/submission or supervisor review/edit.
     */
    if ($method === "PUT") {
        $data = inputData();
        $taskId = (int) ($data["id"] ?? 0);

        if ($taskId <= 0) {
            respond(422, ["success" => false, "message" => "Valid task ID required."]);
        }

        $stmt = $pdo->prepare("
            SELECT
                t.*,
                rp.supervisor_id,
                sp.user_id AS supervisor_user_id
            FROM tasks t
            INNER JOIN research_projects rp
                ON rp.id = t.research_project_id
            LEFT JOIN supervisors sp
                ON sp.id = rp.supervisor_id
            WHERE t.id = ?
            LIMIT 1
        ");
        $stmt->execute([$taskId]);
        $task = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$task) {
            respond(404, ["success" => false, "message" => "Task not found."]);
        }

        $isAdmin = $role === "admin";
        $isSupervisor = $role === "supervisor" &&
            (int) $task["supervisor_user_id"] === $userId;
        $isStudent = $role === "student" &&
            (int) $task["assigned_to"] === $userId;

        if (!$isAdmin && !$isSupervisor && !$isStudent) {
            respond(403, ["success" => false, "message" => "Access denied."]);
        }

        // Students can update progress and submit notes, but cannot review
        // or mark their own work as completed.
        if ($isStudent) {
            $status = $data["status"] ?? $task["status"];
            $notes = trim($data["submission_notes"] ?? "");

            if (!in_array($status, ["Pending", "In Progress", "Submitted"], true)) {
                respond(403, [
                    "success" => false,
                    "message" => "Students may set status to Pending, In Progress, or Submitted only."
                ]);
            }

            $submittedAt = $status === "Submitted"
                ? ($task["submitted_at"] ?: date("Y-m-d H:i:s"))
                : null;

            $stmt = $pdo->prepare("
                UPDATE tasks
                SET status = ?, submission_notes = ?, submitted_at = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $status,
                $notes ?: null,
                $submittedAt,
                $taskId
            ]);

            respond(200, [
                "success" => true,
                "message" => "Task progress updated successfully."
            ]);
        }

        // Supervisors/admins can edit task details or review submissions.
        $title = trim($data["title"] ?? $task["title"]);
        $description = trim($data["description"] ?? ($task["description"] ?? ""));
        $priority = $data["priority"] ?? $task["priority"];
        $dueDate = array_key_exists("due_date", $data)
            ? $data["due_date"]
            : $task["due_date"];
        $status = $data["status"] ?? $task["status"];

        if ($title === "") {
            respond(422, ["success" => false, "message" => "Task title is required."]);
        }

        if (!in_array($priority, $priorities, true) ||
            !in_array($status, $statuses, true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid priority or status."
            ]);
        }

        if (!validTaskDate($dueDate)) {
            respond(422, ["success" => false, "message" => "Invalid due date."]);
        }

        $stmt = $pdo->prepare("
            UPDATE tasks
            SET title = ?, description = ?, priority = ?,
                due_date = ?, status = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $title,
            $description ?: null,
            $priority,
            $dueDate ?: null,
            $status,
            $taskId
        ]);

        respond(200, [
            "success" => true,
            "message" => "Task updated successfully."
        ]);
    }

    /*
     * DELETE: Supervisors/admins only.
     */
    if ($method === "DELETE") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can delete tasks."
            ]);
        }

        $data = inputData();
        $taskId = (int) ($data["id"] ?? 0);

        if ($taskId <= 0) {
            respond(422, ["success" => false, "message" => "Valid task ID required."]);
        }

        $stmt = $pdo->prepare("
            SELECT t.id, sp.user_id AS supervisor_user_id
            FROM tasks t
            INNER JOIN research_projects rp ON rp.id = t.research_project_id
            LEFT JOIN supervisors sp ON sp.id = rp.supervisor_id
            WHERE t.id = ?
            LIMIT 1
        ");
        $stmt->execute([$taskId]);
        $task = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$task) {
            respond(404, ["success" => false, "message" => "Task not found."]);
        }

        if ($role === "supervisor" &&
            (int) $task["supervisor_user_id"] !== $userId) {
            respond(403, [
                "success" => false,
                "message" => "You can only delete tasks from your own projects."
            ]);
        }

        $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
        $stmt->execute([$taskId]);

        respond(200, ["success" => true, "message" => "Task deleted successfully."]);
    }

    respond(405, ["success" => false, "message" => "Method not allowed."]);

} catch (Throwable $e) {
    error_log("Tasks API error: " . $e->getMessage());
    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing tasks."
    ]);
}