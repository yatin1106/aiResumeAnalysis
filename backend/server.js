const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const analyzeRoute = require("./routes/analyse");
const jobsRoute = require("./routes/jobs");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://ai-resume-analysis-kappa.vercel.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// Global rate limit — all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for /analyse only
const analyseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 resume analyses per hour per IP
  message: { error: "Analysis limit reached. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use("/analyse", analyseLimiter, analyzeRoute);
app.use("/jobs", jobsRoute);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});