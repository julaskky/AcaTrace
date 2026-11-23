import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/supervisor/my-progress.css";

const API = "http://localhost/acatrace/api";

async function fetchData(endpoint) {
  const response = await fetch(`${API}/${endpoint}`, {
    method: "GET",
    credentials: "include",
  });

  const data = await response.json();

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Unable to load ${endpoint}.`);
  }

  return data;
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompleted(item) {
  const status = normalise(item.status);
  return ["completed", "complete", "approved"].includes(status);
}

function projectId(item) {
  return String(
    item.research_project_id ?? item.project_id ?? ""
  );
}

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function ProgressBar({ value }) {
  const progress = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${progress}% complete`}
    >
      <div
        className="progress-bar-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function MyProgress() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setLoading(true);
      setError("");

      try {
        const [projectData, milestoneData, taskData] =
          await Promise.all([
            fetchData("research_projects.php"),
            fetchData("milestones.php"),
            fetchData("tasks.php"),
          ]);

        if (cancelled) return;

        setProjects(projectData.projects || []);
        setMilestones(milestoneData.milestones || []);
        setTasks(taskData.tasks || []);
      } catch (err) {
        if (cancelled) return;

        if (err.message === "SESSION_EXPIRED") {
          navigate("/login");
          return;
        }

        setError(
          err.message ||
            "Unable to load your progress. Please try again."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const progressData = useMemo(() => {
    const completedMilestones = milestones.filter(isCompleted).length;
    const completedTasks = tasks.filter(isCompleted).length;

    const totalItems = milestones.length + tasks.length;
    const completedItems = completedMilestones + completedTasks;

    const overallProgress = totalItems
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    const projectProgress = projects.map((project) => {
      const id = String(project.id);

      const projectMilestones = milestones.filter(
        (item) => projectId(item) === id
      );

      const projectTasks = tasks.filter(
        (item) => projectId(item) === id
      );

      const projectItems = [
        ...projectMilestones,
        ...projectTasks,
      ];

      const completed = projectItems.filter(isCompleted).length;

      let progress = projectItems.length
        ? Math.round((completed / projectItems.length) * 100)
        : normalise(project.status) === "completed"
          ? 100
          : 0;

      return {
        ...project,
        progress,
        milestoneCount: projectMilestones.length,
        completedMilestones: projectMilestones.filter(isCompleted).length,
        taskCount: projectTasks.length,
        completedTasks: projectTasks.filter(isCompleted).length,
      };
    });

    return {
      completedMilestones,
      completedTasks,
      totalItems,
      completedItems,
      overallProgress,
      projectProgress,
    };
  }, [projects, milestones, tasks]);

  if (loading) {
    return (
      <div className="my-progress-page">
        <div className="my-progress-message">
          Loading your progress...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-progress-page">
        <div className="my-progress-error">
          <h2>Unable to load My Progress</h2>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
          <p>
            <Link to="/dashboard">Back to Dashboard</Link>
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Research Projects",
      value: projects.length,
      icon: "📚",
    },
    {
      label: "Milestones Completed",
      value: `${progressData.completedMilestones}/${milestones.length}`,
      icon: "🎯",
    },
    {
      label: "Tasks Completed",
      value: `${progressData.completedTasks}/${tasks.length}`,
      icon: "✓",
    },
    {
      label: "Overall Completion",
      value: `${progressData.overallProgress}%`,
      icon: "📈",
    },
  ];

  return (
    <div className="my-progress-page">
      <header className="my-progress-header">
        <div>
          <Link to="/dashboard" className="my-progress-back">
            ← Back to Dashboard
          </Link>
          <h1>My Progress</h1>
          <p>
            Monitor your research milestones, tasks, and project activity.
          </p>
        </div>

        <Link to="/research" className="my-progress-primary-button">
          View My Research
        </Link>
      </header>

      <section className="my-progress-overview">
        <div className="my-progress-overview-text">
          <span className="my-progress-eyebrow">
            YOUR RESEARCH JOURNEY
          </span>
          <h2>{progressData.overallProgress}% completed</h2>
          <p>
            {progressData.totalItems === 0
              ? "Your progress will appear here as milestones and tasks are added."
              : `${progressData.completedItems} of ${progressData.totalItems} tracked milestones and tasks completed.`}
          </p>
          <ProgressBar value={progressData.overallProgress} />
        </div>

        <div className="my-progress-overview-icon" aria-hidden="true">
          📈
        </div>
      </section>

      <section className="my-progress-stats">
        {stats.map((stat) => (
          <article className="my-progress-stat" key={stat.label}>
            <span className="my-progress-stat-icon">{stat.icon}</span>
            <div>
              <p>{stat.label}</p>
              <h3>{stat.value}</h3>
            </div>
          </article>
        ))}
      </section>

      <section className="my-progress-section">
        <div className="my-progress-section-heading">
          <div>
            <h2>Progress by Research Project</h2>
            <p>
              Progress is calculated from each project's completed
              milestones and tasks.
            </p>
          </div>
          <Link to="/research">View all projects →</Link>
        </div>

        {progressData.projectProgress.length === 0 ? (
          <div className="my-progress-empty">
            <span>📚</span>
            <h3>No research projects yet</h3>
            <p>
              Your project progress will appear here when a research
              project is available.
            </p>
            <Link to="/research" className="my-progress-primary-button">
              Open My Research
            </Link>
          </div>
        ) : (
          <div className="my-progress-project-grid">
            {progressData.projectProgress.map((project) => (
              <article
                className="my-progress-project-card"
                key={project.id}
              >
                <div className="my-progress-project-top">
                  <span className="my-progress-project-icon">📘</span>
                  <span
                    className={`my-progress-status status-${normalise(
                      project.status || "not started"
                    ).replace(/\s+/g, "-")}`}
                  >
                    {project.status || "Not started"}
                  </span>
                </div>

                <h3>{project.title}</h3>

                <p className="my-progress-project-area">
                  {project.research_area || "Research area not specified"}
                </p>

                <div className="my-progress-project-percentage">
                  <span>Completion</span>
                  <strong>{project.progress}%</strong>
                </div>

                <ProgressBar value={project.progress} />

                <div className="my-progress-project-details">
                  <div>
                    <span>Milestones</span>
                    <strong>
                      {project.completedMilestones}/
                      {project.milestoneCount}
                    </strong>
                  </div>
                  <div>
                    <span>Tasks</span>
                    <strong>
                      {project.completedTasks}/{project.taskCount}
                    </strong>
                  </div>
                </div>

                <p className="my-progress-due-date">
                  Expected completion:{" "}
                  {formatDate(project.expected_completion_date)}
                </p>

                <Link
                  to="/research"
                  className="my-progress-project-link"
                >
                  View project details →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="my-progress-section">
        <div className="my-progress-section-heading">
          <div>
            <h2>Continue Your Work</h2>
            <p>Open a section to update your research activity.</p>
          </div>
        </div>

        <div className="my-progress-actions">
          <Link to="/milestones">
            <span>🎯</span>
            <div>
              <strong>Milestones</strong>
              <p>Review your research milestones.</p>
            </div>
            <span className="my-progress-action-arrow">→</span>
          </Link>

          <Link to="/tasks">
            <span>✓</span>
            <div>
              <strong>Tasks</strong>
              <p>View assignments and update task progress.</p>
            </div>
            <span className="my-progress-action-arrow">→</span>
          </Link>

          <Link to="/meetings">
            <span>📅</span>
            <div>
              <strong>Meetings</strong>
              <p>Review your research meetings.</p>
            </div>
            <span className="my-progress-action-arrow">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default MyProgress;