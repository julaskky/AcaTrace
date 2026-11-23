
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/student/my-documents.css";

const API = "http://localhost/acatrace/api/student";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MyDocuments() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Thesis Chapter");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState(null);
  const [refresh, setRefresh] = useState(0);

  async function request(endpoint, options = {}) {
    const response = await fetch(`${API}/${endpoint}`, {
      credentials: "include",
      ...options,
    });

    if (response.status === 401 || response.status === 403) {
      navigate("/login");
      throw new Error("Your session has expired. Please log in again.");
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "The request failed.");
    }

    return data;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [documentData, projectData] = await Promise.all([
          request("documents.php"),
          request("research_projects.php"),
        ]);

        if (!cancelled) {
          setDocuments(documentData.documents || []);
          setFeedback(documentData.feedback || []);
          setProjects(projectData.projects || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load your documents.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleUpload(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!file) {
      setError("Please select a document to upload.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The file must be smaller than 10 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("document_type", type);
    formData.append("research_project_id", projectId);
    formData.append("document", file);

    setUploading(true);

    try {
      const data = await request("documents.php", {
        method: "POST",
        body: formData,
      });

      setMessage(data.message || "Document uploaded successfully.");
      setTitle("");
      setType("Thesis Chapter");
      setProjectId("");
      setFile(null);

      const input = document.getElementById("document-file");
      if (input) input.value = "";

      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message || "Unable to upload the document.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(document) {
    setError("");
    setDownloadingId(document.id);

    try {
      const response = await fetch(
        `${API}/document_download.php?id=${encodeURIComponent(document.id)}`,
        { credentials: "include" }
      );

      if (response.status === 401 || response.status === 403) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(await response.text() || "Download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.original_filename || "document";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Unable to download this document.");
    } finally {
      setDownloadingId(null);
    }
  }

  const completedCount = documents.filter(
    (doc) => doc.status === "Approved"
  ).length;

  return (
    <main className="my-documents-page">
      <header className="my-documents-header">
        <div>
          <Link to="/student/dashboard" className="my-documents-back">
            ← Back to Dashboard
          </Link>
          <p className="my-documents-eyebrow">STUDENT WORKSPACE</p>
          <h1>My Documents</h1>
          <p className="my-documents-subtitle">
            Organise thesis chapters, submit research documents, and review
            your supervisor's feedback.
          </p>
        </div>
        <div className="my-documents-header-icon" aria-hidden="true">
          <span>▤</span>
        </div>
      </header>

      <section className="my-documents-stats">
        <article>
          <span className="my-documents-stat-icon">▤</span>
          <div><p>Total Documents</p><strong>{documents.length}</strong></div>
        </article>
        <article>
          <span className="my-documents-stat-icon">✓</span>
          <div><p>Approved</p><strong>{completedCount}</strong></div>
        </article>
        <article>
          <span className="my-documents-stat-icon">✎</span>
          <div><p>Feedback Items</p><strong>{feedback.length}</strong></div>
        </article>
      </section>

      {error && <div className="my-documents-alert error">{error}</div>}
      {message && <div className="my-documents-alert success">{message}</div>}

      <section className="my-documents-panel">
        <div className="my-documents-section-heading">
          <div>
            <h2>Upload a Document</h2>
            <p>Accepted formats: PDF, DOC, DOCX. Maximum file size: 10 MB.</p>
          </div>
          <span className="my-documents-heading-icon">↑</span>
        </div>

        <form onSubmit={handleUpload} className="my-documents-form">
          <label>
            Document title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Chapter 2 — Literature Review"
              maxLength={255}
              required
            />
          </label>

          <label>
            Document type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option>Thesis Chapter</option>
              <option>Research Proposal</option>
              <option>Research Paper</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Research project
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project selected</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>

          <label className="my-documents-file-field">
            Choose document
            <input
              id="document-file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              required
            />
            {file && <span className="my-documents-file-name">{file.name}</span>}
          </label>

          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload Document"}
          </button>
        </form>
      </section>

      <section className="my-documents-panel">
        <div className="my-documents-section-heading">
          <div>
            <h2>My Research Documents</h2>
            <p>Access your uploaded files and check their review status.</p>
          </div>
        </div>

        {loading ? (
          <p className="my-documents-empty">Loading your documents…</p>
        ) : documents.length === 0 ? (
          <div className="my-documents-empty">
            <span>▤</span>
            <h3>No documents uploaded yet</h3>
            <p>Your uploaded thesis chapters and research documents will appear here.</p>
          </div>
        ) : (
          <div className="my-documents-table-wrap">
            <table className="my-documents-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Research Project</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Size</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="my-documents-file-title">
                        <span>▤</span>
                        <div>
                          <strong>{doc.title}</strong>
                          <small>{doc.original_filename}</small>
                          <small>{doc.document_type}</small>
                        </div>
                      </div>
                    </td>
                    <td>{doc.project_title || "Not linked"}</td>
                    <td>
                      <span className={`my-documents-status status-${String(doc.status).toLowerCase().replace(/\s+/g, "-")}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>{formatDate(doc.uploaded_at)}</td>
                    <td>{formatSize(doc.file_size)}</td>
                    <td>
                      <button
                        className="my-documents-download"
                        type="button"
                        onClick={() => downloadDocument(doc)}
                        disabled={downloadingId === doc.id}
                      >
                        {downloadingId === doc.id ? "Preparing…" : "↓ Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="my-documents-panel">
        <div className="my-documents-section-heading">
          <div>
            <h2>Supervisor Feedback</h2>
            <p>Review comments and decisions on your submitted documents.</p>
          </div>
          <span className="my-documents-heading-icon">✎</span>
        </div>

        {loading ? (
          <p className="my-documents-empty">Loading feedback…</p>
        ) : feedback.length === 0 ? (
          <div className="my-documents-empty">
            <span>☏</span>
            <h3>No feedback yet</h3>
            <p>Supervisor comments will appear here when your documents are reviewed.</p>
          </div>
        ) : (
          <div className="my-documents-feedback-list">
            {feedback.map((item) => {
              const doc = documents.find(
                (entry) => Number(entry.id) === Number(item.document_id)
              );

              return (
                <article className="my-documents-feedback-card" key={item.id}>
                  <div className="my-documents-feedback-top">
                    <div>
                      <strong>{doc?.title || "Research document"}</strong>
                      <p>{item.supervisor_name || "Supervisor"} · {formatDate(item.created_at)}</p>
                    </div>
                    <span className={`my-documents-status status-${String(item.review_status).toLowerCase().replace(/\s+/g, "-")}`}>
                      {item.review_status}
                    </span>
                  </div>
                  <p className="my-documents-feedback-text">{item.feedback_text}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default MyDocuments;
