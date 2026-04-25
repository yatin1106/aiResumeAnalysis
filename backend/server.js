const dotenv = require("dotenv");
dotenv.config(); 
const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./routes/analyse");
const app = express();

// 1. OPEN CORS (The "Kill All Errors" version)
app.use(cors()); 

app.use(express.json());

// 2. MOUNT ROUTE
app.use("/analyse", analyzeRoute);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// 3. PORT (Essential for Render)
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});