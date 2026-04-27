require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Worker } = require("bullmq");
const pdfParse = require("pdf-parse");
const { analyzeResume } = require("../services/groqServices");
const { connection } = require("./resumeQueue");
const prisma = require("../prismaClient");

const RESUME_KEYWORDS = [
  "experience", "education", "skills", "work", "employment",
  "resume", "cv", "projects", "internship", "university",
  "college", "degree"
];

const worker = new Worker(
  "resume-analysis",
  async (job) => {
    const { jobId, fileBuffer, jobRole, userId } = job.data;
    console.log(`[Worker] Processing job ${jobId}`);
    await job.updateProgress(10);

    // 1. Decode buffer and parse PDF
    const buffer = Buffer.from(fileBuffer, "base64");
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
        userId: userId || null,
        content: resumeText,
        score: result.score || null,
        feedback: JSON.stringify(result),
      },
    });

    // 5. Update job status to done
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "done",
        result: JSON.stringify(result),
      },
    });

    await job.updateProgress(100);
    console.log(`[Worker] Job ${job.id} done. Score: ${result.score}`);
    return result;
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("failed", async (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
  try {
    await prisma.job.update({
      where: { id: job.data.jobId },
      data: { status: "failed", error: err.message },
    });
  } catch (e) {
    console.error("[Worker] Could not update job status:", e.message);
  }
});

console.log("[Worker] Started, waiting for jobs...");