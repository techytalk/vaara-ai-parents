# Onboarding location — observe hometown PIN vs ads geo

**Status:** capturing in API/DB (`onboarding_geo_signals`). Onboarding UI
unchanged. Mismatch banner not built yet.  
**Date:** 21 September 2026.  
**Order:** do **not** change. Location (PIN) stays before school.

Parents often type a **hometown / native-place PIN** even though the location
screen already says “current PIN code”. That may be form habit, a short visit to
Hyderabad, or Google Ads (or Play) sending people from another city. We cannot
tell those apart from `user_locations` alone.

This doc locks **measurement first**. Product **order** and the PIN screen stay
as they are. A home-city vs school-city banner is **later**, on a **return
visit** — not the first session after onboarding (tour and messages own that).

Related: [ONBOARDING_LOCATION_LOCALITY.md](./ONBOARDING_LOCATION_LOCALITY.md)
(PIN + area UI), [GOOGLE_ADS_AND_ANALYTICS.md](./GOOGLE_ADS_AND_ANALYTICS.md)
(campaign geo is console-side).

---

## What we are not changing (this phase)

- Onboarding order: `/onboarding/location` → `/onboarding/school` → class/age.
- Location UI: country, typed PIN, locality list, copy.
- No “are you in Hyderabad?” gate **during** onboarding. No location-mismatch
  banner on the first session after signup. Tour and messages first; mismatch
  nudge only when they **come back** (see below).
- No school-first reorder.
- No GPS / `expo-location` (needs a new APK and would bias the PIN if asked
  before they type).
- No neighbourhood-search replacement for PIN yet.

`user_locations` remains the product location (circles, nearby parents, school
ranking). Observation is a **separate** row.

---

## What we will capture

On existing API calls, write one analysis row per user (no raw IP, no lat/lng).

| When | Request (already happens) | Store |
| --- | --- | --- |
| They tap Continue on location | `PATCH /v1/me/location` | Typed PIN, locality, city, state, country |
| Same request | Vercel headers | IP city, region, country (`x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`) |
| They create the child (school is persisted) | `POST /v1/me/children` | School id, city, state, PIN; optional second IP snapshot on that request |

Decode URI-encoded Vercel city names (`San%20Francisco` → `San Francisco`). If
headers are missing (local/dev), leave IP fields null; still save what they typed.

**Ship:** API + migration only. Live app, no store listing, no OTA.

GA4 already has an automatic event **City** (also IP). Custom event
`onboarding_geo` (OTA) sends typed `entered_city` / `school_city` so you can
compare to that automatic City and to campaign. The database join is still
the source of truth for the three cases.

### Table

`onboarding_geo_signals` (`056_onboarding_geo_signals.sql`), keyed by `user_id`.

- Entered: `entered_country_code`, `entered_pin`, `entered_locality`,
  `entered_city`, `entered_state`, `entered_at`
- IP at location save: `ip_city`, `ip_region`, `ip_country`, `ip_captured_at`
- School when child is created: `school_id`, `school_city`, `school_state`,
  `school_pin`, `school_at`
- Optional IP at child create: `school_ip_city`, `school_ip_region`,
  `school_ip_country`, `school_ip_captured_at`

Hyderabad / launch metro for analysis (not shown in the UI): city in
`Hyderabad` / `Secunderabad`, or Indian PIN `500xxx`. Keep that rule in queries
so we can widen later.

---

## How to read the three cases

Join **typed PIN city**, **IP city**, **school city** on one user.

IP is **metro/state**, not neighbourhood. Indian CGNAT can put the city on an
ISP pop. Trust **agreement** (Jaipur + Jaipur) more than a single mismatch.

| Typed PIN city | IP city | School city | Working label |
| --- | --- | --- | --- |
| Not Hyd | Same as typed, not Hyd | Same, not Hyd | **Ads / organic outside Hyd (case 3).** They entered where they are. Fix Ads Presence targeting, not the PIN form. |
| Not Hyd | Hyd | Not Hyd | **Visiting Hyd (case 1).** Phone looks here; kids/school are elsewhere. |
| Not Hyd | Hyd | Hyd | **Hometown PIN habit (case 2), or a visitor picking a Hyd school.** Product bug if this bucket is large. |
| Hyd | Hyd | Hyd | Healthy launch parent. |
| Hyd | Not Hyd | Hyd | Hyd parent filling the form while travelling. Not ads leakage. |
| Anything | (null) | … | Permission/headers missing. Do not force a case. |

