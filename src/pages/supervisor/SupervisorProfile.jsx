import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/supervisor/supervisor-profile.css";

const API_URL = "http://localhost/acatrace/api/supervisor/profile.php";

const EMPTY_PROFILE = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  staff_number: "",
  academic_title: "",
  specialization: "",
  qualifications: "",
  research_interests: "",
  office: "",
  bio: "",
  university_id: "",
  university_name: "",
  department_id: "",
  department_name: "",
};

export default function SupervisorProfile() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load your profile.");
      }

      const data = { ...EMPTY_PROFILE, ...result.profile };
      setProfile(data);
      setOriginalProfile(data);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save your profile.");
      }

      setMessage(result.message || "Profile updated successfully.");
      setEditing(false);
      await loadProfile();
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setProfile(originalProfile);
    setEditing(false);
    setError("");
    setMessage("");
  }

  const initials =
    `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() ||
    "SP";

  function field(label, name, options = {}) {
    const {
      type = "text",
      multiline = false,
      placeholder = "",
      readOnly = false,
    } = options;

    return (
      <div className={`sp-field ${multiline ? "sp-field-wide" : ""}`} key={name}>
        <label htmlFor={name}>{label}</label>

        {editing && !readOnly ? (
          multiline ? (
            <textarea
              id={name}
              name={name}
              value={profile[name] ?? ""}
              onChange={handleChange}
              placeholder={placeholder}
              rows={4}
            />
          ) : (
            <input
              id={name}
              name={name}
              type={type}
              value={profile[name] ?? ""}
              onChange={handleChange}
              placeholder={placeholder}
            />
          )
        ) : (
          <div className="sp-field-value">
            {profile[name] || "Not provided"}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="sp-page">
        <div className="sp-loading">
          <span className="sp-spinner" />
          Loading your profile...
        </div>
      </main>
    );
  }

  return (
    <main className="sp-page">
      <div className="sp-background-orb sp-orb-one" />
      <div className="sp-background-orb sp-orb-two" />

      <div className="sp-container">
        <header className="sp-topbar">
          <Link to="/supervisor/dashboard" className="sp-back-link">
            <span aria-hidden="true">←</span> Back to Dashboard
          </Link>

          <span className="sp-topbar-label">SUPERVISOR PORTAL</span>
        </header>

        <section className="sp-heading">
          <div>
            <p className="sp-eyebrow">YOUR PROFESSIONAL IDENTITY</p>
            <h1>My Profile<span>.</span></h1>
            <p className="sp-subtitle">
              Manage your personal details, academic credentials and research profile.
            </p>
          </div>

          {!editing && (
            <button
              type="button"
              className="sp-button sp-button-primary"
              onClick={() => {
                setMessage("");
                setError("");
                setEditing(true);
              }}
            >
              Edit Profile <span aria-hidden="true">↗</span>
            </button>
          )}
        </section>

        {error && <div className="sp-alert sp-alert-error">{error}</div>}
        {message && <div className="sp-alert sp-alert-success">{message}</div>}

        <section className="sp-identity-card">
          <div className="sp-avatar">{initials}</div>

          <div className="sp-identity-copy">
            <span className="sp-status">
              <span /> Supervisor Account
            </span>

            <h2>
              {profile.academic_title ? `${profile.academic_title} ` : ""}
              {profile.first_name} {profile.last_name}
            </h2>

            <p>{profile.specialization || "Academic Supervisor"}</p>
            <span className="sp-email">{profile.email}</span>
          </div>

          <div className="sp-identity-meta">
            <span>STAFF NUMBER</span>
            <strong>{profile.staff_number || "Not assigned"}</strong>
            <span>DEPARTMENT</span>
            <strong>{profile.department_name || "Not specified"}</strong>
          </div>
        </section>

        <form onSubmit={handleSave}>
          <section className="sp-section">
            <div className="sp-section-heading">
              <span className="sp-section-icon">01</span>
              <div>
                <h2>Personal Information</h2>
                <p>Your account and contact details.</p>
              </div>
            </div>

            <div className="sp-fields">
              {field("First Name", "first_name")}
              {field("Last Name", "last_name")}
              {field("Email Address", "email", { type: "email" })}
              {field("Phone Number", "phone", {
                placeholder: "Enter your phone number",
              })}
            </div>
          </section>

          <section className="sp-section">
            <div className="sp-section-heading">
              <span className="sp-section-icon">02</span>
              <div>
                <h2>Professional Information</h2>
                <p>Your academic appointment and qualifications.</p>
              </div>
            </div>

            <div className="sp-fields">
              {field("Staff Number", "staff_number")}
              {field("Academic Title", "academic_title", {
                placeholder: "e.g. Dr., Professor",
              })}
              {field("Specialization", "specialization", {
                placeholder: "Your primary academic specialization",
              })}
              {field("Office Location", "office", {
                placeholder: "Building, room or office location",
              })}
              {field("Qualifications", "qualifications", {
                multiline: true,
                placeholder: "Degrees, certifications and professional qualifications",
              })}
            </div>
          </section>

          <section className="sp-section">
            <div className="sp-section-heading">
              <span className="sp-section-icon">03</span>
              <div>
                <h2>Institutional Information</h2>
                <p>Your university and departmental affiliation.</p>
              </div>
            </div>

            <div className="sp-fields">
              {field("University", "university_name", { readOnly: true })}
              {field("Department", "department_name", { readOnly: true })}
            </div>
            <p className="sp-note">
              University and department affiliations are displayed from your
              institutional records. Contact your administrator if they need changing.
            </p>
          </section>

          <section className="sp-section">
            <div className="sp-section-heading">
              <span className="sp-section-icon">04</span>
              <div>
                <h2>Research Profile</h2>
                <p>Share your interests and academic background.</p>
              </div>
            </div>

            <div className="sp-fields">
              {field("Research Interests", "research_interests", {
                multiline: true,
                placeholder: "e.g. Machine Learning, AI Healthcare, NLP",
              })}
              {field("Professional Biography", "bio", {
                multiline: true,
                placeholder: "Write a brief professional biography...",
              })}
            </div>
          </section>

          {editing && (
            <div className="sp-form-actions">
              <button
                type="button"
                className="sp-button sp-button-secondary"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="sp-button sp-button-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </form>

        <footer className="sp-footer">
          <span>ACATRACE</span>
          <span>Academic growth. Research impact.</span>
        </footer>
      </div>
    </main>
  );
}
