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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Database tables verified / created successfully.");

    // 5. Seed Franchises if none exist
    const franchiseCount = await pool.query("SELECT COUNT(*) FROM franchises");
    if (parseInt(franchiseCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO franchises (name, code, address, phone) VALUES
        ('Mart Express - Branch 1', 'BR01', 'Shivaji Nagar, Pune', '9876543210'),
        ('Mart Express - Branch 2', 'BR02', 'Kothrud, Pune', '9876543211'),
        ('Mart Express - Branch 3', 'BR03', 'Hadapsar, Pune', '9876543212'),
        ('Mart Express - Branch 4', 'BR04', 'Wakad, Pune', '9876543213');
      `);
      console.log("Seeded 4 default franchises.");
    }

    // 6. Seed Admin & Branch Users if none exist
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      const hashedAdminPass = await bcrypt.hash("admin123", 10);
      const hashedBranchPass = await bcrypt.hash("branch123", 10);

      // Admin user
      await pool.query(`
        INSERT INTO users (name, email, password, role)
        VALUES ('Central Admin', 'admin@mart.com', $1, 'admin');
      `, [hashedAdminPass]);

      // Franchise Managers
      const branches = await pool.query("SELECT id, name, code FROM franchises ORDER BY id ASC");
      for (let i = 0; i < branches.rows.length; i++) {
        const branch = branches.rows[i];
        const email = `branch${i + 1}@mart.com`;
        await pool.query(`
          INSERT INTO users (name, email, password, role, franchise_id)
          VALUES ($1, $2, $3, 'franchise', $4);
        `, [
          `${branch.name} Manager`,
          email,
          hashedBranchPass,
          branch.id
        ]);
      }
      console.log("Seeded Admin and 4 Franchise Manager users.");

      // Seed 1 Sample Order for Branch 1
      const branch1 = branches.rows[0];
      const branch1User = await pool.query("SELECT id FROM users WHERE email = 'branch1@mart.com'");
      if (branch1 && branch1User.rows.length > 0) {
        const sampleOrder = await pool.query(`
          INSERT INTO material_orders (franchise_id, user_id, status, notes)
          VALUES ($1, $2, 'pending', 'Urgent morning stock needed')
          RETURNING id;
        `, [branch1.id, branch1User.rows[0].id]);

        const orderId = sampleOrder.rows[0].id;
        await pool.query(`
          INSERT INTO order_items (order_id, item_name, quantity, unit) VALUES
          ($1, 'Sugar (साखर)', 50, 'kg'),
          ($1, 'Cooking Oil (खाद्यतेल)', 10, 'litre'),
          ($1, 'Wheat Flour / Atta (गहू पीठ)', 25, 'kg'),
          ($1, 'Tea Powder (चहा पावडर)', 5, 'kg');
        `, [orderId]);
        console.log("Seeded sample order for Branch 1.");
      }
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
};
