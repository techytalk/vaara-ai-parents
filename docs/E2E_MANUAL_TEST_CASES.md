# Vaara Parents — Manual E2E Testing

Use the **production APK/AAB** (or Play internal track).

**Before you start**
- Have 2 parent accounts ready when a test needs another parent (messages, comments, live feed).
- Bottom tabs you will use: **Feed · Circles · Messages · Discover · More**
- A test **passes** if the expected screen appears, there is no crash, blank screen, or stuck spinner.

---

## Setup

### Fresh install

1. Install the APK (or open the Play internal-track build).
2. Open Vaara.
3. Wait for splash, then the intro screens.

**Pass if:** app opens without crashing. You see intro, then login.

---

### Intro screens

1. On the first intro screen, tap **Next**.
2. Keep tapping **Next** until the last slide.
3. Tap **Let's Go**.
4. (Optional, second run) On intro, tap **Skip** instead.

**Pass if:** you land on **Welcome back** (login). Skip also goes to login.

---

### Permissions

1. When the app asks for **Photos / videos**, tap **Allow**.
2. If it asks for **Notifications**, Allow or Don’t allow (either is OK).

**Pass if:** the app continues. It does not freeze on a permission dialog.

---

### Offline / reconnect

1. Turn on **Airplane mode**.
2. Open the app and go to **Feed**.
3. Turn Airplane mode off (Wi‑Fi / mobile data back on).
4. Pull down on Feed to refresh.

**Pass if:** you see an error or empty state while offline, then Feed loads after reconnect.

---

## Auth

### Google sign-up (new Gmail)

1. On **Welcome back**, tap **Continue with Google**.
2. Pick a Gmail that has never used Vaara.
3. Approve Google sign-in if asked.

**Pass if:** you land in onboarding (**Tell us about your children**) or Feed if that account already finished setup.

---

### Google sign-in (existing account)

1. If you are already in the app, go to **More** → tap **Sign out**.
2. On login, tap **Continue with Google**.
3. Pick the **same** Gmail as before.

**Pass if:** you return to Feed as the same user (same handle, same children).

---

### Email register

1. On login, tap **New to Vaara? Create an account**.
2. Keep **Parent** selected under **I am joining as**.
3. Type a name in **Your name (kept private)**.
4. Type a new email and a password (at least 8 characters).
5. Tap **Create account**.

**Pass if:** account is created and you go to onboarding or Feed.

---

### Email login

1. Go to **More** → **Sign out**.
2. On **Welcome back**, type the email and password.
3. Tap **Sign in with email**.

**Pass if:** you land on Feed.

---

### Wrong password

1. On login, type a valid email and the **wrong** password.
2. Tap **Sign in with email**.

**Pass if:** a clear error shows. You stay on login. App does not crash.

---

### Stay signed in after kill

1. Sign in (Google or email).
2. Fully close the app (swipe away from Recents).
3. Open Vaara again.

**Pass if:** you are still signed in. Feed (or onboarding) loads. You are not sent back to login.

---

### Sign out

1. Tap **More**.
2. Scroll to the bottom.
3. Tap **Sign out**.

**Pass if:** you see **Welcome back**. Opening the app again stays on login.

---

## Onboarding

### Add a child

1. After first sign-up you should see **Step 1 of 2 — Tell us about your children**.
2. Tap **Add your first child**.
3. Fill **Nickname**, **Date of birth**, gender, curriculum, grade, and school if shown.
4. Tap **Save child**.

**Pass if:** the child appears in the list with nickname, curriculum, and grade.

---

### Edit a child

1. On the children list, tap the child card.
2. Change the nickname (or grade / school).
3. Tap **Save changes**.
4. Go back to the children list.

**Pass if:** the updated name / details show on the card.

---

### Location

1. On the children list, tap **Continue** (you need at least one child).
2. Choose country (default **India** is fine).
3. Type a valid PIN (6 digits for India).
4. Wait for locality / city to fill, or type them.
5. Optionally type a community name.
6. Tap **Save location**.

**Pass if:** location saves and you can finish setup. Feed loads after this.

---

### Finish onboarding

1. Complete child + location as above.
2. Wait for the app to leave onboarding.

**Pass if:** **Feed** tab opens and posts (or an empty feed) load. No stuck spinner.

