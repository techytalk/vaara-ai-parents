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

GA4’s automatic event **City** is IP-based (same class of signal as Vercel
`x-vercel-ip-city`). It is not the PIN the parent typed.

### What GA4 already has (no extra events)

These attach to **every** Firebase event. They are not GPS.

| Dimension | Source | Use for this question |
| --- | --- | --- |
| Country / Region / City | Device **IP** | Same as Vercel IP city. Compare to our `entered_city` param. |
| First user source / medium / campaign | Play referrer, Ads, UTM | Case 3: which campaign sent people whose IP city is not Hyderabad. |
| Session campaign | Same, for that session | Ads vs organic on this open. |
| Platform, app version, device model | SDK | Filter Android vs iOS. |
| Language | Device | Weak signal only. |
| Google Ads (if linked) | Ads ↔ GA4 | Campaign / ad group next to geo. |
| Google Signals (if enabled) | Google logged-in cohort | Age/gender interest brackets — **not** home vs hometown. |

GA4 does **not** give neighbourhood, GPS, or the typed PIN unless we send
params. Approximate location is not collected unless the app has a location
permission (we do not).

### Custom event `onboarding_geo` (OTA)

Fired after location save (`phase=location`) and after school pick
(`phase=school`). Params are city/state/PIN **prefix** only (no full PIN).

| Param | Meaning |
| --- | --- |
| `phase` | `location` or `school` |
| `entered_city` / `entered_state` | From PIN lookup |
| `pin_prefix` | First 3 digits of an Indian PIN (e.g. `500` vs `506`) |
| `launch_metro` | Typed home is Hyderabad / Secunderabad / `500xxx` |
| `school_city` / `school_state` | School phase only |
| `school_launch_metro` | School is in launch metro |

In GA4 Explore, put **City** (automatic IP) next to `entered_city`. Register
`entered_city`, `school_city`, `phase`, `pin_prefix`, `launch_metro` as custom
dimensions (event scope) or they stay in DebugView / BigQuery only.

Prefer Ads location type **Presence** (people in or regularly in Hyderabad),
not Presence or interest. DB table `onboarding_geo_signals` remains the join
for SQL. This event is for campaign slices.

## Preschool onboarding events (GA4 / Firebase)

Fired on the preschool path in addition to the shared funnel. Non-PII only.

| Event | When | Properties |
| --- | --- | --- |
| `onboarding_track_selected` | Parent picks Preschool or School | `track` |
| `preschool_selected` | Preschool campus chosen | `school_kind` |
| `onboarding_school_complete` | Campus chosen (both tracks) | `track`, `school_kind`, `offers_preschool`, `school_verified` |
| `onboarding_age_view` | Age circle screen shown | — |
| `onboarding_age_complete` | 3 or 4 chosen and child created | `age_years` |
| `age_circle_selected` | Same moment as age complete | `age_years` |

`onboarding_completed` / `tutorial_complete` still fire on Ready for both paths.
