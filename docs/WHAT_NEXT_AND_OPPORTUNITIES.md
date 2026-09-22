# What next and Opportunities

**Status:** documentation only. Admin preview next. Mobile after the admin
flow and card layout feel right.

**Audience:** editorial orientation for parents, keyed to the child's board
and stage. Not counselling, not coaching ads, not a new circle.

This is the product specification and first content catalogue. Board
families, stages, streams, and card copy live here.

**Official check (21 Sep 2026):** exam names, Class 12-equivalent gates
(JEE/NEET/CUET vs IGCSE/MYP), AIU IB/A Level wording, TG EAPCET ≠ medicine,
POLYCET after 10, NTSE paused — see
[`CHILDS_PATH_OFFICIAL_REVIEW.md`](CHILDS_PATH_OFFICIAL_REVIEW.md).
Orientation copy is not a counselling certificate.

**Parent phone layout** is the expandable thread in
[`CHILDS_PATH_EXPLORATION_TREE.md`](CHILDS_PATH_EXPLORATION_TREE.md).
It **replaces** the three branch cards in
[`CHILDS_PATH_BRANCH_UI.md`](CHILDS_PATH_BRANCH_UI.md) (that file is the
earlier screen, not a second view). **Production behaviour** (identity,
posting audience, eligibility, errors, QA) is
[`CHILDS_PATH_FUNCTIONAL.md`](CHILDS_PATH_FUNCTIONAL.md). §14 remains
admin card-list density only. Do not show cards and the thread together.
Do not use Astra’s radial map, question-led hub, or a five-stop strip.

**Parent-facing name:** **Child's Path** (More row and hub title).

| Layer | Name | Use |
|-------|------|-----|
| App entry / screen title | **Child's Path** | More menu, navigation header |
| Content pillar A | **What next** | Hub section for forks and pathways |
| Content pillar B | **Opportunities** | Hub section for exams and routes |
| Code / routes / admin | `pathways` | Folder, JSON, API — not shown to parents |

Do not put “What next” on the More row. Parents will not know what it means.

**Contents**