Case 1 vs 2 cannot be split by IP when GPS/IP is Hyd **and** school is Hyd.
That cell is “phone looks here, PIN does not.” Use school city to split:
school also not Hyd → visit; school Hyd → habit as the working label.

School city is empty until `POST /v1/me/children`. Abandonment after the school
screen has typed + IP only.

---

## Post-onboarding nudge (later — return visit only)

Do **not** show this on the first session after they finish onboarding. That
session is **tour + messages** (existing home tour; completion prompts already
wait until the tour is done). Do not insert a PIN/school mismatch card on Ready
or on first home.

When they **come back** (a later app open, after the tour has been completed in
a previous session), if home city/PIN region and school city still look far
apart, then show the home banner. Observation is already saved from onboarding;
the nudge only asks them to fix home area.

**Not this phase.** Ship IP-in-DB first. Build the banner later.

**What “long distance” means:** city (or PIN *region*), not kilometres and not
two Hyderabad PINs. Miyapur home + Gachibowli school must **not** nudge.

| Compare | Nudge? |
| --- | --- |
| Home city ≠ school city (e.g. Warangal vs Hyderabad) | Yes |
| Indian PIN first three digits differ (`506` vs `500`) | Yes (same idea) |
| Both `500xxx` / both Hyderabad–Secunderabad | No (commute inside the metro) |

Copy should match school vs home, not “Hyderabad or not”:

> Your school is in Hyderabad. Nearby parents use **where you live now**. Update
> your current home PIN if this is still a hometown / native-place PIN.

CTA opens the existing location screen. Dismiss uses the same backoff as other
completion prompts (7 days, then 30, then stop). Log shown / tapped / dismissed
with `entered_city` vs `school_city` (non-PII).

When built, this can be an **OTA** (JS only): compare `user_locations.city` vs
`children.school.city`, and only consider the prompt if the tour was completed
**before this session** (not the same visit they finished onboarding). Visitors
who truly live elsewhere dismiss; that is fine.

---

## After we have a week of rows

| Largest bucket | Next product move |
| --- | --- |
| Case 3 (typed ≈ IP ≈ school, not Hyd) | Ads geo: Presence in Hyderabad / marketed areas. Not onboarding order. |
| Case 2 (Hyd IP + Hyd school + hometown PIN) | Change how we *ask* location (neighbourhood search and/or school-first). |
| Case 1 (Hyd IP + hometown school) | Accept visitors; optional soft “groups are quiet outside Hyd.” |
| Mostly healthy Hyd | Leave the PIN screen. |

Do **not** reorder onboarding until this table exists. School-first would mix
the experiment: we would not know if fewer hometown PINs came from the new
order.

---

## Possible later UX (not this phase)

**School first, then home area** — only if case 2 is large.

- Parent types the school name, then “area you live in **now**” (home, not
  campus).
- Ranking without a PIN is weaker (`DPS` has many campuses). Rows must show
  locality + city.
- Nudge off **school city vs home city**, not “is this Hyderabad?”

Example if school is Hyderabad and home is not:

> Your school is in Hyderabad. Nearby parents are grouped by where you live
> now. Use your current Hyderabad home area — not hometown.

Primary: change home area. Secondary: “My child doesn’t live in Hyderabad”
(keep their PIN). Same pattern later for any live city.

Do not auto-fill from IP/GPS on that screen if we still care about measuring
habit.

---

## Ads (console, not app)

Campaign location should be **Presence: people in or regularly in** Hyderabad
(and marketed PIN clusters). Avoid **Presence or interest**. Geographic reports
on `first_open` / `sign_up` are device/IP at conversion, not the PIN they type.
The DB row is how we compare those.
