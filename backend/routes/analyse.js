const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { Groq } = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded." });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from PDF." });
    }

    const resumeKeywords = ["experience", "education", "skills", "work", "employment", "resume", "cv", "projects", "internship", "university", "college", "degree"];
    const matches = resumeKeywords.filter(k => resumeText.toLowerCase().includes(k));
    if (matches.length < 3) {
      return res.status(400).json({ error: "This does not appear to be a resume. Please upload a valid resume PDF." });
    }

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
- "breakdown": object with keys "Content", "Format", "Impact" each a number from 0-100

Rules:
- "improvements" MUST be a JSON array of at least 6 strings, each a detailed actionable point
- "score" must be strict — average resumes score 45-65, only exceptional ones score 75+
- All string fields must be detailed paragraphs with specific observations, not generic advice
- Never use | characters anywhere in your response`,
        },
        {
          role: "user",
          content: `Perform a strict ATS compatibility analysis on this resume. Be specific, detailed, and reference actual content from the resume.

Return a JSON object with:

- summary: Write 3-4 sentences covering the candidate's overall profile, their ATS compatibility level, what stands out positively, and what immediately hurts their chances. Name the candidate if possible.

- skills: Analyze whether the skills listed are ATS-keyword-rich. Are they relevant to their target role? Are they missing critical industry keywords? Are they listed in a way ATS can parse them? Be specific about what's present and what's missing.

- experience: Evaluate each role — are achievements quantified with numbers and percentages? Are strong action verbs used? Is the experience section ATS-friendly in format? Call out specific weak bullet points and explain why they fail ATS screening.

- education: Is the education section complete with degree name, institution, graduation year? Is it formatted so ATS can parse it correctly? Any certifications or relevant coursework that should be added?

- improvements: Return a JSON array of exactly 8 specific, actionable improvements. Each must reference something actual in the resume and explain exactly how to fix it. No generic advice.

- score: Give a strict ATS compatibility score 0-100. Be harsh — justify mentally based on keyword density, formatting, quantification, and completeness.

- breakdown: Score these three dimensions strictly from 0-100:
  - Content: quality and relevance of the actual content
  - Format: ATS parseability and structure
  - Impact: strength of achievements and language used

Resume:
${resumeText.slice(0, 4000)}`,
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
      return res.status(500).json({ error: "AI returned invalid format. Try again." });
    }

    if (Array.isArray(parsed.improvements)) {
      parsed.improvements = parsed.improvements.map(s => `- ${s.trim()}`).join("\n");
    } else if (typeof parsed.improvements === "string") {
      parsed.improvements = parsed.improvements
        .split("\n")
        .filter(s => s.trim())
        .map(s => `- ${s.replace(/^[-•]\s*/, "").trim()}`)
        .join("\n");
    }

    const required = ["summary", "skills", "experience", "education", "improvements", "score", "breakdown"];
    for (const key of required) {
      if (parsed[key] === undefined) {
        return res.status(500).json({ error: `Missing field in AI response: ${key}` });
      }
    }

    res.json(parsed);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;