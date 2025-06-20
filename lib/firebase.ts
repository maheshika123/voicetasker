
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAc3Ly9HZzhZzlxZbfVTLybXR2DWJ7ALJ0",
  authDomain: "voicetasker-ba13c.firebaseapp.com",
  projectId: "voicetasker-ba13c",
  storageBucket: "voicetasker-ba13c.firebasestorage.app",
  messagingSenderId: "634259729654",
  appId: "1:634259729654:web:1b5b19b4846ed6faec50d7",
  measurementId: "G-NXNN715DHC"
};

let app: FirebaseApp;
let analytics: Analytics | undefined;
let messaging: Messaging | undefined;

if (typeof window !== 'undefined') {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  messaging = getMessaging(app);

  // Handle foreground messages
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground. ', payload);
    // Show a toast or in-app notification for foreground messages
    // For now, we'll use the browser's Notification API if permission is granted
    if (Notification.permission === 'granted' && payload.notification) {
      new Notification(payload.notification.title || "New Message", {
        body: payload.notification.body || "",
        icon: payload.notification.icon || "/icon-192x192.png",
      });
    }
  });
}


export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !messaging || !("Notification" in window)) {
    console.log("Notifications not supported or Firebase Messaging not initialized.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      // Get the token
      const currentToken = await getToken(messaging, { vapidKey: "YOUR_VAPID_KEY_IF_YOU_HAVE_ONE_FROM_FIREBASE_CONSOLE_SETTINGS" }); // Replace with your VAPID key
      if (currentToken) {
        console.log("FCM Token:", currentToken);
        // You would typically send this token to your server to send push notifications
        // For client-side scheduled notifications, we might not need to send it anywhere
        return currentToken;
      } else {
        console.log("No registration token available. Request permission to generate one.");
        return null;
      }
    } else {
      console.log("Unable to get permission to notify.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while requesting permission or getting token. ", error);
    return null;
  }
};

export { app, analytics, messaging };
