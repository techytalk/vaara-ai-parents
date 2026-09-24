# Lucky gift scratch card

Campaign creative: a Suchitra poster promising a ₹500 gift voucher. After a parent finishes signup, the app shows a scratch card. Scratching reveals immediately whether they won. A winner is asked for a phone number so Vaara can send the voucher details. A call or WhatsApp line is there for questions or for claiming.

No production campaign is live yet. The feature ships inactive; turn it on from
admin after dates, support phone, and winning moments are set.

Schedule invalidation, pending-card access through the claim deadline, and the
persistent missing-phone reminder are implemented in the API and mobile app.

## Decisions already made

- The parent learns the result on the scratch. A later draw, where everyone enters and winners are announced after the campaign ends, was set aside. Parents who expect an instant result would wait, lose interest, or speak negatively about Vaara.
- The server assigns and saves each result before the scratch. Scratching reveals that saved result. Reinstalling or scratching again cannot change it.
- Wins are spread at random across the campaign. The first parents through the door do not receive every voucher.
- A phone number is asked only after a win, with a short explanation that it is used to send the voucher details. Parents who did not win are not asked for one.
- The campaign has a start, an end, a winner-selection method, and a claim deadline. Results are stored. The phone-number explanation is shown before the number is saved. Promotion terms are checked before the campaign is published.

The instant draw uses 20 randomized winning moments spread across configured
morning, afternoon, and evening windows. An admin switch controls whether the
campaign is running. When it is off, parents follow the regular onboarding and
tour flow with no lucky-gift UI.

## When it appears

Signup is not finished on the register screen. A parent still adds location, school, and class, then lands on the “You’re in” screen (`apps/mobile/app/onboarding/ready.tsx`). Tapping through that screen opens Home. The home tour (`HomeTourOverlay` in `apps/mobile/app/(app)/index.tsx`) starts on that first Home visit, driven by `useHomeTour`.

The scratch card sits in the gap between those two:

```
Register (Apple / Google / email)
        |
        v
Location, school, class
        |
        v
"You're in" screen
        |
        v
Home
        |
        v
Scratch card          <-- only if this parent is eligible and has not scratched yet
        |
        v
Home tour             <-- starts only after the card is finished
        |
        v
Normal home
```

The tour already blocks the later completion prompts (`pickActiveCompletionPrompt` returns nothing until `hasCompletedAppTour()`). The scratch card uses the same idea one step earlier: `useHomeTour` stays closed until the card is done.

Parents who are not eligible never see the card. Their tour starts exactly as it does today.

## Who gets a card

A parent gets one card when all of these are true:

- Role is `parent`. Providers are outside this campaign.
- `users.created_at` is on or after the campaign start and before the campaign end.
- Onboarding is complete (location, school, and class are saved). That matches the poster: download, sign in and add location, select school and class, then see the result.
- They do not already have a card row.

The clock is account creation, not the moment they open Home. A parent who created an account before the start date and finishes onboarding during the campaign does not get a card.

Someone who signs up inside the window and kills the app before scratching still has the card. The next time they reach Home, the card is shown again, still before the tour.

The poster is aimed at Suchitra. This first version does not filter by locality. Every new parent in the date window is eligible. A locality filter can be added later on the same campaign row if the voucher should be limited to Suchitra and nearby areas.

## What the parent sees

Full-screen card over Home, above the tour. It cannot be skipped. Closing the app leaves the card unrevealed.

1. Covered card. Copy follows the poster: a ₹500 lucky gift, and a prompt to scratch.
2. Scratch gesture reveals the result already stored for this parent. The reveal is immediate. There is no “we’ll draw later” state.
3. **Win.** “You won a ₹500 gift voucher.” Under that, a phone field and this explanation, shown before the number is saved: “We’ll use this number only to send your ₹500 voucher details.” Submit stores the number. Call and WhatsApp buttons reach the campaign line for questions or if they would rather claim that way. A short claim code (for example `4821`) is on the screen so the person sending the voucher can match them. If the claim deadline has passed, the form says the claim window is closed and the number field is disabled.
4. **No win.** “Not this time.” Then say again what the “You’re in” screen already showed: they are connected to their circles (neighbourhood, school, board, and class) and can talk there about kids, school, activities, and everyday questions. The circles on screen are the same ones from that earlier step, so the loss hands them back to the reason they joined. The claim code is shown so support can still look them up. No phone field.
5. **Continue** opens the home tour. On a win, Continue stays available after
   the phone step so a parent who wants to enter the app first can do so. The
   win and phone status remain on the server.

