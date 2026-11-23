import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/register.css";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "student",
    academic_level: "",
    password: "",
    confirm_password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (form.role === "student" && !form.academic_level) {
      setMessage("Please select your academic level.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setMessage("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/register.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage("Registration successful. Redirecting...");

        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (error) {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">

        {/* LEFT SIDE */}
        <div className="register-brand">

          <Link to="/" className="register-logo">
            Aca<span>Trace</span>
          </Link>

          <h1>
            Start tracking your academic journey.
          </h1>

          <p>
            Create your AcaTrace account and bring research,
            projects, supervision, milestones, meetings and
            academic progress into one organized workspace.
          </p>

          <div className="register-benefits">
            <div>✓ Track academic and research progress</div>
            <div>✓ Manage milestones and deadlines</div>
            <div>✓ Organize supervision meetings</div>
            <div>✓ Keep academic activities structured</div>
          </div>

        </div>

        {/* REGISTRATION CARD */}
        <div className="register-card">

          <div className="register-header">
            <h2>Create your account</h2>
            <p>Set up your AcaTrace account in a few minutes.</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* NAME */}
            <div className="form-row">

              <div className="form-group">
                <label>First name</label>

                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Last name</label>

                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                />
              </div>

            </div>

            {/* EMAIL */}
            <div className="form-group">
              <label>Email address</label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* ROLE */}
            <div className="form-group">
              <label>Account type</label>

              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
              >
                <option value="student">Student</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {/* ACADEMIC LEVEL */}
            {form.role === "student" && (
              <div className="form-group">

                <label>Academic level</label>

                <select
                  name="academic_level"
                  value={form.academic_level}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select academic level
                  </option>

                  <option value="Diploma">
                    Diploma
                  </option>

                  <option value="Undergraduate">
                    Undergraduate
                  </option>

                  <option value="Postgraduate">
                    Postgraduate
                  </option>
                </select>

              </div>
            )}

            {/* PASSWORD */}
            <div className="form-group">
              <label>Password</label>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="form-group">
              <label>Confirm password</label>

              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Repeat your password"
                required
              />
            </div>

            {/* MESSAGE */}
            {message && (
              <div className="register-message">
                {message}
              </div>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              className="register-button"
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : "Create Account"}
            </button>

          </form>

          <div className="register-login">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Register;