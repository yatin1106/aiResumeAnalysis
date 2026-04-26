const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./routes/analyse");
const jobsRoute = require("./routes/jobs"); // ← was missing

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://ai-resume-analysis-kappa.vercel.app", // ← env var
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use("/analyse", analyzeRoute);
app.use("/jobs", jobsRoute); // ← was missing

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});