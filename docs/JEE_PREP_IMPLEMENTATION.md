# Vaara Exam Prep — Implementation Spec (JEE Prep first)

**Version:** 1.4 — parent approval by email, email relay, legal sign-off brief  
**Prepared:** 2 October 2026; updated 2 October 2026  
**Audience:** Product owner, Cursor implementation agent, backend, content editors  
**Scope:** Free exam-prep web products (JEE first; SAT / CAT / coding / Finna later) on **separate domains**, linked from Child 360, with **Vaara as the shared identity provider**  
**Execution boundary:** Documentation only until the owner authorizes build work. Start with **JEE Prep** only.

---

## 1. Purpose

Parents who care about competitive exams need more than a catalogue of dates and registration links. They need a place where the **child practices**, builds **momentum**, sees **explanations**, and the **parent sees progress** next to Child 360.

Vaara will not ship this practice engine inside the React Native app in v1. Each prep vertical is a **mobile-friendly web app on its own domain** (same pattern as Finna World and future coding products). Child 360 shows each child's link; practice happens on that site.

### 1.1 Why web, not in-app

| Reason | Detail |
| --- | --- |
| Ship speed | Iterate on questions, chat UX, and content without App Store review |
| Device flexibility | Same URL works on phone and laptop |
| Isolation | Practice traffic and content stay off the parents API / mobile bundle |
| Independent marketing | Each site can be promoted on its own; parents who arrive can be brought into Vaara |

### 1.2 Locked decisions

| Item | Decision | Locked |
| --- | --- | --- |
| Surface | Web pages only for practice; app opens the URL in the **system browser** | 2 Oct 2026 |
| Verticals | JEE Prep first; SAT / CAT / coding later; Finna and other sister sites share the same identity platform | 2 Oct 2026 |
| Hosting | One Vercel project per vertical, never inside parents / `apps/web` | 2 Oct 2026 |
| Domains | **Separate brand domain per vertical**, not `*.vaara.ai` | 2 Oct 2026 |
| Who signs in | **Parent or child** (see §5.2). Guests can practice without any account | 2 Oct 2026 |
| Streak + leaderboard | Require a **linked** profile (a Vaara parent has approved). Guests get neither | 2 Oct 2026 |
| Vaara account for sister-site signups | **Lite** signup is enough; full Vaara onboarding is completed later in the app | 2 Oct 2026 |
| Login UI | Hosted on Vaara (`auth.vaara.ai`), standard OAuth redirect | 2 Oct 2026 |
| Session length | No fixed expiry; **sliding window** while the device keeps being used; parent can revoke | 2 Oct 2026 |
| Multiple children | **One link per child** in Child 360 | 2 Oct 2026 |
| Data shared with prep site | Pairwise `parent` and `child` ids, child class, school, by consented scope (§5.5) | 2 Oct 2026 |
| Parent's email | **Not shared.** Sites use a Vaara-operated email relay (§5.5) | 2 Oct 2026 |
| Child-started request: parent contact | **Parent email.** Vaara sends the approval email; no phone numbers in v1 (§5.3) | 2 Oct 2026 |
| Product shape | **Separate sites only** (one per exam, each with its own domain, brand and Vercel project). No combined "everything" product. Parents see all progress together in Child 360 (§14.2) | **2 Oct 2026, LOCKED** |
| Cost to users | Free | 2 Oct 2026 |
| Practice format | Previous-paper MCQs in a **chat** UI; explanation after each answer | 2 Oct 2026 |
| Momentum | Soft daily cap, default **2** answered questions / day (IST) | 2 Oct 2026 |

### 1.3 Assessment

This is the right model, and it is not overcomplicated if we hold to one rule:

> Vaara owns **who the parent is** and **which children they have**. Each prep site stores only **practice data** keyed by a Vaara child identifier.

The hard part is not OAuth itself. It is that **kids are the real users and cannot be expected to create parent accounts**. §5 solves that with a guest tier plus three ways to link a child to a parent.

Two things this doc surfaces that are easy to miss:

1. **Vaara has no web login today.** Parents sign in inside the mobile app (native Google / Apple, email + password). `auth.vaara.ai` needs a small web login + consent UI (§5.7).
2. **Under-18s.** Most JEE aspirants are minors. India's DPDP Act treats under-18s as children and expects verifiable parental consent before processing their data, and restricts tracking and targeted ads aimed at them. The design below keeps guests free of stored personal data and gates anything persistent behind parent approval. **Confirm with counsel before launch.**

---

## 2. Product: what JEE Prep is

**Name (working):** JEE Prep (brand TBD; may sit beside Vaara like Finna)  
**URL:** own domain, to be registered. Development uses `*.vercel.app` and `localhost` redirect URIs, so no blocker.  
**Audience:** Students preparing for JEE Main / JEE Advanced; parents watch progress in Vaara  
**Promise:** Free daily practice, past-paper style questions, explanations, and a light leaderboard.

### 2.1 Information architecture

```
www.<jee-brand>.com
│
├ /                         Landing (free, how it works, start practicing)
├ /practice                 Question(s) — chat UI (guest or linked)
├ /papers                   Browse by year → Main / Advanced → subject
├ /papers/:year/:paper/:subject
├ /join                     "Save my streak": I'm a parent / I'm a student
├ /c/:inviteToken           Invite link from Child 360 (§5.3 path B)
├ /auth/callback            OAuth return from Vaara (§5.3 path A)
├ /leaderboard              Linked + opted-in students only
├ /me                       Progress (linked), or "join to keep this" (guest)
└ /explain/:questionId      Standalone explanation
```

### 2.2 Browse model

Year → Paper family (`jee_main` | `jee_advanced`) → Session / paper → Subject (PCM) → Question. v1: curated last 3–5 years, not every historical paper.

### 2.3 Practice UX — chat format

