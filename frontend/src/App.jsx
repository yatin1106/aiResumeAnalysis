// v2=6
import { useState, useRef, useCallback, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "./App.css";

const SECTIONS = [
  { key: "summary", label: "Overall Summary", icon: "◈", color: "purple" },
  { key: "skills", label: "Skills Assessment", icon: "◎", color: "blue" },
  { key: "experience", label: "Experience Review", icon: "◉", color: "green" },
  { key: "education", label: "Education", icon: "▣", color: "amber" },
  { key: "improvements", label: "Improvements", icon: "◇", color: "red" },
];

const SECTION_COLORS = {
  purple: { bg: "#f4f3ff", border: "#c4b8f8", bullet: "#6d4ed7", tag: "#ede9fe", tagText: "#5b3fbf" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", bullet: "#2563eb", tag: "#dbeafe", tagText: "#1d4ed8" },
  green:  { bg: "#f0fdf4", border: "#bbf7d0", bullet: "#16a34a", tag: "#dcfce7", tagText: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", bullet: "#d97706", tag: "#fef3c7", tagText: "#b45309" },
  red:    { bg: "#fff1f2", border: "#fecdd3", bullet: "#e11d48", tag: "#ffe4e6", tagText: "#be123c" },
};

const API_URL = "https://airesumeanalysis-production-32af.up.railway.app";

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, name };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo" style={{ justifyContent: "center", marginBottom: 24 }}>
          <span className="logo-mark">◈</span>
          <span className="logo-text">ResumeAI</span>
        </div>
        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Login</button>
          <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>Sign Up</button>
        </div>
        {mode === "register" && (
          <input className="auth-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="auth-input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="auth-input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error-msg">⚠ {error}</p>}
        <button className="analyse-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Login" : "Create Account"}
        </button>
        <p className="auth-skip" onClick={() => onAuth(null, null)}>Continue without account →</p>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function Dashboard({ user, token, onBack, onLogout }) {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [histRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/dashboard/history`, { headers }),
          fetch(`${API_URL}/dashboard/stats`, { headers }),
        ]);
        const histData = await histRes.json();
        const statsData = await statsRes.json();
        setHistory(histData.history || []);
        setStats(statsData);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const getScoreColor = (score) => {
    if (score >= 75) return "#16a34a";
    if (score >= 55) return "#d97706";
    return "#e11d48";
  };

  // Prepare chart data — oldest first
  const chartData = [...history]
    .filter((h) => h.score)
    .reverse()
    .map((h, i) => ({
      name: `#${i + 1} ${h.fileName.replace(".pdf", "").slice(0, 12)}`,
      score: h.score,
      date: new Date(h.createdAt).toLocaleDateString(),
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{d.name}</p>
          <p style={{ margin: 0, color: getScoreColor(d.score) }}>Score: {d.score}/100</p>
          <p style={{ margin: 0, color: "#888" }}>{d.date}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-text">ResumeAI</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#666" }}>{user?.email}</span>
            <button className="copy-btn" onClick={onBack}>+ New Analysis</button>
            <button className="copy-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <h2 style={{ marginBottom: 24, fontWeight: 700 }}>Your Dashboard</h2>

        {/* Stats */}
        {stats && (
          <div className="stats-row">
            <div className="stat-card">
              <p className="stat-num">{stats.totalAnalyses}</p>
              <p className="stat-label">Total Analyses</p>
            </div>
            <div className="stat-card">
              <p className="stat-num" style={{ color: getScoreColor(stats.averageScore) }}>
                {stats.averageScore ?? "—"}
              </p>
              <p className="stat-label">Average Score</p>
            </div>
            <div className="stat-card">
              <p className="stat-num" style={{ color: getScoreColor(stats.bestScore) }}>
                {stats.bestScore ?? "—"}
              </p>
              <p className="stat-label">Best Score</p>
            </div>
          </div>
        )}

        {/* Score History Chart */}
        {chartData.length > 1 && (
          <div className="card" style={{ marginBottom: 32, padding: 24 }}>
            <p className="card-label" style={{ marginBottom: 16 }}>Score Progress</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6d4ed7"
                  strokeWidth={2.5}
                  dot={{ fill: "#6d4ed7", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History List */}
        <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Resume History</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="muted">No analyses yet. Upload your first resume!</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <div>
                  <p className="history-filename">{item.fileName}</p>
                  <p className="history-meta">{item.jobRole} · {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                {item.score && (
                  <span className="history-score" style={{ color: getScoreColor(item.score) }}>
                    {item.score}/100
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [page, setPage] = useState("auth");
  const fileRef = useRef();

  useEffect(() => {
    if (token && user) setPage("home");
  }, []);

  const handleAuth = (user, token) => {
    setUser(user);
    setToken(token);
    setPage("home");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setPage("auth");
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setResult(null);
      setError(null);
    } else {
      setError("Please upload a PDF file.");
    }
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f?.type === "application/pdf") {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobRole", "Software Engineer");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}/analyse`, {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Server error");

      if (data.status === "done" && data.result) {
        setResult(data.result);
        setActiveTab("summary");
        return;
      }

      const jobId = data.jobId;
      let analysisResult = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const poll = await fetch(`${API_URL}/jobs/${jobId}`);
        const pollData = await poll.json();
        if (pollData.status === "done") {
          analysisResult = pollData.result;
          break;
        } else if (pollData.status === "failed") {
          throw new Error(pollData.error || "Analysis failed");
        }
      }

      if (!analysisResult) throw new Error("Timed out waiting for analysis");
      setResult(analysisResult);
      setActiveTab("summary");
    } catch (err) {
      setError(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = SECTIONS.map((s) => {
      const content = Array.isArray(result[s.key]) ? result[s.key].join("\n") : result[s.key];
      return `${s.label}\n${"─".repeat(30)}\n${content}`;
    }).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setResult(null);
    setError(null);
  };

  const activeSection = SECTIONS.find((s) => s.key === activeTab);
  const colors = activeSection ? SECTION_COLORS[activeSection.color] : SECTION_COLORS.purple;

  const renderContent = (text, color) => {
    if (!text) return <p className="muted">No data for this section.</p>;
    const c = SECTION_COLORS[color];
    const lines = Array.isArray(text) ? text : text.split("\n").filter((l) => l.trim());
    return lines.map((line, i) => {
      const clean = line.replace(/^\*+|\*+$/g, "").trim();
      if (!clean) return null;
      if (clean.startsWith("-") || clean.startsWith("•")) {
        return (
          <div key={i} className="bullet-row">
            <span className="bullet-dot" style={{ background: c.bullet }} />
            <p className="bullet-text">{clean.replace(/^[-•]\s*/, "")}</p>
          </div>
        );
      }
      if (clean.match(/^\d+\./)) {
        const num = clean.match(/^(\d+)/)[1];
        return (
          <div key={i} className="numbered-row">
            <span className="num-badge" style={{ background: c.tag, color: c.tagText }}>{num}</span>
            <p className="bullet-text">{clean.replace(/^\d+\.\s*/, "")}</p>
          </div>
        );
      }
      return <p key={i} className="plain-line">{clean}</p>;
    });
  };

  const getScoreColor = (score) => {
    if (score >= 75) return "#16a34a";
    if (score >= 55) return "#d97706";
    return "#e11d48";
  };

  const getScoreLabel = (score) => {
    if (score >= 75) return "ATS Friendly";
    if (score >= 55) return "Needs Work";
    return "Poor ATS Fit";
  };

  if (page === "auth") return <AuthPage onAuth={handleAuth} />;
  if (page === "dashboard") return (
    <Dashboard user={user} token={token} onBack={() => setPage("home")} onLogout={handleLogout} />
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-text">ResumeAI</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="tagline">Strict ATS-based resume analysis</span>
            {user ? (
              <>
                <button className="copy-btn" onClick={() => setPage("dashboard")}>Dashboard</button>
                <button className="copy-btn" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <button className="copy-btn" onClick={() => setPage("auth")}>Login</button>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <div className="left-panel">
          <div className="card upload-card">
            <p className="card-label">Upload Resume</p>
            <div
              className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileInput} hidden />
              {file ? (
                <div className="file-info">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  <button className="remove-btn" onClick={removeFile}>✕ Remove</button>
                </div>
              ) : (
                <div className="drop-prompt">
                  <div className="drop-arrow">↑</div>
                  <p className="drop-main">Drag & drop your PDF</p>
                  <p className="drop-sub">or click to browse</p>
                </div>
              )}
            </div>
            {error && <p className="error-msg">⚠ {error}</p>}
            <button className="analyse-btn" onClick={handleAnalyse} disabled={!file || loading}>
              {loading && <span className="spinner" />}
              {loading ? "Analysing…" : "Analyse Resume"}
            </button>
          </div>

          {result && (
            <div className="card score-card">
              <p className="card-label">ATS Score</p>
              <div className="score-circle">
                <svg viewBox="0 0 80 80" className="score-svg">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#ebebeb" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={getScoreColor(result.score)}
                    strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - result.score / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="score-text">
                  <span className="score-num" style={{ color: getScoreColor(result.score) }}>{result.score}</span>
                  <span className="score-denom">/100</span>
                </div>
              </div>
              <div
                className="score-badge"
                style={{
                  background: `${getScoreColor(result.score)}18`,
                  color: getScoreColor(result.score),
                  border: `1px solid ${getScoreColor(result.score)}40`,
                }}
              >
                {getScoreLabel(result.score)}
              </div>
              <div className="breakdown">
                {result.breakdown && Object.entries(result.breakdown).map(([k, v]) => (
                  <div key={k} className="bar-row">
                    <span className="bar-label">{k}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${v}%`, background: getScoreColor(v) }} />
                    </div>
                    <span className="bar-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.keywords && (
            <div className="card keyword-card">
              <p className="card-label">Keyword Gap Analysis</p>
              <div className="keyword-score">
                <span style={{ color: getScoreColor(result.keywords.score) }}>
                  {result.keywords.score}% match
                </span>
              </div>
              {result.keywords.present?.length > 0 && (
                <div className="keyword-section">
                  <p className="keyword-title" style={{ color: "#16a34a" }}>✓ Present</p>
                  <div className="keyword-tags">
                    {result.keywords.present.map((k) => (
                      <span key={k} className="keyword-tag present">{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.keywords.missing?.length > 0 && (
                <div className="keyword-section">
                  <p className="keyword-title" style={{ color: "#e11d48" }}>✗ Missing</p>
                  <div className="keyword-tags">
                    {result.keywords.missing.map((k) => (
                      <span key={k} className="keyword-tag missing">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="right-panel">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h3>No analysis yet</h3>
              <p>Upload a PDF resume and click Analyse to get strict ATS feedback.</p>
            </div>
          )}
          {loading && (
            <div className="empty-state">
              <div className="dots"><span /><span /><span /></div>
              <p className="loading-text">Analysing your resume…</p>
            </div>
          )}
          {result && (
            <div className="results-wrap">
              <div className="results-top">
                <p className="card-label" style={{ margin: 0 }}>Analysis Results</p>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? "✓ Copied" : "⎘ Copy All"}
                </button>
              </div>
              <div className="tabs">
                {SECTIONS.map((s) => {
                  const c = SECTION_COLORS[s.color];
                  return (
                    <button
                      key={s.key}
                      className={`tab ${activeTab === s.key ? "active" : ""}`}
                      onClick={() => setActiveTab(s.key)}
                      style={activeTab === s.key ? {
                        background: c.bg,
                        borderColor: c.border,
                        color: c.bullet,
                      } : {}}
                    >
                      <span className="tab-icon">{s.icon}</span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="content-box" style={{ background: colors.bg, borderColor: colors.border }}>
                <h3 className="content-heading" style={{ color: colors.bullet, borderBottomColor: colors.border }}>
                  {activeSection?.label}
                </h3>
                <div className="content-body">
                  {renderContent(result[activeTab], activeSection?.color)}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}