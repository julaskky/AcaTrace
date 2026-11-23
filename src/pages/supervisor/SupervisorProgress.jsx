import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/supervisor/supervisor-progress.css";

const API_URL = "http://localhost/acatrace/api/supervisor/progress.php";

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function statusClass(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function ProgressBar({ value, color = "indigo" }) {
  return (
    <div className={`sp-progress-track ${color}`}>
      <div
        className="sp-progress-fill"
        style={{
          width: `${Math.min(100, Math.max(0, Number(value) || 0))}%`,
        }}
      />
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }) {
  return (
    <article className={`sp-stat-card ${tone}`}>
      <div className="sp-stat-top">
        <span className="sp-stat-icon">{icon}</span>
        <span className="sp-stat-label">{label}</span>
      </div>
      <div className="sp-stat-value">{value}</div>
      <div className="sp-stat-note">{note}</div>
    </article>
  );
}

export default function SupervisorProgress() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [progressFilter, setProgressFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  async function loadProgress() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not load student progress."
        );
      }

      setStudents(result.data?.students || []);
      setSummary(result.data?.summary || {});
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress();
  }, []);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !term ||
        [
          student.student_name,
          student.student_number,
          student.email,
          student.programme,
          student.project_title,
        ].some((value) =>
          String(value || "").toLowerCase().includes(term)
        );

      const progress = Number(student.overall_progress || 0);

      const matchesProgress =
        progressFilter === "all" ||
        (progressFilter === "low" && progress < 40) ||
        (progressFilter === "medium" &&
          progress >= 40 &&
          progress < 75) ||
        (progressFilter === "high" && progress >= 75);

      const projectStatus = String(
        student.project_status || ""
      ).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        projectStatus === statusFilter.toLowerCase();

      return matchesSearch && matchesProgress && matchesStatus;
    });
  }, [students, search, progressFilter, statusFilter]);

  function exportCsv() {
    const headers = [
      "Student",
      "Student Number",
      "Programme",
      "Research Project",
      "Project Status",
      "Overall Progress (%)",
      "Milestone Progress (%)",
      "Task Progress (%)",
      "Overdue Items",
      "Pending Reviews",
      "Expected Completion",
    ];

    const rows = filteredStudents.map((student) => [
      student.student_name,
      student.student_number,
      student.programme,
      student.project_title,
      student.project_status,
      student.overall_progress,
      student.milestone_progress,
      student.task_progress,
      student.overdue_count,
      student.pending_review_count,
      student.expected_completion_date,
    ]);

    const escapeCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "acatrace-student-progress.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setProgressFilter("all");
    setStatusFilter("all");
  }

  return (
    <main className="sp-page">
      <section className="sp-hero">
        <div className="sp-hero-orb sp-orb-one" />
        <div className="sp-hero-orb sp-orb-two" />

        <div className="sp-hero-content">
          <div className="sp-eyebrow">
            <span className="sp-eyebrow-dot" />
            SUPERVISOR WORKSPACE
          </div>

          <h1>Student Progress</h1>

          <p>
            Monitor research milestones, task performance, deadlines,
            and each student's progress in one place.
          </p>

          <div className="sp-hero-actions">
            <button
              type="button"
              className="sp-button sp-button-light"
              onClick={() => navigate("/supervisor/dashboard")}
            >
              ← Back to Dashboard
            </button>

            <button
              type="button"
              className="sp-button sp-button-light"
              onClick={loadProgress}
              disabled={loading}
            >
              ↻ {loading ? "Refreshing..." : "Refresh data"}
            </button>

            <button
              type="button"
              className="sp-button sp-button-outline"
              onClick={exportCsv}
              disabled={loading || filteredStudents.length === 0}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

        <div className="sp-hero-decoration" aria-hidden="true">
          <div className="sp-decoration-ring">
            <div className="sp-decoration-inner">
              <span>↗</span>
              <small>RESEARCH</small>
              <strong>PROGRESS</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-content">
        <div className="sp-section-heading">
          <div>
            <span className="sp-kicker">AT A GLANCE</span>
            <h2>Supervision overview</h2>
            <p>Your current research supervision indicators.</p>
          </div>

          <span className="sp-live-label">
            <span /> Live database
          </span>
        </div>

        {error && (
          <div className="sp-alert" role="alert">
            <div>
              <strong>Unable to load progress</strong>
              <p>{error}</p>
            </div>
            <button type="button" onClick={loadProgress}>
              Try again
            </button>
          </div>
        )}

        <div className="sp-stats-grid">
          <StatCard
            icon="♙"
            label="Supervised students"
            value={loading ? "—" : summary.total_students ?? 0}
            note="Students assigned to you"
            tone="sp-tone-purple"
          />

          <StatCard
            icon="◫"
            label="Active projects"
            value={loading ? "—" : summary.active_projects ?? 0}
            note="Currently in progress"
            tone="sp-tone-blue"
          />

          <StatCard
            icon="↗"
            label="Average progress"
            value={loading ? "—" : `${summary.average_progress ?? 0}%`}
            note="Based on milestones and tasks"
            tone="sp-tone-green"
          />

          <StatCard
            icon="◷"
            label="Overdue items"
            value={loading ? "—" : summary.overdue_items ?? 0}
            note="Past-due incomplete work"
            tone="sp-tone-orange"
          />

          <StatCard
            icon="◎"
            label="Pending reviews"
            value={loading ? "—" : summary.pending_reviews ?? 0}
            note="Submissions awaiting review"
            tone="sp-tone-pink"
          />

          <StatCard
            icon="✓"
            label="Completed projects"
            value={loading ? "—" : summary.completed_projects ?? 0}
            note="Marked completed"
            tone="sp-tone-teal"
          />
        </div>

        <section className="sp-list-panel">
          <div className="sp-panel-heading">
            <div>
              <span className="sp-kicker">INDIVIDUAL TRACKING</span>
              <h2>Researcher performance</h2>
              <p>
                Choose a student to inspect their milestones and tasks.
              </p>
            </div>

            <span className="sp-result-count">
              {loading
                ? "Loading…"
                : `${filteredStudents.length} project${
                    filteredStudents.length === 1 ? "" : "s"
                  }`}
            </span>
          </div>

          <div className="sp-filters">
            <label className="sp-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, project, number..."
              />
            </label>

            <select
              value={progressFilter}
              onChange={(event) => setProgressFilter(event.target.value)}
              aria-label="Filter by progress"
            >
              <option value="all">All progress levels</option>
              <option value="low">Needs attention: below 40%</option>
              <option value="medium">Developing: 40–74%</option>
              <option value="high">On track: 75% or more</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by project status"
            >
              <option value="all">All project statuses</option>
              <option value="active">Active</option>
              <option value="proposed">Proposed</option>
              <option value="on hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {loading ? (
            <div className="sp-state">
              <div className="sp-spinner" />
              <strong>Loading student progress...</strong>
              <p>Collecting milestones, tasks, and deadlines.</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="sp-state">
              <div className="sp-empty-icon">⌕</div>
              <strong>No matching research projects</strong>
              <p>
                {students.length === 0
                  ? "No research projects are currently assigned to your supervisor account."
                  : "Try changing your search or filters."}
              </p>

              {(search ||
                progressFilter !== "all" ||
                statusFilter !== "all") && (
                <button
                  type="button"
                  className="sp-button sp-button-primary"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="sp-student-grid">
              {filteredStudents.map((student) => (
                <article
                  className="sp-student-card"
                  key={student.project_id}
                >
                  <div className="sp-card-top">
                    <div className="sp-avatar">
                      {student.student_name
                        ?.split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase() || "ST"}
                    </div>

                    <div className="sp-student-identity">
                      <h3>{student.student_name || "Unnamed student"}</h3>
                      <p>
                        {student.student_number || "No student number"}
                      </p>
                    </div>

                    <span
                      className={`sp-status sp-status-${statusClass(
                        student.project_status
                      )}`}
                    >
                      {student.project_status || "Unknown"}
                    </span>
                  </div>

                  <div className="sp-programme">
                    {student.programme ||
                      student.academic_level ||
                      "Programme not specified"}
                  </div>

                  <div className="sp-project-box">
                    <span>RESEARCH PROJECT</span>
                    <strong>{student.project_title}</strong>
                  </div>

                  <div className="sp-overall">
                    <div className="sp-progress-label-row">
                      <span>Overall progress</span>
                      <strong>{student.overall_progress}%</strong>
                    </div>

                    <ProgressBar value={student.overall_progress} />

                    <span className="sp-progress-hint">
                      {student.overall_progress >= 75
                        ? "Good progress"
                        : student.overall_progress >= 40
                        ? "Progress developing"
                        : Number(student.milestone_total || 0) +
                            Number(student.task_total || 0) ===
                          0
                        ? "No milestones or tasks yet"
                        : "May need additional support"}
                    </span>
                  </div>

                  <div className="sp-mini-metrics">
                    <div>
                      <span className="sp-mini-icon sp-mini-purple">
                        ⚑
                      </span>
                      <div>
                        <strong>
                          {student.milestone_completed}/
                          {student.milestone_total}
                        </strong>
                        <span>Milestones</span>
                      </div>
                    </div>

                    <div>
                      <span className="sp-mini-icon sp-mini-blue">
                        ✓
                      </span>
                      <div>
                        <strong>
                          {student.task_completed}/{student.task_total}
                        </strong>
                        <span>Tasks complete</span>
                      </div>
                    </div>
                  </div>

                  <div className="sp-card-footer">
                    <div className="sp-deadline">
                      <span>Expected completion</span>
                      <strong>
                        {formatDate(student.expected_completion_date)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="sp-details-button"
                      onClick={() => setSelected(student)}
                    >
                      View details <span>→</span>
                    </button>
                  </div>

                  {(Number(student.overdue_count) > 0 ||
                    Number(student.pending_review_count) > 0) && (
                    <div className="sp-card-alerts">
                      {Number(student.overdue_count) > 0 && (
                        <span className="sp-alert-chip sp-alert-overdue">
                          ⚠ {student.overdue_count} overdue
                        </span>
                      )}

                      {Number(student.pending_review_count) > 0 && (
                        <span className="sp-alert-chip sp-alert-review">
                          ◷ {student.pending_review_count} to review
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {selected && (
        <div
          className="sp-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <section
            className="sp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sp-modal-header">
              <div>
                <span className="sp-kicker">
                  STUDENT PROGRESS REPORT
                </span>
                <h2 id="sp-modal-title">{selected.student_name}</h2>
                <p>{selected.project_title}</p>
              </div>

              <button
                type="button"
                className="sp-modal-close"
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="sp-modal-summary">
              <div>
                <span>Overall progress</span>
                <strong>{selected.overall_progress}%</strong>
                <ProgressBar value={selected.overall_progress} />
              </div>

              <div>
                <span>Milestone progress</span>
                <strong>{selected.milestone_progress}%</strong>
                <ProgressBar
                  value={selected.milestone_progress}
                  color="blue"
                />
              </div>

              <div>
                <span>Task progress</span>
                <strong>{selected.task_progress}%</strong>
                <ProgressBar
                  value={selected.task_progress}
                  color="green"
                />
              </div>
            </div>

            <div className="sp-detail-meta">
              <div>
                <span>Student number</span>
                <strong>{selected.student_number || "Not set"}</strong>
              </div>

              <div>
                <span>Programme</span>
                <strong>{selected.programme || "Not set"}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{selected.email || "Not set"}</strong>
              </div>

              <div>
                <span>Project start</span>
                <strong>{formatDate(selected.start_date)}</strong>
              </div>

              <div>
                <span>Expected completion</span>
                <strong>
                  {formatDate(selected.expected_completion_date)}
                </strong>
              </div>

              <div>
                <span>Latest meeting</span>
                <strong>
                  {selected.latest_meeting
                    ? `${formatDate(
                        selected.latest_meeting.meeting_date
                      )} · ${selected.latest_meeting.title}`
                    : "No meetings recorded"}
                </strong>
              </div>
            </div>

            <div className="sp-detail-section">
              <div className="sp-detail-heading">
                <h3>Milestones</h3>
                <span>{selected.milestones.length} total</span>
              </div>

              {selected.milestones.length === 0 ? (
                <p className="sp-detail-empty">
                  No milestones have been added to this project.
                </p>
              ) : (
                <div className="sp-detail-list">
                  {selected.milestones.map((milestone) => (
                    <div
                      className="sp-detail-item"
                      key={milestone.id}
                    >
                      <span
                        className={`sp-detail-symbol ${
                          milestone.is_overdue ? "is-overdue" : ""
                        }`}
                      >
                        {milestone.is_overdue ? "!" : "⚑"}
                      </span>

                      <div className="sp-detail-item-main">
                        <strong>{milestone.title}</strong>
                        {milestone.description && (
                          <p>{milestone.description}</p>
                        )}
                        <small>
                          Due: {formatDate(milestone.due_date)}
                        </small>
                      </div>

                      <div className="sp-detail-item-status">
                        <span
                          className={`sp-status sp-status-${statusClass(
                            milestone.status
                          )}`}
                        >
                          {milestone.status || "Pending"}
                        </span>

                        {milestone.pending_review && (
                          <small>Awaiting review</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sp-detail-section">
              <div className="sp-detail-heading">
                <h3>Tasks</h3>
                <span>{selected.tasks.length} total</span>
              </div>

              {selected.tasks.length === 0 ? (
                <p className="sp-detail-empty">
                  No tasks have been assigned to this student.
                </p>
              ) : (
                <div className="sp-detail-list">
                  {selected.tasks.map((task) => (
                    <div className="sp-detail-item" key={task.id}>
                      <span
                        className={`sp-detail-symbol ${
                          task.is_overdue ? "is-overdue" : ""
                        }`}
                      >
                        {task.is_overdue ? "!" : "✓"}
                      </span>

                      <div className="sp-detail-item-main">
                        <strong>{task.title}</strong>
                        {task.description && <p>{task.description}</p>}
                        <small>
                          Due: {formatDate(task.due_date)} · Priority:{" "}
                          {task.priority || "Medium"}
                        </small>
                      </div>

                      <div className="sp-detail-item-status">
                        <span
                          className={`sp-status sp-status-${statusClass(
                            task.status
                          )}`}
                        >
                          {task.status || "Pending"}
                        </span>

                        {task.pending_review && (
                          <small>Awaiting review</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sp-modal-footer">
              <span>
                {selected.overdue_count} overdue ·{" "}
                {selected.pending_review_count} awaiting review
              </span>

              <button
                type="button"
                className="sp-button sp-button-primary"
                onClick={() => setSelected(null)}
              >
                Close report
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