```
┌─────────────────────────────────────────┐
│ Today · JEE Main 2023 · Physics         │
│                                         │
│ ┌─ Prep ──────────────────────────────┐ │
│ │ Q. A particle moves …               │ │
│ │ (A) …  (B) …  (C) …  (D) …          │ │
│ └─────────────────────────────────────┘ │
│ ┌─ You ───────────────────────────────┐ │
│ │ (B)                                 │ │
│ └─────────────────────────────────────┘ │
│ ┌─ Prep ──────────────────────────────┐ │
│ │ Correct. Explanation: …             │ │
│ └─────────────────────────────────────┘ │
│ Daily limit reached · Come back tomorrow│
└─────────────────────────────────────────┘
```

- One question at a time; immediate correct / incorrect + explanation.
- Daily cap default **2** (Asia/Kolkata). Browsing without answering does not consume it.
- **Guest:** can answer, sees explanations; progress is kept **in the browser only**. A "Join to save your streak and appear on the leaderboard" prompt appears after the first answer.
- **Linked:** streak, history, accuracy and leaderboard eligibility are stored server-side.

### 2.4 Leaderboard

Linked students who opt in only. Nickname is chosen on the prep site (run through the same content filter Vaara uses for posts). Never the parent's Vaara anonymous handle, never real name, class or school on the public board. Rank by weekly correct, then accuracy, then streak.

### 2.5 Parent progress in Child 360

Per child: practice link (copy / share / open), streak, questions (7d / all time), accuracy, last practiced, linked devices with revoke. Stats keyed by the child, so each parent sees the right kid.

---

## 3. How this sits next to existing Vaara exams

| Today in Vaara Parents | Exam Prep web |
| --- | --- |
| Competitive Exams catalogue | Practice engine on a separate domain |
| Child's Path JEE cards | Daily habit + papers |
| Child opportunity plans | Practice link + progress |

Catalogue = discovery and registration. Prep = learning product. Do not merge schemas.

App integration:
1. Path / opportunity JEE detail → **Practice free** → the child's link, or the vertical home if no child is selected.
2. Child 360 Exams → link + progress strip.
3. `Linking.openURL` to the **system browser**, with a short "opens in your browser" note, same class as organizer links.

---

## 4. Hosting & repo strategy

### 4.1 Domains

| Vertical | Vercel project | Domain |
| --- | --- | --- |
| JEE Prep | `vaara-jee-prep` | Owner-registered brand domain |
| SAT / CAT / coding | one project each | Own domain each |
| Finna World | existing | Existing domain |
| **Vaara identity** | parents API project (+ web pages) | **`auth.vaara.ai`** |

**Separate domains vs `*.vaara.ai` subdomains.** Separate domains are the right call given the goal of independent marketing:

| | Separate domains | `*.vaara.ai` subdomains |
| --- | --- | --- |
| Independent brand / SEO / ads | Yes | Shares Vaara's reputation, both ways |
| Selling, partnering, or spinning out a site later | Easy | Entangled |
| Cookie / privacy isolation (children's site) | Clean | Cookie scope can leak if set to `.vaara.ai` |
| Login across sites | Needs OAuth (we are building it) | Could share a cookie, but couples products |
| Cost | A domain per site per year | Free |

OAuth is needed in both worlds once sites are independently marketed, so the extra cost of separate domains is small.

### 4.2 GitHub — one prep monorepo

```
vaara-exam-study-prep/
  apps/
    jee-prep/            → Vercel project + JEE brand domain
    sat-prep/ cat-prep/  → later
  packages/
    ui/                  chat practice components
    prep-db/             schema + migrations
    prep-shared/         quota, taxonomy, types
    vaara-auth-client/   "Sign in with Vaara" client helpers (PKCE, device flow, session)
```

One Vercel project per `apps/*`, each with its own Root Directory. Split a vertical into its own repo only if it diverges.

**Repo vs Vercel vs database (decision, 2 Oct 2026).**

| Layer | Setup |
| --- | --- |
| GitHub | One repo: `vaara-exam-study-prep` |
| Vercel | **One project per site** (`vaara-jee-prep`, `vaara-sat-prep`, `vaara-cat-prep`, `vaara-ca-prep`), same repo, different Root Directory (`apps/<site>`) |
| Domain | One per site, attached to that site's Vercel project |
| Vaara OAuth client | One per site (own client id, secret, redirect URIs, pairwise salt) |
| Env vars and secrets | Per Vercel project; never shared across sites |
| Database | One Supabase project for prep with **a separate schema per site** (`jee`, `sat`, `cat`, `ca`). Move a site to its own project if it grows or is spun out |
| Build filter | Each project only rebuilds when its own app or a shared package changes (e.g. Turborepo `turbo-ignore`) |

Why one Vercel project per site, not one for all: separate brand domains, independent deploy and rollback, separate secrets and per-site OAuth clients, separate traffic and cost visibility, and an easy path to spin a site out.

A child on two sites is two separate students (pairwise ids, §5.5), so leaderboards and streaks are per site.

**What belongs in `vaara-exam-study-prep` (decision, 2 Oct 2026).** Only products built on the **practice engine**: question bank, chat practice, daily limit, explanations, streak, leaderboard.

| Product | Repo |
| --- | --- |
| JEE Prep, SAT Prep, CAT Prep, CA (Chartered Accountancy) prep | `vaara-exam-study-prep` (one app each) |
| Study videos | **Separate repo** (e.g. `vaara-learn-videos`): different data model, video hosting / encoding / bandwidth cost, content licensing, player UI |
| Coding, Finna-style products | Their own repos |

Every repo, including the separate ones, signs users in through **Sign in with Vaara** (the provider lives in the parents repo). The client helper starts as `packages/vaara-auth-client` inside `vaara-exam-study-prep`; when a second repo needs it, **publish it as a private package** (e.g. GitHub Packages) so all repos install one version instead of copying code.

### 4.3 Stack suggestion (JEE Prep)

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) on Vercel |
| DB | Separate Supabase / Postgres for prep (never parents DB) |
| Auth | Vaara OAuth only; no local passwords |
| Analytics | Privacy-aware; no behavioural ad tracking on minors |

