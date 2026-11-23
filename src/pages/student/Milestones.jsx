
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/student/milestones.css";

const API_URL = "http://localhost/acatrace/api/student/milestones.php";

function normalizeStatus(status) {
  const value = String(status || "Pending").trim().toLowerCase();

  if (value === "completed") return "Completed";
  if (value === "in progress" || value === "in_progress") {
    return "In Progress";
  }
  if (value === "overdue") return "Overdue";

  return "Pending";
}

function formatDate(date) {
  if (!date) return "No deadline set";

  const parsedDate = new Date(`${String(date).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return String(date);

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(milestone) {
  if (!milestone.due_date) return false;
  if (normalizeStatus(milestone.status) === "Completed") return false;

  const dueDate = new Date(`${String(milestone.due_date).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return !Number.isNaN(dueDate.getTime()) && dueDate < today;
}

function Milestones() {
  const navigate = useNavigate();

  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  const loadMilestones = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (response.status === 403) {
        setError(data.message || "This page is available to student accounts only.");
        setMilestones([]);
        return;
      }

      if (!response.ok || !data.success) {
        setError(data.message || "Unable to load your milestones.");
        return;
      }

      setMilestones(Array.isArray(data.milestones) ? data.milestones : []);
    } catch {
      setError("Unable to connect to the server. Check that Apache and MySQL are running.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const summary = useMemo(() => {
    const completed = milestones.filter(
      (item) => normalizeStatus(item.status) === "Completed"
    ).length;

    const inProgress = milestones.filter(
      (item) => normalizeStatus(item.status) === "In Progress"
    ).length;

    const overdue = milestones.filter(isOverdue).length;

    return {
      total: milestones.length,
      completed,
      inProgress,
      pending: milestones.length - completed - inProgress,
      overdue,
      progress: milestones.length
        ? Math.round((completed / milestones.length) * 100)
        : 0,
    };
  }, [milestones]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((milestone) => {
      if (filter === "All") return true;
      if (filter === "Overdue") return isOverdue(milestone);

      return normalizeStatus(milestone.status) === filter;
    });
  }, [milestones, filter]);

  if (loading) {
    return (
      <main className="milestones-loading">
        <div className="milestones-spinner" />
        <p>Loading your milestones...</p>
      </main>
    );
  }

  return (
    <main className="milestones-page">
      <div className="milestones-container">
        <div className="milestones-topbar">
          <Link to="/student/dashboard" className="milestones-brand">
            Aca<span>Trace</span>
          </Link>

          <Link to="/student/dashboard" className="milestones-back-button">
            <span aria-hidden="true">←</span>
            Back to Dashboard
          </Link>
        </div>

        <header className="milestones-hero">
          <div>
            <p className="milestones-eyebrow">STUDENT WORKSPACE</p>
            <h1>My Research Milestones</h1>
            <p className="milestones-subtitle">
              Follow your research journey, review upcoming deadlines, and
              monitor milestone progress.
            </p>
          </div>
          <div className="milestones-hero-icon" aria-hidden="true">
            <span>✓</span>
          </div>
        </header>

        {error && (
          <div className="milestones-notice error" role="alert">
            <strong>Unable to display milestones</strong>
            <p>{error}</p>
            <button type="button" onClick={loadMilestones}>
              Try again
            </button>
          </div>
        )}

        {!error && (
          <>
            <section className="milestones-summary" aria-label="Milestone summary">
              <article className="milestones-summary-card">
                <span className="summary-icon blue">◎</span>
                <p>Total Milestones</p>
                <h2>{summary.total}</h2>
                <span className="summary-detail">Assigned to your research</span>
              </article>

              <article className="milestones-summary-card">
                <span className="summary-icon green">✓</span>
                <p>Completed</p>
                <h2>{summary.completed}</h2>
                <span className="summary-detail">Reviewed and completed</span>
              </article>

              <article className="milestones-summary-card">
                <span className="summary-icon purple">↗</span>
                <p>In Progress</p>
                <h2>{summary.inProgress}</h2>
                <span className="summary-detail">Currently underway</span>
              </article>

              <article className="milestones-summary-card">
                <span className="summary-icon orange">◷</span>
                <p>Overdue</p>
                <h2>{summary.overdue}</h2>
                <span className="summary-detail">Past deadline and incomplete</span>
              </article>
            </section>

            <section className="milestones-progress-panel">
              <div className="progress-panel-heading">
                <div>
                  <p className="milestones-eyebrow">YOUR RESEARCH JOURNEY</p>
                  <h2>Overall Progress</h2>
                  <p>Based on the milestone statuses recorded by your supervisor.</p>
                </div>
                <strong className="progress-percentage">{summary.progress}%</strong>
              </div>

              <div
                className="milestones-progress-track"
                role="progressbar"
                aria-label="Completed milestone progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.progress}
              >
                <div
                  className="milestones-progress-fill"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>

              <p className="progress-caption">
                {summary.completed} of {summary.total} milestones completed
              </p>
            </section>

            <section className="milestones-content">
              <div className="milestones-list-heading">
                <div>
                  <h2>Your Milestones</h2>
                  <p>
                    Review your assigned research stages and their current status.
                  </p>
                </div>

                <label className="milestones-filter">
                  <span>Filter:</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label="Filter milestones"
                  >
                    <option value="All">All Milestones</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </label>
              </div>

              {filteredMilestones.length === 0 ? (
                <div className="milestones-empty">
                  <div className="milestones-empty-icon" aria-hidden="true">◎</div>
                  <h3>
                    {milestones.length === 0
                      ? "No milestones assigned yet"
                      : "No milestones match this filter"}
                  </h3>
                  <p>
                    {milestones.length === 0
                      ? "Your supervisor's assigned milestones will appear here when they are added to your research project."
                      : "Try another filter to view your milestones."}
                  </p>
                  {filter !== "All" && (
                    <button
                      type="button"
                      className="milestones-reset-filter"
                      onClick={() => setFilter("All")}
                    >
                      View all milestones
                    </button>
                  )}
                </div>
              ) : (
                <div className="milestones-list">
                  {filteredMilestones.map((milestone, index) => {
                    const overdue = isOverdue(milestone);
                    const status = overdue
                      ? "Overdue"
                      : normalizeStatus(milestone.status);

                    const statusClass = status.toLowerCase().replace(" ", "-");

                    return (
                      <article className="milestone-item" key={milestone.id}>
                        <div className="milestone-item-marker" aria-hidden="true">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>

                        <div className="milestone-item-body">
                          <div className="milestone-item-heading">
                            <div className="milestone-item-title-group">
                              <span className="milestone-stage-label">
                                RESEARCH MILESTONE
                              </span>
                              <h3 className="milestone-item-title">
                                {milestone.title || "Research Milestone"}
                              </h3>
                            </div>

                            <span className={`milestone-status-badge ${statusClass}`}>
                              <span className="status-dot" />
                              {status}
                            </span>
                          </div>

                          <p className="milestone-project-name">
                            {milestone.project_title || "Research Project"}
                          </p>

                          <p className="milestone-item-description">
                            {milestone.description ||
                              "No additional details have been provided."}
                          </p>

                          <div className="milestone-item-footer">
                            <div className={`milestone-deadline ${overdue ? "is-overdue" : ""}`}>
                              <span className="deadline-icon" aria-hidden="true">◷</span>
                              <div>
                                <span>Deadline</span>
                                <strong>{formatDate(milestone.due_date)}</strong>
                              </div>
                            </div>

                            <div className="milestone-readonly-note">
                              <span aria-hidden="true">🔒</span>
                              Status managed by your supervisor
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="milestones-footer">
          <span>AcaTrace Student Workspace</span>
          <Link to="/student/dashboard">Return to Dashboard</Link>
        </footer>
      </div>
    </main>
  );
}

export default Milestones;
