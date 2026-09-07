# Google Ads and Analytics

Firebase project `vaara-ai-parents` already exists for FCM and Google Sign-In. Until this wiring, the app only logged events in development (`console.log`). There is no Google Ads SDK in the app: Ads conversions are imported from GA4 after a console link.

## What the code does

**Android app (Firebase Analytics / GA4)**

- SDK: `@react-native-firebase/app` + `@react-native-firebase/analytics`
- Uses existing `google-services.json`
- Automatic: `first_open` (install) after a native build
- Marked conversions: `sign_up`, `login`, `tutorial_complete` (onboarding finished), `share`
- Other product events (`intro_*`, `circle_post_*`, …) still fire without child or message content
- Android declares `AD_ID` for install/conversion attribution (no in-app ads)

**iOS**

- `apps/mobile/GoogleService-Info.plist` is wired via `ios.googleServicesFile`
- Bundle ID `com.vaara.parents`, Firebase app `1:375946640576:ios:e8f7db778475e36e7fc125`
- Same conversion events as Android after a native iOS rebuild
- `IS_ANALYTICS_ENABLED` in the plist can be `false`; that is Firebase’s default. Collection is enabled in app code (`initAnalytics`). Still enable/link Google Analytics on the iOS app in the Firebase console.

The `@react-native-firebase/analytics` Expo config plugin is omitted on purpose: Node’s ESM loader fails when Expo evaluates that package. The analytics native module still autolinks from the npm dependency. Keep `@react-native-firebase/app` in `app.json` plugins. iOS native builds require `use_frameworks! :linkage => :static` in the committed `ios/Podfile` (EAS must **not** run `expo prebuild --clean` for iOS, or that Podfile is wiped and Firebase compiles as `.a` libraries). `$RNFirebaseAsStaticFramework = true` is set at the top of the Podfile.

**Marketing site (`apps/web`)**

- Loads gtag only if env IDs are set:
  - `VITE_GA_MEASUREMENT_ID` (`G-…`)
  - `VITE_GOOGLE_ADS_ID` (`AW-…`)
  - `VITE_GOOGLE_ADS_CONVERSION_LABEL` (store-click conversion label)
- Store buttons fire `store_click` and, if Ads ID + label are set, an Ads conversion

Do not commit real measurement IDs. Set them in Vercel env for `apps/web` and in Google/Firebase consoles.

## Console steps (required for campaign reporting)

1. [Firebase](https://console.firebase.google.com/) → `vaara-ai-parents` → enable **Google Analytics** if it is not already linked to a GA4 property.
2. GA4 → Admin → Data streams → confirm Android **and iOS** streams match `com.vaara.parents`.
3. GA4 → Admin → Events → mark `sign_up`, `login`, `tutorial_complete`, `share` as conversions (`first_open` is usually already a conversion).
4. [Google Ads](https://ads.google.com/) → Tools → Data manager → link the same GA4 property (and/or Firebase).
5. Google Ads → Goals → import those GA4 conversions. Use `first_open` / `sign_up` as primary app campaign goals.
6. App campaigns: target the Play listing for `com.vaara.parents` once the store listing exists. Until then, use the website + `store_click` conversion.
7. Play Console → App content → Advertising ID: declare use for analytics / advertising attribution.

## IDs we do not have in the repo

Paste these when they exist (never invent `G-` / `AW-` values):

| Place | ID |
| --- | --- |
| GA4 web stream | `G-…` → `VITE_GA_MEASUREMENT_ID` |
| Google Ads | `AW-…` → `VITE_GOOGLE_ADS_ID` |
| Ads conversion action for site store clicks | label → `VITE_GOOGLE_ADS_CONVERSION_LABEL` |

App conversions do not need Ads IDs in the APK; they flow Firebase → GA4 → Google Ads after the link above.
