
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/student/thesis-defense.css";

const API = "http://localhost/acatrace/api/student";

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: value.includes(":") ? "short" : undefined,
      });
}

function formatSize(bytes) {
  const size = Number(bytes || 0);
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function ThesisDefense() {
  const [projects, setProjects] = useState([]);
  const [defenses, setDefenses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [defenseId, setDefenseId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/thesis_defense.php`, {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load thesis defense information.");
      }

      setProjects(data.projects || []);
      setDefenses(data.defenses || []);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/thesis_defense.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          research_project_id: projectId,
          requested_date: requestedDate,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not submit the request.");
      }

      setMessage(data.message);
      setProjectId("");
      setRequestedDate("");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to submit the request.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!defenseId || !file || !documentTitle.trim()) {
      setError("Select a defense, enter a document title, and choose a file.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("action", "upload");
      formData.append("defense_id", defenseId);
      formData.append("title", documentTitle.trim());
      formData.append("document", file);

      const response = await fetch(`${API}/thesis_defense.php`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not upload the document.");
      }

      setMessage(data.message);
      setDocumentTitle("");
      setFile(null);
      event.target.reset();
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to upload the document.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocument(doc) {
    setError("");
    try {
      const response = await fetch(
        `${API}/thesis_defense_download.php?id=${encodeURIComponent(doc.id)}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Download failed. Please try again.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.original_filename || "defense-document";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Unable to download this document.");
    }
  }

  const statusClass = (status) =>
    `defense-status defense-status-${String(status || "")
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  return (
    <main className="defense-page">
      <header className="defense-header">
        <div>
          <Link className="defense-back" to="/student/dashboard">
            ← Student Dashboard
          </Link>
          <p className="defense-eyebrow">STUDENT RESEARCH</p>
          <h1>Thesis Defense</h1>
          <p className="defense-subtitle">
            Request your defense, track scheduling, submit documents, and view your outcome.
          </p>
        </div>
        <div className="defense-header-icon" aria-hidden="true">🎓</div>
      </header>

      {error && <div className="defense-alert defense-alert-error">{error}</div>}
      {message && <div className="defense-alert defense-alert-success">{message}</div>}

      <section className="defense-stats">
        <article className="defense-stat">
          <span>Defense requests</span>
          <strong>{defenses.length}</strong>
        </article>
        <article className="defense-stat">
          <span>Scheduled</span>
          <strong>{defenses.filter((d) => d.scheduled_at).length}</strong>
        </article>
        <article className="defense-stat">
          <span>Documents submitted</span>
          <strong>{documents.length}</strong>
        </article>
        <article className="defense-stat">
          <span>Outcomes recorded</span>
          <strong>{defenses.filter((d) => d.outcome !== "Pending").length}</strong>
        </article>
      </section>

      <div className="defense-layout">
        <section className="defense-panel">
          <div className="defense-panel-heading">
            <span className="defense-section-icon">01</span>
            <div>
              <h2>Request a Defense</h2>
              <p>Submit a request for one of your research projects.</p>
            </div>
          </div>

          <form className="defense-form" onSubmit={submitRequest}>
            <label htmlFor="defense-project">Research project *</label>
            <select
              id="defense-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              <option value="">Select your project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>

            <label htmlFor="defense-date">Preferred date (optional)</label>
            <input
              id="defense-date"
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />

            <button className="defense-primary-button" disabled={saving || loading || !projects.length}>
              {saving ? "Please wait..." : "Submit Defense Request"}
            </button>
            {!projects.length && !loading && (
              <p className="defense-hint">You need a research project before requesting a defense.</p>
            )}
          </form>
        </section>

        <section className="defense-panel">
          <div className="defense-panel-heading">
            <span className="defense-section-icon">02</span>
            <div>
              <h2>Submit Required Documents</h2>
              <p>Upload a document against your defense request.</p>
            </div>
          </div>

          <form className="defense-form" onSubmit={uploadDocument}>
            <label htmlFor="defense-select">Defense request *</label>
            <select
              id="defense-select"
              value={defenseId}
              onChange={(e) => setDefenseId(e.target.value)}
              required
            >
              <option value="">Select a defense request</option>
              {defenses.map((defense) => (
                <option key={defense.id} value={defense.id}>
                  {defense.project_title} — {defense.status}
                </option>
              ))}
            </select>

            <label htmlFor="defense-document-title">Document title *</label>
            <input
              id="defense-document-title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="e.g. Final thesis"
              maxLength={255}
              required
            />

            <label htmlFor="defense-file">Choose file (PDF, DOC, DOCX; max 10 MB) *</label>
            <input
              id="defense-file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />

            <button className="defense-primary-button" disabled={saving || loading || !defenses.length}>
              {saving ? "Please wait..." : "Upload Document"}
            </button>
          </form>
        </section>
      </div>

      <section className="defense-panel defense-wide-panel">
        <div className="defense-panel-heading">
          <span className="defense-section-icon">03</span>
          <div>
            <h2>Defense Schedule & Outcome</h2>
            <p>Your official schedule and result will appear here when recorded by the institution.</p>
          </div>
        </div>

        {loading ? (
          <p className="defense-empty">Loading your defense information...</p>
        ) : defenses.length === 0 ? (
          <p className="defense-empty">You have not submitted a defense request yet.</p>
        ) : (
          <div className="defense-defense-list">
            {defenses.map((defense) => (
              <article className="defense-record" key={defense.id}>
                <div className="defense-record-top">
                  <div>
                    <h3>{defense.project_title}</h3>
                    <p>Request #{defense.id} · Submitted {formatDate(defense.created_at)}</p>
                  </div>
                  <span className={statusClass(defense.status)}>{defense.status}</span>
                </div>

                <div className="defense-detail-grid">
                  <div>
                    <span>Preferred date</span>
                    <strong>{defense.requested_date || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Scheduled date & time</span>
                    <strong>{formatDate(defense.scheduled_at)}</strong>
                  </div>
                  <div>
                    <span>Venue</span>
                    <strong>{defense.venue || "Not announced"}</strong>
                  </div>
                  <div>
                    <span>Outcome</span>
                    <strong>{defense.outcome || "Pending"}</strong>
                  </div>
                </div>

                {defense.meeting_link && (
                  <p className="defense-meeting-link">
                    Meeting link:{" "}
                    <a href={defense.meeting_link} target="_blank" rel="noreferrer">
                      Join scheduled meeting
                    </a>
                  </p>
                )}

                {defense.outcome_feedback && (
                  <div className="defense-feedback">
                    <strong>Outcome feedback</strong>
                    <p>{defense.outcome_feedback}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="defense-panel defense-wide-panel">
        <div className="defense-panel-heading">
          <span className="defense-section-icon">04</span>
          <div>
            <h2>My Defense Documents</h2>
            <p>Documents you have uploaded for your defense requests.</p>
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="defense-empty">No defense documents have been uploaded yet.</p>
        ) : (
          <div className="defense-table-wrap">
            <table className="defense-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>File</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.title}</td>
                    <td>{doc.original_filename}</td>
                    <td>{formatSize(doc.file_size)}</td>
                    <td>{formatDate(doc.uploaded_at)}</td>
                    <td>
                      <button
                        className="defense-download-button"
                        type="button"
                        onClick={() => downloadDocument(doc)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