---

## 5. Identity: guest, linked student, and the parent bridge

### 5.1 States

```
GUEST ──(join, approved by a parent)──► LINKED STUDENT
 │                                          │
 browser-local only                         server-side: streak, history,
 no PII stored                              leaderboard, parent sees stats
```

| State | Stored where | Gets |
| --- | --- | --- |
| **Guest** | Browser only (localStorage). No server-side identity | Questions, explanations, soft daily cap |
| **Linked student** | Prep DB, keyed by Vaara child | + streak, history, leaderboard, parent progress |

On linking, guest attempts are **imported once** (capped) so the first streak is not lost.

### 5.2 Parent or child — recommendation

**Do not make children create Vaara accounts.** Any model where a 15-year-old must pick "parent" or "child" at signup will confuse both. Instead:

- **The parent is the only person who ever authenticates with Vaara.**
- **The child is a profile under the parent**, usable on the child's own device through a long-lived device session the parent approved.

A child can start the process (guest → "ask my parent") or a parent can (from the app or from the site). All paths end in the same record, a **device session for a specific child**.

### 5.3 Three ways a child gets linked

All three produce: `students` row ↔ `vaara_child_id`, plus a device session. They differ only in who starts it.

#### Path A — Parent lands on the prep site (e.g. from marketing)

Standard **OAuth 2.0 Authorization Code + PKCE**.

```
JEE Prep  "I'm a parent → Continue with Vaara"
   → auth.vaara.ai/authorize?client_id=jee&code_challenge=…&scope=…
   → Vaara web login  (new parent: LITE signup, §5.8)
   → Consent: "JEE Prep wants: [scopes]"  + choose child / add a child
   → redirect to /auth/callback?code=…
   → JEE Prep exchanges code (PKCE) → ID token + userinfo for that child
   → device session created for this browser
```

If the parent has several children, the consent screen shows a child picker (or "add a child"). One link per child, one device session per approval.

#### Path B — Parent starts from Child 360 (the most common path)

The parent is already logged in inside the app, but the system browser has no Vaara cookie. Avoid a second login with a **handoff ticket**.

```
Child 360 → Aarav → "Practice JEE" 
   → app calls api: POST /v1/children/:id/prep-links { vertical: "jee", mode: "self" }
   → returns https://<jee-brand>/c/{inviteToken}   (single-use, ~2 min)
   → system browser opens it
   → JEE Prep redeems the invite at auth.vaara.ai → device session for Aarav
```

The same screen has **"Send to Aarav"**: mode `share`, a single-use invite valid for 7 days, shared by WhatsApp or QR. Aarav taps it on his own phone and is linked with no login. The parent sees the device under "Linked devices" and can revoke it. This is an authenticated parent's explicit approval, so no extra consent screen is needed.

#### Path C — Child starts (guest → "ask my parent")

Standard **OAuth 2.0 Device Authorization Grant (RFC 8628)**: the kid's device shows a code, the parent approves elsewhere.

**Sign-up gate (owner decision, 2 Oct 2026).** On "Join", the site asks **"Are you a parent or a student?"**

- **Parent** → Path A (Continue with Vaara).
- **Student** → collect nickname, class, and **how to reach a parent for approval**, then start the device request below.

```
Guest taps "Join" → "I'm a student"
   → nickname + class + age band (neutral: "Under 13 / 13–15 / 16–17 / 18+")
   → "Who approves this?"   parent's email address   [Send request]
   → prep site: POST auth.vaara.ai/device/code
        → { device_code, user_code: "K7P-4QX", verification_uri }
   → Vaara emails the parent the approval link (see delivery below)
   → kid's browser polls POST /token (device_code) every few sec
   → screen: "Waiting for your parent to approve · expires in 7 days"  [Resend email] [Copy link]

Parent opens https://auth.vaara.ai/d/K7P4QX
   (Vaara app via Universal Link if installed, else web)
   → logs in / LITE signup
   → "Aarav (Class 11) wants to join JEE Prep and keep a streak.
       Approve for: [existing child ▾ / add child]
       Shares: [scopes]"   [Approve] [Decline]
   → on Approve, the kid's polling succeeds → device session, guest data imported
```

**Delivery of the request to the parent (owner decision, 2 Oct 2026): email.**

1. The child enters the parent's **email address**.
2. **Vaara** (not the prep site) sends the approval email, e.g. `Vaara <approvals@vaara.ai>`. The email shows only the child's nickname and class, the site name, and one button: **Review request** → `https://auth.vaara.ai/d/K7P4QX`.
3. The email also has **"This isn't my child / report"**, which adds the address to a block list so it cannot be emailed again.
4. Same screen offers **Copy link** and the phone's **Share** sheet as a fallback (the child can paste it into any chat app). No phone number is collected anywhere.

Why email works for v1:

| Point | Detail |
| --- | --- |
| Matches Vaara login | Parents already sign in to Vaara with email / Google, so the email lands on the identity they will use to approve |
| No new provider category | Vaara already calls **Resend** for one internal alert (`apps/api/src/lib/safety-alert.ts`), though the key is optional and unset in `.env.example` |
| No phone infrastructure | Avoids SMS / WhatsApp Business setup and India's SMS template registration (DLT) |

What has to be built around it (the current Resend code is a single internal alert, not a user-facing mailer):

| Item | Detail |
| --- | --- |
| Verified sending domain | SPF / DKIM for `vaara.ai` in Resend so mail reaches inboxes, not spam |
| Transactional mail module | Templates (approval, approved, declined), plain-text version, send log |
| Bounce / complaint handling | Webhook marks bad addresses so we stop sending |
| Abuse controls | A form that emails arbitrary addresses can be used for spam (see below) |

**Abuse controls on the "parent email" form:**

- Rate limits: per IP, per device, per target address (e.g. at most 1 email per address per 24 h and 3 per week), using the existing Redis rate limiter.
- Bot check on the form (e.g. Cloudflare Turnstile or an equivalent).
- Email body never includes more than nickname and class band, and never marketing.
- Block list from the "not my child" link; optional disposable-email domain rejection.
- No auto-resend loops; the child can resend manually, within the limits above.

