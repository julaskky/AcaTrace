import "../styles/home.css";

function Home() {
  return (
    <div className="home-page">

      {/* Navigation */}
      <header className="navbar">
        <div className="container nav-content">
          <a href="/" className="brand">
            <span className="brand-mark">A</span>
            <span>AcaTrace</span>
          </a>

          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#universities">For Universities</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-actions">
            <a href="/login" className="login-link">Sign In</a>
            <a href="/register" className="btn btn-primary">Get Started</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main>

        <section className="hero">
          <div className="container hero-grid">

            <div className="hero-content">
              <div className="eyebrow">
                <span className="eyebrow-dot"></span>
                Postgraduate Research Management
              </div>

              <h1>
                Keep every research journey
                <span> on track.</span>
              </h1>

              <p className="hero-text">
                AcaTrace helps universities and postgraduate supervisors
                organize students, research milestones, meetings, tasks and
                progress in one beautifully connected workspace.
              </p>

              <div className="hero-actions">
                <a href="/register" className="btn btn-primary btn-large">
                  Get Started
                  <span>→</span>
                </a>

                <a href="#how-it-works" className="btn btn-secondary btn-large">
                  See how it works
                </a>
              </div>

              <div className="hero-trust">
                <div className="trust-avatars">
                  <span>U</span>
                  <span>R</span>
                  <span>S</span>
                </div>

                <div>
                  <strong>Built for academic teams</strong>
                  <small>Supervisors, students & universities</small>
                </div>
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="hero-visual">
              <div className="dashboard-window">

                <div className="window-top">
                  <div className="window-dots">
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>

                  <span>AcaTrace Dashboard</span>
                </div>

                <div className="dashboard-body">

                  <div className="preview-sidebar">
                    <div className="preview-logo">A</div>

                    <div className="preview-menu active">
                      <span>⌂</span>
                      Dashboard
                    </div>

                    <div className="preview-menu">
                      <span>♙</span>
                      Students
                    </div>

                    <div className="preview-menu">
                      <span>◫</span>
                      Research
                    </div>

                    <div className="preview-menu">
                      <span>✓</span>
                      Tasks
                    </div>

                    <div className="preview-menu">
                      <span>◷</span>
                      Meetings
                    </div>
                  </div>

                  <div className="preview-main">

                    <div className="preview-header">
                      <div>
                        <small>GOOD MORNING</small>
                        <h3>Welcome back, Supervisor</h3>
                      </div>

                      <div className="preview-avatar">JS</div>
                    </div>

                    <div className="stat-grid">

                      <div className="stat-card">
                        <span>Students</span>
                        <strong>24</strong>
                        <small>↑ 3 this month</small>
                      </div>

                      <div className="stat-card">
                        <span>On Track</span>
                        <strong>18</strong>
                        <small>75% of students</small>
                      </div>

                      <div className="stat-card">
                        <span>Tasks</span>
                        <strong>12</strong>
                        <small>5 due this week</small>
                      </div>

                    </div>

                    <div className="progress-card">
                      <div className="card-heading">
                        <div>
                          <span>Research Progress</span>
                          <small>Student overview</small>
                        </div>

                        <span className="view-link">View all →</span>
                      </div>

                      <div className="student-progress">
                        <div className="student-info">
                          <span className="student-avatar">AM</span>
                          <div>
                            <strong>Alex Morgan</strong>
                            <small>PhD · Computer Science</small>
                          </div>
                        </div>

                        <div className="progress-line">
                          <div className="progress-track">
                            <div style={{ width: "78%" }}></div>
                          </div>
                          <span>78%</span>
                        </div>
                      </div>

                      <div className="student-progress">
                        <div className="student-info">
                          <span className="student-avatar">SK</span>
                          <div>
                            <strong>Sarah Kim</strong>
                            <small>MSc · Data Science</small>
                          </div>
                        </div>

                        <div className="progress-line">
                          <div className="progress-track">
                            <div style={{ width: "64%" }}></div>
                          </div>
                          <span>64%</span>
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              </div>

              <div className="floating-card floating-one">
                <span className="floating-icon">✓</span>
                <div>
                  <strong>Milestone completed</strong>
                  <small>Literature Review</small>
                </div>
              </div>

              <div className="floating-card floating-two">
                <span className="floating-icon">◷</span>
                <div>
                  <strong>Next meeting</strong>
                  <small>Tomorrow · 10:00 AM</small>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Features */}
        <section className="features-section" id="features">
          <div className="container">

            <div className="section-heading">
              <span className="section-label">ONE CONNECTED WORKSPACE</span>

              <h2>
                Everything you need to
                <span> supervise with confidence.</span>
              </h2>

              <p>
                Replace scattered spreadsheets, emails and documents with
                one clear view of every postgraduate research journey.
              </p>
            </div>

            <div className="feature-grid">

              <article className="feature-card">
                <div className="feature-icon">♙</div>
                <h3>Student Management</h3>
                <p>
                  Keep student profiles, programmes, research information
                  and supervision records organized in one place.
                </p>
              </article>

              <article className="feature-card featured">
                <div className="feature-icon">◫</div>
                <h3>Research Progress</h3>
                <p>
                  Track milestones and see exactly where every research
                  project stands at a glance.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-icon">✓</div>
                <h3>Tasks & Deadlines</h3>
                <p>
                  Assign supervision tasks, monitor outstanding work and
                  keep important deadlines visible.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-icon">◷</div>
                <h3>Meetings & Notes</h3>
                <p>
                  Record supervision meetings, decisions and follow-up
                  actions without losing important details.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-icon">◉</div>
                <h3>Progress Overview</h3>
                <p>
                  Get a clear overview of students who are progressing well
                  and those who may need attention.
                </p>
              </article>

              <article className="feature-card">
                <div className="feature-icon">▦</div>
                <h3>University Ready</h3>
                <p>
                  Designed to scale from individual supervisors to
                  departments and universities.
                </p>
              </article>

            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="how-section" id="how-it-works">
          <div className="container">

            <div className="section-heading centered">
              <span className="section-label">HOW IT WORKS</span>

              <h2>
                A simpler way to
                <span> supervise research.</span>
              </h2>
            </div>

            <div className="steps">

              <div className="step">
                <div className="step-number">01</div>
                <h3>Add your students</h3>
                <p>
                  Create organized profiles for every postgraduate
                  researcher you supervise.
                </p>
              </div>

              <div className="step-line"></div>

              <div className="step">
                <div className="step-number">02</div>
                <h3>Define milestones</h3>
                <p>
                  Establish research stages, tasks and important
                  completion dates.
                </p>
              </div>

              <div className="step-line"></div>

              <div className="step">
                <div className="step-number">03</div>
                <h3>Track progress</h3>
                <p>
                  Monitor progress, meetings and outstanding tasks from
                  one simple dashboard.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* University section */}
        <section className="university-section" id="universities">
          <div className="container university-grid">

            <div>
              <span className="section-label">FOR UNIVERSITIES</span>

              <h2>
                Bring postgraduate supervision
                <span> into one system.</span>
              </h2>

              <p>
                AcaTrace is designed to grow from individual supervisors
                to departments and institution-wide postgraduate research
                management.
              </p>

              <a href="/register" className="btn btn-primary">
                Get Started
                <span>→</span>
              </a>
            </div>

            <div className="university-panel">
              <div className="panel-stat">
                <strong>24</strong>
                <span>Researchers</span>
              </div>

              <div className="panel-stat">
                <strong>18</strong>
                <span>On Track</span>
              </div>

              <div className="panel-stat">
                <strong>92%</strong>
                <span>Milestone Completion</span>
              </div>
            </div>

          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="container cta-content">
            <span className="section-label">START WITH A BETTER WORKFLOW</span>

            <h2>
              Give every research journey
              <span> the attention it deserves.</span>
            </h2>

            <p>
              Bring your postgraduate supervision workflow together
              with AcaTrace.
            </p>

            <a href="/register" className="btn btn-light btn-large">
              Create your account
              <span>→</span>
            </a>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="footer" id="about">
        <div className="container footer-content">

          <div>
            <a href="/" className="brand footer-brand">
              <span className="brand-mark">A</span>
              <span>AcaTrace</span>
            </a>

            <p>
              Postgraduate research supervision,
              beautifully organized.
            </p>
          </div>

          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#universities">Universities</a>
            <a href="/login">Sign In</a>
          </div>

        </div>

        <div className="container footer-bottom">
          <span>© 2026 AcaTrace. All rights reserved.</span>
          <span>Built for better research supervision.</span>
        </div>
      </footer>

    </div>
  );
}

export default Home;