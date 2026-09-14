# Posts display logic

Decision document. This describes **what the product does today** when a
parent publishes a post, and the combinations we still need to lock for
Home, circle feeds, interest feeds, and discovery.

Related: `docs/HOME_FEED_FRESHNESS.md`, `docs/FEED_CIRCLE_TIMELINES.md`,
`docs/POST_COMPOSER_CIRCLES_AND_INTERESTS.md`,
`docs/POST_ACCESS_AND_SHARING_IMPLEMENTATION.md`.

---

## 1. Two different questions

People mix these up. They are not the same.

| Question | Answer today |
|---|---|
| **Which circles do I belong to?** | Membership sync from the profile. Automatic. |
| **Which circles does my post go to?** | Only the circles I pick in the composer. Not automatic. |

Belonging to five circles does **not** mean a new post appears in all five.

---

## 2. Cast (used in every example)

Anusha has one child at Gaudium, CBSE, Grade 4, PIN 502032. After onboarding
she is a **member** of:

| # | Type | Circle |
|---|---|---|
| 1 | `school_class` | Gaudium · CBSE · Grade 4 |
| 2 | `class` | CBSE · Grade 4 |
| 3 | `school` | Gaudium |
| 4 | `locality` | 502032 |
| 5 | `curriculum` | CBSE Parents |

She is **not** a member of any other school, grade, pin, community, or
board circle (IB Parents, Oakridge, 500032, and so on).

Readers:

| Parent | Overlap with Anusha |
|---|---|
| **Priya** | Same school, grade, board, PIN → all 5 of Anusha’s circles |
| **Ravi** | Same school and PIN, different grade → Gaudium + 502032 + CBSE Parents |
| **Kavya** | Different school, same grade/board/PIN → CBSE · Grade 4 + 502032 + CBSE Parents |
| **Arjun** | Different city, IB → none of Anusha’s circles |
| **Sana** | Same PIN, IB (no CBSE / Gaudium) → 502032 only |

Interests (`#admissions`, `#screen-time`) are labels. They never add or
remove a circle.

---

## 3. Default compose (what happens if she just hits Post)

### How the composer picks the starting circle

- Opened from **Home FAB** or Circles tab FAB: the locked primary is the
  tightest circle she belongs to.
  Priority: `school_class` → `class` → `school` → `community` → `locality`
  → `curriculum`.
  For Anusha that is **Gaudium · CBSE · Grade 4**.
- Opened from **inside a circle**: that circle is locked as primary.

### What is selected by default

**Only the locked primary.** Additional circles start empty. She can add
up to 4 more of *her* circles (max 5 on the member create endpoint).

Guest destinations (circles she does not belong to) go through the
cross-post path and are opt-in, not default.

### So the default post is

> One post. One target: **Gaudium · CBSE · Grade 4**.
> One shared reply thread.
> Circles cannot be changed after publish.

It is **not** posted to CBSE · Grade 4, Gaudium, 502032, or CBSE Parents
unless she ticks them.

---

## 4. Surfaces (what “visible” means)

A post can appear on more than one surface. Rules differ.

| Surface | Who can see this post |
|---|---|
| **That circle’s feed** | Members of that target circle only. Non-members get 404. Guest authors cannot open a guest target’s feed. |
| **Home · member** | Viewer is a member of **at least one** target circle. One card per post. |
| **Home · discovery** | Viewer is a member of **none** of the target circles, and is not the author. Ranked: same PIN, then same board, then other. |
| **Interest feed** | Post has that interest **and** the viewer is a member of at least one target. An interest never widens visibility. |
| **Your Posts** | The author, including guest placements they cannot see on Home. |
| **Shared link** | Anyone with the share URL gets a read-only preview of that one post. No circle access. |
| **Notifications** | Members of any target, **one** notification, labeled with their tightest overlapping circle. |

Curriculum + local PIN: on a curriculum circle feed (`scope=local`) and on
Home when the attributed circle is curriculum, the viewer only sees the
author if they share a PIN (or the author is themselves).

`HOME_FEED_FRESHNESS` (off until flagged) only changes **order**: unseen
member → unseen discovery → seen history. It does not change who is
eligible.

---

## 5. Combinations

### A. Default — one member circle (school class)

Anusha posts from Home and does not change audience.

**Targets:** Gaudium · CBSE · Grade 4  
**Not targeted:** CBSE · Grade 4, Gaudium, 502032, CBSE Parents, every
other circle in the product.