If a parent reaches Home but closes the app without scratching, the assigned
card remains pending and reappears ahead of the tour on every Home visit until
they scratch it or `claim_deadline` passes. Campaign `ends_at` stops new cards;
it does not remove a card already assigned to an eligible parent.

After a winner continues without submitting a number, Home shows a persistent,
non-blocking **Claim your ₹500 voucher** reminder until they submit the number
or `claim_deadline` passes. Tapping it reopens the winning result and phone
form. The reminder does not restart or block the Home tour.

The result is fixed before the scratch animation starts. Scratching only reveals it.

## How a winner is chosen

The campaign has a strict maximum of 20 winners. Before it is enabled, the
server generates 20 random winning moments between `starts_at` and `ends_at`.
The app never rolls the outcome.

When an eligible parent reaches the card, the server checks for an unclaimed
winning moment whose scheduled time has passed. If one exists, that parent
claims it and wins. Otherwise, the result is a loss. Assignment and claiming
happen in one locked database transaction so two parents cannot claim the same
moment. The result is stored before the scratch animation reveals it.

```
Generate 20 winning moments before launch
                    |
                    v
Parent reaches the card
                    |
                    v
Earlier unclaimed moment available?
              +-----+-----+
              |           |
             yes          no
              |           |
              v           v
        Claim moment     Lose
              |
              v
             Win
```

### Spreading morning, afternoon, and evening winners

Purely random timestamps across an entire day can cluster by chance. Because
the pamphlets go out with morning newspapers, unrestricted allocation could
also let morning traffic consume most prizes. Use **stratified random winning
moments** instead.

For a one-day campaign with 20 vouchers, an initial distribution can be:

- Morning, 06:00–11:00: 7 winning moments
- Afternoon, 11:00–17:00: 6 winning moments
- Evening, 17:00–22:00: 7 winning moments

Each moment is randomized within its own time window. The exact split and
window times are admin settings; they are not hardcoded in the app. This gives
morning, afternoon, and evening parents a real opportunity while preserving
randomness within each period.

A future moment cannot be claimed early. For example, someone opening at 08:00
cannot consume a 19:15 winning moment.

One parent can claim at most one moment. If several moments are waiting after a
quiet period, each subsequent eligible parent can claim at most one. The
transaction always checks that fewer than 20 cards have outcome `win`, making
20 a hard maximum even if configuration or concurrency goes wrong.

Unclaimed moments carry forward by default. This maximizes the chance of
distributing all 20 vouchers, but a quiet afternoon moment might be claimed in
the evening. Admin may instead configure moments to expire at the end of their
window. Expiry gives stricter time-of-day distribution but may result in fewer
than 20 winners. It never produces more than 20.

This is a small backend feature rather than a difficult algorithm: generate 20
rows, check and lock one row when assigning a card, and enforce uniqueness in
Postgres. The important work is defining the windows and carry-forward policy
before launch.

A later draw is intentionally not used. It would distribute winners after the
campaign but would not provide the immediate result promised by the scratch
card.

## Admin control

The internal admin backend has a **Lucky gift campaign** section.

Admin can:

- Turn the campaign on or off.
- Set the start, end, and claim-deadline timestamps.
- Set the prize label and winner support number.
- Configure the morning, afternoon, and evening windows and how many of the 20
  moments belong to each window.
- Choose whether an unclaimed moment carries forward or expires with its
  window.
