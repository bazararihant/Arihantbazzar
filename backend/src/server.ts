import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { pool } from "./config/db";
import { initializeDatabase } from "./config/initDb";
import { cleanupOldImages } from "./services/imageCleanupService";
import { executeDbHeartbeat } from "./services/heartbeatService";
import authRoutes from "./routes/authRoutes";
import orderRoutes from "./routes/orderRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import salaryRoutes from "./routes/salaryRoutes";

const app = express();

app.use(cors());

// Configure 50MB payload limits so base64 photos/bills upload without PayloadTooLargeError
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Ensure uploads directory exists and serve uploaded bill images statically
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn("[Uploads] Could not create uploads directory (serverless environment):", err);
  }
}
app.use("/uploads", express.static(uploadsDir));

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/workers", salaryRoutes);

// Keep-Alive Ping & Heartbeat Route (Inserts pulse record and deletes it immediately to keep DB active 24/7)
app.all(["/api/ping", "/api/heartbeat"], async (req, res) => {
  try {
    const result = await executeDbHeartbeat();
    res.json({
      status: "alive",
      message: "डेटाबेस हार्टबीट यशस्वी: एक रेकॉर्ड भरला आणि लगेच डिलीट केला. DB २४/७ कार्यरत राहील! ✅",
      heartbeat: result,
    });
  } catch (error: any) {
    console.error("Heartbeat Ping Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Test Push Notification Route
app.all("/api/test-notification", async (req, res) => {
  try {
    const { sendPushNotificationToAdmins, sendPushNotificationToFranchise } = await import("./services/notificationService");
    await sendPushNotificationToAdmins({
      title: "🔔 टेस्ट नोटिफिकेशन (Admin)",
      body: "अरिहंत बाजार ॲप नोटिफिकेशन यशस्वीरित्या कार्यरत आहे! ✅",
    });
    await sendPushNotificationToFranchise(1, {
      title: "🔔 टेस्ट नोटिफिकेशन (Franchise)",
      body: "अरिहंत बाजार भिलवडी शाखेसाठी टेस्ट नोटिफिकेशन! ✅",
    });

    res.json({
      success: true,
      message: "टेस्ट नोटिफिकेशन्स सर्व नोंदणीकृत डिव्हाइसेसवर पाठवण्यात आल्या आहेत! ✅",
    });
  } catch (error: any) {
    console.error("Test Notification Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Global Error Handler (Prevents server crash and provides user-friendly Marathi messages)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Server Error:", err);
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      message: "फोटोचा आकार खूप मोठा आहे. कृपया लहान आकाराचा फोटो निवडा.",
    });
  }
  return res.status(500).json({
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
    await initializeDatabase();

    // 1. Run 6-month image cleanup on startup
    cleanupOldImages().catch((err) =>
      console.warn("[Image Cleanup] Initial cleanup notice:", err?.message || err)
    );
  } catch (error) {
    console.error("Database startup error:", error);
  }

  // 2. Schedule Daily 6-Month Image Cleanup (Runs every 24 hours)
  const DAILY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await cleanupOldImages();
    } catch (err: any) {
      console.warn("[Image Cleanup] Daily scheduled cleanup notice:", err?.message || err);
    }
  }, DAILY_MS);

  // 3. Continuous DB Pulse: Inserts a dot into db_heartbeat and deletes it immediately every 5 minutes
  const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(async () => {
    try {
      await executeDbHeartbeat();
      console.log(`[Heartbeat] Continuous DB write & delete pulse executed at ${new Date().toISOString()}`);

      // If public URL is set, ping HTTP endpoint
      const selfUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      if (selfUrl) {
        const pingUrl = selfUrl.startsWith("http") ? `${selfUrl}/api/ping` : `https://${selfUrl}/api/ping`;
        await fetch(pingUrl);
      }
    } catch (err: any) {
      console.warn("[Heartbeat] Warning on automatic pulse:", err?.message || err);
    }
  }, HEARTBEAT_INTERVAL);
});
