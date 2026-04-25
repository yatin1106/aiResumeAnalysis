const dotenv = require("dotenv");
dotenv.config(); // Render handles env vars automatically, but this is fine for local
const express = require("express");
const cors = require("cors"); // Use the cors package for easier management
const analyzeRoute = require("./routes/analyse");
const app = express();

// 1. UPDATED CORS: Allow both local testing and your production frontend
app.use(cors({
  origin: ["http://localhost:5173", "https://airesumeanalysis-1.onrender.com"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// 2. PATHING: Changed to /api/analyse to match standard naming
app.use("/api/analyse", analyzeRoute);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// 3. PORT: Render provides a dynamic port. Use process.env.PORT
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});