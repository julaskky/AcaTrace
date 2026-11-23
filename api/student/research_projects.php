
<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

session_start();

require_once __DIR__ . "/../config/database.php";

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    respond(401, [
        "success" => false,
        "message" => "Please log in."
    ]);
}

$userId = (int) $_SESSION["user_id"];
$role = strtolower(trim((string) $_SESSION["role"]));
$method = $_SERVER["REQUEST_METHOD"];

if (!in_array($role, ["student", "supervisor", "admin"], true)) {
    respond(403, [
        "success" => false,
        "message" => "Access denied."
    ]);
}

$allowedStatuses = [
    "Proposed",
    "Active",
    "Completed",
    "On Hold",
    "Cancelled"
];

try {
    /*
    |--------------------------------------------------------------------------
    | GET PROJECTS
    |--------------------------------------------------------------------------
    */

    if ($method === "GET") {

        if ($role === "student") {

            // Students can only view their own research projects.
            $stmt = $pdo->prepare("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,
                    s.id AS student_id,
                    CONCAT(su.first_name, ' ', su.last_name)
                        AS supervisor_name
                FROM research_projects rp
                INNER JOIN students s
                    ON rp.student_id = s.id
                LEFT JOIN supervisors sp
                    ON rp.supervisor_id = sp.id
                LEFT JOIN users su
                    ON sp.user_id = su.id
                WHERE s.user_id = ?
                ORDER BY rp.created_at DESC
            ");

            $stmt->execute([$userId]);

        } elseif ($role === "supervisor") {

            $stmt = $pdo->prepare("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,
                    CONCAT(stu.first_name, ' ', stu.last_name)
                        AS student_name,
                    CONCAT(su.first_name, ' ', su.last_name)
                        AS supervisor_name
                FROM research_projects rp
                INNER JOIN students st
                    ON rp.student_id = st.id
                INNER JOIN users stu
                    ON st.user_id = stu.id
                INNER JOIN supervisors sp
                    ON rp.supervisor_id = sp.id
                INNER JOIN users su
                    ON sp.user_id = su.id
                WHERE sp.user_id = ?
                ORDER BY rp.created_at DESC
            ");

            $stmt->execute([$userId]);

        } else {

            // Administrators can view all research projects.
            $stmt = $pdo->query("
                SELECT
                    rp.id,
                    rp.title,
                    rp.description,
                    rp.research_area,
                    rp.methodology,
                    rp.status,
                    rp.start_date,
                    rp.expected_completion_date,
                    rp.created_at,
                    rp.updated_at,
                    CONCAT(stu.first_name, ' ', stu.last_name)
                        AS student_name,
                    CONCAT(su.first_name, ' ', su.last_name)
                        AS supervisor_name
                FROM research_projects rp
                INNER JOIN students st
                    ON rp.student_id = st.id
                INNER JOIN users stu
                    ON st.user_id = stu.id
                LEFT JOIN supervisors sp
                    ON rp.supervisor_id = sp.id
                LEFT JOIN users su
                    ON sp.user_id = su.id
                ORDER BY rp.created_at DESC
            ");
        }

        respond(200, [
            "success" => true,
            "projects" => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | READ REQUEST BODY
    |--------------------------------------------------------------------------
    */

    $input = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($input)) {
        $input = [];
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE PROJECT — ADMIN ONLY
    |--------------------------------------------------------------------------
    */

    if ($method === "POST") {

        if ($role !== "admin") {
            respond(403, [
                "success" => false,
                "message" => "Only administrators can create research projects."
            ]);
        }

        $studentId = (int) ($input["student_id"] ?? 0);
        $title = trim($input["title"] ?? "");
        $description = trim($input["description"] ?? "");
        $researchArea = trim($input["research_area"] ?? "");
        $methodology = trim($input["methodology"] ?? "");
        $status = trim($input["status"] ?? "Proposed");
        $supervisorId = !empty($input["supervisor_id"])
            ? (int) $input["supervisor_id"]
            : null;
        $startDate = $input["start_date"] ?? null;
        $completionDate = $input["expected_completion_date"] ?? null;

        if ($studentId <= 0 || $title === "") {
            respond(422, [
                "success" => false,
                "message" => "Student and project title are required."
            ]);
        }

        if (!in_array($status, $allowedStatuses, true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid project status."
            ]);
        }

        $stmt = $pdo->prepare(
            "SELECT id FROM students WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$studentId]);

        if (!$stmt->fetch()) {
            respond(422, [
                "success" => false,
                "message" => "Student profile not found."
            ]);
        }

        if ($supervisorId !== null) {
            $stmt = $pdo->prepare(
                "SELECT id FROM supervisors WHERE id = ? LIMIT 1"
            );
            $stmt->execute([$supervisorId]);

            if (!$stmt->fetch()) {
                respond(422, [
                    "success" => false,
                    "message" => "Selected supervisor does not exist."
                ]);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO research_projects (
                student_id,
                supervisor_id,
                title,
                description,
                research_area,
                methodology,
                status,
                start_date,
                expected_completion_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $studentId,
            $supervisorId,
            $title,
            $description ?: null,
            $researchArea ?: null,
            $methodology ?: null,
            $status,
            $startDate ?: null,
            $completionDate ?: null
        ]);

        respond(201, [
            "success" => true,
            "message" => "Research project created successfully.",
            "project_id" => $pdo->lastInsertId()
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE PROJECT — ADMIN OR ASSIGNED SUPERVISOR
    |--------------------------------------------------------------------------
    */

    if ($method === "PUT") {

        $projectId = (int) ($input["id"] ?? 0);

        if ($projectId <= 0) {
            respond(422, [
                "success" => false,
                "message" => "Invalid project ID."
            ]);
        }

        $stmt = $pdo->prepare("
            SELECT
                rp.*,
                st.user_id AS student_user_id,
                sp.user_id AS supervisor_user_id
            FROM research_projects rp
            INNER JOIN students st
                ON rp.student_id = st.id
            LEFT JOIN supervisors sp
                ON rp.supervisor_id = sp.id
            WHERE rp.id = ?
            LIMIT 1
        ");

        $stmt->execute([$projectId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, [
                "success" => false,
                "message" => "Research project not found."
            ]);
        }

        $isAssignedSupervisor =
            $role === "supervisor" &&
            (int) ($project["supervisor_user_id"] ?? 0) === $userId;

        if ($role !== "admin" && !$isAssignedSupervisor) {
            respond(403, [
                "success" => false,
                "message" => "You do not have permission to update this project."
            ]);
        }

        // Only administrators can assign or change a supervisor.
        if (
            $role === "admin" &&
            array_key_exists("supervisor_id", $input) &&
            !array_key_exists("title", $input)
        ) {
            $supervisorId = !empty($input["supervisor_id"])
                ? (int) $input["supervisor_id"]
                : null;

            if ($supervisorId !== null) {
                $stmt = $pdo->prepare(
                    "SELECT id FROM supervisors WHERE id = ? LIMIT 1"
                );
                $stmt->execute([$supervisorId]);

                if (!$stmt->fetch()) {
                    respond(422, [
                        "success" => false,
                        "message" => "Selected supervisor does not exist."
                    ]);
                }
            }

            $stmt = $pdo->prepare("
                UPDATE research_projects
                SET supervisor_id = ?
                WHERE id = ?
            ");

            $stmt->execute([$supervisorId, $projectId]);

            respond(200, [
                "success" => true,
                "message" => "Supervisor assignment updated."
            ]);
        }

        $title = trim($input["title"] ?? $project["title"]);
        $description = trim(
            $input["description"] ?? ($project["description"] ?? "")
        );
        $researchArea = trim(
            $input["research_area"] ?? ($project["research_area"] ?? "")
        );
        $methodology = trim(
            $input["methodology"] ?? ($project["methodology"] ?? "")
        );
        $status = trim($input["status"] ?? $project["status"]);

        $startDate = $input["start_date"] ?? $project["start_date"];
        $completionDate = $input["expected_completion_date"]
            ?? $project["expected_completion_date"];

        if ($title === "") {
            respond(422, [
                "success" => false,
                "message" => "Project title is required."
            ]);
        }

        if (!in_array($status, $allowedStatuses, true)) {
            respond(422, [
                "success" => false,
                "message" => "Invalid project status."
            ]);
        }

        // Do not allow supervisors to reassign a project.
        $supervisorId = $project["supervisor_id"];

        if ($role === "admin" && array_key_exists("supervisor_id", $input)) {
            $supervisorId = !empty($input["supervisor_id"])
                ? (int) $input["supervisor_id"]
                : null;
        }

        $stmt = $pdo->prepare("
            UPDATE research_projects
            SET
                title = ?,
                description = ?,
                research_area = ?,
                methodology = ?,
                status = ?,
                start_date = ?,
                expected_completion_date = ?,
                supervisor_id = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $title,
            $description ?: null,
            $researchArea ?: null,
            $methodology ?: null,
            $status,
            $startDate ?: null,
            $completionDate ?: null,
            $supervisorId,
            $projectId
        ]);

        respond(200, [
            "success" => true,
            "message" => "Research project updated successfully."
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE PROJECT — ADMIN ONLY
    |--------------------------------------------------------------------------
    */

    if ($method === "DELETE") {

        if ($role !== "admin") {
            respond(403, [
                "success" => false,
                "message" => "Only administrators can delete research projects."
            ]);
        }

        $projectId = (int) ($input["id"] ?? 0);

        if ($projectId <= 0) {
            respond(422, [
                "success" => false,
                "message" => "Invalid project ID."
            ]);
        }

        $stmt = $pdo->prepare(
            "SELECT id FROM research_projects WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$projectId]);

        if (!$stmt->fetch()) {
            respond(404, [
                "success" => false,
                "message" => "Research project not found."
            ]);
        }

        $stmt = $pdo->prepare(
            "DELETE FROM research_projects WHERE id = ?"
        );
        $stmt->execute([$projectId]);

        respond(200, [
            "success" => true,
            "message" => "Research project deleted successfully."
        ]);
    }

    respond(405, [
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (Throwable $e) {
    error_log("Research projects API error: " . $e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "A server error occurred while processing research projects."
    ]);
}
