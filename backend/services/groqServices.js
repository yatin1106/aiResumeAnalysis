const { Groq } = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Role-based keyword maps
const ROLE_KEYWORDS = {
  "Software Engineer": [
    "algorithms", "data structures", "system design", "REST API", "microservices",
    "CI/CD", "unit testing", "git", "agile", "scalability", "distributed systems"
  ],
  "Data Scientist": [
    "machine learning", "python", "pandas", "numpy", "tensorflow", "pytorch",
    "SQL", "statistics", "data pipeline", "model training", "feature engineering"
  ],
  "Frontend Engineer": [
    "react", "javascript", "typescript", "CSS", "HTML", "webpack", "REST API",
    "responsive design", "accessibility", "performance optimization", "testing"
  ],
  "Backend Engineer": [
    "node.js", "REST API", "database", "SQL", "microservices", "docker",
    "kubernetes", "caching", "message queue", "authentication", "scalability"
  ],
  "DevOps Engineer": [
    "docker", "kubernetes", "CI/CD", "terraform", "AWS", "GCP", "monitoring",
    "logging", "infrastructure", "automation", "linux", "bash"
  ],
  "Product Manager": [
    "roadmap", "stakeholder", "agile", "scrum", "metrics", "KPI", "user research",
    "product strategy", "A/B testing", "prioritization", "OKR"
  ],
};

// Detect missing keywords based on role
const getKeywordGaps = (resumeText, jobRole) => {
  const keywords = ROLE_KEYWORDS[jobRole] || ROLE_KEYWORDS["Software Engineer"];
  const lowerText = resumeText.toLowerCase();
  const missing = keywords.filter((k) => !lowerText.includes(k.toLowerCase()));
  const present = keywords.filter((k) => lowerText.includes(k.toLowerCase()));
  return { missing, present, total: keywords.length };
};

const analyzeResume = async (resumeText, jobRole = "Software Engineer") => {
  // Keyword gap detection before AI call
  const { missing, present, total } = getKeywordGaps(resumeText, jobRole);
  const keywordScore = Math.round((present.length / total) * 100);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert ATS (Applicant Tracking System) resume reviewer with 15 years of recruiting experience. You give brutally honest, detailed, and actionable feedback.
Respond ONLY with a valid JSON object with exactly these keys:
- "summary": string
- "skills": string  
- "experience": string
- "education": string
- "improvements": array of strings
- "score": number from 0-100
- "breakdown": object with keys "Content", "Format", "Impact", "Keywords" each a number from 0-100
Rules:
- "improvements" MUST be a JSON array of at least 6 strings, each a detailed actionable point
- "score" must be strict — average resumes score 45-65, only exceptional ones score 75+
- All string fields must be detailed paragraphs with specific observations, not generic advice
- Never use | characters anywhere in your response`,
      },
      {
        role: "user",
        content: `Perform a strict ATS compatibility analysis on this resume for a ${jobRole} role. Be specific, detailed, and reference actual content from the resume.

Keyword Analysis (already computed):
- Keywords present: ${present.join(", ") || "none"}
- Keywords missing: ${missing.join(", ") || "none"}
- Keyword match score: ${keywordScore}%

Return a JSON object with:
- summary: Write 3-4 sentences covering the candidate's overall profile, their ATS compatibility level, what stands out positively, and what immediately hurts their chances. Name the candidate if possible.
- skills: Analyze whether the skills listed are ATS-keyword-rich. Reference the missing keywords above and explain why they matter for a ${jobRole} role. Be specific about what's present and what's missing.
- experience: Evaluate each role — are achievements quantified with numbers and percentages? Are strong action verbs used? Is the experience section ATS-friendly in format? Call out specific weak bullet points and explain why they fail ATS screening.
- education: Is the education section complete with degree name, institution, graduation year? Is it formatted so ATS can parse it correctly? Any certifications or relevant coursework that should be added?
- improvements: Return a JSON array of exactly 8 specific, actionable improvements. Each must reference something actual in the resume and explain exactly how to fix it. Include at least 2 improvements about adding missing keywords: ${missing.slice(0, 5).join(", ")}.
- score: Give a strict ATS compatibility score 0-100. Factor in the keyword match score of ${keywordScore}%.
- breakdown: Score these four dimensions strictly from 0-100:
  - Content: quality and relevance of the actual content
  - Format: ATS parseability and structure
  - Impact: strength of achievements and language used
  - Keywords: based on the keyword match score of ${keywordScore}%

Resume:
${resumeText.slice(0, 8000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const raw = completion.choices[0].message.content.trim();
  console.log("GROQ RAW OUTPUT:", raw);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    console.error("Failed to parse AI response:", raw);
    throw new Error("AI returned invalid format");
  }

  if (!Array.isArray(parsed.improvements)) {
    if (typeof parsed.improvements === "string") {
      parsed.improvements = parsed.improvements
        .split("\n")
        .filter((s) => s.trim())
        .map((s) => s.replace(/^[-•]\s*/, "").trim());
    } else {
      parsed.improvements = [];
    }
  }

  const required = ["summary", "skills", "experience", "education", "improvements", "score", "breakdown"];
  for (const key of required) {
    if (parsed[key] === undefined) {
      throw new Error(`Missing field in AI response: ${key}`);
    }
  }

  // Attach keyword data to result
  parsed.keywords = {
    present,
    missing,
    score: keywordScore,
  };

  return parsed;
};

module.exports = { analyzeResume };