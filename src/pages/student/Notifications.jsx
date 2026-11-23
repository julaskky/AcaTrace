
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/student/notifications.css";

const API = "http://localhost/acatrace/api/student/notifications.php";

const icons = {
  General: "🔔",
  Meeting: "📅",
  Task: "✓",
  Milestone: "🎯",
  "Thesis Defense": "🎓",
  Document: "📄",
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("All");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API, { credentials: "include" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load notifications.");
      }

      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unread_count || 0));
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function performAction(action, id = null) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(id !== null ? { id } : {}) }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "The action could not be completed.");
      }

      setMessage(data.message || "Updated successfully.");
      await loadNotifications();
      return true;
    } catch (err) {
      setError(err.message || "Unable to update notifications.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(item) {
    if (!item.is_read) {
      const success = await performAction("mark_read", item.id);
      if (!success) return;
    }

    const target = item.action_url;

    // Only navigate to internal student routes supplied by the backend.
    if (target && target.startsWith("/student/") && !target.startsWith("//")) {
      navigate(target);
    }
  }

  const filteredNotifications = notifications.filter((item) => {
    if (filter === "Unread") return !Number(item.is_read);
    if (filter === "Read") return Number(item.is_read) === 1;
    return true;
  });

  return (
    <main className="notifications-page">
      <header className="notifications-hero">
        <div>
          <Link className="notifications-back" to="/student/dashboard">
            ← Student Dashboard
          </Link>
          <p className="notifications-eyebrow">YOUR STUDENT HUB</p>
          <h1>Notifications</h1>
          <p>
            Keep up with research activities, meetings, tasks, and important updates.
          </p>
        </div>
        <div className="notifications-hero-icon" aria-hidden="true">🔔</div>
      </header>

      <section className="notifications-summary">
        <div>
          <span>All notifications</span>
          <strong>{notifications.length}</strong>
        </div>
        <div>
          <span>Unread</span>
          <strong>{unreadCount}</strong>
        </div>
        <div>
          <span>Read</span>
          <strong>{notifications.filter((item) => Number(item.is_read) === 1).length}</strong>
        </div>
      </section>

      {error && (
        <div className="notifications-alert notifications-alert-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notifications-alert notifications-alert-success" role="status">
          {message}
        </div>
      )}

      <section className="notifications-panel">
        <div className="notifications-toolbar">
          <div>
            <h2>Your updates</h2>
            <p>{unreadCount ? `${unreadCount} unread notification(s)` : "You're all caught up."}</p>
          </div>

          <div className="notifications-actions">
            <select
              aria-label="Filter notifications"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option>All</option>
              <option>Unread</option>
              <option>Read</option>
            </select>
            <button
              type="button"
              className="notifications-secondary-button"
              disabled={busy || unreadCount === 0}
              onClick={() => performAction("mark_all_read")}
            >
              Mark all read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="notifications-empty">Loading your notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty-state">
            <div className="notifications-empty-icon">✦</div>
            <h3>{filter === "All" ? "No notifications yet" : `No ${filter.toLowerCase()} notifications`}</h3>
            <p>
              Updates added to your account will appear here.
            </p>
            {filter !== "All" && (
              <button type="button" onClick={() => setFilter("All")}>
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((item) => (
              <article
                className={`notification-item ${Number(item.is_read) ? "is-read" : "is-unread"}`}
                key={item.id}
              >
                <div className="notification-type-icon" aria-hidden="true">
                  {icons[item.notification_type] || "🔔"}
                </div>

                <button
                  type="button"
                  className="notification-content"
                  onClick={() => openNotification(item)}
                  disabled={busy}
                >
                  <div className="notification-title-row">
                    <h3>{item.title}</h3>
                    {!Number(item.is_read) && <span className="notification-unread-dot" />}
                  </div>
                  <p>{item.message}</p>
                  <div className="notification-meta">
                    <span>{item.notification_type}</span>
                    <span>·</span>
                    <time>{formatDate(item.created_at)}</time>
                  </div>
                  {item.action_url && (
                    <span className="notification-open-hint">Open related page →</span>
                  )}
                </button>

                <div className="notification-row-actions">
                  {!Number(item.is_read) && (
                    <button
                      type="button"
                      className="notification-icon-button"
                      title="Mark as read"
                      aria-label={`Mark ${item.title} as read`}
                      disabled={busy}
                      onClick={() => performAction("mark_read", item.id)}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    className="notification-icon-button notification-delete-button"
                    title="Delete notification"
                    aria-label={`Delete ${item.title}`}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Delete this notification?")) {
                        performAction("delete", item.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="notifications-footer-note">
        Showing up to the 100 most recent notifications.
      </p>
    </main>
  );
}
