const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./routes/analyse");
const app = express();

app.use(cors({
  origin: "https://ai-resume-analysis-kappa.vercel.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.options("*", cors());

app.use(express.json());
app.use("/analyse", analyzeRoute);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});