| Person | Circle feed (Gaudium G4) | Their other circle feeds | Home | Interest feed (if tagged) |
|---|---|---|---|---|
| Anusha | Yes | No | Yes, member card, labeled Gaudium G4 | Yes |
| Priya | Yes | No | Yes, member, labeled Gaudium G4 | Yes |
| Ravi | No (not in that class) | No | Discovery (same PIN / school overlap is not a target) | No |
| Kavya | No | No | Discovery (same PIN / board; not a member of the target) | No |
| Sana | No | No | Discovery (same PIN) | No |
| Arjun | No | No | Discovery, weakest tier (“other”) | No |

Home card: **one** card. Circle badge = Gaudium · CBSE · Grade 4. No extra
circle chips (only one target).

This is the important default: **Ravi is in Gaudium and 502032 with
Anusha, and still does not get this as a member post.** Same school is
not enough. The post has to target a circle he belongs to.

---

### B. One broader member circle (school or locality)

Anusha opens Gaudium (school) and posts only there.

**Targets:** Gaudium  
**Not targeted:** the class circle, PIN, board, etc.

| Person | Gaudium circle feed | Home |
|---|---|---|
| Anusha, Priya, Ravi | Yes | Member, labeled Gaudium |
| Kavya, Sana, Arjun | No | Discovery |

Same pattern if she posts only to **502032**: Anusha, Priya, Ravi, Kavya,
and Sana get it as a **member** post. Arjun gets discovery.

---

### C. Two specific member circles (the “I picked 2” case)

Anusha posts to **Gaudium · CBSE · Grade 4** and **502032**.

**Storage today:** one `circle_posts` row, two `circle_post_targets`,
**one shared reply thread**. Priya’s reply in the class circle is the
same thread Sana sees from the PIN circle.

| Person | Gaudium G4 feed | 502032 feed | CBSE / school / board feeds | Home |
|---|---|---|---|---|
| Anusha | Yes | Yes | No | **One** member card |
| Priya | Yes | Yes | No | **One** member card (not two) |
| Ravi | No | Yes | No | **One** member card (via PIN) |
| Kavya | No | Yes | No | **One** member card (via PIN) |
| Sana | No | Yes | No | **One** member card (via PIN) |
| Arjun | No | No | No | Discovery |

**Home label (tightest overlapping target for that viewer):**

| Viewer | Badge on Home |
|---|---|
| Anusha, Priya | Gaudium · CBSE · Grade 4 (`school_class` beats `locality`) |
| Ravi, Kavya, Sana | 502032 (their only overlapping target) |

Chips under the card list the **other** target circles. On the Gaudium G4
circle screen, Priya sees a chip for 502032. On Home, Anusha/Priya see a
502032 chip next to the Gaudium G4 badge.

Notification: Priya gets **one** “New post in Gaudium · CBSE · Grade 4”,
not two.

---

### D. All of her circles (max member cross-post)

She ticks all five of her circles.

| Person | Circle feeds | Home |
|---|---|---|
| Anyone who shares **any** of those five | That overlapping circle’s feed | One member card, tightest overlap |
| Arjun (none) | None | Discovery |

Priya’s Home badge is still Gaudium G4. Kavya’s is CBSE · Grade 4
(`class` beats locality and curriculum). Sana’s is 502032.

---

### E. Guest only — circle she does not belong to

Anusha asks IB Parents as a guest. She is not a member.

**Targets:** IB Parents (`access_mode = guest`)  
**She does not join IB Parents.** She cannot open that circle’s feed or
member list.

| Person | IB Parents feed | Home | How they reopen the thread |
|---|---|---|---|
| IB member | Yes, author labeled guest | Member card | Circle or Home |
| Anusha | **No** (404) | **No** — not a member, and discovery excludes the author | Your Posts, notification on reply |
| Priya / Ravi / Kavya / Sana | No | Discovery if they are not IB members | Discovery preview only |

This is why **Your Posts** exists.

---

### F. Mixed member + guest (one submission, two worlds)

Anusha posts to **Gaudium · CBSE · Grade 4** (member) and **IB Parents**
(guest).

Today this is still **one post, one thread**. That is the privacy tension:

- Gaudium G4 members can read IB parents’ replies.
- IB members can read Gaudium G4 replies.

`docs/POST_COMPOSER_CIRCLES_AND_INTERESTS.md` argued for **one isolated
post per target**. Code did not do that. `createCrossPosts` writes one
row and many targets.

