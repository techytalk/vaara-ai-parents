const { config } = require("dotenv");
const { resolve } = require("path");
const appJson = require("./app.json");

// Monorepo: load shared env from repo root (same file used by API/worker).
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, ".env.local") });

module.exports = {
  expo: {
    ...appJson.expo,
    owner: "raj-techy1s-team",
    extra: {
      ...appJson.expo.extra,
      eas: {
        projectId: "0cc4bc43-2bbe-410b-8cba-68ab1bc2bc21",
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim(),
      googleWebClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "",
      googleIosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "",
      googleAndroidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "",
      googleRedirectUri:
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim() ?? "",
    },
  },
};
