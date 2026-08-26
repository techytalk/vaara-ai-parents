import { Hono } from "hono";

const DEFAULT_ANDROID_PACKAGE = "com.vaara.parents";

function buildAndroidStoreUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${packageName}`;
}

export function createAppRoutes() {
  const app = new Hono();

  app.get("/version", (c) => {
    const latestVersion = process.env.APP_LATEST_VERSION ?? "1.0.0";
    const minimumVersion = process.env.APP_MINIMUM_VERSION ?? latestVersion;

    const androidPackage =
      process.env.APP_ANDROID_PACKAGE ?? DEFAULT_ANDROID_PACKAGE;
    const androidStoreUrl =
      process.env.APP_ANDROID_STORE_URL ??
      buildAndroidStoreUrl(androidPackage);

    const iosStoreUrl =
      process.env.APP_IOS_STORE_URL ??
      "https://apps.apple.com/app/vaara-parents";

    return c.json({
      latestVersion,
      minimumVersion,
      androidStoreUrl,
      iosStoreUrl,
    });
  });

  return app;
}
