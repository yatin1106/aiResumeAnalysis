# 🔍 AI Resume Analyser

> Built this because I was tired of not knowing why my resume wasn't getting calls. So I made something that actually tells you.

**Live Demo → https://ai-resume-analysis-kappa.vercel.app)

---

## What it does

You drop in your resume as a PDF, and it runs a strict ATS (Applicant Tracking System) analysis on it using Groq's LLM. It doesn't sugarcoat — it tells you your actual ATS score, what's working, what's not, and exactly what to fix.

Sections you get back:
- **Overall Summary** — a brutal honest take on your resume as a whole
- **Skills Assessment** — are your skills ATS-keyword-rich or are you missing the obvious ones
- **Experience Review** — are your bullets quantified? are your action verbs strong?
- **Education** — is it formatted so an ATS can actually read it
- **Improvements** — at least 8 specific things to fix, not generic advice
- **ATS Score** — a real score with a Content / Format / Impact breakdown

---

## Tech Stack

**Frontend**
- React + Vite
- Plain CSS (no UI library, no Tailwind)
- Deployed on Vercel

**Backend**
- Node.js + Express
- Multer for PDF upload handling
- pdf-parse for text extraction
- Groq SDK (`llama-3.3-70b-versatile`) for the analysis
- Deployed on Render

---

## Running it locally

### Backend

```bash
cd backend
npm install
```

Create a `.env` file:
```
GROQ_API_KEY=your_groq_api_key_here
```

```bash
node server.js
# runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# runs on http://localhost:5173
```

Make sure your `vite.config.js` has the proxy set up:
```js
server: {
  proxy: {
    '/api/analyse': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/analyse/, '/analyse')
    }
  }
}
```

---

## Project Structure

```
aiResumeAnalyser/
├── backend/
│   ├── routes/
│   │   └── analyse.js
│   ├── server.js
│   ├── .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── App.css
    ├── vite.config.js
    └── package.json
```

---

## Notes

- Free Render tier spins down after inactivity — first request might take ~30 seconds, just wait it out
- Only accepts PDF files
- If it doesn't detect resume-like content in the PDF it'll reject it early
- The ATS score is strict on purpose — average resumes land in the 45-65 range

---

## Get a Groq API Key

Free and fast — grab one at [console.groq.com](https://console.groq.com)

---

Made by Yatin Khatri
