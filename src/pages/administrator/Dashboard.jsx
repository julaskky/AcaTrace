
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

const API = "http://localhost/acatrace/api";

function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectsError, setProjectsError] = useState("");

  const role = user?.role?.toLowerCase() || "";
  const roleName =
    role === "admin"
      ? "Administrator"
      : role === "supervisor"
        ? "Supervisor"
        : "Student";

  // Load the logged-in user's dashboard information.
  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API}/dashboard.php`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          navigate("/login");
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load dashboard.");
        }

        if (cancelled) return;

        setUser(data.user || null);
        setStatistics(data.statistics || {});

        // Load meetings for the currently logged-in user's role.
        try {
          const meetingResponse = await fetch(`${API}/meetings.php`, {
            method: "GET",
            credentials: "include",
          });

          const meetingData = await meetingResponse.json();

          if (cancelled) return;

          if (meetingResponse.ok && meetingData.success) {
            setStatistics((current) => ({
              ...current,
              meetings: (meetingData.meetings || []).length,
            }));
          }
        } catch {
          // Keep the dashboard usable if the meetings request fails.
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to connect to the server.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Load research projects visible to the logged-in user.
  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const response = await fetch(`${API}/research_projects.php`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          navigate("/login");
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load research projects.");
        }

        if (!cancelled) {
          setProjects(data.projects || []);
        }
      } catch (err) {
        if (!cancelled) {
          setProjectsError(err.message || "Unable to load research projects.");
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Sign out and return to the login page.
  async function handleLogout() {
    try {
      await fetch(`${API}/logout.php`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Return to login even if the logout request cannot be completed.
    }

    navigate("/login");
  }

  function displayNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatDate(value) {
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

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">Loading your dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
          <p>
            <Link to="/login">Return to Login</Link>
          </p>
        </div>
      </div>
    );
  }

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

  const displayName = fullName || user?.name || user?.email || "User";

  const statCards = [
    {
      label: "Research Projects",
      value:
        statistics.total_projects ??
        statistics.projects ??
        projects.length,
      icon: "📚",
    },
    {
      label: "Active Projects",
      value: statistics.active_projects ?? 0,
      icon: "🔬",
    },
    {
      label: "Pending Milestones",
      value: statistics.pending_milestones ?? 0,
      icon: "🎯",
    },
    {
      label: "Meetings",
      value: statistics.meetings ?? 0,
      icon: "📅",
    },
  ];

  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <Link to="/" className="dashboard-logo">
            AcaTrace
          </Link>
          <p>Research Management</p>
        </div>

        <div className="dashboard-user">
          <div className="dashboard-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{displayName}</strong>
            <span>{roleName}</span>
          </div>
        </div>

        <nav className="dashboard-nav">
          <p className="dashboard-nav-heading">MAIN MENU</p>

          <Link to="/dashboard" className="active">
            <span>▦</span>
            Dashboard
          </Link>

          <Link to="/research">
            <span>📚</span>
            My Research
          </Link>

          <Link to="/milestones">
            <span>🎯</span>
            Milestones
          </Link>

          <Link to="/meetings">
            <span>📅</span>
            Meetings
          </Link>

          <Link to="/tasks">
  		<span>✓</span>
  		Tasks
	</Link>
          
	<Link to="/my-progress">
  		<span>📈</span>
  		My Progress
	</Link>


          <p className="dashboard-nav-heading">ACCOUNT</p>

          <Link to="/profile">
            <span>👤</span>
            My Profile
          </Link>

          <div className="dashboard-nav-disabled" title="Coming soon">
            <span>⚙</span>
            Settings
            <small>Coming soon</small>
          </div>

          {role === "admin" && (
            <>
              <p className="dashboard-nav-heading">ADMINISTRATION</p>

              <Link to="/admin/institutions">
                <span>🏛</span>
                Institutions
              </Link>

              <Link to="/admin/departments">
                <span>🏢</span>
                Departments
              </Link>

              <Link to="/admin/supervisors">
                <span>👥</span>
                Supervisors
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          className="dashboard-logout"
          onClick={handleLogout}
        >
          <span>↪</span>
          Sign Out
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, {displayName}!</p>
          </div>

          <Link to="/profile" className="dashboard-profile-link">
            My Profile
          </Link>
        </header>

        <section className="dashboard-welcome">
          <div>
            <h2>Your research journey starts here.</h2>
            <p>
              Manage your research projects, track milestones, and stay
              connected with your research team.
            </p>
            <Link to="/research" className="dashboard-primary-button">
              View Research Projects
            </Link>
          </div>
        </section>

        <section className="dashboard-statistics">
          {statCards.map((stat) => (
            <div className="dashboard-stat-card" key={stat.label}>
              <div className="dashboard-stat-icon">{stat.icon}</div>
              <div>
                <p>{stat.label}</p>
                <h3>{displayNumber(stat.value)}</h3>
              </div>
            </div>
          ))}
        </section>

        <section className="dashboard-content-section">
          <div className="dashboard-section-header">
            <div>
              <h2>My Research Projects</h2>
              <p>Review your latest research activities.</p>
            </div>

            <Link to="/research" className="dashboard-view-all">
              View All
            </Link>
          </div>

          {projectsLoading ? (
            <p className="dashboard-message">Loading research projects...</p>
          ) : projectsError ? (
            <div className="dashboard-error">
              <p>{projectsError}</p>
              <Link to="/research">Open My Research</Link>
            </div>
          ) : projects.length === 0 ? (
            <div className="dashboard-empty">
              <div className="dashboard-empty-icon">📚</div>
              <h3>No research projects yet</h3>
              <p>
                Your research projects will appear here when they are
                available.
              </p>
              <Link to="/research" className="dashboard-primary-button">
                Go to My Research
              </Link>
            </div>
          ) : (
            <div className="dashboard-project-list">
              {projects.slice(0, 3).map((project) => (
                <article className="dashboard-project-card" key={project.id}>
                  <div className="dashboard-project-heading">
                    <h3>{project.title}</h3>
                    <span
                      className={`dashboard-project-status status-${String(
                        project.status || "unknown"
                      )
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {project.status || "Unspecified"}
                    </span>
                  </div>

                  {project.research_area && (
                    <p className="dashboard-project-area">
                      {project.research_area}
                    </p>
                  )}

                  <p className="dashboard-project-description">
                    {project.description
                      ? project.description.length > 180
                        ? `${project.description.slice(0, 180)}...`
                        : project.description
                      : "No project description has been added."}
                  </p>

                  <div className="dashboard-project-meta">
                    <span>
                      <strong>Supervisor:</strong>{" "}
                      {project.supervisor_name || "Not assigned"}
                    </span>

                    <span>
                      <strong>Expected completion:</strong>{" "}
                      {formatDate(project.expected_completion_date)}
                    </span>
                  </div>
                </article>
              ))}

              {projects.length > 3 && (
                <Link to="/research" className="dashboard-view-all">
                  View all {projects.length} projects
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="dashboard-quick-links">
          <div className="dashboard-section-header">
            <div>
              <h2>Quick Access</h2>
              <p>Go directly to the tools you need.</p>
            </div>
          </div>

          <div className="dashboard-quick-link-grid">
            <Link to="/research" className="dashboard-quick-link">
              <span>📚</span>
              <div>
                <strong>Research Projects</strong>
                <p>Review your research work.</p>
              </div>
            </Link>

            <Link to="/milestones" className="dashboard-quick-link">
              <span>🎯</span>
              <div>
                <strong>Milestones</strong>
                <p>Track research progress.</p>
              </div>
            </Link>

            <Link to="/meetings" className="dashboard-quick-link">
              <span>📅</span>
              <div>
                <strong>Meetings</strong>
                <p>View and manage research meetings.</p>
              </div>
            </Link>


		<Link to="/tasks" className="dashboard-quick-link">
  			<span>✓</span>
 			 <div>
    			<strong>Tasks</strong>
   			<p>View assigned tasks and update your progress.</p>
  			</div>
		</Link>

            <Link to="/profile" className="dashboard-quick-link">
              <span>👤</span>
              <div>
                <strong>My Profile</strong>
                <p>Review your account information.</p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;