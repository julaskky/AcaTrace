
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/administrator/profile.css";

function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProfile = async () => {
    try {
      const response = await fetch(
        "http://localhost/acatrace/api/profile.php",
        { credentials: "include" }
      );

      const data = await response.json();

      if (!data.success) {
        navigate("/login");
        return;
      }

      setProfile(data.profile);

      if (data.profile.role === "student") {
        await loadUniversities();

        if (data.profile.university_id) {
          await loadDepartments(data.profile.university_id);
        } else {
          setDepartments([]);
        }
      }
    } catch (err) {
      setError("Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadUniversities = async () => {
    try {
      const response = await fetch(
        "http://localhost/acatrace/api/universities.php",
        { credentials: "include" }
      );

      const data = await response.json();

      if (data.success) {
        setUniversities(data.universities);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDepartments = async (universityId) => {
    if (!universityId) {
      setDepartments([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost/acatrace/api/departments.php?university_id=${universityId}`,
        { credentials: "include" }
      );

      const data = await response.json();

      if (data.success) {
        setDepartments(data.departments);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));

    setMessage("");
  };

  const handleUniversityChange = async (e) => {
    const universityId = e.target.value;

    setProfile((current) => ({
      ...current,
      university_id: universityId || null,
      department_id: "",
    }));

    setMessage("");
    await loadDepartments(universityId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/profile.php",
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profile),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage("Profile updated successfully.");
        await loadProfile();
      } else {
        setError(data.message || "Unable to update profile.");
      }
    } catch (err) {
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />
        <h2>Loading your profile</h2>
        <p>Please wait while we retrieve your information.</p>
      </div>
    );
  }

  if (!profile) return null;

  const initials =
    `${profile.first_name?.charAt(0) || ""}${profile.last_name?.charAt(0) || ""}`
      .toUpperCase();

  const roleLabel =
    profile.role === "admin"
      ? "Administrator"
      : profile.role === "supervisor"
      ? "Supervisor"
      : "Student";

  return (
    <div className="profile-page">
      <header className="profile-navbar">
        <Link to="/" className="profile-logo">
          Aca<span>Trace</span>
          <small>Track. Supervise. Progress.</small>
        </Link>

        <Link to="/dashboard" className="back-dashboard">
          <span aria-hidden="true">←</span> Back to Dashboard
        </Link>
      </header>

      <main className="profile-main">
        <section className="profile-intro">
          <div className="profile-eyebrow">
            <span className="profile-eyebrow-dot" />
            ACCOUNT SETTINGS
          </div>

          <h1>My Profile</h1>
          <p>
            Keep your personal details and academic information accurate
            and up to date.
          </p>
        </section>

        <section className="profile-header-card">
          <div className="profile-avatar">{initials || "AT"}</div>

          <div className="profile-identity">
            <span className="profile-identity-label">YOUR ACCOUNT</span>
            <h2>
              {profile.first_name} {profile.last_name}
            </h2>
            <p>{profile.email}</p>
            <span className="profile-role">{roleLabel}</span>
          </div>

          <div className="profile-card-decoration" aria-hidden="true">
            <span>AT</span>
          </div>
        </section>

        <form className="profile-form" onSubmit={handleSubmit}>
          <section className="profile-section">
            <div className="profile-section-heading">
              <div className="profile-section-icon">01</div>
              <div>
                <h3>Personal information</h3>
                <p>Basic details associated with your account.</p>
              </div>
            </div>

            <div className="profile-fields">
              <div className="profile-field">
                <label htmlFor="first_name">First name</label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  value={profile.first_name || ""}
                  onChange={handleChange}
                  autoComplete="given-name"
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="last_name">Last name</label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  value={profile.last_name || ""}
                  onChange={handleChange}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="profile-field profile-field-full">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={profile.email || ""}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
                <small>Use an email address you can access.</small>
              </div>
            </div>
          </section>

          {profile.role === "student" && (
            <section className="profile-section">
              <div className="profile-section-heading">
                <div className="profile-section-icon academic-icon">02</div>
                <div>
                  <h3>Academic information</h3>
                  <p>Details about your programme and academic journey.</p>
                </div>
              </div>

              <div className="profile-fields">
                <div className="profile-field">
                  <label htmlFor="academic_level">Academic level</label>
                  <select
                    id="academic_level"
                    name="academic_level"
                    value={profile.academic_level || ""}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select academic level</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>

                <div className="profile-field">
                  <label htmlFor="student_number">Student number</label>
                  <input
                    id="student_number"
                    type="text"
                    name="student_number"
                    value={profile.student_number || ""}
                    onChange={handleChange}
                    placeholder="Enter your student number"
                  />
                </div>

                <div className="profile-field profile-field-full">
                  <label htmlFor="programme">Programme of study</label>
                  <input
                    id="programme"
                    type="text"
                    name="programme"
                    value={profile.programme || ""}
                    onChange={handleChange}
                    placeholder="e.g. Computer Science"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="university_id">Institution</label>
                  <select
                    id="university_id"
                    name="university_id"
                    value={profile.university_id || ""}
                    onChange={handleUniversityChange}
                  >
                    <option value="">Select institution</option>
                    {universities.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="profile-field">
                  <label htmlFor="department_id">Department</label>
                  <select
                    id="department_id"
                    name="department_id"
                    value={profile.department_id || ""}
                    onChange={handleChange}
                    disabled={!profile.university_id}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="profile-field">
                  <label htmlFor="enrollment_date">Enrollment date</label>
                  <input
                    id="enrollment_date"
                    type="date"
                    name="enrollment_date"
                    value={profile.enrollment_date || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="expected_completion_date">
                    Expected completion
                  </label>
                  <input
                    id="expected_completion_date"
                    type="date"
                    name="expected_completion_date"
                    value={profile.expected_completion_date || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>
          )}

          {message && (
            <div className="profile-success" role="status">
              <span>✓</span> {message}
            </div>
          )}

          {error && (
            <div className="profile-error" role="alert">
              <span>!</span> {error}
            </div>
          )}

          <div className="profile-actions">
            <Link to="/dashboard" className="cancel-profile">
              Cancel
            </Link>

            <button
              type="submit"
              className="save-profile"
              disabled={saving}
            >
              {saving ? "Saving changes..." : "Save Changes"}
              {!saving && <span aria-hidden="true"> →</span>}
            </button>
          </div>
        </form>

        <footer className="profile-footer">
          <span>ACATRACE</span>
          <span>Supporting your academic journey.</span>
        </footer>
      </main>
    </div>
  );
}

export default Profile;