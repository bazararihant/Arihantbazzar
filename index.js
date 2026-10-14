/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Handle background notifications
try {
    const messaging = getMessaging();
    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
        console.log('FCM Message handled in background:', remoteMessage);
    });
} catch (e) {
    console.warn('Firebase messaging initialization notice:', e);
}

AppRegistry.registerComponent(appName, () => App);
