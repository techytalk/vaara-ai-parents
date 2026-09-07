# Share posts + deep links

**Status: superseded; not built.**

The consolidated, code-validated specification is now
[Post access and sharing — end-to-end implementation](./POST_ACCESS_AND_SHARING_IMPLEMENTATION.md).
It includes outsider-author thread access, school questions, authorization,
text/image/video sharing, short URLs, Open Graph, Android App Links, iOS
Universal Links, and the complete code-change inventory.

The remainder of this file is retained as the original product discussion and
should not be used as the implementation source of truth.

Today: share sends plain text (`body` / poll question + `— via Vaara Parents`). No short URL, no media attach, no deep link into a post.

Goal: sharing a post opens **that post** for the recipient when possible, with clear steps if the app is missing, they are logged out, or they are not in the circle — and still allow a **one-time / limited preview** of the shared post (Instagram-style “you can see this shared post”) with a banner that they are not a circle member.

Related: create/edit in `apps/mobile/app/circles/[circleId]/new-post.tsx`. Thread in `apps/mobile/app/circles/[circleId]/posts/[postId].tsx`. Feed share stubs in `apps/mobile/app/(app)/index.tsx`. Custom scheme already exists: `vaara-parents://` (`app.json` / Android intent filter). Store URLs live in `app.json` `extra.iosStoreUrl` / `androidStoreUrl`. Marketing site: `apps/web` + `https://www.vaara.ai`.

---

## 1. Why

Parents forward a useful tip or photo in WhatsApp. Recipients should land on the **same post**, not a dead text paste or the bare store page. Growth: every share carries a short branded link. Trust: circle privacy stays the default; non-members get a **limited shared view**, not full circle access.

---

## 2. Product rules (locked with product)

### Entry

Share always includes:

1. Short post preview text (body, or poll question, or “A parent post”)
2. **One short https link** to that post, e.g. `https://vaara.ai/p/{shareId}`  
   Not two long Play/App Store URLs in the message.

Optional later / parallel: attach first image/video as a file for WhatsApp-style media bubbles (separate from the link card).

### When someone opens the link

Resolve in this order:

| # | Situation | What we do |
|---|-----------|------------|
| 1 | **App not installed** | https link opens a small web interstitial → redirect to the correct store (Android → Play, iOS → App Store). After install, the **same link** (or deferred deep link) should open the post once they open the app. |
| 2 | **App installed, not logged in** | Open app on that deep link → auth gate: “Log in to view this shared post.” After login, continue to step 3. |
| 3 | **Logged in, member of the circle** | Open the normal post thread (full comments, vote, helpful, etc.). |
| 4 | **Logged in, not a member of the circle** | Show the **shared post preview** (text + media) with a clear banner: **“You’re not part of this circle.”** They can view this shared post (Instagram-style limited open from a share). They do **not** join the circle automatically, do **not** see the rest of the circle feed, and interaction beyond viewing is limited (see below). |

### Non-member preview (step 4) — intent

- **Visible:** post body, tag, media, poll question/options as read-only (no vote unless we later decide otherwise — **v1: no vote / no comment / no helpful**).
- **Banner:** not a member of this circle; CTA optional later (“Ask to join” / “Find similar circles”) — **not required in v1**.
- **Not visible:** other posts in the circle, member list, DMs from this surface.
- **“One time”:** product intent is “opened from this share link,” not a cryptographic single-open burn. v1 may allow reopening the same share URL while it is valid; optional later: expire share links or one-open tokens.

### Privacy

- Sharing is initiated by someone who can already see the post (member).
- Non-members only see what the **share preview API** returns for that `shareId`, not arbitrary circle content.
- Child nicknames / phones / emails still never appear on the post payload.
- Author remains anonymous handle + context label as today.

### OG / link preview

- **OG-style card** (title + image under the URL in WhatsApp) needs a **real https page** with Open Graph tags. Mobile-only store links do not provide that.
- With `https://vaara.ai/p/{shareId}` + a lightweight web page (or edge-rendered HTML), WhatsApp can show title + first image.
- Until that page exists, recipients still get the short URL and/or attached media file; they will not get a rich OG card.

---

## 3. Link shape

