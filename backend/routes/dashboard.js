const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const authMiddleware = require("../middleware/auth");

// Get resume history for logged in user
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id, status: "done" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        jobRole: true,
        fileName: true,
        result: true,
        createdAt: true,
      },
    });

    const history = jobs.map((job) => {
      const result = job.result ? JSON.parse(job.result) : null;
      return {
        id: job.id,
        jobRole: job.jobRole,
        fileName: job.fileName,
        score: result?.score || null,
        createdAt: job.createdAt,
      };
    });

    res.json({ history });
  } catch (err) {
    console.error("[Dashboard] History error:", err.message);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Get stats for logged in user
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id, status: "done" },
      select: { result: true },
    });

    const scores = jobs
      .map((j) => (j.result ? JSON.parse(j.result).score : null))
      .filter(Boolean);

    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    const best = scores.length ? Math.max(...scores) : null;

    res.json({
      totalAnalyses: jobs.length,
      averageScore: avg,
      bestScore: best,
    });
  } catch (err) {
    console.error("[Dashboard] Stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;