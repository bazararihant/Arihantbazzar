const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres.haiolainieyptbqcynwp',
  password: process.env.DB_PASSWORD || 'Aniket@7075',
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Creating user_fcm_tokens table if not exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        fcm_token TEXT NOT NULL,
        device_type VARCHAR(50) DEFAULT 'android',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, fcm_token)
      );
    `);
    console.log("user_fcm_tokens table ready!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

run();
