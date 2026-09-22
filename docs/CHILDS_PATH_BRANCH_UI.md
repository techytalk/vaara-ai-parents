# Child's Path — branch explorer UI

**Status:** retired for the parent app. The live layout is
[`CHILDS_PATH_EXPLORATION_TREE.md`](CHILDS_PATH_EXPLORATION_TREE.md)
(expandable thread). This file records the earlier three-card screen.
Do not ship it beside the thread.

| Layer | Doc |
|-------|-----|
| Layout + Path theme | This file |
| Production behaviour (identity, posting, errors, QA) | [`CHILDS_PATH_FUNCTIONAL.md`](CHILDS_PATH_FUNCTIONAL.md) |
| Catalogue (boards, stages, streams, exams) | [`WHAT_NEXT_AND_OPPORTUNITIES.md`](WHAT_NEXT_AND_OPPORTUNITIES.md) |

If behaviour and layout disagree, **this file wins on chrome**. The
functional spec wins on identity, circles, and eligibility.

The light cream hub in §14 of `WHAT_NEXT_AND_OPPORTUNITIES.md` remains the
reference for **admin card-list density**. This dark branch layout is the
parent phone at **Class 10 → 11–12**. Do not mix the two chromes on one
screen. Do not reintroduce a five-stop strip, radial map, or question-led
first screen.

Shipped code today (`apps/mobile/app/(app)/pathways/`) is still the light
card list.

---

## 1. What the mock is doing

Parents are not reading exam cards first. They are:

1. Seeing **where the child is** (one node).
2. Seeing **the next-stage fork** (two or three branches).
3. **Exploring** one branch without changing the child’s profile.
4. Picking a **question lens** (Subjects / Workload / College plans).
5. **Asking other parents** on that branch, or reading existing threads.

The screenshot series is one fixture:

> Example profile · Telangana · **IB MYP · Grade 10** (Class 10 stage)

Branches: Continue IB → Diploma · Switch → A Level · Switch → CBSE 11–12.

---

## 2. Screen map

```
More → Child's Path
         │
         ├ location node (current board · grade · stage)
         ├ branch row (stay / switch / switch)
         └ selected branch → explore panel
               ├ topic chips (Subjects | Workload | College plans)
               ├ prompted question + Ask parents anonymously
               ├ Read discussions on this branch
               └ Other routes / not sure yet?  (collapsed)
```

Two states of the same screen, not two apps:

| State | What changes |
|-------|----------------|
| **Explore (default)** | A branch is selected. Panel and prompt update. Profile unchanged. |
| **Discussions empty** | Same panel; below the fold, “No discussions on this branch yet”. |

Header stays **Child's Path**. Do not retitle the screen “What next”.

---

## 3. Layout anatomy

Top to bottom, one scroll. No horizontal page swipe between branches.

```
┌─────────────────────────────────────────┐
│ vaara          Child's Path        More │  nav
│                                         │
│ Example profile · Telangana             │  eyebrow
│ Explore what comes next                 │  H1
│ Follow a branch. Find a question.       │  deck
│ Hear from parents.                      │
│                                         │
│         ┌─────────────────────┐         │
│         │ YOUR CHILD IS HERE  │         │  location node
│         │ IB MYP · Grade 10   │         │
│         │ Class 10 stage      │         │
│         └──────────┬──────────┘         │
│                    │                    │
│     Some options for Classes 11–12      │  fork caption
│          ┌─────┬─────┬─────┐            │
│          │     │     │     │            │  branch cards (2–3)
│          └──┬──┴─────┴─────┘            │
│             │  (stem under selected)    │
│ ┌─────────────────────────────────────┐ │
│ │ MYP Grade 10 → IB DP                │ │  breadcrumb
│ │ Explore IB Diploma                  │ │  H2
│ │ What would you like to understand?  │ │
│ │ [Subjects] [Workload] [College]     │ │  topic chips
│ │                                     │ │
│ │ ASK ABOUT SUBJECTS                  │ │
│ │ “quoted prompt…”                    │ │
│ │ [ Ask parents anonymously ]         │ │
│ │ Read discussions on this branch →   │ │
│ └─────────────────────────────────────┘ │
│ ▶ Other routes / not sure yet?          │  disclosure
│ 🔒 Exploring does not change profile.   │  lock line
└─────────────────────────────────────────┘
```

