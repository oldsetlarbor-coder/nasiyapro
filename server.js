require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const { pool } = require("./src/db");
const { sendDueReminders } = require("./src/reminders");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.APP_URL || true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "NasiyaPro API" });
  } catch {
    res.status(503).json({ ok: false, error: "Database unavailable" });
  }
});

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/shop", require("./src/routes/shop"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/telegram", require("./src/routes/telegram"));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`NasiyaPro running on port ${port}`));

// Run once every day at 09:00 server time. Set server timezone to Asia/Tashkent in production.
cron.schedule("0 9 * * *", async () => {
  try { await sendDueReminders(); }
  catch (err) { console.error("Reminder job failed:", err.message); }
}, { timezone: "Asia/Tashkent" });