**What we keep about the parent's email.** The address is stored **encrypted and only on the pending request**, and deleted when the request is approved, declined, or expires (max 7 days). After that only a one-way hash (HMAC) is kept for rate limiting and the block list. One optional reminder email at 48 h can be added later.

**Phone and WhatsApp.** Not used in v1. If wanted later: the child's own phone can open `https://wa.me/<number>?text=<link>` so the message is sent from the child's WhatsApp and the number never reaches our servers; or Vaara can add a paid SMS / WhatsApp Business provider.

**Approval is only as strong as the parent's Vaara account.** A child can type their own email or sign up as the "parent". Every consumer app has this gap; it is reduced, not removed, by (a) the parent needing a verified email / Google identity, (b) an explicit parent-attestation checkbox ("I am the parent or legal guardian and I am over 18"), (c) a pending request expiring in 7 days, and (d) one parent account approving many children being visible in Child 360. Stronger adult verification (§5.13) is layered later on the **parent account**, once, and then covers every sister site.

**Before approval.** If the kid never gets approval they stay a guest. The pending request holds only a nickname, class band and age band, and **auto-deletes after 7 days**. A stricter option, if counsel wants zero child data on the server before consent, is to carry those fields inside the signed approval link instead of storing them.

### 5.4 What a prep site receives

After any path, the prep site holds:

- an **ID token** (JWT, signed by Vaara) with claims per consented scope (§5.5)
- a **device session** it issues itself: opaque refresh token in an HttpOnly, Secure, SameSite=Lax cookie on the prep domain, hash stored server-side
- a link record `students.vaara_child_ref` ↔ `students.vaara_parent_ref`

### 5.5 Scopes and claims

| Scope | Claims | Notes |
| --- | --- | --- |
| `openid` | `iss`, `sub` (**per-client pairwise** parent id), `aud`, `exp` | Always |
| `child` | `child_ref` (pairwise), nickname | Always for prep clients |
| `notify.email` | **No address is returned.** The site may ask Vaara to email this parent through a relay (see below) | Requested by JEE Prep: yes (owner decision, 2 Oct 2026: relay, not the real email) |
| `child.class` | class / grade | Requested: yes |
| `child.school` | school name | Requested: yes. **Never shown publicly**; used for personalization and optional school boards later |

The consent screen lists exactly the scopes requested. School and email are shown and can be declined if the client marks them optional.

#### Pairwise (per-site) identifiers: how they work

This is the OpenID Connect "pairwise subject identifier" pattern (OIDC Core §8.1). The same parent or child gets a **different opaque id on every site**.

```
Vaara internal:   parent  6f1c…-uuid       child  a93e…-uuid

JEE Prep sees:    sub = p_Xk3…             child_ref = c_9Qm…
Finna sees:       sub = p_Tz8…             child_ref = c_Ld2…
```

**Generating the id (deterministic, per client):**

```
subject = prefix + base64url( HMAC_SHA256( client.pairwise_salt, kind + ":" + internal_id ) )[0..22]
          kind = "parent" | "child"      prefix = "p_" | "c_"
```

- `pairwise_salt`: 32 random bytes generated when the client is registered, stored in `oauth_clients`, **never changed** afterwards. Different salt per client is what makes ids unlinkable across sites.
- Same input always gives the same output, so a parent who returns to the site (or links a second device) gets the same id.
- One-way: a site cannot recover or guess a Vaara id from its own ids.

**Reverse lookup (a site refers to a child, Vaara must find the real one).** HMAC cannot be reversed, so Vaara records each issued id the first time it is granted:

```
oauth_subjects
  client_id, kind (parent|child), internal_id, subject,
  created_at
  UNIQUE (client_id, subject)
  UNIQUE (client_id, kind, internal_id)
```

Any server-to-server call from a site ("child_ref `c_9Qm…` practiced today", "send me this child's streak") is authenticated as that client, and Vaara resolves `(client_id, subject)` to the internal id. A client can only resolve subjects it was issued; the same `child_ref` presented by another client resolves to nothing.

**Where it is used:**

| Surface | Which id |
| --- | --- |
| ID token `sub` | Pairwise parent id |
| `child_ref` claim | Pairwise child id |
| Prep DB (`students.vaara_parent_ref`, `vaara_child_ref`) | Pairwise ids only |
| Prep → Vaara server calls (stats push / pull) | Pairwise ids + client credentials |
| Vaara internal tables, mobile app, logs | Internal ids only |

**Honest limits:**

- **Email would defeat unlinkability, so sites never get it.** If two sites received the same parent email they could correlate that parent regardless of `sub`. With the relay below, no site receives the real address.
- **Never change a client's salt.** Doing so changes every id that client holds. Treat it like a signing key: secret store, backed up.
- **Deleting a parent or child** removes their `oauth_subjects` rows and revokes grants, so sites can no longer resolve those ids.

#### Email relay: sites never see the parent's real address

Decision (2 Oct 2026): sister sites use a **relay**, not the real parent email.

**v1 — outbound relay (build this):**

```
JEE Prep  → POST auth.vaara.ai/v1/notify   (client credentials)
              { parent_sub: "p_Xk3…", template: "weekly_progress", fields: { child_nickname, streak, … } }
Vaara     → resolves parent_sub for this client (oauth_subjects)
          → checks the parent granted notify.email and has not unsubscribed
          → renders the approved template and sends from Vaara
```

- The site **never receives an address**, only the ability to request an email.
- **Templates are registered per client** (fixed wording, limited fields), so a site cannot send arbitrary content or marketing through Vaara.
- Rate limited per client and per parent; every email has a one-click unsubscribe that revokes `notify.email` for that site; sends are logged.
- Marketing from a site to a parent needs a separate opt-in on that site; the relay is for transactional messages (approval, progress, reminders).

