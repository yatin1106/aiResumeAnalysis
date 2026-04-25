const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const { Groq } = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded." });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(fileBuffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Could not extract text from PDF." });
    }

    const resumeKeywords = ["experience", "education", "skills", "work", "employment", "resume", "cv", "projects", "internship", "university", "college", "degree"];
    const lowerText = resumeText.toLowerCase();
    const matches = resumeKeywords.filter(k => lowerText.includes(k));
    if (matches.length < 3) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "This does not appear to be a resume. Please upload a valid resume PDF." });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a strict ATS resume reviewer. You must respond with a valid JSON object with exactly these keys: "summary", "skills", "experience", "education", "improvements", "score", "breakdown". "score" is a number 0-100. "breakdown" is an object with keys "Content", "Format", "Impact" each a number 0-100. All string values must be plain text with no special characters. Separate multiple points within a string using " | ".`,
        },
        {
          role: "user",
          content: `Strictly analyze this resume for ATS compatibility. Return a JSON object with:
- summary: overall ATS assessment
- skills: keyword and ATS analysis of skills  
- experience: quantification and action verb analysis
- education: ATS formatting review
- improvements: at least 6 actionable ATS improvements separated by " | "
- score: ATS score 0-100, be strict, average is 50-60
- breakdown: object with Content, Format, Impact each 0-100

Resume:
${resumeText.slice(0, 3000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    fs.unlinkSync(req.file.path);

    const raw = completion.choices[0].message.content.trim();
    console.log("GROQ RAW OUTPUT:", raw);

    const parsed = JSON.parse(raw);

    const required = ["summary", "skills", "experience", "education", "improvements", "score", "breakdown"];
    for (const key of required) {
      if (parsed[key] === undefined) {
        return res.status(500).json({ error: `Missing field in AI response: ${key}` });
      }
    }

    if (typeof parsed.improvements === "string") {
      parsed.improvements = parsed.improvements.split(" | ").map(s => `- ${s.trim()}`).join("\n");
    }

    res.json(parsed);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Resume analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze resume." });
  }
});

module.exports = router;