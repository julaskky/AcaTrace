import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/supervisor/supervisor-management.css";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  university_id: "",
  department_id: "",
  staff_number: "",
  academic_title: "",
  specialization: "",
};

function SupervisorManagement() {
  const navigate = useNavigate();

  const [supervisors, setSupervisors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const response = await fetch(
        "http://localhost/acatrace/api/supervisor_management.php?action=list",
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!data.success) {
        navigate("/login");
        return;
      }

      setSupervisors(data.supervisors || []);

      await loadInstitutions();
      await loadProjects();

    } catch (err) {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const loadInstitutions = async () => {
    const response = await fetch(
      "http://localhost/acatrace/api/supervisor_management.php?action=institutions",
      {
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      setInstitutions(data.institutions || []);
    }
  };

  const loadDepartments = async (universityId) => {
    if (!universityId) {
      setDepartments([]);
      return;
    }

    const response = await fetch(
      `http://localhost/acatrace/api/supervisor_management.php?action=departments&university_id=${universityId}`,
      {
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      setDepartments(data.departments || []);
    }
  };

  const loadProjects = async () => {
    const response = await fetch(
      "http://localhost/acatrace/api/supervisor_management.php?action=projects",
      {
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      setProjects(data.projects || []);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });

    if (name === "university_id") {
      setForm((current) => ({
        ...current,
        university_id: value,
        department_id: "",
      }));

      loadDepartments(value);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDepartments([]);
    setShowForm(true);
    setMessage("");
    setError("");
  };

  const openEdit = (supervisor) => {
    setEditing(supervisor);

    setForm({
      first_name: supervisor.first_name || "",
      last_name: supervisor.last_name || "",
      email: supervisor.email || "",
      password: "",
      university_id: supervisor.university_id || "",
      department_id: supervisor.department_id || "",
      staff_number: supervisor.staff_number || "",
      academic_title: supervisor.academic_title || "",
      specialization: supervisor.specialization || "",
      status: supervisor.user_status || "active",
    });

    if (supervisor.university_id) {
      loadDepartments(supervisor.university_id);
    }

    setShowForm(true);
    setMessage("");
    setError("");
  };

  const saveSupervisor = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/supervisor_management.php",
        {
          method: editing ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            editing
              ? {
                  ...form,
                  id: editing.id,
                }
              : form
          ),
        }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      setMessage(data.message);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);

      await loadAll();

    } catch (err) {
      setError("Unable to connect to the server.");
    }
  };

  const deactivateSupervisor = async (id) => {
    if (!window.confirm("Deactivate this supervisor?")) {
      return;
    }

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/supervisor_management.php",
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      setMessage(data.message);

      await loadAll();

    } catch (err) {
      setError("Unable to connect to the server.");
    }
  };

  const assignProject = async (e) => {
    e.preventDefault();

    if (!selectedSupervisor || !selectedProject) {
      setError("Select both a supervisor and research project.");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/research_projects.php",
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: selectedProject,
            supervisor_id: selectedSupervisor,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      setMessage("Supervisor assigned successfully.");
      setShowAssign(false);
      setSelectedSupervisor("");
      setSelectedProject("");

      await loadProjects();

    } catch (err) {
      setError("Unable to connect to the server.");
    }
  };

  if (loading) {
    return (
      <div className="supervisor-loading">
        <div className="loading-spinner"></div>
        <p>Loading supervisors...</p>
      </div>
    );
  }

  return (
    <div className="supervisor-page">

      <aside className="supervisor-sidebar">

        <Link to="/" className="supervisor-logo">
          Aca<span>Trace</span>
        </Link>

        <nav>

          <Link to="/dashboard">
            <span>⌂</span>
            Dashboard
          </Link>

          <Link to="/admin/institutions">
            <span>▦</span>
            Institutions
          </Link>

          <Link to="/admin/departments">
            <span>▤</span>
            Departments
          </Link>

          <Link to="/admin/supervisors" className="active">
            <span>◉</span>
            Supervisors
          </Link>

          <Link to="/research">
            <span>◈</span>
            Research Projects
          </Link>

        </nav>

      </aside>

      <main className="supervisor-main">

        <header className="supervisor-header">

          <div>
            <p>Administration</p>
            <h1>Supervisor Management</h1>
            <span>
              Manage academic supervisors and research assignments.
            </span>
          </div>

          <div className="header-actions">

            <button
              className="secondary-supervisor-btn"
              onClick={() => {
                setShowAssign(true);
                setMessage("");
                setError("");
              }}
            >
              Assign Project
            </button>

            <button
              className="primary-supervisor-btn"
              onClick={openCreate}
            >
              + Add Supervisor
            </button>

          </div>

        </header>

        {message && (
          <div className="supervisor-message">
            {message}
          </div>
        )}

        {error && (
          <div className="supervisor-error">
            {error}
          </div>
        )}

        {showForm && (
          <section className="supervisor-form-card">

            <div className="form-heading">
              <div>
                <h2>
                  {editing
                    ? "Edit Supervisor"
                    : "Create Supervisor"}
                </h2>

                <p>
                  Enter the supervisor's account and academic details.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveSupervisor}>

              <div className="supervisor-form-grid">

                <div>
                  <label>First Name</label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Last Name</label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                {!editing && (
                  <div>
                    <label>Temporary Password</label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                )}

                <div>
                  <label>Academic Title</label>
                  <input
                    name="academic_title"
                    value={form.academic_title}
                    onChange={handleChange}
                    placeholder="e.g. Dr., Professor"
                  />
                </div>

                <div>
                  <label>Staff Number</label>
                  <input
                    name="staff_number"
                    value={form.staff_number}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Institution</label>
                  <select
                    name="university_id"
                    value={form.university_id}
                    onChange={handleChange}
                  >
                    <option value="">
                      Select institution
                    </option>

                    {institutions.map((institution) => (
                      <option
                        key={institution.id}
                        value={institution.id}
                      >
                        {institution.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Department</label>
                  <select
                    name="department_id"
                    value={form.department_id}
                    onChange={handleChange}
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="full-supervisor-field">
                  <label>Specialization</label>
                  <input
                    name="specialization"
                    value={form.specialization}
                    onChange={handleChange}
                    placeholder="e.g. Machine Learning, AI"
                  />
                </div>

                {editing && (
                  <div>
                    <label>Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}

              </div>

              <div className="form-buttons">

                <button
                  type="button"
                  className="cancel-supervisor-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-supervisor-btn"
                >
                  {editing
                    ? "Update Supervisor"
                    : "Create Supervisor"}
                </button>

              </div>

            </form>

          </section>
        )}

        {showAssign && (
          <section className="assignment-card">

            <div className="form-heading">
              <div>
                <h2>Assign Supervisor</h2>
                <p>
                  Assign a supervisor to a research project.
                </p>
              </div>

              <button
                onClick={() => setShowAssign(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={assignProject}>

              <div className="assignment-grid">

                <div>
                  <label>Supervisor</label>

                  <select
                    value={selectedSupervisor}
                    onChange={(e) =>
                      setSelectedSupervisor(e.target.value)
                    }
                    required
                  >
                    <option value="">
                      Select supervisor
                    </option>

                    {supervisors
                      .filter(
                        (supervisor) =>
                          supervisor.user_status === "active"
                      )
                      .map((supervisor) => (
                        <option
                          key={supervisor.id}
                          value={supervisor.id}
                        >
                          {supervisor.first_name}{" "}
                          {supervisor.last_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label>Research Project</label>

                  <select
                    value={selectedProject}
                    onChange={(e) =>
                      setSelectedProject(e.target.value)
                    }
                    required
                  >
                    <option value="">
                      Select research project
                    </option>

                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.title} — {project.student_name}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="form-buttons">

                <button
                  type="button"
                  className="cancel-supervisor-btn"
                  onClick={() => setShowAssign(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-supervisor-btn"
                >
                  Assign Supervisor
                </button>

              </div>

            </form>

          </section>
        )}

        <section className="supervisor-table-card">

          <div className="table-header">
            <div>
              <h2>Supervisors</h2>
              <p>
                {supervisors.length} supervisor
                {supervisors.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {supervisors.length === 0 ? (

            <div className="empty-supervisors">
              <div>◉</div>
              <h3>No supervisors yet</h3>
              <p>
                Add your first academic supervisor to begin.
              </p>
            </div>

          ) : (

            <div className="supervisor-table-wrapper">

              <table>

                <thead>
                  <tr>
                    <th>Supervisor</th>
                    <th>Institution</th>
                    <th>Department</th>
                    <th>Specialization</th>
                    <th>Projects</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {supervisors.map((supervisor) => (

                    <tr key={supervisor.id}>

                      <td>
                        <strong>
                          {supervisor.academic_title
                            ? `${supervisor.academic_title} `
                            : ""}
                          {supervisor.first_name}{" "}
                          {supervisor.last_name}
                        </strong>

                        <small>
                          {supervisor.email}
                        </small>
                      </td>

                      <td>
                        {supervisor.institution_name ||
                          "Not assigned"}
                      </td>

                      <td>
                        {supervisor.department_name ||
                          "Not assigned"}
                      </td>

                      <td>
                        {supervisor.specialization ||
                          "Not specified"}
                      </td>

                      <td>
                        <span className="project-count">
                          {supervisor.project_count}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${supervisor.user_status}`}
                        >
                          {supervisor.user_status}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">

                          <button
                            onClick={() =>
                              openEdit(supervisor)
                            }
                          >
                            Edit
                          </button>

                          {supervisor.user_status === "active" && (
                            <button
                              className="deactivate-btn"
                              onClick={() =>
                                deactivateSupervisor(
                                  supervisor.id
                                )
                              }
                            >
                              Deactivate
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default SupervisorManagement;