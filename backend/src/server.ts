import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { pool } from "./config/db";
import { initializeDatabase } from "./config/initDb";
import authRoutes from "./routes/authRoutes";
import orderRoutes from "./routes/orderRoutes";

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded bill images statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.json({
    message: "Mart Franchise Supply & Order Backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
    await initializeDatabase();
  } catch (error) {
    console.error("Database startup error:", error);
  }
});