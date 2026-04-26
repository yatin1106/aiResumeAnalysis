// backend/queues/resumeQueue.js
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: {},           // Upstash requires TLS
  maxRetriesPerRequest: null,
});

const resumeQueue = new Queue("resume-analysis", { connection });

module.exports = { resumeQueue, connection };