import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../../styles/supervisor/supervisor-dashboard.css";

const API_URL = "http://localhost/acatrace/api/supervisor/dashboard.php";
const NOTIFICATIONS_API =
  "http://localhost/acatrace/api/supervisor/notifications.php";

const menus = [
  { label: "Dashboard", icon: "▦", path: "/supervisor/dashboard" },
  { label: "Supervised Research", icon: "◫", path: "/supervisor/research" },
  { label: "Milestones", icon: "⚑", path: "/supervisor/milestones" },
  { label: "Meetings", icon: "▣", path: "/supervisor/meetings" },
  { label: "Tasks", icon: "✓", path: "/supervisor/tasks" },
  { label: "Student Progress", icon: "▥", path: "/supervisor/progress" },
  { label: "Document Reviews", icon: "▤", path: "/supervisor/documents" },
  { label: "Thesis Defense", icon: "◇", path: "/supervisor/thesis-defense" },
  { label: "Notifications", icon: "♧", path: "/supervisor/notifications" },
];

function SupervisorDashboard() {


		const handleLogout = async () => {
  try {
    await fetch("http://localhost/acatrace/api/student/logout.php", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    window.location.href = "/login";
  }
};


  const location = useLocation();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load dashboard data.
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch(API_URL, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load dashboard."
          );
        }

        if (active) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Unable to connect to the server."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  // Load and refresh unread notification count.
  useEffect(() => {
    let active = true;

    async function loadUnreadNotifications() {
      try {
        const response = await fetch(NOTIFICATIONS_API, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error("Unable to load notifications.");
        }

        if (active) {
          setUnreadCount(
            Math.max(0, Number(result.unread_count) || 0)
          );
        }
      } catch (err) {
        // Notification errors should not interrupt the dashboard.
        console.error("Notification count could not be loaded:", err);
      }
    }

    loadUnreadNotifications();

    const intervalId = setInterval(
      loadUnreadNotifications,
      30000
    );

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [location.pathname]);

  // Close the mobile navigation after changing pages.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const stats = data?.stats;

  const cards = [
    {
      label: "Supervised Students",
      value: stats?.students ?? "—",
      icon: "♙",
      tone: "violet",
      note: "Students assigned to you",
    },
    {
      label: "Research Projects",
      value: stats?.projects ?? "—",
      icon: "◫",
      tone: "blue",
      note: "Your research portfolio",
    },
    {
      label: "Pending Tasks",
      value: stats?.pending_tasks ?? "—",
      icon: "✓",
      tone: "amber",
      note: "Awaiting completion",
    },
    {
      label: "Upcoming Meetings",
      value: stats?.upcoming_meetings ?? "—",
      icon: "▣",
      tone: "green",
      note: "Scheduled meetings",
    },
    {
      label: "Outstanding Milestones",
      value: stats?.outstanding_milestones ?? "—",
      icon: "⚑",
      tone: "rose",
      note: "Progress to follow up",
    },
    {
      label: "Documents to Review",
      value: stats?.documents_to_review ?? "—",
      icon: "▤",
      tone: "teal",
      note: "Awaiting your review",
    },
  ];

  return (
    <div className="sup-layout">
      {mobileOpen && (
        <button
          type="button"
          className="sup-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sup-sidebar ${
          mobileOpen ? "sup-sidebar-open" : ""
        }`}
      >
        <Link to="/supervisor/dashboard" className="sup-brand">
          <span className="sup-brand-mark">A</span>

          <span className="sup-brand-name">
            AcaTrace
            <small>RESEARCH MANAGEMENT</small>
          </span>
        </Link>

        <div className="sup-workspace-label">
          SUPERVISOR WORKSPACE
        </div>

        <nav
          className="sup-nav"
          aria-label="Supervisor navigation"
        >
          {menus.map((item) => {
            const active = location.pathname === item.path;
            const isNotifications =
              item.label === "Notifications";

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sup-nav-item ${
                  active ? "sup-nav-active" : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="sup-nav-icon">
                  {item.icon}
                </span>

                <span className="sup-nav-label">
                  {item.label}
                </span>

                {isNotifications && unreadCount > 0 && (
                  <span
                    className="sup-notification-badge"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}

                {active && <span className="sup-active-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="sup-sidebar-bottom">
          <div className="sup-sidebar-divider" />
          <div className="sup-sidebar-section">ACCOUNT</div>

          <Link to="/supervisor/profile" className="sup-nav-item">
            <span className="sup-nav-icon">◎</span>
            <span className="sup-nav-label">My Profile</span>
          </Link>

          <button
  type="button"
  className="sup-nav-item"
  onClick={handleLogout}
>
  <span className="sup-nav-icon">↪</span>
  <span className="sup-nav-label">Logout</span>
</button>


	


          <div className="sup-user-card">
            <div className="sup-avatar">S</div>

            <div className="sup-user-details">
              <strong>Supervisor</strong>
              <span>AcaTrace account</span>
            </div>

            <span
              className="sup-user-status"
              title="Account session"
            />
          </div>
        </div>
      </aside>

      <div className="sup-main">
        <header className="sup-topbar">
          <button
            type="button"
            className="sup-menu-toggle"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>

          <div className="sup-breadcrumb">
            <span>Workspace</span>
            <span className="sup-breadcrumb-slash">/</span>
            <strong>Dashboard</strong>
          </div>

          <div className="sup-topbar-right">
            <Link
              to="/supervisor/notifications"
              className="sup-notification-link"
              aria-label={`Notifications, ${unreadCount} unread`}
              title="View notifications"
            >
              <span aria-hidden="true">♧</span>

              {unreadCount > 0 && (
                <span className="sup-notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            <span className="sup-online-indicator" />
            <span className="sup-online-text">
              Supervisor Portal
            </span>
            <div className="sup-top-avatar">S</div>
          </div>
        </header>

        <main className="sup-content">
          <div className="sup-page-heading">
            <div>
              <span className="sup-eyebrow">
                YOUR ACADEMIC WORKSPACE
              </span>
              <h1>Supervisor Dashboard</h1>
              <p>
                Oversee research, support students, and keep
                progress moving.
              </p>
            </div>

            <span className="sup-date-chip">
              {new Date().toLocaleDateString("en-ZA", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {error && (
            <div className="sup-error" role="alert">
              <strong>Dashboard data could not be loaded.</strong>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          )}

          <section className="sup-welcome">
            <div className="sup-welcome-copy">
              <span className="sup-welcome-tag">
                SUPERVISION OVERVIEW
              </span>
              <h2>Welcome to your research workspace</h2>
              <p>
                Your projects, student activity, and upcoming
                responsibilities come together in one place.
              </p>
            </div>

            <div className="sup-welcome-art" aria-hidden="true">
              <span className="sup-art-orbit sup-orbit-one" />
              <span className="sup-art-orbit sup-orbit-two" />
              <span className="sup-art-star">✦</span>
              <span className="sup-art-book">▤</span>
            </div>
          </section>

          <div className="sup-section-heading">
            <div>
              <h2>At a glance</h2>
              <p>Your current supervision activity</p>
            </div>
          </div>

          {loading ? (
            <div className="sup-loading">
              Loading your research overview…
            </div>
          ) : (
            <section className="sup-stat-grid">
              {cards.map((card) => (
                <article
                  className="sup-stat-card"
                  key={card.label}
                >
                  <div
                    className={`sup-stat-icon ${card.tone}`}
                  >
                    {card.icon}
                  </div>
                  <div className="sup-stat-number">
                    {card.value}
                  </div>
                  <h3>{card.label}</h3>
                  <p>{card.note}</p>
                </article>
              ))}
            </section>
          )}

          <section className="sup-lower-grid">
            <article className="sup-panel">
              <div className="sup-panel-heading">
                <div>
                  <span className="sup-panel-kicker">
                    YOUR PORTFOLIO
                  </span>
                  <h2>Assigned Research Projects</h2>
                </div>
                <span className="sup-count">
                  {data?.projects?.length ?? 0}
                </span>
              </div>

              {!data?.projects?.length ? (
                <div className="sup-empty">
                  <span className="sup-empty-icon">◫</span>
                  <strong>No research projects yet</strong>
                  <p>
                    Projects assigned to you will appear here.
                  </p>
                </div>
              ) : (
                data.projects.map((project) => {
                  const status = project.status || "Pending";

                  return (
                    <div
                      className="sup-project-row"
                      key={project.id}
                    >
                      <div className="sup-project-icon">R</div>

                      <div className="sup-project-info">
                        <h3>{project.title}</h3>
                        <p>
                          {project.student_first_name}{" "}
                          {project.student_last_name}
                          {project.research_area
                            ? ` · ${project.research_area}`
                            : ""}
                        </p>

                        <div className="sup-project-meta">
                          <span
                            className={`sup-status status-${status
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {status}
                          </span>

                          <span>
                            Target:{" "}
                            {project.expected_completion_date
                              ? new Date(
                                  `${project.expected_completion_date}T00:00:00`
                                ).toLocaleDateString("en-ZA")
                              : "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </article>

            <article className="sup-panel">
              <div className="sup-panel-heading">
                <div>
                  <span className="sup-panel-kicker">
                    COMING UP
                  </span>
                  <h2>Upcoming Meetings</h2>
                </div>
                <span className="sup-count">
                  {data?.meetings?.length ?? 0}
                </span>
              </div>

              {!data?.meetings?.length ? (
                <div className="sup-empty">
                  <span className="sup-empty-icon">▣</span>
                  <strong>Your schedule is clear</strong>
                  <p>
                    Upcoming supervision meetings will appear
                    here.
                  </p>
                </div>
              ) : (
                data.meetings.map((meeting) => {
                  const meetingDate = meeting.meeting_date
                    ? new Date(
                        `${meeting.meeting_date}T00:00:00`
                      )
                    : null;

                  return (
                    <div
                      className="sup-meeting-row"
                      key={meeting.id}
                    >
                      <div className="sup-meeting-date">
                        <strong>
                          {meetingDate &&
                          !Number.isNaN(meetingDate.getTime())
                            ? meetingDate.getDate()
                            : "—"}
                        </strong>
                        <span>
                          {meetingDate &&
                          !Number.isNaN(meetingDate.getTime())
                            ? meetingDate.toLocaleDateString(
                                "en-ZA",
                                { month: "short" }
                              )
                            : "Date"}
                        </span>
                      </div>

                      <div>
                        <h3>{meeting.title}</h3>
                        <p>
                          {meeting.student_first_name}{" "}
                          {meeting.student_last_name}
                        </p>
                        <span className="sup-meeting-time">
                          {meeting.start_time?.slice(0, 5)} ·{" "}
                          {meeting.meeting_mode}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </article>
          </section>

          <section className="sup-panel sup-milestones-panel">
            <div className="sup-panel-heading">
              <div>
                <span className="sup-panel-kicker">
                  RESEARCH TRACKING
                </span>
                <h2>Milestone Overview</h2>
              </div>
              <span className="sup-count">
                {data?.milestones?.length ?? 0}
              </span>
            </div>

            {!data?.milestones?.length ? (
              <div className="sup-empty-inline">
                No research milestones have been recorded yet.
              </div>
            ) : (
              data.milestones.map((milestone) => {
                const status = milestone.status || "Pending";

                return (
                  <div
                    className="sup-milestone-row"
                    key={milestone.id}
                  >
                    <span className="sup-milestone-mark">✦</span>

                    <div className="sup-milestone-info">
                      <strong>{milestone.title}</strong>
                      <span>{milestone.research_title}</span>
                    </div>

                    <span className="sup-milestone-due">
                      {milestone.due_date || "No due date"}
                    </span>

                    <span
                      className={`sup-status status-${status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })
            )}
          </section>

          <footer className="sup-footer">
            <span>© {new Date().getFullYear()} AcaTrace</span>
            <span>
              Supporting better research supervision
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default SupervisorDashboard;