- Generate and review the 20 moments before launch.
- See counts for cards issued, scratches, wins, phone numbers submitted, and
  unclaimed moments.

Turning the switch on does not bypass the dates: the campaign is live only when
`active = true` and the current time is between `starts_at` and `ends_at`.

When the switch is off:

- No new scratch cards are created.
- New parents see the regular “You’re in” → Home tour flow.
- Previously revealed results remain in the database.
- Existing winners can still submit their phone number until
  `claim_deadline`, unless admin separately closes claims.
- Existing pending cards are hidden during an explicit admin pause. They return
  when admin resumes the campaign, or remain available after the scheduled
  `ends_at` through `claim_deadline` when the campaign ended normally.

Changing the quota after moments have been generated is not allowed for this
campaign. To protect the advertised strict maximum, the backend fixes
`winner_quota = 20`. Admin can regenerate the schedule before activation, but
not after the first card has been issued.

### Changing dates or windows after generation

Winning moments contain actual timestamps. For example, generating a moment
for 19:15 on 26 September and then changing the campaign to 27 September does
not move that row automatically. Without protection, admin could turn on a
campaign whose 20 moments still use the old date.

The backend must apply these rules:

1. Changing `starts_at`, `ends_at`, timezone, morning/afternoon/evening times,
   period counts, or carry-forward policy invalidates all generated moments.
2. If no cards have been issued, delete the old moments, show the campaign as
   **Schedule not generated**, and require admin to generate 20 new moments
   before the ON switch is accepted.
3. If any card has been issued, those schedule fields are immutable. Admin must
   pause the campaign and create a new campaign rather than rewriting the draw
   under existing participants.
4. Changing display copy, support phone, `claims_open`, or claim deadline does
   not regenerate winning moments. The claim deadline must remain after the
   campaign end and cannot invalidate an already accepted claim.

## Campaign rules to fix before publish

These live on the campaign row and in the copy on the card. Check them against the poster and the promotion terms before `active` is set.

| Rule | Where it lives | What the parent is told |
| --- | --- | --- |
| Start and end | `starts_at`, `ends_at` | Accounts created in this window, after onboarding, get one scratch. |
| Winner method | `winner_quota`, time windows, winning moments | A maximum of 20 ₹500 vouchers, with winning moments randomized across morning, afternoon, and evening. |
| Claim deadline | `claim_deadline` | Winners send their number before this time. After it, the voucher is no longer claimable. |
| Phone use | Card copy, stored with the number | The number is used only to send that winner’s voucher details. |
| Result record | `lucky_gift_cards` | Every assigned result, scratch time, and submitted number is kept. |

Publish the campaign only after the terms match this table. The in-app copy and the poster should describe the same prize, the same “scratch to see now” promise, and the same claim window.

## Data

Next migration after `068_myp_visual_answers_rest`: `069_lucky_gift_scratch_cards.sql`.

```sql
CREATE TABLE lucky_gift_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  prize_label text NOT NULL,             -- "₹500 gift voucher"
  support_phone text NOT NULL,           -- E.164, Call / WhatsApp for questions or claiming
  winner_quota integer NOT NULL DEFAULT 20 CHECK (winner_quota = 20),
  carry_unclaimed_forward boolean NOT NULL DEFAULT true,
  period_windows jsonb NOT NULL,         -- morning / afternoon / evening start, end, count
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  claim_deadline timestamptz NOT NULL,
  claims_open boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false, -- stays false until terms are checked
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lucky_gift_winning_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lucky_gift_campaigns(id),
  period text NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  available_at timestamptz NOT NULL,
  expires_at timestamptz,
  claimed_by_user_id uuid REFERENCES users(id),
  claimed_at timestamptz,
  UNIQUE (campaign_id, available_at)
);

CREATE TABLE lucky_gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lucky_gift_campaigns(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winning_moment_id uuid UNIQUE REFERENCES lucky_gift_winning_moments(id),
  outcome text NOT NULL CHECK (outcome IN ('win', 'lose')),
  claim_code text NOT NULL,
  scratched_at timestamptz,
  winner_phone text,                     -- set only after a win, by the parent
  phone_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, claim_code)
);
```

