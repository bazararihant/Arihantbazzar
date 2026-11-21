import { pool } from "../config/db";

/**
 * DB Heartbeat Service
 * Inserts a dot/record into the db_heartbeat table, then deletes it immediately.
 * This continuous read/write/delete cycle keeps the PostgreSQL database active and prevents Supabase from sleeping.
 */
export const executeDbHeartbeat = async () => {
  const client = await pool.connect();
  try {
    // 1. Fill column with a dot ('.')
    const insertRes = await client.query(`
      INSERT INTO db_heartbeat (pulse, created_at)
      VALUES ('.', NOW())
      RETURNING id, pulse, created_at;
    `);

    const insertedId = insertRes.rows[0]?.id;

    // 2. Delete the record immediately ("तोच delete होईल परत")
    if (insertedId) {
      await client.query(`DELETE FROM db_heartbeat WHERE id = $1;`, [insertedId]);
    }

    // 3. Clear any records older than 1 minute to prevent clutter
    await client.query(`
      DELETE FROM db_heartbeat 
      WHERE created_at < NOW() - INTERVAL '1 minute';
    `);

    // 4. Update keep_alive_pings summary table
    await client.query(`
      INSERT INTO keep_alive_pings (id, service_name, last_ping, ping_count)
      VALUES (1, 'render_backend', NOW(), 1)
      ON CONFLICT (id) DO UPDATE SET
        last_ping = NOW(),
        ping_count = keep_alive_pings.ping_count + 1;
    `);

    return {
      success: true,
      action: "insert_and_delete_pulse",
      pulse: ".",
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("[Heartbeat] Error running DB heartbeat:", error?.message || error);
    throw error;
  } finally {
    client.release();
  }
};