| Kind | Example | Role |
|------|---------|------|
| **Post share (canonical)** | `https://vaara.ai/p/{shareId}` | What goes in the share message. One link for Android + iOS. |
| **App install helper** | `https://vaara.ai/app` | Optional marketing-only “get the app”; not a substitute for post deep links. |
| **Custom scheme (fallback)** | `vaara-parents://p/{shareId}` | In-app / secondary; unreliable from WhatsApp alone — prefer https Universal/App Links. |

`shareId` may be the post UUID or a shorter opaque id that maps to `(post_id, primary_or_any_target_circle_id)`. Prefer opaque or signed ids if we want revoke/expiry later.

---

## 4. ASCII: open flow

```
Friend taps https://vaara.ai/p/abc
              │
              ▼
     App installed? ──no──► Web: “Get Vaara Parents”
              │                 │
             yes                ├── Android → Play Store
              │                 └── iOS → App Store
              ▼                      (deferred deep link if we add it)
        Logged in? ──no──► Login / register
              │                 then resume link
             yes
              │
              ▼
     Member of circle? ──yes──► Full post thread
              │
             no
              ▼
     Shared preview screen
     + banner: “You’re not part of this circle.”
     (view media/text; no circle feed)
```

---

## 5. Implementation plan (phased)

### Phase A — Share payload + short install link (small)

- Centralise `sharePost({ body, poll?, circleName?, shareUrl })`.
- Message:

```text
{preview}

Shared via Vaara Parents
https://vaara.ai/p/{shareId}
```

- Until Phase B exists, `shareId` route can temporarily redirect like `/app` (store by UA) — better than long store URLs, but **does not** open the post yet.
- Optional: download first media item and include in OS share where supported.

**Effort:** ~1–2 days.

### Phase B — https deep link opens the post in-app (required for “that post”)

1. **Web:** `GET /p/:shareId`  
   - If mobile UA without app: store redirect + “Open in app”  
   - OG tags from share preview (title, description, `og:image`)  
   - Apple App Site Association + Android Digital Asset Links for Universal/App Links  

2. **App:** handle `https://vaara.ai/p/:shareId` (and scheme fallback)  
   - Resolve share → `circleId` + `postId`  
   - Gate: login → member thread **or** non-member preview screen  

3. **API:**  
   - `POST` or create-on-share: register share token for a post the caller can read  
   - `GET /v1/shares/:shareId` (auth optional or required after login):  
     - `access: "member" | "preview"`  
     - member: same as GET post  
     - preview: body, media, tag, author public fields, `circleName` (or generic), `member: false`  
   - Never return full circle feed from this endpoint  

4. **UI:** non-member preview route/screen with banner copy agreed above.

**Effort:** ~3–5 days for solid B (links + gates + preview).  
**+1–2 days** for polished OG pages and deferred install → post.

### Phase C — later

- Deferred deep link after install (Branch / Firebase / first-party)
- Share link expiry / revoke
- “One cryptographic open” burn links
- Join-circle CTA from preview
- Multi-image share attachments

---

## 6. What we will not do in v1 of this feature

- Paste both long Play Store and App Store URLs in the message
- Open the whole circle for non-members
- Let non-members comment/vote/helpful on preview (unless product revisits)
- Rely only on `vaara-parents://` for WhatsApp shares

---

## 7. Acceptance criteria

- [ ] Share message contains short https post link (one URL)
- [ ] No app → store path for that OS
- [ ] App + logged out → login, then continue to post/preview
- [ ] App + member → full thread for that post
- [ ] App + non-member → post preview + “You’re not part of this circle”
- [ ] Non-member cannot browse the rest of the circle from that surface
- [ ] Android and iOS both use the **same** short link in the message
- [ ] (Phase B+) WhatsApp can show OG title/image when crawler hits `/p/:shareId`

---

## 8. Open points (decide during build)

1. **Preview permanence:** reopen forever vs expire after N days vs true one-open token.  
2. **Poll on preview:** read-only results vs hide counts vs allow vote. **Default v1: read-only, no vote.**  
3. **Which circle id** when a post targets multiple circles (use primary target).  
4. Exact hostname: `vaara.ai` vs `www.vaara.ai` vs `share.vaara.ai` (must match Universal Link entitlements).

---

## 9. Suggested build order

1. Document sign-off (this file)  
2. Phase A share copy + temporary `/p/:id` → store if needed  
3. Phase B API share resolve + app gates + non-member preview  
4. Universal/App Links + OG on web  
5. Optional media file attach in share sheet  

This matches: **install → log in → member full post / non-member preview with banner**, with one short URL for both platforms.