| Person | Gaudium G4 feed | IB feed | Home |
|---|---|---|---|
| Anusha | Yes | No | Member (via Gaudium G4). Guest copy is not a second Home card. |
| Priya | Yes | No | Member, Gaudium G4 |
| IB parent (not in Gaudium G4) | No | Yes | Member, IB Parents |
| Arjun if not IB | No | No | Discovery |

---

### G. Interests only, no extra circles

Anusha default-posts to Gaudium G4 and tags `#admissions`.

- Visibility is still **only** Gaudium G4 members (plus discovery / share).
- Priya’s `#admissions` interest feed includes it.
- Arjun following `#admissions` does **not** see it there (not a member
  of any target). He may still see it on Home as discovery.
- Adding an interest never publishes into IB Parents or a PIN circle.

---

### H. Two children / two school-class circles

If Anusha later adds a second child at Oakridge Grade 2, membership gains
Oakridge, Oakridge · Grade 2, and maybe a second class/board circle.

A default Home compose still locks **one** primary (tightest of *all*
her circles — first `school_class` in list order). The Oakridge class
does **not** get the post unless she adds it.

This is easy to get wrong in the UI: parents assume “my kids’ schools”
are implied.

---

## 6. Home card rules (locked in code)

1. **Identity is `post.id`.** Two targets never become two Home cards.
2. **Member beats discovery.** If the viewer shares any target, the card
   is member. Discovery is only for posts with **zero** overlapping
   targets.
3. **Badge** = tightest overlapping target for *this* viewer
   (`school_class` → `class` → `school` → `community` → `locality` →
   `curriculum`). Not always the author’s primary.
4. **Discovery badge** copy: “Suggested from another circle.”
5. **Author’s own guest-only post** does not appear on the author’s Home.
6. **Curriculum PIN** can hide a member curriculum post from a
   same-board parent in another city.
7. Opening the card uses the attributed `circleId` (the badge circle).

Freshness (when flagged) only reorders eligible cards. It does not add
targets.

---

## 7. What is *not* visible (quick list)

For a default Gaudium G4 post, these do **not** get a member placement:

- Other circles Anusha belongs to (school, PIN, board, city-wide grade)
- Any circle she does not belong to
- Circle feeds of parents who only share school / PIN / board with her
- Interest feeds of non-members of the target
- The guest author’s Home, for a guest-only post

Discovery and share links can still show a **preview** of that same post
to people outside the target. That is the one intentional leak of
“outside my circles,” and it does not grant circle membership.

---

## 8. Decisions still open

These are the forks that change the tables above. Pick one per row
before treating feeds as final.

| # | Decision | Today | Options |
|---|---|---|---|
| 1 | **Default audience** | One tightest circle | Keep · Default to school_class + locality · Default to “all my circles” |
| 2 | **Does same-school imply visibility?** | No. Ravi misses a class-only post. | Keep · Auto-include school when posting to school_class |
| 3 | **Discovery tier 3** (“other”) | Global: Arjun can see a Hyderabad class post | Keep · Same city / PIN / board only · Turn off tier 3 |
| 4 | **Multi-circle thread** | One shared thread | Keep · Isolated thread per target (needed if guest + member stay mixed) |
| 5 | **Guest author’s Home** | Hidden | Keep (Your Posts only) · Show as “Your guest post” |
| 6 | **Chips for circles the viewer is not in** | Shown; tap tries to open that circle (404 if not a member) | Hide non-member chips · Tap = preview, not circle feed |
| 7 | **Can targets change after publish?** | No | Keep locked · Allow add/remove with explicit feed/notification rules |

Suggested lock for a first honest product (does not require code in this
pass):

1. Default stays **one circle**. Composer copy must say that.
2. Same-school does **not** auto-include. If she wants Gaudium + class,
   she picks both.
3. Discovery tier 3 should be **restricted** (same PIN or same board) so
   Home cannot feel like a global firehose. Confirm before changing SQL.
4. Shared thread is fine **among member circles**. Mixed guest + member
   should not ship as one thread; isolate or block that mix.
5. Guest-only stays off the author’s Home; Your Posts is the path back.
6. Home chips should only navigate to circles the viewer can open.
7. Keep targets locked after publish.

---

## 9. One-line summary

> A post is visible in **exactly the circles it was targeted to**.
> Home shows it **once** to anyone who belongs to **any** of those
> circles, labeled with the tightest overlap. Everyone else may see a
> **discovery preview**, not the circle. Interests and “I go to the same
> school” do not add targets.
