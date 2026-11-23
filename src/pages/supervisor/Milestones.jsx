import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/supervisor/milestones.css";

const API_URL = "http://localhost/acatrace/api";

function Milestones() {
const navigate = useNavigate();

const [milestones, setMilestones] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [message, setMessage] = useState("");
const [updatingId, setUpdatingId] = useState(null);
const [filter, setFilter] = useState("All");

const loadMilestones = useCallback(async () => {
setError("");


try {
  const response = await fetch(
    API_URL + "/milestones.php",
    {
      credentials: "include"
    }
  );

  const data = await response.json();

  if (response.status === 401) {
    navigate("/login");
    return;
  }

  if (!data.success) {
    setError(data.message || "Unable to load milestones.");
    return;
  }

  setMilestones(data.milestones || []);
} catch (err) {
  setError("Unable to connect to the server.");
} finally {
  setLoading(false);
}


}, [navigate]);

useEffect(() => {
loadMilestones();
}, [loadMilestones]);

async function updateStatus(milestone, newStatus) {
setError("");
setMessage("");
setUpdatingId(milestone.id);


try {
  const response = await fetch(
    API_URL + "/milestones.php",
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: milestone.id,
        status: newStatus
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    setError(data.message || "Unable to update milestone.");
    return;
  }

  setMilestones(function (currentMilestones) {
    return currentMilestones.map(function (item) {
      if (String(item.id) === String(milestone.id)) {
        return {
          ...item,
          status: newStatus
        };
      }

      return item;
    });
  });

  setMessage("Milestone status updated successfully.");
} catch (err) {
  setError("Unable to connect to the server.");
} finally {
  setUpdatingId(null);
}


}

function getStatus(status) {
return String(status || "Pending").toLowerCase();
}

function formatDate(date) {
if (!date) {
return "No deadline set";
}


const parsedDate = new Date(date + "T00:00:00");

if (Number.isNaN(parsedDate.getTime())) {
  return date;
}

return parsedDate.toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric"
});


}

function isOverdue(milestone) {
if (!milestone.due_date) {
return false;
}


if (getStatus(milestone.status) === "completed") {
  return false;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const dueDate = new Date(milestone.due_date + "T00:00:00");

return (
  !Number.isNaN(dueDate.getTime()) &&
  dueDate < today
);


}

const completedCount = milestones.filter(function (item) {
return getStatus(item.status) === "completed";
}).length;

const inProgressCount = milestones.filter(function (item) {
return getStatus(item.status) === "in progress";
}).length;

const pendingCount = milestones.filter(function (item) {
return getStatus(item.status) === "pending";
}).length;

const progress = milestones.length
? Math.round((completedCount / milestones.length) * 100)
: 0;

const filteredMilestones = milestones.filter(function (item) {
if (filter === "All") {
return true;
}

return getStatus(item.status) === filter.toLowerCase();


});

if (loading) {
return ( <main className="milestones-loading"> <div className="milestones-spinner"></div> <p>Loading your milestones...</p> </main>
);
}

return ( <main className="milestones-page"> <div className="milestones-container">

```
    <div className="milestones-topbar">
      <div className="milestones-brand">
        Aca<span>Trace</span>
      </div>

      <Link
        to="/dashboard"
        className="milestones-back-button"
      >
        Back to Dashboard
      </Link>
    </div>

    <header className="milestones-hero">
      <div>
        <p className="milestones-eyebrow">
          STUDENT WORKSPACE
        </p>

        <h1>My Research Milestones</h1>

        <p className="milestones-subtitle">
          Track your research stages, deadlines, and progress in one place.
        </p>
      </div>
    </header>

    {message && (
      <div className="milestones-notice success" role="status">
        {message}
      </div>
    )}

    {error && (
      <div className="milestones-notice error" role="alert">
        {error}
      </div>
    )}

    <section className="milestones-summary">

      <div className="milestones-summary-card">
        <p>Total Milestones</p>
        <h2>{milestones.length}</h2>
      </div>

      <div className="milestones-summary-card">
        <p>Completed</p>
        <h2>{completedCount}</h2>
      </div>

      <div className="milestones-summary-card">
        <p>In Progress</p>
        <h2>{inProgressCount}</h2>
      </div>

      <div className="milestones-summary-card">
        <p>Pending</p>
        <h2>{pendingCount}</h2>
      </div>

    </section>

    <section className="milestones-progress-panel">
      <div className="progress-panel-heading">
        <div>
          <h2>Research Progress</h2>
          <p>Your overall milestone completion</p>
        </div>

        <strong className="progress-percentage">
          {progress}%
        </strong>
      </div>

      <div className="milestones-progress-track">
        <div
          className="milestones-progress-fill"
          style={{ width: progress + "%" }}
        ></div>
      </div>

      <p>
        You have completed {completedCount} of {milestones.length} milestones.
      </p>
    </section>

    <section className="milestones-content">
      <div className="milestones-list-heading">
        <div>
          <h2>Your Milestones</h2>
          <p>Review each milestone and update its status.</p>
        </div>

        <select
          className="milestones-filter"
          value={filter}
          onChange={function (event) {
            setFilter(event.target.value);
          }}
          aria-label="Filter milestones"
        >
          <option value="All">All Milestones</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {filteredMilestones.length === 0 ? (
        <div className="milestones-empty">
          <h3>No milestones found</h3>
          <p>
            Your assigned research milestones will appear here.
          </p>
        </div>
      ) : (
        <div className="milestones-list">
          {filteredMilestones.map(function (milestone) {
            const overdue = isOverdue(milestone);
            const status = getStatus(milestone.status);

            let badgeClass = "pending";
            let statusLabel = "Pending";

            if (status === "completed") {
              badgeClass = "completed";
              statusLabel = "Completed";
            } else if (status === "in progress") {
              badgeClass = "in-progress";
              statusLabel = "In Progress";
            } else if (overdue) {
              badgeClass = "overdue";
              statusLabel = "Overdue";
            }

            return (
              <article
                className="milestone-item"
                key={milestone.id}
              >
                <div className="milestone-item-marker"></div>

                <div className="milestone-item-body">
                  <div className="milestone-item-heading">
                    <div className="milestone-item-title-group">
                      <h3 className="milestone-item-title">
                        {milestone.title || "Research Milestone"}
                      </h3>

                      <span
                        className={
                          "milestone-status-badge " + badgeClass
                        }
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <p className="milestone-project-name">
                    {milestone.project_title
                      ? "Project: " + milestone.project_title
                      : "Research Project"}
                  </p>

                  <p className="milestone-item-description">
                    {milestone.description ||
                      "No additional details have been provided."}
                  </p>

                  <div className="milestone-item-footer">
                    <p className="milestone-deadline">
                      Deadline: {formatDate(milestone.due_date)}
                    </p>

                    <label className="milestone-status-control">
                      Update status

                      <select
                        value={milestone.status || "Pending"}
                        disabled={updatingId === milestone.id}
                        onChange={function (event) {
                          updateStatus(
                            milestone,
                            event.target.value
                          );
                        }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>

    <footer className="milestones-footer">
      <span>AcaTrace Student Workspace</span>
      <Link to="/dashboard">Return to Dashboard</Link>
    </footer>

  </div>
</main>


);
}

export default Milestones;
