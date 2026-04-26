const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined, // ← conditional
  maxRetriesPerRequest: null,
});

connection.on("connect", () => console.log("Redis connected"));
connection.on("error", (err) => console.error("Redis error:", err)); // ← error handling

const resumeQueue = new Queue("resume-analysis", { connection });

module.exports = { resumeQueue, connection };