1. [Why this exists](#1-why-this-exists)
2. [How parents behave today](#2-how-parents-behave-today)
3. [Product rules](#3-product-rules)
4. [Board families vs app curricula](#4-board-families-vs-app-curricula)
5. [Stages](#5-stages)
6. [Streams](#6-streams)
7. [State overlay](#7-state-overlay)
8. [Content model](#8-content-model-for-admin-then-api)
9. [What next](#9-catalogue--what-next) — CBSE, Cambridge, ICSE, SSC, IB, other state boards
10. [Opportunities](#10-catalogue--opportunities) — national, then per board
11. [State-wise split](#11-catalogue--state-wise-split) — all states, then [Cambridge × state](#118-cambridge--indian-states) and [IB × state](#119-ib--indian-states)
12. [What this is not](#12-what-this-is-not)
13. [Admin-first](#13-admin-first-how-we-will-test-this)
14. [Mobile presentation — CBSE first](#14-mobile-presentation--cbse-first)
15. [Walkthroughs](#15-simulated-walkthroughs-product-intent)
16. [Editorial rules](#16-editorial-rules)
17. [Implementation sequence](#17-implementation-sequence)
18. [Open questions](#18-open-questions-resolve-during-admin-not-before)

---

## 1. Why this exists

Parents already get peer talk in circles and local providers in Discover.
They still hit a different question, usually in Grade 8–12:

> Given *this* board, *this* grade, and *this* stream — what happens next,
> and which exams or routes are actually on the table?

Today that answer lives in coaching-centre flyers, WhatsApp forwards, and
stale blog lists. The lists mix live exams with discontinued ones, mix CBSE
advice into IGCSE homes, and treat “Science” as if every board meant the
same thing.

Vaara should own a **board-aware and state-aware map**:

| Pillar | Parent question | Examples |
|--------|-----------------|----------|
| **What next** | What are the real forks from here? | After Class 10: PCM / PCB / Commerce / Arts. After IGCSE: A Levels vs IBDP vs CBSE 11–12. After SSC: Intermediate MPC / BiPC / MEC. After Karnataka SSLC: PUC. |
| **Opportunities** | Which exams, olympiads, and admission routes sit on those forks? | National: JEE, NEET, CUET, CLAT. State: TG EAPCET, KCET, MHT-CET, TNEA, KEAM. |

The two pillars stay separate in the UI. Mixing them produces a dump of exam
names with no decision context.

This is a fourth content layer, not a fourth circle:

```
IDENTITY          who you are          auto-derived circles
INTEREST          what you care about  opt-in topics on posts
MARKETPLACE       who can help nearby  tutors, coaching, classes
ORIENTATION       what the path is     Child's Path
                                       (What next + Opportunities)  ← this
```

Orientation is **editorial**. Parents do not create pathways. They do not
vote exams into existence. Accuracy is a Vaara responsibility.

---

## 2. How parents behave today

Meera (CBSE Grade 6) is early. She hears “JEE foundation from Grade 6” and
cannot tell signal from sales.

Rajesh (IGCSE Grade 8) is already choosing IGCSE subjects. A CBSE parent
tells him “take PCM for JEE”. That advice is incomplete: Cambridge does not
use Indian streams, and A Level subject choice later is what Indian
engineering colleges actually check.

An SSC parent in Hyderabad is told “everyone writes EAMCET”. Medicine is
NEET. State engineering/agriculture/pharmacy is **TG EAPCET** (the current
name; older parents still say EAMCET). Polytechnic after 10th is POLYCET.

Fatima, still choosing a school, wants to know whether IB closes Indian
college doors. It does not — AIU treats IB Diploma as Class 12 equivalent —
but the May exam calendar collides with JEE/NEET/CUET.

### The trigger moment

| Moment | Typical grade | What they need |
|--------|---------------|----------------|
| Foundation / olympiad chatter starts | 6–8 | Which contests are real vs commercial; no stream decision yet |
| Subject / stream lock | 8–10 | What next: board continuation vs switch; stream or subject set |
| Board exam year | 10 or IGCSE / MYP 5 | Calendar, then the fork after results |
| Entrance-exam year | 11–12 / A Level / IBDP | Opportunities: which papers, which subject prerequisites |
| After boards | 12+ | College routes: India vs abroad, state vs national |

Urgency peaks at two Indian forks: **after 10th** and **during 11–12**.

---

## 3. Product rules

1. Content is keyed to **board family × state × stage × stream**. Board is
   how the child is taught. State is which CET, counselling, and Class 11–12
   naming apply. A CBSE parent in Hyderabad must see **CBSE streams and
   TG EAPCET**, not Karnataka PUC. A CBSE parent in Bengaluru must see
   **CBSE streams and KCET**, not Intermediate.
2. **What next** is the map. **Opportunities** are the markers on that map.
   Every exam card points back to the pathway it serves.
3. Copy is orientation, not a recommendation. Never “your child should take
   JEE”. Always “this route exists if they want engineering in India”.
4. Dates, fees, cut-offs, and eligibility change yearly. Cards store a
   **last reviewed** date and a short “verify on the official site” line.
   Vaara does not scrape live application windows in v1.
5. Discontinued or paused programmes are labelled **inactive**, not deleted.
   Parents still search for NTSE and KVPY.
6. This is not Discover. An opportunity may later deep-link to local
   coaching, but the card itself is not a listing.
7. This is not Topics. Topics tag parent posts (`exam-stress`,
   `board-choice`). Pathways are a curated catalogue.
8. Child identity stays private. Mobile personalisation uses the child's
   curriculum, grade, and location already on the profile. Admin preview
   uses explicit board / state / stage / stream filters, no live parent
   accounts.
9. India-first. National exams are shared across boards **and** states.
   State exams attach to the **state**, not only to the state board. A
   Cambridge **A Level** or IB **DP** child in Telangana still sees
   TG EAPCET (with subject and calendar notes). An IGCSE or MYP child
   sees it only as a dimmed “after A Level / DP” card — they are still
   Class 10 equivalent. The app's seeded `SSC` curriculum is
   Telangana/AP; other state boards are authored as the `STATE` family
   keyed by state code, even before those curricula exist in `seed.ts`.
10. Vaara does not certify domicile, local / non-local status, or
    reservation. State-seat cards say that local eligibility usually
    applies, and point at the official counselling brochure.
11. Future exams may appear **dimmed** at earlier stages (“look in
    Grade 11” / “after A Levels”). They must not look sittable now.
12. Mobile layout for **CBSE** is proposed in §14 under the parent-facing
    name **Child's Path**. Admin phone preview must render that hub, not
    a free-form experiment. Cambridge / IB / State reuse the same shell
    after CBSE is signed off.
13. **Pages are not articles.** Hub and detail are scan, not read. One
    line on a card, two sentences of lead on detail, then labelled rows.
    Catalogue tables in this spec are for authors. They must not be
    pasted onto the phone. Extra nuance belongs on **Official site**, not
    in a third paragraph. Density rules are §14.9 and §16.

---

## 4. Board families vs app curricula

Parents say “Cambridge” and “IB”. The app stores finer codes.

| Board family (this feature) | App `curricula.code` today | Notes |
|-----------------------------|----------------------------|--------|
| **CBSE** | `CBSE` | Nursery–G12 already seeded. |
| **Cambridge** | `IGCSE` | Seeded as IGCSE Years 1–11. A Level / AS is the usual “what next” after IGCSE and is **not** a separate curriculum row yet. Treat A Level as a Cambridge pathway, not a missing child-profile value. |
| **ICSE** | *missing* | Schools already carry `ICSE` in `board_codes`, and onboarding copy mentions ICSE, but `packages/db/src/seed.ts` has no ICSE curriculum. Pathways content can still be authored for ICSE. Wiring it to a child's profile waits on adding the curriculum. |
| **SSC** | `SSC` | Seeded as “SSC (Telangana/AP)”, Grades 1–10 only. After 10th the state path is **Intermediate (11–12)**, not SSC Class 12. Maps to the `STATE` family for **TG** and **AP** only. |
| **IB** | `IB_PYP`, `IB_MYP`, `IBDP` | One family, three programmes. What next is often PYP → MYP → DP, or a switch to CBSE/IGCSE/ISC at a programme boundary. |
| **State board** | *per-state; only `SSC` exists today* | One family (`STATE`), parameterised by state code. Karnataka SSLC, Maharashtra SSC, Kerala SSLC, UP Board, etc. live here — not as extra board chips. |

Admin and later mobile browse **families**. Personalisation maps a child's
code into the family. IB children see the programme that matches their
code, with the other two programmes available as “what next / also in this
family”.

State is a **second filter**, not a sixth board chip. Choosing Karnataka
does not turn a CBSE child into a state-board child; it adds KCET / PUC
naming / KEA counselling on top of CBSE What next.

### 4.1 Canonical curriculum normalisation

This table is normative for admin JSON and later mobile. Do not infer a
different family in each client.

| `curricula.code` / admin value | `board_family` | Derived `qualification_id` | State rule |
|--------------------------------|----------------|----------------------------|------------|
| `CBSE` | `CBSE` | G1–10: `cbse_10`; G11–12: `cbse_12` | State comes from the selected/profile state |
| `ICSE` *(admin-only until seeded)* | `ICSE` | Through G10: `icse_10`; ISC G11–12: `isc_12` | State comes from the selected/profile state |
| `SSC` | `STATE` | Through G10: `ssc_10`; Intermediate: `state_12` | **TG or AP is required.** Use selected/profile state; never guess between them |
| `IGCSE` | `CAMBRIDGE` | Through IGCSE: `igcse`; A Level: `a_level` | State comes from the selected/profile state |
| `IB_PYP` | `IB` | `ib_pyp` | State comes from the selected/profile state |
| `IB_MYP` | `IB` | `ib_myp` | State comes from the selected/profile state |
| `IBDP` | `IB` | `ib_dp` | State comes from the selected/profile state |
| Per-state admin board | `STATE` | Through Class 10: `state_10`; senior secondary: `state_12` | Admin-selected state is required |

If a `STATE` child has no usable state, show national items only and ask
for a state. Do not default the child to Telangana merely because the
admin preview defaults to Telangana.

Qualification derivation for the renderer:

| Family | `foundation` | `middle` | `board_10` / `after_10` | `senior` | `after_12` keeps |
|--------|--------------|----------|--------------------------|----------|------------------|
| `CBSE` | `cbse_10` | `cbse_10` | `cbse_10` | `cbse_12` | `cbse_12` |
| `ICSE` | `icse_10` | `icse_10` | `icse_10` | `isc_12` | `isc_12` |
| `STATE` + seeded SSC | `ssc_10` | `ssc_10` | `ssc_10` | `state_12` | `state_12` |
| Other `STATE` | `state_10` | `state_10` | `state_10` | `state_12` | `state_12` |
| `CAMBRIDGE` | `igcse` | `igcse` | `igcse` | `a_level` | `a_level` |
| `IB` | `ib_pyp` | `ib_myp` | `ib_myp` | `ib_dp` | `ib_dp` |

Admin derives this value from family + stage and exposes it as a
**Qualification** control. It may override compatible fixtures (for
example `ib_cp` instead of `ib_dp`). Mobile uses curriculum + grade and
does not allow arbitrary override.

Because A Level and Intermediate are pathways rather than seeded profile
grades today, their `senior` hubs are fully testable in admin but cannot
personalise a real child until the profile model records that progression.
Do not silently treat an IGCSE Y11 child as A Level.

---

## 5. Stages

Stages are product labels, not extra database grades. They collapse each
board's year names onto the same parent timeline.

| Stage id | Parent label | CBSE / ICSE | State board (name varies) | Cambridge | IB |
|----------|--------------|-------------|---------------------------|-----------|-----|
| `foundation` | Early years | Nursery–G5 | G1–G5 | Y1–Y6 | PYP |
| `middle` | Middle school | G6–G8 | G6–G8 | Y7–Y9 | MYP G6–G8 |
| `board_10` | Board / checkpoint years | G9–G10 | G9–G10 | IGCSE (typically Y10–Y11) | MYP G9–G10 |
| `after_10` | After Class 10 | Stream + stay or switch | Intermediate / PUC / HSC / Plus Two vs polytechnic vs switch | A Level / IBDP / Indian 11–12 | MYP → DP / CP / switch |
| `senior` | Senior years | G11–G12 | Inter / 2nd PUC / HSC / Plus Two | AS / A Level | IBDP |
| `after_12` | After school | College routes | College routes | College routes | College routes |

There are **six content stages but five mobile stops**. `after_10` is a
transition content stage, not a separate stop in the phone strip.

| Current child context | Primary content stage | Extra What next content | Selected mobile stop |
|-----------------------|-----------------------|-------------------------|----------------------|
| CBSE / ICSE / state G1–5 | `foundation` | — | Early |
| G6–8 | `middle` | — | Middle |
| G9 | `board_10` | — | 10 |
| Final Class 10-equivalent year (CBSE/ICSE/SSC G10, IGCSE final year, MYP 5) | `board_10` | Include `after_10` pathway cards below the current-board card | 10 |
| G11–12 / Intermediate / PUC / A Level / DP | `senior` | — | 11–12 / DP |
| School complete | `after_12` | — | After |

Rules:

1. `after_10` remains a real `stage_id` for authoring and the admin filter.
2. Mobile never shows a sixth “After 10” stop. On the final Class
   10-equivalent year, the query returns `board_10` items plus
   `after_10` **What next** items. Opportunities use their own live/future
   rules in §8.3.
3. Admin may select `after_10` directly to inspect the fork without
   pretending it is the child's current grade.
4. Default mobile stage is derived from the child. A future stop is a
   read-only peek; it does not mutate the child's profile.

Preschool-only children (no board) are out of v1. They have no board family.

---

## 6. Streams

Indian boards use named streams after Class 10. Cambridge and IB use
**subject combinations**, not streams. We still filter Opportunities by the
intent the parent has in mind.

| Stream id | Label | Typical subjects | Typical opportunities |
|-----------|-------|------------------|------------------------|
| `pcm` | Science — PCM | Physics, Chemistry, Maths | JEE, BITSAT, NDA, NATA, CUET, state engineering |
| `pcb` | Science — PCB | Physics, Chemistry, Biology | NEET, state agriculture/pharmacy, CUET |
| `pcmb` | Science — PCMB | All four | Both of the above; heavier load |
| `commerce` | Commerce | Accountancy, Business, Economics ± Maths | CUET, CA Foundation, CSEET, IPMAT |
| `arts` | Humanities / Arts | History, Pol. Sci., Psychology, languages | CUET, CLAT, NID/NIFT/UCEED, journalism |
| `vocational` | Vocational / skill | Polytechnic, IBCP, NSQF | POLYCET, diplomas, skill universities |
| `undecided` | Not chosen yet | — | Show What next first; Opportunities stay general |

Cambridge / IB cards tagged with a stream mean “this Indian route needs
these subjects”, not “the board has this stream”. Example: JEE for an IB
student requires HL Physics, Chemistry, Maths — shown as `pcm`.

Local stream **names** change by state (MPC vs PCMC vs FYJC Science). The
stream *id* stays `pcm` / `pcb` / `commerce` / `arts`. The card title can
use the local name when a state is selected.

Canonical chip-to-stream mapping:

| Board / programme label | Hub `stream` |
|-------------------------|--------------|
| PCM, MPC, Engineering intent | `pcm` |
| PCB, BiPC, Medicine intent | `pcb` |
| PCMB / both science routes | `pcmb` |
| Commerce, MEC, CEC, Economics intent | `commerce` |
| Arts, HEC, Humanities intent | `arts` |
| Polytechnic, IBCP, skill route | `vocational` |

Labels are local; filter values are canonical. MEC and CEC can later
split if opportunities materially differ, but v1 maps both to
`commerce`. HEC maps to `arts`.

---

## 7. State overlay

Board answers “what syllabus is the child on?”. State answers “which
public colleges and which CET sit in this geography?”. Parents mix them
up, which is why a Hyderabad CBSE parent is told “only JEE” and an SSC
parent is told “only EAMCET”. Both are incomplete.

```
shown cards
  = national items                          (JEE, NEET, CUET, CLAT, UCAS, …)
  ∪ state items for selected state          (TG EAPCET, POLYCET, …)
  ∪ board items for selected family         (CBSE streams, IGCSE→A Level fork,
                                            PYP→MYP→DP fork)
  ∪ state-board items if family is STATE    (Intermediate / PUC / HSC names)
```

Cambridge and IB **keep their board cards** when a state is selected.
State CETs stack underneath, with the qualification gate in §11.8–§11.9
(A Level / DP only — not IGCSE / MYP).

| Axis | Source later in mobile | Admin control |
|------|------------------------|---------------|
| Board family | Child `curriculum_code` | Board chips |
| State | Parent location (pin → state), overridable | State dropdown, default **Telangana** |
| Stage | Child grade | Stage chips |
| Stream | Optional; undecided until after 10 | Stream chips |

A family that *lives* in Telangana and *targets* Karnataka colleges is a
real case (relocation, NRI, All-India quota). Admin preview must allow
picking state independently of board. Mobile can default to the profile
pin and offer “also show another state”.

**Domicile.** State engineering / medical seats usually need local or
non-local rules defined by that state. Vaara states the rule in one
sentence and links the brochure. We never compute whether *this* parent
qualifies.

**Medicine is national, counselling is state.** NEET is the exam in every
state. The counselling body changes (TG, KEA, MCC AIQ). Do not list a
state “medical CET” except as history.

**Three engineering patterns** (label every state card with one):

| Pattern | What the student sits | Examples |
|---------|----------------------|----------|
| Own CET | A state paper | TG EAPCET, AP EAPCET, KCET, MHT-CET, KEAM, WBJEE, GUJCET, CG PET, Assam CEE, JKCET |
| JEE counselling | JEE Main rank, no extra paper | UPTAC (UP), JAC Delhi, HSTES (Haryana), REAP (Rajasthan), most of MP / Jharkhand / Punjab / Goa |
| Class 12 merit | Board marks, no engineering CET | **TNEA (Tamil Nadu)** |

Private extra papers (COMEDK in Karnataka, VITEEE, SRMJEEE) are
opportunities tagged to a state or to `IN`, never as the government CET.

---

## 8. Content model (for admin, then API)

v1 is a curated catalogue, versioned in git as JSON (or SQL seed) and
edited through admin. Do not start with a parent-facing CMS.

```text
board_family × state_code
  └── pathway         What next item
  └── opportunity     exam | olympiad | admission_route
```

### 8.1 Canonical enums

These strings are normative. JSON, admin controls, SQL, and later mobile
must use them unchanged.

| Field | Allowed values in v1 |
|-------|----------------------|
| `board_family` | `CBSE`, `ICSE`, `STATE`, `CAMBRIDGE`, `IB` |
| `kind` | `pathway`, `exam`, `olympiad`, `admission_route` (`scholarship` is reserved, not v1 content) |
| `pillar` | `what_next`, `opportunities` |
| `stage_id` | `foundation`, `middle`, `board_10`, `after_10`, `senior`, `after_12` |
| Hub `stream` | `undecided`, `pcm`, `pcb`, `pcmb`, `commerce`, `arts`, `vocational` |
| Item `stream_ids` | `all`, `pcm`, `pcb`, `pcmb`, `commerce`, `arts`, `vocational` |
| `qualification_id` | `cbse_10`, `cbse_12`, `icse_10`, `isc_12`, `ssc_10`, `state_10`, `state_12`, `igcse`, `a_level`, `ib_pyp`, `ib_myp`, `ib_dp`, `ib_cp` |
| `admission_pattern` | `own_cet`, `jee_counselling`, `class12_merit`, `national`, `not_applicable` |
| `status` | `draft`, `published`, `inactive` |
| Link `rel` | `leads_to`, `requires`, `related` |
| `content_depth` | `full`, `compact`, `thin` |

`undecided` is a **hub state**, not an item tag. A generally applicable
item uses `stream_ids: ["all"]`.

### 8.2 Canonical JSON format

The first implementation is one versioned file:

```text
apps/web/public/internal/admin/data/pathways.json
```

Top-level shape:

```json
{
  "schema_version": 1,
  "items": [],
  "links": []
}
```

Normative item example (the Telangana engineering paper):

```json
{
  "slug": "tg-eapcet-engineering",
  "kind": "exam",
  "pillar": "opportunities",
  "board_families": ["CBSE", "ICSE", "STATE", "CAMBRIDGE", "IB"],
  "state_codes": ["TG"],
  "stage_ids": ["senior"],
  "preview_stage_ids": ["board_10"],
  "stream_ids": ["pcm", "pcb", "pcmb"],
  "contrast_for_stream_ids": [],
  "eligible_qualification_ids": [
    "cbse_12",
    "isc_12",
    "state_12",
    "a_level",
    "ib_dp"
  ],
  "title": "TG EAPCET",
  "summary": "Telangana engineering, agriculture and pharmacy route; not MBBS.",
  "lead": "Telangana's state entrance paper for engineering, agriculture and pharmacy. Medicine uses NEET.",
  "detail_rows": [
    { "label": "Also known as", "value": "EAMCET, TS EAMCET" },
    { "label": "When", "value": "Class 12-equivalent year" },
    { "label": "Subjects", "value": "PCM/MPC engineering; PCB/BiPC agriculture or pharmacy" },
    { "label": "Eligibility", "value": "Class 12 equivalent; A Level/DP subjects must match" },
    { "label": "Opens", "value": "TG B.Tech, agriculture, pharmacy" },
    { "label": "Local rule", "value": "Check local / non-local eligibility" },
    { "label": "Not this", "value": "MBBS — medicine is NEET" }
  ],
  "required_detail_row_labels": [
    "Also known as",
    "When",
    "Subjects",
    "Eligibility",
    "Opens",
    "Local rule",
    "Not this"
  ],
  "admission_pattern": "own_cet",
  "content_depth": "full",
  "status": "published",
  "official_url": "https://tgeapcet.nic.in/",
  "source_urls": ["https://tgeapcet.nic.in/"],
  "last_reviewed_on": "2026-03-01",
  "sort_order": 20
}
```

Normative relationship examples:

```json
[
  {
    "from_slug": "cbse-after-10-pcm",
    "to_slug": "jee-main",
    "rel": "leads_to"
  },
  {
    "from_slug": "tg-eapcet-engineering",
    "to_slug": "class-12-equivalent-pcm",
    "rel": "requires"
  }
]
```

Validation before the admin preview renders:

- `title`: 2–50 characters.
- `summary`: one sentence, at most 100 characters.
- `lead`: at most two sentences and 240 characters.
- `detail_rows`: 6–10 unique labels for `content_depth = full`; 4–8 for
  `compact`; 3–6 for `thin`.
- Detail label: at most 24 characters. Value: at most 120 characters.
- Every `required_detail_row_labels` entry must exist in `detail_rows`.
- `official_url` may be `null`. Hide **Official site** when it is null.
- Every published item has at least one `source_urls` entry and a
  `last_reviewed_on` date.
- Every exam has at least one `requires` or `leads_to` relationship.
- `pillar = what_next` permits `kind = pathway`.
  `pillar = opportunities` permits `exam`, `olympiad`, and
  `admission_route`; do not put the IB Diploma pathway in Opportunities.

`notes_md`, when present, is admin-only research. Phone never renders it.

### 8.3 Deterministic query, visibility, and grouping

The renderer receives this context:

```text
family + state + primary_stage + qualification_id
+ include_after_10_fork + stream + pillar
```

`include_after_10_fork` is deterministic:

- Mobile: `true` only for the final Class 10-equivalent year listed in §5.
- Admin Board 10 fixture: `true` when **Year context = Final year**;
  `false` for an earlier board year.
- Admin direct `after_10` filter: `primary_stage = after_10` and the flag
  is `false`; this produces the fork-only editorial view.

Apply rules in this order:

1. **Status.** Parent preview includes `published` and clearly labelled
   `inactive`; ordinary mobile browsing excludes `draft`.
2. **Family.** Keep items whose `board_families` contains the selected
   family.
3. **Geography.** Keep national (`IN`) plus selected-state items. If state
   is missing, keep `IN` only.
4. **Pillar.** Keep the requested pillar. `All` in admin means both;
   mobile renders What next before Opportunities.
5. **Stage.**
   - Live when `primary_stage` is in `stage_ids`.
   - Future/dimmed when it is in `preview_stage_ids`.
   - When `include_after_10_fork = true`, also include `after_10`
     **What next** items as live fork cards (§5).
6. **Qualification.**
   - An empty `eligible_qualification_ids` means no extra qualification
     gate.
   - If the current qualification is allowed, keep the stage state.
   - If it is not allowed but the item is a stage preview, keep it
     dimmed with an explicit requirement (“After DP”, “After A Level”).
   - Otherwise hide it. `ib_cp` never inherits `ib_dp` eligibility.
7. **Stream.**
   - `all` items always remain.
   - `undecided`: show only `all` items plus “Pick a stream to see what
     it opens.” Do not dump every stream-specific exam.
   - `pcm`: include `all` + `pcm`.
   - `pcb`: include `all` + `pcb`.
   - `pcmb`: include `all` + `pcm` + `pcb` + `pcmb`.
   - Other selected streams include `all` + their exact id.
   - An item whose `contrast_for_stream_ids` contains the selection may
     appear dimmed under **Not on this stream**. This list is curated;
     do not show every mismatch.
8. **Group in this fixed order:** What next; Opportunities — National;
   Opportunities — selected state; Not on this stream; Inactive.
9. Within a group, use `sort_order`, then title.

Changing the state replaces only the selected-state group. National and
board-family cards remain. Changing a chip updates Opportunities in
place and preserves scroll context.

### 8.4 SQL promotion (later)

JSON is the first source. When copy stabilises, promote the same fields
without changing their meaning:

```sql
-- Editorial catalogue. Not user-generated.
CREATE TABLE pathway_items (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  kind text NOT NULL,              -- pathway | exam | olympiad | scholarship | admission_route
  pillar text NOT NULL,            -- what_next | opportunities
  board_families text[] NOT NULL,  -- {CBSE} or {CBSE,ICSE,STATE,CAMBRIDGE,IB}
  state_codes text[] NOT NULL,     -- {IN} = national; {TG} = Telangana only; {TG,AP} = both
  stage_ids text[] NOT NULL,
  preview_stage_ids text[] NOT NULL DEFAULT '{}',
  stream_ids text[] NOT NULL DEFAULT '{all}',
  contrast_for_stream_ids text[] NOT NULL DEFAULT '{}',
  eligible_qualification_ids text[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  summary text NOT NULL,           -- hub card: one line, <= 100 characters
  lead text NOT NULL,              -- detail: max two sentences
  detail_rows jsonb NOT NULL,      -- row count follows content_depth validation in §8.2
  required_detail_row_labels text[] NOT NULL DEFAULT '{}',
  notes_md text,                   -- admin-only. Never render as a phone article
  when_relevant text,              -- "Start looking in Grade 9"
  also_known_as text[] NOT NULL DEFAULT '{}',  -- EAMCET, TS EAMCET, …
  admission_pattern text,          -- own_cet | jee_counselling | class12_merit | national
  board_notes jsonb,               -- { "CAMBRIDGE": "Needs A Level PCM", "IB": "Needs HL PCM" }
  state_notes jsonb,               -- { "TG": "KEA vs TG counselling for NEET" }
  content_depth text NOT NULL DEFAULT 'full',
  status text NOT NULL,            -- draft | published | inactive
  official_url text,
  source_urls text[] NOT NULL,
  last_reviewed_on date NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE pathway_item_links (
  from_id uuid REFERENCES pathway_items(id),
  to_id uuid REFERENCES pathway_items(id),
  rel text NOT NULL,               -- leads_to | requires | related
  PRIMARY KEY (from_id, to_id, rel)
);
```

State codes are Indian state/UT abbreviations: `TG`, `AP`, `KA`, `TN`, `KL`,
`MH`, `GJ`, `GA`, `DL`, `UP`, `HR`, `PB`, `RJ`, `HP`, `UK`, `JK`, `LA`,
`CH`, `PY`, `MP`, `CG`, `BR`, `JH`, `OD`, `WB`, `AS`, `AR`, `NL`, `MN`,
`ML`, `MZ`, `TR`, `SK`, `AN`, `DN`, `LD`. National items use `{IN}`.

Shared national exams (JEE, NEET, CUET, CLAT) are **one row** with
`state_codes = {IN}` and several `board_families`. Board-specific notes
(subject names, exam series month) live in an optional `board_notes jsonb`
keyed by family. State-specific notes for the same exam (KEA counselling
vs TG counselling for NEET) live in `state_notes jsonb`, so we do not
clone the NEET card 28 times.

`status = inactive` is how NTSE and KVPY appear: searchable, clearly paused.

---

## 9. Catalogue — What next

This is the v1 map. Admin should be able to render every row below as a
card. Copy here is for **authors**. The phone uses the “In one line”
column as `summary`, not the surrounding tables as a scroll of prose.

### 9.1 CBSE

| Stage | What next | In one line |
|-------|-----------|-------------|
| Foundation | Stay on CBSE; build language + numeracy | Board exams are years away. No stream yet. |
| Middle | Optional olympiads; no stream lock | Grade 8 is early enough to notice interest in maths/science vs languages. |
| Board 10 | Class 10 (AISSE) | First public exam. Result feeds the Class 11 stream choice. |
| After 10 | **The CBSE fork** | Stay CBSE 11–12 in PCM / PCB / PCMB / Commerce / Arts; or switch to ISC, IBDP, Cambridge A Level; or polytechnic / skill. |
| Senior | Class 12 (AISSCE) + entrance papers | Board marks and entrance exams run in parallel. |
| After 12 | Indian UG / abroad | Engineering, medicine, central universities, professional courses, or overseas applications. |

**After-10th streams (CBSE) — the parent-facing fork**

| Stream | Typical Class 11–12 subjects | Opens |
|--------|------------------------------|-------|
| PCM | Physics, Chemistry, Maths, English + elective | Engineering, architecture, defence, pure sciences |
| PCB | Physics, Chemistry, Biology, English + elective | Medicine, dentistry, life sciences, some pharmacy |
| PCMB | All four science subjects | Both of the above; heaviest CBSE load |
| Commerce | Accountancy, Business Studies, Economics ± Maths | B.Com, BBA, CA/CS/CMA, management, economics |
| Arts | History, Pol. Sci., Sociology, Psychology, languages | Law, design, liberal arts, civil services later |

Switching out of CBSE after 10th is a real option (IBDP, A Level, ISC) but
costs a year of new assessment style. Switching *into* CBSE in Grade 11 is
common for families who want JEE/NEET coaching alignment.

### 9.2 Cambridge (IGCSE → A Level)

Cambridge is a **programme ladder**, not an Indian stream. Parents still
need Indian-shaped answers (engineering / medicine / commerce), so we map
subject sets onto stream ids without pretending the report card says PCM.

| Stage | Cambridge programme | What next | In one line |
|-------|---------------------|-----------|-------------|
| Foundation | Cambridge Primary (Y1–Y6); Checkpoint optional | Stay on Cambridge, or switch to CBSE/ICSE/state | Checkpoint is diagnostic, not a Class 10 board exam. |
| Middle | Lower Secondary (Y7–Y9); Checkpoint | Shortlist IGCSE subjects | 7–10 IGCSE subjects is typical in Indian international schools. No named stream. |
| Board 10 | **IGCSE** (usually Y10–Y11) | First public exam; Class 10 equivalent (AIU) | **March series** in India hits junior-college / Indian 11th timelines. June series is late for that fork. |
| After 10 | **The Cambridge fork** | See table below | IGCSE alone is **not** Class 12. Stopping here blocks Indian UG. |
| Senior | **AS then A Level** (usually 3–4 subjects, 2 years) | Depth over breadth | Indian engineering/medicine need Physics, Chemistry, and Maths or Biology at A Level — that *is* the stream. |
| After 12 | A Level results + applications | UK / US / India / elsewhere | UCAS is a first-class path. Indian UG needs AIU equivalence **and** the entrance test. |

**After-IGCSE fork (the parent-facing card set)**

| Path | Typical next two years | Choose this when | Then sit |
|------|------------------------|------------------|----------|
| Stay Cambridge | AS → A Level (3–4 subjects) | Abroad, or India with eyes open on calendar and subjects | UCAS, SAT optional, JEE/NEET/CUET/state CET if subjects match |
| Switch to IBDP | IB Diploma | School offers DP and the family wants breadth + EE/TOK | Same Indian + abroad set as IB |
| Switch to CBSE 11–12 | PCM / PCB / Commerce / Arts | Family wants JEE/NEET coaching alignment | Same as CBSE senior |
| Switch to ISC 11–12 | Science / Commerce / Arts | English-heavy Indian board | Same as ICSE senior |
| Switch to state 11–12 | Intermediate / PUC / HSC | Rare; usually a domicile + state-college plan | That state’s CET |

**Subject sets (how Cambridge encodes streams)**

| Intent (`stream_id`) | A Level set that Indian colleges look for | Do not do |
|----------------------|-------------------------------------------|-----------|
| `pcm` engineering | Physics, Chemistry, Mathematics | Maths + Economics + Business and hope for JEE |
| `pcb` medicine | Physics, Chemistry, Biology | Biology without Chemistry |
| `pcmb` both | All four — possible, very heavy with A Level depth | Treat as default |
| `commerce` | Accounting, Business, Economics ± Maths | Assume CA Foundation without 12th-equivalent |
| `arts` | History, Psychology, English Lit, a language, etc. | |

Further Maths is an extra, not a replacement for Physics.

**Exam series — a What next card of its own**

| Series | Results roughly | Use for |
|--------|-----------------|---------|
| **March** (India) | May | Indian 11th admission after IGCSE; Indian UG after A Level |
| June | August | UK UCAS (fits); many Indian counselling rounds are already moving |
| November | January | Catch-up / retake; usually not the main Indian sitting |

June A Level + JEE Main in April is a known collision. Spell it on the
senior-year card.

App mapping: `IGCSE` is the only Cambridge `curricula.code` today. A Level
is a pathway after IGCSE, not a child-profile value. Years 1–11 are seeded;
treat Y12–Y13 as the A Level senior stage in this catalogue.

### 9.3 ICSE (CISCE)

| Stage | What next | In one line |
|-------|-----------|-------------|
| Foundation–Middle | Stay ICSE | Strong English + project work; olympiads optional. |
| Board 10 | ICSE Class 10 | CISCE exam. Result feeds ISC stream choice or a board switch. |
| After 10 | **The ICSE fork** | ISC Class 11–12 in Science / Commerce / Arts; or switch to CBSE, IBDP, A Level. |
| Senior | ISC Class 12 | Same Indian entrance landscape as CBSE, with different internal assessment style. |
| After 12 | Same college map as CBSE | JEE, NEET, CUET, CLAT, design, professional courses, abroad. |

ISC Science still splits as PCM vs PCB in practice. Commerce and Arts
mirror CBSE naming more closely than Cambridge does.

ICSE Class 10 is Class 10 equivalent. **ISC Class 12** is Class 12
equivalent, so ISC students unlock the same national and state CETs as
CBSE 12. There is no extra ICSE-only competitive exam. State overlay
follows the CBSE pattern in §11 (EAPCET/KCET/TNEA on top of ISC), not
the Cambridge/IB qualification gate.

### 9.4 SSC (Telangana / Andhra) — seeded state board

| Stage | What next | In one line |
|-------|-----------|-------------|
| Foundation–Middle | Stay on state syllabus | Local language medium is common; olympiads less central than in CBSE schools. |
| Board 10 | TS/AP SSC | State Class 10 public exam. |
| After 10 | **The SSC fork** | **Intermediate (MPC / BiPC / MEC / CEC / HEC)** at a junior college; **POLYCET** into polytechnic; or switch to CBSE/ISC/IB/Cambridge. |
| Senior | Intermediate 1st year + 2nd year | This is the state Class 11–12. The school app grade list currently stops at SSC G10 — Intermediate is the pathway, not a current `curriculum_grades` row. |
| After 12 | State + national UG | TG EAPCET / AP EAPCET for state engineering–agriculture–pharmacy; NEET for medicine; JEE if they sit it; CUET for central universities. |

**Intermediate streams (the local names parents use)**

| Local name | Rough equivalent | Opens |
|------------|------------------|-------|
| MPC | PCM | Engineering (TG/AP EAPCET, JEE), architecture, sciences |
| BiPC | PCB | NEET, agriculture/pharmacy via EAPCET AP stream, life sciences |
| MEC | Commerce + Maths | B.Com, CA, BBA, some economics |
| CEC | Commerce without heavy maths | B.Com, BBA, general UG |
| HEC | Humanities | Arts, law, general UG |

POLYCET after SSC 10th is the vocational fork: diploma engineering, then
optional ECET lateral entry into B.Tech later.

### 9.5 IB

IB is three programmes in one family. The child’s `curricula.code`
(`IB_PYP`, `IB_MYP`, `IBDP`) picks the current programme; What next always
shows the **next** programme and the switch-out options.

| Stage | IB programme | App code | What next | In one line |
|-------|--------------|----------|-----------|-------------|
| Foundation | **PYP** (K–G5) | `IB_PYP` | PYP exhibition → **MYP**, or switch to CBSE/IGCSE/state around G6 | Inquiry, not a board exam. |
| Middle | **MYP** G6–G8 | `IB_MYP` | Stay MYP; Personal Project is later | Optional eAssessment in some schools. |
| Board 10 | **MYP** G9–G10 | `IB_MYP` | End of MYP; AIU treats completed MYP as **Class 10** equivalent | Not Class 12. Cannot skip DP and apply to Indian UG on MYP alone. |
| After MYP | **The IB fork** | — | See table below | Same shape as the Cambridge after-IGCSE fork. |
| Senior | **DP** G11–G12 | `IBDP` | Six subjects + TOK, EE, CAS | Indian universities expect **3 HL + 3 SL** and ≥24 points (Diploma or Courses/Certificate). |
| After DP | Results 6 July (May session) | `IBDP` | India and abroad | Predicted grades for early applications. Indian transcript with percentage conversion is requested via the DP coordinator. |

**After-MYP fork**

| Path | Typical next two years | Choose this when | Then sit |
|------|------------------------|------------------|----------|
| Stay IB | **Diploma Programme** | Default in IB schools; strongest abroad | UCAS, Common App, JEE/NEET/CUET/state CET if HL subjects match |
| IBCP | Career-related Programme | Vocational / applied; rare in v1 Hyderabad | Check Indian university recognition per course — weaker than DP |
| Switch to A Level | 3–4 A Levels | School offers Cambridge senior | Same as Cambridge senior |
| Switch to CBSE 11–12 | PCM / PCB / Commerce / Arts | JEE/NEET coaching alignment | Same as CBSE senior |
| Switch to ISC 11–12 | Science / Commerce / Arts | Indian board, English-heavy | Same as ICSE senior |
| Switch to state 11–12 | Intermediate / PUC / HSC | Rare | That state’s CET |

**DP subject groups (how IB encodes streams)**

Six subjects, one from each group (group 6 can be a second science or
humanity). Three at Higher Level, three at Standard Level.

| Intent (`stream_id`) | Typical HL set | Also needed |
|----------------------|----------------|-------------|
| `pcm` engineering | Physics HL, Chemistry HL, Maths **AA HL** (or AI HL only if the college accepts it — many Indian engineering seats want AA) | English as a group 1/2 subject |
| `pcb` medicine | Biology HL, Chemistry HL, Physics HL or Maths | NEET still mandatory |
| `pcmb` both | Four sciences/maths by dropping arts — possible, brutal with EE/TOK | Do not present as default |
| `commerce` | Economics HL, Maths SL/HL, a language | CUET / IPMAT / CA after 12th-equivalent |
| `arts` | History / Psychology / Global Politics HL, languages, arts | CLAT, CUET humanities, design |

TOK, EE, and CAS are core, not optional electives. They do not replace a
missing HL science.

**Calendar — a What next card of its own**

| Session | Written exams | Results | Collision |
|---------|---------------|---------|-----------|
| **May** (usual in India) | Late April–May | **6 July** | JEE Main (Jan/Apr), JEE Advanced (May/June), NEET (May), many state CETs, CUET. Indian counselling often wants a mark sheet before July. |
| November | October–November | January | Southern-hemisphere / retake; uncommon as the main India sitting |

India applications in the DP year use **predicted grades** plus the IB
percentage-conversion transcript after results. Say that on the card.
Do not imply predicted grades are a substitute for NEET or JEE.

App mapping: personalise to the child’s programme code; always offer the
other two programmes as What next inside the IB family.

### 9.6 Other state boards — after-10 names

Same fork as SSC, different local words. Use these titles when
`board_family = STATE` and the matching `state_code` is selected. Stream
ids stay `pcm` / `pcb` / `commerce` / `arts`.

| State | Class 10 | After-10 default | Class 12 | Local science names |
|-------|----------|------------------|----------|---------------------|
| Telangana, Andhra Pradesh | SSC | Intermediate at junior college | Inter 2nd year | MPC, BiPC |
| Karnataka | SSLC | PUC (1st & 2nd year) | 2nd PUC | PCMC, PCMB, PCME |
| Tamil Nadu | SSLC | HSC / Plus Two | HSC | Maths-Biology / Maths-Computer groups |
| Kerala | SSLC | Plus Two (HSE / VHSE) | Plus Two | Science, Commerce, Humanities |
| Maharashtra | SSC | FYJC → SYJC | HSC | Science, Commerce, Arts |
| Gujarat | SSC | HSC | HSC | A (science), B (commerce) groups |
| West Bengal | Madhyamik | HS (WBCHSE) | HS | Science, Commerce, Arts |
| Odisha | Matric (BSE) | CHSE +2 | CHSE | Science, Commerce, Arts |
| Uttar Pradesh | UP Board 10 | Intermediate | Intermediate | Science, Commerce, Arts |
| Bihar, Jharkhand | Matric | Intermediate | Intermediate | Same split |
| Rajasthan, MP, CG | Board 10 | Senior secondary / HSSC | 12th | Same split |
| Delhi | Usually CBSE 10 | Usually CBSE 11–12 | CBSE 12 | PCM / PCB; DBSE exists but is rare in v1 |
| Punjab, Haryana, HP, Uttarakhand | State 10 or CBSE | 10+2 | 12th | Same split |
| Assam | SEBA HSLC | AHSEC HS | HS | Science, Commerce, Arts |
| Goa | SSC | HSSC | HSSC | Science, Commerce, Arts |
| J&K / Ladakh | JKBOSE 10 | 12th | 12th | Same split |

Every row also has the national-board switch: stay on state 11–12, or move
to CBSE / ISC / IBDP / A Level.

POLYTECHNIC after 10th exists in most states (POLYCET, DCET, state diploma
CET). Treat as `vocational`.

---

## 10. Catalogue — Opportunities

v1 is a short, high-signal list. Coaching brands, 40-name “exam dumps”,
and paid SOF-style contests as if they were national selection exams are
out of scope. Scholarships beyond the inactive NTSE/KVPY rows are **out
of v1** (`kind` allows `scholarship` later; do not invent a grant list
now).

**Inactive (show, do not promote)**

| Name | Status | Why it stays in the catalogue |
|------|--------|-------------------------------|
| NTSE | Paused since the 2021 cycle; no live 2025–26 exam | Parents still search for it. Label **inactive**. |
| KVPY | Discontinued | Same. Do not list as a current science route. |

### 10.1 Shared national exams (attach to every board family and every state)

These are one catalogue row each, with board-specific subject notes.

| Opportunity | Kind | Streams | When to look | What it opens |
|-------------|------|---------|--------------|---------------|
| **JEE Main** | exam | pcm, pcmb | G11–G12 / A Level / DP | NITs, IIITs, GFTIs, and the gate to JEE Advanced. Also B.Arch / B.Plan papers. |
| **JEE Advanced** | exam | pcm, pcmb | After qualifying Main | IITs. Class 12 (or equivalent) must include Physics, Chemistry, Maths. Cambridge A Level and IB Diploma are listed as equivalent qualifications. |
| **NEET UG** | exam | pcb, pcmb | G11–G12 / A Level / DP | MBBS, BDS, AYUSH. Mandatory for medicine even in Telangana/AP. EAPCET is not the medical exam. |
| **CUET UG** | exam | all | G12 year | Central and many participating universities. CUET bulletin lists GCE A Level and IB Diploma as Class 12 equivalents. |
| **BITSAT** | exam | pcm, pcmb | G12 year | BITS campuses. |
| **NATA** | exam | pcm, arts | G12 year | B.Arch (with JEE Main Paper 2 as the other common path). |
| **CLAT** | exam | arts, commerce, all | G12 year | NLUs for five-year law. |
| **AILET** | exam | arts, commerce, all | G12 year | NLU Delhi. |
| **IPMAT / JIPMAT** | exam | commerce, arts, pcm | G12 year | Integrated IIM programmes. |
| **NID DAT / NIFT / UCEED** | exam | arts, all | G12 year | Design. |
| **NDA & NA** | exam | pcm (for Navy/Air Force), all (Army) | During / after G12 | NDA. Age and subject rules are strict. |
| **CA Foundation** | exam | commerce | After 12th (register earlier) | Chartered accountancy first gate. |
| **CSEET** | exam | commerce | After 12th | Company Secretary path. |
| **SAT / ACT** | exam | all | G11–G12 | US and some other overseas UG. Optional for many US colleges; still used. |
| **IELTS / TOEFL** | exam | all | G12 / after | English proficiency for overseas UG. |

**Olympiads (middle + board_10, all families)**

| Opportunity | Kind | Notes |
|-------------|------|-------|
| **IOQM → INMO** (HBCSE maths) | olympiad | The national maths olympiad pathway. Not a commercial school olympiad. |
| **NSEP / NSEC / NSEB / NSEA** | olympiad | Physics, chemistry, biology, astronomy → Indian olympiad programme. |
| School olympiads (SOF and similar) | olympiad | Optional practice contests. Must be labelled **school-level / commercial**, never as IIT/NEET selection. |

### 10.2 CBSE-specific notes

- Class 10 and 12 board exams are the academic spine; competitive exams sit
  *beside* them, not instead of them.
- Most Indian coaching calendars assume CBSE PCM/PCB. That is why other
  boards feel pressure to “switch to CBSE in 11th”.
- Practicals and internal assessment matter for the board mark; they do not
  replace JEE/NEET.

### 10.3 Cambridge-specific opportunities

These cards have `board_families = ["CAMBRIDGE"]`. They **add to** national
and state cards; they do not replace TG EAPCET or JEE.

| Opportunity | Kind | When | What it is |
|-------------|------|------|------------|
| **March series** | admission_route | IGCSE and A Level years | The India sitting. What next should push this if Indian UG or Indian 11th is in play. |
| **UCAS** | admission_route | A Level year | UK undergraduate. First-class for this family, not a footnote. |
| **SAT / ACT** | exam | AS / A Level | US and some other overseas. Optional at many US colleges. |
| **IELTS / TOEFL** | exam | A Level / after | Often needed for UK/US even with A Level English. |
| **JEE / NEET / CUET / state CET** | exam | A Level year | Same papers as CBSE. Eligibility is A Level (Class 12 equivalent) with the right subjects — **not IGCSE**. |
| **AIU equivalence** | admission_route | After A Level | Needed by some Indian universities. Cambridge IGCSE ≠ this. |

- JEE/NEET beside A Levels is possible and heavy. Say so.
- Do not list “Cambridge board exam” as an Indian competitive exam.
- Checkpoint and IGCSE are not Opportunities; they are What next stages.

### 10.4 ICSE-specific notes

- Same national exam set as CBSE.
- English-heavy ICSE background often pairs with CLAT, humanities CUET, and
  writing-led courses — still an opportunity, not a prescription.

### 10.5 State exams are not SSC-only — and not CBSE-only either

TG EAPCET, KCET, MHT-CET and the rest attach to the **state**, with
`board_families` including CBSE, ICSE, **Cambridge**, **IB**, and STATE.
A Cambridge A Level or IB DP student in Hyderabad still sees TG EAPCET,
with a subject and calendar note. IGCSE-only or MYP-only students do
**not** — they are still Class 10 equivalent. Full split is §11, including
§11.8–§11.9.

### 10.6 IB-specific opportunities

These cards have `board_families = ["IB"]`. They add to national and state
cards; they do not replace JEE or TG EAPCET.

| Opportunity | Kind | When | What it is |
|-------------|------|------|------------|
| **Predicted grades** | admission_route | DP Year 2 | Used for UCAS and many Indian provisional offers. Not a substitute for JEE/NEET. |
| **IB Indian transcript** | admission_route | After May/Nov results | Percentage conversion for Indian universities, requested by the DP coordinator on IBIS. |
| **UCAS / Common App** | admission_route | DP year | First-class abroad paths for this family. |
| **SAT / ACT** | exam | DP | US; often optional. |
| **IELTS / TOEFL** | exam | DP / after | Some universities still want a proficiency test. |
| **JEE / NEET / CUET / state CET** | exam | DP year | Same papers as CBSE. Eligibility is **DP** (or Courses with 24 points, 3 HL + 3 SL) with the right HL subjects — **not MYP**. |
| **AIU equivalence** | admission_route | After DP | Diploma or Courses/Certificate at the 24-point / 3+3 rule. MYP is Class 10 only. |

- May DP exams overlap JEE, NEET, CUET, and most state CETs. Spell the
  clash on the DP senior card.
- The **IB Diploma** remains a `what_next` pathway in §9.5. Do not clone
  it into Opportunities.
- IBCP is a pathway, not an exam; Indian recognition is narrower than DP.
- TOK / EE / CAS are not Opportunities.

---

## 11. Catalogue — State-wise split

This is the state layer. It applies on **top of any board**. Preview
default is Telangana (current product geography). Every other state is
browsable in admin from day one.

How to read a row:

- **After 10** is What next for `STATE` family in that state.
- **CBSE / ICSE** children use their board’s after-10 fork, *plus* these
  CETs if they want state colleges.
- **Cambridge / IB** children use §9.2 / §9.5 forks. State CETs appear
  only from **A Level / DP** onward, with the subject and calendar notes
  in §11.8–§11.9. IGCSE and MYP are Class 10 equivalent — they do not
  unlock EAPCET, KCET, TNEA, or Indian UG.
- **Engineering** is the government B.E./B.Tech route. Pattern is in
  parentheses.
- **Medicine** is always NEET; the cell is the counselling body for state
  quota. MCC handles 15% All-India quota in every state.
- **Also** is polytechnic, law, agriculture, private extra papers.

### 11.1 South

| State | Code | After 10 (state board) | Engineering | Medicine counselling | Also |
|-------|------|------------------------|-------------|----------------------|------|
| **Telangana** | `TG` | Intermediate (MPC, BiPC, MEC, CEC, HEC) | **TG EAPCET** (own CET). Parents still say EAMCET / TS EAMCET. E stream = MPC; AP stream = BiPC. **Not medicine.** | NEET + TG medical/AYUSH counselling | POLYCET after 10th; ECET lateral entry; TG LAWCET; TG ICET (MBA, after UG); JEE optional beside MPC |
| **Andhra Pradesh** | `AP` | Intermediate (same local names) | **AP EAPCET** (own CET) | NEET + AP counselling | AP POLYCET; AP ECET; AP LAWCET; AP ICET |
| **Karnataka** | `KA` | PUC (PCMC, PCMB, PCME, Commerce, Arts) | **KCET** (own CET) for government / aided. **COMEDK UGET** for many private unaided colleges | NEET + KEA | DCET (diploma); NATA; KCET also covers farm / pharmacy seats — still not MBBS |
| **Tamil Nadu** | `TN` | HSC / Plus Two | **TNEA** (Class 12 merit, **no engineering CET**) | NEET + TN medical counselling | Polytechnic via 10th marks / separate diploma counselling. JEE still useful for NITs and other states |
| **Kerala** | `KL` | Plus Two (HSE / VHSE) | **KEAM** (own CET; rank is ~50% KEAM + 50% Class 12 PCM) | NEET; CEE Kerala runs medical & allied allotment | Architecture via NATA + KEAM rules; KEAM is not NEET |

### 11.2 West

| State | Code | After 10 | Engineering | Medicine counselling | Also |
|-------|------|----------|-------------|----------------------|------|
| **Maharashtra** | `MH` | FYJC → HSC (Science / Commerce / Arts) | **MHT-CET** (own CET, PCM and PCB papers) | NEET + state CET cell | MHT-CET also pharmacy/agriculture-related seats; MH LAW CET; JEE used for some All-India seats in CAP |
| **Gujarat** | `GJ` | HSC (Group A science, B commerce) | **GUJCET** + ACPC counselling (own CET) | NEET | Diploma after 10th via state TEC; JEE still for NITs |
| **Goa** | `GA` | HSSC | **JEE Main counselling** (no separate BE CET in current cycle) | NEET | GCET may still appear in older parent talk — label against the current brochure |
| **Dadra & Nagar Haveli and Daman & Diu** | `DN` | Usually Gujarat/CBSE pattern | JEE Main / neighbouring-state rules | NEET | Thin v1; show national exams + “check UT counselling” |

### 11.3 North and NCR

| State / UT | Code | After 10 | Engineering | Medicine counselling | Also |
|------------|------|----------|-------------|----------------------|------|
| **Delhi** | `DL` | Usually CBSE 11–12 | **JAC Delhi** on JEE Main (DTU, NSUT, IGDTUW, IIIT-D, DSEU). IPU has its own JEE-based counselling | NEET + DU/IPU/state counselling | No classic SSC→Intermediate fork. Home state / Delhi region rules matter |
| **Chandigarh** | `CH` | CBSE / PSEB | **JAC Chandigarh** on JEE Main | NEET | |
| **Haryana** | `HR` | 10+2 (HBSE or CBSE) | **HSTES** on JEE Main | NEET | LEET for diploma lateral entry |
| **Punjab** | `PB` | 10+2 (PSEB or CBSE) | State counselling largely on JEE Main / 12th (confirm PTU/PSTE brochure yearly) | NEET | |
| **Uttar Pradesh** | `UP` | Intermediate (UP Board) or CBSE/ISC | **UPTAC** on JEE Main (no UPSEE) | NEET | CUET for many state universities; polytechnic via JEECUP after 10th |
| **Rajasthan** | `RJ` | RBSE senior secondary or CBSE | **REAP** on JEE Main and/or Class 12 | NEET | |
| **Himachal Pradesh** | `HP` | 10+2 | **HPCET** (own CET) and/or JEE — brochure splits courses | NEET | |
| **Uttarakhand** | `UK` | 10+2 | State counselling on JEE Main + Class 12 | NEET | |
| **Jammu & Kashmir** | `JK` | JKBOSE 12 or CBSE | **JKCET** (own CET, BOPEE) | NEET | |
| **Ladakh** | `LA` | CBSE-heavy | JEE Main; some seats via JK/central schemes | NEET | Thin v1 |

### 11.4 Central and east

| State | Code | After 10 | Engineering | Medicine counselling | Also |
|-------|------|----------|-------------|----------------------|------|
| **Madhya Pradesh** | `MP` | HSSC or CBSE | DTE MP counselling on **JEE Main** (+ 12th in some rules) | NEET | |
| **Chhattisgarh** | `CG` | 10+2 | **CG PET** (own CET) | NEET | |
| **Bihar** | `BR` | Intermediate (BSEB) | **UGEAC** on JEE Main; **BCECE** still used for some professional courses | NEET | Polytechnic via BCECE (diploma) |
| **Jharkhand** | `JH` | Intermediate (JAC) | JCECEB counselling on **JEE Main** | NEET | |
| **Odisha** | `OD` | CHSE +2 | **JEE Main** for most B.Tech; **OJEE** / special OJEE for leftover and other courses | NEET | |
| **West Bengal** | `WB` | HS (WBCHSE) | **WBJEE** (own CET); JEE Main also used in some colleges | NEET | JELET lateral entry |

### 11.5 North-east and islands

| State / UT | Code | After 10 | Engineering | Medicine counselling | Also |
|------------|------|----------|-------------|----------------------|------|
| **Assam** | `AS` | AHSEC HS | **Assam CEE** (own CET) for government engineering | NEET | |
| **Arunachal, Nagaland, Manipur, Meghalaya, Mizoram, Tripura, Sikkim** | `AR` `NL` `MN` `ML` `MZ` `TR` `SK` | State 12 / CBSE | Mostly **NERIST NEE** and/or JEE Main; Mizoram has had MZUEEE | NEET | One shared “North-east” card plus per-state footnotes is enough in v1 |
| **Puducherry** | `PY` | HSC / CBSE | **CENTAC** (often JEE / 12th mix) | NEET | |
| **Andaman & Nicobar, Lakshadweep** | `AN` `LD` | CBSE-heavy | JEE Main; central / island quota | NEET | Thin v1 |

### 11.6 What every state card must say

1. **National exams still apply.** JEE, NEET, CUET, CLAT do not disappear
   when a state is selected; they sit in a National group above the state
   group.
2. **Own CET ≠ medicine.** If the state has an EAPCET/CET, the card title
   is engineering / agriculture / pharmacy, never MBBS.
3. **Also known as.** Keep parent nicknames (EAMCET, TS EAMCET, MHCET,
   TNEA “counselling only”) on the card.
4. **Domicile one-liner.** “State quota usually needs local eligibility.
   Check this year’s brochure.”
5. **Last reviewed.** State CET names change (EAMCET → EAPCET, UPSEE →
   UPTAC). Stale names are the main failure mode.
6. **International boards.** If the selected family is Cambridge or IB,
   keep UCAS / March series / DP transcript in view. Do not replace them
   with Intermediate/PUC copy. State CET cards get a one-line “needs
   A Level / DP with PCM or PCB subjects; IGCSE / MYP is not enough.”

### 11.7 Depth for admin v1

| Depth | States | Why |
|-------|--------|-----|
| Full cards (What next + exams + aliases + official URLs) | `TG`, `AP` | Seeded SSC, live Hyderabad users |
| Full cards | `KA`, `TN`, `KL`, `MH` | Next likely cities and the distinct patterns (PUC, TNEA merit, KEAM 50-50, MHT-CET) |
| Compact cards (table row + 1–2 exam cards) | Remaining states in §11.3–11.5 | Browseable, not empty |
| Thin | Island UTs, Ladakh | National exams + “confirm UT counselling” |

Do not wait for every state to be “full” before building the admin
preview. Empty states are worse than compact rows.

Cambridge × TG/KA/MH/TN and IB × TG/KA/MH/TN are **full** preview cases
even when other states stay compact. International-school density is
exactly those cities.

### 11.8 Cambridge × Indian states

Cambridge What next (§9.2) does **not** change by state. State only adds
or hides CET / counselling cards, plus a calendar and equivalence note.

**Qualification gate (every state)**

| Cambridge stage | Indian equivalent | State CET / Indian UG |
|-----------------|-------------------|------------------------|
| Primary / Lower Secondary | Below 10 | No |
| IGCSE | Class 10 | No (except diploma/polytechnic routes that take 10th) |
| AS Level only | Usually not treated as Class 12 | Do not present as enough |
| **A Level** (typically 3+ subjects) | Class 12 | Yes, if the subject set matches the course |

**Subject gate:** engineering needs A Level Physics, Chemistry, Maths;
medicine needs Physics, Chemistry, Biology **and NEET**. State CET
syllabus is still the Indian 11–12 PCM/PCB syllabus — families pairing
A Level with EAPCET/KCET/MHT-CET are sitting two different exams.

**What a Cambridge parent sees by state** (on top of UCAS / March series /
JEE / NEET / CUET):

| State | Extra opportunities | Notes that must sit on the card |
|-------|---------------------|----------------------------------|
| Telangana | TG EAPCET, POLYCET (after IGCSE if they want diploma) | EAPCET needs 10+2 *equivalent* recognised by BIE. A Level with PCM/PCB. June series is late for counselling. Local / non-local still applies. **Not medicine.** |
| Andhra Pradesh | AP EAPCET, AP POLYCET | Same pattern as TG. |
| Karnataka | KCET, COMEDK | KCET also has **Karnataka study / domicile** rules (often years of study in the state). An Oakridge/Greenwood IGCSE child who actually studied in KA may qualify; a child who just moved may not. COMEDK is the usual private-college overlay. |
| Tamil Nadu | TNEA | TNEA ranks **Class 12 marks**. A Level → TN equivalent marks is messy; many Cambridge families use **JEE** for engineering instead of fighting conversion. Say both options. |
| Kerala | KEAM | Rank mixes KEAM paper and Class 12 PCM. Need a usable percentage conversion from A Level. Calendar vs June series is painful. |
| Maharashtra | MHT-CET | Brochure says HSC **or equivalent**. A Level with PCM/PCB typically fits. All-India candidature can lean on JEE; Maharashtra candidature usually must sit MHT-CET. |
| Delhi / UP / Haryana / Rajasthan / most JEE-counselling states | JAC / UPTAC / HSTES / REAP | Often **easier** for Cambridge: JEE Main is the paper, A Level is the qualifying exam. Prefer this over inventing a state CET. |
| Gujarat, West Bengal, etc. | GUJCET, WBJEE, … | Same rule: A Level + right subjects + that CET. Compact card is enough. |

**Phone preview check:** `Cambridge · Telangana · After IGCSE` must show
the A Level / IBDP / CBSE 11–12 fork **and** UCAS as later, **not**
“choose MPC in Intermediate”. `Cambridge · Telangana · A Level · PCM`
must show JEE + TG EAPCET + UCAS together.

### 11.9 IB × Indian states

IB What next (§9.5) does **not** change by state. State adds CET cards
from **DP** onward.

**Qualification gate (every state)**

| IB programme | Indian equivalent | State CET / Indian UG |
|--------------|-------------------|------------------------|
| PYP | Primary | No |
| MYP | Class 10 | No (except 10th-level diploma routes) |
| IBCP | Case-by-case | Do not treat as DP. Link the university’s own IBCP list. |
| **DP** (3 HL + 3 SL, ≥24 points) | Class 12 | Yes, with the right HL subjects |
| IB Courses/Certificate at the same 24 / 3+3 rule | Class 12 (AIU 2016) | Same, but some colleges still ask for the full Diploma — say “confirm with the college” |

**Subject gate:** engineering → HL Physics, Chemistry, Maths (AA HL is
the safe Indian default). Medicine → HL Biology, Chemistry, usually
Physics, **and NEET**.

**Calendar gate:** May DP written exams collide with JEE Advanced, NEET,
and most state CETs. Results on 6 July collide with many counselling
document checks. Cards must mention **predicted grades** for provisional
Indian offers and the **IB Indian transcript** after results.

**What an IB parent sees by state** (on top of UCAS / Common App /
transcript / JEE / NEET / CUET):

| State | Extra opportunities | Notes that must sit on the card |
|-------|---------------------|----------------------------------|
| Telangana | TG EAPCET | DP with PCM/PCB HLs. Predicted grades vs EAPCET counselling dates. Local / non-local. **Not medicine.** |
| Andhra Pradesh | AP EAPCET | Same as TG. |
| Karnataka | KCET, COMEDK | Same Karnataka-study rules as Cambridge. Several Bengaluru IB schools (Indus, Canadian, etc.) — this is a real preview case. |
| Tamil Nadu | TNEA | Percentage conversion from IB grades into TNEA merit is the pain point; JEE is the cleaner engineering overlay. |
| Kerala | KEAM | 50% Class 12 marks in the rank → need IB percentage conversion. |
| Maharashtra | MHT-CET | HSC or equivalent; DP typically fits. Maharashtra candidature vs All-India + JEE, same as Cambridge. |
| Delhi / UP / Haryana / Rajasthan / JEE-counselling states | JAC / UPTAC / … | JEE Main + DP as qualifying exam. Often the least friction Indian-state path for IB. |

**Phone preview check:** `IB · MYP · Telangana · G10` shows the DP / CP /
CBSE 11–12 fork, **not** Intermediate streams, and does **not** surface
EAPCET as if MYP were Class 12. `IB · DP · Telangana · PCM` shows JEE +
TG EAPCET + UCAS + the May-exam clash.

### 11.10 ICSE × Indian states

ICSE/ISC is an Indian board. There is no extra qualification gate.

- ICSE 10 = Class 10. State CETs and Indian UG stay dimmed / after-10.
- ISC 11–12 = Class 12. Same CET stack as CBSE in that state (TG EAPCET,
  KCET, TNEA, MHT-CET, JEE counselling, …).
- No ICSE-only entrance exam. Do not write a parallel of §11.8.

---

## 12. What this is not

| Not this | Why |
|----------|-----|
| A new circle | Membership is already derived from curriculum + grade. |
| A topic | Topics label posts. This is a catalogue. |
| Coaching marketplace | Discover already lists coaching. Link later; do not duplicate. |
| Rank predictor / cut-off tool | Yearly, litigious, and wrong without live data. |
| Career-quiz or psychometric test | Out of v1. Orientation, not assessment. |
| Per-school “our students went to X” | That belongs on school profiles if ever, with evidence. |
| Live application tracker | Official sites remain the source for dates and fees. |
| Advice to switch boards | We describe the fork; we do not push CBSE-for-JEE. |
| Domicile / reservation calculator | State quota rules are political and yearly. One-liner + brochure link only. |

---

## 13. Admin-first: how we will test this

Mobile screens are deferred on purpose. The first build is an internal
admin page that lets us **author, filter, and preview** the catalogue the
way a parent would eventually browse it.

### 13.1 Surface

```text
apps/web/public/internal/admin/pathways.html
```

Add a **Pathways** link to the existing admin nav on every
`/internal/admin/*.html` page, next to School compare.

Reuse `admin-auth.js` (Bearer session, 12h). No new auth.

### 13.2 Admin layout (proposed, to iterate in the page itself)

```
┌─ Admin · Pathways ──────────────────────────────────────────────┐
│ Board:  [CBSE] [Cambridge] [ICSE] [State] [IB]                  │
│ State:  [Telangana ▾]   (AP, KA, TN, KL, MH, … all India)       │
│ Stage:  [Foundation] [Middle] [Board 10] [After 10] [Senior] …  │
│ Year context: [Final Class 10-equivalent year ▾]                 │
│ Qualification: [Auto: CBSE 10 ▾] (compatible override in admin) │
│ Stream: [Undecided] [PCM] [PCB] [Commerce] [Arts] [Vocational]  │
│ Pillar: [What next] [Opportunities] [All]                       │
│                                                                 │
│ ┌─ Catalogue table ─────────────┐  ┌─ Phone preview (390px) ─┐ │
│ │ title · kind · state · status │  │ CBSE · Telangana        │ │
│ │ … editable rows               │  │ After 10 · PCM          │ │
│ └───────────────────────────────┘  │                         │ │
│                                    │  WHAT NEXT              │ │
│ Detail drawer: lead + labelled rows    │  ┌───────────────────┐  │ │
│                                    │  │ Stay in CBSE 11–12│  │ │
│                                    │  │ PCM → JEE + EAPCET│  │ │
│                                    │  └───────────────────┘  │ │
│                                    │  OPPORTUNITIES          │ │
│                                    │  National               │ │
│                                    │  ┌ JEE Main ─────────┐  │ │
│                                    │  Telangana              │ │
│                                    │  ┌ TG EAPCET ────────┐  │ │
│                                    │  │ aka EAMCET · not  │  │ │
│                                    │  │ medicine          │  │ │
│                                    │  └───────────────────┘  │ │
│                                    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

The phone frame **renders the CBSE hub in §14**. Filters change the same
shell (Grade 8 vs Grade 10 vs Grade 11 PCM, Telangana vs Karnataka).
Cambridge / IB / State keep this chrome; only the cards change. Do not
design a second mobile pattern until CBSE is signed off.

### 13.3 Admin behaviour

| Action | v1 |
|--------|----|
| Filter by board, **state**, stage, stream, pillar | Required |
| Default state **Telangana**; all other states selectable | Required |
| At Board 10, choose earlier year vs final year; final injects the `after_10` fork | Required |
| Derive qualification from family + stage (§4.1); allow compatible admin override | Required |
| Group Opportunities as National / this state | Required |
| Dim future exams at early stages (G8 JEE, IGCSE EAPCET) | Required |
| See inactive items (NTSE) dimmed | Required |
| Open item detail (lead + labelled rows, official URL, last reviewed) | Required. No markdown article. |
| Edit copy and status | Required (save to API or, for the first slice, to a local JSON file loaded by the page) |
| Preview as if the child is on that board/**state**/stage/stream | Required |
| Publish to mobile | **Forbidden** until the preview is signed off |
| Parent accounts, analytics, notifications | Out of admin v1 |

### 13.4 API sketch (admin only, later)

```text
GET  /internal/admin/pathways?family=&state=&stage=&stream=&pillar=
GET  /internal/admin/pathways/:id
PUT  /internal/admin/pathways/:id
```

Same admin auth as circles. No `/v1/` parent routes until mobile is in
scope.

First admin slice may skip the API and embed the catalogue JSON in the
page so design iteration is fast. Promote to Postgres when copy has
stabilised.

### 13.5 Acceptance for the admin slice

- CBSE + Telangana + PCM shows CBSE 11–12 What next **and** TG EAPCET
  **and** JEE. Medicine remains NEET, not EAPCET.
- Same child switched to Karnataka replaces EAPCET with KCET / COMEDK;
  JEE stays.
- Tamil Nadu engineering shows TNEA (Class 12 merit), not a fake “TN CET”.
- State board + Telangana shows Intermediate MPC/BiPC names; State board +
  Karnataka shows PUC names.
- Cambridge After-IGCSE shows A Level / IBDP / CBSE 11–12, **not**
  Intermediate MPC. UCAS is visible as a later opportunity.
- Cambridge + Telangana + A Level + PCM shows JEE **and** TG EAPCET
  **and** UCAS. IGCSE stage does **not** unlock EAPCET.
- IB PYP vs MYP vs DP shows different What next. MYP G10 does **not**
  unlock EAPCET/JEE. DP + Telangana + PCM shows JEE + EAPCET + UCAS +
  the May-exam clash.
- IB / Cambridge + Tamil Nadu engineering shows TNEA conversion caution
  and JEE as the cleaner overlay.
- ICSE is browsable in admin even before ICSE is a seeded curriculum.
- Inactive NTSE appears in Opportunities with a paused label.
- Phone preview is usable at 390×844 without horizontal scroll.
- Phone preview is **not text-heavy**: hub cards are one line; detail is
  lead + labelled rows (§14.9). A wall of prose fails sign-off.
- Nothing in this page is linked from the mobile app.

### 13.6 Canonical preview authority

There must be one implementation authority, not a folder of competing
mockups:

1. **Data and behaviour:** §4–§8 of this document.
2. **Mobile information architecture and density:** §14.
3. **Rendered reference after it exists:** the signed-off 390×844 phone
   preview in `pathways.html`.
4. Conversational HTML previews are exploratory. They may illustrate an
   interaction, but they are **not implementation sources** and must not
   be copied wholesale. In particular, any long, paragraph-heavy Diploma
   Programme preview is author research, not phone UI.

Before sign-off, the admin page must use one shared renderer for every
fixture. Do not maintain separate CBSE, IB, Cambridge, and state-board
HTML templates.

---

## 14. Mobile presentation — CBSE first

**Fork chrome (adopted):** the Class 10 → 11–12 parent screen is the
branch explorer in [`CHILDS_PATH_BRANCH_UI.md`](CHILDS_PATH_BRANCH_UI.md)
— tree of stay/switch cards, then one explore panel. IB MYP Grade 10 is
the signed visual fixture.

The rest of this section is the **light card-list** density and CBSE
worked examples (admin table preview, early/middle list behaviour).
Screens stay **scannable** (§14.9): not articles. Do not put the five-stop
strip on the same view as the branch tree.

Worked example throughout: **Aarav, CBSE, Telangana**, at three grades.

---

### 14.1 What we are not doing

| Rejected | Why |
|----------|-----|
| New bottom tab | More is already the utility hub. A sixth tab would compete with Home / Schools / Discover. |
| Two equal tabs (What next \| Opportunities) as the first screen | CBSE after-10 is a **fork**. Exams only make sense after the parent sees the stream choice. Tabs hide that. |
| A 12-year vertical timeline | Unreadable on a phone. Stage is a strip, not a biography. |
| An exam dump (JEE, NEET, CUET, EAPCET, CLAT, NDA…) | The original problem. Opportunities follow the selected stream. |
| Coaching listings | Discover already has that. Detail may later link out. |

### 14.2 Entry

One row on **More**, under the primary menu group, after My Children:

```
┌ map-outline ┐  Child's Path       ›
│             │  CBSE · Grade 10 · Telangana
```

- Label: **Child's Path**
- Subtitle: `{board} · {grade} · {state}` from the first school-age child
- Preschool-only: hide the row (no board family)
- Icon: `map-outline` (path, not a school building — Schools tab already owns that)

No Home card in v1. Grade 9+ Home prompt can wait.

### 14.3 Screen map (two screens)

```
More  →  Child's Path hub (this child’s current stage)
            ├ tap stream chip          →  Opportunities list filters in place
            ├ tap a What next card     →  Pathway detail
            └ tap an exam / route card →  Opportunity detail
```

Routes (when we build):

```text
apps/mobile/app/(app)/pathways/index.tsx     Hub (title: Child's Path)
apps/mobile/app/(app)/pathways/[slug].tsx    Detail (pathway or exam)
```

### 14.4 Hub chrome (every CBSE stage)

Vaara tokens: `colors.bg` `#FFFCF7`, cards white, teal `#0E9A8A`, navy
text, chips like Topics. Admin renders a **390×844** phone. It must also
remain usable at 320px without horizontal scrolling.

```
┌─────────────────────────────────────────┐
│ ‹  Child's Path                         │
│                                         │
│  Aarav · CBSE · Grade 10                │
│  Telangana                         ›    │  ← state, tap to change later
│                                         │
│  Early   Middle  [10]  11–12  After     │  ← stage strip, 10 current
│                                         │
│  Class 10 year. After this, pick a      │
│  stream for 11–12.                      │  ← one line. No paragraph.
└─────────────────────────────────────────┘
```

Hub density and chrome:

- Stage lead: **one sentence**.
- Each rectangle: **title + one line**. No second paragraph on the card.
- Stream chips are the decision, not a lecture under them.
- Kickers are short labels (`What next`, `Opportunities`, `Now`,
  `Coming`), not essays. **Child's Path** is only the screen title.
- Stream chips and card rows have a minimum 44pt touch target.
- A selected stream chip can be tapped again to return to `undecided`.
- Every navigable rectangle is a button with a trailing chevron. Chips
  never use chevrons.
- **Child switcher** (only if ≥2 school-age children): chips under the
  title, `Aarav` selected. Switching reloads board/grade/state.
- **State** is the pin’s state. Tappable later (“also show Karnataka”).
  v1 can be display-only.
- **Stage strip** is five stops (`foundation` `middle` `board_10`
  `senior` `after_12`). `after_10` is injected into the 10 stop per §5;
  it is not a sixth stop. Current is filled teal. In admin, all stops are
  buttons for fixture inspection. In mobile, a future stop is labelled
  **Peek** and read-only; a past stop is history. Default on open is the
  child's derived stage.

### 14.5 Example A — CBSE Grade 8 (too early for streams)

```
┌─────────────────────────────────────────┐
│ Aarav · CBSE · Grade 8 · Telangana      │
│ Early  [Middle]  10  11–12  After       │
│                                         │
│ Stream choice is still two years away.  │
│                                         │
│ WHAT NEXT                               │
│ ┌─────────────────────────────────────┐ │
│ │ Stay on CBSE                        │ │
│ │ Grade 9–10 comes next; no stream yet.│ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Later: five Class 11 streams        │ │
│ │ PCM · PCB · PCMB · Commerce · Arts. │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ OPPORTUNITIES                           │
│ Now                                     │
│ ┌ IOQM / olympiads ──────────────────┐  │
│ │ Optional. Not IIT selection.        │ │
│ └─────────────────────────────────────┘ │
│ Coming — Grade 11–12                    │
│ ┌ JEE Main ────────────── Grade 11 ─┐   │  dimmed
│ ┌ TG EAPCET ───────────── Grade 11 ─┐   │  dimmed, not medicine
│ ┌ NEET UG ─────────────── if PCB ───┐   │  dimmed
└─────────────────────────────────────────┘
```

Dimmed cards are tappable (so a curious parent can read JEE) but labelled
**Grade 11** / **if PCB**, never “apply now”.

### 14.6 Example B — CBSE Grade 10, Telangana (the fork)

This is the screen the whole feature is for.

```
┌─────────────────────────────────────────┐
│ Aarav · CBSE · Grade 10 · Telangana     │
│ Early  Middle  [10]  11–12  After       │
│                                         │
│ Class 10 year. After results, pick a    │
│ stream for CBSE 11–12.                  │
│                                         │
│ WHAT NEXT                               │
│ Stay in CBSE 11–12                      │
│ ┌──────┐┌──────┐┌──────┐                │
│ │ PCM  ││ PCB  ││ PCMB │                │  chips, one selected
│ └──────┘└──────┘└──────┘                │
│ ┌──────────┐┌──────┐                    │
│ │ Commerce ││ Arts │                    │
│ └──────────┘└──────┘                    │
│ PCM · physics + chemistry + maths       │
│                                         │
│ Other forks                             │
│ ┌ Switch board  ISC / IB / A Level  › ┐ │
│ ┌ Polytechnic   after 10th · POLYCET ›┐ │
│                                         │
│ OPPORTUNITIES  for PCM                  │
│ Now                                     │
│ ┌ Class 10 (AISSE) ──────────────────┐  │
│ │ First public exam. Feeds the stream │ │
│ └─────────────────────────────────────┘ │
│ Coming — Grade 11–12                    │
│ National                                │
│ ┌ JEE Main ──────────────────────────┐  │
│ │ NITs, IIITs · gate to JEE Advanced  │ │
│ └─────────────────────────────────────┘ │
│ ┌ JEE Advanced ── after Main ────────┐  │
│ ┌ BITSAT · NATA · NDA ───────────────┐  │
│ Telangana                               │
│ ┌ TG EAPCET ──────── aka EAMCET ─────┐  │
│ │ B.Tech / agri / pharmacy; not MBBS. │ │
│ └─────────────────────────────────────┘ │
│ Not on PCM                              │
│ ┌ NEET UG ────────── needs PCB ──────┐  │  dimmed
└─────────────────────────────────────────┘
```

**Stream chips filter Opportunities in place.** They do not navigate.

| Chip | Live (Coming) | Dimmed |
|------|----------------|--------|
| PCM (default if undecided? **No** — default **undecided** until they tap) | JEE, BITSAT, NATA, NDA, TG EAPCET (E stream) | NEET, CLAT |
| PCB | NEET, TG EAPCET (AP stream / agri-pharmacy) | JEE Advanced |
| PCMB | Both columns, with a “heavier load” line on What next | — |
| Commerce | CUET, CA Foundation, IPMAT | JEE, NEET |
| Arts | CUET, CLAT, NID/NIFT/UCEED | JEE, NEET |

If no chip is selected (`undecided`), show only `stream_ids = ["all"]`
items and a one-line “Pick a stream to see what it opens.” Do not dump
every stream-specific exam and do not pre-select PCM — that is the
coaching-centre default we are avoiding.

### 14.7 Example C — CBSE Grade 11 PCM, Telangana (entrance year)

```
┌─────────────────────────────────────────┐
│ Aarav · CBSE · Grade 11 · Telangana     │
│ Early  Middle  10  [11–12]  After       │
│ Stream: PCM                         ›   │  explicit admin fixture / stored profile
│                                         │
│ Class 12 board and entrance papers      │
│ run together.                           │
│                                         │
│ WHAT NEXT                               │
│ ┌ Class 12 (AISSCE) ─────────────── › ┐ │
│ ┌ After 12 — Indian UG / abroad ─── › ┐ │
│                                         │
│ OPPORTUNITIES                           │
│ National                                │
│ ┌ JEE Main ──────────── sittable now ┐  │  not dimmed
│ ┌ JEE Advanced · BITSAT · NATA · NDA ┐  │
│ Telangana                               │
│ ┌ TG EAPCET ────────── not medicine ─┐  │
│ Abroad (optional)                       │
│ ┌ SAT / IELTS ───────────────────────┐  │
└─────────────────────────────────────────┘
```

No “Now / Coming” split: they are in the sitting window. Admin may set
PCM explicitly. Mobile uses a stored stream only if the child profile has
one; otherwise it opens `undecided`, never PCM by default.
`last_reviewed_on` can sit as a quiet “Reviewed Mar 2026” on detail, not
on every card.

### 14.8 What a tap does

The round chips (**PCM**, **PCB**, …) stay on the hub. They only filter
the list.

Every **rectangle** is a card. Tap opens a **detail screen** — same
template for a pathway and for an exam. It does not open Discover, a
coaching listing, or an in-app browser until the parent chooses
**Official site**.

| Card on the hub | Detail is about | Official site |
|-----------------|-----------------|---------------|
| Stay on CBSE / Class 12 / After 12 | The pathway, not an exam | — |
| Switch board | ISC / IB / A Level as options | — |
| Polytechnic | Diploma after 10th | POLYCET brochure |
| Class 10 (AISSE) | The board exam | CBSE |
| JEE Main / Advanced, BITSAT, NATA, NDA | That exam | NTA / conducting body |
| TG EAPCET | State B.Tech — **not MBBS** | tgeapcet.nic.in |
| NEET UG | Medicine | NTA NEET |
| Olympiads | Optional contests, labelled commercial vs HBCSE | — |
| Dimmed “Grade 11” cards | Same detail, with **When: Grade 11**. Not apply-now. | same |

Back returns to the hub with stream and stage unchanged.

**Not on tap:** cut-offs, college ranks, coaching names, a new tab.

### 14.9 Detail screen — scan, do not read

Same chrome for a pathway and an exam. **Not an article.** Filling a “thin”
card means adding labelled rows, not paragraphs.

| Limit | Rule |
|-------|------|
| Lead | **At most two sentences.** What it is + the one trap (e.g. MYP ≠ Class 12). |
| Body | **6–10 labelled rows.** Label left, value right. No kicker-plus-paragraph blocks. |
| Extra | If a fact needs a paragraph, it does not belong here. One more row, or **Official site**. |
| Pathway vs exam | A pathway may use rows such as structure and calendar, but still stays within the 10-row total cap. |
| Anti-pattern | Dumping §9 tables onto the phone (the long Diploma Programme preview). |

Required row templates:

| Item | Required labels |
|------|-----------------|
| Every exam | `When`, `Subjects` (or `Eligibility`), `Opens`, `Not this` |
| Every pathway | `When`, `Structure` (if applicable), `Opens`, `Not this` |
| JEE Main | `Also known as`, `When`, `Subjects`, `Eligibility`, `Opens`, `Not this` (“not the IIT paper”) |
| JEE Advanced | `When`, `Requires` (JEE Main), `Subjects`, `Eligibility`, `Opens`, `Not this` |
| NEET UG | `When`, `Subjects`, `Eligibility`, `Opens`, `Counselling`, `Not this` (“EAPCET is not medicine”) |
| State CET | `Also known as`, `When`, `Subjects`, `Eligibility`, `Opens`, `Local rule`, `Not this` |
| International pathway | `When`, `Structure`, `India equivalent`, `Subject gate`, `Calendar`, `Opens`, `Not this` |

The catalogue may add rows, but the total must remain within the density
limit. Required labels are validated by `required_detail_row_labels`.
`official_url = null` hides **Official site**; it does not produce a dead
button.

Example: **JEE Main** from Grade 10 PCM.

```
┌─────────────────────────────────────────┐
│ ‹  JEE Main                             │
│ PCM · Grade 11–12 · National            │
│                                         │
│ Opens NITs, IIITs, GFTIs, and the gate  │
│ to JEE Advanced. IGCSE / MYP is not     │
│ enough.                                 │
│                                         │
│ Also known as   JEE Mains               │
│ When            Grade 11–12             │
│ Subjects        Physics, chemistry, maths│
│ Eligibility     Class 12 equivalent     │
│ Opens           NIT / IIIT / GFTI · Adv │
│ Not this        Not an IIT paper        │
│                                         │
│ [ Official site ]                       │  NTA
│ [ Ask parents in your circle ]          │
└─────────────────────────────────────────┘
```

TG EAPCET **must** include rows: aka EAMCET / TS EAMCET, and
**Not this: MBBS — medicine is NEET.**

No cut-offs, no college ranks, no coaching names, no markdown body.

### 14.10 Empty and edge states (CBSE)

| State | What the hub shows |
|-------|-------------------|
| No school-age child | More row hidden |
| CBSE + no pin / no state | National opportunities only; state group omitted, not “Telangana” guessed |
| Two CBSE children, different grades | Child chips; each hub is that child’s stage |
| One CBSE, one IB | Child chips switch **board family**, not just grade |
| Preschool sibling | Ignored by this feature |

### 14.11 Why this shell works for CBSE

1. The Grade 10 stream chips **are** What next. Opportunities hang off the
   chip. That is the CBSE parent’s actual decision.
2. National / Telangana grouping matches the state overlay without making
   EAPCET look like a CBSE board exam.
3. Dimmed-future at Grade 8 stops JEE-foundation panic without hiding the
   map.
4. Two screens (hub + detail) fit More-style navigation. No new tab.

Cambridge and IB reuse this chrome. Only the cards change. IB is §14.12.

### 14.12 IB mobile — same shell, different cards

Same More row, two screens, Telangana state, five-stop strip. The child
is IB, so the strip is **PYP · MYP · 10 · DP · After**, not CBSE grades.

**MYP Grade 10** is the IB fork (parallel to CBSE Grade 10). There are
**no PCM / PCB chips**. IB does not have named streams at this point.
What next is programme choice:

| Card | Why it is here |
|------|----------------|
| Diploma Programme | Default stay-in-IB. 3 HL + 3 SL. Unlocks Indian UG and state CETs. |
| Career-related Programme | Vocational. Weaker Indian recognition than DP. |
| Switch to CBSE 11–12 | JEE / NEET coaching alignment |
| Switch to A Level | If the school offers Cambridge senior |

Opportunities now: MYP Personal Project (Class 10 equivalent). JEE, NEET,
TG EAPCET, UCAS sit **dimmed “after DP”**. MYP is not Class 12. Do not
show Intermediate MPC/BiPC.

**DP Grade 11** is the IB entrance year. Chips are **HL intent**, not
CBSE stream names:

| Chip | Typical HL set | Live opportunities |
|------|----------------|--------------------|
| Engineering | Physics, Chemistry, Maths AA | JEE Main, TG EAPCET (not MBBS), UCAS |
| Medicine | Biology, Chemistry, Physics | NEET (mandatory), UCAS |
| Commerce | Economics, Maths | CUET, UCAS |
| Arts | Humanities HL | CUET, CLAT, UCAS |

Always on the DP hub, not behind a chip: **May exam clash** (DP written
papers collide with JEE / NEET / EAPCET), **predicted grades**, **IB
Indian transcript**.

Tap behaviour is identical to CBSE: chips filter in place, rectangles
open detail, dimmed cards still open.

**Diploma Programme detail** uses the same density as JEE — more *rows*,
not more *prose*. Author knowledge stays in §9.5.

```
┌─────────────────────────────────────────┐
│ ‹  Diploma Programme                    │
│ Stay in IB · after MYP · Telangana      │
│                                         │
│ Two-year senior programme. AIU treats   │
│ DP as Class 12. MYP is Class 10 only.   │
│                                         │
│ Also known as   IBDP                    │
│ When            After MYP · G11–12      │
│ Structure       6 subjects · 3 HL + 3 SL│
│ Core            TOK, EE, CAS            │
│ India           ≥24 points · 3+3        │
│ Engineering     Physics, Chem, Maths AA │
│ Medicine        Bio, Chem, Physics + NEET│
│ Calendar        May · 6 Jul · exam clash│
│ Opens           UCAS · Indian UG if HLs │
│ Not this        Not IBCP · MYP ≠ UG     │
│                                         │
│ [ Official site ]                       │  IBO
│ [ Ask parents in your circle ]          │
└─────────────────────────────────────────┘
```

Do not put subject-group essays, TOK/EE/CAS explainers, or session tables
on this screen. Those stay in the author catalogue.

### 14.13 Cambridge mobile contract

Same shell and two-screen navigation. Stage strip:
**Primary · Lower · IGCSE · A Level · After**.

**Final IGCSE year** has no PCM/PCB chips. What next is the programme
fork:

| Card | One-line summary |
|------|------------------|
| Stay Cambridge — A Level | Choose 3–4 subjects; this becomes the Indian course eligibility set |
| Switch to IB Diploma | Six subjects + core; Class 12 equivalent after DP |
| Switch to CBSE / ISC 11–12 | Indian streams and assessment style |
| Switch to state 11–12 | Intermediate / PUC / HSC for the selected state |

Opportunities:

- **Now:** IGCSE / March-series calendar and optional olympiads.
- **Coming after A Level:** UCAS, JEE, NEET, CUET, and the selected
  state's route. JEE/EAPCET remain dimmed because IGCSE is Class 10.
- Do not show Intermediate MPC merely because the child lives in
  Telangana.

**A Level** uses intent chips, not Indian stream labels:

| Chip | Subject set shown below it | Live groups |
|------|----------------------------|-------------|
| Engineering | Physics, Chemistry, Mathematics | National: JEE; State: EAPCET/KCET/etc.; Abroad: UCAS |
| Medicine | Physics, Chemistry, Biology | National: NEET; Abroad: UCAS |
| Commerce | Accounting, Business, Economics ± Maths | CUET / professional routes / UCAS |
| Arts | Humanities, languages, arts | CUET / CLAT / design / UCAS |

The March / June / November series is one compact calendar card. June
results being late for some Indian counselling is its `Not this` row,
not a paragraph on the hub.

### 14.14 SSC / state-board mobile contract

For the seeded `SSC` child, stage strip:
**Early · Middle · SSC 10 · Intermediate · After**. The selected state
decides Telangana vs Andhra content.

**Grade 10** uses the local after-10 choices:

| Choice | Meaning |
|--------|---------|
| MPC | Engineering / maths intent |
| BiPC | Medicine / biology intent |
| MEC | Commerce + maths |
| CEC | Commerce |
| HEC | Humanities |

No choice is preselected. These chips filter Opportunities exactly like
CBSE stream chips, but the labels remain local.

Other fork cards:

- **POLYCET / Polytechnic** — available after SSC; diploma, then optional
  ECET lateral entry.
- **Switch board** — CBSE / ISC / IBDP / A Level; orientation, not advice.

Opportunity groups:

- **National:** JEE for MPC, NEET for BiPC, CUET / professional routes
  where relevant.
- **Selected state:** TG EAPCET or AP EAPCET. Engineering appears for
  MPC; agriculture/pharmacy for BiPC. Neither is MBBS.
- **Not on this stream:** curate only the useful contrast (for example,
  NEET under MPC as “Needs BiPC”).

Intermediate is a pathway in v1, even though the seeded SSC grade list
stops at G10. Do not fabricate an SSC Grade 11 profile row.

For other state boards, the renderer swaps the strip/card labels from
§9.6 (PUC, HSC, Plus Two, FYJC/SYJC) and keeps the same interaction.

### 14.15 ICSE / ISC mobile contract

Same shell. Stage strip:
**Early · Middle · ICSE 10 · ISC 11–12 · After**.

**ICSE Grade 10** What next:

| Choice | One-line summary |
|--------|------------------|
| ISC Science — PCM | Engineering, architecture and sciences |
| ISC Science — PCB | Medicine and life sciences |
| ISC Commerce | Commerce and professional routes |
| ISC Arts | Law, humanities and design |
| Switch board | CBSE, IBDP, A Level, or selected-state senior route |

Opportunities follow the same National / selected-state grouping as
CBSE. ICSE 10 keeps JEE, NEET, and state CETs dimmed as future; ISC
11–12 unlocks them with the selected subject set. There is no ICSE-only
competitive exam.

ICSE remains admin-browsable before a real `curricula` row exists.
Mobile personalisation for an ICSE child is blocked until that seed work
is complete; do not infer ICSE from a school name.

---

## 15. Simulated walkthroughs (product intent)

These describe the *eventual* parent experience. They do not override the
layout contracts in §14; §14 and the signed-off admin preview are the UI
authority.

> **Meera, CBSE Grade 8, Koramangala.** She opens Child's Path.
> Middle-school copy says olympiads are optional and stream choice is
> still two years away. Opportunities shows IOQM and school olympiads
> (labelled commercial). JEE and KCET sit dimmed as “look in Grade 11”,
> not as papers she sits now. Because her pin is Karnataka, the dimmed
> state exam is KCET, not TG EAPCET.

> **Rajesh, IGCSE Year 10, Hyderabad.** Child's Path shows the Cambridge fork:
> A Levels (pick Physics, Chemistry, Maths if engineering is the intent),
> IBDP, or Indian 11–12. Opportunities at this stage: olympiads, and a
> dimmed “after A Levels” group — JEE, TG EAPCET, UCAS — not live papers
> he can sit this year. IGCSE is Class 10 equivalent; EAPCET is not
> unlocked yet.

> **Sita, SSC Grade 10, Hyderabad.** What next lists Intermediate MPC /
> BiPC / MEC / CEC and POLYCET. Opportunities lists TG EAPCET (aka EAMCET)
> for engineering/agriculture/pharmacy, NEET for medicine, POLYCET for
> diploma. Medicine is not filed under EAPCET.

> **Arjun, IB MYP Grade 10, Hyderabad.** What next: IBDP (default), IBCP,
> or switch to CBSE/A Level. Opportunities do **not** treat MYP as Class
> 12. JEE, NEET, TG EAPCET sit under “after DP”, with a May-exam clash
> warning. UCAS is listed as a DP-year route.

> **Leela, IB DP Year 2, PCM-shaped HLs, Hyderabad.** What next is
> applications. Opportunities: JEE, TG EAPCET (not medicine), CUET, UCAS,
> IB Indian transcript, predicted grades. The May DP vs NEET/JEE calendar
> is on the card in one sentence.

> **Nisha, CBSE Grade 11 PCM, Chennai.** What next is CBSE Class 12 +
> entrances. Opportunities: JEE for NITs/IITs; TNEA for Tamil Nadu
> engineering on Class 12 marks — no extra CET. NEET only if she had PCB.

> **Farhan, Cambridge A Level, Physics-Chemistry-Maths, Bengaluru.**
> What next is UCAS + Indian UG. Opportunities: JEE, KCET (Karnataka
> study/domicile note), COMEDK, UCAS. Not Intermediate, not PUC subject
> names.

---

## 16. Editorial rules

- India English, parent voice, short sentences.
- **Scan, do not read.** Hub card = title + one line. Detail = two-sentence
  lead + 6–10 labelled rows. No paragraphs under section kickers.
- Catalogue tables in this document are author notes. Do not paste them
  into the phone. A thin card is filled with a missing *row*, not a
  missing essay.
- Official exam names first; parent nicknames in “also known as”.
- No college rankings, no “top 10 coaching”, no guaranteed outcomes.
- No medical, legal, or immigration advice.
- Every published card has `last_reviewed_on`. Stale > 12 months is a
  review queue, not an emergency, but it must be visible in admin.
- Official URLs only (NTA, JEE Advanced, NEET, CUET, CBSE, CISCE,
  Cambridge, IBO, and the current state CET portal: tgeapcet.nic.in,
  cets.apsche.ap.gov.in, kea.kar.nic.in, tneaonline.org, cee.kerala.gov.in,
  cetcell.mahacet.org, and so on). No affiliate links.
- When unsure, omit. A missing exam is better than a wrong one.
- Prefer the **current official name** and keep the old name as an alias
  (TG EAPCET / EAMCET, UPTAC / UPSEE).

Review cadence: once per admission cycle (roughly Jan–Mar) for senior,
after-12, and **state CET** cards; yearly for earlier stages.

---

## 17. Implementation sequence

| Step | Work | Status |
|------|------|--------|
| 1 | This document, including stage, enum, query, density, and board-hub contracts | **Complete for prototype** |
| 2 | Build the canonical JSON fixture from §8: CBSE + TG first, including links and validation | Next |
| 3 | Admin page + one shared 390×844 phone renderer + board **and state** filters | After fixture |
| 4 | Iterate the **CBSE hub (§14)** in admin (G8 / G10 / G11 PCM, TG vs KA) | Design sign-off |
| 5 | Optional: persist edits via `/internal/admin/pathways` | If JSON-in-page is no longer enough |
| 6 | Validate Cambridge / IB / State / ICSE fixtures against §§14.12–14.15 | After CBSE sign-off |
| 7 | Parent API + mobile screens from the signed-off CBSE hub | After step 4 |
| 8 | Add ICSE as a real `curricula` row if we want ICSE children to personalise | Separate from this feature; not a blocker for admin preview |
| 9 | Deepen compact states to full cards as cities go live | Ongoing editorial |

No mobile work before step 4.

---

## 18. Decisions and open questions

### Decided for v1

1. Entry is **More → Child's Path** (§14.2). No Home card in v1.
   Internal pillars remain What next + Opportunities.
2. Shared exams appear once under **National** / selected state, never
   duplicated inside each board (§8.3).
3. `after_10` is a content stage injected into the final Class 10 hub,
   not a sixth mobile stop (§5).
4. `SSC` normalises to `STATE`; Intermediate remains a pathway because
   there is no seeded SSC G11–12 row (§4.1, §14.14).
5. Cambridge A Level remains a pathway / admin qualification in v1, not
   a seeded curriculum code.
6. Mobile defaults to a stored stream when one exists; otherwise
   `undecided`. It never guesses PCM.

### Resolve during admin, not before

1. Do parents see other boards as **Compare boards**, or only the child's
   family? Comparison is out of the default hub either way.
2. How far should commercial olympiads be down-ranked after they are
   clearly labelled commercial?
3. Should mobile add a separate **target state for college** override, or
   keep the profile pin plus a temporary state picker?
4. For Delhi / Chandigarh, should the picker automatically suggest
   Haryana / Punjab routes, or require an explicit state switch?
5. Should Intermediate, A Level, and ISC become real curriculum/grade
   profile rows later? This does not block the pathway catalogue.

---

## 19. Related docs

- [Business functionality](./BUSINESS_FUNCTIONALITY.md) — identity / interest / marketplace layers; this feature is orientation.
- [Database schema](./DATABASE_SCHEMA.md) — `curricula`, `curriculum_grades`.
- [Discover functionality](./DISCOVER_FUNCTIONALITY.md) — coaching marketplace; do not duplicate here.
- [Internal seed parents](./INTERNAL_SEED_PARENTS.md) — admin auth and HTML conventions under `apps/web/public/internal/admin/`.
