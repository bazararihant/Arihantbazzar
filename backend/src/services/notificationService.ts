import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";

let isFirebaseInitialized = false;

export const initFirebase = () => {
    if (getApps().length > 0) {
        isFirebaseInitialized = true;
        return true;
    }

    try {
        let serviceAccountPath = path.resolve(__dirname, "../../firebase-service-account.json");
        if (!fs.existsSync(serviceAccountPath)) {
            serviceAccountPath = path.resolve(__dirname, "../../arihant-a3d5d-firebase-adminsdk-fbsvc-9f6d6c1f9a.json");
        }

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
            initializeApp({
                credential: cert(serviceAccount),
            });
            isFirebaseInitialized = true;
            console.log("Firebase Admin successfully initialized with:", path.basename(serviceAccountPath));
            return true;
        } else {
            console.warn("Notice: firebase-service-account.json not found in backend directory. Push notifications will be ready once the service account key is placed.");
            return false;
        }
    } catch (err) {
        console.error("Firebase Admin initialization error:", err);
        return false;
    }
};

export const sendPushNotificationToAdmins = async (payload: {
    title: string;
    body: string;
    orderId?: number;
    type?: string;
}) => {
    try {
        // Fetch all FCM tokens of users who have role = 'admin'
        const result = await pool.query(`
            SELECT DISTINCT t.fcm_token 
            FROM user_fcm_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE u.role = 'admin' AND t.fcm_token IS NOT NULL
        `);

        const tokens: string[] = result.rows.map((r: any) => r.fcm_token).filter(Boolean);

        if (tokens.length === 0) {
            console.log("No admin FCM tokens registered yet in database.");
            return;
        }

        const initialized = initFirebase();
        if (!initialized) {
            console.log(`[Push Notification Queued] ${tokens.length} admin(s) | Title: ${payload.title} | Body: ${payload.body}`);
            return;
        }

        const messagePayload = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                orderId: payload.orderId ? String(payload.orderId) : "",
                type: payload.type || "NEW_ORDER",
            },
            tokens,
        };

        const response = await getMessaging().sendEachForMulticast(messagePayload);
        console.log(`Successfully sent ${response.successCount} push notifications (${response.failureCount} failed).`);
    } catch (error) {
        console.error("Error sending push notification to admins:", error);
    }
};