### 3.1 Nav

| Element | Copy / behaviour |
|---------|------------------|
| Left | Wordmark **vaara** (muted mint). Not a back chevron in the mock; in-app use stack back if this is pushed from More. |
| Centre | **Child's Path** |
| Right | **More** — returns to the More sheet |

### 3.2 Intro

| Element | Copy |
|---------|------|
| Eyebrow | `{child or “Example profile”} · {state}` |
| Title | **Explore what comes next** |
| Deck | **Follow a branch. Find a question. Hear from parents.** |

Do not put board/grade in the H1. That belongs on the location node.

### 3.3 Location node (“your child is here”)

One rounded capsule, centred.

| Line | Role | Example |
|------|------|---------|
| 1 | Small caps kicker | `YOUR CHILD IS HERE` |
| 2 | Board programme · grade | `IB MYP · Grade 10` |
| 3 | Product stage, parent language | `Class 10 stage` |

This node is **not** tappable in v1. Child switcher (if ≥2 school-age
children) sits above the H1 as chips, same as today — not inside the tree.

Stage mapping for line 3:

| `primaryStage` | Line 3 |
|----------------|--------|
| `foundation` | Early years |
| `middle` | Middle-school stage |
| `board_10` / `after_10` | Class 10 stage |
| `senior` | Classes 11–12 |
| `after_12` | After school |

### 3.4 Fork caption + tree

Caption between the stem and the cards, e.g.:

- Class 10: **Some options for Classes 11–12**
- After IGCSE: **Some options after IGCSE**
- After MYP: **Some options for Classes 11–12** (same as mock)

Draw a **vertical stem** from the location node, then a **horizontal bar**,
then **one stem into each branch card**. A second vertical stem drops from
the **selected** card into the explore panel.

Three cards is the maximum on one row. A fourth path goes under
**Other routes / not sure yet?**

### 3.5 Branch card

Three text rows, always:

| Row | Role | Examples |
|-----|------|----------|
| Kicker | Stay vs leave | `Continue IB` · `Switch` · `Stay on CBSE` |
| Title | Destination | `IB Diploma` · `A Level` · `CBSE 11–12` |
| Status | Selection | `Exploring` (selected) · `Explore` (idle) |

Rules:

- Selected card: mint fill, dark text, status **Exploring**.
- Idle card: dark fill, mint/olive outline, muted text, status **Explore**.
- Selecting a branch **does not** write `curriculum_id` / `grade_id`.
- Label the open branch **Exploring**, never Recommended or Selected for
  your child.
- Re-tapping the selected branch keeps it selected (do not clear to none).
- Default selected branch = **stay on the current family** when that node
  is published (Continue IB, Stay Cambridge, Stay CBSE).
- Switch cards describe **possible** exploration. They do not claim the
  child’s school offers that programme.

### 3.6 Explore panel

Bound to the selected branch.

| Element | Example (stay IB) | Example (switch CBSE) |
|---------|-------------------|------------------------|
| Breadcrumb | `MYP Grade 10 → IB DP` | `MYP Grade 10 → CBSE 11–12` |
| Title | **Explore IB Diploma** | **Explore CBSE Classes 11–12** |
| Prompt | What would you like to understand? | same |
| Topics | Subjects · Workload · College plans | same three chips |

Topic chips are mutually exclusive. Default **Subjects**.

Under the chips, a nested prompt card:

| Element | Format |
|---------|--------|
| Kicker | `ASK ABOUT {TOPIC}` e.g. ASK ABOUT SUBJECTS |
| Quote | One parent-to-parent question, in quotation marks |
| Primary CTA | **Ask parents anonymously** |
| Text link | **Read discussions on this branch →** |

### 3.7 Footer of the hub

