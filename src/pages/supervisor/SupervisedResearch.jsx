import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/supervisor/supervised-research.css";

const API_URL =
  "http://localhost/acatrace/api/supervisor/research.php";

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}`.slice(0, 10) + "T00:00:00");

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function statusClass(status) {
  return `sr-status sr-status-${String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

export default function SupervisedResearch() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load projects.");
        }

        if (!cancelled) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to connect to the server.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = useMemo(
    () => [
      "All",
      ...new Set(projects.map((p) => p.status).filter(Boolean)),
    ],
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.filter((p) => {
      const studentName =
        `${p.first_name || ""} ${p.last_name || ""}`.trim();

      const values = [
        p.title,
        p.research_area,
        p.status,
        studentName,
        p.email,
        p.student_number,
        p.programme,
      ];

      const matchesSearch =
        !term ||
        values.some((value) =>
          String(value || "").toLowerCase().includes(term)
        );

      return (
        matchesSearch &&
        (statusFilter === "All" || p.status === statusFilter)
      );
    });
  }, [projects, search, statusFilter]);

  const activeCount = projects.filter(
    (p) => String(p.status).toLowerCase() === "active"
  ).length;

  const studentCount = new Set(
    projects.map((p) => p.student_id)
  ).size;

  return (
    <div className="sr-app sr-full-page">
      <header className="sr-full-header">
        <Link to="/supervisor/dashboard" className="sr-full-brand">
          <span className="sr-full-brand-mark">A</span>
          <span>
            <strong>AcaTrace</strong>
            <small>Research Management</small>
          </span>
        </Link>

        <div className="sr-full-header-right">
          <span className="sr-full-current">Supervisor Workspace</span>
          <Link
            to="/supervisor/dashboard"
            className="sr-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="sr-full-main">
        <section className="sr-page-heading">
          <div>
            <div className="sr-eyebrow">RESEARCH MANAGEMENT</div>
            <h1>Supervised Research</h1>
            <p>
              View your assigned research projects and the students
              behind them.
            </p>
          </div>

          <div className="sr-heading-icon">◫</div>
        </section>

        <section className="sr-welcome">
          <div className="sr-welcome-text">
            <span className="sr-welcome-label">
              YOUR RESEARCH PORTFOLIO
            </span>
            <h2>Every project has a path forward.</h2>
            <p>
              Review project details, track research status, and find
              student information in one place.
            </p>
          </div>

          <div className="sr-welcome-art" aria-hidden="true">
            <span>✧</span>
            <span>◈</span>
            <span>⌁</span>
          </div>
        </section>

        <section className="sr-stats">
          <article className="sr-stat-card">
            <span className="sr-stat-icon sr-icon-purple">◫</span>
            <div>
              <p>Total projects</p>
              <strong>{loading ? "—" : projects.length}</strong>
              <small>Assigned to you</small>
            </div>
          </article>

          <article className="sr-stat-card">
            <span className="sr-stat-icon sr-icon-green">↗</span>
            <div>
              <p>Active projects</p>
              <strong>{loading ? "—" : activeCount}</strong>
              <small>Currently in progress</small>
            </div>
          </article>

          <article className="sr-stat-card">
            <span className="sr-stat-icon sr-icon-blue">♙</span>
            <div>
              <p>Research students</p>
              <strong>{loading ? "—" : studentCount}</strong>
              <small>With assigned projects</small>
            </div>
          </article>
        </section>

        <section className="sr-project-section">
          <div className="sr-section-heading">
            <div>
              <h2>Research projects</h2>
              <p>Explore and filter your assigned projects.</p>
            </div>

            <span className="sr-count">
              {loading ? "Loading…" : `${filteredProjects.length} shown`}
            </span>
          </div>

          <div className="sr-toolbar">
            <label className="sr-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search project, student, programme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter projects by status"
              className="sr-filter"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "All" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="sr-error">
              <strong>Unable to load projects</strong>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="sr-empty-state">
              <div className="sr-spinner" />
              <strong>Loading your research portfolio</strong>
              <p>Retrieving your assigned research projects…</p>
            </div>
          ) : !error && filteredProjects.length === 0 ? (
            <div className="sr-empty-state">
              <div className="sr-empty-icon">◫</div>
              <strong>
                {projects.length
                  ? "No matching projects"
                  : "No research projects assigned yet"}
              </strong>
              <p>
                {projects.length
                  ? "Try another search term or status filter."
                  : "Projects assigned to you will appear here."}
              </p>

              {(search || statusFilter !== "All") && (
                <button
                  type="button"
                  className="sr-reset-button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("All");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="sr-project-grid">
              {filteredProjects.map((project) => {
                const studentName =
                  `${project.first_name || ""} ${project.last_name || ""}`.trim() ||
                  "Student name unavailable";

                return (
                  <article
                    className="sr-project-card"
                    key={project.project_id}
                  >
                    <div className="sr-card-top">
                      <span className="sr-project-symbol">◈</span>
                      <span className={statusClass(project.status)}>
                        {project.status || "Unspecified"}
                      </span>
                    </div>

                    <div className="sr-project-category">
                      {project.research_area || "Research project"}
                    </div>

                    <h3>{project.title || "Untitled research project"}</h3>

                    <p className="sr-project-description">
                      {project.description ||
                        "No project description has been provided."}
                    </p>

                    <div className="sr-student-block">
                      <div className="sr-student-avatar">
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="sr-student-info">
                        <strong>{studentName}</strong>
                        <span>
                          {project.student_number ||
                            "Student number not set"}
                        </span>
                      </div>
                    </div>

                    <div className="sr-project-meta">
                      <div>
                        <span>Programme</span>
                        <strong>
                          {project.programme || "Not specified"}
                        </strong>
                      </div>
                      <div>
                        <span>Expected completion</span>
                        <strong>
                          {formatDate(project.expected_completion_date)}
                        </strong>
                      </div>
                    </div>

                    <div className="sr-card-footer">
                      <span>
                        {project.academic_level ||
                          "Academic level not set"}
                      </span>
                      <span className="sr-project-id">
                        Project #{project.project_id}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="sr-footer">
          <span>© {new Date().getFullYear()} AcaTrace</span>
          <span>Supporting better research journeys.</span>
        </footer>
      </main>
    </div>
  );
}
