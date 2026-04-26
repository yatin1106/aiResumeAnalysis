const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { resumeQueue } = require("../queues/resumeQueue");
const { read, write } = require("../models/db");

// Switch from memoryStorage to diskStorage so the worker can read the file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/")),
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

router.post("/", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded." });
    }

    const jobId = uuidv4();
    const jobRole = req.body.jobRole || "Software Engineer";

    // Save job record
    const db = read();
    db.jobs.push({
      id: jobId,
      userId: req.user?.id || "anonymous",
      status: "pending",
      jobRole,
      fileName: req.file.originalname,
      createdAt: new Date().toISOString(),
      result: null,
      error: null,
    });
    write(db);

    // Enqueue — worker will do PDF parse + Groq call
    await resumeQueue.add(
      "analyze",
      {
        jobId,
        filePath: req.file.path,
        fileType: req.file.mimetype,
        jobRole,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    // Return instantly — client polls /jobs/:id
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