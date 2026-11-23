<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

require_once __DIR__ . "/config/database.php";

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You are not authenticated."
    ]);

    exit;
}

$userId = (int) $_SESSION["user_id"];

try {

    /*
     * GET PROFILE
     */
    if ($_SERVER["REQUEST_METHOD"] === "GET") {

        $query = $pdo->prepare("
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.status,

                s.student_number,
                s.programme,
                s.academic_level,
                s.enrollment_date,
                s.expected_completion_date,
                s.status AS student_status,

                un.id AS university_id,
                un.name AS university_name,
                un.country AS university_country,

                d.id AS department_id,
                d.name AS department_name

            FROM users u

            LEFT JOIN students s
                ON s.user_id = u.id

            LEFT JOIN universities un
                ON s.university_id = un.id

            LEFT JOIN departments d
                ON s.department_id = d.id

            WHERE u.id = :user_id
            LIMIT 1
        ");

        $query->execute([
            ":user_id" => $userId
        ]);

        $profile = $query->fetch();

        if (!$profile) {
            http_response_code(404);

            echo json_encode([
                "success" => false,
                "message" => "Profile not found."
            ]);

            exit;
        }

        echo json_encode([
            "success" => true,
            "profile" => $profile
        ]);

        exit;
    }


    /*
     * UPDATE PROFILE
     */
    if ($_SERVER["REQUEST_METHOD"] === "PUT") {

        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!$input) {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Invalid request data."
            ]);

            exit;
        }

        $firstName = trim($input["first_name"] ?? "");
        $lastName = trim($input["last_name"] ?? "");
        $email = trim($input["email"] ?? "");

        if ($firstName === "" || $lastName === "" || $email === "") {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "First name, last name and email are required."
            ]);

            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Please enter a valid email address."
            ]);

            exit;
        }

        /*
         * Check email belongs to another account
         */
        $emailCheck = $pdo->prepare("
            SELECT id
            FROM users
            WHERE email = :email
            AND id != :user_id
            LIMIT 1
        ");

        $emailCheck->execute([
            ":email" => $email,
            ":user_id" => $userId
        ]);

        if ($emailCheck->fetch()) {
            http_response_code(409);

            echo json_encode([
                "success" => false,
                "message" => "This email address is already in use."
            ]);

            exit;
        }

        $pdo->beginTransaction();

        /*
         * Update user
         */
        $userUpdate = $pdo->prepare("
            UPDATE users
            SET
                first_name = :first_name,
                last_name = :last_name,
                email = :email
            WHERE id = :user_id
        ");

        $userUpdate->execute([
            ":first_name" => $firstName,
            ":last_name" => $lastName,
            ":email" => $email,
            ":user_id" => $userId
        ]);

        /*
         * Update student information
         */
        if ($_SESSION["role"] === "student") {

            $academicLevel = trim($input["academic_level"] ?? "");
            $studentNumber = trim($input["student_number"] ?? "");
            $programme = trim($input["programme"] ?? "");
            $universityId = !empty($input["university_id"])
                ? (int) $input["university_id"]
                : null;
            $departmentId = !empty($input["department_id"])
                ? (int) $input["department_id"]
                : null;
            $enrollmentDate = !empty($input["enrollment_date"])
                ? $input["enrollment_date"]
                : null;
            $expectedCompletionDate = !empty($input["expected_completion_date"])
                ? $input["expected_completion_date"]
                : null;

            $allowedLevels = [
                "Diploma",
                "Undergraduate",
                "Postgraduate"
            ];

            if (!in_array($academicLevel, $allowedLevels, true)) {
                $pdo->rollBack();

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "message" => "Invalid academic level."
                ]);

                exit;
            }

            $studentCheck = $pdo->prepare("
                SELECT id
                FROM students
                WHERE user_id = :user_id
                LIMIT 1
            ");

            $studentCheck->execute([
                ":user_id" => $userId
            ]);

            if ($studentCheck->fetch()) {

                $studentUpdate = $pdo->prepare("
                    UPDATE students
                    SET
                        student_number = :student_number,
                        programme = :programme,
                        academic_level = :academic_level,
                        university_id = :university_id,
                        department_id = :department_id,
                        enrollment_date = :enrollment_date,
                        expected_completion_date = :expected_completion_date
                    WHERE user_id = :user_id
                ");

                $studentUpdate->execute([
                    ":student_number" => $studentNumber ?: null,
                    ":programme" => $programme ?: null,
                    ":academic_level" => $academicLevel,
                    ":university_id" => $universityId,
                    ":department_id" => $departmentId,
                    ":enrollment_date" => $enrollmentDate,
                    ":expected_completion_date" => $expectedCompletionDate,
                    ":user_id" => $userId
                ]);

            } else {

                $studentInsert = $pdo->prepare("
                    INSERT INTO students (
                        user_id,
                        university_id,
                        department_id,
                        student_number,
                        programme,
                        academic_level,
                        enrollment_date,
                        expected_completion_date,
                        status
                    )
                    VALUES (
                        :user_id,
                        :university_id,
                        :department_id,
                        :student_number,
                        :programme,
                        :academic_level,
                        :enrollment_date,
                        :expected_completion_date,
                        'active'
                    )
                ");

                $studentInsert->execute([
                    ":user_id" => $userId,
                    ":university_id" => $universityId,
                    ":department_id" => $departmentId,
                    ":student_number" => $studentNumber ?: null,
                    ":programme" => $programme ?: null,
                    ":academic_level" => $academicLevel,
                    ":enrollment_date" => $enrollmentDate,
                    ":expected_completion_date" => $expectedCompletionDate
                ]);
            }
        }

        $pdo->commit();

        /*
         * Update session information
         */
        $_SESSION["first_name"] = $firstName;
        $_SESSION["last_name"] = $lastName;
        $_SESSION["email"] = $email;

        echo json_encode([
            "success" => true,
            "message" => "Profile updated successfully."
        ]);

        exit;
    }

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to process your profile."
    ]);
}