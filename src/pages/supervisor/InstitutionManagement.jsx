import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/supervisor/institution-management.css";

const API_URL = "http://localhost/acatrace/api/institutions.php";

function InstitutionManagement() {
  const navigate = useNavigate();

  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    country: "",
    website: "",
    status: "active",
  });

  /*
  |--------------------------------------------------------------------------
  | Load institutions
  |--------------------------------------------------------------------------
  */

  const loadInstitutions = async (searchValue = "") => {
    try {
      setLoading(true);
      setError("");

      const url = searchValue
        ? `${API_URL}?search=${encodeURIComponent(searchValue)}`
        : API_URL;

      const response = await fetch(url, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          navigate("/dashboard");
          return;
        }

        throw new Error(data.message || "Unable to load institutions.");
      }

      setInstitutions(data.institutions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Form changes
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

      const response = await fetch(API_URL, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save institution.");
      }

      setMessage(data.message);

      resetForm();

      await loadInstitutions(search);
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

  const handleEdit = (institution) => {
    setEditingId(institution.id);

    setForm({
      name: institution.name || "",
      country: institution.country || "",
      website: institution.website || "",
      status: institution.status || "active",
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
      name: "",
      country: "",
      website: "",
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
    loadInstitutions(search);
  };

  return (
    <div className="institution-page">

      <div className="institution-header">

        <div>
          <span className="institution-eyebrow">
            ADMINISTRATION
          </span>

          <h1>Institution Management</h1>

          <p>
            Manage academic institutions available throughout AcaTrace.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>

      </div>

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

      <section className="institution-card">

        <div className="card-heading">

          <div>
            <h2>
              {editingId
                ? "Edit Institution"
                : "Add Institution"}
            </h2>

            <p>
              {editingId
                ? "Update the institution information."
                : "Add a new academic institution."}
            </p>
          </div>

        </div>

        <form
          className="institution-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label>Institution Name</label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. University of Pretoria"
              required
            />

          </div>

          <div className="form-group">

            <label>Country</label>

            <input
              type="text"
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="e.g. South Africa"
              required
            />

          </div>

          <div className="form-group">

            <label>Website</label>

            <input
              type="url"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://www.example.ac.za"
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
                ? "Update Institution"
                : "Add Institution"}
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

      {/* SEARCH */}

      <section className="institution-card">

        <div className="list-header">

          <div>
            <h2>Institutions</h2>

            <p>
              {institutions.length} institution
              {institutions.length !== 1 ? "s" : ""}
            </p>
          </div>

          <form
            className="search-form"
            onSubmit={handleSearch}
          >

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search institutions..."
            />

            <button type="submit">
              Search
            </button>

          </form>

        </div>

        {loading ? (

          <div className="empty-state">
            Loading institutions...
          </div>

        ) : institutions.length === 0 ? (

          <div className="empty-state">
            No institutions found.
          </div>

        ) : (

          <div className="institution-table-wrapper">

            <table className="institution-table">

              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Country</th>
                  <th>Website</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {institutions.map((institution) => (

                  <tr key={institution.id}>

                    <td>
                      <strong>
                        {institution.name}
                      </strong>
                    </td>

                    <td>
                      {institution.country}
                    </td>

                    <td>
                      {institution.website ? (
                        <a
                          href={institution.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Visit website
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>

                      <span
                        className={`status-badge ${institution.status}`}
                      >
                        {institution.status}
                      </span>

                    </td>

                    <td>

                      <button
                        className="edit-button"
                        onClick={() =>
                          handleEdit(institution)
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

export default InstitutionManagement;