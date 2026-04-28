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

const getKeywordGaps = (resumeText, jobRole) => {
  const keywords = ROLE_KEYWORDS[jobRole] || ROLE_KEYWORDS["Software Engineer"];
  const lowerText = resumeText.toLowerCase();
  const missing = keywords.filter((k) => !lowerText.includes(k.toLowerCase()));
  const present = keywords.filter((k) => lowerText.includes(k.toLowerCase()));
  return { missing, present, total: keywords.length };
};

const analyzeResume = async (resumeText, jobRole = "Software Engineer") => {
  const { missing, present, total } = getKeywordGaps(resumeText, jobRole);
  const keywordScore = Math.round((present.length / total) * 100);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a friendly but honest resume coach with 15 years of recruiting experience. You give balanced, constructive feedback — acknowledging what the candidate does well while clearly pointing out areas to improve. You never make someone feel like they have no skills. You always find genuine strengths to highlight before suggesting improvements.

Respond ONLY with a valid JSON object with exactly these keys:
- "summary": string
- "skills": string
- "experience": string
- "education": string
- "improvements": array of strings
- "score": number from 0-100
- "breakdown": object with keys "Content", "Format", "Impact", "Keywords" each a number from 0-100

Rules:
- "improvements" MUST be a JSON array of at least 6 strings, each a specific actionable point
- "score" should be fair — a decent resume with real experience scores 55-70, a strong one scores 70-85
- Always lead each section with what the candidate is doing right before mentioning gaps
- Never use | characters anywhere in your response`,
      },
      {
        role: "user",
        content: `Analyze this resume for a ${jobRole} role. Be specific and reference actual content from the resume.

Keyword Analysis (already computed):
- Keywords present: ${present.join(", ") || "none"}
- Keywords missing: ${missing.join(", ") || "none"}
- Keyword match score: ${keywordScore}%

Return a JSON object with:
- summary: Write 3-4 sentences. Start by naming the candidate and highlighting their strongest qualities and what makes them a viable candidate. Then mention 1-2 specific things that would improve their ATS compatibility. Keep the tone encouraging but honest.

- skills: Start by acknowledging the skills they do have and why those are valuable for a ${jobRole} role. Then mention the missing keywords (${missing.slice(0, 4).join(", ")}) and briefly explain why adding them would help. Keep it constructive.

- experience: Highlight what they've done well in their experience — any good use of action verbs, relevant projects, or domain experience. Then suggest specific ways to strengthen bullet points with numbers or metrics. Reference actual roles or projects from the resume.

- education: Acknowledge their educational background positively. Mention if the degree/institution is relevant to the role. Suggest any certifications or coursework that could strengthen their profile.

- improvements: Return a JSON array of exactly 8 actionable improvements. Frame each as an opportunity, not a criticism. At least 2 should mention adding missing keywords: ${missing.slice(0, 5).join(", ")}. Each should reference something specific from the resume.

- score: Give a fair ATS compatibility score 0-100. A resume with solid experience and some keyword gaps should score in the 55-72 range. Only penalize heavily for major formatting issues or completely missing sections.

- breakdown: Score these four dimensions from 0-100:
  - Content: quality and relevance of actual content
  - Format: ATS parseability and structure
  - Impact: strength of achievements and language
  - Keywords: based on keyword match score of ${keywordScore}%

Resume:
${resumeText.slice(0, 8000)}`,
      },
    ],
    temperature: 0.2,
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

  parsed.keywords = {
    present,
    missing,
    score: keywordScore,
  };

  return parsed;
};

module.exports = { analyzeResume };