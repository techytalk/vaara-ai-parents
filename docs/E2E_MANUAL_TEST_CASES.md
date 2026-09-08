# Vaara Parents — Manual E2E Test Cases

Use the **production APK/AAB** (or Play internal track). Prefer **2 accounts** on 2 devices/emulators when a case needs “other parent.”

**Pass criteria:** expected result happens with no crash, blank screen, or stuck spinner.

---

## 0. Setup

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 0.1 | Fresh install | Install APK → open app | Splash → intro/login; no crash |
| 0.2 | Permissions | Allow Photos/videos when asked; Notifications optional | App continues |
| 0.3 | Network | Airplane mode → open feed → reconnect | Sensible offline/error; recovers |

---

## 1. Auth (Gmail + email)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1.1 | Google sign-up | Login → Continue with Google → pick account | Lands in onboarding or home |
| 1.2 | Google sign-in | Sign out → Google again (same account) | Returns to home; same user |
| 1.3 | Email register | Register with email/password | Account created; onboarding/home |
| 1.4 | Email login | Sign out → login email/password | Home |
| 1.5 | Bad credentials | Wrong password | Clear error; stay on login |
| 1.6 | Session persist | Kill app → reopen | Still signed in |
| 1.7 | Sign out | Settings → Sign out | Back to login; data cleared |

---

## 2. Onboarding

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Location | Complete location step | Saved; can continue |
| 2.2 | Add child | Add child (name/age/school if shown) | Child appears in list |
| 2.3 | Edit child | Edit child → save | Updates visible |
| 2.4 | Skip/finish | Finish onboarding | Home feed loads |

---

## 3. Home feed & navigation

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 3.1 | Feed load | Open Home | Posts load; pull-to-refresh works |
| 3.2 | Open post | Tap a post | Thread opens |
| 3.3 | Tabs | Circles / Messages / Market / Profile (as present) | Each tab opens |
| 3.4 | Notifications | Open Notifications | List loads (empty OK) |

---

## 4. Circles

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 4.1 | Circles list | Circles tab | Joined circles show |
| 4.2 | Open circle | Open a circle | Circle feed + members access |
| 4.3 | Members | Open members | Member list loads |
| 4.4 | Guest limits | As guest (if applicable), hit post quota | Clear quota message |

---

## 5. Create / edit post (core)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 5.1 | Text only | New post → text → Post | Appears in circle + home |
| 5.2 | With tag/topic | Add interest/topic if UI allows → Post | Tag visible on post |
| 5.3 | Multi-circle | Select extra circles → Post | Visible in each target circle |
| 5.4 | Poll | Enable poll → 2+ options → Post | Poll renders; vote works |
| 5.5 | Edit post | Your post → Edit → change text → Save | Updated body |
| 5.6 | Empty post | Post with no text/media/docs/poll | Blocked with message |
| 5.7 | Your posts | Profile / Your posts | Own posts listed |

---

## 6. Images & video

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 6.1 | Image only | Attach 1 image → Post | Image on feed/thread |
| 6.2 | Multi image | Up to 4 images → Post | All show |
| 6.3 | Video only | Attach video ≤2 min → Post | Plays in thread |
| 6.4 | Image + video | Both → Post | Both upload and show |
| 6.5 | Photos denied | Deny Photos permission → attach | Clear permission message |
| 6.6 | Re-allow Photos | Settings → Allow → retry | Attach works |

---

## 7. Documents (PDF / DOCX / XLSX) — priority

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 7.1 | PDF alone | Paperclip → PDF → wait until ready → Post | Doc on post; open/download works for member |
| 7.2 | DOCX alone | Same with `.docx` | Same |
| 7.3 | XLSX alone | Same with `.xlsx` | Same |
| 7.4 | Doc + image | **Doc first**, then image → Post | Both present |
| 7.5 | Image then doc | Image → then PDF → Post | Both present (no “could not read” on media) |
| 7.6 | Video + doc | Video → PDF → Post | Both present |
| 7.7 | Image + video + doc | All three → Post | All present |
| 7.8 | Oversized file | >20MB PDF or >10MB office | Rejected with size message |
| 7.9 | Unsupported type | `.txt` / `.exe` if picker allows | Not accepted / ignored |
| 7.10 | Scan blocked | If malware path live, bad file | Blocked status; not posted |
| 7.11 | Non-member access | Copy CDN/guess URL if possible | 403 / no public CDN access |
| 7.12 | Auth download | Logged-in circle member opens doc | Download/share works |
| 7.13 | Edit + replace doc | Edit post → change documents → Save | New doc; old behavior per product rules |
| 7.14 | Post while scanning | Tap Post while doc still scanning | Wait message; no partial post |

