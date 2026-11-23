import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/supervisor/supervisor-meetings.css";

const API = "http://localhost/acatrace/api/supervisor/meetings.php";

const emptyForm = {
  research_project_id: "",
  title: "",
  agenda: "",
  meeting_date: "",
  start_time: "10:00",
  end_time: "11:00",
  meeting_mode: "Online",
  meeting_location: "",
  meeting_link: "",
};

function displayDate(value) {
  if (!value) return "Not specified";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function displayTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getError(error) {
  return error?.message || "Something went wrong. Please try again.";
}

export default function SupervisorMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [notes, setNotes] = useState("");
  const [responseNote, setResponseNote] = useState("");

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
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request();
      setMeetings(result.data.meetings || []);
      setProjects(result.data.projects || []);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => ({
    total: meetings.length,
    upcoming: meetings.filter(
      (m) => m.status === "Scheduled" && m.meeting_date >= today
    ).length,
    pending: meetings.filter(
      (m) => m.requested_by === "student" &&
        m.response_status === "Pending"
    ).length,
    completed: meetings.filter((m) => m.status === "Completed").length,
  }), [meetings, today]);

  const visibleMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return meetings.filter((m) => {
      const student = `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase();
      const text = [
        m.title, m.project_title, student, m.student_number,
        m.meeting_mode, m.status, m.response_status,
      ].join(" ").toLowerCase();

      const matchesSearch = !query || text.includes(query);
      const matchesFilter =
        filter === "All" ||
        (filter === "Pending Requests" &&
          m.requested_by === "student" && m.response_status === "Pending") ||
        (filter === "Upcoming" &&
          m.status === "Scheduled" && m.meeting_date >= today) ||
        (filter === "Completed" && m.status === "Completed") ||
        (filter === "Cancelled" && m.status === "Cancelled");

      return matchesSearch && matchesFilter;
    });
  }, [meetings, search, filter, today]);

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({ action: "create", ...form }),
      });
      setNotice("Your meeting has been scheduled successfully.");
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function respondToRequest(meeting, response) {
    const message = response === "Declined"
      ? "Decline this student's meeting request?"
      : "Accept this student's meeting request?";

    if (!window.confirm(message)) return;

    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "respond",
          meeting_id: meeting.id,
          response,
          response_note: responseNote,
        }),
      });
      setActiveMeeting(null);
      setResponseNote("");
      setNotice(`Meeting request ${response.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(getError(err));
    }
  }

  async function updateStatus(meeting, status) {
    if (status === "Cancelled" &&
        !window.confirm("Cancel this meeting?")) return;

    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "update_status",
          meeting_id: meeting.id,
          status,
        }),
      });
      setNotice(`Meeting marked as ${status.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(getError(err));
    }
  }

  async function saveNotes() {
    if (!activeMeeting) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request({
        method: "POST",
        body: JSON.stringify({
          action: "update_notes",
          meeting_id: activeMeeting.id,
          notes,
        }),
      });
      setNotice("Meeting outcome saved.");
      setActiveMeeting(null);
      await loadData();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  function openNotes(meeting) {
    setActiveMeeting(meeting);
    setNotes(meeting.notes || "");
    setResponseNote("");
  }

  return (
    <main className="sm-page">
      <header className="sm-topbar">
        <a className="sm-brand" href="/supervisor/dashboard">
          <span className="sm-brand-mark">A</span>
          <span>AcaTrace<small>Supervisor Workspace</small></span>
        </a>
        <a className="sm-back" href="/supervisor/dashboard">
          ← Back to Dashboard
        </a>
      </header>

      <section className="sm-hero">
        <div>
          <span className="sm-eyebrow">SUPERVISOR WORKSPACE</span>
          <h1>Research Meetings</h1>
          <p>
            Plan productive conversations, respond to meeting requests,
            and keep a record of research discussions.
          </p>
        </div>
        <button className="sm-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Close Form" : "+ Schedule Meeting"}
        </button>
      </section>

      {error && <div className="sm-alert sm-alert-error">{error}</div>}
      {notice && <div className="sm-alert sm-alert-success">{notice}</div>}

      <section className="sm-stats">
        <article className="sm-stat">
          <span className="sm-stat-icon">▦</span>
          <div><span>Total meetings</span><strong>{stats.total}</strong></div>
        </article>
        <article className="sm-stat">
          <span className="sm-stat-icon purple">◷</span>
          <div><span>Upcoming</span><strong>{stats.upcoming}</strong></div>
        </article>
        <article className="sm-stat">
          <span className="sm-stat-icon amber">✉</span>
          <div><span>Pending requests</span><strong>{stats.pending}</strong></div>
        </article>
        <article className="sm-stat">
          <span className="sm-stat-icon green">✓</span>
          <div><span>Completed</span><strong>{stats.completed}</strong></div>
        </article>
      </section>

      {showForm && (
        <section className="sm-panel sm-form-panel">
          <div className="sm-section-heading">
            <div>
              <span className="sm-eyebrow">NEW APPOINTMENT</span>
              <h2>Schedule a research meeting</h2>
            </div>
          </div>

          {projects.length === 0 ? (
            <p className="sm-empty">
              No assigned research projects were found. Assign a student
              to a research project before scheduling a meeting.
            </p>
          ) : (
            <form className="sm-form" onSubmit={submitForm}>
              <label className="sm-field sm-field-full">
                Research project and student *
                <select
                  required
                  value={form.research_project_id}
                  onChange={(e) => setForm({
                    ...form,
                    research_project_id: e.target.value,
                  })}
                >
                  <option value="">Choose an assigned project</option>
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.first_name} {p.last_name} — {p.project_title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm-field sm-field-full">
                Meeting title *
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 2 progress review"
                />
              </label>

              <label className="sm-field sm-field-full">
                Agenda
                <textarea
                  rows="3"
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  placeholder="Topics to discuss, questions, and preparation..."
                />
              </label>

              <label className="sm-field">
                Date *
                <input
                  type="date"
                  required
                  min={today}
                  value={form.meeting_date}
                  onChange={(e) => setForm({
                    ...form, meeting_date: e.target.value,
                  })}
                />
              </label>

              <label className="sm-field">
                Meeting mode *
                <select
                  value={form.meeting_mode}
                  onChange={(e) => setForm({
                    ...form, meeting_mode: e.target.value,
                  })}
                >
                  <option value="Online">Online</option>
                  <option value="In-person">In-person</option>
                </select>
              </label>

              <label className="sm-field">
                Start time *
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({
                    ...form, start_time: e.target.value,
                  })}
                />
              </label>

              <label className="sm-field">
                End time *
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm({
                    ...form, end_time: e.target.value,
                  })}
                />
              </label>

              {form.meeting_mode === "In-person" ? (
                <label className="sm-field sm-field-full">
                  Meeting location
                  <input
                    value={form.meeting_location}
                    onChange={(e) => setForm({
                      ...form, meeting_location: e.target.value,
                    })}
                    placeholder="Building, room, or campus"
                  />
                </label>
              ) : (
                <label className="sm-field sm-field-full">
                  Online meeting link
                  <input
                    type="url"
                    value={form.meeting_link}
                    onChange={(e) => setForm({
                      ...form, meeting_link: e.target.value,
                    })}
                    placeholder="https://..."
                  />
                </label>
              )}

              <div className="sm-form-actions sm-field-full">
                <button
                  type="button"
                  className="sm-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="sm-primary" disabled={saving}>
                  {saving ? "Scheduling..." : "Schedule Meeting"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="sm-panel">
        <div className="sm-section-heading">
          <div>
            <span className="sm-eyebrow">YOUR CALENDAR</span>
            <h2>All Meetings</h2>
            <p>Review appointments and manage student requests.</p>
          </div>
          <span className="sm-count">{visibleMeetings.length} meetings</span>
        </div>

        <div className="sm-toolbar">
          <div className="sm-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, student, or project..."
              aria-label="Search meetings"
            />
          </div>
          <select
            className="sm-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter meetings"
          >
            <option>All</option>
            <option>Pending Requests</option>
            <option>Upcoming</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="sm-empty">Loading meetings...</div>
        ) : visibleMeetings.length === 0 ? (
          <div className="sm-empty">
            <span className="sm-empty-icon">◷</span>
            <h3>No meetings found</h3>
            <p>Schedule a meeting or change your search filters.</p>
          </div>
        ) : (
          <div className="sm-meeting-list">
            {visibleMeetings.map((m) => {
              const student = `${m.first_name || ""} ${m.last_name || ""}`.trim();
              const pending = m.requested_by === "student" &&
                m.response_status === "Pending";

              return (
                <article className="sm-meeting-card" key={m.id}>
                  <div className="sm-date-tile">
                    <span>{m.meeting_date
                      ? new Date(`${m.meeting_date}T00:00:00`)
                          .toLocaleDateString(undefined, { month: "short" })
                          .toUpperCase()
                      : "---"}</span>
                    <strong>{m.meeting_date
                      ? new Date(`${m.meeting_date}T00:00:00`)
                          .getDate()
                      : "—"}</strong>
                    <small>{m.meeting_date
                      ? new Date(`${m.meeting_date}T00:00:00`)
                          .getFullYear()
                      : ""}</small>
                  </div>

                  <div className="sm-meeting-main">
                    <div className="sm-meeting-title-row">
                      <h3>{m.title}</h3>
                      <span className={`sm-status ${String(m.status).toLowerCase()}`}>
                        {m.status}
                      </span>
                    </div>
                    <p className="sm-project">{m.project_title}</p>
                    <div className="sm-meta">
                      <span>♙ {student || "Student"}</span>
                      <span>◷ {displayTime(m.start_time)} – {displayTime(m.end_time)}</span>
                      <span>⌖ {m.meeting_mode}</span>
                    </div>

                    {m.agenda && <p className="sm-agenda">{m.agenda}</p>}

                    {m.meeting_mode === "Online" && m.meeting_link && (
                      <a
                        className="sm-meeting-link"
                        href={m.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open meeting link ↗
                      </a>
                    )}

                    {m.meeting_mode === "In-person" && m.meeting_location && (
                      <p className="sm-location">Location: {m.meeting_location}</p>
                    )}

                    <div className="sm-badges">
                      <span className={`sm-response ${String(m.response_status || "").toLowerCase()}`}>
                        {m.response_status || "Accepted"}
                      </span>
                      {m.requested_by === "student" && (
                        <span className="sm-request-label">Student request</span>
                      )}
                    </div>

                    {m.response_note && (
                      <p className="sm-outcome-preview">
                        Response: {m.response_note}
                      </p>
                    )}
                    {m.notes && (
                      <p className="sm-outcome-preview">
                        <strong>Outcome:</strong> {m.notes}
                      </p>
                    )}

                    <div className="sm-card-actions">
                      {pending && (
                        <button
                          className="sm-primary sm-small"
                          onClick={() => openNotes(m)}
                        >
                          Review Request
                        </button>
                      )}

                      {m.status === "Scheduled" && !pending && (
                        <>
                          <button
                            className="sm-secondary sm-small"
                            onClick={() => updateStatus(m, "Completed")}
                          >
                            Mark Completed
                          </button>
                          <button
                            className="sm-text-button"
                            onClick={() => updateStatus(m, "Cancelled")}
                          >
                            Cancel meeting
                          </button>
                        </>
                      )}

                      <button
                        className="sm-secondary sm-small"
                        onClick={() => openNotes(m)}
                      >
                        {m.status === "Completed" ? "Edit Outcome" : "Meeting Notes"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeMeeting && (
        <div
          className="sm-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveMeeting(null);
          }}
        >
          <section
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-modal-title"
          >
            <button
              className="sm-modal-close"
              onClick={() => setActiveMeeting(null)}
              aria-label="Close dialog"
            >
              ×
            </button>

            <span className="sm-eyebrow">
              {activeMeeting.requested_by === "student" &&
              activeMeeting.response_status === "Pending"
                ? "MEETING REQUEST"
                : "MEETING RECORD"}
            </span>
            <h2 id="sm-modal-title">{activeMeeting.title}</h2>
            <p className="sm-modal-subtitle">
              {activeMeeting.first_name} {activeMeeting.last_name}
              {" · "}{displayDate(activeMeeting.meeting_date)}
            </p>

            {activeMeeting.requested_by === "student" &&
              activeMeeting.response_status === "Pending" && (
                <>
                  <label className="sm-field">
                    Response note (optional)
                    <textarea
                      rows="3"
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      placeholder="Explain your response or suggest an alternative..."
                    />
                  </label>
                  <div className="sm-modal-actions">
                    <button
                      className="sm-secondary"
                      onClick={() => respondToRequest(activeMeeting, "Declined")}
                    >
                      Decline Request
                    </button>
                    <button
                      className="sm-primary"
                      onClick={() => respondToRequest(activeMeeting, "Accepted")}
                    >
                      Accept Request
                    </button>
                  </div>
                  <div className="sm-modal-divider" />
                </>
              )}

            <label className="sm-field">
              Meeting notes and outcome
              <textarea
                rows="6"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record discussion points, decisions, student progress, and agreed next steps..."
              />
            </label>

            <div className="sm-modal-actions">
              <button
                className="sm-secondary"
                onClick={() => setActiveMeeting(null)}
              >
                Close
              </button>
              <button
                className="sm-primary"
                disabled={saving}
                onClick={saveNotes}
              >
                {saving ? "Saving..." : "Save Meeting Notes"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
