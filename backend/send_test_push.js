const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const credPath = path.resolve(__dirname, 'firebase-service-account.json');
    if (!fs.existsSync(credPath)) {
      console.error('Service account key not found at:', credPath);
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    console.log('Initializing Firebase Admin with project:', serviceAccount.project_id);

    const app = initializeApp({
      credential: cert(serviceAccount)
    });

    const messaging = getMessaging(app);

    // Fetch all distinct tokens from DB
    const res = await pool.query('SELECT DISTINCT fcm_token FROM user_fcm_tokens WHERE fcm_token IS NOT NULL');
    const tokens = res.rows.map(r => r.fcm_token).filter(Boolean);

    console.log(`Found ${tokens.length} token(s) to send test push to.`);
    if (tokens.length === 0) {
      console.log('No tokens found. Register from device first.');
      process.exit(0);
    }

    const message = {
      notification: {
        title: '🔔 अरिहंत बाजार टेस्ट नोटिफिकेशन',
        body: 'ही अरिहंत बाजार ॲपची टेस्ट सूचना आहे. सर्व काही व्यवस्थित काम करत आहे! ✅'
      },
      data: {
        type: 'TEST_NOTIFICATION',
        time: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'orders_channel',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      tokens: tokens
    };

    console.log('Sending multicast push notification...');
    const result = await messaging.sendEachForMulticast(message);
    console.log(`✅ Success Count: ${result.successCount}`);
    console.log(`❌ Failure Count: ${result.failureCount}`);

    result.responses.forEach((resp, idx) => {
      if (resp.success) {
        console.log(`Token ${idx + 1}: Delivered successfully (Message ID: ${resp.messageId})`);
      } else {
        console.error(`Token ${idx + 1}: Failed (${resp.error?.code}: ${resp.error?.message})`);
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('Test push error:', err);
    process.exit(1);
  }
}

main();