---

## 8. Comments, reactions, share

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Comment | Open post → comment → send | Comment appears |
| 8.2 | Reply | Reply to comment (if supported) | Nested/linked correctly |
| 8.3 | React | Like/react | Count updates; undo works |
| 8.4 | Share link | Share post → open `/p/…` link | Deep link opens post (signed-in) |
| 8.5 | Share logged out | Open share link logged out | Prompt login then post |

---

## 9. Messages

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 9.1 | New DM | Messages → New → pick parent → send | Message delivered |
| 9.2 | Reply | Other account replies | Thread updates (realtime or refresh) |
| 9.3 | Inbox | Open Messages | Conversations listed |

---

## 10. Marketplace

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 10.1 | Browse | Market tab | Listings load |
| 10.2 | Create listing | New listing + photos → publish | Appears in market + mine |
| 10.3 | Open listing | Open detail | Photos/text correct |
| 10.4 | My listings | Mine | Own items only |

---

## 11. Discover / schools / experts / activities

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 11.1 | Schools | Schools list → open one | Detail loads |
| 11.2 | School review | Submit review (if available) | Saved / visible |
| 11.3 | Experts | Experts list → profile | Loads |
| 11.4 | Practitioners | Practitioners list → profile | Loads |
| 11.5 | Activities | Activities list → detail | Loads |
| 11.6 | Topics | Topics → follow → topic feed | Posts for interest show |

---

## 12. Carpool / calendar / playdates / reminders

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 12.1 | Carpool | Open carpool → create/view arrangement | Saves / opens |
| 12.2 | Calendar | Calendar → new event → save | Shows on calendar |
| 12.3 | Playdates | Open playdates | List/create works |
| 12.4 | Reminders | Open reminders | List loads |

---

## 13. Profile & settings

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 13.1 | Profile | Open profile | Name/avatar/children correct |
| 13.2 | Avatar | Change avatar → save | Updates |
| 13.3 | Contact details | Edit phone/email if shown → save | Persists |
| 13.4 | Notification settings | Toggle prefs → reopen | Prefs stick |
| 13.5 | Saved | Save a post → Saved | Appears |
| 13.6 | Support | Open Support | Screen loads |

---

## 14. Provider mode (if you use provider accounts)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 14.1 | Provider home | Login as provider | Provider shell |
| 14.2 | Activity CRUD | Create / edit activity | Persists |
| 14.3 | Provider profile | Edit profile | Saves |

---

## 15. Push / realtime smoke

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 15.1 | Push (optional) | Other user comments on your post | Notification arrives (if enabled) |
| 15.2 | Live feed | Keep feed open; other posts | New post appears or on refresh |

---

## 16. Regression smoke (10 min)

Run in order on one device:

1. Google sign-in  
2. Home feed refresh  
3. Text post  
4. Image post  
5. Video post  
6. PDF post  
7. **Image + PDF** post  
8. Comment on own post  
9. Open document from thread  
10. Sign out → Google sign-in again  

---

## Known pitfalls to watch

- **Image/video then document:** older builds lost gallery URI access; fixed build should post both.  
- **Documents 403:** S3 IAM must allow `quarantine/*` and `post-docs/*`.  
- **Docs not on CDN:** downloads must go through app/API, not public CloudFront.  
- **versionCode:** Play uploads need a higher version than live production.

---

## Sign-off

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| Auth | | | | |
| Posts + media | | | | |
| Documents | | | | |
| Messages | | | | |
| Market | | | | |
| Discover | | | | |
| Settings | | | | |