**Later — inbound relay address (only if a site needs replies):** a per-site address like `p_Xk3…@relay.vaara.ai` that forwards to the parent. It needs an MX record for the relay domain, inbound mail handling, spam filtering and reply headers, so it is a separate piece of work and not part of v1.

### 5.6 Sessions and revocation

| Item | Rule |
| --- | --- |
| Access / ID token | Short-lived (minutes); used only at link time and for server-to-server calls |
| Device session | Opaque refresh token, **sliding 12 months**, renewed on use, rotated on each refresh |
| Effective behaviour | "Stays linked as long as the device is used" |
| Revoke | Parent: Child 360 → Linked devices → Revoke. Also automatic on child deletion or account deletion in Vaara |
| Reuse detection | A refresh token presented twice revokes the whole session family |

An indefinite session on a shared family laptop is a real risk. The sliding window plus parent-visible device list and revoke keeps "no restriction" practical without being unbounded.

### 5.7 What Vaara must build

**Gap:** Vaara has native-app login only. Needed:

| Piece | Detail |
| --- | --- |
| OAuth / OIDC provider | `GET /authorize`, `POST /token`, `POST /device/code`, `GET /userinfo`, `GET /.well-known/openid-configuration`, JWKS |
| Client registry | `oauth_clients` (id, name, redirect URIs, allowed scopes, pairwise salt, PKCE required) |
| Web login (first one) | Email + password (existing `/auth/*` logic) and Google **web** sign-in. Needs a Google **Web** client ID: today only iOS / Android client IDs exist. Apple web needs a Services ID: defer |
| Consent + child picker UI | Server-rendered pages (Vite static `apps/web` is not enough), on `auth.vaara.ai` |
| Handoff / invite service | `POST /v1/children/:id/prep-links`, redeem endpoint |
| Linked devices screen | In Child 360 |
| Cookie session | HttpOnly session on `auth.vaara.ai` for the consent step only; unrelated to the mobile JWT |

Implementation approach: build thin on `jose` (already used for JWTs in `apps/api`), with just the three grants above. A full off-the-shelf OIDC server is more than needed while all clients are first-party. Revisit if third parties are ever onboarded.

### 5.8 Lite signup for sister-site parents

Existing Vaara onboarding is long (location, school, circles). Parents arriving from a marketing page should not hit it.

| Step | Collected |
| --- | --- |
| Account | Email + password, or Google |
| Child | Nickname, class (school optional) |
| Done | Redirect back to the prep site |

The account is flagged with `onboarding_complete = false` and an `origin_client` value. When the parent later opens the Vaara app, the remaining onboarding runs as usual. This turns every marketed sister site into a **Vaara acquisition funnel**, which is the point of tapping those parents into Vaara.

### 5.9 `auth.vaara.ai` vs `api.vaara.ai/oauth`

| | `api.vaara.ai/oauth/*` | `auth.vaara.ai` (recommended) |
| --- | --- | --- |
| Work to start | Lowest | About half a day more: DNS + Vercel domain alias, can point at the same API deployment |
| Issuer (`iss`) | `https://api.vaara.ai` | `https://auth.vaara.ai` |
| Later change | Changing `iss` forces every client and token to be reissued | N/A |
| Pages | API host is JSON-only | Hosts HTML login / consent cleanly |
| Cookies / CORS | Mixed with the app API | Isolated |

The difference is small today and expensive to change later because the issuer is baked into every client config and token. Use `auth.vaara.ai` from day one, initially routed to the existing API project.

### 5.10 Data placement

| Data | Where |
| --- | --- |
| Parent account, children, Child 360 | Vaara parents DB (existing) |
| `oauth_clients`, codes, device codes, invites, link records | Vaara parents DB |
| Papers, questions, attempts, streaks, leaderboard | Prep DB (never parents DB) |
| Guest practice | Browser only |

```
Vaara (parents DB)
  oauth_clients(client_id, name, redirect_uris[], scopes[], pairwise_salt, created_at)
  oauth_auth_codes(code_hash, client_id, parent_id, child_id, scopes, code_challenge, expires_at, used_at)
  oauth_device_requests(device_code_hash, user_code, client_id, nickname, class_band, age_band,
                        parent_email_enc, status, parent_id, child_id, expires_at)   -- parent_email_enc nulled on decision/expiry (max 7 days)
  email_suppressions(email_hmac, reason, created_at)                                   -- "not my child" block list + bounces
  oauth_subjects(client_id, kind, internal_id, subject)                                -- pairwise ids (§5.5)
  oauth_notify_templates(client_id, template_key, subject, body, allowed_fields[])     -- email relay (§5.5)
  child_prep_links(id, child_id, client_id, mode, invite_hash, expires_at, used_at, revoked_at)
  oauth_grants(id, parent_id, child_id, client_id, scopes, created_at, revoked_at)   -- drives Linked devices / revoke

Prep (per vertical or shared)
  students(id, vaara_parent_ref, vaara_child_ref UNIQUE, nickname, class, leaderboard_opt_in, created_at)
  device_sessions(id, student_id, refresh_hash, device_label, last_used_at, revoked_at)
  attempts(id, student_id, question_id, chosen, correct, answered_at, day_key)
  daily_quota(student_id, day_key, answered_count)
```

### 5.11 Security checklist

- Redirect URIs matched exactly, per client; no wildcards.
- PKCE required for all web clients.
- Auth codes, device codes, invites: single-use, hashed at rest, short TTL (code 60 s; device code 10 min; self-invite 2 min; share-invite 7 days).
- Rate limit `/authorize`, `/token`, `/device/*` (Vaara already has the middleware).
- User codes are unambiguous characters, with attempt limits.
- Consent screen always shows the requesting site, the child, and the scopes.
- Opening Google / Apple sign-in inside an embedded webview fails, which is another reason to use the system browser.
- No third-party ad or behavioural trackers on prep sites.
- Parent can see and revoke every linked device.

### 5.12 Effort (rough; one engineer, confirm when scoped)

