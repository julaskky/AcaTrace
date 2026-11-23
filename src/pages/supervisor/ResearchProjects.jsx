import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/supervisor/research-projects.css";

const API = "http://localhost/acatrace/api";

const emptyForm = {
title: "",
description: "",
research_area: "",
methodology: "",
status: "Proposed",
supervisor_id: "",
start_date: "",
expected_completion_date: "",
};

function ResearchProjects() {
const navigate = useNavigate();

const [projects, setProjects] = useState([]);
const [supervisors, setSupervisors] = useState([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [showForm, setShowForm] = useState(false);
const [editingProject, setEditingProject] = useState(null);
const [form, setForm] = useState(emptyForm);
const [message, setMessage] = useState("");
const [error, setError] = useState("");

const loadProjects = useCallback(async () => {
const response = await fetch(`${API}/research_projects.php`, {
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

setProjects(data.projects || []);


}, [navigate]);

useEffect(() => {
let cancelled = false;


async function initialise() {
  setLoading(true);
  setError("");

  try {
    const [projectResponse, supervisorResponse] = await Promise.all([
      fetch(`${API}/research_projects.php`, {
        credentials: "include",
      }),
      fetch(`${API}/supervisors.php`, {
        credentials: "include",
      }),
    ]);

    const projectData = await projectResponse.json();

    if (projectResponse.status === 401 || projectResponse.status === 403) {
      navigate("/login");
      return;
    }

    if (!projectResponse.ok || !projectData.success) {
      throw new Error(
        projectData.message || "Unable to load research projects."
      );
    }

    let supervisorList = [];

    if (supervisorResponse.ok) {
      const supervisorData = await supervisorResponse.json();

      if (supervisorData.success) {
        supervisorList = supervisorData.supervisors || [];
      }
    }

    if (!cancelled) {
      setProjects(projectData.projects || []);
      setSupervisors(supervisorList);
    }
  } catch (err) {
    if (!cancelled) {
      setError(err.message || "Unable to load research projects.");
    }
  } finally {
    if (!cancelled) {
      setLoading(false);
    }
  }
}

initialise();

return () => {
  cancelled = true;
};


}, [navigate]);

function handleChange(event) {
const { name, value } = event.target;


setForm((current) => ({
  ...current,
  [name]: value,
}));


}

function openCreateForm() {
setEditingProject(null);
setForm(emptyForm);
setMessage("");
setError("");
setShowForm(true);
}

function openEditForm(project) {
setEditingProject(project);


setForm({
  title: project.title || "",
  description: project.description || "",
  research_area: project.research_area || "",
  methodology: project.methodology || "",
  status: project.status || "Proposed",
  supervisor_id: project.supervisor_id
    ? String(project.supervisor_id)
    : "",
  start_date: project.start_date || "",
  expected_completion_date: project.expected_completion_date || "",
});

setMessage("");
setError("");
setShowForm(true);


}

function closeForm() {
setShowForm(false);
setEditingProject(null);
setForm(emptyForm);
}

async function handleSubmit(event) {
event.preventDefault();


setSaving(true);
setMessage("");
setError("");

try {
  const payload = editingProject
    ? { ...form, id: editingProject.id }
    : form;

  const response = await fetch(`${API}/research_projects.php`, {
    method: editingProject ? "PUT" : "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    setError(data.message || "Unable to save the research project.");
    return;
  }

  setMessage(data.message || "Research project saved successfully.");
  closeForm();
  await loadProjects();
} catch (err) {
  setError(err.message || "Unable to connect to the server.");
} finally {
  setSaving(false);
}


}

async function handleDelete(id) {
const confirmed = window.confirm(
"Are you sure you want to delete this research project?"
);


if (!confirmed) {
  return;
}

setMessage("");
setError("");

try {
  const response = await fetch(`${API}/research_projects.php`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    setError(data.message || "Unable to delete the research project.");
    return;
  }

  setMessage(data.message || "Research project deleted.");
  await loadProjects();
} catch (err) {
  setError(err.message || "Unable to connect to the server.");
}


}

function statusClass(status) {
return String(status || "proposed")
.toLowerCase()
.replace(/\s+/g, "-");
}

if (loading) {
return ( <div className="research-page"> <div className="research-loading">
Loading research projects... </div> </div>
);
}

return ( <div className="research-page"> <main className="research-main"> <Link to="/dashboard" className="research-back-link">
Back to Dashboard </Link>


    <header className="research-header">
      <div>
        <span className="research-eyebrow">ACATRACE WORKSPACE</span>
        <h1>My Research</h1>
        <p>
          Organise, manage, and monitor your academic research projects.
        </p>
      </div>

      <button
        type="button"
        className="create-project-button"
        onClick={openCreateForm}
      >
        + New Research Project
      </button>
    </header>

    {message && (
      <div className="research-alert success-message">{message}</div>
    )}

    {error && (
      <div className="research-alert error-message">{error}</div>
    )}

    {showForm && (
      <section className="project-form-card">
        <div className="form-card-header">
          <div>
            <span className="research-eyebrow">PROJECT DETAILS</span>
            <h2>
              {editingProject
                ? "Edit Research Project"
                : "Create Research Project"}
            </h2>
          </div>

          <button
            type="button"
            className="close-form"
            onClick={closeForm}
            aria-label="Close form"
          >
            X
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="project-title">
                Research Project Title *
              </label>
              <input
                id="project-title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter your research project title"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="research-area">Research Area</label>
              <input
                id="research-area"
                name="research_area"
                value={form.research_area}
                onChange={handleChange}
                placeholder="e.g. Artificial Intelligence"
              />
            </div>

            <div className="form-group">
              <label htmlFor="supervisor">Supervisor</label>
              <select
                id="supervisor"
                name="supervisor_id"
                value={form.supervisor_id}
                onChange={handleChange}
              >
                <option value="">Select supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name}
                    {supervisor.academic_title
                      ? ` - ${supervisor.academic_title}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="project-status">Status</label>
              <select
                id="project-status"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {[
                  "Proposed",
                  "Active",
                  "Completed",
                  "On Hold",
                  "Cancelled",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="completion-date">
                Expected Completion
              </label>
              <input
                id="completion-date"
                type="date"
                name="expected_completion_date"
                value={form.expected_completion_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="project-description">
                Project Description
              </label>
              <textarea
                id="project-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the research project..."
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="project-methodology">Methodology</label>
              <textarea
                id="project-methodology"
                name="methodology"
                value={form.methodology}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the proposed methodology..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={closeForm}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingProject
                  ? "Update Project"
                  : "Create Project"}
            </button>
          </div>
        </form>
      </section>
    )}

    <section className="projects-section">
      <div className="section-title">
        <div>
          <span className="research-eyebrow">YOUR WORK</span>
          <h2>Research Projects</h2>
          <p>Your current research activities and project details.</p>
        </div>

        <span className="project-count">
          {projects.length}{" "}
          {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="projects-empty">
          <div className="large-empty-icon">Research</div>
          <h3>No research projects yet</h3>
          <p>
            Create your first research project to begin tracking your
            academic journey.
          </p>
          <button
            type="button"
            className="create-project-button"
            onClick={openCreateForm}
          >
            + Create Research Project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-top">
                <span
                  className={`project-status ${statusClass(
                    project.status
                  )}`}
                >
                  {project.status || "Proposed"}
                </span>
              </div>

              <h3>{project.title}</h3>

              <div className="project-area">
                {project.research_area ||
                  "Research area not specified"}
              </div>

              <p className="project-description">
                {project.description ||
                  "No project description provided."}
              </p>

              <div className="project-meta">
                <div>
                  <span>Supervisor</span>
                  <strong>
                    {project.supervisor_name || "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>Start Date</span>
                  <strong>{project.start_date || "Not set"}</strong>
                </div>

                <div>
                  <span>Expected Completion</span>
                  <strong>
                    {project.expected_completion_date || "Not set"}
                  </strong>
                </div>
              </div>

              <div className="project-actions">
                <button
                  type="button"
                  onClick={() => openEditForm(project)}
                >
                  Edit Project
                </button>

                <button
                  type="button"
                  className="delete-project"
                  onClick={() => handleDelete(project.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  </main>
</div>


);
}

export default ResearchProjects;
