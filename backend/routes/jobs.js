const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");

router.get("/:id", async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      jobRole: job.jobRole,
      result: job.result ? JSON.parse(job.result) : null,
      error: job.error || null,
      createdAt: job.createdAt,
    });
  } catch (err) {
    console.error("[Jobs] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

module.exports = router;