| Element | Behaviour |
|---------|-----------|
| **Other routes / not sure yet?** | Disclosure. Holds overflow paths (IBCP, ISC, state Intermediate, Polytechnic) and an “I don’t know yet” prompt. |
| Lock line | Always visible: **Exploring does not change your child’s profile.** |

### 3.8 Empty discussions (fourth screenshot)

When the branch×topic has no posts:

```
{branch title} · {topic}
No discussions on this branch yet
Start with your question. It will appear in the circle
you choose and be linked to this topic.

[ Start the conversation ]
```

Composer still uses existing circle targeting. The branch is a **topic
link**, not a new circle.

---

## 4. Theme format (Path surface)

Child’s Path fork screens use a **dark forest** surface, not `colors.bg`
cream. Rest of the app stays light. Do not leak this palette into Home,
Schools, or Discover.

### 4.1 Tokens

Name these in code as `pathTheme` (or similar). Hexes below are the
mock’s intended family; tune against a screenshot at implementation, but
keep the roles.

| Token | Role | Approx hex | Closest existing |
|-------|------|------------|------------------|
| `pathBg` | Screen background | `#10241F` | darker than `navy` `#0D1B2A` |
| `pathNavWordmark` | “vaara” | `#9BC9B8` | `primaryLight` family |
| `pathNavTitle` | “Child's Path” | `#F4F7F5` | `textInverse` |
| `pathNavAction` | “More” | `#9AA8A3` | `textMuted` on dark |
| `pathEyebrow` | Example · state | `#8FA39B` | muted |
| `pathTitle` | H1 | `#F4F7F5` | inverse |
| `pathDeck` | Subtitle | `#A8B8B2` | muted inverse |
| `pathNodeFill` | Location capsule | `#1A332C` | elevated dark |
| `pathNodeBorder` | Capsule stroke | `#2F4F46` | |
| `pathKicker` | YOUR CHILD IS HERE | `#8FA39B` | small caps |
| `pathNodeTitle` | IB MYP · Grade 10 | `#F4F7F5` | |
| `pathNodeMeta` | Class 10 stage | `#A8B8B2` | |
| `pathTreeLine` | Stems and bars | `#3D5C53` | 1–2pt |
| `pathForkCaption` | Some options… | `#8FA39B` | |
| `pathBranchIdleFill` | Unselected card | `#152E28` | |
| `pathBranchIdleBorder` | Unselected stroke | `#3D5C53` | |
| `pathBranchIdleText` | Unselected title | `#C5D4CE` | |
| `pathBranchIdleStatus` | “Explore” | `#8FA39B` | |
| `pathBranchActiveFill` | Selected card | `#CDE8D6` | mint, near `primarySoft` but greener |
| `pathBranchActiveText` | Selected title | `#14352C` | |
| `pathBranchActiveStatus` | “Exploring” | `#2F5C4A` | |
| `pathPanelFill` | Explore panel | `#16332C` | |
| `pathPanelBorder` | Panel stroke | `#2F4F46` | |
| `pathChipIdleFill` | Unselected topic | `#10241F` | |
| `pathChipIdleBorder` | Topic stroke | `#4A6B62` | |
| `pathChipIdleText` | Topic label | `#D7E4DE` | |
| `pathChipActiveFill` | Selected topic | `#CDE8D6` | same as branch active |
| `pathChipActiveText` | Selected topic | `#14352C` | |
| `pathPromptKicker` | ASK ABOUT SUBJECTS | `#8FA39B` | |
| `pathQuote` | Question copy | `#D7E4DE` | |
| `pathCtaFill` | Ask / Start buttons | `#CDE8D6` | full-width pill |
| `pathCtaText` | CTA label | `#14352C` | |
| `pathTextLink` | Read discussions → | `#9BC9B8` | |
| `pathLock` | Profile disclaimer | `#8FA39B` | with lock icon |

Typography roles (use existing `typography` sizes):

| Role | Weight | Notes |
|------|--------|-------|
| H1 Explore what comes next | bold / ~28 | One wrap allowed |
| Location title | semibold / title | |
| Branch title | semibold | |
| Branch kicker + status | medium / caption | |
| Explore H2 | bold | |
| Quote | regular, slightly muted | Max ~3 lines on the hub |
| CTA | semibold | Min height 48 |

