// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
firebase.initializeApp({
  apiKey: "AIzaSyAc3Ly9HZzhZzlxZbfVTLybXR2DWJ7ALJ0",
  authDomain: "voicetasker-ba13c.firebaseapp.com",
  projectId: "voicetasker-ba13c",
  storageBucket: "voicetasker-ba13c.appspot.com",
  messagingSenderId: "634259729654",
  appId: "1:634259729654:web:1b5b19b4846ed6faec50d7",
  measurementId: "G-NXNN715DHC",
  vapidKey: "BE6b1HCNN6fX35P0TThG6NpJORLXFPIs3Zrf_ihfqJhK04wsDwYgsNCePzZdRa3M3R5uVodZBHBiC1Sa6VSBH_Y"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'VoiceTasker Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new task update.',
    icon: payload.notification?.icon || '/icon-192x192.png',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

console.log('Firebase Messaging Service Worker initialized and running.');
