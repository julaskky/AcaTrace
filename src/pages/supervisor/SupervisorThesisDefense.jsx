import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/supervisor/supervisor-thesis-defense.css";

const API =
  "http://localhost/acatrace/api/supervisor/thesis-defense.php";

const DOCUMENT_API =
  "http://localhost/acatrace/api/supervisor/thesis-defense-document-file.php";

const TIMETABLE_API =
  "http://localhost/acatrace/api/supervisor/defense-timetables.php";

const initialForm = {
  scheduled_at: "",
  venue: "",
  meeting_link: "",
  outcome: "Passed",
  outcome_feedback: "",
};

const initialTimetableForm = {
  title: "Thesis Defense Timetable",
  defense_date: "",
  start_time: "",
  end_time: "",
  venue: "",
  meeting_link: "",
  instructions: "",
};

const validOutcomes = [
  "Passed",
  "Passed with Revisions",
  "Re-examination Required",
  "Failed",
];

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(String(value).replace(" ", "T"));

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: String(value).includes(":") ? "short" : undefined,
      });
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;

  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status) {
  return String(status || "Pending")
    .toLowerCase()
    .replaceAll(" ", "-");
}

function documentUrl(documentId, mode = "download") {
  const params = new URLSearchParams({
    id: String(documentId),
    mode,
  });

  return `${DOCUMENT_API}?${params.toString()}`;
}

function isPdf(document) {
  return (
    String(document?.mime_type || "").toLowerCase() ===
    "application/pdf"
  );
}

function safeExternalUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function timeValue(value) {
  return value ? String(value).slice(0, 5) : "";
}