Shape:

- Location node: large radius (~20–24).
- Branch cards: large radius (~16–20), equal width, equal height.
- Explore panel: large radius (~20), padding 16–20.
- Topic chips: pill, min height 44.
- Primary CTA: full-width pill inside the prompt card, min height 48.

### 4.2 Tree drawing

- Lines are 1–2pt, `pathTreeLine`, no arrows.
- Selected branch’s downward stem must visually **dock** to the top centre
  of the explore panel (see screenshots 2–3).
- Idle branches have no downward stem.

### 4.3 Motion (light)

- Switching branch: panel copy crossfades; tree stem moves under the new
  card. No full-screen navigation.
- Switching topic: only the prompt card and discussions block change.

---

## 5. Branch sets by board family

Same chrome. Cards change with `boardFamily` + `primaryStage`. **Stay**
is always first.

### 5.1 IB · Class 10 (MYP G10) — the mock

| Kicker | Title | Catalogue slug (today / intended) |
|--------|-------|-----------------------------------|
| Continue IB | IB Diploma | `ib-diploma` |
| Switch | A Level | add `ib-to-a-level` |
| Switch | CBSE 11–12 | `ib-to-cbse` |

**Other routes:** Career-related Programme (`ib-cp`), ISC, state 11–12.

### 5.2 Cambridge · IGCSE (final year)

| Kicker | Title |
|--------|-------|
| Continue Cambridge | A Level |
| Switch | IB Diploma |
| Switch | CBSE 11–12 |

**Other routes:** ISC, state 11–12. Caption: IGCSE is Class 10, not 12
(keep that in the location meta or panel lead, not as a fourth card).

### 5.3 CBSE · Grade 10

| Kicker | Title |
|--------|-------|
| Stay on CBSE | Classes 11–12 |
| Switch | ISC |
| Switch | IB Diploma / A Level |

If IB and A Level both matter, put **one** “International 11–12” card in
the row and split IB vs A Level inside Other routes — never four top cards.

**Other routes:** Polytechnic (`tg-polycet` when state is TG/AP).

Inside Stay on CBSE, Subjects topic may show **PCM / PCB / PCMB /
Commerce / Arts** as a second chip row (this is the CBSE stream fork from
§6). Do not put those five streams as tree branches.

### 5.4 ICSE · Grade 10

| Kicker | Title |
|--------|-------|
| Continue ISC | Classes 11–12 |
| Switch | CBSE 11–12 |
| Switch | IB Diploma / A Level |

ICSE is not a seeded child curriculum yet. Branch UI can still preview in
admin; live personalisation waits on the curriculum row.

### 5.5 SSC · Grade 10 (TG/AP)

| Kicker | Title |
|--------|-------|
| Continue state | Intermediate |
| Switch | CBSE 11–12 |
| Other (disclosure) | Polytechnic · IB · A Level |

Local stream names (MPC, BiPC, …) live under Subjects on Intermediate,
not as tree cards.

### 5.6 Stages that are not a fork

Early, middle, and already-in-11–12 do **not** use a three-way switch
tree.

| Stage | Structure |
|-------|-----------|
| Foundation / middle | Location node + **one** Continue card + explore panel (olympiads under College plans as “coming”). No switch row unless we explicitly add “switch board at G6”. |
| Senior (already DP / A Level / G11–12) | Location node + **one** current-programme card. Topics especially College plans (live exams). |
| After 12 | Location node + After-school routes; topics collapse to College plans. |

Do not resurrect the five-stop strip **on the same screen** as this tree.
If we need peek-at-another-stage, that is a later control on the location
node, not a second timeline.

---

## 6. Topic chips → existing content

The three chips are **lenses** on the selected branch. They are not new
board families.

| Chip | Parent job | Pull from catalogue |
|------|------------|---------------------|
| **Subjects** | What do we pick, and what does it lock? | What-next structure / subject-gate rows. IB HL/SL. A Level 3–4 subjects. CBSE streams. |
| **Workload** | How hard, calendar, clashes | DP May clash (`ib-may-clash`), March vs June series, “board + entrance in parallel”. |
| **College plans** | What exams/routes sit on this branch | Opportunities: JEE, NEET, CUET, EAPCET, UCAS, CLAT, … live vs dimmed rules unchanged. |

