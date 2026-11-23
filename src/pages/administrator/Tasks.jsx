
import { useCallback, useEffect, useState } from "react";
import "../styles/tasks.css";
import { Link } from "react-router-dom";



const API = "http://localhost/acatrace/api";

const priorities = ["Low", "Medium", "High", "Urgent"];

const statuses = [
  "Pending",
  "In Progress",
  "Submitted",
  "Completed",
  "Revision Required",
];

async function apiRequest(file, method = "GET", data = null) {
  const response = await fetch(`${API}/${file}.php`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(data !== null ? { body: JSON.stringify(data) } : {}),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "The request failed.");
  }

  return result;
}

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    research_project_id: "",
    title: "",
    description: "",
    priority: "Medium",
    due_date: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [taskData, projectData] = await Promise.all([
        apiRequest("tasks"),
        apiRequest("research_projects"),
      ]);

      setTasks(taskData.tasks || []);
      setProjects(projectData.projects || []);
      setRole(taskData.role || "");
    } catch (err) {
      setError(err.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canManage = role === "supervisor" || role === "admin";
  const isStudent = role === "student";

  const visibleTasks = tasks.filter(
    (task) => filter === "All" || task.status === filter
  );

  const counts = statuses.reduce((result, status) => {
    result[status] = tasks.filter(
      (task) => task.status === status
    ).length;

    return result;
  }, {});

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function createTask(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("tasks", "POST", {
        ...form,
        research_project_id: Number(form.research_project_id),
      });

      setMessage(result.message || "Task assigned successfully.");

      setForm({
        research_project_id: "",
        title: "",
        description: "",
        priority: "Medium",
        due_date: "",
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to assign task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(task, changes) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("tasks", "PUT", {
        id: Number(task.id),
        ...changes,
      });

      setMessage(result.message || "Task updated successfully.");
      setEditing(null);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("tasks", "DELETE", {
        id: Number(task.id),
      });

      setMessage(result.message || "Task deleted successfully.");

      if (editing === task.id) {
        setEditing(null);
      }

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to delete task.");
    } finally {
      setSaving(false);
    }
  }

  function toggleEditor(taskId) {
    setEditing((current) => (current === taskId ? null : taskId));
  }

  return (
    <main className="tasks-page">
      
      <header className="tasks-header">
        <div>
          <p className="tasks-eyebrow">
            ACATRACE · RESEARCH WORKSPACE
          </p>

          <h1>Research Tasks</h1>

          <p className="tasks-subtitle">
            Organise research activities, track deadlines, and review
            submitted work.
          </p>
        </div>
        <Link to="/dashboard" className="tasks-back-button">
  ← Back to Dashboard
</Link>
        <button
          type="button"
          className="tasks-secondary"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div className="tasks-alert tasks-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="tasks-alert tasks-success" role="status">
          {message}
        </div>
      )}

      <section className="tasks-stats">
        <div className="tasks-stat">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </div>

        <div className="tasks-stat">
          <span>Pending</span>
          <strong>{counts.Pending || 0}</strong>
        </div>

        <div className="tasks-stat">
          <span>In progress</span>
          <strong>{counts["In Progress"] || 0}</strong>
        </div>

        <div className="tasks-stat">
          <span>Awaiting review</span>
          <strong>{counts.Submitted || 0}</strong>
        </div>
      </section>

      {canManage && (
        <section className="tasks-panel">
          <h2>Assign a new task</h2>

          <p className="tasks-muted">
            Assign research work to the student responsible for a project.
          </p>

          <form className="tasks-form" onSubmit={createTask}>
            <label>
              Research project *
              <select
                name="research_project_id"
                value={form.research_project_id}
                onChange={updateForm}
                required
              >
                <option value="">Select a project</option>

                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                    {project.student_name
                      ? ` — ${project.student_name}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Task title *
              <input
                name="title"
                value={form.title}
                onChange={updateForm}
                maxLength={255}
                placeholder="e.g. Submit literature review"
                required
              />
            </label>

            <label className="tasks-full">
              Description and instructions
              <textarea
                name="description"
                value={form.description}
                onChange={updateForm}
                rows={3}
                placeholder="Describe the expected work and deliverables..."
              />
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={updateForm}
              >
                {priorities.map((priority) => (
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
                onChange={updateForm}
              />
            </label>

            <div className="tasks-full">
              <button
                type="submit"
                className="tasks-primary"
                disabled={saving || projects.length === 0}
              >
                {saving ? "Assigning..." : "+ Assign task"}
              </button>

              {projects.length === 0 && (
                <p className="tasks-muted">
                  No research projects are available for assignment.
                </p>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="tasks-panel">
        <div className="tasks-list-heading">
          <div>
            <h2>
              {isStudent ? "My assigned tasks" : "Task register"}
            </h2>

            <p className="tasks-muted">
              {isStudent
                ? "Update your progress and submit work for review."
                : "Monitor task progress and review student submissions."}
            </p>
          </div>

          <select
            aria-label="Filter tasks by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="All">All statuses</option>

            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="tasks-empty">Loading tasks...</p>
        ) : visibleTasks.length === 0 ? (
          <div className="tasks-empty">
            <span className="tasks-empty-icon">✓</span>
            <h3>No tasks to display</h3>
            <p>Tasks will appear here when they are assigned.</p>
          </div>
        ) : (
          <div className="tasks-list">
            {visibleTasks.map((task) => (
              <article className="tasks-card" key={task.id}>
                <div className="tasks-card-top">
                  <div>
                    <p className="tasks-project">
                      {task.project_title || "Research project"}
                    </p>

                    <h3>{task.title}</h3>
                  </div>

                  <span
                    className={`tasks-priority priority-${(
                      task.priority || "medium"
                    ).toLowerCase()}`}
                  >
                    {task.priority}
                  </span>
                </div>

                {task.description && (
                  <p className="tasks-description">
                    {task.description}
                  </p>
                )}

                <div className="tasks-meta">
                  {task.student_name && (
                    <span>Student: {task.student_name}</span>
                  )}

                  <span>
                    Due: {task.due_date || "No deadline"}
                  </span>

                  <span>
                    Assigned by: {task.assigned_by_name || "Supervisor"}
                  </span>
                </div>

                <div className="tasks-card-bottom">
                  <span
                    className={`tasks-status status-${(
                      task.status || "pending"
                    )
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {task.status}
                  </span>

                  <div className="tasks-actions">
                    {isStudent && task.status !== "Completed" && (
                      <button
                        type="button"
                        className="tasks-primary tasks-small"
                        onClick={() => toggleEditor(task.id)}
                      >
                        {editing === task.id
                          ? "Close"
                          : "Update / Submit"}
                      </button>
                    )}

                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="tasks-secondary tasks-small"
                          onClick={() => toggleEditor(task.id)}
                        >
                          {editing === task.id ? "Close editor" : "Review / Edit"}
                        </button>

                        <button
                          type="button"
                          className="tasks-danger tasks-small"
                          onClick={() => deleteTask(task)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editing === task.id && (
                  <TaskEditor
                    key={`${task.id}-${task.status}`}
                    task={task}
                    isStudent={isStudent}
                    saving={saving}
                    onSave={(changes) => updateTask(task, changes)}
                    onCancel={() => setEditing(null)}
                  />
                )}

                {task.submission_notes && (
                  <div className="tasks-submission">
                    <strong>Student submission notes</strong>

                    <p>{task.submission_notes}</p>

                    {task.submitted_at && (
                      <small>Submitted: {task.submitted_at}</small>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TaskEditor({ task, isStudent, saving, onSave, onCancel }) {
  const [status, setStatus] = useState(task.status);
  const [notes, setNotes] = useState(task.submission_notes || "");
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date || "");

  function submit(event) {
    event.preventDefault();

    if (isStudent) {
      onSave({
        status,
        submission_notes: notes,
      });
    } else {
      onSave({
        title,
        description,
        priority,
        due_date: dueDate,
        status,
      });
    }
  }

  return (
    <form className="tasks-editor" onSubmit={submit}>
      {isStudent ? (
        <>
          <label>
            Progress
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Submitted">Submitted</option>
            </select>
          </label>

          <label>
            Submission notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Describe your work or submission..."
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Task title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>

          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Deadline
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>

          <label>
            Review status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="tasks-editor-actions">
        <button
          type="submit"
          className="tasks-primary tasks-small"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        <button
          type="button"
          className="tasks-secondary tasks-small"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default Tasks;

