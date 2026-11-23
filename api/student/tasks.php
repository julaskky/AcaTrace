<?php
declare(strict_types=1);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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

function requestData(): array
{
    $raw = file_get_contents("php://input");
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function cleanValue($value, int $limit = 5000): string
{
    return substr(trim((string)($value ?? "")), 0, $limit);
}

function validDate(string $date): bool
{
    if ($date === "") {
        return true;
    }

    $parsed = DateTime::createFromFormat("!Y-m-d", $date);
    return $parsed !== false && $parsed->format("Y-m-d") === $date;
}

/**
 * Resolve the supervisors table profile ID from the logged-in user ID.
 * research_projects.supervisor_id and supervisor_notifications.supervisor_id
 * reference the supervisor profile, not necessarily users.id.
 */
function getSupervisorProfileId(PDO $pdo, int $userId): int
{
    $stmt = $pdo->prepare("
        SELECT id
        FROM supervisors
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);

    return (int)($stmt->fetchColumn() ?: 0);
}

function getTask(PDO $pdo, int $taskId): array
{
    $stmt = $pdo->prepare("
        SELECT
            t.*,
            rp.title AS project_title,
            rp.supervisor_id AS project_supervisor_id
        FROM tasks t
        INNER JOIN research_projects rp
            ON rp.id = t.research_project_id
        WHERE t.id = ?
        LIMIT 1
    ");

    $stmt->execute([$taskId]);
    $task = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$task) {
        respond(404, [
            "success" => false,
            "message" => "Task not found."
        ]);
    }

    return $task;
}

function checkTaskAccess(
    array $task,
    string $role,
    int $userId,
    int $supervisorProfileId = 0
): void {
    if (
        $role === "student" &&
        (int)$task["assigned_to"] !== $userId
    ) {
        respond(403, [
            "success" => false,
            "message" => "You cannot access this task."
        ]);
    }

    if (
        $role === "supervisor" &&
        (
            $supervisorProfileId <= 0 ||
            (int)$task["project_supervisor_id"] !== $supervisorProfileId
        )
    ) {
        respond(403, [
            "success" => false,
            "message" => "You can only manage tasks belonging to your research projects."
        ]);
    }
}

$userId = (int)($_SESSION["user_id"] ?? 0);

$role = strtolower(
    (string)($_SESSION["role"] ?? $_SESSION["user_type"] ?? "")
);

$method = $_SERVER["REQUEST_METHOD"];
$supervisorProfileId = 0;

if (
    $userId <= 0 ||
    !in_array($role, ["student", "supervisor", "admin"], true)
) {
    respond(401, [
        "success" => false,
        "message" => "Please log in with an authorised AcaTrace account."
    ]);
}

try {
    if ($role === "supervisor") {
        $supervisorProfileId = getSupervisorProfileId($pdo, $userId);

        if ($supervisorProfileId <= 0) {
            respond(403, [
                "success" => false,
                "message" => "Your supervisor profile could not be found."
            ]);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | GET: Retrieve tasks
    |--------------------------------------------------------------------------
    */
    if ($method === "GET") {
        $sql = "
            SELECT
                t.id,
                t.research_project_id,
                t.title,
                t.description,
                t.assigned_by,
                t.assigned_to,
                t.priority,
                t.due_date,
                t.status,
                t.submission_notes,
                t.submitted_at,
                t.created_at,
                rp.title AS project_title,
                CONCAT_WS(
                    ' ',
                    student_user.first_name,
                    student_user.last_name
                ) AS student_name,
                CONCAT_WS(
                    ' ',
                    assigned_user.first_name,
                    assigned_user.last_name
                ) AS assigned_by_name
            FROM tasks t
            INNER JOIN research_projects rp
                ON rp.id = t.research_project_id
            LEFT JOIN users student_user
                ON student_user.id = t.assigned_to
            LEFT JOIN users assigned_user
                ON assigned_user.id = t.assigned_by
        ";

        $params = [];

        if ($role === "student") {
            $sql .= " WHERE t.assigned_to = ?";
            $params[] = $userId;
        } elseif ($role === "supervisor") {
            $sql .= " WHERE rp.supervisor_id = ?";
            $params[] = $supervisorProfileId;
        }

        $sql .= "
            ORDER BY
                CASE
                    WHEN t.status IN ('Completed', 'Submitted') THEN 1
                    ELSE 0
                END,
                CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                t.due_date ASC,
                t.created_at DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $students = [];

        if (in_array($role, ["supervisor", "admin"], true)) {
            $studentSql = "
                SELECT
                    st.id,
                    st.user_id,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM students st
                INNER JOIN users u ON u.id = st.user_id
                WHERE u.status = 'active'
            ";

            $studentParams = [];

            if ($role === "supervisor") {
                $studentSql .= "
                    AND EXISTS (
                        SELECT 1
                        FROM research_projects rp
                        WHERE rp.supervisor_id = ?
                          AND rp.student_id = st.id
                    )
                ";
                $studentParams[] = $supervisorProfileId;
            }

            $studentSql .= " ORDER BY u.first_name ASC, u.last_name ASC";

            $studentStmt = $pdo->prepare($studentSql);
            $studentStmt->execute($studentParams);
            $students = $studentStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        respond(200, [
            "success" => true,
            "role" => $role,
            "tasks" => $tasks,
            "students" => $students
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | POST: Assign a new task
    |--------------------------------------------------------------------------
    */
    if ($method === "POST") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can assign tasks."
            ]);
        }

        $data = requestData();

        $projectId = (int)($data["research_project_id"] ?? 0);
        $assignedTo = (int)($data["assigned_to"] ?? 0);
        $title = cleanValue($data["title"] ?? "", 180);
        $description = cleanValue($data["description"] ?? "", 5000);
        $priority = cleanValue($data["priority"] ?? "Medium", 20);
        $status = cleanValue($data["status"] ?? "Pending", 40);
        $dueDate = cleanValue($data["due_date"] ?? "", 10);

        if ($projectId <= 0 || $assignedTo <= 0 || $title === "") {
            respond(422, [
                "success" => false,
                "message" => "Project, student, and task title are required."
            ]);
        }

        if (!in_array($priority, ["Low", "Medium", "High", "Urgent"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid priority."
            ]);
        }

        if (!in_array($status, [
            "Pending", "In Progress", "Submitted",
            "Completed", "Revision Required"
        ], true)) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid task status."
            ]);
        }

        if (!validDate($dueDate)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid due date."
            ]);
        }

        $projectStmt = $pdo->prepare("
            SELECT id, supervisor_id, student_id
            FROM research_projects
            WHERE id = ?
            LIMIT 1
        ");
        $projectStmt->execute([$projectId]);
        $project = $projectStmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, [
                "success" => false,
                "message" => "Research project not found."
            ]);
        }

        if (
            $role === "supervisor" &&
            (int)$project["supervisor_id"] !== $supervisorProfileId
        ) {
            respond(403, [
                "success" => false,
                "message" => "You can only assign tasks within your own projects."
            ]);
        }

        $studentStmt = $pdo->prepare("
            SELECT st.id
            FROM students st
            INNER JOIN users u ON u.id = st.user_id
            WHERE st.user_id = ?
              AND u.status = 'active'
            LIMIT 1
        ");
        $studentStmt->execute([$assignedTo]);

        if (!$studentStmt->fetchColumn()) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid active student."
            ]);
        }

        $projectStudentStmt = $pdo->prepare("
            SELECT id
            FROM students
            WHERE id = ? AND user_id = ?
            LIMIT 1
        ");
        $projectStudentStmt->execute([
            (int)$project["student_id"],
            $assignedTo
        ]);

        if (!$projectStudentStmt->fetchColumn()) {
            respond(422, [
                "success" => false,
                "message" => "The selected student is not associated with this research project."
            ]);
        }

        $insert = $pdo->prepare("
            INSERT INTO tasks (
                research_project_id,
                title,
                description,
                assigned_by,
                assigned_to,
                priority,
                due_date,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");

        $insert->execute([
            $projectId,
            $title,
            $description !== "" ? $description : null,
            $userId,
            $assignedTo,
            $priority,
            $dueDate !== "" ? $dueDate : null,
            $status
        ]);

        respond(201, [
            "success" => true,
            "message" => "Task assigned successfully.",
            "id" => (int)$pdo->lastInsertId()
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | PUT: Student progress/submission or supervisor task editing
    |--------------------------------------------------------------------------
    */
    if ($method === "PUT") {
        $data = requestData();
        $taskId = (int)($data["id"] ?? 0);

        if ($taskId <= 0) {
            respond(422, [
                "success" => false,
                "message" => "A valid task ID is required."
            ]);
        }

        $task = getTask($pdo, $taskId);
        checkTaskAccess($task, $role, $userId, $supervisorProfileId);

        if ($role === "student") {
            if ($task["status"] === "Completed") {
                respond(403, [
                    "success" => false,
                    "message" => "This task is completed and can no longer be changed."
                ]);
            }

            if ($task["status"] === "Submitted") {
                respond(403, [
                    "success" => false,
                    "message" => "Your submission is awaiting supervisor review."
                ]);
            }

            $status = cleanValue(
                $data["status"] ?? $task["status"],
                40
            );

            $notes = cleanValue(
                $data["submission_notes"] ?? $task["submission_notes"] ?? "",
                5000
            );

            if (!in_array($status, ["Pending", "In Progress", "Submitted"], true)) {
                respond(403, [
                    "success" => false,
                    "message" => "Invalid student task status."
                ]);
            }

            $supervisorId = (int)$task["project_supervisor_id"];

            if ($supervisorId <= 0) {
                respond(422, [
                    "success" => false,
                    "message" => "This research project does not have an assigned supervisor."
                ]);
            }

            $studentNameStmt = $pdo->prepare("
                SELECT CONCAT_WS(' ', first_name, last_name)
                FROM users
                WHERE id = ?
                LIMIT 1
            ");
            $studentNameStmt->execute([$userId]);
            $studentName = trim(
                (string)($studentNameStmt->fetchColumn() ?: "A student")
            );

            $isSubmission = $status === "Submitted";

            if ($isSubmission) {
                $notificationTitle = "Task Submitted for Review";
                $notificationMessage =
                    $studentName . " submitted the task \"" .
                    $task["title"] . "\" for review in the research project \"" .
                    ($task["project_title"] ?: "Research project") . "\".";
                $notificationPriority = "High";
            } else {
                $notificationTitle = "Student Task Progress Updated";
                $notificationMessage =
                    $studentName . " updated the task \"" .
                    $task["title"] . "\". Current status: " . $status .
                    ". Research project: \"" .
                    ($task["project_title"] ?: "Research project") . "\".";
                $notificationPriority = "Normal";
            }

            // A unique key allows each successful student update to notify
            // the supervisor, while preventing accidental duplicate inserts
            // for the same generated notification key.
            $sourceKey = "task_update_" . $taskId . "_" .
                bin2hex(random_bytes(8));

            $pdo->beginTransaction();

            try {
                $update = $pdo->prepare("
                    UPDATE tasks
                    SET status = ?,
                        submission_notes = ?,
                        submitted_at = ?
                    WHERE id = ?
                      AND assigned_to = ?
                      AND status NOT IN ('Submitted', 'Completed')
                ");

                $update->execute([
                    $status,
                    $notes !== "" ? $notes : null,
                    $isSubmission ? date("Y-m-d H:i:s") : null,
                    $taskId,
                    $userId
                ]);

                if ($update->rowCount() === 0) {
                    throw new RuntimeException(
                        "The task was not updated. Please refresh and try again."
                    );
                }

                $notificationStmt = $pdo->prepare("
                    INSERT INTO supervisor_notifications (
                        supervisor_id,
                        title,
                        message,
                        notification_type,
                        priority,
                        source_key
                    ) VALUES (?, ?, ?, 'Task', ?, ?)
                ");

                $notificationStmt->execute([
                    $supervisorId,
                    $notificationTitle,
                    $notificationMessage,
                    $notificationPriority,
                    $sourceKey
                ]);

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }

            respond(200, [
                "success" => true,
                "message" => $isSubmission
                    ? "Task submitted successfully. Your supervisor has been notified."
                    : "Task progress updated successfully. Your supervisor has been notified."
            ]);
        }

        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "You are not authorised to edit this task."
            ]);
        }

        $title = cleanValue($data["title"] ?? $task["title"], 180);
        $description = cleanValue(
            $data["description"] ?? $task["description"] ?? "",
            5000
        );
        $priority = cleanValue($data["priority"] ?? $task["priority"], 20);
        $status = cleanValue($data["status"] ?? $task["status"], 40);
        $dueDate = cleanValue($data["due_date"] ?? $task["due_date"] ?? "", 10);
        $projectId = (int)($data["research_project_id"] ?? $task["research_project_id"]);
        $assignedTo = (int)($data["assigned_to"] ?? $task["assigned_to"]);

        if ($title === "" || $projectId <= 0 || $assignedTo <= 0) {
            respond(422, [
                "success" => false,
                "message" => "Task title, project, and student are required."
            ]);
        }

        if (!in_array($priority, ["Low", "Medium", "High", "Urgent"], true)) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid priority."
            ]);
        }

        if (!in_array($status, [
            "Pending", "In Progress", "Submitted",
            "Completed", "Revision Required"
        ], true)) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid task status."
            ]);
        }

        if (!validDate($dueDate)) {
            respond(422, [
                "success" => false,
                "message" => "Enter a valid due date."
            ]);
        }

        $projectStmt = $pdo->prepare("
            SELECT id, supervisor_id, student_id
            FROM research_projects
            WHERE id = ?
            LIMIT 1
        ");
        $projectStmt->execute([$projectId]);
        $project = $projectStmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, [
                "success" => false,
                "message" => "Research project not found."
            ]);
        }

        if (
            $role === "supervisor" &&
            (int)$project["supervisor_id"] !== $supervisorProfileId
        ) {
            respond(403, [
                "success" => false,
                "message" => "You can only manage your own research projects."
            ]);
        }

        $studentStmt = $pdo->prepare("
            SELECT user_id
            FROM students
            WHERE user_id = ?
            LIMIT 1
        ");
        $studentStmt->execute([$assignedTo]);

        if (!$studentStmt->fetchColumn()) {
            respond(422, [
                "success" => false,
                "message" => "Select a valid student account."
            ]);
        }

        $projectStudentStmt = $pdo->prepare("
            SELECT id
            FROM students
            WHERE id = ? AND user_id = ?
            LIMIT 1
        ");
        $projectStudentStmt->execute([
            (int)$project["student_id"],
            $assignedTo
        ]);

        if (!$projectStudentStmt->fetchColumn()) {
            respond(422, [
                "success" => false,
                "message" => "The selected student is not associated with this research project."
            ]);
        }

        $submittedAt = $task["submitted_at"];

        if (
            in_array($status, ["Submitted", "Completed"], true) &&
            !$submittedAt
        ) {
            $submittedAt = date("Y-m-d H:i:s");
        }

        if (in_array($status, ["Pending", "In Progress", "Revision Required"], true)) {
            $submittedAt = null;
        }

        $update = $pdo->prepare("
            UPDATE tasks
            SET research_project_id = ?,
                title = ?,
                description = ?,
                assigned_to = ?,
                priority = ?,
                due_date = ?,
                status = ?,
                submitted_at = ?
            WHERE id = ?
        ");

        $update->execute([
            $projectId,
            $title,
            $description !== "" ? $description : null,
            $assignedTo,
            $priority,
            $dueDate !== "" ? $dueDate : null,
            $status,
            $submittedAt,
            $taskId
        ]);

        respond(200, [
            "success" => true,
            "message" => "Task updated successfully."
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE: Delete a task
    |--------------------------------------------------------------------------
    */
    if ($method === "DELETE") {
        if (!in_array($role, ["supervisor", "admin"], true)) {
            respond(403, [
                "success" => false,
                "message" => "Only supervisors and administrators can delete tasks."
            ]);
        }

        $data = requestData();
        $taskId = (int)($data["id"] ?? 0);

        if ($taskId <= 0) {
            respond(422, [
                "success" => false,
                "message" => "A valid task ID is required."
            ]);
        }

        $task = getTask($pdo, $taskId);
        checkTaskAccess($task, $role, $userId, $supervisorProfileId);

        $delete = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
        $delete->execute([$taskId]);

        respond(200, [
            "success" => true,
            "message" => "Task deleted successfully."
        ]);
    }

    header("Allow: GET, POST, PUT, DELETE, OPTIONS");

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $error) {
    error_log("AcaTrace tasks API error: " . $error->getMessage());

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing tasks. Check the PHP error log."
    ]);
}