Prompt quotes are **editorial**, one per branch×topic. They are not the
catalogue `lead`. Example from the mock:

| Branch × topic | Prompt |
|----------------|--------|
| IB Diploma · Subjects | Parents with children in IB DP: how did you choose HL and SL subjects, especially when your child was unsure about a career? |
| CBSE 11–12 · Subjects | Parents who switched from MYP to CBSE: how did you choose a subject combination for Class 11? |
| CBSE 11–12 · College plans | CBSE parents: how did you balance your child’s interests with subjects needed for possible college courses? |

CTA **Ask parents anonymously** opens the existing anonymous composer
(S05). Prefill the quote. Show **Where will this be posted?** with only
circles the parent can actually write to. Exploring DP from MYP does **not**
grant a DP circle. Tags on the post are for discovery; they never widen
audience. Full composer rules: functional spec §9.

---

## 7. Product rules this UI must keep

From the catalogue spec; this layout must not violate them:

1. Exploring is **peek-only**. Lock line is required.
2. IGCSE / MYP must not present JEE, NEET, or EAPCET as sittable now.
   College plans on those branches: dimmed + “after A Level / after DP”.
3. EAPCET is not medicine. NEET stays the medical card.
4. No coaching listings. Discover already has that.
5. No sixth bottom tab. Entry remains More → Child's Path.
6. Hub copy stays short: node + three cards + one quote. Extra nuance
   lives on the official-site detail, not a third paragraph in the panel.
7. Pages are not articles. The quote is the only long text on the hub.

---

## 8. What we are replacing vs keeping

| Keep | Replace on the Class 10 fork screen |
|------|--------------------------------------|
| Catalogue items, stages, streams, qualification gates | Flat “What next” + “Opportunities” section headers as the first paint |
| Detail screen (lead + labelled rows) as a deeper read | Using detail as the only way to compare stay vs switch |
| More entry + preschool hide | Five-stop strip on this same view |
| Dimmed future exams | Exam dump before a branch is chosen |
| Child switcher when 2+ school children | Writing branch choice into the child record |

Light §14 hub can remain for admin table preview of **cards**. Parent
phone at the fork follows **this** file.

---

## 9. Implementation notes (when we build)

- Routes stay `apps/mobile/app/(app)/pathways/`.
- Hub `index.tsx` becomes the branch explorer when
  `includeAfter10Fork` or `primaryStage === "board_10"` in the final
  Class 10-equivalent year; other stages use the simplified one-card
  variant in §5.6.
- Branch selection is **local UI state**, like today’s stream chips.
- Topic selection is local UI state.
- `pathTheme` lives next to `theme.ts`; do not override global `colors.bg`.
- Tree lines: simple Views (or a tiny SVG). Decorative for accessibility.
  No animation library required for v1. Respect reduced motion.
- Overflow branches in the disclosure must still be tappable and load the
  same explore panel pattern.
- At 390 keep three cards in one row. At ~320 or large text, **reflow to a
  vertical connected list** (same order). Do not shrink labels or require
  horizontal pan.

---

## 10. Sign-off checklist (phone, 390×844)

- [ ] IB MYP G10 default: Continue IB selected, mint card, stem into panel.
- [ ] Switching to CBSE 11–12 updates breadcrumb, title, and prompt; profile
      line still says IB MYP · Grade 10.
- [ ] Three topic chips; College plans does not unlock EAPCET as live on MYP.
- [ ] Other routes is collapsed by default.
- [ ] Lock line visible without scrolling past the panel on a 390-tall
      viewport (or immediately under the panel).
- [ ] Empty discussions state uses the same theme, not the light EmptyState.
- [ ] No horizontal scroll at 320 width; cards reflow vertically, labels
      stay readable (44pt targets).
- [ ] Ask parents anonymously reaches composer; **Where will this be
      posted?** shows a real eligible circle; no new circle type.
