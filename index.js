/**
 * @format
 */

import { AppRegistry, Text, TextInput } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Stabilize font scaling so large OS display/font settings do not break UI alignment across different Android devices (Redmi, Moto, Samsung, etc.)
if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.allowFontScaling = false;

if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.allowFontScaling = false;

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
