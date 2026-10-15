const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log("Creating workers and salary management tables...");

    // 1. Workers Table (कामगार यादी - लेबर/स्टाफ)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50),
        designation VARCHAR(100) DEFAULT 'कामगार',
        salary_type VARCHAR(20) DEFAULT 'monthly', -- 'monthly' or 'daily'
        monthly_salary NUMERIC(10, 2) DEFAULT 0,
        daily_wage NUMERIC(10, 2) DEFAULT 0,
        joining_date DATE DEFAULT CURRENT_DATE,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        franchise_id INT REFERENCES franchises(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("1. workers table ready.");

    // 2. Worker Attendance Table (दैनिक हजेरी: पूर्ण, अर्धा, गैरहजर)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_attendance (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL, -- 'full_day', 'half_day', 'absent'
        multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.0, -- 1.0, 0.5, 0.0
        notes TEXT,
        recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_worker_attendance UNIQUE (worker_id, attendance_date)
      );
    `);
    console.log("2. worker_attendance table ready.");

    // 3. Worker Advances Table (पगारातून उचल / अॅडव्हान्स)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_advances (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_mode VARCHAR(50) DEFAULT 'cash', -- 'cash', 'upi', 'bank'
        notes TEXT,
        recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("3. worker_advances table ready.");

    // 4. Worker Salary Settlements Table (पगार जमा / चुकता केला)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_salary_settlements (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
        total_days NUMERIC(5, 1) NOT NULL,
        base_salary NUMERIC(10, 2) NOT NULL,
        earned_salary NUMERIC(10, 2) NOT NULL,
        advance_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0,
        net_paid_amount NUMERIC(10, 2) NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_mode VARCHAR(50) DEFAULT 'cash',
        notes TEXT,
        recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("4. worker_salary_settlements table ready.");

    // Seed default franchise if needed
    const fRes = await pool.query("SELECT id FROM franchises ORDER BY id ASC LIMIT 1");
    const franchiseId = fRes.rows[0]?.id || 1;

    // Seed sample workers if none exist
    const countRes = await pool.query("SELECT COUNT(*) FROM workers");
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log("Seeding sample workers...");
      await pool.query(`
        INSERT INTO workers (name, phone, designation, salary_type, monthly_salary, daily_wage, franchise_id)
        VALUES 
          ('सचिन पवार', '9822114455', 'पॅकर व लोडर', 'monthly', 15000.00, 500.00, $1),
          ('समीर कांबळे', '9890223344', 'हेल्पर', 'monthly', 12000.00, 400.00, $1)
      `, [franchiseId]);
      console.log("Sample workers seeded successfully.");
    }

    console.log("All tables and initial data migrated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

runMigration();
