
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/student/research-projects.css";

const API_ROOT = "http://localhost/acatrace/api";
const API = `${API_ROOT}/student`;

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(`${value}`.slice(0, 10) + "T00:00:00");

  if (Number.isNaN(date.getTime())) return "Not specified";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status) {
  return String(status || "Proposed")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "The server returned an invalid response. Please check the PHP API."
    );
  }
}

export default function ResearchProjects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Confirm that the logged-in user is a student.
      const dashboardResponse = await fetch(`${API}/dashboard.php`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const dashboardData = await readJson(dashboardResponse);

      if (
        dashboardResponse.status === 401 ||
        dashboardResponse.status === 403
      ) {
        navigate("/login", { replace: true });
        return;
      }

      if (!dashboardResponse.ok || !dashboardData.success) {
        throw new Error(
          dashboardData.message || "Unable to verify your student account."
        );
      }

      const userRole = String(
        dashboardData.user?.role || ""
      ).toLowerCase();

      if (userRole !== "student") {
        navigate("/login", { replace: true });
        return;
      }

      // The backend returns only projects belonging to this student.
      const response = await fetch(`${API}/research_projects.php`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readJson(response);

      if (response.status === 401 || response.status === 403) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load your research projects."
        );
      }

      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="research-projects-page">
      <div className="research-projects-header">
        <div>
          <p className="research-projects-eyebrow">STUDENT PORTAL</p>
          <h1>My Research</h1>
          <p className="research-projects-subtitle">
            View your assigned research projects, project details, and
            supervision information.
          </p>
        </div>

        <Link
          to="/student/dashboard"
          className="research-projects-back-link"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="research-projects-summary">
        <div className="research-projects-summary-card">
          <span className="research-projects-summary-label">
            Assigned Projects
          </span>
          <strong>
            {loading ? "—" : projects.length}
          </strong>
        </div>

        <div className="research-projects-summary-card">
          <span className="research-projects-summary-label">
            Active Projects
          </span>
          <strong>
            {loading
              ? "—"
              : projects.filter(
                  (project) =>
                    String(project.status).toLowerCase() === "active"
                ).length}
          </strong>
        </div>

        <div className="research-projects-summary-card">
          <span className="research-projects-summary-label">
            Completed Projects
          </span>
          <strong>
            {loading
              ? "—"
              : projects.filter(
                  (project) =>
                    String(project.status).toLowerCase() === "completed"
                ).length}
          </strong>
        </div>
      </div>

      <div className="research-projects-section-header">
        <div>
          <h2>Your Research Projects</h2>
          <p>Project information provided by your research team.</p>
        </div>

        <button
          type="button"
          className="research-projects-refresh-button"
          onClick={loadProjects}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="research-projects-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadProjects}>
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="research-projects-state">
          <div className="research-projects-loader" />
          <p>Loading your research projects...</p>
        </div>
      ) : !error && projects.length === 0 ? (
        <div className="research-projects-empty">
          <div className="research-projects-empty-icon">📚</div>
          <h2>No Research Projects Assigned Yet</h2>
          <p>
            Your research projects will appear here when they have been
            assigned to your student account.
          </p>
          <Link to="/student/dashboard">
            Return to Dashboard
          </Link>
        </div>
      ) : (
        !error && (
          <div className="research-projects-grid">
            {projects.map((project) => (
              <article
                className="research-project-card"
                key={project.id}
              >
                <div className="research-project-card-top">
                  <span className="research-project-area">
                    {project.research_area || "Research"}
                  </span>

                  <span
                    className={`research-project-status status-${getStatusClass(
                      project.status
                    )}`}
                  >
                    {project.status || "Proposed"}
                  </span>
                </div>

                <h3>{project.title}</h3>

                <p className="research-project-description">
                  {project.description ||
                    "No project description has been provided yet."}
                </p>

                <div className="research-project-details">
                  <div className="research-project-detail">
                    <span className="research-project-detail-label">
                      <span aria-hidden="true">👤</span> Supervisor
                    </span>
                    <strong>
                      {project.supervisor_name || "Not yet assigned"}
                    </strong>
                  </div>

                  <div className="research-project-detail">
                    <span className="research-project-detail-label">
                      <span aria-hidden="true">📅</span> Start Date
                    </span>
                    <strong>{formatDate(project.start_date)}</strong>
                  </div>

                  <div className="research-project-detail">
                    <span className="research-project-detail-label">
                      <span aria-hidden="true">🎯</span> Expected Completion
                    </span>
                    <strong>
                      {formatDate(project.expected_completion_date)}
                    </strong>
                  </div>
                </div>

                {project.methodology && (
                  <div className="research-project-methodology">
                    <h4>Methodology</h4>
                    <p>{project.methodology}</p>
                  </div>
                )}

                <div className="research-project-card-footer">
                  <span>Project ID: {project.id}</span>
                  <span>View only</span>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </div>
  );
}
