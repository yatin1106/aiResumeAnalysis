const express = require("express");
const router = express.Router();
const multer = require("multer");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { resumeQueue, getRedisClient } = require("../queues/resumeQueue");
const prisma = require("../prismaClient");

const CACHE_TTL = 60 * 60 * 24; // 24 hours

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

router.post(
  "/",
  (req, res, next) => {
    upload.single("resume")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No resume file uploaded." });
      }

      const jobRole = req.body.jobRole || "Software Engineer";
      const userId = req.user?.id || null;

      // Generate hash of PDF buffer + jobRole
      const hash = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .update(jobRole)
        .digest("hex");

      const cacheKey = `resume:cache:${hash}`;

      // Check Redis cache
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[Cache] HIT for hash ${hash}`);
        return res.status(200).json({
          jobId: null,
          status: "done",
          cached: true,
          result: JSON.parse(cached),
        });
      }

      console.log(`[Cache] MISS for hash ${hash}`);

      const jobId = uuidv4();

      // Save job record to Postgres
      await prisma.job.create({
        data: {
          id: jobId,
          userId,
          status: "pending",
          jobRole,
          fileName: req.file.originalname,
        },
      });

      // Add to queue, pass cacheKey so worker can store result
      await resumeQueue.add(
        "analyze",
        {
          jobId,
          fileBuffer: req.file.buffer.toString("base64"),
          fileType: req.file.mimetype,
          jobRole,
          userId,
          cacheKey, // ← worker will use this to cache result
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
  }
);

module.exports = router;