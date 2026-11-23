
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/supervisor/supervisor-document-reviews.css";

const API_URL =
  "http://localhost/acatrace/api/supervisor/document-reviews.php";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const formatSize = (bytes) => {
  if (!bytes) return "0 KB";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function SupervisorDocumentReviews() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [reviewStatus, setReviewStatus] = useState("Approved");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load documents.");
      }

      setDocuments(result.documents || []);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openReview = (document) => {
    setSelected(document);
    setFeedback("");
    setReviewStatus(
      document.status === "Approved"
        ? "Approved"
        : document.status === "Revision Required"
        ? "Revision Required"
        : "Under Review"
    );
    setNotice("");
  };

  const saveReview = async (event) => {
    event.preventDefault();

    if (!selected || !feedback.trim()) {
      setNotice("Please enter feedback before saving your review.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: selected.id,
          review_status: reviewStatus,
          feedback_text: feedback.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save the review.");
      }

      setNotice(result.message || "Review saved successfully.");
      setSelected(null);
      setFeedback("");
      await loadDocuments();
    } catch (err) {
      setNotice(err.message || "Unable to save the review.");
    } finally {
      setSaving(false);
    }
  };

  const filteredDocuments = documents.filter((document) => {
    const term = search.toLowerCase();
    const matchesSearch = [
      document.title,
      document.document_type,
      document.student_name,
      document.student_email,
      document.project_title,
      document.original_filename,
    ].some((value) => String(value || "").toLowerCase().includes(term));

    const matchesFilter = filter === "All" || document.status === filter;
    return matchesSearch && matchesFilter;
  });

  const pendingCount = documents.filter(
    (document) => document.status === "Pending Review"
  ).length;
  const revisionCount = documents.filter(
    (document) => document.status === "Revision Required"
  ).length;
  const approvedCount = documents.filter(
    (document) => document.status === "Approved"
  ).length;

  return (
    <div className="sdr-page">
      <header className="sdr-topbar">
        <Link to="/supervisor/dashboard" className="sdr-brand">
          <span className="sdr-brand-mark">A</span>
          <span>
            <strong>AcaTrace</strong>
            <small>SUPERVISOR WORKSPACE</small>
          </span>
        </Link>
        <button
          className="sdr-back-button"
          onClick={() => navigate("/supervisor/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </header>

      <main className="sdr-content">
        <div className="sdr-heading">
          <div>
            <span className="sdr-eyebrow">ACADEMIC QUALITY & FEEDBACK</span>
            <h1>Document Reviews</h1>
            <p>
              Review student submissions, provide constructive feedback, and
              record decisions in one place.
            </p>
          </div>
          <button className="sdr-refresh" onClick={loadDocuments} disabled={loading}>
            ↻ Refresh
          </button>
        </div>

        {notice && !selected && (
          <div className="sdr-notice" role="status">{notice}</div>
        )}

        <section className="sdr-stats">
          <article className="sdr-stat">
            <span className="sdr-stat-icon sdr-purple">▤</span>
            <div><strong>{documents.length}</strong><span>Total submissions</span></div>
          </article>
          <article className="sdr-stat">
            <span className="sdr-stat-icon sdr-amber">◷</span>
            <div><strong>{pendingCount}</strong><span>Pending review</span></div>
          </article>
          <article className="sdr-stat">
            <span className="sdr-stat-icon sdr-blue">↻</span>
            <div><strong>{revisionCount}</strong><span>Revisions requested</span></div>
          </article>
          <article className="sdr-stat">
            <span className="sdr-stat-icon sdr-green">✓</span>
            <div><strong>{approvedCount}</strong><span>Approved</span></div>
          </article>
        </section>

        <section className="sdr-panel">
          <div className="sdr-panel-heading">
            <div>
              <span className="sdr-eyebrow">SUBMISSION REGISTER</span>
              <h2>Student documents</h2>
              <p>Documents linked to research projects assigned to you.</p>
            </div>
          </div>

          <div className="sdr-toolbar">
            <label className="sdr-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search student, project, or document..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter documents by status"
            >
              <option value="All">All statuses</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Revision Required">Revision Required</option>
              <option value="Approved">Approved</option>
            </select>
          </div>

          {error && (
            <div className="sdr-error">
              <strong>Documents could not be loaded</strong>
              <p>{error}</p>
              <button onClick={loadDocuments}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="sdr-empty">
              <span className="sdr-spinner" />
              <strong>Loading document submissions…</strong>
            </div>
          ) : !error && filteredDocuments.length === 0 ? (
            <div className="sdr-empty">
              <span className="sdr-empty-icon">▤</span>
              <strong>
                {documents.length ? "No matching documents" : "No documents to review yet"}
              </strong>
              <p>
                {documents.length
                  ? "Try another search term or status filter."
                  : "Student submissions for your assigned research projects will appear here."}
              </p>
            </div>
          ) : !error && (
            <div className="sdr-table-wrap">
              <table className="sdr-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Student / Project</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="sdr-document-cell">
                          <span className="sdr-file-icon">
                            {document.mime_type === "application/pdf" ? "PDF" : "DOC"}
                          </span>
                          <div>
                            <strong>{document.title}</strong>
                            <span>{document.document_type}</span>
                            <small>
                              {document.original_filename} · {formatSize(document.file_size)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{document.student_name || "Student"}</strong>
                        <span className="sdr-subline">{document.student_email}</span>
                        <span className="sdr-subline">
                          {document.project_title || "Research project"}
                        </span>
                      </td>
                      <td>{formatDate(document.uploaded_at)}</td>
                      <td>
                        <span className={`sdr-status sdr-status-${document.status.toLowerCase().replaceAll(" ", "-")}`}>
                          {document.status}
                        </span>
                      </td>
                      <td>
                        <div className="sdr-actions">
                          <a
                            href={document.preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="sdr-action-link"
                          >
                            Preview
                          </a>
                          <button
                            className="sdr-review-button"
                            onClick={() => openReview(document)}
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="sdr-table-footer">
            Showing {filteredDocuments.length} of {documents.length} submissions
          </div>
        </section>

        {selected && (
          <div className="sdr-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setSelected(null);
          }}>
            <section
              className="sdr-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sdr-modal-title"
            >
              <div className="sdr-modal-heading">
                <div>
                  <span className="sdr-eyebrow">SUPERVISOR FEEDBACK</span>
                  <h2 id="sdr-modal-title">Review submission</h2>
                </div>
                <button
                  className="sdr-close"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                  aria-label="Close review form"
                >
                  ×
                </button>
              </div>

              <div className="sdr-selected-document">
                <span className="sdr-file-icon">
                  {selected.mime_type === "application/pdf" ? "PDF" : "DOC"}
                </span>
                <div>
                  <strong>{selected.title}</strong>
                  <span>{selected.student_name} · {selected.document_type}</span>
                  <small>{selected.original_filename}</small>
                </div>
              </div>

              <a
                className="sdr-modal-preview"
                href={selected.preview_url}
                target="_blank"
                rel="noreferrer"
              >
                Open document preview ↗
              </a>

              <form onSubmit={saveReview}>
                <label className="sdr-field-label" htmlFor="sdr-status">
                  Review decision
                </label>
                <select
                  id="sdr-status"
                  value={reviewStatus}
                  onChange={(event) => setReviewStatus(event.target.value)}
                >
                  <option value="Under Review">Under Review</option>
                  <option value="Revision Required">Revision Required</option>
                  <option value="Approved">Approved</option>
                </select>

                <label className="sdr-field-label" htmlFor="sdr-feedback">
                  Feedback for student
                </label>
                <textarea
                  id="sdr-feedback"
                  rows="6"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Provide specific comments, corrections, and next steps..."
                  required
                />

                {notice && <div className="sdr-notice" role="status">{notice}</div>}

                <div className="sdr-modal-actions">
                  <button
                    type="button"
                    className="sdr-cancel"
                    onClick={() => setSelected(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="sdr-save" disabled={saving}>
                    {saving ? "Saving review…" : "Save review"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <footer className="sdr-footer">
          <span>© {new Date().getFullYear()} AcaTrace</span>
          <span>Supporting better research supervision</span>
        </footer>
      </main>
    </div>
  );
}

export default SupervisorDocumentReviews;
