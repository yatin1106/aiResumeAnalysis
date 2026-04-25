import { useState, useRef, useCallback } from "react";
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

export default function App() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

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
     const res = await fetch("https://airesumeanalysis-1.onrender.com/analyse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Server error");
      setResult(data);
      setActiveTab("summary");
    } catch (err) {
      setError(err.message || "Analysis failed. Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = SECTIONS.map(s => `${s.label}\n${"─".repeat(30)}\n${result[s.key]}`).join("\n\n");
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

  const activeSection = SECTIONS.find(s => s.key === activeTab);
  const colors = activeSection ? SECTION_COLORS[activeSection.color] : SECTION_COLORS.purple;

  const renderContent = (text, color) => {
    if (!text) return <p className="muted">No data for this section.</p>;
    const c = SECTION_COLORS[color];
    return text.split("\n").map((line, i) => {
      const clean = line.replace(/^\*+|\*+$/g, "").trim();
      if (!clean) return null;
      if (clean.startsWith("-") || clean.startsWith("•")) {
        const content = clean.replace(/^[-•]\s*/, "");
        return (
          <div key={i} className="bullet-row">
            <span className="bullet-dot" style={{ background: c.bullet }} />
            <p className="bullet-text">{content}</p>
          </div>
        );
      }
      if (clean.match(/^\d+\./)) {
        const content = clean.replace(/^\d+\.\s*/, "");
        const num = clean.match(/^(\d+)/)[1];
        return (
          <div key={i} className="numbered-row">
            <span className="num-badge" style={{ background: c.tag, color: c.tagText }}>{num}</span>
            <p className="bullet-text">{content}</p>
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-text">ResumeAI</span>
          </div>
          <span className="tagline">Strict ATS-based resume analysis</span>
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
                  border: `1px solid ${getScoreColor(result.score)}40`
                }}
              >
                {getScoreLabel(result.score)}
              </div>

              <div className="breakdown">
                {result.breakdown && Object.entries(result.breakdown).map(([k, v]) => (
                  <div key={k} className="bar-row">
                    <span className="bar-label">{k}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${v}%`, background: getScoreColor(v) }}
                      />
                    </div>
                    <span className="bar-val">{v}</span>
                  </div>
                ))}
              </div>
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
                {SECTIONS.map(s => {
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