export default function SupervisorThesisDefense() {
  // Individual defense records
  const [defenses, setDefenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("");
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // Shared timetable records
  const [timetables, setTimetables] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [timetableError, setTimetableError] = useState("");
  const [timetableNotice, setTimetableNotice] = useState("");
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [timetableForm, setTimetableForm] = useState(
    initialTimetableForm
  );
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [timetableActionId, setTimetableActionId] = useState(null);

  // Load individual defense records
  const loadDefenses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not load thesis defenses."
        );
      }

      setDefenses(Array.isArray(data.defenses) ? data.defenses : []);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load shared defense timetables
  const loadTimetables = useCallback(async () => {
    setTimetableLoading(true);
    setTimetableError("");

    try {
      const response = await fetch(TIMETABLE_API, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not load defense timetables."
        );
      }

      setTimetables(
        Array.isArray(data.timetables) ? data.timetables : []
      );
    } catch (err) {
      setTimetableError(
        err.message || "Could not load the timetable records."
      );
    } finally {
      setTimetableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefenses();
    loadTimetables();
  }, [loadDefenses, loadTimetables]);

  // Individual defense statistics
  const counts = useMemo(
    () => ({
      total: defenses.length,
      requested: defenses.filter(
        (d) => d.status === "Requested"
      ).length,
      scheduled: defenses.filter(
        (d) => d.status === "Scheduled"
      ).length,
      completed: defenses.filter(
        (d) => d.status === "Completed"
      ).length,
    }),
    [defenses]
  );

  // Search and filter individual defense records
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return defenses.filter((d) => {
      const matchesFilter =
        filter === "All" || d.status === filter;

      const searchable = [
        d.student_name,
        d.student_number,
        d.student_email,
        d.project_title,
        d.programme,
        d.venue,
        d.status,
        d.outcome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && searchable.includes(term);
    });
  }, [defenses, filter, search]);

  // Individual defense actions
  function openAction(defense, nextAction) {
    setSelected(defense);
    setAction(nextAction);
    setError("");
    setNotice("");

    setForm({
      ...initialForm,
      scheduled_at: defense.scheduled_at
        ? String(defense.scheduled_at).replace(" ", "T").slice(0, 16)
        : "",
      venue: defense.venue || "",
      meeting_link: defense.meeting_link || "",
      outcome: validOutcomes.includes(defense.outcome)
        ? defense.outcome
        : "Passed",
      outcome_feedback: defense.outcome_feedback || "",
    });
  }

  function closeModal() {
    if (saving) return;

    setSelected(null);
    setAction("");
    setForm(initialForm);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitAction(event) {
    event.preventDefault();

    if (!selected || !action || saving) return;

    setSaving(true);
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
          defense_id: selected.id,
          action,
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not update the defense."
        );
      }

      setSelected(null);
      setAction("");
      setForm(initialForm);
      setNotice(data.message || "Defense updated successfully.");

      await loadDefenses();
    } catch (err) {
      setError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  const actionTitle = {
    approve: "Approve defense request",
    schedule: "Schedule thesis defense",
    complete: "Record defense outcome",
    cancel: "Cancel thesis defense",
  };

  // Shared timetable form
  function openTimetableForm(timetable = null) {
    setEditingTimetable(timetable);
    setTimetableError("");
    setTimetableNotice("");

    if (timetable) {
      setTimetableForm({
        title: timetable.title || "Thesis Defense Timetable",
        defense_date: String(timetable.defense_date || "").slice(0, 10),
        start_time: timeValue(timetable.start_time),
        end_time: timeValue(timetable.end_time),
        venue: timetable.venue || "",
        meeting_link: timetable.meeting_link || "",
        instructions: timetable.instructions || "",
      });
    } else {
      setTimetableForm({
        ...initialTimetableForm,
        defense_date: "",
        start_time: "",
        end_time: "",
      });
    }

    setShowTimetableForm(true);
  }

  function closeTimetableForm() {
    if (timetableSaving) return;

    setShowTimetableForm(false);
    setEditingTimetable(null);
    setTimetableForm(initialTimetableForm);
  }

  function updateTimetableForm(field, value) {
    setTimetableForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitTimetable(event) {
    event.preventDefault();

    if (timetableSaving) return;

    setTimetableSaving(true);
    setTimetableError("");
    setTimetableNotice("");

    try {
      if (
        timetableForm.end_time &&
        timetableForm.end_time <= timetableForm.start_time
      ) {
        throw new Error(
          "The end time must be later than the start time."
        );
      }

      const payload = {
        action: editingTimetable ? "update" : "create",
        ...(editingTimetable
          ? { timetable_id: editingTimetable.id }
          : {}),
        ...timetableForm,
      };

      const response = await fetch(TIMETABLE_API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not save the timetable."
        );
      }

      setShowTimetableForm(false);
      setEditingTimetable(null);
      setTimetableForm(initialTimetableForm);
      setTimetableNotice(
        data.message ||
          (editingTimetable
            ? "Timetable updated successfully."
            : "Timetable draft created successfully.")
      );

      await loadTimetables();
    } catch (err) {
      setTimetableError(
        err.message || "Could not save the timetable."
      );
    } finally {
      setTimetableSaving(false);
    }
  }

  // Publish or cancel a shared timetable
  async function changeTimetableStatus(timetable, nextAction) {
    if (timetableActionId !== null) return;

    const confirmation = {
      publish:
        "Publish this timetable? All students currently supervised by you will be notified.",
      cancel:
        "Cancel this timetable? Students who received its notification will be informed.",
    };

    if (!window.confirm(confirmation[nextAction])) return;

    setTimetableActionId(timetable.id);
    setTimetableError("");
    setTimetableNotice("");

    try {
      const response = await fetch(TIMETABLE_API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: nextAction,
          timetable_id: timetable.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not update the timetable."
        );
      }

      setTimetableNotice(
        data.message ||
          (nextAction === "publish"
            ? "Timetable published successfully."
            : "Timetable cancelled successfully.")
      );

      await loadTimetables();
    } catch (err) {
      setTimetableError(
        err.message || "Could not update the timetable."
      );
    } finally {
      setTimetableActionId(null);
    }
  }

  return (
    <main className="thesis-defense-page">
      {/* Page header */}
      <header className="td-hero">
        <div className="td-hero-top">
          <Link to="/supervisor/dashboard" className="td-back">
            ← Back to Dashboard
          </Link>

          <span className="td-eyebrow">
            SUPERVISOR WORKSPACE
          </span>
        </div>

        <div className="td-hero-content">
          <div>
            <h1>Thesis Defense</h1>
            <p>
              Coordinate shared defense schedules, review student
              requests, and record examination outcomes.
            </p>
          </div>

          <div className="td-hero-icon" aria-hidden="true">
            ♧
          </div>
        </div>
      </header>

      {/* Individual defense feedback */}
      {notice && (
        <div className="td-notice td-success" role="status">
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
        <div className="td-notice td-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadDefenses}>
            Try again
          </button>
        </div>
      )}

      {/* Individual defense statistics */}
      <section className="td-stats">
        <article className="td-stat">
          <span className="td-stat-icon purple">▤</span>
          <div>
            <span>Total defenses</span>
            <strong>{counts.total}</strong>
          </div>
        </article>

        <article className="td-stat">
          <span className="td-stat-icon amber">◷</span>
          <div>
            <span>Awaiting review</span>
            <strong>{counts.requested}</strong>
          </div>
        </article>

        <article className="td-stat">
          <span className="td-stat-icon blue">▦</span>
          <div>
            <span>Scheduled</span>
            <strong>{counts.scheduled}</strong>
          </div>
        </article>

        <article className="td-stat">
          <span className="td-stat-icon green">✓</span>
          <div>
            <span>Completed</span>
            <strong>{counts.completed}</strong>
          </div>
        </article>
      </section>

      {/* Shared timetable management */}
      <section className="td-timetable-section">
        <div className="td-section-heading">
          <div>
            <span className="td-eyebrow">SHARED SCHEDULE</span>
            <h2>Thesis Defense Timetable</h2>
            <p>
              Create and publish a common defense date, time, and venue
              for your supervised students.
            </p>
          </div>

          <button
            type="button"
            className="td-button td-primary"
            onClick={() => openTimetableForm()}
          >
            + Create timetable
          </button>
        </div>

        {timetableNotice && (
          <div className="td-notice td-success" role="status">
            <span>✓</span> {timetableNotice}
            <button
              type="button"
              onClick={() => setTimetableNotice("")}
              aria-label="Dismiss timetable notification"
            >
              ×
            </button>
          </div>
        )}

        {timetableError && (
          <div className="td-notice td-error" role="alert">
            <span>{timetableError}</span>
            <button type="button" onClick={loadTimetables}>
              Try again
            </button>
          </div>
        )}

        {timetableLoading ? (
          <div className="td-empty" aria-live="polite">
            <div className="td-loader" />
            <h3>Loading timetables</h3>
            <p>Retrieving your shared defense schedules.</p>
          </div>
        ) : timetables.length === 0 ? (
          <div className="td-empty td-timetable-empty">
            <span className="td-empty-icon">▦</span>
            <h3>No shared timetable yet</h3>
            <p>
              Create a common schedule when you are ready to coordinate
              your students' thesis defenses.
            </p>
            <button
              type="button"
              className="td-button td-primary"
              onClick={() => openTimetableForm()}
            >
              Create your first timetable
            </button>
          </div>
        ) : (
          <div className="td-timetable-grid">
            {timetables.map((timetable) => {
              const meetingUrl = safeExternalUrl(
                timetable.meeting_link
              );
              const isBusy = timetableActionId !== null;

              return (
                <article
                  className="td-timetable-card"
                  key={timetable.id}
                >
                  <div className="td-timetable-card-top">
                    <span className="td-timetable-icon">▦</span>

                    <span
                      className={`td-status ${statusClass(
                        timetable.status
                      )}`}
                    >
                      {timetable.status || "Draft"}
                    </span>
                  </div>

                  <h3>{timetable.title}</h3>

                  <div className="td-timetable-details">
                    <div>
                      <span>Defense date</span>
                      <strong>
                        {timetable.defense_date
                          ? formatDate(
                              String(timetable.defense_date).slice(0, 10)
                            )
                          : "Not set"}
                      </strong>
                    </div>

                    <div>
                      <span>Time</span>
                      <strong>
                        {timeValue(timetable.start_time) || "Not set"}
                        {timetable.end_time
                          ? ` – ${timeValue(timetable.end_time)}`
                          : ""}
                      </strong>
                    </div>

                    <div>
                      <span>Venue</span>
                      <strong>
                        {timetable.venue || "Not assigned"}
                      </strong>
                    </div>
                  </div>

                  {meetingUrl && (
                    <p className="td-meeting-link">
                      <a
                        href={meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join online session ↗
                      </a>
                    </p>
                  )}

                  {timetable.instructions && (
                    <div className="td-feedback">
                      <strong>Instructions for students</strong>
                      <p>{timetable.instructions}</p>
                    </div>
                  )}

                  <div className="td-timetable-actions">
                    {timetable.status !== "Cancelled" && (
                      <button
                        type="button"
                        className="td-button td-secondary"
                        disabled={isBusy}
                        onClick={() => openTimetableForm(timetable)}
                      >
                        Edit timetable
                      </button>
                    )}

                    {timetable.status === "Draft" && (
                      <button
                        type="button"
                        className="td-button td-primary"
                        disabled={isBusy}
                        onClick={() =>
                          changeTimetableStatus(timetable, "publish")
                        }
                      >
                        {timetableActionId === timetable.id
                          ? "Publishing..."
                          : "Publish to students"}
                      </button>
                    )}

                    {timetable.status === "Published" && (
                      <button
                        type="button"
                        className="td-button td-cancel"
                        disabled={isBusy}
                        onClick={() =>
                          changeTimetableStatus(timetable, "cancel")
                        }
                      >
                        {timetableActionId === timetable.id
                          ? "Cancelling..."
                          : "Cancel timetable"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!timetableLoading && timetables.length > 0 && (
          <div className="td-results-count">
            {timetables.length} timetable
            {timetables.length === 1 ? "" : "s"}
          </div>
        )}
      </section>

      {/* Existing individual defense management */}
      <section className="td-workspace">
        <div className="td-section-heading">
          <div>
            <h2>Individual defense requests</h2>
            <p>
              Review requests and manage examination records for
              individual students.
            </p>
          </div>

          <button
            type="button"
            className="td-refresh"
            onClick={loadDefenses}
            disabled={loading}
          >
            ↻ {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="td-toolbar">
          <label className="td-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student, project or programme..."
              aria-label="Search thesis defenses"
            />
          </label>

          <select
            aria-label="Filter by defense status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Requested">Requested</option>
            <option value="Approved">Approved</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="td-empty" aria-live="polite">
            <div className="td-loader" />
            <h3>Loading thesis defenses</h3>
            <p>Please wait while we retrieve your records.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="td-empty">
            <span className="td-empty-icon">▤</span>
            <h3>No defense requests found</h3>
            <p>
              {defenses.length
                ? "Try changing your search or status filter."
                : "Defense requests from your assigned students will appear here."}
            </p>
          </div>
        ) : (
          <div className="td-card-list">
            {filtered.map((d) => {
              const meetingUrl = safeExternalUrl(d.meeting_link);

              return (
                <article className="td-defense-card" key={d.id}>
                  <div className="td-card-heading">
                    <div className="td-student-avatar">
                      {(d.student_name || "S")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>

                    <div className="td-student-info">
                      <h3>{d.student_name || "Student"}</h3>
                      <p>
                        {d.programme || "Programme not specified"}
                        {d.student_number
                          ? ` · ${d.student_number}`
                          : ""}
                      </p>
                    </div>

                    <span
                      className={`td-status ${statusClass(d.status)}`}
                    >
                      {d.status || "Pending"}
                    </span>
                  </div>

                  <div className="td-project">
                    <span>RESEARCH PROJECT</span>
                    <h4>
                      {d.project_title || "Untitled research project"}
                    </h4>
                    {d.student_email && <p>{d.student_email}</p>}
                  </div>

                  <div className="td-detail-grid">
                    <div>
                      <span>Requested date</span>
                      <strong>{formatDate(d.requested_date)}</strong>
                    </div>

                    <div>
                      <span>Scheduled session</span>
                      <strong>{formatDate(d.scheduled_at)}</strong>
                    </div>

                    <div>
                      <span>Venue</span>
                      <strong>{d.venue || "Not assigned"}</strong>
                    </div>

                    <div>
                      <span>Outcome</span>
                      <strong>{d.outcome || "Pending"}</strong>
                    </div>
                  </div>

                  {meetingUrl && (
                    <p className="td-meeting-link">
                      Meeting link:{" "}
                      <a
                        href={meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join meeting ↗
                      </a>
                    </p>
                  )}

                  {d.outcome_feedback && (
                    <div className="td-feedback">
                      <strong>Supervisor feedback</strong>
                      <p>{d.outcome_feedback}</p>
                    </div>
                  )}

                  <div className="td-documents">
                    <div>
                      <strong>Defense documents</strong>
                      <span>
                        {Array.isArray(d.documents)
                          ? d.documents.length
                          : 0}{" "}
                        uploaded
                      </span>
                    </div>

                    {Array.isArray(d.documents) &&
                    d.documents.length > 0 ? (
                      <ul>
                        {d.documents.map((doc) => (
                          <li key={doc.id}>
                            <span className="td-file-icon">
                              {isPdf(doc) ? "PDF" : "DOC"}
                            </span>

                            <div className="td-document-info">
                              <strong>
                                {doc.title || "Defense document"}
                              </strong>

                              <span>
                                {doc.original_filename || "Uploaded file"}
                                {" · "}
                                {formatBytes(doc.file_size)}
                              </span>

                              <div className="td-document-actions">
                                {isPdf(doc) && (
                                  <a
                                    className="td-document-link"
                                    href={documentUrl(doc.id, "inline")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Preview PDF ↗
                                  </a>
                                )}

                                <a
                                  className="td-document-link td-document-download"
                                  href={documentUrl(doc.id, "download")}
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="td-no-docs">
                        No documents uploaded yet.
                      </p>
                    )}
                  </div>

                  <div className="td-card-actions">
                    {d.status === "Requested" && (
                      <button
                        type="button"
                        className="td-button td-primary"
                        onClick={() => openAction(d, "approve")}
                      >
                        ✓ Approve request
                      </button>
                    )}

                    {["Requested", "Approved", "Scheduled"].includes(
                      d.status
                    ) && (
                      <button
                        type="button"
                        className="td-button td-secondary"
                        onClick={() => openAction(d, "schedule")}
                      >
                        ▦{" "}
                        {d.status === "Scheduled"
                          ? "Edit schedule"
                          : "Schedule defense"}
                      </button>
                    )}

                    {d.status === "Scheduled" && (
                      <button
                        type="button"
                        className="td-button td-complete"
                        onClick={() => openAction(d, "complete")}
                      >
                        Record outcome
                      </button>
                    )}

                    {["Requested", "Approved", "Scheduled"].includes(
                      d.status
                    ) && (
                      <button
                        type="button"
                        className="td-button td-cancel"
                        onClick={() => openAction(d, "cancel")}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="td-results-count">
            Showing {filtered.length} of {defenses.length} defense records
          </div>
        )}
      </section>

      {/* Individual defense action modal */}
      {selected && action && (
        <div
          className="td-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="td-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="td-modal-title"
          >
            <div className="td-modal-header">
              <div>
                <span>DEFENSE MANAGEMENT</span>
                <h2 id="td-modal-title">{actionTitle[action]}</h2>
                <p>
                  {selected.student_name} · {selected.project_title}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitAction}>
              {action === "approve" && (
                <div className="td-confirmation">
                  <span>✓</span>
                  <div>
                    <strong>Approve this defense request?</strong>
                    <p>
                      The request will be marked as approved. You can
                      schedule the session immediately afterward.
                    </p>
                  </div>
                </div>
              )}

              {action === "schedule" && (
                <>
                  <label className="td-field">
                    Defense date and time *
                    <input
                      type="datetime-local"
                      required
                      value={form.scheduled_at}
                      onChange={(event) =>
                        updateForm("scheduled_at", event.target.value)
                      }
                    />
                  </label>

                  <label className="td-field">
                    Venue or location *
                    <input
                      required
                      maxLength={255}
                      placeholder="e.g. Faculty Boardroom or Online"
                      value={form.venue}
                      onChange={(event) =>
                        updateForm("venue", event.target.value)
                      }
                    />
                  </label>

                  <label className="td-field">
                    Online meeting link <span>(optional)</span>
                    <input
                      type="url"
                      maxLength={500}
                      placeholder="https://..."
                      value={form.meeting_link}
                      onChange={(event) =>
                        updateForm("meeting_link", event.target.value)
                      }
                    />
                  </label>

                  <p className="td-form-note">
                    The session must be scheduled for a future date and time.
                  </p>
                </>
              )}

              {action === "complete" && (
                <>
                  <label className="td-field">
                    Defense outcome *
                    <select
                      required
                      value={form.outcome}
                      onChange={(event) =>
                        updateForm("outcome", event.target.value)
                      }
                    >
                      {validOutcomes.map((outcome) => (
                        <option key={outcome} value={outcome}>
                          {outcome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="td-field">
                    Outcome feedback *
                    <textarea
                      required
                      rows={5}
                      maxLength={10000}
                      placeholder="Record the examination decision, required revisions, and recommendations..."
                      value={form.outcome_feedback}
                      onChange={(event) =>
                        updateForm("outcome_feedback", event.target.value)
                      }
                    />
                  </label>
                </>
              )}

              {action === "cancel" && (
                <div className="td-confirmation td-warning">
                  <span>!</span>
                  <div>
                    <strong>Cancel this defense?</strong>
                    <p>
                      This will mark the defense as cancelled. The record
                      will remain available for reference.
                    </p>
                  </div>
                </div>
              )}

              <div className="td-modal-actions">
                <button
                  type="button"
                  className="td-button td-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Go back
                </button>

                <button
                  type="submit"
                  className={`td-button ${
                    action === "cancel" ? "td-danger" : "td-primary"
                  }`}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : action === "complete"
                      ? "Save outcome"
                      : action === "schedule"
                        ? "Save schedule"
                        : action === "approve"
                          ? "Approve request"
                          : "Confirm cancellation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Shared timetable create/edit modal */}
      {showTimetableForm && (
        <div
          className="td-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTimetableForm();
            }
          }}
        >
          <section
            className="td-modal td-timetable-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="td-timetable-modal-title"
          >
            <div className="td-modal-header">
              <div>
                <span>SHARED DEFENSE SCHEDULE</span>
                <h2 id="td-timetable-modal-title">
                  {editingTimetable
                    ? "Edit timetable"
                    : "Create timetable"}
                </h2>
                <p>
                  Set the common defense date, time, and venue for your
                  supervised students.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTimetableForm}
                disabled={timetableSaving}
                aria-label="Close timetable form"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitTimetable}>
              <label className="td-field">
                Timetable title *
                <input
                  required
                  maxLength={255}
                  value={timetableForm.title}
                  onChange={(event) =>
                    updateTimetableForm("title", event.target.value)
                  }
                  placeholder="e.g. October 2026 Thesis Defense"
                />
              </label>

              <label className="td-field">
                Defense date *
                <input
                  type="date"
                  required
                  value={timetableForm.defense_date}
                  onChange={(event) =>
                    updateTimetableForm(
                      "defense_date",
                      event.target.value
                    )
                  }
                />
              </label>

              <div className="td-timetable-time-grid">
                <label className="td-field">
                  Start time *
                  <input
                    type="time"
                    required
                    value={timetableForm.start_time}
                    onChange={(event) =>
                      updateTimetableForm(
                        "start_time",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="td-field">
                  End time
                  <input
                    type="time"
                    value={timetableForm.end_time}
                    onChange={(event) =>
                      updateTimetableForm(
                        "end_time",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <label className="td-field">
                Venue or location *
                <input
                  required
                  maxLength={255}
                  value={timetableForm.venue}
                  onChange={(event) =>
                    updateTimetableForm("venue", event.target.value)
                  }
                  placeholder="e.g. Faculty Conference Hall"
                />
              </label>

              <label className="td-field">
                Online meeting link <span>(optional)</span>
                <input
                  type="url"
                  maxLength={500}
                  value={timetableForm.meeting_link}
                  onChange={(event) =>
                    updateTimetableForm(
                      "meeting_link",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="td-field">
                Instructions for students <span>(optional)</span>
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={timetableForm.instructions}
                  onChange={(event) =>
                    updateTimetableForm(
                      "instructions",
                      event.target.value
                    )
                  }
                  placeholder="Include presentation duration, required documents, arrival time, or other guidance."
                />
              </label>

              {timetableError && (
                <div className="td-notice td-error" role="alert">
                  {timetableError}
                </div>
              )}

              <p className="td-form-note">
                Saving creates or updates the timetable. Publishing a
                draft notifies supervised students. Editing a published
                timetable should notify students of the changes.
              </p>

              <div className="td-modal-actions">
                <button
                  type="button"
                  className="td-button td-secondary"
                  onClick={closeTimetableForm}
                  disabled={timetableSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="td-button td-primary"
                  disabled={timetableSaving}
                >
                  {timetableSaving
                    ? "Saving..."
                    : editingTimetable
                      ? "Save changes"
                      : "Create draft"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
