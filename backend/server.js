const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const analyzeRoute = require("./routes/analyse");
const jobsRoute = require("./routes/jobs");
const authRoute = require("./routes/auth");
const dashboardRoute = require("./routes/dashboard");

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

const app = express();
app.set("trust proxy", 1); // ← add this line

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://ai-resume-analysis-kappa.vercel.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for /analyse only
const analyseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Analysis limit reached. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use("/analyse", analyseLimiter, analyzeRoute);
app.use("/jobs", jobsRoute);
app.use("/auth", authRoute);
app.use("/dashboard", dashboardRoute);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = { logger };