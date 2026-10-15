const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Checking columns in users table...");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)");

    const fRes = await pool.query("SELECT id, name FROM franchises ORDER BY id ASC LIMIT 1");
    const franchiseId = fRes.rows[0]?.id || 1;
    console.log("Using Franchise ID:", franchiseId);

    const hashAdmin = await bcrypt.hash("9067559001", 10);
    const hashSubAdmin = await bcrypt.hash("7507111008", 10);

    // 1. Seed or Update Admin Amit
    const checkAmit = await pool.query("SELECT id FROM users WHERE LOWER(username) = 'amit' OR LOWER(name) = 'amit' OR phone = '9067559001'");
    if (checkAmit.rows.length > 0) {
      await pool.query(
        "UPDATE users SET name = 'amit', username = 'amit', phone = '9067559001', password = $1, role = 'admin' WHERE id = $2",
        [hashAdmin, checkAmit.rows[0].id]
      );
      console.log("Updated existing Amit admin user (id: " + checkAmit.rows[0].id + ")");
    } else {
      await pool.query(
        "INSERT INTO users (name, username, phone, email, password, role) VALUES ('amit', 'amit', '9067559001', 'amit@arihantbazar.com', $1, 'admin')",
        [hashAdmin]
      );
      console.log("Created new Amit admin user");
    }

    // 2. Seed or Update Sub-Admin Bagesh
    const checkBagesh = await pool.query("SELECT id FROM users WHERE LOWER(username) = 'bagesh' OR LOWER(name) = 'bagesh' OR phone = '7507111008'");
    if (checkBagesh.rows.length > 0) {
      await pool.query(
        "UPDATE users SET name = 'bagesh', username = 'bagesh', phone = '7507111008', password = $1, role = 'sub_admin', franchise_id = $2 WHERE id = $3",
        [hashSubAdmin, franchiseId, checkBagesh.rows[0].id]
      );
      console.log("Updated existing Bagesh sub-admin user (id: " + checkBagesh.rows[0].id + ")");
    } else {
      await pool.query(
        "INSERT INTO users (name, username, phone, email, password, role, franchise_id) VALUES ('bagesh', 'bagesh', '7507111008', 'bagesh@arihantbazar.com', $1, 'sub_admin', $2)",
        [hashSubAdmin, franchiseId]
      );
      console.log("Created new Bagesh sub-admin user");
    }

    const allUsers = await pool.query("SELECT id, name, username, phone, email, role, franchise_id FROM users ORDER BY id ASC");
    console.log("All current users:", allUsers.rows);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

run();
