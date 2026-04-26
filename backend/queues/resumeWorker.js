require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { analyzeResume } = require("../services/groqServices");
const { read, write } = require("../models/db");

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: {},
  maxRetriesPerRequest: null,
});

// Your existing keyword validation logic
const RESUME_KEYWORDS = ["experience", "education", "skills", "work", "employment", "resume", "cv", "projects", "internship", "university", "college", "degree"];

const worker = new Worker(
  "resume-analysis",
  async (job) => {
    const { jobId, filePath, jobRole } = job.data;
    console.log(`[Worker] Processing job ${jobId}`);

    // 1. Parse PDF (your existing logic, just reading from disk now)
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error("Could not extract text from PDF.");
    }

    // 2. Your keyword validation
    const matches = RESUME_KEYWORDS.filter((k) =>
      resumeText.toLowerCase().includes(k)
    );
    if (matches.length < 3) {
      throw new Error("This does not appear to be a resume. Please upload a valid resume PDF.");
    }

    // 3. Call Groq (your full prompt lives in groqService.js)
    const result = await analyzeResume(resumeText, jobRole);

    // 4. Store result
    const db = read();
    const idx = db.jobs.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      db.jobs[idx].status = "done";
      db.jobs[idx].result = result;
      db.jobs[idx].completedAt = new Date().toISOString();
    }
    write(db);

    // 5. Clean up file
    try { fs.unlinkSync(filePath); } catch {}

    console.log(`[Worker] Job ${jobId} done. Score: ${result.score}`);
    return result;
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
  try {
    const db = read();
    const idx = db.jobs.findIndex((j) => j.id === job.data.jobId);
    if (idx !== -1) {
      db.jobs[idx].status = "failed";
      db.jobs[idx].error = err.message;
    }
    write(db);
  } catch {}
});

console.log("[Worker] Started, waiting for jobs...");