`lucky_gift_winning_moments` contains exactly 20 rows for this campaign. A
database trigger or the assignment transaction rejects a 21st winning card.

Seed one campaign row for this poster with `active = false`. Dates, support
number, claim deadline, time windows, and carry-forward policy can be changed
from the admin backend before launch without an app release.

`scratched_at` is written when the reveal is shown, before the parent taps
Continue. A win is recorded even if they leave on the result screen.
`winner_phone` is written only from the win form. A pending card has an assigned
outcome but no `scratched_at`; it remains revealable through `claim_deadline`.

## API

All routes require the signed-in parent. Responses never include another parent’s card, and they never include a phone number the parent did not just submit.

`GET /v1/me/lucky-gift`

Returns the current card, creating it on first call when the parent is eligible and the campaign is active.

```json
{ "status": "hidden" }
```

or

```json
{
  "status": "pending",
  "prizeLabel": "₹500 gift voucher"
}
```

or, after scratch,

```json
{
  "status": "revealed",
  "outcome": "win",
  "prizeLabel": "₹500 gift voucher",
  "claimCode": "4821",
  "supportPhone": "+91XXXXXXXXXX",
  "claimDeadline": "2026-10-15T18:30:00.000Z",
  "phoneSubmitted": false
}
```

A loss omits nothing the parent needs for a claim: no phone form is rendered, and `supportPhone` is included so they can still ask a question. While the card is still `pending`, the response omits `outcome`, `claimCode`, and `supportPhone`, so the result is not sitting in the app before the scratch.

`POST /v1/me/lucky-gift/scratch`

Sets `scratched_at` if it is still null and returns the revealed payload. Calling it twice returns the same result.

`POST /v1/me/lucky-gift/phone`

Body: `{ "phone": "+91XXXXXXXXXX" }`. Accepted only when `outcome` is `win`, `scratched_at` is set, and `now()` is before `claim_deadline`. Stores `winner_phone` and `phone_submitted_at`. A second submit replaces the number until the deadline, so a typo can be fixed.

Home calls `GET` once circles have loaded and the parent is onboarded.
`status: "pending"` opens the card and holds the tour. For an existing card,
`pending` remains valid through `claim_deadline` even after campaign
`ends_at`. `status: "hidden"` or `"revealed"` lets the tour start under the
existing `hasCompletedAppTour()` check.

For a revealed win with `phoneSubmitted: false` and `claimsOpen: true`, Home
shows the non-blocking voucher reminder until `claimDeadline`. Tapping it
reopens the result and phone form. A parent who already revealed the card and
still has the tour ahead goes straight to the tour; the reminder appears after
the tour rather than covering it.

## App changes

- New full-screen component, for example `apps/mobile/src/components/lucky-gift/ScratchCard.tsx`, rendered from `apps/mobile/app/(app)/index.tsx` next to `HomeTourOverlay`.
- `useHomeTour` gains a `blocked` flag. The tour effect does not set `visible` while the card is pending.
- Scratch interaction can be a pan gesture that clears a coating layer. The reveal call fires once the coating is mostly gone.
- Win state shows the phone field with the voucher-details explanation, then Call and WhatsApp via `Linking` (`tel:` and `https://wa.me/<digits>`) using `supportPhone`.
- Add a Home reminder for a revealed winner with no submitted phone. Keep it
  visible until phone submission, claim closure, or the deadline.
- Events, with no phone number and no claim code in the payload: `lucky_gift_view`, `lucky_gift_scratched` (`outcome: win | lose`), `lucky_gift_phone_submitted`, `lucky_gift_support_tapped` (`channel: call | whatsapp`).

## Release order

The admin switch cannot add UI to an old JavaScript bundle. Release the mobile
implementation first, using the production OTA channel after verification.
Keep the campaign inactive while the update propagates. Then configure dates,
generate moments, and turn it on. An old client that has not received the OTA
continues normally and cannot display the card; adoption should therefore be
checked before pamphlets are distributed.