| Piece | Rough size |
| --- | --- |
| Web login + consent UI on `auth.vaara.ai` (email/password + Google web) | 4–6 days |
| `authorize` / `token` / JWKS / userinfo + client registry | 3–4 days |
| Device grant (Path C) | 2–3 days |
| Invite / handoff service + Child 360 UI + linked devices | 3–4 days |
| Lite signup + `onboarding_complete` flow | 1–2 days |
| Prep-side client package (`vaara-auth-client`) | 2–3 days |
| Security review + tests | 2–3 days |
| Transactional email module (verified `vaara.ai` sending domain, templates, bounce handling, suppression list) | 2–3 days |
| Email relay (`/v1/notify`, per-client templates, unsubscribe) | 2 days |
| **Total** | **~4 weeks**, reusable by every sister site |

Fastest cut: ship **Path B + Path A** first (parent-initiated). Add **Path C** (child-initiated) in the following slice. Guests work from day one regardless.

---

### 5.13 How other apps handle child-initiated sign-up, and India's rules

**What well-known apps do** (from their public help pages):

| App | Child-initiated flow |
| --- | --- |
| **Khan Academy** | Under-13 signs up, the next screen asks for a **parent's email**; the parent gets approval instructions and must approve **within 7 days**, otherwise the child account is deleted. Parent can also create the child account directly. Child accounts are restricted (no public profile data, no forums, no direct email) |
| **Duolingo** | Younger children can use a **parent's email** for permission; under-13 profiles are private and ad-free |
| **Roblox** | Child taps **Add parent** and enters the parent's email; the parent gets an email, must create or use an account with parent privileges and **verify they are an adult (ID, card, or face age estimate)** before the link is accepted |

The shared pattern is exactly what Path C does: the child declares a parent, a message goes to the parent, the account is limited until the parent approves, and unapproved requests expire (Khan Academy: 7 days). Two points are worth copying:

1. **Restricted until approved**, with automatic cleanup (our guest tier plus 7-day pending-request deletion).
2. **Parent identity strength is a separate, reusable step** (Roblox): verify the adult once on the parent account.

**India (DPDP).**

- Under-18 is a child. Rule 10 of the DPDP Rules, 2025 requires **verifiable parental consent before processing a child's personal data**, with due diligence that the person claiming to be the parent is an **identifiable adult**.
- Adult status can be established from **reliable identity-and-age details the platform already holds**, or from details the parent voluntarily provides, including a **virtual token from an authorised entity (DigiLocker is expressly included)**. No single method is mandated.
- The rules' own worked examples cover a child declaring a parent, then the platform letting the parent identify themselves and checking adult status before processing, which matches Path C.
- Reported commencement of these duties is around **May 2027** (18-month phase-in from the November 2025 notification). Education appears among processing that can be exempted, but it is **not a blanket exemption** for a consumer practice site. Treat all of this as needing counsel confirmation.

**Plan for Vaara:**

| Stage | Parent assurance | Notes |
| --- | --- | --- |
| v1 | Verified email / Google sign-in + explicit "I am the parent/guardian, 18+" attestation on the consent screen | Ships with Path C |
| v2 (before DPDP duties commence) | Optional or required one-time **adult verification** on the parent account (e.g. DigiLocker age token) once counsel picks the method | Stored as `parent_verification_level`; applies to **all** sister sites |

Record per approval: parent ref, child ref, client, scopes, timestamp, consent text version, and verification level. Withdrawal = revoke the grant in Child 360.

### 5.14 Where the auth pages live and what it does to the existing API

**Hosting today.** `vaara.ai` marketing is `apps/web`, a **separate Vercel project** that is a Vite static site (with a few rewrites). `api.vaara.ai` is `apps/api`, a Hono app on Vercel (region `bom1`) with all routes under `/v1/*` and `/internal/*`.

**Where the OAuth pages go (decision).**

| Option | Verdict |
| --- | --- |
| **A. Serve login / consent / approve pages from the API project** (Hono, a handful of server-rendered pages) at `auth.vaara.ai` | **Recommended.** Same-origin with the OAuth endpoints, so no CORS and no cross-project cookies; reuses the existing DB, rate limits and `jose`; one deployment |
| B. New `apps/auth` Vercel project (React) calling the API | Nicer UI later, but two deployments and cross-origin cookies |
| C. Put the pages in the existing marketing project | Avoid: static site, couples marketing deploys to login |

**Will it disturb the existing setup? No, if these guardrails are followed:**

| Risk | Guardrail |
| --- | --- |
| New domain on the API project | Adding `auth.vaara.ai` is an **extra alias** on the same project. `api.vaara.ai`, the mobile app, crons and `/v1/*` keep working untouched |
| New routes colliding with old ones | New routes live under `/oauth/*`, `/.well-known/*`, `/d/*` only, mounted separately from `/v1/*`. Nothing existing is renamed |
| Exposing OAuth on the API host and `/v1` on the auth host | **Host guard middleware:** OAuth routes answer only on `auth.vaara.ai` (and localhost in dev); `auth.vaara.ai` serves nothing else |
| App-wide `cors()` is wide open | OAuth routes get their own strict CORS (exact prod origins for the token endpoint); do not rely on the global `cors()` |
| Token key reuse | OIDC ID tokens are signed with **new asymmetric keys (ES256 / RS256) published via JWKS**. The mobile app's existing JWT secret is never reused or exposed |
| Cookies | The consent session cookie is `HttpOnly; Secure; SameSite=Lax` and **host-only on `auth.vaara.ai`** (no `Domain=` attribute), so it is not sent to `api.vaara.ai` or `vaara.ai` |
| Database | Additive migrations only (new tables); no change to existing tables beyond optional `users` columns (`origin_client`, `parent_verification_level`) |
| Rate limits | Same Redis, **separate key prefixes** (`oauth-authorize`, `oauth-token`, `oauth-device`) |
| Rollout | Behind an `OAUTH_ENABLED` env flag; ship dark, then enable per environment |

