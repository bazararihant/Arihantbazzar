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
        let serviceAccount: any = null;

        // 1. Check FIREBASE_SERVICE_ACCOUNT environment variable (for Vercel / Cloud serverless)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            } catch {
                try {
                    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf-8");
                    serviceAccount = JSON.parse(decoded);
                } catch (parseErr) {
                    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:", parseErr);
                }
            }
        }

        // 2. Check local file paths
        if (!serviceAccount) {
            const potentialPaths = [
                path.resolve(__dirname, "../../firebase-service-account.json"),
                path.resolve(__dirname, "../../../firebase-service-account.json"),
                path.resolve(__dirname, "../../arihant-a3d5d-firebase-adminsdk-fbsvc-9f6d6c1f9a.json"),
                path.resolve(process.cwd(), "firebase-service-account.json"),
                path.resolve(process.cwd(), "backend/firebase-service-account.json"),
            ];

            for (const p of potentialPaths) {
                if (fs.existsSync(p)) {
                    serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
                    console.log("Firebase Admin loaded key from file:", path.basename(p));
                    break;
                }
            }
        }

        if (serviceAccount) {
            initializeApp({
                credential: cert(serviceAccount),
            });
            isFirebaseInitialized = true;
            console.log("Firebase Admin successfully initialized.");
            return true;
        } else {
            console.warn("Notice: Firebase service account credentials not found. Push notifications will be ready once FIREBASE_SERVICE_ACCOUNT is set in environment or file is placed.");
            return false;
        }
    } catch (err) {
        console.error("Firebase Admin initialization error:", err);
        return false;
    }
};

// Send multicast notification to tokens with Android channel configuration
const sendMulticast = async (tokens: string[], payload: {
    title: string;
    body: string;
    orderId?: number;
    type?: string;
}) => {
    if (tokens.length === 0) return;

    const initialized = initFirebase();
    if (!initialized) {
        console.log(`[Push Notification Queued] ${tokens.length} recipient(s) | Title: ${payload.title} | Body: ${payload.body}`);
        return;
    }

    const messagePayload = {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
            orderId: payload.orderId ? String(payload.orderId) : "",
            type: payload.type || "ORDER_NOTIFICATION",
        },
        android: {
            priority: "high" as const,
            notification: {
                channelId: "orders_channel",
                sound: "default",
                priority: "high" as const,
                defaultSound: true,
                defaultVibrateTimings: true,
            },
        },
        tokens,
    };

    const response = await getMessaging().sendEachForMulticast(messagePayload);
    console.log(`Successfully sent ${response.successCount} push notifications (${response.failureCount} failed).`);
};

export const sendPushNotificationToAdmins = async (payload: {
    title: string;
    body: string;
    orderId?: number;
    type?: string;
}) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT t.fcm_token 
            FROM user_fcm_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE (u.role = 'admin' OR u.role = 'sub_admin') AND t.fcm_token IS NOT NULL
        `);

        const tokens: string[] = result.rows.map((r: any) => r.fcm_token).filter(Boolean);

        if (tokens.length === 0) {
            console.log("No admin FCM tokens registered yet in database.");
            return;
        }

        await sendMulticast(tokens, payload);
    } catch (error) {
        console.error("Error sending push notification to admins:", error);
    }
};

export const sendPushNotificationToFranchise = async (
    franchiseId: number,
    payload: {
        title: string;
        body: string;
        orderId?: number;
        type?: string;
    }
) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT t.fcm_token 
            FROM user_fcm_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE u.franchise_id = $1 AND t.fcm_token IS NOT NULL
        `, [franchiseId]);

        const tokens: string[] = result.rows.map((r: any) => r.fcm_token).filter(Boolean);

        if (tokens.length === 0) {
            console.log(`No franchise FCM tokens registered for franchise_id ${franchiseId}.`);
            return;
        }

        await sendMulticast(tokens, payload);
    } catch (error) {
        console.error(`Error sending push notification to franchise ${franchiseId}:`, error);
    }
};