---

## Home feed & tabs

### Feed loads

1. Tap **Feed** in the bottom bar.
2. Wait for posts.
3. Pull down on the list to refresh.

**Pass if:** posts appear (empty feed is OK if you have no circle posts). Refresh finishes and does not hang.

---

### Open a post

1. On Feed, tap any post card.

**Pass if:** the thread opens with the post body, media/docs if any, and a comment box.

---

### Bottom tabs

1. Tap **Circles**.
2. Tap **Messages**.
3. Tap **Discover**.
4. Tap **More**.
5. Tap **Feed** again.

**Pass if:** each tab opens its own screen. None are blank or crashed.

---

### Notifications

1. On Feed, tap the bell icon at the top right.
2. Wait for the list.

**Pass if:** the notifications screen loads. Empty list is OK.

---

## Circles

### Circles list

1. Tap **Circles**.
2. Look at the joined circles (school, class, locality, curriculum, etc.).

**Pass if:** your circles show. Pull-to-refresh works.

---

### Open a circle

1. Tap one circle card.
2. Wait for that circle’s feed.

**Pass if:** circle posts load. You can see Members and a way to create a post.

---

### Members

1. Inside a circle, tap **Members**.

**Pass if:** member list loads (handles / avatars). No crash.

---

### Guest post quota (only if you are a guest in that circle)

1. Open a circle where you are a guest.
2. Try to create posts until the quota is hit.
3. Tap **Post**.

**Pass if:** a clear quota message appears. The extra post is not published.

---

## Create / edit post

Start each of these from **Feed**: tap **What's on your mind?** (or the + / Create post button). That opens **New post**.

### Text only

1. Open **New post**.
2. Type a short message in **What's on your mind?**
3. Tap **Post**.
4. Go to **Feed** and confirm the post.
5. Open **Circles**, open the same circle, and confirm it is there too.

**Pass if:** the post appears in Feed and in the circle. No crash.

---

### Tag / type

1. Open **New post**.
2. Tap the post type chip at the top (e.g. General).
3. Choose **Question**, **Recommendation**, or **Heads up**.
4. Type text.
5. Tap **Post**.
6. Open the post on Feed.

**Pass if:** the tag/type is visible on the post.

---

### Interests / topics

1. Open **New post**.
2. Type text.
3. Tap the tag icon (**Add interests**).
4. Select one or more interests.
5. Tap **Post**.
6. Open the post.

**Pass if:** selected interests show on the post.

---

### Post to extra circles

1. Open **New post**.
2. Type text.
3. Tap the audience / circles row (who will see this).
4. Select one extra circle.
5. Tap **Post**.
6. Open each selected circle and look for the post.

**Pass if:** the post is visible in every circle you selected.

---

### Poll

1. On Feed, tap **Poll**, or on **New post** tap the chart icon (**Add a poll**).
2. Type post text (optional) and a poll question if asked.
3. Fill at least **2** options.
4. Tap **Post**.
5. Open the post and tap one option to vote.
6. Tap a different option (or the same one again if undo is supported).

**Pass if:** poll shows, vote counts update, app does not crash.

---

### Empty post blocked

1. Open **New post**.
2. Leave text empty. Do not add photo, video, document, or poll.
3. Look at the **Post** button.

**Pass if:** **Post** stays disabled, or you get a message. Nothing is published.

---

### Edit your post

1. Open one of **your** posts (or **More** → **Your Posts** → tap one).
2. Tap **Edit** (pencil) in the header.
3. Change the text.
4. Tap **Save**.
5. Open the post again.

**Pass if:** the new text shows. An “edited” hint is OK.

---

### Your Posts

1. Tap **More**.
2. Tap **Your Posts**.

**Pass if:** only your posts are listed. Tapping one opens the thread.

---

## Images & video

On **New post**, use the image icon (**Add photos or videos**). Allow Photos if asked.

### One image

1. Open **New post**.
2. Type a caption (optional).
3. Tap **Add photos or videos**.
4. Pick **1 image**.
5. Wait until the thumbnail appears.
6. Tap **Post**.
7. Open the post on Feed and in the thread.

**Pass if:** the image shows on Feed and in the thread.

---

### Up to 4 images

