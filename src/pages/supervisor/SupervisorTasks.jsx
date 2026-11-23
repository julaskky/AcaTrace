import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/supervisor/supervisor-tasks.css";

const API = "http://localhost/acatrace/api/supervisor/tasks.php";

const emptyForm = {
  research_project_id: "",
  title: "",
  description: "",
  priority: "Medium",
  due_date: "",
};

const priorities = ["Low", "Medium", "High", "Urgent"];
const filters = [
  "All",
  "Pending",
  "In Progress",
  "Submitted",
  "Revision Required",
  "Completed",
];

function formatDate(value) {
  if (!value) return "No deadline";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function isOverdue(task) {
  return (
    task.due_date &&
    task.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10) &&
    task.status !== "Completed"
  );
}

function prettyStatus(status) {
  return status || "Pending";
}

export default function SupervisorTasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [decision, setDecision] = useState("Completed");
  const [feedback, setFeedback] = useState("");

  const request = useCallback(async (options = {}) => {
    const response = await fetch(API, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "The request failed.");
    }

    return result;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request();

      setTasks(result.data?.tasks || []);
      setProjects(result.data?.projects || []);
    } catch (err) {
      setError(err.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      active: tasks.filter((task) =>
        ["Pending", "In Progress", "Revision Required"].includes(task.status)
      ).length,
      submitted: tasks.filter((task) => task.status === "Submitted").length,
      completed: tasks.filter((task) => task.status === "Completed").length,
      overdue: tasks.filter(isOverdue).length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const student = `${task.first_name || ""} ${task.last_name || ""}`;

      const content = [
        task.title,
        task.description,
        task.project_title,
        student,
        task.student_number,
        task.priority,
        task.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || content.includes(query);
      const matchesStatus = filter === "All" || task.status === filter;
      const matchesPriority =
        priorityFilter === "All" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, filter, priorityFilter]);

  function openCreateForm() {
    setEditingTaskId(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(task) {
    if (["Submitted", "Completed"].includes(task.status)) {
      setError("Submitted or completed tasks cannot be edited.");
      setNotice("");
      return;
    }

    setEditingTaskId(task.id);

    setForm({
      research_project_id: String(task.research_project_id || ""),
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "Medium",
      due_date: task.due_date
        ? String(task.due_date).slice(0, 10)
        : "",
    });

    setError("");
    setNotice("");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeTaskForm() {
    setShowForm(false);
    setEditingTaskId(null);
    setForm({ ...emptyForm });
  }

  async function saveTask(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    const isEditing = editingTaskId !== null;

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: isEditing ? "edit" : "create",
          ...(isEditing ? { task_id: editingTaskId } : {}),
          ...form,
        }),
      });

      setNotice(
        isEditing
          ? "Task updated successfully. The student notification has been saved."
          : "Task created and assigned successfully."
      );

      closeTaskForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task, status) {
    if (task.status === "Submitted") {
      setError("Review submitted work before changing its status.");
      setNotice("");
      return;
    }

    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "update_status",
          task_id: task.id,
          status,
        }),
      });

      setNotice(`Task marked as ${status.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update task.");
    }
  }

  function openReview(task) {
    setActiveTask(task);
    setDecision("Completed");
    setFeedback(task.supervisor_feedback || "");
    setError("");
    setNotice("");
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!activeTask) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "review",
          task_id: activeTask.id,
          decision,
          supervisor_feedback: feedback,
        }),
      });

      setNotice(
        decision === "Completed"
          ? "Submission approved and task completed."
          : "Revision requested and feedback saved."
      );

      setActiveTask(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to review submission.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="st-page">
      <header className="st-topbar">
        <a className="st-brand" href="/supervisor/dashboard">
          <span className="st-brand-mark">A</span>
          <span>
            AcaTrace
            <small>Supervisor Workspace</small>
          </span>
        </a>

        <a className="st-back" href="/supervisor/dashboard">
          ← Back to Dashboard
        </a>
      </header>

      <section className="st-hero">
        <div>
          <span className="st-eyebrow">RESEARCH MANAGEMENT</span>
          <h1>Supervisor Tasks</h1>
          <p>
            Assign meaningful work, monitor deadlines, review student
            submissions, and keep research moving forward.
          </p>
        </div>

        <button
          type="button"
          className="st-button st-button-light"
          onClick={() => {
            if (showForm) {
              closeTaskForm();
            } else {
              openCreateForm();
            }
          }}
        >
          {showForm ? "Close Form" : "+ Create Task"}
        </button>
      </section>

      {error && <div className="st-alert st-error">{error}</div>}
      {notice && <div className="st-alert st-success">{notice}</div>}

      <section className="st-stats">
        <article className="st-stat">
          <span className="st-stat-icon">▦</span>
          <div>
            <span>Total tasks</span>
            <strong>{stats.total}</strong>
          </div>
        </article>

        <article className="st-stat">
          <span className="st-stat-icon st-purple">◷</span>
          <div>
            <span>In progress / pending</span>
            <strong>{stats.active}</strong>
          </div>
        </article>

        <article className="st-stat">
          <span className="st-stat-icon st-amber">✉</span>
          <div>
            <span>Awaiting review</span>
            <strong>{stats.submitted}</strong>
          </div>
        </article>

        <article className="st-stat">
          <span className="st-stat-icon st-green">✓</span>
          <div>
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </article>
      </section>

      {stats.overdue > 0 && (
        <div className="st-overdue-banner">
          <span>!</span>
          <div>
            <strong>
              {stats.overdue} overdue task{stats.overdue === 1 ? "" : "s"}
            </strong>
            <p>Check deadlines and follow up with the relevant students.</p>
          </div>
        </div>
      )}

      {showForm && (
        <section className="st-panel">
          <div className="st-section-heading">
            <div>
              <span className="st-eyebrow">
                {editingTaskId ? "EDIT ASSIGNMENT" : "NEW ASSIGNMENT"}
              </span>

              <h2>
                {editingTaskId
                  ? "Edit research task"
                  : "Create a research task"}
              </h2>

              <p>
                {editingTaskId
                  ? "Update the task details below. The student will be notified."
                  : "The task will be assigned to the student on the selected project."}
              </p>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="st-empty">
              No assigned projects are available. Assign a student to a
              research project before creating a task.
            </div>
          ) : (
            <form className="st-form" onSubmit={saveTask}>
              <label className="st-field st-full">
                Research project and student *
                <select
                  required
                  value={form.research_project_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      research_project_id: event.target.value,
                    })
                  }
                >
                  <option value="">Select an assigned project</option>
                  {projects.map((project) => (
                    <option
                      key={project.project_id}
                      value={project.project_id}
                    >
                      {project.first_name} {project.last_name} —{" "}
                      {project.project_title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="st-field st-full">
                Task title *
                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="e.g. Submit the revised literature review"
                />
              </label>

              <label className="st-field st-full">
                Instructions and description
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Describe the deliverable, requirements, and expected format..."
                />
              </label>

              <label className="st-field">
                Priority *
                <select
                  required
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value })
                  }
                >
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="st-field">
                Deadline
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(event) =>
                    setForm({ ...form, due_date: event.target.value })
                  }
                />
              </label>

              <div className="st-form-actions st-full">
                <button
                  type="button"
                  className="st-button st-button-outline"
                  onClick={closeTaskForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="st-button st-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingTaskId
                      ? "Save Changes"
                      : "Create and Assign Task"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="st-panel">
        <div className="st-section-heading">
          <div>
            <span className="st-eyebrow">TASK OVERVIEW</span>
            <h2>Assigned Tasks</h2>
            <p>Monitor progress and review submitted work.</p>
          </div>

          <span className="st-count">{visibleTasks.length} tasks</span>
        </div>

        <div className="st-toolbar">
          <div className="st-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, students, projects..."
              aria-label="Search tasks"
            />
          </div>

          <select
            className="st-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter by status"
          >
            {filters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="st-filter"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            aria-label="Filter by priority"
          >
            <option value="All">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="st-empty">Loading tasks...</div>
        ) : visibleTasks.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty-icon">✓</span>
            <h3>No tasks found</h3>
            <p>Create a task or adjust your search and filters.</p>
          </div>
        ) : (
          <div className="st-task-list">
            {visibleTasks.map((task) => (
              <article className="st-task-card" key={task.id}>
                <div className="st-task-accent" />

                <div className="st-task-content">
                  <div className="st-task-title-row">
                    <h3>{task.title}</h3>

                    <span
                      className={`st-status st-status-${String(
                        task.status
                      )
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {prettyStatus(task.status)}
                    </span>
                  </div>

                  <p className="st-project-name">{task.project_title}</p>

                  <div className="st-task-meta">
                    <span>
                      ♙ {task.first_name} {task.last_name}
                    </span>

                    {task.student_number && (
                      <span>ID: {task.student_number}</span>
                    )}

                    <span
                      className={`st-priority st-priority-${String(
                        task.priority
                      ).toLowerCase()}`}
                    >
                      {task.priority} priority
                    </span>

                    <span
                      className={
                        isOverdue(task)
                          ? "st-deadline overdue"
                          : "st-deadline"
                      }
                    >
                      ◷ {isOverdue(task) ? "Overdue · " : ""}
                      {formatDate(task.due_date)}
                    </span>
                  </div>

                  {task.description && (
                    <p className="st-description">{task.description}</p>
                  )}

                  {task.latest_submission_text && (
                    <div className="st-submission">
                      <strong>Student submission</strong>
                      <p>{task.latest_submission_text}</p>

                      {task.latest_submission_at && (
                        <small>
                          Submitted: {formatDate(task.latest_submission_at)}
                        </small>
                      )}
                    </div>
                  )}

                  {task.latest_submission_file && (
                    <p className="st-file-note">
                      Submitted file path: {task.latest_submission_file}
                    </p>
                  )}

                  {task.supervisor_feedback && (
                    <div className="st-feedback">
                      <strong>Supervisor feedback</strong>
                      <p>{task.supervisor_feedback}</p>
                    </div>
                  )}

                  <div className="st-task-actions">
                    {!["Submitted", "Completed"].includes(task.status) && (
                      <button
                        type="button"
                        className="st-button st-button-outline st-small"
                        onClick={() => openEditForm(task)}
                      >
                        Edit Task
                      </button>
                    )}

                    {task.status === "Submitted" ? (
                      <button
                        type="button"
                        className="st-button st-button-primary st-small"
                        onClick={() => openReview(task)}
                      >
                        Review Submission
                      </button>
                    ) : task.status !== "Completed" ? (
                      <>
                        {task.status === "Pending" && (
                          <button
                            type="button"
                            className="st-button st-button-outline st-small"
                            onClick={() => changeStatus(task, "In Progress")}
                          >
                            Start Task
                          </button>
                        )}

                        {task.status === "Revision Required" && (
                          <span className="st-revision-hint">
                            Awaiting revised submission
                          </span>
                        )}

                        {task.status === "In Progress" && (
                          <span className="st-progress-hint">
                            Awaiting student submission
                          </span>
                        )}

                        <button
                          type="button"
                          className="st-button st-button-muted st-small"
                          onClick={() => changeStatus(task, "Pending")}
                          disabled={task.status === "Pending"}
                        >
                          Reset to Pending
                        </button>
                      </>
                    ) : (
                      <span className="st-complete-label">
                        ✓ Task completed
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeTask && (
        <div
          className="st-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveTask(null);
            }
          }}
        >
          <section className="st-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="st-modal-close"
              onClick={() => setActiveTask(null)}
              aria-label="Close review"
            >
              ×
            </button>

            <span className="st-eyebrow">SUBMISSION REVIEW</span>
            <h2>{activeTask.title}</h2>

            <p className="st-modal-subtitle">
              {activeTask.first_name} {activeTask.last_name}
              {" · "}
              {activeTask.project_title}
            </p>

            <div className="st-review-content">
              <strong>Student's submission</strong>
              <p>
                {activeTask.latest_submission_text ||
                  "No submission text was provided."}
              </p>

              {activeTask.latest_submission_file && (
                <p className="st-file-note">
                  File path: {activeTask.latest_submission_file}
                </p>
              )}
            </div>

            <form onSubmit={submitReview}>
              <label className="st-field">
                Review decision
                <select
                  value={decision}
                  onChange={(event) => setDecision(event.target.value)}
                >
                  <option value="Completed">Approve — mark completed</option>
                  <option value="Revision Required">
                    Request revisions
                  </option>
                </select>
              </label>

              <label className="st-field st-review-feedback">
                Feedback{" "}
                {decision === "Revision Required" ? "*" : "(optional)"}
                <textarea
                  rows="5"
                  required={decision === "Revision Required"}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Explain your assessment, corrections, or next steps..."
                />
              </label>

              <div className="st-modal-actions">
                <button
                  type="button"
                  className="st-button st-button-outline"
                  onClick={() => setActiveTask(null)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="st-button st-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Review"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
