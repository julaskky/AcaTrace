import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/supervisor/supervisor-notifications.css";

const API_URL =
  "http://localhost/acatrace/api/supervisor/notifications.php";

const CATEGORIES = [
  "All",
  "Thesis Defense",
  "Document",
  "Meeting",
  "Milestone",
  "Task",
  "General",
];

function SupervisorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch(`${API_URL}?limit=100`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load notifications."
        );
      }

      setNotifications(
        Array.isArray(result.notifications)
          ? result.notifications
          : []
      );

      setUnreadCount(Number(result.unread_count || 0));
      setError("");
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to the notifications API. Check XAMPP."
          : err.message || "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesCategory =
        category === "All" ||
        notification.notification_type === category;

      const isRead =
        Number(notification.is_read) === 1 ||
        notification.is_read === true;

      const matchesStatus =
        status === "all" ||
        (status === "unread" && !isRead) ||
        (status === "read" && isRead);

      return matchesCategory && matchesStatus;
    });
  }, [notifications, category, status]);

  async function performAction(action, notificationId = null) {
    setActionLoading(true);
    setError("");

    try {
      const payload = { action };

      if (notificationId !== null) {
        payload.notification_id = Number(notificationId);
      }

      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to update notification."
        );
      }

      await loadNotifications();
    } catch (err) {
      setError(
        err.message || "Unable to update notification."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function iconFor(type) {
    const icons = {
      Submission: "⇧",
      Deadline: "◷",
      Feedback: "✎",
      Message: "✉",
      Meeting: "▣",
      "Meeting Request": "▣",
      "Student Progress": "↗",
      "System Announcement": "◈",
      Milestone: "⚑",
      Task: "✓",
      Document: "▤",
      "Thesis Defense": "◇",
      General: "♧",
    };

    return icons[type] || "♧";
  }

  function priorityClass(priority) {
    const value = String(priority || "Normal").toLowerCase();

    return ["normal", "high", "urgent"].includes(value)
      ? value
      : "normal";
  }

  return (
    <div className="sup-notifications-page">
      <header className="sup-notifications-header">
        <Link
          to="/supervisor/dashboard"
          className="sup-notifications-brand"
        >
          <span className="sup-notifications-brand-mark">A</span>
          <span className="sup-notifications-brand-name">
            AcaTrace
            <small>RESEARCH MANAGEMENT</small>
          </span>
        </Link>

        <Link
          to="/supervisor/dashboard"
          className="sup-notifications-back"
        >
          <span aria-hidden="true">←</span> Back to Dashboard
        </Link>
      </header>

      <main className="sup-notifications-main">
        <section className="sup-notifications-hero">
          <div className="sup-notifications-hero-copy">
            <span className="sup-notifications-eyebrow">
              SUPERVISOR WORKSPACE
            </span>

            <h1>Notifications</h1>

            <p>
              Stay informed about defense requests, document
              submissions, and important research updates.
            </p>
          </div>

          <div className="sup-notifications-hero-icon">
            <span aria-hidden="true">♧</span>

            {unreadCount > 0 && (
              <span className="sup-notifications-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </section>

        <section className="sup-notifications-summary">
          <div className="sup-notifications-stat">
            <span className="sup-notifications-stat-icon">▤</span>
            <div>
              <span>Total notifications</span>
              <strong>{notifications.length}</strong>
            </div>
          </div>

          <div className="sup-notifications-stat">
            <span className="sup-notifications-stat-icon">●</span>
            <div>
              <span>Unread</span>
              <strong>{unreadCount}</strong>
            </div>
          </div>

          <button
            type="button"
            className="sup-notifications-mark-all"
            onClick={() => performAction("mark_all_read")}
            disabled={
              actionLoading || unreadCount === 0 || loading
            }
          >
            {actionLoading ? "Updating…" : "Mark all as read"}
          </button>
        </section>

        {error && (
          <div
            className="sup-notifications-error"
            role="alert"
          >
            <div>
              <strong>Unable to complete the request</strong>
              <p>{error}</p>
            </div>

            <button
              type="button"
              onClick={() => loadNotifications(true)}
              disabled={loading || actionLoading}
            >
              Retry
            </button>
          </div>
        )}

        <section className="sup-notifications-inbox">
          <div className="sup-notifications-inbox-heading">
            <div>
              <span className="sup-notifications-section-label">
                YOUR INBOX
              </span>
              <h2>Research activity</h2>
              <p>
                Review updates and keep track of student activity.
              </p>
            </div>

            <span className="sup-notifications-count">
              {filteredNotifications.length}
            </span>
          </div>

          <div className="sup-notifications-filters">
            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item === "All" ? "All categories" : item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Read status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="all">All notifications</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </select>
            </label>

            <button
              type="button"
              className="sup-notifications-refresh"
              onClick={() => loadNotifications(true)}
              disabled={loading || actionLoading}
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div className="sup-notifications-state">
              <span className="sup-notifications-state-icon">
                ◌
              </span>
              <h3>Loading notifications</h3>
              <p>Retrieving your latest updates…</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="sup-notifications-state">
              <span className="sup-notifications-state-icon">
                ♧
              </span>
              <h3>No notifications found</h3>
              <p>
                No notifications match your current filters.
                New updates will appear here when generated.
              </p>

              {(category !== "All" || status !== "all") && (
                <button
                  type="button"
                  className="sup-notifications-retry"
                  onClick={() => {
                    setCategory("All");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="sup-notifications-list">
              {filteredNotifications.map((notification) => {
                const isUnread =
                  Number(notification.is_read) === 0;

                const priority = priorityClass(
                  notification.priority
                );

                return (
                  <article
                    key={notification.id}
                    className={`sup-notifications-item ${
                      isUnread ? "is-unread" : "is-read"
                    }`}
                  >
                    <div className="sup-notifications-item-icon">
                      {iconFor(notification.notification_type)}
                    </div>

                    <div className="sup-notifications-item-body">
                      <div className="sup-notifications-item-heading">
                        <h3>{notification.title}</h3>

                        {isUnread && (
                          <span className="sup-notifications-unread-label">
                            Unread
                          </span>
                        )}
                      </div>

                      <p className="sup-notifications-message">
                        {notification.message}
                      </p>

                      <div className="sup-notifications-meta">
                        <span className="sup-notifications-type">
                          {notification.notification_type || "General"}
                        </span>

                        <span
                          className={`sup-notifications-priority priority-${priority}`}
                        >
                          {notification.priority || "Normal"} priority
                        </span>

                        <span>
                          {formatDate(notification.created_at)}
                        </span>
                      </div>

                      <div className="sup-notifications-actions">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() =>
                              performAction(
                                "mark_read",
                                notification.id
                              )
                            }
                            disabled={actionLoading}
                          >
                            {actionLoading
                              ? "Updating…"
                              : "Mark as read"}
                          </button>
                        )}

                        {isUnread && (
                          <span className="sup-notifications-unread-hint">
                            Requires your attention
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="sup-notifications-footer">
          <span>© {new Date().getFullYear()} AcaTrace</span>
          <span>Supporting better research supervision</span>
        </footer>
      </main>
    </div>
  );
}

export default SupervisorNotifications;
