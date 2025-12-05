// app.config.js
// This is your core app.config.js which you will need to populate with your app details
import 'dotenv/config';

export default {
  expo: {
    name: "AxionNodeName",
    slug: "axionnode",
    version: "1.2.9",
    orientation: "portrait",
    icon: "./assets/images/favicon.png",
    scheme: "axionnode",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/icons/splash-icon-light.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: "./assets/icons/splash-icon-dark.png",
        backgroundColor: "#000000"
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.clockworkventure.axionnode",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription:
          "AxionNode needs access to your photo library so you can upload a profile picture and share images in posts."
      },
      icon: {
        dark: "./assets/icons/ios-dark.png",
        light: "./assets/icons/ios-light.png",
        tinted: "./assets/icons/ios-tinted.png"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        monochromeImage: "./assets/icons/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.clockworkventure.axionnode"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    install: {
      exclude: ["@types/react", "@types/react-dom"]
    },
    plugins: [
      [
        "expo-image-picker",
        {
          photosPermission:
            "AxionNode only accesses your photos so you can upload profile photos and add photos to posts."
        }
      ],
      ["expo-router", { origin: process.env.EXPO_PUBLIC_ORIGIN || "http://localhost:8081" }],
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission:
            "Your data will be used to deliver personalized ads to you."
        }
      ],
      // ✅ Both plugins separated (correct structure)
      // "expo-video",
      // [
      //   "react-native-google-mobile-ads",
      //   {
      //     androidAppId:
      //       process.env.EXPO_ANDROID_ADMOB_ID ||
      //       "ca-app-pub-3940256099942544~3347511713",
      //     iosAppId:
      //       process.env.EXPO_IOS_ADMOB_ID ||
      //       "ca-app-pub-3940256099942544~1458002511",
      //   },
      // ],
    ],
    experiments: {
      typedRoutes: true,
      newArchEnabled: true,
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: process.env.EXPO_EAS_PROJECT_ID || null,
      },
      // Optional: pull values from .env here
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
    }
  }
};