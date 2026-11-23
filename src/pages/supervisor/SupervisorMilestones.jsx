import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/supervisor/supervisor-milestones.css";

const API = "http://localhost/acatrace/api/supervisor/milestones.php";

const emptyForm = {
  id: null,
  research_project_id: "",
  title: "",
  description: "",
  due_date: "",
  priority: "Medium",
  status: "Pending",
};

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Pending", "In Progress", "Completed"];

function formatDate(value) {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function statusClass(status, overdue) {
  if (overdue) return "sm-status-overdue";

  const value = String(status || "Pending").toLowerCase();

  if (value === "completed") return "sm-status-completed";
  if (value === "in progress") return "sm-status-progress";

  return "sm-status-pending";
}

function getErrorMessage(result, fallback) {
  return result?.message || fallback;
}

export default function SupervisorMilestones() {
  const [milestones, setMilestones] = useState([]);
  const [projects, setProjects] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    overdue: 0,
    pending_reviews: 0,
  });

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [reviewing, setReviewing] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Could not load milestones.")
        );
      }

      // The PHP API returns its data inside result.data.
      const data = result.data || {};

      setMilestones(
        Array.isArray(data.milestones) ? data.milestones : []
      );

      setProjects(
        Array.isArray(data.projects) ? data.projects : []
      );

      setStats({
        total: 0,
        completed: 0,
        in_progress: 0,
        overdue: 0,
        pending_reviews: 0,
        ...(data.stats || {}),
      });
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMilestones = useMemo(() => {
    const term = search.trim().toLowerCase();

    return milestones.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.title,
          item.description,
          item.project_title,
          item.student_name,
        ].some((value) =>
          String(value || "").toLowerCase().includes(term)
        );

      const status = String(item.status || "Pending").toLowerCase();

      const matchesFilter =
        filter === "All" ||
        (filter === "Overdue" && Boolean(item.is_overdue)) ||
        (filter === "Pending" &&
          status === "pending" &&
          !item.is_overdue) ||
        (filter === "In Progress" && status === "in progress") ||
        (filter === "Completed" && status === "completed") ||
        (filter === "Needs Review" &&
          item.submission_status === "Pending Review");

      return matchesSearch && matchesFilter;
    });
  }, [milestones, search, filter]);

  function openCreate() {
    setForm({
      ...emptyForm,
      research_project_id: projects.length
        ? String(projects[0].id)
        : "",
    });

    setEditing(false);
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      research_project_id: String(item.research_project_id ?? ""),
      title: item.title || "",
      description: item.description || "",
      due_date: item.due_date || "",
      priority: PRIORITIES.includes(item.priority)
        ? item.priority
        : "Medium",
      status: STATUSES.includes(item.status)
        ? item.status
        : "Pending",
    });

    setEditing(true);
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setForm(emptyForm);
  }

  function updateFormField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function saveMilestone(event) {
    event.preventDefault();

    if (saving) return;

    if (!form.research_project_id) {
      setError("Please select a research project.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter a milestone title.");
      return;
    }

    if (!form.due_date) {
      setError("Please select a milestone deadline.");
      return;
    }

    if (!PRIORITIES.includes(form.priority)) {
      setError("Please select a valid priority.");
      return;
    }

    if (!STATUSES.includes(form.status)) {
      setError("Please select a valid milestone status.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        action: editing ? "update" : "create",
        id: editing ? Number(form.id) : null,
        research_project_id: Number(form.research_project_id),
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: form.due_date,
        priority: form.priority,
        status: form.status,
      };

      const response = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Could not save milestone.")
        );
      }

      setShowForm(false);
      setForm(emptyForm);
      setNotice(
        result.message ||
          (editing
            ? "Milestone updated successfully."
            : "Milestone created successfully.")
      );

      await loadData();
    } catch (err) {
      setError(err.message || "Could not save milestone.");
    } finally {
      setSaving(false);
    }
  }

  function openReview(item) {
    setReviewing(item);
    setFeedback(item.supervisor_feedback || "");
    setError("");
    setNotice("");
  }

  async function submitReview(status) {
    if (!reviewing?.submission_id || reviewSaving) return;

    if (status === "Revision Required" && !feedback.trim()) {
      setError("Please provide feedback when requesting revisions.");
      return;
    }

    setReviewSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "review",
          submission_id: Number(reviewing.submission_id),
          status,
          supervisor_feedback: feedback.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Could not save the review.")
        );
      }

      setReviewing(null);
      setFeedback("");
      setNotice(result.message || "Submission review saved.");

      await loadData();
    } catch (err) {
      setError(err.message || "Could not save the review.");
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <div className="sm-page">
      <header className="sm-header">
        <Link to="/supervisor/dashboard" className="sm-brand">
          <span className="sm-brand-mark">A</span>
          <span>
            AcaTrace
            <small>SUPERVISOR WORKSPACE</small>
          </span>
        </Link>

        <div className="sm-header-right">
          <span className="sm-header-label">Research Management</span>
          <Link className="sm-back-link" to="/supervisor/dashboard">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="sm-main">
        <section className="sm-hero">
          <div className="sm-hero-content">
            <span className="sm-eyebrow">
              SUPERVISION · MILESTONE TRACKING
            </span>

            <h1>Research Milestones</h1>

            <p>
              Set clear research targets, monitor deadlines, and guide
              students through each stage of their academic journey.
            </p>

            <button
              type="button"
              className="sm-primary-btn"
              onClick={openCreate}
              disabled={loading || projects.length === 0}
            >
              <span>＋</span> Create milestone
            </button>
          </div>

          <div className="sm-hero-art" aria-hidden="true">
            <div className="sm-art-ring sm-ring-one" />
            <div className="sm-art-ring sm-ring-two" />
            <div className="sm-art-center">✓</div>
            <span className="sm-art-dot dot-one">◆</span>
            <span className="sm-art-dot dot-two">✦</span>
          </div>
        </section>

        {notice && (
          <div className="sm-alert sm-alert-success" role="status">
            <span>✓</span> {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="sm-alert sm-alert-error" role="alert">
            <span>!</span> {error}
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <section className="sm-stats">
          <Stat
            label="Total milestones"
            value={stats.total}
            icon="◈"
            tone="indigo"
          />
          <Stat
            label="Completed"
            value={stats.completed}
            icon="✓"
            tone="green"
          />
          <Stat
            label="In progress"
            value={stats.in_progress}
            icon="◷"
            tone="blue"
          />
          <Stat
            label="Overdue"
            value={stats.overdue}
            icon="!"
            tone="orange"
          />
          <Stat
            label="Awaiting review"
            value={stats.pending_reviews}
            icon="▤"
            tone="purple"
          />
        </section>

        <section className="sm-workspace">
          <div className="sm-section-heading">
            <div>
              <span className="sm-section-kicker">
                YOUR RESEARCH PROJECTS
              </span>
              <h2>Milestone overview</h2>
              <p>Track deadlines and review student submissions.</p>
            </div>

            <span className="sm-result-count">
              {filteredMilestones.length}{" "}
              {filteredMilestones.length === 1
                ? "milestone"
                : "milestones"}
            </span>
          </div>

          <div className="sm-toolbar">
            <label className="sm-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search milestone, student or project..."
                aria-label="Search milestones"
              />
            </label>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter milestones"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Needs Review">Needs Review</option>
            </select>
          </div>

          {loading ? (
            <div className="sm-state">
              <div className="sm-spinner" />
              <h3>Loading milestones</h3>
              <p>Fetching your supervised research milestones...</p>
            </div>
          ) : filteredMilestones.length === 0 ? (
            <div className="sm-state">
              <div className="sm-empty-icon">◇</div>

              <h3>
                {milestones.length
                  ? "No matching milestones"
                  : "Your milestone workspace is ready"}
              </h3>

              <p>
                {milestones.length
                  ? "Try changing your search or status filter."
                  : "Create your first milestone to establish a clear target for a supervised research project."}
              </p>

              {!milestones.length && projects.length > 0 && (
                <button
                  type="button"
                  className="sm-primary-btn"
                  onClick={openCreate}
                >
                  ＋ Create your first milestone
                </button>
              )}

              {!milestones.length && projects.length === 0 && (
                <p>
                  Assign a research project before creating a milestone.
                </p>
              )}
            </div>
          ) : (
            <div className="sm-card-grid">
              {filteredMilestones.map((item) => (
                <article className="sm-milestone-card" key={item.id}>
                  <div className="sm-card-top">
                    <span
                      className={`sm-status ${statusClass(
                        item.status,
                        item.is_overdue
                      )}`}
                    >
                      {item.is_overdue
                        ? "Overdue"
                        : item.status || "Pending"}
                    </span>

                    <button
                      type="button"
                      className="sm-edit-btn"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
                  </div>

                  <div className="sm-card-number">
                    MILESTONE {String(item.id).padStart(2, "0")}
                  </div>

                  <h3>{item.title}</h3>

                  <p className="sm-card-description">
                    {item.description ||
                      "No description has been added."}
                  </p>

                  <div className="sm-project-info">
                    <span className="sm-info-icon">▦</span>
                    <div>
                      <small>Research project</small>
                      <strong>
                        {item.project_title || "Research project"}
                      </strong>
                    </div>
                  </div>

                  <div className="sm-project-info">
                    <span className="sm-info-icon">♙</span>
                    <div>
                      <small>Student</small>
                      <strong>
                        {item.student_name || "Student"}
                      </strong>
                    </div>
                  </div>

                  <div className="sm-project-info">
                    <span className="sm-info-icon">◆</span>
                    <div>
                      <small>Priority</small>
                      <strong>{item.priority || "Medium"}</strong>
                    </div>
                  </div>

                  <div
                    className={`sm-deadline ${
                      item.is_overdue ? "is-overdue" : ""
                    }`}
                  >
                    <span>◷</span>
                    <div>
                      <small>Deadline</small>
                      <strong>{formatDate(item.due_date)}</strong>
                    </div>
                  </div>

                  {item.submission_id ? (
                    <div className="sm-submission">
                      <div className="sm-submission-heading">
                        <span>Student submission</span>

                        <span
                          className={`sm-submission-status ${
                            item.submission_status === "Approved"
                              ? "approved"
                              : item.submission_status ===
                                  "Revision Required"
                                ? "revision"
                                : "awaiting"
                          }`}
                        >
                          {item.submission_status || "Submitted"}
                        </span>
                      </div>

                      {item.submission_text && (
                        <p>{item.submission_text}</p>
                      )}

                      {item.file_path && (
                        <a
                          href={`http://localhost/acatrace/${String(
                            item.file_path
                          ).replace(/^\/+/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="sm-file-link"
                        >
                          ↗ View submitted file
                        </a>
                      )}

                      {item.submission_status === "Pending Review" && (
                        <button
                          type="button"
                          className="sm-review-btn"
                          onClick={() => openReview(item)}
                        >
                          Review submission →
                        </button>
                      )}

                      {item.submission_status !== "Pending Review" &&
                        item.supervisor_feedback && (
                          <p className="sm-feedback-preview">
                            <strong>Your feedback:</strong>{" "}
                            {item.supervisor_feedback}
                          </p>
                        )}
                    </div>
                  ) : (
                    <div className="sm-no-submission">
                      <span>◌</span> Awaiting student submission
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="sm-footer">
          <span>© {new Date().getFullYear()} AcaTrace</span>
          <span>
            Supporting research excellence, one milestone at a time.
          </span>
        </footer>
      </main>

      {showForm && (
        <div
          className="sm-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-form-title"
          >
            <div className="sm-modal-heading">
              <div>
                <span className="sm-section-kicker">
                  RESEARCH PLANNING
                </span>

                <h2 id="sm-form-title">
                  {editing ? "Edit milestone" : "Create a milestone"}
                </h2>

                <p>
                  Define a clear goal, priority, status and deadline.
                </p>
              </div>

              <button
                type="button"
                className="sm-modal-close"
                onClick={closeForm}
                aria-label="Close form"
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveMilestone} className="sm-form">
              <label>
                Research project <span>*</span>
                <select
                  required
                  value={form.research_project_id}
                  onChange={(event) =>
                    updateFormField(
                      "research_project_id",
                      event.target.value
                    )
                  }
                >
                  <option value="">Select a supervised project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_title} — {project.student_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Milestone title <span>*</span>
                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) =>
                    updateFormField("title", event.target.value)
                  }
                  placeholder="e.g. Literature review submission"
                />
              </label>

              <label>
                Description
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    updateFormField("description", event.target.value)
                  }
                  placeholder="Describe the expected outcome and requirements..."
                />
              </label>

              <label>
                Deadline <span>*</span>
                <input
                  required
                  type="date"
                  value={form.due_date}
                  onChange={(event) =>
                    updateFormField("due_date", event.target.value)
                  }
                />
              </label>

              <label>
                Priority <span>*</span>
                <select
                  required
                  value={form.priority}
                  onChange={(event) =>
                    updateFormField("priority", event.target.value)
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Status <span>*</span>
                <select
                  required
                  value={form.status}
                  onChange={(event) =>
                    updateFormField("status", event.target.value)
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm-modal-actions">
                <button
                  type="button"
                  className="sm-secondary-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sm-primary-btn"
                  disabled={saving || !projects.length}
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Create milestone"}
                </button>
              </div>

              {!projects.length && (
                <p className="sm-form-note">
                  You need an assigned research project before creating
                  a milestone.
                </p>
              )}
            </form>
          </section>
        </div>
      )}

      {reviewing && (
        <div
          className="sm-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !reviewSaving
            ) {
              setReviewing(null);
            }
          }}
        >
          <section
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-review-title"
          >
            <div className="sm-modal-heading">
              <div>
                <span className="sm-section-kicker">
                  SUBMISSION REVIEW
                </span>

                <h2 id="sm-review-title">Review milestone</h2>

                <p>
                  {reviewing.title} · {reviewing.student_name}
                </p>
              </div>

              <button
                type="button"
                className="sm-modal-close"
                onClick={() => {
                  if (!reviewSaving) setReviewing(null);
                }}
                aria-label="Close review"
                disabled={reviewSaving}
              >
                ×
              </button>
            </div>

            <div className="sm-review-content">
              <div className="sm-review-project">
                <small>Research project</small>
                <strong>{reviewing.project_title}</strong>
              </div>

              <div className="sm-review-submission">
                <small>Student's submission notes</small>

                <p>
                  {reviewing.submission_text ||
                    "No written submission notes provided."}
                </p>

                {reviewing.file_path && (
                  <a
                    href={`http://localhost/acatrace/${String(
                      reviewing.file_path
                    ).replace(/^\/+/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="sm-file-link"
                  >
                    ↗ Open submitted file
                  </a>
                )}
              </div>

              <label className="sm-feedback-label">
                Supervisor feedback
                <textarea
                  rows={5}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Give constructive feedback or explain required revisions..."
                />
              </label>

              <p className="sm-form-note">
                Approving marks the milestone as completed. Requesting
                revisions returns it to in-progress.
              </p>

              <div className="sm-modal-actions sm-review-actions">
                <button
                  type="button"
                  className="sm-secondary-btn"
                  disabled={reviewSaving}
                  onClick={() => submitReview("Revision Required")}
                >
                  Request revisions
                </button>

                <button
                  type="button"
                  className="sm-primary-btn"
                  disabled={reviewSaving}
                  onClick={() => submitReview("Approved")}
                >
                  {reviewSaving
                    ? "Saving..."
                    : "✓ Approve completion"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone }) {
  return (
    <article className="sm-stat-card">
      <div className={`sm-stat-icon ${tone}`}>{icon}</div>

      <div className="sm-stat-copy">
        <span>{label}</span>
        <strong>{value ?? 0}</strong>
      </div>
    </article>
  );
}
