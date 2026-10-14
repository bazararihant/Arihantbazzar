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

    // 5. Create Keep Alive Ping Table (Prevents Render and Supabase from sleeping)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS keep_alive_pings (
        id INT PRIMARY KEY DEFAULT 1,
        service_name VARCHAR(100) DEFAULT 'render_backend',
        last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ping_count INT DEFAULT 1
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
