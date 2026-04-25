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

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a strict ATS resume reviewer. Respond ONLY with a valid JSON object. Keys: "summary", "skills", "experience", "education", "improvements", "score", "breakdown". "score" is a number. "breakdown" is an object with keys "Content", "Format", "Impact" as numbers.`,
        },
        {
          role: "user",
          content: `Analyze this resume and return a JSON object. For improvements, separate at least 6 points using " | ".
          
          Resume: ${resumeText.slice(0, 3000)}`,
        },
      ],
      temperature: 0.1,
    });

    let raw = completion.choices[0].message.content.trim();
    
    // --- THE FIX: SANITIZE THE STRING ---
    // This removes ```json or ``` blocks if the AI accidentally included them
    raw = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (parseError) {
        console.error("Failed to parse AI response:", raw);
        return res.status(500).json({ error: "AI returned invalid format. Try again." });
    }

    // Ensure improvements are formatted as bullets for your frontend logic
    if (typeof parsed.improvements === "string") {
      parsed.improvements = parsed.improvements
        .split(" | ")
        .map(s => `- ${s.trim()}`)
        .join("\n");
    }

    res.json(parsed);

  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;