1. Open **New post**.
2. Tap **Add photos or videos**.
3. Pick up to **4 images**.
4. Tap **Post**.
5. Open the thread.

**Pass if:** all images show.

---

### Video only

1. Open **New post**.
2. Tap **Add photos or videos**.
3. Pick a video **2 minutes or shorter**.
4. Wait for the preview.
5. Tap **Post**.
6. Open the thread and play the video.

**Pass if:** video uploads and plays. No crash.

---

### Image + video

1. Open **New post**.
2. Add **1 image**, then add **1 video** (or pick both if the picker allows).
3. Tap **Post**.
4. Open the thread.

**Pass if:** both the image and the video show.

---

### Photos permission denied

1. In Android **Settings → Apps → Vaara → Permissions**, deny **Photos**.
2. Open **New post**.
3. Tap **Add photos or videos**.

**Pass if:** a clear permission message appears. App does not crash.

---

### Re-allow Photos

1. In Android Settings, allow Photos for Vaara.
2. Return to the app.
3. Open **New post** → tap **Add photos or videos** → pick an image.

**Pass if:** the picker opens and the image attaches.

---

## Documents (priority)

On **New post**, use the paperclip icon (**Add a document**). Wait until the file says **Ready** before you tap **Post**. Status should go: uploading → **Checking file…** → **Ready**.

Have these files on the device first: a small PDF, a `.docx`, a `.xlsx`, plus one PDF over 20MB and one office file over 10MB if you can.

### PDF only

1. Open **New post**.
2. Type a short caption (optional).
3. Tap **Add a document**.
4. Pick a **PDF**.
5. Wait until it shows **Ready** (not “Checking file…”).
6. Tap **Post**.
7. Open the thread.
8. Tap the document to open / share.

**Pass if:** the PDF is on the post. Opening it works for a circle member.

---

### Word (.docx) only

1. Open **New post**.
2. Tap **Add a document**.
3. Pick a **.docx**.
4. Wait for **Ready**.
5. Tap **Post**.
6. Open the thread and tap the file.

**Pass if:** Word file is on the post and opens / shares.

---

### Excel (.xlsx) only

1. Open **New post**.
2. Tap **Add a document**.
3. Pick a **.xlsx**.
4. Wait for **Ready**.
5. Tap **Post**.
6. Open the thread and tap the file.

**Pass if:** Excel file is on the post and opens / shares.

---

### Document first, then image

1. Open **New post**.
2. Tap **Add a document** → pick a PDF → wait for **Ready**.
3. Tap **Add photos or videos** → pick **1 image**.
4. Tap **Post**.
5. Open the thread.

**Pass if:** both the PDF and the image are on the post.

---

### Image first, then document

1. Open **New post**.
2. Tap **Add photos or videos** → pick **1 image**.
3. Then tap **Add a document** → pick a PDF → wait for **Ready**.
4. Tap **Post**.
5. Open the thread.

**Pass if:** both show. You do **not** see “could not read this file” on the image.

---

### Video + document

1. Open **New post**.
2. Add a short video.
3. Add a PDF. Wait for **Ready**.
4. Tap **Post**.
5. Open the thread.

**Pass if:** video and PDF both show.

---

### Image + video + document

1. Open **New post**.
2. Add 1 image.
3. Add 1 short video.
4. Add 1 PDF. Wait for **Ready**.
5. Tap **Post**.
6. Open the thread.

**Pass if:** all three are on the post.

---

### File too large

1. Open **New post**.
2. Tap **Add a document**.
3. Pick a PDF **larger than 20MB**, or a Word/Excel **larger than 10MB**.

**Pass if:** the file is rejected with a size message. It is not posted.

---

### Unsupported file type

1. Open **New post**.
2. Tap **Add a document**.
3. Try a `.txt` or `.exe` if the picker lets you.

**Pass if:** it is not accepted, or it is ignored. No crash.

---

### Malware / blocked scan (only if that path is live)

1. Open **New post**.
2. Attach a file that should fail the scan (use a known test file, not a real threat).
3. Wait for status.

**Pass if:** status is **blocked**. **Post** does not publish that file.

---

### Do not post while still scanning

1. Open **New post**.
2. Attach a PDF.
3. While it still says **Checking file…**, try to tap **Post**.

**Pass if:** you get a wait message, or **Post** stays disabled. No half-posted item without the file.

