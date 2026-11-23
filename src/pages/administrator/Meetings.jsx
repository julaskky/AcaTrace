
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/administrator/meetings.css";

const API = "http://localhost/acatrace/api";

const EMPTY_FORM = {
  research_project_id: "",
  title: "",
  agenda: "",
  meeting_date: "",
  start_time: "",
  end_time: "",
  meeting_mode: "Online",
  meeting_location: "",
  meeting_link: "",
  status: "Scheduled",
  notes: "",
};

function Meetings() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const role = String(user?.role || "").toLowerCase();
  const canManage = role === "supervisor" || role === "admin";
  const isStudent = role === "student";

  const request = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };

      if (options.body) {
        headers["Content-Type"] = "application/json";
      }

      let response;

      try {
        response = await fetch(url, {
          ...options,
          credentials: "include",
          headers,
        });
      } catch (err) {
        console.error("Meetings API connection error:", err);

        throw new Error(
          "Cannot connect to the server. Check that Apache is running and try again."
        );
      }

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("Invalid API response:", response.status, responseText);

        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}). Check the PHP error log.`
        );
      }

      if (response.status === 401) {
        navigate("/login");
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message || `The request failed (HTTP ${response.status}).`
        );
      }

      return data;
    },
    [navigate]
  );

  const loadMeetingsOnly = useCallback(async () => {
    const data = await request(`${API}/meetings.php`);
    setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
  }, [request]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const dashboard = await request(`${API}/dashboard.php`);

      if (!dashboard.user) {
        throw new Error("Your account details could not be loaded.");
      }

      setUser(dashboard.user);

      const currentRole = String(dashboard.user.role || "").toLowerCase();

      const meetingsData = await request(`${API}/meetings.php`);
      setMeetings(
        Array.isArray(meetingsData.meetings)
          ? meetingsData.meetings
          : []
      );

      if (currentRole === "supervisor" || currentRole === "admin") {
        const projectsData = await request(
          `${API}/research_projects.php`
        );

        setProjects(
          Array.isArray(projectsData.projects)
            ? projectsData.projects
            : []
        );
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error("Unable to load Meetings page:", err);
      setError(err.message || "Unable to load meetings.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const changeField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError("");
    setMessage("");
  };

  const startEdit = (meeting) => {
    setEditingId(meeting.id);

    setForm({
      research_project_id: String(meeting.research_project_id || ""),
      title: meeting.title || "",
      agenda: meeting.agenda || "",
      meeting_date: String(meeting.meeting_date || "").slice(0, 10),
      start_time: String(meeting.start_time || "").slice(0, 5),
      end_time: String(meeting.end_time || "").slice(0, 5),
      meeting_mode: meeting.meeting_mode || "Online",
      meeting_location: meeting.meeting_location || "",
      meeting_link: meeting.meeting_link || "",
      status: meeting.status || "Scheduled",
      notes: meeting.notes || "",
    });

    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canManage) {
      setError("Only supervisors and administrators can schedule meetings.");
      return;
    }

    if (!form.research_project_id) {
      setError("Please select a research project.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }

    if (!form.meeting_date || !form.start_time) {
      setError("Please enter the meeting date and start time.");
      return;
    }

    if (form.end_time && form.end_time <= form.start_time) {
      setError("End time must be later than start time.");
      return;
    }

    if (
      form.meeting_mode === "Online" &&
      form.meeting_link.trim()
    ) {
      try {
        const link = new URL(form.meeting_link.trim());

        if (!["http:", "https:"].includes(link.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        setError(
          "Enter a valid online meeting link beginning with https:// or http://."
        );
        return;
      }
    }

    setSaving(true);

    const payload = {
      research_project_id: Number(form.research_project_id),
      title: form.title.trim(),
      agenda: form.agenda.trim(),
      meeting_date: form.meeting_date,
      start_time: form.start_time,
      end_time: form.end_time || "",
      meeting_mode: form.meeting_mode,
      meeting_location: form.meeting_location.trim(),
      meeting_link: form.meeting_link.trim(),
      status: form.status,
      notes: form.notes.trim(),
    };

    try {
      const result = await request(`${API}/meetings.php`, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload
        ),
      });

      setMessage(
        result.message ||
          (editingId
            ? "Meeting updated successfully."
            : "Meeting scheduled successfully.")
      );

      setForm({ ...EMPTY_FORM });
      setEditingId(null);

      try {
        await loadMeetingsOnly();
      } catch (refreshError) {
        console.error("Meeting saved, but refreshing failed:", refreshError);
        setError(
          "The meeting was saved, but the list could not refresh. Please click Refresh."
        );
      }
    } catch (err) {
      console.error("Meeting submission failed:", err);
      setError(err.message || "Unable to save the meeting.");
    } finally {
      setSaving(false);
    }
  };

  const updateStudentNotes = async (meeting, notes) => {
    setError("");
    setMessage("");

    try {
      const result = await request(`${API}/meetings.php`, {
        method: "PUT",
        body: JSON.stringify({
          id: meeting.id,
          notes,
        }),
      });

      setMessage(result.message || "Meeting notes saved successfully.");
      await loadMeetingsOnly();
    } catch (err) {
      setError(err.message || "Unable to save meeting notes.");
    }
  };

  const updateStatus = async (meeting, status) => {
    setError("");
    setMessage("");

    try {
      const result = await request(`${API}/meetings.php`, {
        method: "PUT",
        body: JSON.stringify({
          id: meeting.id,
          status,
        }),
      });

      setMessage(
        result.message || `Meeting marked ${status.toLowerCase()}.`
      );

      await loadMeetingsOnly();
    } catch (err) {
      setError(err.message || "Unable to update meeting status.");
    }
  };

  const deleteMeeting = async (meeting) => {
    const confirmed = window.confirm(
      `Permanently delete "${meeting.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const result = await request(`${API}/meetings.php`, {
        method: "DELETE",
        body: JSON.stringify({ id: meeting.id }),
      });

      setMessage(result.message || "Meeting deleted successfully.");

      if (String(editingId) === String(meeting.id)) {
        setForm({ ...EMPTY_FORM });
        setEditingId(null);
      }

      await loadMeetingsOnly();
    } catch (err) {
      setError(err.message || "Unable to delete the meeting.");
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not set";

    const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const today = [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    String(new Date().getDate()).padStart(2, "0"),
  ].join("-");

  const upcoming = meetings.filter(
    (meeting) =>
      meeting.status === "Scheduled" &&
      String(meeting.meeting_date || "").slice(0, 10) >= today
  );

  const completed = meetings.filter(
    (meeting) => meeting.status === "Completed"
  );

  if (loading) {
    return (
      <div className="meetings-page">
        <p>Loading meetings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="meetings-page">
        <h2>Unable to load Meetings</h2>
        <p className="meetings-alert error" role="alert">
          {error || "Your account could not be loaded."}
        </p>
        <button type="button" onClick={() => navigate("/login")}>
          Go to login
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={loadPage}
          style={{ marginLeft: 8 }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="meetings-page">
      <header className="meetings-header">
        <div>
          <p className="meetings-eyebrow">ACATRACE WORKSPACE</p>
          <h1>Meetings</h1>
          <p>
            Organise supervision meetings, agendas, and research discussions.
          </p>
        </div>

        <Link className="meetings-back-link" to="/dashboard">
          ← Dashboard
        </Link>
      </header>

      {error && (
        <div className="meetings-alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="meetings-alert success" role="status">
          {message}
        </div>
      )}

      <section className="meetings-summary">
        <div>
          <span>Total meetings</span>
          <strong>{meetings.length}</strong>
        </div>
        <div>
          <span>Upcoming</span>
          <strong>{upcoming.length}</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{completed.length}</strong>
        </div>
      </section>

      {canManage && (
        <section className="meetings-card">
          <h2>{editingId ? "Edit meeting" : "Schedule a meeting"}</h2>

          {projects.length === 0 ? (
            <p>
              No research projects are available. Ensure a research project
              exists and has an assigned supervisor.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="meetings-form">
              <label>
                Research project *
                <select
                  name="research_project_id"
                  value={form.research_project_id}
                  onChange={changeField}
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
                Meeting title *
                <input
                  name="title"
                  value={form.title}
                  onChange={changeField}
                  required
                  maxLength={255}
                  placeholder="e.g. Research progress review"
                />
              </label>

              <label className="full-width">
                Agenda
                <textarea
                  name="agenda"
                  value={form.agenda}
                  onChange={changeField}
                  rows={3}
                  placeholder="Topics to discuss"
                />
              </label>

              <label>
                Date *
                <input
                  type="date"
                  name="meeting_date"
                  value={form.meeting_date}
                  onChange={changeField}
                  required
                />
              </label>

              <label>
                Start time *
                <input
                  type="time"
                  name="start_time"
                  value={form.start_time}
                  onChange={changeField}
                  required
                />
              </label>

              <label>
                End time
                <input
                  type="time"
                  name="end_time"
                  value={form.end_time}
                  onChange={changeField}
                />
              </label>

              <label>
                Meeting format *
                <select
                  name="meeting_mode"
                  value={form.meeting_mode}
                  onChange={changeField}
                  required
                >
                  <option value="Online">Online</option>
                  <option value="In-person">In-person</option>
                </select>
              </label>

              {form.meeting_mode === "In-person" && (
                <label>
                  Location
                  <input
                    name="meeting_location"
                    value={form.meeting_location}
                    onChange={changeField}
                    placeholder="Room, building, or campus"
                  />
                </label>
              )}

              {form.meeting_mode === "Online" && (
                <label>
                  Meeting link
                  <input
                    type="url"
                    name="meeting_link"
                    value={form.meeting_link}
                    onChange={changeField}
                    placeholder="https://..."
                  />
                </label>
              )}

              {editingId && (
                <>
                  <label>
                    Status
                    <select
                      name="status"
                      value={form.status}
                      onChange={changeField}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </label>

                  <label className="full-width">
                    Meeting notes
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={changeField}
                      rows={3}
                    />
                  </label>
                </>
              )}

              <div className="meetings-form-actions full-width">
                <button type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Schedule meeting"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Stop editing
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      <section className="meetings-list-section">
        <div className="meetings-list-heading">
          <div>
            <h2>{isStudent ? "My supervision meetings" : "All meetings"}</h2>
            <p>Meeting schedules, details, and current status.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadPage}
          >
            Refresh
          </button>
        </div>

        {meetings.length === 0 ? (
          <div className="meetings-empty">
            <span>▣</span>
            <h3>No meetings yet</h3>
            <p>
              {isStudent
                ? "Your supervisor's scheduled meetings will appear here."
                : "Schedule a meeting to organise supervision sessions."}
            </p>
          </div>
        ) : (
          <div className="meetings-list">
            {meetings.map((meeting) => (
              <article className="meeting-item" key={meeting.id}>
                <div className="meeting-item-top">
                  <div>
                    <span
                      className={`meeting-status status-${String(
                        meeting.status || "scheduled"
                      ).toLowerCase()}`}
                    >
                      {meeting.status}
                    </span>

                    <h3>{meeting.title}</h3>
                    <p className="meeting-project">
                      {meeting.project_title || "Research project"}
                    </p>
                  </div>

                  {canManage && (
                    <div className="meeting-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startEdit(meeting)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteMeeting(meeting)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="meeting-details">
                  <p>
                    <strong>Date:</strong> {formatDate(meeting.meeting_date)}
                  </p>
                  <p>
                    <strong>Time:</strong>{" "}
                    {String(meeting.start_time || "").slice(0, 5) || "Not set"}
                    {meeting.end_time
                      ? ` – ${String(meeting.end_time).slice(0, 5)}`
                      : ""}
                  </p>
                  <p>
                    <strong>Format:</strong>{" "}
                    {meeting.meeting_mode || "Not specified"}
                  </p>

                  {meeting.meeting_location && (
                    <p>
                      <strong>Location:</strong> {meeting.meeting_location}
                    </p>
                  )}

                  {meeting.meeting_link && (
                    <p>
                      <strong>Online link:</strong>{" "}
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join meeting
                      </a>
                    </p>
                  )}

                  {meeting.agenda && (
                    <p>
                      <strong>Agenda:</strong> {meeting.agenda}
                    </p>
                  )}

                  {meeting.supervisor_name && (
                    <p>
                      <strong>Supervisor:</strong> {meeting.supervisor_name}
                    </p>
                  )}

                  {meeting.student_name && !isStudent && (
                    <p>
                      <strong>Student:</strong> {meeting.student_name}
                    </p>
                  )}
                </div>

                <div className="meeting-notes">
                  <label htmlFor={`notes-${meeting.id}`}>Meeting notes</label>
                  <textarea
                    id={`notes-${meeting.id}`}
                    defaultValue={meeting.notes || ""}
                    rows={3}
                    readOnly={!isStudent}
                  />

                  {isStudent && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={(event) => {
                        const textarea =
                          event.currentTarget.parentElement.querySelector(
                            "textarea"
                          );

                        updateStudentNotes(meeting, textarea?.value || "");
                      }}
                    >
                      Save my notes
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEdit(meeting)}
                    >
                      Edit notes
                    </button>
                  )}
                </div>

                {canManage && meeting.status === "Scheduled" && (
                  <div className="meeting-status-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => updateStatus(meeting, "Completed")}
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => updateStatus(meeting, "Cancelled")}
                    >
                      Cancel meeting
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Meetings;