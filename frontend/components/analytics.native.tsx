// // Firebase for iOS and Android
// // analytics.native.tsx
// EXCLUDED FOR NOW BECAUSE YOU NEED TO GENERATE PREBUILD AND CANNOT TEST WITH EXPO GO
// import firebase from '@react-native-firebase/app';
// import analytics from '@react-native-firebase/analytics';

// // Initialize native Firebase app once
// if (!firebase.apps.length) {
//   firebase.initializeApp({
//     apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY as string,
//     authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
//     projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID as string,
//     storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
//     messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
//     appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID as string,
//     measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID as string,
//   });
// }

// export const logEvent = async (eventName: string, params?: Record<string, any>) => {
//   await analytics().logEvent(eventName, params);
// };

// export const setUserId = async (userId: string) => {
//   await analytics().setUserId(userId);
// };

// export const setUserProperty = async (name: string, value: string) => {
//   await analytics().setUserProperty(name, value);
// };