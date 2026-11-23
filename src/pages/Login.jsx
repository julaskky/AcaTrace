
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost/acatrace/api/login.php",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Invalid email or password.");
        return;
      }

      // Support the common login response structures.
      const role = String(
        data.user?.role ?? data.role ?? ""
      ).toLowerCase();

      if (role === "student") {
        navigate("/student/dashboard", { replace: true });
      } else if (role === "supervisor") {
        navigate("/supervisor/dashboard", { replace: true });
      } else if (role === "admin" || role === "administrator") {
        navigate("/administrator/dashboard", { replace: true });
      } else {
        setMessage(
          "Login succeeded, but the server did not return a recognized user role. Please check login.php."
        );
      }
    } catch (error) {
      setMessage(
        "Unable to connect to the server. Check that XAMPP Apache and MySQL are running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-brand">
          <Link to="/" className="login-logo">
            Aca<span>Trace</span>
          </Link>

          <h1>Welcome back.</h1>

          <p>
            Continue managing your academic and research
            journey with AcaTrace.
          </p>

          <div className="login-highlights">
            <div>✓ Track progress and milestones</div>
            <div>✓ Manage supervision activities</div>
            <div>✓ Stay on top of deadlines</div>
          </div>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h2>Sign in</h2>
            <p>Enter your account details to continue.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            {message && (
              <div className="login-message" role="alert">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="login-register">
            Don't have an account?{" "}
            <Link to="/register">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;