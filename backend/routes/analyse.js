const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { resumeQueue } = require("../queues/resumeQueue");
const prisma = require("../prismaClient");


// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

router.post("/", (req, res, next) => {
  upload.single("resume")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded." });
    }

    const jobId = uuidv4();
    const jobRole = req.body.jobRole || "Software Engineer";
    const userId = req.user?.id || null; // ← null, not "anonymous"

    // ← Save job record to Postgres, not file DB
    await prisma.job.create({
      data: {
        id: jobId,
        userId,
        status: "pending",
        jobRole,
        fileName: req.file.originalname,
      },
    });

    await resumeQueue.add(
      "analyze",
      {
        jobId,
        filePath: req.file.path,
        fileType: req.file.mimetype,
        jobRole,
        userId, // ← now passed to worker
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    res.status(202).json({
      jobId,
      status: "pending",
      message: "Resume queued for analysis",
    });
  } catch (err) {
    console.error("[Analyse] Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to queue resume" });
  }
});

module.exports = router;