import { Alert, PermissionsAndroid, Platform } from "react-native";
import {
    getMessaging,
    getToken,
    requestPermission,
    onMessage,
    onNotificationOpenedApp,
    getInitialNotification,
    onTokenRefresh,
    AuthorizationStatus,
    type RemoteMessage,
} from "@react-native-firebase/messaging";
import api from "./api";

/**
 * 1. Request notification permission (Required for Android 13+ and iOS)
 */
export async function requestNotificationPermission(): Promise<boolean> {
    try {
        if (Platform.OS === "android") {
            if (Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
            return true;
        } else if (Platform.OS === "ios") {
            const messaging = getMessaging();
            const authStatus = await requestPermission(messaging);
            const enabled =
                authStatus === AuthorizationStatus.AUTHORIZED ||
                authStatus === AuthorizationStatus.PROVISIONAL;
            return enabled;
        }
        return false;
    } catch (error) {
        console.error("Error requesting notification permission:", error);
        return false;
    }
}

/**
 * 2. Get Device FCM Token
 */
export async function getFCMToken(): Promise<string | null> {
    try {
        const messaging = getMessaging();
        const token = await getToken(messaging);
        console.log("Device FCM Token:", token);
        return token;
    } catch (error) {
        console.warn("Could not retrieve FCM token:", error);
        return null;
    }
}

/**
 * 3. Send FCM Token to Server/Database
 */
export async function registerDeviceToken(): Promise<void> {
    try {
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            console.log("Notification permission not granted.");
            return;
        }

        const token = await getFCMToken();
        if (!token) return;

        // Save token to backend API
        await api.post("/auth/fcm-token", {
            fcm_token: token,
            device_type: Platform.OS,
        });
        console.log("FCM token successfully registered on server.");
    } catch (error: any) {
        console.warn("Error registering FCM token with backend:", error?.message || error);
    }
}

/**
 * 4. Setup Notification Listeners
 * @param onOpenOrder Callback when admin clicks on notification
 */
export function setupNotificationListeners(onOpenOrder?: (orderId: number) => void) {
    const messaging = getMessaging();

    // A. Foreground message received (when app is open)
    const unsubscribeForeground = onMessage(messaging, async (remoteMessage: RemoteMessage) => {
        console.log("Foreground FCM message received:", remoteMessage);

        const title = remoteMessage.notification?.title || "नवीन सूचना 🔔";
        const body = remoteMessage.notification?.body || "नवीन मेसेज आला आहे.";
        const orderId = remoteMessage.data?.orderId;

        Alert.alert(
            title,
            body,
            orderId
                ? [
                      { text: "रद्द करा", style: "cancel" },
                      {
                          text: "ऑर्डर पहा",
                          onPress: () => {
                              if (onOpenOrder && orderId) {
                                  onOpenOrder(Number(orderId));
                              }
                          },
                      },
                  ]
                : [{ text: "ठीक आहे" }]
        );
    });

    // B. App opened from background state by clicking notification
    const unsubscribeNotificationOpened = onNotificationOpenedApp(
        messaging,
        (remoteMessage: RemoteMessage) => {
            console.log("Notification caused app to open from background:", remoteMessage);
            const orderId = remoteMessage.data?.orderId;
            if (orderId && onOpenOrder) {
                onOpenOrder(Number(orderId));
            }
        }
    );

    // C. App opened from completely closed (quit) state
    getInitialNotification(messaging).then((remoteMessage: RemoteMessage | null) => {
        if (remoteMessage) {
            console.log("App opened from quit state by notification:", remoteMessage);
            const orderId = remoteMessage.data?.orderId;
            if (orderId && onOpenOrder) {
                setTimeout(() => onOpenOrder(Number(orderId)), 1000);
            }
        }
    });

    // D. Token Refresh Listener
    const unsubscribeTokenRefresh = onTokenRefresh(messaging, async (newToken: string) => {
        console.log("FCM token refreshed:", newToken);
        try {
            await api.post("/auth/fcm-token", {
                fcm_token: newToken,
                device_type: Platform.OS,
            });
        } catch (e) {
            console.warn("Failed to update refreshed token:", e);
        }
    });

    return () => {
        unsubscribeForeground();
        unsubscribeNotificationOpened();
        unsubscribeTokenRefresh();
    };
}
