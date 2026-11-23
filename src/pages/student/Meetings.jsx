
import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/student/meetings.css";

const API = "http://localhost/acatrace/api/student/meetings.php";
const DASHBOARD_API = "http://localhost/acatrace/api/student/dashboard.php";

const initialForm = {
  research_project_id: "",
  title: "",
  request_reason: "",
  meeting_date: "",
  start_time: "",
  end_time: "",
  meeting_mode: "Online",
  meeting_location: "",
  meeting_link: "",
  agenda: "",
};

function formatDate(date) {
  if (!date) return "Date not specified";

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function formatTime(time) {
  if (!time) return "";

  const parts = time.split(":");
  const parsed = new Date();

  parsed.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

  return Number.isNaN(parsed.getTime())
    ? time
    : parsed.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function MeetingCard({
  meeting,
  onRespond,
  onSaveNotes,
  busy,
}) {
  const [responseNote, setResponseNote] = useState("");
  const [notes, setNotes] = useState(meeting.notes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const isStudentRequest = meeting.requested_by === "student";
  const responseStatus = meeting.response_status || "Pending";

  const statusClass = (value) =>
    String(value || "Pending").toLowerCase().replace(/\s+/g, "-");

  const isPast = meeting.meeting_date
    ? meeting.meeting_date < new Date().toISOString().slice(0, 10)
    : false;

  const meetingStatus = meeting.status || "Scheduled";

  return (
    <article className="meeting-item">
      <div className="meeting-item-top">
        <div>
          <span className="meeting-date-label">
            {formatDate(meeting.meeting_date)}
          </span>

          <h3>{meeting.title || "Supervision Meeting"}</h3>

          <p className="meeting-project">
            {meeting.project_title || "Research project"}
          </p>
        </div>

        <div className="meeting-badges">
          <span className={`meeting-status status-${statusClass(meetingStatus)}`}>
            {meetingStatus}
          </span>

          <span
            className={`meeting-status response-${statusClass(responseStatus)}`}
          >
            {responseStatus}
          </span>
        </div>
      </div>

      <div className="meeting-details-grid">
        <div className="meeting-detail">
          <span>Supervisor</span>
          <strong>{meeting.supervisor_name?.trim() || "Assigned supervisor"}</strong>
        </div>

        <div className="meeting-detail">
          <span>Time</span>
          <strong>
            {formatTime(meeting.start_time)}
            {meeting.end_time ? ` – ${formatTime(meeting.end_time)}` : ""}
          </strong>
        </div>

        <div className="meeting-detail">
          <span>Mode</span>
          <strong>{meeting.meeting_mode || "Not specified"}</strong>
        </div>

        <div className="meeting-detail">
          <span>Requested by</span>
          <strong>
            {isStudentRequest ? "You" : "Supervisor"}
          </strong>
        </div>
      </div>

      {meeting.agenda && (
        <div className="meeting-description">
          <h4>Agenda</h4>
          <p>{meeting.agenda}</p>
        </div>
      )}

      {meeting.request_reason && (
        <div className="meeting-description">
          <h4>Meeting request reason</h4>
          <p>{meeting.request_reason}</p>
        </div>
      )}

      {(meeting.meeting_location || meeting.meeting_link) && (
        <div className="meeting-description">
          <h4>Meeting details</h4>

          {meeting.meeting_location && (
            <p>Location: {meeting.meeting_location}</p>
          )}

          {meeting.meeting_link && (
            <p>
              <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join meeting <span aria-hidden="true">↗</span>
              </a>
            </p>
          )}
        </div>
      )}

      {meeting.response_note && (
        <div className="meeting-description">
          <h4>Response note</h4>
          <p>{meeting.response_note}</p>
        </div>
      )}

      {meeting.notes && !showNotes && (
        <div className="meeting-description">
          <h4>Your personal notes</h4>
          <p>{meeting.notes}</p>
        </div>
      )}

      {meeting.requested_by === "supervisor" &&
        responseStatus === "Pending" &&
        meetingStatus !== "Cancelled" && (
          <div className="meeting-response-panel">
            <h4>Respond to this meeting</h4>
            <p>Confirm whether you can attend. If declining, explain why.</p>

            {!showDecline ? (
              <div className="meeting-actions">
                <button
                  type="button"
                  className="meeting-btn meeting-btn-primary"
                  disabled={busy}
                  onClick={() =>
                    onRespond(meeting.id, "Accepted", responseNote)
                  }
                >
                  Accept meeting
                </button>

                <button
                  type="button"
                  className="meeting-btn meeting-btn-outline"
                  disabled={busy}
                  onClick={() => setShowDecline(true)}
                >
                  Decline meeting
                </button>
              </div>
            ) : (
              <div className="meeting-inline-form">
                <label htmlFor={`decline-${meeting.id}`}>
                  Reason for declining
                </label>

                <textarea
                  id={`decline-${meeting.id}`}
                  value={responseNote}
                  onChange={(event) => setResponseNote(event.target.value)}
                  placeholder="Explain why you cannot attend..."
                  rows={3}
                  required
                />

                <div className="meeting-actions">
                  <button
                    type="button"
                    className="meeting-btn meeting-btn-danger"
                    disabled={busy || !responseNote.trim()}
                    onClick={() =>
                      onRespond(meeting.id, "Declined", responseNote)
                    }
                  >
                    Confirm decline
                  </button>

                  <button
                    type="button"
                    className="meeting-btn meeting-btn-light"
                    onClick={() => {
                      setShowDecline(false);
                      setResponseNote("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      <div className="meeting-card-footer">
        <button
          type="button"
          className="meeting-btn meeting-btn-light"
          onClick={() => setShowNotes((current) => !current)}
        >
          {showNotes ? "Hide personal notes" : "Edit personal notes"}
        </button>

        {showNotes && (
          <div className="meeting-inline-form meeting-notes-editor">
            <label htmlFor={`notes-${meeting.id}`}>
              Personal notes
            </label>

            <textarea
              id={`notes-${meeting.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Record your preparation, discussion points or follow-up tasks..."
              rows={4}
            />

            <button
              type="button"
              className="meeting-btn meeting-btn-primary"
              disabled={busy}
              onClick={() => onSaveNotes(meeting.id, notes)}
            >
              Save notes
            </button>
          </div>
        )}

        {isPast && (
          <span className="meeting-history-label">
            Previous meeting
          </span>
        )}
      </div>
    </article>
  );
}

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyMeetingId, setBusyMeetingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("All");
  const [showRequestForm, setShowRequestForm] = useState(false);

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "The request could not be completed.");
    }

    return result;
  }, []);



  
const loadData = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const [meetingResult, projectResult] = await Promise.all([
      request(API),
      request("http://localhost/acatrace/api/research_projects.php"),
    ]);

    setMeetings(
      Array.isArray(meetingResult.data) ? meetingResult.data : []
    );

    const projectData = projectResult.data ?? projectResult;

    const projectList = Array.isArray(projectData)
      ? projectData
      : projectData.projects ||
        projectData.research_projects ||
        [];

    setProjects(projectList);
  } catch (err) {
    setError(
      err.message ||
        "Unable to load meetings and research projects."
    );
  } finally {
    setLoading(false);
  }
}, [request]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);

  const upcomingMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          meeting.meeting_date >= today &&
          meeting.status !== "Cancelled" &&
          meeting.status !== "Completed"
      ),
    [meetings, today]
  );

  const pendingResponses = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          meeting.requested_by === "supervisor" &&
          meeting.response_status === "Pending" &&
          meeting.status !== "Cancelled"
      ),
    [meetings]
  );

  const myRequests = useMemo(
    () => meetings.filter((meeting) => meeting.requested_by === "student"),
    [meetings]
  );

  const previousMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          meeting.status === "Completed" ||
          meeting.status === "Cancelled" ||
          (meeting.meeting_date && meeting.meeting_date < today)
      ),
    [meetings, today]
  );

  const filteredMeetings = useMemo(() => {
    switch (filter) {
      case "Upcoming":
        return upcomingMeetings;
      case "Pending":
        return meetings.filter(
          (meeting) => meeting.response_status === "Pending"
        );
      case "Requested":
        return myRequests;
      case "History":
        return previousMeetings;
      default:
        return meetings;
    }
  }, [
    filter,
    meetings,
    upcomingMeetings,
    myRequests,
    previousMeetings,
  ]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await request(API, {
        method: "POST",
        body: JSON.stringify(form),
      });

      setSuccess(result.message || "Your meeting request has been submitted.");
      setForm(initialForm);
      setShowRequestForm(false);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to submit your meeting request."));
    } finally {
      setSubmitting(false);
    }
  }

  async function respondToMeeting(id, responseStatus, responseNote) {
    setError("");
    setSuccess("");
    setBusyMeetingId(id);

    try {
      const result = await request(API, {
        method: "PUT",
        body: JSON.stringify({
          id,
          action: "respond",
          response_status: responseStatus,
          response_note: responseNote,
        }),
      });

      setSuccess(result.message || "Your response has been saved.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save your response."));
    } finally {
      setBusyMeetingId(null);
    }
  }

  async function saveNotes(id, notes) {
    setError("");
    setSuccess("");
    setBusyMeetingId(id);

    try {
      const result = await request(API, {
        method: "PUT",
        body: JSON.stringify({
          id,
          action: "notes",
          notes,
        }),
      });

      setMeetings((current) =>
        current.map((meeting) =>
          Number(meeting.id) === Number(id)
            ? { ...meeting, notes }
            : meeting
        )
      );

      setSuccess(result.message || "Your notes have been saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save your notes."));
    } finally {
      setBusyMeetingId(null);
    }
  }

  return (
    <main className="meetings-page">
      
      <section className="meetings-hero">
        <div>
          <span className="meetings-eyebrow">STUDENT WORKSPACE</span>
          <h1>Meetings & Supervision</h1>
          <p>
            Coordinate with your supervisor, manage meeting requests,
            and keep track of your research discussions.
          </p>
        </div>

        <button
          type="button"
          className="meeting-btn meeting-btn-hero"
          onClick={() => setShowRequestForm((current) => !current)}
        >
          {showRequestForm ? "Close request form" : "+ Request a meeting"}
        </button>

        <button
        type="button"
        className="meeting-btn meeting-btn-light"
        onClick={() => (window.location.href = "/student/dashboard")}
        style={{ marginBottom: "20px" }}
      >
        ← Back to Dashboard
      </button>

      </section>


      

      {error && (
        <div className="meetings-alert meetings-alert-error" role="alert">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="meetings-alert meetings-alert-success" role="status">
          {success}
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <section className="meetings-summary">
        <div className="meetings-summary-card">
          <span className="summary-icon">◷</span>
          <div>
            <p>Upcoming meetings</p>
            <strong>{upcomingMeetings.length}</strong>
          </div>
        </div>

        <div className="meetings-summary-card">
          <span className="summary-icon">✉</span>
          <div>
            <p>Awaiting your response</p>
            <strong>{pendingResponses.length}</strong>
          </div>
        </div>

        <div className="meetings-summary-card">
          <span className="summary-icon">↗</span>
          <div>
            <p>My meeting requests</p>
            <strong>{myRequests.length}</strong>
          </div>
        </div>

        <div className="meetings-summary-card">
          <span className="summary-icon">✓</span>
          <div>
            <p>Meeting history</p>
            <strong>{previousMeetings.length}</strong>
          </div>
        </div>
      </section>

      {showRequestForm && (
        <section className="meetings-form-section">
          <div className="meetings-section-heading">
            <div>
              <span className="meetings-eyebrow">SUPERVISION</span>
              <h2>Request a meeting</h2>
              <p>
                Explain why you need the meeting and suggest a convenient time.
                Your supervisor will review your request.
              </p>
            </div>
          </div>

          <form className="meetings-form" onSubmit={submitRequest}>
            <div className="meeting-form-grid">
              <div className="meeting-form-field meeting-field-full">
                <label htmlFor="research_project_id">Research project *</label>
                <select
                  id="research_project_id"
                  name="research_project_id"
                  value={form.research_project_id}
                  onChange={updateForm}
                  required
                >
                  <option value="">Select your research project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title ||
                        project.project_title ||
                        `Project #${project.id}`}
                    </option>
                  ))}
                </select>

                {projects.length === 0 && (
                  <small>
                    No projects were found in your dashboard. Confirm that
                    your dashboard API returns your research projects.
                  </small>
                )}
              </div>

              <div className="meeting-form-field meeting-field-full">
                <label htmlFor="title">Meeting title *</label>
                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  placeholder="e.g. Review of research methodology"
                  required
                  maxLength={200}
                />
              </div>

              <div className="meeting-form-field meeting-field-full">
                <label htmlFor="request_reason">Reason for the meeting *</label>
                <textarea
                  id="request_reason"
                  name="request_reason"
                  value={form.request_reason}
                  onChange={updateForm}
                  placeholder="Explain what you would like to discuss and why a meeting is needed..."
                  rows={4}
                  required
                />
              </div>

              <div className="meeting-form-field">
                <label htmlFor="meeting_date">Preferred date *</label>
                <input
                  type="date"
                  id="meeting_date"
                  name="meeting_date"
                  value={form.meeting_date}
                  onChange={updateForm}
                  min={today}
                  required
                />
              </div>

              <div className="meeting-form-field">
                <label htmlFor="meeting_mode">Meeting mode *</label>
                <select
                  id="meeting_mode"
                  name="meeting_mode"
                  value={form.meeting_mode}
                  onChange={updateForm}
                  required
                >
                  <option value="Online">Online</option>
                  <option value="In-person">In-person</option>
                </select>
              </div>

              <div className="meeting-form-field">
                <label htmlFor="start_time">Start time *</label>
                <input
                  type="time"
                  id="start_time"
                  name="start_time"
                  value={form.start_time}
                  onChange={updateForm}
                  required
                />
              </div>

              <div className="meeting-form-field">
                <label htmlFor="end_time">End time *</label>
                <input
                  type="time"
                  id="end_time"
                  name="end_time"
                  value={form.end_time}
                  onChange={updateForm}
                  min={form.start_time || undefined}
                  required
                />
              </div>

              {form.meeting_mode === "In-person" && (
                <div className="meeting-form-field meeting-field-full">
                  <label htmlFor="meeting_location">Preferred location</label>
                  <input
                    id="meeting_location"
                    name="meeting_location"
                    value={form.meeting_location}
                    onChange={updateForm}
                    placeholder="Office, campus or meeting venue"
                  />
                </div>
              )}

              {form.meeting_mode === "Online" && (
                <div className="meeting-form-field meeting-field-full">
                  <label htmlFor="meeting_link">
                    Meeting link (if already available)
                  </label>
                  <input
                    type="url"
                    id="meeting_link"
                    name="meeting_link"
                    value={form.meeting_link}
                    onChange={updateForm}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="meeting-form-field meeting-field-full">
                <label htmlFor="agenda">Proposed agenda</label>
                <textarea
                  id="agenda"
                  name="agenda"
                  value={form.agenda}
                  onChange={updateForm}
                  placeholder="Topics, questions or progress to discuss..."
                  rows={3}
                />
              </div>
            </div>

            <div className="meeting-form-actions">
              <button
                type="button"
                className="meeting-btn meeting-btn-light"
                onClick={() => {
                  setShowRequestForm(false);
                  setForm(initialForm);
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="meeting-btn meeting-btn-primary"
                disabled={submitting || projects.length === 0}
              >
                {submitting ? "Submitting..." : "Submit meeting request"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="meetings-list-section">
        <div className="meetings-section-heading meetings-list-heading">
          <div>
            <span className="meetings-eyebrow">YOUR SCHEDULE</span>
            <h2>All meetings</h2>
            <p>View invitations, your requests and previous meetings.</p>
          </div>

          <button
            type="button"
            className="meeting-btn meeting-btn-light"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        <div className="meetings-filter-bar" aria-label="Filter meetings">
          {["All", "Upcoming", "Pending", "Requested", "History"].map(
            (option) => (
              <button
                key={option}
                type="button"
                className={`meeting-filter ${
                  filter === option ? "active" : ""
                }`}
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
              >
                {option}
                {option === "Pending" && pendingResponses.length > 0 && (
                  <span className="meeting-filter-count">
                    {pendingResponses.length}
                  </span>
                )}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="meetings-empty-state">
            <div className="meetings-loading-spinner" />
            <h3>Loading your meetings</h3>
            <p>Please wait while we retrieve your schedule.</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="meetings-empty-state">
            <span className="meetings-empty-icon">▦</span>
            <h3>
              {filter === "History"
                ? "No previous meetings"
                : filter === "Pending"
                ? "No pending responses"
                : filter === "Requested"
                ? "You haven't requested a meeting yet"
                : filter === "Upcoming"
                ? "No upcoming meetings"
                : "No meetings yet"}
            </h3>

            <p>
              {filter === "All" || filter === "Upcoming"
                ? "Request a meeting with your supervisor or check back when a new invitation arrives."
                : "Meetings matching this filter will appear here."}
            </p>

            {(filter === "All" || filter === "Upcoming") && (
              <button
                type="button"
                className="meeting-btn meeting-btn-primary"
                onClick={() => setShowRequestForm(true)}
              >
                Request a meeting
              </button>
            )}
          </div>
        ) : (
          <div className="meetings-list">
            {filteredMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onRespond={respondToMeeting}
                onSaveNotes={saveNotes}
                busy={busyMeetingId === meeting.id}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
