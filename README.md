# AcaTrace – Academic Research Management and Supervision Platform

**AcaTrace** is a web-based academic research management platform developed to improve the coordination, monitoring and administration of postgraduate research activities. It provides an integrated environment for students, research supervisors and academic administrators to manage research projects, monitor academic progress, coordinate supervision activities and facilitate communication throughout the research lifecycle.

The platform brings essential postgraduate research management processes into a centralised digital environment, supporting structured supervision, milestone tracking, document management, academic meetings, thesis defence coordination and administrative oversight.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Objectives](#objectives)
3. [Core Features](#core-features)
4. [User Roles and Functionalities](#user-roles-and-functionalities)
5. [Technology Stack](#technology-stack)
6. [System Architecture](#system-architecture)
7. [Project Structure](#project-structure)
8. [Installation and Setup](#installation-and-setup)
9. [Database Configuration](#database-configuration)
10. [Running the Application](#running-the-application)
11. [API Structure](#api-structure)
12. [Document and File Management](#document-and-file-management)
13. [Security Considerations](#security-considerations)
14. [Development and Maintenance](#development-and-maintenance)
15. [Future Development](#future-development)
16. [Contributing](#contributing)
17. [License](#license)

---

## Project Overview

Postgraduate research management involves several interconnected activities, including research proposal development, supervisor allocation, research progress monitoring, academic meetings, milestone assessment, document submission and thesis defence preparation.

Managing these activities through disconnected communication channels and manual administrative processes can create coordination difficulties, limit visibility into student progress and make supervision activities harder to monitor.

AcaTrace addresses these challenges through a role-based academic research management platform.

The application provides dedicated interfaces and supporting backend services for students, supervisors and administrators. Each user role accesses relevant functionality according to its responsibilities within the postgraduate research process.

The platform is designed to support a more organised, transparent and manageable research supervision environment for academic institutions.

## Objectives

The primary objectives of AcaTrace are to:

- Centralise postgraduate research administration and supervision activities.
- Improve communication and coordination between students and supervisors.
- Provide structured monitoring of research projects and academic progress.
- Support the management and assessment of research milestones.
- Facilitate document submission, review and feedback workflows.
- Improve the organisation of supervision meetings and related activities.
- Support thesis defence planning and coordination.
- Provide administrators with tools for managing academic structures and supervision processes.
- Improve visibility into research activities and outstanding academic responsibilities.

## Core Features

### 1. Authentication and User Management

AcaTrace provides authentication and role-based access for the platform's principal user categories.

Core functionality includes:

- User registration and login.
- Session-based authentication.
- Role-specific application access.
- User profile management.
- Logout functionality.
- Administrative management of academic users and structures.

### 2. Research Project Management

The research management module supports the organisation and monitoring of postgraduate research projects.

Key capabilities include:

- Research project records and management.
- Student and supervisor research associations.
- Research project information and tracking.
- Supervisor access to supervised research activities.
- Administrative oversight of research projects.

### 3. Research Milestone Management

Research milestones represent major academic checkpoints in the postgraduate research process.

Examples include:

- Research proposal development.
- Literature review.
- Research methodology.
- Data collection and analysis.
- Dissertation or thesis preparation.
- Final research submission.

The milestone management functionality supports:

- Milestone creation and management.
- Due dates and priority information.
- Progress status tracking.
- Submission and review workflows.
- Supervisor assessment of submitted milestones.
- Approval and revision-required decisions.
- Monitoring of outstanding and overdue milestones.

### 4. Research Task Management

The task management module supports smaller activities assigned to students during the research process.

Examples include reviewing journal articles, refining research objectives, preparing sections of a proposal and completing supervisor-assigned activities.

The module provides functionality for:

- Creating and assigning research tasks.
- Viewing assigned tasks.
- Monitoring task progress.
- Updating task status.
- Supporting supervisor oversight of student activities.

**Tasks and milestones serve different purposes:** tasks represent smaller research activities, whereas milestones represent major academic deliverables and checkpoints.

### 5. Supervision Meetings

The meetings module facilitates the scheduling and management of academic supervision meetings.

Supported meeting information includes:

- Meeting title.
- Research project association.
- Meeting agenda.
- Date and time.
- Online or in-person meeting format.
- Physical meeting location or online meeting link.
- Meeting status.

Meeting statuses include:

- Scheduled.
- Completed.
- Cancelled.

The functionality supports meeting administration by supervisors and administrators, while students can access meeting information and maintain relevant meeting notes and status information.

### 6. Research Document Management

AcaTrace includes document management functionality for research-related submissions.

The platform provides dedicated student document functionality and supporting supervisor document review services.

Relevant capabilities include:

- Student research document submissions.
- Document listing and access.
- Document download services.
- Supervisor document review functionality.
- Document review and feedback workflows.
- Protected storage for submitted documents.

### 7. Thesis Defence Management

The thesis defence module supports the coordination of postgraduate thesis defence activities.

The platform includes functionality for:

- Student thesis defence records.
- Thesis defence document management.
- Document access and download.
- Supervisor-side thesis defence management.
- Defence timetable coordination.

### 8. Notifications

The notification modules provide supporting functionality for student and supervisor notification activities.

They are intended to improve awareness of relevant research management activities and outstanding responsibilities.

### 9. Academic Administration

The administrator interface provides management functionality for important academic structures and research supervision activities.

Administrative modules include:

- Administrator dashboard.
- Institution management.
- Department management.
- Supervisor management.
- Research project management.
- Meeting management.
- Milestone management.
- Task management.
- Progress management.
- Profile management.

### 10. Progress Monitoring

The platform includes dedicated student, supervisor and administrative progress-related interfaces to support visibility into postgraduate research activities and supervision progress.

---

## User Roles and Functionalities

AcaTrace is organised around three principal user roles.

| User role | Responsibilities |
|---|---|
| Student | Access research information, manage research activities, view assigned tasks and milestones, access meetings, submit documents and follow thesis defence activities. |
| Supervisor | Manage supervised research, coordinate meetings, assign and monitor tasks, manage milestones, review research documents and coordinate relevant thesis defence activities. |
| Administrator | Manage institutions, departments, supervisors, research projects and other academic administration activities. |

Each role has dedicated frontend pages and supporting backend API functionality.

## Technology Stack

AcaTrace uses a modern JavaScript frontend with a PHP backend and relational database.

| Component | Technology |
|---|---|
| Frontend framework | React 19 |
| Frontend language | JavaScript (ES Modules) |
| Build tool | Vite 8 |
| Client-side routing | React Router 7 |
| Frontend styling | CSS3 |
| Backend | PHP |
| Database | MySQL / MariaDB |
| Database connectivity | PHP Data Objects (PDO) |
| Local development environment | XAMPP |
| Package management | npm |
| Code quality | ESLint |
| Version control | Git |
| Repository hosting | GitHub |

### Frontend

The frontend is developed with React and organised into role-specific pages and reusable application components.

Vite provides the development server and production build process, while React Router manages client-side navigation.

### Backend

The backend uses PHP to expose application endpoints responsible for authentication, research management, academic administration and other platform operations.

PDO provides the database connectivity layer.

### Database

MySQL or MariaDB is used for persistent application data, including user accounts, academic structures, research records and supervision-related information.

---

## System Architecture

AcaTrace follows a client-server architecture.

The frontend communicates with the PHP backend through HTTP requests. The backend processes requests, interacts with the MySQL/MariaDB database and returns responses to the frontend.

```text
                    AcaTrace Platform
                           |
             +-------------+-------------+
             |                           |
        React Frontend               PHP Backend
             |                           |
      +------+------+             +------+------+
      |      |      |             |      |      |
   Student Supervisor Admin    Auth  Research  Academic
      UI      UI     UI         API    APIs     APIs
                                      |
                                PDO Database
                                      |
                                MySQL / MariaDB
```

### Application Components

**Frontend application**

- Role-specific dashboards.
- Student, supervisor and administrator pages.
- Navigation and routing.
- Research management interfaces.
- Document and meeting interfaces.
- Application styling and user interaction.

**Backend application**

- Authentication and session handling.
- Research project operations.
- Academic administration.
- Task and milestone management.
- Meeting management.
- Student document services.
- Supervisor document review services.
- Thesis defence operations.
- Notification and profile services.

**Database layer**

- Persistent application data.
- User and role information.
- Research and supervision records.
- Academic management information.

---

## Project Structure

The main project directories are organised as follows:

```text
acatrace/
│
├── api/
│   ├── config/
│   │   └── database.php
│   │
│   ├── student/
│   │   ├── dashboard.php
│   │   ├── documents.php
│   │   ├── document_download.php
│   │   ├── meetings.php
│   │   ├── milestones.php
│   │   ├── notifications.php
│   │   ├── profile.php
│   │   ├── research_projects.php
│   │   ├── tasks.php
│   │   ├── thesis_defense.php
│   │   └── thesis_defense_download.php
│   │
│   ├── supervisor/
│   │   ├── dashboard.php
│   │   ├── defense-timetables.php
│   │   ├── document-file.php
│   │   ├── document-reviews.php
│   │   ├── meetings.php
│   │   ├── milestones.php
│   │   ├── notifications.php
│   │   ├── profile.php
│   │   ├── progress.php
│   │   ├── research.php
│   │   ├── tasks.php
│   │   └── thesis-defense.php
│   │
│   ├── auth.php
│   ├── dashboard.php
│   ├── database.php
│   ├── departments.php
│   ├── departments_manage.php
│   ├── institutions.php
│   ├── login.php
│   ├── logout.php
│   ├── meetings.php
│   ├── milestones.php
│   ├── profile.php
│   ├── register.php
│   ├── research_projects.php
│   ├── supervisor_management.php
│   ├── supervisors.php
│   ├── tasks.php
│   └── universities.php
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── assets/
│   ├── pages/
│   │   ├── administrator/
│   │   ├── student/
│   │   └── supervisor/
│   │
│   ├── styles/
│   │   ├── administrator/
│   │   ├── student/
│   │   └── supervisor/
│   │
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
│
├── storage/
│   ├── student_documents/
│   │   └── .htaccess
│   └── thesis_defense/
│       └── .htaccess
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

The structure may evolve as additional modules and supporting services are developed.

---

## Installation and Setup

The following instructions describe how to configure AcaTrace in a local Windows development environment using XAMPP.

### Prerequisites

Install the following software:

1. **XAMPP** – Apache, PHP and MySQL/MariaDB.
2. **Node.js** – JavaScript runtime.
3. **npm** – Node package manager, included with Node.js.
4. **Git** – For cloning and version control.
5. **Web browser** – Chrome, Edge or Firefox.

### Step 1: Clone the Repository

Open Command Prompt and run:

```bash
git clone https://github.com/julaskky/AcaTrace.git
```

Navigate into the project directory:

```bash
cd AcaTrace
```

Alternatively, place the project inside the XAMPP `htdocs` directory:

```text
C:\xampp\htdocs\acatrace
```

### Step 2: Install Frontend Dependencies

From the project root, execute:

```bash
npm install
```

This installs the dependencies defined in `package.json`.

### Step 3: Start XAMPP Services

Open the XAMPP Control Panel and start:

- Apache
- MySQL

Ensure that the services are running successfully.

### Step 4: Create the Database

Open phpMyAdmin:

```text
http://localhost/phpmyadmin
```

Create a MySQL database named:

```text
acatrace
```

**Database schema:** A database SQL export is not included in the current repository. To initialise a fresh installation, use the database schema from your existing development environment or an appropriately prepared database backup. Do not assume that creating an empty database alone will initialise all application tables.

---

## Database Configuration

Open:

```text
api/config/database.php
```

The local development configuration follows this structure:

```php
<?php

$host = "localhost";
$dbname = "acatrace";
$username = "root";
$password = "";

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password
    );

    $pdo->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

    $pdo->setAttribute(
        PDO::ATTR_DEFAULT_FETCH_MODE,
        PDO::FETCH_ASSOC
    );

} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed"
    ]);

    exit;
}
```

Update the connection values according to your local MySQL/MariaDB configuration.

For production deployment, use dedicated database credentials and keep sensitive configuration outside publicly accessible directories.

---

## Running the Application

### Start the React Development Server

From the project root:

```bash
npm run dev
```

Vite normally makes the frontend available at:

```text
http://localhost:5173
```

### Access the PHP Backend

With the project located in XAMPP's `htdocs` directory, the backend API is available under:

```text
http://localhost/acatrace/api
```

### Access the Application

Open:

```text
http://localhost:5173
```

Ensure Apache and MySQL remain active while using the application.

---

## API Structure

The PHP backend is organised into general, student-specific and supervisor-specific API endpoints.

### General API Endpoints

| Endpoint | Purpose |
|---|---|
| `auth.php` | Authentication support |
| `login.php` | User login |
| `register.php` | User registration |
| `logout.php` | User logout |
| `dashboard.php` | Dashboard data |
| `departments.php` | Department information |
| `departments_manage.php` | Department administration |
| `institutions.php` | Institution management |
| `meetings.php` | Meeting management |
| `milestones.php` | Milestone management |
| `profile.php` | Profile management |
| `research_projects.php` | Research project management |
| `supervisors.php` | Supervisor information |
| `supervisor_management.php` | Supervisor administration |
| `tasks.php` | Task management |
| `universities.php` | University information |

### Student API

Located in:

```text
api/student/
```

The student API includes services for:

- Dashboard information.
- Research projects.
- Research documents.
- Document downloads.
- Meetings.
- Milestones.
- Notifications.
- Profile management.
- Tasks.
- Thesis defence.
- Thesis defence document downloads.

### Supervisor API

Located in:

```text
api/supervisor/
```

The supervisor API includes services for:

- Dashboard information.
- Supervised research.
- Research progress.
- Research tasks.
- Milestones.
- Meetings.
- Document reviews.
- Document file access.
- Notifications.
- Profile management.
- Thesis defence.
- Thesis defence timetables.

---

## Document and File Management

AcaTrace maintains dedicated storage locations for student research documents and thesis defence submissions.

```text
storage/
├── student_documents/
└── thesis_defense/
```

The storage directories contain `.htaccess` protection files.

Actual student-submitted documents are intentionally excluded from the public Git repository to protect academic and personal information.

When deploying the platform, ensure that:

- Storage directories exist.
- The web server has the required file permissions.
- Uploaded files are validated.
- File access is authorised.
- Sensitive documents cannot be accessed through unrestricted public URLs.
- Backups are maintained securely.

---

## Security Considerations

Security is an important consideration for an academic research management system because the platform may process personal information, research documents and institutional records.

The current project includes a PDO-based database connection and protected storage directory configuration.

For production deployment, the following measures should be implemented and verified:

1. Use secure password hashing and password verification.
2. Enforce role-based access control on every protected backend endpoint.
3. Validate and sanitise incoming data.
4. Use prepared SQL statements to reduce SQL injection risks.
5. Protect authentication sessions and configure secure cookies.
6. Implement appropriate CSRF protection where required.
7. Restrict document access to authorised users.
8. Validate uploaded file types, sizes and contents.
9. Store production credentials securely outside public source control.
10. Configure HTTPS.
11. Apply appropriate CORS restrictions.
12. Maintain regular database and document backups.
13. Avoid exposing internal database errors or sensitive server information.

The local database configuration included in the project is intended for development and must be adjusted before production deployment.

---

## Development and Maintenance

### Available npm Commands

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Generate the production frontend build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint checks |

### Production Build

To generate the frontend production build:

```bash
npm run build
```

Vite generates the production assets in the `dist/` directory.

The PHP backend must also be deployed and configured on a compatible PHP web server with access to the required MySQL/MariaDB database.

---

## Future Development

AcaTrace provides a foundation for further development of a comprehensive postgraduate research management ecosystem.

Potential future enhancements include:

- Advanced research analytics and institutional reporting.
- Automated email and in-application notifications.
- Enhanced research progress visualisation.
- Supervisor workload and allocation analytics.
- More comprehensive document version management.
- Expanded thesis defence scheduling and assessment workflows.
- Institutional-level configuration and customisation.
- Enhanced audit trails and activity monitoring.
- Integration with institutional information systems.
- Production deployment automation and testing.

These items represent potential development directions and should not be interpreted as confirmation that they are already implemented.

---

## Contributing

Contributions, suggestions and technical improvements are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test the affected functionality.
5. Commit your changes with a meaningful commit message.
6. Submit a pull request describing the changes.

Example:

```bash
git checkout -b feature/your-feature-name

git add .

git commit -m "Add your feature description"

git push origin feature/your-feature-name
```

---

## License

No open-source licence has currently been specified for this repository. All rights and permissions should therefore be clarified by the project owner before redistribution, modification or commercial reuse.

---

## Project Repository

**GitHub:** https://github.com/julaskky/AcaTrace

**Project:** AcaTrace – Academic Research Management and Supervision Platform

**Primary Technologies:** React, JavaScript, PHP, MySQL/MariaDB and Vite.

---

*AcaTrace aims to make postgraduate research administration and supervision more structured, transparent, coordinated and manageable through an integrated digital platform.*
