import bcrypt from "bcryptjs";
import { pool } from "./db";

export const initializeDatabase = async () => {
  try {
    // 1. Create Franchises Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS franchises (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'franchise',
        franchise_id INT REFERENCES franchises(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create Material Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_orders (
        id SERIAL PRIMARY KEY,
        franchise_id INT NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id),
        order_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        notes TEXT,
        bill_image_url TEXT,
        bill_amount NUMERIC(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create Order Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
        item_name VARCHAR(150) NOT NULL,
        quantity NUMERIC(10, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'kg',
        notes TEXT,
        is_checked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure is_checked column exists in existing tables
    await pool.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_checked BOOLEAN DEFAULT FALSE;
    `);

    // 5. Create Cash Transactions (Ledger / Khata) Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id SERIAL PRIMARY KEY,
        franchise_id INT NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
        recorded_by_user_id INT NOT NULL REFERENCES users(id),
        transaction_type VARCHAR(50) NOT NULL, -- 'branch_to_admin' or 'admin_to_branch'
        amount NUMERIC(12, 2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash', -- 'cash', 'upi', 'bank'
        transaction_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create Keep Alive Ping Table (Prevents Render and Supabase from sleeping)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS keep_alive_pings (
        id INT PRIMARY KEY DEFAULT 1,
        service_name VARCHAR(100) DEFAULT 'render_backend',
        last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ping_count INT DEFAULT 1
      );
    `);

    // 7. Create Workers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50),
        designation VARCHAR(100) DEFAULT 'कामगार',
        salary_type VARCHAR(20) DEFAULT 'monthly',
        monthly_salary NUMERIC(10, 2) DEFAULT 0,
        daily_wage NUMERIC(10, 2) DEFAULT 0,
        joining_date DATE DEFAULT CURRENT_DATE,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        franchise_id INT REFERENCES franchises(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Create Worker Attendance Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_attendance (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
        notes TEXT,
        recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_worker_attendance UNIQUE (worker_id, attendance_date)
      );
    `);

    // 9. Create Worker Advances Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_advances (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_mode VARCHAR(50) DEFAULT 'cash',
        notes TEXT,
        recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Create Worker Salary Settlements Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_salary_settlements (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        month_year VARCHAR(7) NOT NULL,
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

    console.log("Database tables verified / created successfully.");

    // 5. Seed Franchises if none exist - Single Branch: Bhilwadi, Sangli
    const franchiseCount = await pool.query("SELECT COUNT(*) FROM franchises");
    if (parseInt(franchiseCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO franchises (name, code, address, phone) VALUES
        ('अरिहंत बाजार (भिलवडी, सांगली)', 'BHILWADI', 'भिलवडी, ता. पलूस, जि. सांगली', '9876543210');
      `);
      console.log("Seeded default franchise: Bhilwadi, Sangli.");
    }

    // 6. Seed Admin & Branch User if none exist
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      const hashedAdminPass = await bcrypt.hash("admin123", 10);
      const hashedBranchPass = await bcrypt.hash("branch123", 10);

      // Admin user
      await pool.query(`
        INSERT INTO users (name, email, password, role)
        VALUES ('अरिहंत बाजार मुख्य ॲडमिन', 'admin@mart.com', $1, 'admin');
      `, [hashedAdminPass]);

      // Franchise Manager for Bhilwadi
      const branchRes = await pool.query("SELECT id, name, code FROM franchises WHERE code = 'BHILWADI' LIMIT 1");
      const branch = branchRes.rows[0];
      if (branch) {
        await pool.query(`
          INSERT INTO users (name, email, password, role, franchise_id)
          VALUES ('भिलवडी शाखा व्यवस्थापक', 'bhilwadi@mart.com', $1, 'franchise', $2);
        `, [hashedBranchPass, branch.id]);
        console.log("Seeded Admin and Bhilwadi Branch Manager user.");
      }
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
};
