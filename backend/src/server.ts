import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { pool } from "./config/db";
import { initializeDatabase } from "./config/initDb";
import authRoutes from "./routes/authRoutes";
import orderRoutes from "./routes/orderRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import salaryRoutes from "./routes/salaryRoutes";

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded bill images statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/workers", salaryRoutes);

// Keep-Alive Ping Route (Keeps Render and Supabase alive 24/7)
app.get("/api/ping", async (req, res) => {
  try {
    const result = await pool.query(`
      INSERT INTO keep_alive_pings (id, service_name, last_ping, ping_count)
      VALUES (1, 'render_backend', NOW(), 1)
      ON CONFLICT (id) DO UPDATE SET
        last_ping = NOW(),
        ping_count = keep_alive_pings.ping_count + 1
      RETURNING *;
    `);

    res.json({
      status: "alive",
      message: "Render & Supabase keep-alive ping successful",
      pingData: result.rows[0],
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Ping Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
    await initializeDatabase();
  } catch (error) {
    console.error("Database startup error:", error);
  }

  // Automatic Background Ping Every 10 Minutes to Prevent Render & Supabase Sleep
  const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  setInterval(async () => {
    try {
      // 1. Ping Supabase Database table
      await pool.query(`
        INSERT INTO keep_alive_pings (id, service_name, last_ping, ping_count)
        VALUES (1, 'render_backend', NOW(), 1)
        ON CONFLICT (id) DO UPDATE SET
          last_ping = NOW(),
          ping_count = keep_alive_pings.ping_count + 1;
      `);
      console.log(`[Keep-Alive] Supabase DB pinged successfully at ${new Date().toISOString()}`);

      // 2. If Render public URL is set, ping HTTP endpoint
      const selfUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      if (selfUrl) {
        const pingUrl = selfUrl.startsWith("http") ? `${selfUrl}/api/ping` : `https://${selfUrl}/api/ping`;
        await fetch(pingUrl);
        console.log(`[Keep-Alive] Render HTTP self-ping sent to ${pingUrl}`);
      }
    } catch (err: any) {
      console.warn("[Keep-Alive] Warning on automatic ping:", err?.message || err);
    }
  }, PING_INTERVAL);
});