## Migration ledger repair

Supabase currently contains the Path schema and the later Path/admin content,
but `schema_migrations` records only `063_content_filter` and
`069_lucky_gift_scratch_cards` between versions 058 and 069. The normal runner
therefore attempts `058_path_exploration_tree` again and fails because
`path_node_kind` already exists.

Do **not** drop the existing Path objects and do not blindly rerun migration
058. Repair the ledger once:

1. Take a Supabase backup or restore-point snapshot.
2. Audit the expected effects of 058–068. At minimum verify the Path enum,
   `path_nodes`, `path_node_roots`, `path_discussion_links`, five root records,
   moderation table, `users.content_blocked`, helper functions, and the marker
   rows/copy from 059–068.
3. Reapply only an idempotent migration whose expected effect is missing.
4. In one reviewed transaction, insert the verified missing versions into
   `schema_migrations`: 058, 059, 060, 061, 062, 064, 065, 066, 067, and 068.
   `063` and `069` are already recorded.
5. Run the normal migration command. It must skip 058–069 without an error.
6. Compare the final Supabase schema and key Path rows with the migration
   files, then record the reconciliation in deployment notes.

This is bookkeeping reconciliation, not a request to recreate production data.
The current audit confirms the major tables/types, moderation fields, five
roots, and content markers for 060 and 064–068 exist; helper functions and the
full 059 content still need to be included in the final checklist before the
ledger rows are inserted.

## Fulfillment

Winners are the rows with `outcome = 'win'`. Send the voucher to `winner_phone`. The support line uses the claim code when someone calls or messages instead of submitting the form.

```sql
SELECT u.email, u.display_name, c.claim_code, c.winner_phone,
       c.scratched_at, c.phone_submitted_at
FROM lucky_gift_cards c
JOIN users u ON u.id = c.user_id
WHERE c.outcome = 'win'
ORDER BY c.scratched_at NULLS LAST;
```

An in-app admin screen is not required for the first campaign. The query is the record of results. `winner_phone` is used only to send that parent’s voucher details.

## Edge cases

| Situation | Behaviour |
| --- | --- |
| Account created before `starts_at` or after `ends_at` | No card. Tour as today. |
| Account created in the window, onboarding not finished | No card yet, and no winning moment claimed. |
| Assigned but app closed before scratch | The pending card reappears ahead of the tour through `claim_deadline`, including after `ends_at`. |
| Scratched, then reinstalled | Server still has the revealed result. A winner without a phone sees the claim reminder through `claim_deadline`. Tour completion stays on-device, which is already how the tour works. |
| Two devices scratch at once | One row per parent. The second scratch returns the stored result. |
| Morning traffic is much heavier | It can claim only moments that have already become available. Afternoon and evening moments remain protected. |
| No parent arrives in a period | Its moment carries forward, or expires, according to the admin setting. |
| Two parents arrive together | A row lock lets only one claim an available moment. The other wins only if another moment is also available; otherwise they lose. |
| All 20 moments are claimed | Every later card is a loss. The database cannot create a 21st winner. |
| Win, no phone, deadline passed | Result stays a win on record. The form closes. Support can still match a claim code that was already submitted. |
| Win, no phone, before deadline | Home keeps a non-blocking claim reminder visible; tapping it reopens the phone form. |
| Campaign `active = false` | No card UI. New parents follow the regular tour; pending cards return if the campaign is resumed before their claim deadline. |
| API fails on Home | Do not block the tour forever. Retry once; if it still fails, start the tour and try the card on the next Home visit. |

## Still to settle

1. Campaign start, end, and claim deadline.
2. Final morning, afternoon, and evening window times and the 7/6/7 split.
3. Whether unclaimed moments carry forward or expire with their period.
4. The support mobile number, in E.164.
5. Whether eligibility stays “every new parent in the date window” or is narrowed to Suchitra.
6. Promotion terms checked against the rules table before `active` is turned on.
