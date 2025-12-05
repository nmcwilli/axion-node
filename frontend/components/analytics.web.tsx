// analytics.web.tsx
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent as logWebEvent, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Only initialize analytics in the browser
let analytics: Analytics | undefined = undefined;

if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn('Analytics not supported in this environment.', e);
  }
}

export const logEvent = (event: string, params?: any) => {
  if (analytics) {
    logWebEvent(analytics, event, params);
  } else {
    console.warn(`logEvent skipped: analytics not initialized for event "${event}"`);
  }
};