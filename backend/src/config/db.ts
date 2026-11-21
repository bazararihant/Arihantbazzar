import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || "aws-0-ap-south-1.pooler.supabase.com",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "postgres.haiolainieyptbqcynwp",
      password: process.env.DB_PASSWORD || "Aniket@7075",
      database: process.env.DB_NAME || "postgres",
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    });

pool.on("connect", () => {
  console.log("PostgreSQL database connected");
});

pool.on("error", (error: any) => {
  console.error("PostgreSQL connection error:", error?.message || error);
});
