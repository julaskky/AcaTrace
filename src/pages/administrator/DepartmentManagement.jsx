import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/administrator/department-management.css";


const DEPARTMENT_API =
  "http://localhost/acatrace/api/departments_manage.php";

const INSTITUTION_API =
  "http://localhost/acatrace/api/institutions.php";

function DepartmentManagement() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [institutions, setInstitutions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterInstitution, setFilterInstitution] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    university_id: "",
    name: "",
    status: "active",
  });

  /*
  |--------------------------------------------------------------------------
  | Load institutions
  |--------------------------------------------------------------------------
  */

  const loadInstitutions = async () => {
    try {
      const response = await fetch(INSTITUTION_API, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load institutions."
        );
      }

      setInstitutions(data.institutions || []);

    } catch (err) {
      setError(err.message);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Load departments
  |--------------------------------------------------------------------------
  */

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim() !== "") {
        params.append("search", search.trim());
      }

      if (filterInstitution !== "") {
        params.append(
          "university_id",
          filterInstitution
        );
      }

      const url =
        params.toString()
          ? `${DEPARTMENT_API}?${params.toString()}`
          : DEPARTMENT_API;

      const response = await fetch(url, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          navigate("/dashboard");
          return;
        }

        throw new Error(
          data.message || "Unable to load departments."
        );
      }

      setDepartments(data.departments || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [filterInstitution]);

  /*
  |--------------------------------------------------------------------------
  | Form
  |--------------------------------------------------------------------------
  */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Submit
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");
    setSaving(true);

    try {
      const method = editingId ? "PUT" : "POST";

      const body = editingId
        ? {
            id: editingId,
            ...form,
          }
        : form;

      const response = await fetch(DEPARTMENT_API, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save department."
        );
      }

      setMessage(data.message);

      resetForm();

      await loadDepartments();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Edit
  |--------------------------------------------------------------------------
  */

  const handleEdit = (department) => {
    setEditingId(department.id);

    setForm({
      university_id: String(
        department.university_id
      ),
      name: department.name || "",
      status: department.status || "active",
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Reset
  |--------------------------------------------------------------------------
  */

  const resetForm = () => {
    setEditingId(null);

    setForm({
      university_id: "",
      name: "",
      status: "active",
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */

  const handleSearch = (e) => {
    e.preventDefault();
    loadDepartments();
  };

  return (
    <div className="department-page">

      {/* HEADER */}

      <div className="department-header">

        <div>

          <span className="department-eyebrow">
            ADMINISTRATION
          </span>

          <h1>Department Management</h1>

          <p>
            Manage academic departments across
            your institutions.
          </p>

        </div>

        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>

      </div>

      {/* MESSAGES */}

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* FORM */}

      <section className="department-card">

        <div className="card-heading">

          <h2>
            {editingId
              ? "Edit Department"
              : "Add Department"}
          </h2>

          <p>
            {editingId
              ? "Update the department information."
              : "Add a department to an institution."}
          </p>

        </div>

        <form
          className="department-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label>Institution</label>

            <select
              name="university_id"
              value={form.university_id}
              onChange={handleChange}
              required
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

          <div className="form-group">

            <label>Department Name</label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Computer Science"
              required
            />

          </div>

          {editingId && (
            <div className="form-group">

              <label>Status</label>

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

            </div>
          )}

          <div className="form-actions">

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Department"
                : "Add Department"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}

          </div>

        </form>

      </section>

      {/* LIST */}

      <section className="department-card">

        <div className="list-header">

          <div>

            <h2>Departments</h2>

            <p>
              {departments.length} department
              {departments.length !== 1 ? "s" : ""}
            </p>

          </div>

          <form
            className="search-form"
            onSubmit={handleSearch}
          >

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search departments..."
            />

            <button type="submit">
              Search
            </button>

          </form>

        </div>

        {/* FILTER */}

        <div className="department-filter">

          <label>
            Filter by institution
          </label>

          <select
            value={filterInstitution}
            onChange={(e) =>
              setFilterInstitution(e.target.value)
            }
          >

            <option value="">
              All institutions
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

        {loading ? (

          <div className="empty-state">
            Loading departments...
          </div>

        ) : departments.length === 0 ? (

          <div className="empty-state">
            No departments found.
          </div>

        ) : (

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>

                <tr>
                  <th>Department</th>
                  <th>Institution</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>

              </thead>

              <tbody>

                {departments.map((department) => (

                  <tr key={department.id}>

                    <td>
                      <strong>
                        {department.name}
                      </strong>
                    </td>

                    <td>
                      {department.institution_name}
                    </td>

                    <td>
                      {department.institution_country}
                    </td>

                    <td>

                      <span
                        className={`status-badge ${department.status}`}
                      >
                        {department.status}
                      </span>

                    </td>

                    <td>

                      <button
                        className="edit-button"
                        onClick={() =>
                          handleEdit(department)
                        }
                      >
                        Edit
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
}

export default DepartmentManagement;