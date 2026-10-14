const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.haiolainieyptbqcynwp',
  password: 'Aniket@7075',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log("Connecting to Supabase PostgreSQL...");
    
    // 1. Add is_checked column to order_items
    await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_checked BOOLEAN DEFAULT FALSE;");
    console.log("Added is_checked column to order_items.");

    // 2. Update Franchise 1 to Arihant Bazar - Bhilwadi, Sangli
    await pool.query(`
      UPDATE franchises 
      SET name = 'अरिहंत बाजार (भिलवडी, सांगली)', 
          code = 'BHILWADI', 
          address = 'भिलवडी, ता. पलूस, जि. सांगली', 
          phone = '9876543210' 
      WHERE id = 1;
    `);
    console.log("Franchise 1 updated to Bhilwadi, Sangli.");

    // 3. Delete extra franchises (2, 3, 4) if present
    await pool.query("DELETE FROM users WHERE franchise_id IN (2, 3, 4);");
    await pool.query("DELETE FROM franchises WHERE id IN (2, 3, 4);");
    console.log("Removed extra branches.");

    // 4. Update Franchise User
    await pool.query(`
      UPDATE users 
      SET name = 'भिलवडी शाखा व्यवस्थापक', 
          email = 'bhilwadi@mart.com' 
      WHERE id = 2;
    `);

    // Also ensure admin has appropriate name
    await pool.query(`
      UPDATE users 
      SET name = 'अरिहंत बाजार मुख्य ॲडमिन' 
      WHERE role = 'admin' AND id = 1;
    `);

    // Add arihantbazar.com email aliases
    const bcrypt = require('bcryptjs');
    const adminPass = await bcrypt.hash('admin123', 10);
    const branchPass = await bcrypt.hash('branch123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('अरिहंत बाजार मुख्य ॲडमिन', 'admin@arihantbazar.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [adminPass]);
    await pool.query(`
      INSERT INTO users (name, email, password, role, franchise_id)
      VALUES ('भिलवडी शाखा व्यवस्थापक', 'bhilwadi@arihantbazar.com', $1, 'franchise', 1)
      ON CONFLICT (email) DO NOTHING;
    `, [branchPass]);
    console.log("Added user aliases.");

    // Verify
    const fRes = await pool.query("SELECT * FROM franchises ORDER BY id ASC");
    console.log("ACTIVE FRANCHISES IN DB:", fRes.rows);

    const uRes = await pool.query("SELECT id, name, email, role, franchise_id FROM users ORDER BY id ASC");
    console.log("ACTIVE USERS IN DB:", uRes.rows);

    const cRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_items'");
    console.log("ORDER_ITEMS COLUMNS:", cRes.rows.map(r => r.column_name));

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await pool.end();
  }
}

runMigration();
