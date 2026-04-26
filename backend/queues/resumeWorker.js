require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Worker } = require("bullmq");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { analyzeResume } = require("../services/groqServices");
const { connection } = require("./resumeQueue"); // ← import, don't recreate
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const RESUME_KEYWORDS = [
  "experience", "education", "skills", "work", "employment",
  "resume", "cv", "projects", "internship", "university",
  "college", "degree"
];

const worker = new Worker(
  "resume-analysis",
  async (job) => {
    const { jobId, filePath, jobRole, userId } = job.data; // ← plain, no hyperlink
    console.log(`[Worker] Processing job ${jobId}`);

    await job.updateProgress(10); // ← progress tracking

    // 1. Parse PDF
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found — may have been cleaned up already.");
    }
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error("Could not extract text from PDF.");
    }

    await job.updateProgress(30);

    // 2. Keyword validation
    const matches = RESUME_KEYWORDS.filter((k) =>
      resumeText.toLowerCase().includes(k)
    );
    if (matches.length < 3) {
      throw new Error("This does not appear to be a resume.");
    }

    await job.updateProgress(50);

    // 3. AI Analysis
    const result = await analyzeResume(resumeText, jobRole);

    await job.updateProgress(80);

    // 4. Store in Postgres
    await prisma.resume.create({
      data: {
        userId: userId || null, // ← nullable, not "anonymous"
        content: resumeText,
        score: result.score || null,
        feedback: JSON.stringify(result),
      },
    });
    // After prisma.resume.create(...) in the worker
await prisma.job.update({
  where: { id: jobId },
  data: {
    status: "done",
    result: JSON.stringify(result),
  },
});

// In worker.on("failed")
worker.on("failed", async (job, err) => {
  await prisma.job.update({
    where: { id: job.data.jobId },
    data: { status: "failed", error: err.message },
  });
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
});

    // 5. Cleanup — after DB write succeeds
    try { fs.unlinkSync(filePath); } catch (e) {
      console.warn(`[Worker] Could not delete file: ${filePath}`, e.message);
    }

    await job.updateProgress(100);
    console.log(`[Worker] Job ${job.id} done. Score: ${result.score}`); // ← plain job.id
    return result;
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
});

console.log("[Worker] Started, waiting for jobs...");