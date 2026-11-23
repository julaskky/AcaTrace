
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/student/tasks.css";

const API = "http://localhost/acatrace/api/student";

const STATUSES = [
  "Pending",
  "In Progress",
  "Submitted",
  "Completed",
  "Revision Required",
];

const STUDENT_STATUSES = ["Pending", "In Progress", "Submitted"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const EMPTY_FORM = {
  research_project_id: "",
  assigned_to: "",
  title: "",
  description: "",
  priority: "Medium",
  due_date: "",
  status: "Pending",
  submission_notes: "",
};

async function apiRequest(method = "GET", payload) {
  const options = {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
  };

  if (payload !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  let response;

  try {
    response = await fetch(`${API}/tasks.php`, options);
  } catch {
    throw new Error(
      "Unable to connect to the server. Check that Apache and MySQL are running."
    );
  }

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "The server returned an invalid response. Check the PHP error log."
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function isOverdue(task) {
  if (!task.due_date) return false;

  if (["Completed", "Submitted"].includes(task.status)) {
    return false;
  }

  const dueDate = new Date(
    `${String(task.due_date).slice(0, 10)}T23:59:59`
  );

  return dueDate < new Date();
}

function formatDate(value) {
  if (!value) return "No deadline";

  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status) {
  return String(status || "Pending")
    .toLowerCase()
    .replaceAll(" ", "-");
}

function studentLabel(student) {
  return (
    student.full_name ||
    student.name ||
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    student.email ||
    `Student ${student.user_id || student.id}`
  );
}

function TaskEditor({
  task,
  projects,
  students,
  canManage,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(task || {}),
    research_project_id: task?.research_project_id
      ? String(task.research_project_id)
      : "",
    assigned_to: task?.assigned_to ? String(task.assigned_to) : "",
    due_date: task?.due_date
      ? String(task.due_date).slice(0, 10)
      : "",
    submission_notes: task?.submission_notes || "",
  }));

  const [formError, setFormError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.title.trim()) {
      setFormError("Please enter a task title.");
      return;
    }

    if (canManage && !form.research_project_id) {
      setFormError("Please select a research project.");
      return;
    }

    if (canManage && !form.assigned_to) {
      setFormError("Please select a student.");
      return;
    }

    const payload = canManage
      ? {
          ...form,
          id: task?.id,
          research_project_id: Number(form.research_project_id),
          assigned_to: Number(form.assigned_to),
        }
      : {
          id: task.id,
          status: form.status,
          submission_notes: form.submission_notes,
        };

    try {
      await onSave(payload);
    } catch (error) {
      setFormError(error.message || "Unable to save the task.");
    }
  }

  return (
    <div
      className="tasks-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="tasks-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
      >
        <div className="tasks-modal-heading">
          <div>
            <span className="tasks-eyebrow">
              {canManage ? "TASK MANAGEMENT" : "YOUR PROGRESS"}
            </span>

            <h2 id="task-editor-title">
              {canManage
                ? task
                  ? "Edit task"
                  : "Assign a task"
                : "Update task"}
            </h2>

            <p>
              {canManage
                ? "Set the task details, deadline, and student assignment."
                : "Update your progress or submit your work for review."}
            </p>
          </div>

          <button
            type="button"
            className="tasks-icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>

        <form className="tasks-form" onSubmit={handleSubmit}>
          {canManage ? (
            <>
              <label>
                Research project
                <select
                  name="research_project_id"
                  value={form.research_project_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Assign to student
                <select
                  name="assigned_to"
                  value={form.assigned_to}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a student</option>

                  {students.map((student) => (
                    <option
                      key={student.user_id || student.id}
                      value={student.user_id || student.id}
                    >
                      {studentLabel(student)}
                    </option>
                  ))}
                </select>

                {students.length === 0 && (
                  <small>
                    No student records were returned. Check your student
                    records and API response.
                  </small>
                )}
              </label>

              <label>
                Task title
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  maxLength={180}
                  required
                  placeholder="e.g. Submit literature review"
                />
              </label>

              <label>
                Description and expected deliverables
                <textarea
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the task and expected output."
                />
              </label>

              <div className="tasks-form-grid">
                <label>
                  Priority
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    name="due_date"
                    value={form.due_date}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label>
                Status
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="tasks-readonly-summary">
                <strong>{task.title}</strong>
                <span>{task.project_title || "Research project"}</span>
              </div>

              <label>
                Progress status
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={["Submitted", "Completed"].includes(task.status)}
                >
                  {STUDENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Progress or submission notes
                <textarea
                  name="submission_notes"
                  value={form.submission_notes}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Describe your progress or submission."
                  disabled={["Submitted", "Completed"].includes(task.status)}
                />
              </label>

              {task.status === "Submitted" && (
                <p className="tasks-inline-note">
                  Your submission is awaiting supervisor review.
                </p>
              )}

              {task.status === "Completed" && (
                <p className="tasks-inline-note">
                  Your supervisor has marked this task as completed.
                </p>
              )}
            </>
          )}

          {formError && (
            <div className="tasks-alert tasks-alert-error" role="alert">
              {formError}
            </div>
          )}

          <div className="tasks-form-actions">
            <button
              type="button"
              className="tasks-button tasks-button-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="tasks-button tasks-button-primary"
              disabled={
                saving ||
                (!canManage &&
                  ["Submitted", "Completed"].includes(task.status))
              }
            >
              {saving
                ? "Saving..."
                : canManage
                  ? "Save task"
                  : "Save progress"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [role, setRole] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorTask, setEditorTask] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const canManage = ["supervisor", "admin"].includes(role);
  const isStudent = role === "student";

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    setError("");

    try {
      const [taskData, projectData] = await Promise.all([
        apiRequest("GET"),
        fetch(`${API}/research_projects.php`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }).then(async (response) => {
          const body = await response.json();

          if (!response.ok || body.success === false) {
            throw new Error(body.message || "Unable to load research projects.");
          }

          return body;
        }),
      ]);

      setTasks(Array.isArray(taskData.tasks) ? taskData.tasks : []);
      setProjects(
        Array.isArray(projectData.projects) ? projectData.projects : []
      );
      setStudents(Array.isArray(taskData.students) ? taskData.students : []);
      setRole(
        String(taskData.role || projectData.role || "").toLowerCase()
      );
    } catch (err) {
      setError(err.message || "Unable to load tasks.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesStatus = filter === "All" || task.status === filter;

      const matchesSearch =
        !term ||
        [
          task.title,
          task.description,
          task.project_title,
          task.student_name,
          task.assigned_by_name,
        ].some((value) => String(value || "").toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [tasks, filter, search]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      progress: tasks.filter((task) => task.status === "In Progress").length,
      submitted: tasks.filter((task) => task.status === "Submitted").length,
      overdue: tasks.filter(isOverdue).length,
      completed: tasks.filter((task) => task.status === "Completed").length,
    }),
    [tasks]
  );

  function openCreate() {
    setEditorTask(null);
    setMessage("");
    setError("");
    setShowEditor(true);
  }

  function openEdit(task) {
    setEditorTask(task);
    setMessage("");
    setError("");
    setShowEditor(true);
  }

  async function saveTask(payload) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const method = payload.id ? "PUT" : "POST";
      const result = await apiRequest(method, payload);

      setMessage(result.message || "Task saved successfully.");
      setShowEditor(false);
      setEditorTask(null);

      await loadData(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const result = await apiRequest("DELETE", { id: task.id });

      setMessage(result.message || "Task deleted successfully.");
      await loadData(false);
    } catch (err) {
      setError(err.message || "Unable to delete the task.");
    }
  }

  return (
    <main className="tasks-page">
      <div className="tasks-page-glow tasks-page-glow-one" />
      <div className="tasks-page-glow tasks-page-glow-two" />

      <div className="tasks-container">
        <header className="tasks-header">
          <div className="tasks-heading-copy">
            <Link
              to={isStudent ? "/student/dashboard" : "/dashboard"}
              className="tasks-back-button"
            >
              ← Back to Dashboard
            </Link>

            <span className="tasks-eyebrow">
              ACATRACE · RESEARCH WORKSPACE
            </span>

            <h1>
              {isStudent ? "My Tasks" : "Research Tasks"}
              <span>.</span>
            </h1>

            <p>
              {isStudent
                ? "Stay on top of your research tasks, deadlines, and submissions."
                : "Assign work, monitor progress, and review student submissions."}
            </p>
          </div>

          <div className="tasks-header-actions">
            <button
              type="button"
              className="tasks-button tasks-button-light"
              onClick={() => loadData()}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            {canManage && (
              <button
                type="button"
                className="tasks-button tasks-button-primary"
                onClick={openCreate}
              >
                + Assign task
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="tasks-alert tasks-alert-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="tasks-alert tasks-alert-success" role="status">
            {message}
          </div>
        )}

        <section className="tasks-stats" aria-label="Task summary">
          <article className="tasks-stat-card">
            <span className="tasks-stat-icon">▤</span>
            <span className="tasks-stat-label">Total tasks</span>
            <strong>{stats.total}</strong>
            <small>Assigned work items</small>
          </article>

          <article className="tasks-stat-card">
            <span className="tasks-stat-icon">◷</span>
            <span className="tasks-stat-label">In progress</span>
            <strong>{stats.progress}</strong>
            <small>Currently underway</small>
          </article>

          <article className="tasks-stat-card">
            <span className="tasks-stat-icon">↗</span>
            <span className="tasks-stat-label">Awaiting review</span>
            <strong>{stats.submitted}</strong>
            <small>Submitted for review</small>
          </article>

          <article className="tasks-stat-card tasks-stat-overdue">
            <span className="tasks-stat-icon">!</span>
            <span className="tasks-stat-label">Overdue</span>
            <strong>{stats.overdue}</strong>
            <small>Needs attention</small>
          </article>
        </section>

        <section className="tasks-workspace">
          <div className="tasks-workspace-heading">
            <div>
              <span className="tasks-eyebrow">TASK OVERVIEW</span>
              <h2>{isStudent ? "Your assigned work" : "Assigned work"}</h2>
              <p>Track deadlines and keep task progress up to date.</p>
            </div>

            <div className="tasks-completed-summary">
              <strong>{stats.completed}</strong>
              <span>completed</span>
            </div>
          </div>

          <div className="tasks-toolbar">
            <label className="tasks-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks or projects..."
                aria-label="Search tasks"
              />
            </label>

            <label className="tasks-filter">
              <span>Filter</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter tasks by status"
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="tasks-state">
              <span className="tasks-spinner" />
              <strong>Loading tasks...</strong>
              <p>Getting your latest task information.</p>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="tasks-state tasks-empty">
              <span className="tasks-empty-icon">✓</span>
              <h3>
                {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
              </h3>
              <p>
                {tasks.length === 0
                  ? canManage
                    ? "Assign a task to get your research team moving."
                    : "Tasks assigned to you will appear here."
                  : "Try another search term or status filter."}
              </p>

              {canManage && tasks.length === 0 && (
                <button
                  type="button"
                  className="tasks-button tasks-button-primary"
                  onClick={openCreate}
                >
                  + Assign first task
                </button>
              )}
            </div>
          ) : (
            <div className="tasks-list">
              {visibleTasks.map((task) => (
                <article
                  className={`tasks-card ${
                    isOverdue(task) ? "tasks-card-is-overdue" : ""
                  }`}
                  key={task.id}
                >
                  <div className="tasks-card-main">
                    <div className="tasks-card-title-row">
                      <span
                        className={`tasks-priority tasks-priority-${String(
                          task.priority || "Medium"
                        ).toLowerCase()}`}
                      >
                        {task.priority || "Medium"} priority
                      </span>

                      <span
                        className={`tasks-status tasks-status-${statusClass(
                          task.status
                        )}`}
                      >
                        {task.status || "Pending"}
                      </span>

                      {isOverdue(task) && (
                        <span className="tasks-overdue">Overdue</span>
                      )}
                    </div>

                    <h3>{task.title}</h3>

                    {task.description && (
                      <p className="tasks-description">{task.description}</p>
                    )}

                    <div className="tasks-metadata">
                      <span>
                        <b>Project</b>
                        {task.project_title || "Research project"}
                      </span>

                      {!isStudent && task.student_name && (
                        <span>
                          <b>Assigned to</b>
                          {task.student_name}
                        </span>
                      )}

                      {task.assigned_by_name && (
                        <span>
                          <b>Assigned by</b>
                          {task.assigned_by_name}
                        </span>
                      )}

                      <span>
                        <b>Due date</b>
                        {formatDate(task.due_date)}
                      </span>
                    </div>

                    {task.submission_notes && (
                      <div className="tasks-submission">
                        <strong>Progress / submission notes</strong>
                        <p>{task.submission_notes}</p>

                        {task.submitted_at && (
                          <small>
                            Submitted {formatDate(task.submitted_at)}
                          </small>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="tasks-card-actions">
                    {isStudent &&
                      !["Completed", "Submitted"].includes(task.status) && (
                        <button
                          type="button"
                          className="tasks-button tasks-button-primary"
                          onClick={() => openEdit(task)}
                        >
                          Update progress
                        </button>
                      )}

                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="tasks-button tasks-button-light"
                          onClick={() => openEdit(task)}
                        >
                          Edit / review
                        </button>

                        <button
                          type="button"
                          className="tasks-button tasks-button-danger"
                          onClick={() => deleteTask(task)}
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {isStudent && task.status === "Submitted" && (
                      <span className="tasks-review-note">
                        Awaiting supervisor review
                      </span>
                    )}

                    {isStudent && task.status === "Completed" && (
                      <span className="tasks-review-note tasks-complete-note">
                        Task completed
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="tasks-list-footer">
            Showing <strong>{visibleTasks.length}</strong> of{" "}
            <strong>{tasks.length}</strong> tasks
          </div>
        </section>
      </div>

      {showEditor && (
        <TaskEditor
          task={editorTask}
          projects={projects}
          students={students}
          canManage={canManage}
          saving={saving}
          onClose={() => {
            setShowEditor(false);
            setEditorTask(null);
          }}
          onSave={saveTask}
        />
      )}
    </main>
  );
}