---

### Open document as a member

1. Sign in as a **member** of the circle.
2. Open the post that has a document.
3. Tap the document.
4. Share / open it in another app if the sheet appears.

**Pass if:** download / share works while signed in.

---

### Replace document on edit

1. Open **your** post that has a document.
2. Tap **Edit**.
3. Remove the old file if the UI allows, then **Add a document** with a different PDF.
4. Wait for **Ready**.
5. Tap **Save**.
6. Open the thread.

**Pass if:** the new file is on the post (old one gone or replaced per product rules).

---

## Comments, reactions, share

### Comment

1. Open a post.
2. Type in **Write a helpful comment…**
3. Tap send (arrow).

**Pass if:** the comment appears under **Comments**.

---

### React / like

1. On Feed or in the thread, tap the like / react control.
2. Tap it again to undo.

**Pass if:** the count goes up, then back down. No crash.

---

### Share link (signed in)

1. Open a post.
2. Tap **Share**.
3. Choose **Share post**.
4. Copy the `/p/…` link (or send it to yourself).
5. Open that link on the same signed-in device / browser.

**Pass if:** the post opens in the app (or after login).

---

### Share link while logged out

1. Sign out (**More** → **Sign out**).
2. Open the same `/p/…` share link.

**Pass if:** you are asked to log in, then you land on the post.

---

## Messages

Needs **2 accounts**.

### Inbox

1. Tap **Messages**.

**Pass if:** conversation list loads (empty is OK).

---

### Start a DM

1. Tap **Messages**.
2. Tap **New message** (plus / empty-state button).
3. Search or pick the other parent.
4. If needed, type an intro and tap **Send connection request**.
5. On the other account, accept the request if asked.
6. Open the thread and send a message. Tap send.

**Pass if:** the message shows in the thread for you.

---

### Reply from the other parent

1. On the **second** device/account, open **Messages**.
2. Open the same conversation.
3. Send a reply.

**Pass if:** the first account sees the reply (live or after pull-to-refresh).

---

## Marketplace

### Browse listings

1. Tap **More**.
2. Tap **My Listings** (opens Market).
3. Browse the list. Try category chips (**All**, **Books**, etc.).
4. Pull down to refresh.

**Pass if:** listings load (empty is OK). No crash.

---

### Create a listing

1. On Market, tap the **+** (Post a listing).
2. Choose **For sale**, **Free**, or **Wanted**.
3. Pick a category.
4. Type title and description. Add a price if For sale.
5. Add photos if asked.
6. Tap **Post listing**.
7. Go back to Market, then tap **Mine**.

**Pass if:** the listing appears in Market and under **Mine**.

---

### Open a listing

1. On Market, tap a listing.

**Pass if:** detail shows title, text, and photos correctly.

---

### My listings only

1. On Market, tap **Mine**.

**Pass if:** you only see listings you created.

---

## Discover (schools, experts, activities)

### Activities

1. Tap **Discover**.
2. Wait for the list. Try filters **All / Tutors / Coaching / Classes / Arts**.
3. Tap one activity.

**Pass if:** list and detail load.

---

### Schools

1. Tap **Circles** (or **Discover** shortcuts) → **Schools**.
2. Open one school.

**Pass if:** school detail loads.

---

### School review

1. On a school profile, find review / **Submit review**.
2. Fill the review and submit.

**Pass if:** it saves and you can see it (or a thanks message).

---

### Experts

1. Open **Experts** from Circles / Discover shortcuts.
2. Tap one expert / session.

**Pass if:** profile / session loads.

---

### Doctors

1. Tap **More** → **Local doctors**, or the **Doctors** shortcut.
2. Tap one profile.

**Pass if:** profile loads.

---

### Interests / topics

1. Tap **More** → **Settings & Privacy** → **Interests**.
   (Or open Topics from Circles.)
2. Follow a topic.
3. Open that topic’s feed.

**Pass if:** posts for that interest show (empty is OK if none exist).

---

## Carpool, calendar, playdates, reminders

### Calendar

1. Tap **More** → **Settings & Privacy** → **School calendar**.
2. Tap **Report an event** (or new event).
3. Type a title, pick type, pick date/time.
4. Save.

**Pass if:** the event shows on the calendar (or a thanks / unconfirmed message).