Mobile sign-in (`/v1/auth/google`, `/v1/auth/apple`, `/v1/auth/login`) is not modified. The web login on `auth.vaara.ai` **calls the same credential-checking logic** but issues a cookie session instead of a mobile JWT.

---

## 6. Content: previous exam questions

Official NTA / JEE Advanced sources; original Vaara explanations; curated P0 pack (last ~3 years Main, PCM); editorial QA before `published`; counsel check before bulk-hosting official PDFs (structured question records are safer than PDF mirrors).

```
papers(id, exam_family, year, session_label, source_url, status)
questions(id, paper_id, subject, stem_md, options_json, answer_key, explanation_md, difficulty, concept_tags[], status)
```

---

## 7. Phased delivery

### Phase 0 — Foundations

Repo name locked: **`techytalk/vaara-exam-study-prep`** (2 Oct 2026). Private. Separate from `techytalk/vaara-ai-parents`.

1. Create the private GitHub repo (empty, no README, no license).
2. Scaffold locally: npm workspaces, `apps/jee-prep` (Next.js), `packages/ui`, `packages/prep-db`, `packages/prep-shared`, `packages/vaara-auth-client`, and copy this spec into `docs/`.
3. First commit and push to `main`.
4. Create the Vercel project `vaara-jee-prep`, connected to this repo, Root Directory `apps/jee-prep`. Leave it on `*.vercel.app` until the brand domain exists.
5. Create the prep Supabase project. Schema `jee` only for now; `sat`, `cat`, `ca` come with those apps.
6. When the JEE domain is registered, add it to that Vercel project. Do not add it to the parents projects.

SAT, CAT and CA are later apps in this same repo, each with its own Vercel project. Do not create those projects yet.

- [ ] GitHub repo `vaara-exam-study-prep`; scaffold `apps/jee-prep`
- [ ] Vercel project `vaara-jee-prep` on `*.vercel.app`
- [ ] Prep DB + migrations
- [ ] Brand domain registered and pointed when ready

### Phase 1 — Guest practice (no identity dependency)
- [ ] P0 questions, chat practice UI, explanations, soft daily cap
- [ ] `/papers` browse
- [ ] "Join to save your streak" prompt (disabled until Phase 2)

### Phase 2 — Vaara identity (shared platform)
- [ ] `auth.vaara.ai` alias, client registry, web login, consent UI
- [ ] Authorization Code + PKCE (Path A), invite / handoff (Path B)
- [ ] Child 360: practice link, "Send to <child>", linked devices
- [ ] Lite signup flow
- [ ] JEE Prep registered as the first client; linked student sessions

### Phase 3 — Streak, leaderboard, parent stats
- [ ] Server-side streak and history for linked students; guest import
- [ ] Opt-in leaderboard
- [ ] Progress strip in Child 360

### Phase 4 — Child-initiated linking
- [ ] Device Authorization Grant (Path C), "Ask my parent" UX

### Phase 5 — Next verticals
- [ ] SAT / CAT / coding each get their own domain and client registration; Finna can adopt "Sign in with Vaara" as a client.

---

## 8. App changes in `vaara parents`

| Area | Change |
| --- | --- |
| API | `/oauth/*` routes (on `auth.vaara.ai`), `child_prep_links` + invite endpoints, grants / revoke |
| Web | Login + consent pages (server-rendered) |
| Pathway `jee-main` / `jee-advanced`, Competitive Exams | CTA → practice link |
| Child 360 Exams | Practice link, Send to child, progress, linked devices |
| Universal Links | `auth.vaara.ai/d/*` opens the app's approval screen when installed |
| Config | Prep base URL per vertical via env |

---

## 9. Success metrics

| Metric | Why |
| --- | --- |
| Guest → "join" tap rate, join completion rate | Funnel health |
| Time from child request to parent approval (Path C) | Is "ask my parent" working |
| Day-1 → Day-2 return | Habit |
| Median questions / week / child | Momentum |
| New Vaara parent accounts originating from sister sites | Acquisition value |
| Leaderboard opt-in % | Social layer |

---

## 10. Remaining decisions (owner)

Resolved on 2 Oct 2026: parent/child gate at "Join" (§5.3), parent contact is **email** and Vaara sends the approval (§5.3), sites get an **email relay**, not the real address (§5.5), Google web client will be created (§5.7), auth pages live in the API project behind a host guard (§5.14), pairwise ids per site (§5.5).

1. **JEE brand domain**: name, when you register it.
2. **Daily cap**: hard 2 per day, or configurable?
3. **Approval email sender**: which address (suggested `approvals@vaara.ai`), and is `vaara.ai` already verified in Resend with a production API key set?
4. **Legal sign-off (§12)**: who is the privacy lawyer or advisor, and by when? Needed before public launch to minors, not before building.
5. **Adult verification of parents (v2)**: method counsel prefers (e.g. DigiLocker age token).
6. **School sharing**: confirm it stays private, never on public leaderboards. Needed at launch, or only class?
7. **Content sourcing**: in-house from official papers only, or a partner?
8. **Build order**: Path A + B first, then C (recommended), or all three together?

---

## 11. Out of scope

- Practice UI inside Expo for v1
- Prep apps on the parents Vercel project
- Subdomains of `vaara.ai` for prep sites
- A combined multi-exam / "everything" product (locked out, 2 Oct 2026)
- Local email / password accounts on prep sites
- Third-party (non-Vaara) OAuth clients
- Paid courses, full mock timers

---

## 12. Legal sign-off (what it is and what to bring)

**Legal sign-off** means a lawyer or privacy advisor reads the plan and confirms in writing that it is acceptable to launch a service used by minors. It is a review step, not a build step: engineers build, the lawyer approves the wording, the data handling and the consent method. It must be done **before the public launch to under-18s**; building and internal testing can go ahead first.

**Who:** an Indian lawyer or consultancy experienced in data protection (DPDP Act and Rules, 2025) and, ideally, children's or edtech products. The product owner appoints them; it is not an engineering decision.

