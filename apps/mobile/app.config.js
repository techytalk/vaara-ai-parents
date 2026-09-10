const { config } = require("dotenv");
const { resolve } = require("path");
const appJson = require("./app.json");
const withAndroidPostNotifications = require("./plugins/with-android-post-notifications");
const withRnFirebaseIos = require("./plugins/with-rnfirebase-ios");

// Monorepo: load shared env from repo root (same file used by API/worker).
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, ".env.local") });

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins ?? []),
      [
        "expo-build-properties",
        {
          android: {
            // Play requires API 36 for updates (from Aug 31, 2026).
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            // SDK 53.0.14+ ships 16 KB-compatible native libraries.
            useLegacyPackaging: false,
          },
          ios: {
            useFrameworks: "static",
          },
        },
      ],
      withAndroidPostNotifications,
      withRnFirebaseIos,
      "@react-native-community/datetimepicker",
    ],
    owner: "raj-techy1s-team",
    extra: {
      ...appJson.expo.extra,
      eas: {
        projectId: "0cc4bc43-2bbe-410b-8cba-68ab1bc2bc21",
      },
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL?.trim() ||
        "https://api.vaara.ai",
      realtimeUrl:
        process.env.EXPO_PUBLIC_REALTIME_URL?.trim() ||
        "wss://vaara-realtime.fly.dev/ws",
      googleWebClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
        appJson.expo.extra.googleWebClientId ||
        "",
      googleIosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ||
        appJson.expo.extra.googleIosClientId ||
        "",
      googleAndroidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || "",
      googleRedirectUri:
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim() || "",
      clarityProjectId:
        process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim() || "yfwlrijbvm",
    },
  },
};