---

### Playdates

1. Tap **More** → **Playdates**.
2. If asked, tap **Opt in for playdates**.
3. Browse the list / create if the UI allows.

**Pass if:** screen loads and opt-in / list works.

---

### Carpool

1. Tap **More** → **Carpool**.
2. Open or create an arrangement if shown.

**Pass if:** screen loads and save / open works.

---

### Reminders

1. Open Reminders from Discover / calendar entry points if present.

**Pass if:** the list loads.

---

## Profile & settings

### Profile (More)

1. Tap **More**.

**Pass if:** you see your anonymous handle, avatar, and child summary. Stats (Circles / Saved / Helpful) load.

---

### Change avatar

1. On **More**, tap **Change avatar** (or the avatar).
2. Pick a new avatar.
3. Save if asked.
4. Go back to **More**.

**Pass if:** the new avatar shows.

---

### Contact details

1. Tap **More** → **Settings & Privacy**.
2. Tap **Contact details for mutual handover**.
3. Edit phone / email if shown.
4. Save.
5. Leave and open the screen again.

**Pass if:** values are still there.

---

### Notification preferences

1. Tap **More** → **Notification Preferences**.
2. Toggle a few switches (and quiet hours if shown).
3. Leave the screen.
4. Open **Notification Preferences** again.

**Pass if:** your toggles are still as you left them.

---

### Save a post

1. On Feed, tap the bookmark on a post.
2. Tap **More** → **Saved Posts**.

**Pass if:** that post is in Saved.

---

### Help & Support

1. Tap **More** → **Help & Support**.

**Pass if:** the Support screen loads.

---

## Provider accounts (skip if you only test parents)

### Provider home

1. On register, choose **Teacher / Institution**.
2. Sign up (Google or email).
3. Complete provider setup → tap **Finish setup**.

**Pass if:** you land in the provider home / shell, not the parent Feed.

---

### Provider activity

1. As provider, open activities.
2. Create an activity, then edit it.

**Pass if:** create and edit persist after you leave and come back.

---

### Provider profile

1. Open provider profile.
2. Edit and save.
3. Tap **Sign out** from profile.

**Pass if:** changes save. Sign out returns to login.

---

## Push / live feed (optional)

### Push when someone comments

1. On device A, create a post.
2. On device B (other parent in the same circle), comment on that post.
3. Watch device A (app in background if you can).

**Pass if:** a notification arrives if you allowed notifications. Opening it goes to the post.

---

### Live feed

1. Keep **Feed** open on device A.
2. On device B, publish a new post in a shared circle.

**Pass if:** the new post appears on A, or it appears after pull-to-refresh.

---

## 10-minute smoke (run in this order)

Do this on **one** signed-in parent device.

1. **Google sign-in** — login with Google → Feed.
2. **Refresh Feed** — pull down on Feed.
3. **Text post** — What's on your mind? → type → **Post**.
4. **Image post** — New post → add 1 image → **Post**.
5. **Video post** — New post → add short video → **Post**.
6. **PDF post** — New post → paperclip → PDF → wait for **Ready** → **Post**.
7. **Image + PDF** — add image, then PDF, wait for **Ready** → **Post**.
8. **Comment** — open your last post → write a comment → send.
9. **Open the PDF** — in the thread, tap the document.
10. **Sign out and back in** — **More** → **Sign out** → **Continue with Google**.

**Pass if:** all 10 complete with no crash, blank screen, or stuck spinner.

---

## Watch-outs

- **Image/video then document:** older builds lost the photo after adding a file. This build should keep both.
- **Documents 403:** if open/download fails, S3 must allow `quarantine/*` and `post-docs/*`.
- **Do not expect a public CDN link** for docs. Open them from the app while signed in.
- **Play upload:** `versionCode` must be higher than live production.

---

## Sign-off

| Area | Tester | Date | Pass / Fail | Notes |
|------|--------|------|-------------|-------|
| Setup + auth | | | | |
| Onboarding | | | | |
| Feed + tabs | | | | |
| Posts + media | | | | |
| Documents | | | | |
| Comments + share | | | | |
| Messages | | | | |
| Market | | | | |
| Discover | | | | |
| Settings | | | | |
| 10-min smoke | | | | |