**What to ask them to review (hand them this doc, §5.3, §5.5, §5.13):**

1. **Parental consent method.** Is "verified parent account + 'I am the parent/guardian, 18+' attestation" enough for v1? What stronger adult check is needed and by when (DigiLocker age token or other)?
2. **Consent wording.** Text on the consent screen, the approval email, and the privacy notice for children's data; the consent record we keep (who, which child, which site, scopes, time, text version, verification level).
3. **Pending requests.** May Vaara store a child's nickname and class band for up to 7 days before approval, or must that travel only inside the signed link?
4. **Data held about the parent.** Storing the parent's email (encrypted, deleted on decision or after 7 days; hash kept for rate limiting and block list).
5. **Guests.** Browser-only guest practice with no server-side identity: confirm no consent is needed for that tier.
6. **Retention and deletion.** How long practice history and leaderboard rows are kept; deletion when the parent withdraws or deletes the child.
7. **Leaderboard and nicknames.** Public display of a child's nickname and rank, moderation, and the no-tracking / no-targeted-advertising limits for children.
8. **Sister-site marketing.** Rules for emailing parents (transactional via the relay vs marketing needing its own opt-in).
9. **Timing.** What applies before and after the DPDP duties commence (reported around May 2027), and whether any educational exemption can be relied on.
10. **Content rights.** Whether structured question records from official JEE papers can be republished, and attribution requirements.

---

## 13. Next action

1. Answer §10.
2. Build Phase 1 (guest practice) and, in parallel, the Phase 2 identity workstream in the parents repo, which every sister site reuses.
3. Register the brand domain and wire DNS when ready.
4. Start editorial intake for the P0 JEE question pack.

Until then, this document is the implementation contract for **JEE Prep first**.

---

## 14. Future concept: challenges, and one product vs many sites

**Status:** concept only (owner, 2 Oct 2026). Not in Phase 1–4. Recorded so today's design does not block it.

### 14.1 Challenges

**Idea.** After answering a question, a student can challenge a friend to the same question.

**Design rule.** One challenge **engine**, built once as a shared package (`packages/challenges`), and **one instance per site** (JEE challenges JEE, SAT challenges SAT). Reason: a challenge needs the same question bank and the same exam audience, so cross-exam challenges make no sense. Boards, streaks and challenge history are per site, consistent with pairwise ids (§5.5).

**Flow (link-based, no in-platform messaging):**

```
1. Student finishes a question → "Challenge a friend"
2. Site creates a challenge: question id, challenger, expiry (48 h), result hidden
3. Share link / QR through any chat app (phone Share sheet)
4. Friend opens the link → sees only the question, no sign-in needed (guest or linked)
5. Friend answers → both see: correct / incorrect, time taken
6. Winner: correct beats incorrect; both correct → faster wins; otherwise a draw
7. Linked winners get a small, capped leaderboard bonus
```

**Safety (minors).**

- No free-text chat, no friend search, no stranger matching. A challenge only reaches someone the student chose to send a link to.
- Challenge links use unguessable tokens, expire, and have a report / block option.
- Guests who answer a challenge give no personal data (browser-only, same as §5.1).
- Nicknames only; nothing about school or class is shown to the friend.
- Cap challenge points per day so they cannot be farmed.

**Data (per site schema):**

```
challenges(id, question_id, challenger_student_id, token_hash, expires_at, status)
challenge_attempts(challenge_id, student_id | guest_session, chosen, correct, time_ms, answered_at)
```

**Marketing value.** Each challenge link is a no-sign-up invitation to answer one real question, which makes it a built-in acquisition loop. It works best when the page the friend lands on is clearly about that exam.

**Later.** Group challenges, class and school leagues, streak duels.

### 14.2 One product for everything, or separate sites?

Question: should JEE, SAT, CA/CAT and regular academics live in one combined product?

| | Separate sites | One combined product |
| --- | --- | --- |
| Message to a parent or student | "Free JEE practice": clear, converts | "Everything for everyone": vague, converts worse |
| Paid ads, social, influencer campaigns | One focused message per audience | Each campaign still needs a focused landing page |
| Search (SEO) | Each site builds authority on its own topic; link authority is split across domains | One domain pools authority |
| Challenges and streaks | Per exam (which is what challenges need anyway) | A combined streak is possible |
| Cross-selling | Needs Vaara in the middle | Easy within one app |
| Audiences and safety | JEE/SAT (mostly 15–18) kept apart from school-age children | Mixes Class 6 and Class 12 in one social space, which is a child-safety and compliance problem |
| Partnering or spinning a site out | Easy | Hard |
| Engineering | Shared engine already planned, so low duplication | One bigger app to maintain |

**DECISION (LOCKED, 2 Oct 2026): separate sites only.** Each exam is its own site with its own domain, brand and Vercel project. There will be no combined "everything" product. The reasoning below stands as the record.

**Recommendation: separate front doors, shared engine, one view for the parent.**

1. **Front doors stay separate** (own domain, landing page, message, campaigns). This matches the goal of promoting each site independently.
2. **The engine is shared** (`vaara-exam-study-prep` packages), so building site number four is cheap.
3. **"Everything in one place" is Child 360 in Vaara.** The parent sees every site's progress for each child there. If a combined study streak is wanted, sites report events to Vaara (by pairwise ids) and Vaara computes it. The kid's experience stays focused per exam.
4. **Reversible.** Separate Vercel projects can later be served under one umbrella domain (`/jee`, `/sat`, `/ca`) using Vercel rewrites / microfrontends, without merging code. Merging later is easy; splitting a merged product later is hard.
5. **Regular academics and study videos are a different product line** (younger children, much larger content, under-13 rules, video costs). Keep them out of the exam-prep sites and out of their challenge spaces.

**Not reopened by default.** The decision is locked. Revisiting it needs an explicit owner decision, for example if analytics later show most students use two or more exams, or search data shows one umbrella domain would rank far better. The route would be point 4 (serve the separate projects under one domain), not a code merge.
