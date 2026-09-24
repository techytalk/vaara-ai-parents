# Child's Path — exploration tree (DB-backed thread UI)

**Status:** design spec — document before build.  
**Audience:** product, editorial, backend, mobile.

This describes the **expandable thread** navigation parents asked for (e.g.
IB MYP Grade 9 → next year → after Grade 10 → IB DP → Subjects →
Mathematics), stored in **Postgres**, not as hard-coded React screens.

**Parent screen:** this thread **replaces** the three branch cards. Parents see one Child's Path: location row, expandable thread, breadcrumb, ask and read. Do not ship both on the same screen.

| Layer | Doc |
|-------|-----|
| **Parent layout (this is the UI)** | This file |
| Branch cards (shipped earlier; **retired for parents**) | [`CHILDS_PATH_BRANCH_UI.md`](CHILDS_PATH_BRANCH_UI.md) — history only |
| Identity, circles, eligibility, errors | [`CHILDS_PATH_FUNCTIONAL.md`](CHILDS_PATH_FUNCTIONAL.md) |
| Exam facts, streams, editorial catalogue | [`WHAT_NEXT_AND_OPPORTUNITIES.md`](WHAT_NEXT_AND_OPPORTUNITIES.md) |
| Official bulletin check | [`CHILDS_PATH_OFFICIAL_REVIEW.md`](CHILDS_PATH_OFFICIAL_REVIEW.md) |

---

## 1. What we are building

### 1.1 Parent experience

One **vertical thread** on Child's Path. Each row is a node. Tapping a row
**expands** it inline (accordion). Only **one primary expansion path** is
emphasised at a time; ancestors stay visible as a **breadcrumb trail** and
collapsed summary rows.

Parents can at **any expanded node**:

- Read child rows (deeper topics)
- **Read parent discussions** — a list of **links** to messages already posted
  in the parent’s **curriculum circle**. Tap opens that circle thread. Path
  does not copy the message body.
- **Ask parents anonymously** — composer posts into that same curriculum
  circle, then stores the new `circle_messages.id` against the path node.

Exploring never writes `curriculum_id`, `grade_id`, or circle membership.

### 1.2 Example shape (IB MYP · Grade 9)

Logical tree (editorial). Phone renders as an indented thread, not ASCII art.

```text
YOUR CHILD IS HERE — IB MYP · Grade 9
│
├─ NEXT YEAR — GRADE 10
│   ├─ Continue IB MYP — Complete the final MYP year
│   └─ Considering a curriculum change? — Explore school-specific transfer options
│
└─ EXPLORE AHEAD — AFTER GRADE 10
    ├─ Continue within IB
    │   ├─ IB Diploma Programme (DP)
    │   └─ IB Career-related Programme (CP)
    ├─ Switch curriculum
    │   ├─ Cambridge AS / A Level
    │   ├─ CBSE Classes 11–12
    │   ├─ ISC Classes 11–12
    │   └─ State Intermediate (TG / AP when state matches)
    ├─ Explore other education routes
    │   ├─ Polytechnic diploma
    │   └─ Vocational / skill programmes
    └─ Not sure yet — Understand and compare the options
```

Inside **IB Diploma Programme**, fixed **lenses** (same ids as today where
possible):

```text
IB DIPLOMA PROGRAMME
├─ What is this programme?        → S06 detail (catalogue slug link)
├─ Subjects and choices           → expands sub-tree (below)
├─ Workload and transition
├─ College and career possibilities
├─ Requirements to check
├─ Read parent discussions
└─ Ask parents anonymously
```

**Subjects and choices** expands again:

```text
├─ Understand subject selection
│   ├─ What are HL and SL?
│   └─ How do subject combinations work?
├─ Explore subject areas
│   ├─ Mathematics
│   ├─ Sciences
│   …
├─ Connect subjects to future interests
│   ├─ Engineering … Not sure yet
└─ Ask parents about choosing subjects
```

**Mathematics** leaf example:

```text
MATHEMATICS
├─ Understand AA and AI
├─ Understand HL and SL choices
├─ What requirements should we check?
├─ Read parent discussions
└─ Ask anonymously — “How did your child choose between Maths AA and AI?”
```

**Breadcrumb:** `IB Diploma > Subjects and choices > Mathematics`

### 1.3 UX rules (mobile)

| Rule | Behaviour |
|------|-----------|
| One scroll | No horizontal branch carousel as the only navigation |
| Expand in place | New rows appear under the tapped node; ancestors stay visible |
| Re-tap | Does **not** collapse the whole tree (signed UI); may toggle that node's children |
| Breadcrumb | Tappable segments jump focus; does not change child profile |
| Ask / Read | Shown on **every** node that has `allow_ask` / `allow_discussions` |
| Depth | Prefer 4–6 levels max on phone; deeper content → link to S06 detail |
| Empty discussions | “No discussions on this branch yet” + ask CTA |
| Theme | Warm white app chrome (same as Home), not a separate dark forest |

---

## 2. What stays in code vs moves to DB

| Concern | Where it lives |
|---------|----------------|
| **Exploration tree** (titles, hierarchy, kicker, lead, sort, visibility) | **Postgres** (`path_nodes`, etc.) |
| **Exam / opportunity cards** (JEE, NEET, POLYCET, official URLs, eligibility) | **`pathways-catalogue.ts`** until admin imports them; optional FK `pathway_item_slug` on a node |
| **Stage / family from child** | **`pathways-context.ts`** (unchanged): derives `BoardFamily`, `StageId`, `includeAfter10Fork` |
| **Which root subtree to load** | API: match `path_node_roots` to context + published nodes |
| **Posting audience** | Existing **circles** (prefer curriculum circle); unchanged |
| **Discussion links** | **`path_discussion_links`**: path node → `circle_id` + `circle_message_id` (the message in the curriculum circle). Redirect only; no second copy of the thread. |

Do **not** duplicate JEE/NEET copy inside every node row. Link to catalogue
S06 for facts; tree nodes are **orientation and questions**.

---

## 3. Database schema

Migration target: **`058_path_exploration_nodes.sql`** (after
`057_path_discussion_tags`).

### 3.1 Enums

```sql
CREATE TYPE path_node_kind AS ENUM (
  'root',           -- anchor under child context (e.g. "Explore ahead")
  'section',        -- grouping (NEXT YEAR, AFTER GRADE 10)
  'route',          -- IB DP, CBSE 11–12, Intermediate
  'lens',           -- Subjects, Workload, College plans, What is this programme
  'topic',          -- Mathematics, Sciences, …
  'interest',       -- Engineering, Medicine, …
  'action',         -- Read discussions, Ask (optional explicit rows)
  'link'            -- jump to pathway catalogue slug (S06)
);

CREATE TYPE path_node_status AS ENUM ('draft', 'published', 'retired');
```

### 3.2 `path_nodes`

Adjacency list. Stable **`slug`** for tags and analytics; **`id`** uuid for FKs.

```sql
CREATE TABLE path_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES path_nodes(id) ON DELETE RESTRICT,
  kind path_node_kind NOT NULL,
  status path_node_status NOT NULL DEFAULT 'draft',

  title text NOT NULL,
  kicker text,                    -- "Continue IB", "Switch curriculum"
  summary text,                   -- one line under title in thread
  lead text,                      -- optional 1–2 sentences when expanded

  sort_order int NOT NULL DEFAULT 0,

  -- Visibility (all optional = no filter on that axis)
  board_families text[] DEFAULT '{}',   -- CBSE, IB, CAMBRIDGE, STATE, ICSE
  curriculum_codes text[] DEFAULT '{}', -- IB_MYP, CBSE, IGCSE, SSC, …
  stage_ids text[] DEFAULT '{}',        -- foundation, middle, board_10, after_10, senior
  state_codes text[] DEFAULT '{}',      -- TG, AP, IN, …
  min_grade_codes text[] DEFAULT '{}',  -- optional floor (e.g. G9)
  max_grade_codes text[] DEFAULT '{}',

  -- Behaviour flags
  allow_expand boolean NOT NULL DEFAULT true,
  allow_ask boolean NOT NULL DEFAULT true,
  allow_discussions boolean NOT NULL DEFAULT true,
  peek_only boolean NOT NULL DEFAULT true,  -- always true for Child's Path today

  -- Links
  pathway_item_slug text,         -- optional → pathways catalogue S06
  decision_group_id text,         -- optional; fork / "not sure" grouping for tags

  -- Prompts (default ask starter for this node)
  ask_prompt_default text,

  locale text NOT NULL DEFAULT 'en-IN',
  content_version int NOT NULL DEFAULT 1,
  published_at timestamptz,
  retired_at timestamptz,
  last_reviewed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_path_nodes_parent_sort ON path_nodes (parent_id, sort_order);
CREATE INDEX idx_path_nodes_status ON path_nodes (status) WHERE status = 'published';
CREATE INDEX idx_path_nodes_slug ON path_nodes (slug);
```

**One parent per node.** DP Mathematics and A Level Mathematics are two
rows. v1 does not share one node under two parents. Reject inserts that
would cycle `parent_id` back to the node.

**State split.** Polytechnic for Telangana is a TG-only node (`POLYCET`).
Do not reuse it for Andhra Pradesh. “State Intermediate” is separate per
state code, not one TG/AP card.

**Retire, do not delete:** set `status = retired`, `retired_at`. Optional
later: `path_node_redirects` from old slug to a new node.

### 3.3 `path_node_prompts` (optional lenses)

When a node supports multiple **lenses** (Subjects / Workload / College plans /
Learning / Next grade), store editable starters per lens.

```sql
CREATE TABLE path_node_prompts (
  node_id uuid NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
  lens_id text NOT NULL,  -- subjects | workload | college_plans | learning | next_grade
  prompt text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (node_id, lens_id),
  CONSTRAINT path_node_prompts_lens_chk CHECK (
    lens_id IN ('subjects', 'workload', 'college_plans', 'learning', 'next_grade')
  )
);
```

If the tree uses **child rows** instead of lens chips for “Subjects and
choices”, prompts live on the **leaf topic node** (`ask_prompt_default`).

### 3.4 `path_node_roots`

Maps **child context** → which top-level sections appear (without hard-coding
in the app).

```sql
CREATE TABLE path_node_roots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,              -- e.g. "IB MYP G9 default"
  board_families text[] NOT NULL,
  curriculum_codes text[] DEFAULT '{}',
  stage_ids text[] NOT NULL,
  grade_codes text[] DEFAULT '{}',  -- e.g. {G9}, {G10}, {Y11}
  include_after_10_fork boolean NOT NULL DEFAULT false,
  root_node_id uuid NOT NULL REFERENCES path_nodes(id),
  sort_order int NOT NULL DEFAULT 0,
  status path_node_status NOT NULL DEFAULT 'draft',
  UNIQUE NULLS NOT DISTINCT (...)   -- implement as partial unique in migration
);
```

Resolution order (first match wins; ties broken by `sort_order`, then `id`):

1. Curriculum code + grade code + stage + `include_after_10_fork`.
2. Curriculum code + stage + fork flag (grade empty).
3. Board family + stage + fork flag.
4. Board family + stage.
5. Published fallback node: “Path not ready for this board yet.”

Do not guess a root from a label. Grade codes must be real `curriculum_grades.code` values (`G9`, `G10`, `Y11`). Reject a seed row whose grade code is not in that curriculum.

G9 and G10 are different roots. IB MYP Grade 9 includes “Next year” and “Explore ahead.” IB MYP Grade 10 opens the after-10 fork and does not show “Next year — Grade 10” as if the child were still in Grade 9. Peeking ahead shows “Exploring ahead · your child is currently in {grade}.”

### 3.5 Discussions — links to curriculum-circle messages

**Do not** store a Path-only thread. A discussion **is** a message in the
**selected child’s** curriculum circle (`CURR_{that child’s curriculum code}`,
e.g. IB MYP Parents). With two children, do not use the first curriculum
circle in the parent’s membership list.

**v1 list is Path-created only.** There is no backfill and no admin linker
for older circle messages. Empty state is expected until someone asks from
this node.

`057_path_discussion_tags` tags `circle_posts`. The live parent conversation
is **`circle_messages`** (plus `circle_threads` when the message is a thread
root). New links use message ids. `057` stays for any legacy post tags; the
thread UI does not read it.

```sql
-- Support composite FKs so a link cannot pair a message with the wrong circle.
CREATE UNIQUE INDEX IF NOT EXISTS circle_messages_id_circle
  ON circle_messages (id, circle_id);

CREATE TABLE path_discussion_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_node_id uuid NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL,
  message_id uuid NOT NULL,
  thread_id uuid,
  lens_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_node_id, message_id),
  FOREIGN KEY (message_id, circle_id)
    REFERENCES circle_messages (id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id, circle_id)
    REFERENCES circle_threads (id, circle_id) ON DELETE SET NULL
);

CREATE INDEX idx_path_discussion_links_node
  ON path_discussion_links (path_node_id, created_at DESC);
```

`thread_id` is set only when that message **is** a thread root
(`circle_threads.root_message_id = message_id`). A normal channel message
keeps `thread_id` null.

Rules:

- **One transaction.** Create the curriculum-circle message and the link
  row together. If the link insert fails, roll back the message. A published
  question with no link must not happen.
- **Write on Ask only.** v1 does not scan or attach messages that already
  exist in the circle.
- **Read is a redirect list.** Return a link only if the caller is still a
  member of `circle_id`. Re-check membership on every request. A stored link
  never grants access.
- **Open target.** If `thread_id` is set, open the thread screen. If it is
  null, open the normal circle message (channel scrolled to `message_id`).
  Do not wrap a plain message in the thread UI.
- **Sort and hide.** Order by the thread’s latest activity when `thread_id`
  is set, otherwise by `circle_messages.created_at`. Skip `deleted` and
  `moderated` messages. Reply count comes from the thread when one exists,
  otherwise 0.
- **No body copy.** Preview is read from `circle_messages.body`.
- **Audience.** The selected child’s curriculum circle only. Exploring DP
  does not post into a DP circle. Not a DM.

### 3.6 Content ops tables (phase 2)

- `path_node_reviews` — reviewer, date, notes (optional).
- `path_node_redirects` — `from_slug`, `to_node_id`.

---

## 4. API design

Base: existing **`/v1/pathways`**, auth required.

### 4.1 `GET /v1/pathways/explore`

Query: `childId`, optional `nodeId` (focus), optional `depth` (default 2).

Response:

```ts
type PathExploreResponse = {
  context: PathwayContext;           // existing
  location: { title: string; meta: string };
  breadcrumb: Array<{ id: string; slug: string; title: string }>;
  focusNodeId: string;
  thread: PathExploreNode[];         // flat pre-order for UI, with depth indent
  children: PathwayHubChild[];       // multi-child chips
};

type PathExploreNode = {
  id: string;
  slug: string;
  parentId: string | null;
  kind: PathNodeKind;
  title: string;
  kicker: string | null;
  summary: string | null;
  lead: string | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;                 // server hint from focusNodeId
  allowAsk: boolean;
  allowDiscussions: boolean;
  pathwayItemSlug: string | null;
  askPromptDefault: string | null;
  prompts: Partial<Record<PathTopicId, string>>;
};
```

**Loading strategy**

- First paint: location + **roots** (sections under matched `path_node_roots`).
- On expand: `GET /v1/pathways/explore?childId=&nodeId=` returns breadcrumb +
  **subtree** (children of focus, or full path from root to focus + siblings at
  each level — pick one; document in implementation: **“path replay”**).

Prefer **path replay**: ancestors collapsed one-line, focus expanded, children
listed.

### 4.2 `GET /v1/pathways/nodes/:slug`

S06-style detail when node has `pathway_item_slug` or node-local `lead` +
rows (phase 2: `path_node_detail_rows` table mirroring catalogue detail rows).

### 4.3 `GET /v1/pathways/nodes/:id/discussions`

Returns **links**, not a Path feed:

```ts
type PathDiscussionLink = {
  circleId: string;
  circleName: string;
  messageId: string;
  threadId: string | null;   // set only when this message is a thread root
  openAs: "thread" | "message";
  preview: string;
  replyCount: number;
  activityAt: string;
};
```

**Open target**

| `openAs` | Screen |
|----------|--------|
| `thread` | Existing thread UI for `threadId` |
| `message` | Normal circle message. Scroll the channel to `messageId`. Do not use the thread screen. |

Empty list: “No discussions on this branch yet”. Only links created by Ask
from this node. No import of older circle messages.

### 4.4 Composer (post into the curriculum circle, then link)

Ask posts into the **selected child’s** curriculum circle in the **same
transaction** as `path_discussion_links`. The server returns `messageId` and
`threadId` (null when the post is a normal channel message).

The client does not choose “first curriculum circle.” It uses the circle id
the explore response names for this child (`postingCircleId`).

```ts
pathContext: {
  pathNodeId: string;
  pathNodeSlug: string;
  lensId?: PathTopicId;
  circleId: string;
  messageId: string;
  threadId?: string;
};
```

Server inserts `path_discussion_links` in that transaction. It does not
create a circle, copy the text, or attach messages that were not just
created from this Ask.

### 4.5 Hub endpoint

`GET /v1/pathways/hub` + `branchMap` is the **old** card API. The parent app
calls **`GET /v1/pathways/explore`** only. Do not render branch cards beside
the thread. `branchMap` can stay on the server until the card code is
deleted; it is not a second screen.

---

## 5. Mobile code changes

| Area | Change |
|------|--------|
| `apps/mobile/app/(app)/pathways/index.tsx` | Only screen: load `getPathExplore`; `focusNodeId`, child id, breadcrumb |
| **New** `PathExploreThread.tsx` | The parent UI: indent, expand, breadcrumb, ask/read |
| `PathBranchHub.tsx` | Remove from the parent route when the thread ships |
| `apps/mobile/src/lib/api.ts` | Types + `getPathExplore`, `getPathNodeDiscussions` |
| `apps/mobile/app/circles/.../new-post.tsx` | Accept `pathNodeId`, `pathNodeSlug`, `askBody`, show chips + “Where will this be posted?” |
| `path-theme.ts` | Already aligned to app white theme |
| Analytics | `path_node_opened`, `path_node_expanded`, `path_discussions_opened`, `path_composer_opened` with `node_slug` |

**Session state** (functional spec): `childId`, `focusNodeId`, scroll offset —
not persisted to profile.

---

## 6. Backend / shared code changes

| Area | Change |
|------|--------|
| `packages/db/migrations/058_path_exploration_nodes.sql` | Tables above |
| `packages/db/scripts/seed_path_exploration_ib_myp_g9.sql` | First published tree (IB MYP G9 fixture) |
| `apps/api/src/routes/pathways.ts` | `explore`, `nodes/:slug`, discussions list |
| **New** `apps/api/src/services/path-explore.ts` | Resolve root, filter nodes by context, build thread |
| `apps/api` circle message create | After a Path Ask, insert `path_discussion_links` (`circle_id`, `message_id`, `thread_id`) |
| `packages/shared/pathways-context.ts` | Unchanged derivation; used by explore resolver |
| `packages/shared/pathways-catalogue.ts` | Unchanged for exams; nodes link via slug |
| `packages/shared/pathways-branches.ts` | Not used by the parent screen once the thread ships |

Tests:

- Root resolution: IB MYP G9 ≠ G10; CBSE G10; tie uses `sort_order`.
- TG Polytechnic node hidden when state is AP.
- Breadcrumb path replay for DP → Subjects → Mathematics.
- Ask + link commit together; rollback leaves no orphan message.
- Link rejected when `message_id` is not in `circle_id`.
- List omits non-members and deleted messages.
- `openAs: "thread"` only when `thread_id` is set; otherwise `openAs: "message"`.

---

## 7. Seeding and editorial workflow

1. **Draft in SQL or admin** (admin UI out of scope for v1; use reviewed SQL seeds).
2. Set `status = published`, `last_reviewed_on`, `published_at`.
3. No fictional discussions; empty state in app.
4. Official exam claims only on catalogue items linked by `pathway_item_slug`.
5. Version bumps: increment `content_version` on text change; optional prompt to
   refresh in-app copy on next open.

**Replace the live Child’s Path screen only after these roots are published:**

- IB MYP Grade 9 and Grade 10
- CBSE Grade 10
- Cambridge Year 11
- SSC Grade 10 (TG and AP split where the routes differ)

IB MYP Grade 9 can be built first. It is not enough on its own to remove
the current screen for every child.

---

## 8. Migration from current implementation

| Today (to remove from the parent app) | Parent screen |
|----------------------------------------|----------------|
| `buildPathBranchMap()` + three cards | DB nodes + `path_node_roots` |
| Explore panel + topic chips | Thread rows (lenses are child nodes) |
| `path_id` text tags | `path_discussion_links.message_id` |

Rollout: one parent UI. Build the thread, then replace Child's Path in the app. Do not leave the card hub visible.

1. DB + explore API. Seed IB MYP G9 first, then G10, CBSE G10, Cambridge Y11, and SSC G10.
2. Replace Child’s Path in the app only after those roots are published.
3. Production API and OTA go out together.

---

## 9. Closed decisions

1. **One parent screen.** The thread replaces the three cards.
2. **Expand** one route at a time. Other siblings stay as title rows. Re-tap toggles that node’s children only.
3. **Lenses are child rows**, not a second chip panel. PCM / PCB chips stay only on CBSE 11–12, never on DP or A Level.
4. **Shared topics are duplicated** per route (one parent each).
5. **Ask circle** is the selected child’s curriculum circle.
6. **Message and link** are one transaction.
7. **Open:** thread UI only when `thread_id` is set; otherwise the normal circle message.
8. **Discussions list** is Path-created asks only. No backfill of older circle messages.
9. **School transfer** copy says “check with your school.” No generated school list.
10. **ICSE** content can be seeded, but a root is shown only when the child can be saved as ICSE.
11. **Admin UI** is later. v1 seeds are SQL.

---

## 10. Acceptance checklist (release bar)

- [ ] Child location row shows correct board · grade from profile only.
- [ ] Expanding “IB DP” shows lenses + ask/read without profile write.
- [ ] Breadcrumb `IB Diploma > Subjects and choices > Mathematics` matches focus.
- [ ] Ask uses the selected child’s curriculum circle, not the first circle on the account.
- [ ] Ask and `path_discussion_links` commit or roll back together.
- [ ] A thread root opens the thread screen. A normal message opens the circle message.
- [ ] Read discussions lists only asks created from that node. Empty state when none.
- [ ] A parent who is no longer in the circle does not see the link.
- [ ] Retired node returns 410 with redirect slug when configured.
- [ ] No JEE/NEET “Eligible” from browse on MYP/IGCSE nodes.
- [ ] Content change in DB appears after pull-to-refresh without app store release.

---

## 11. Related files (today)

| File | Role after tree |
|------|-----------------|
| `apps/mobile/.../pathways/index.tsx` | Hub controller |
| `apps/mobile/.../PathBranchHub.tsx` | Legacy branch UI |
| `packages/shared/pathways-branches.ts` | Legacy branch map |
| `packages/shared/pathways-catalogue.ts` | Exams / S06 detail |
| `apps/api/src/routes/pathways.ts` | Hub + items |
| `packages/db/migrations/057_path_discussion_tags.sql` | Legacy post tags only; thread UI uses `path_discussion_links` → `circle_messages` |

Update cross-links in `WHAT_NEXT_AND_OPPORTUNITIES.md` §17 implementation
sequence when phase 1 starts.

---

## 12. Phone fixes — speed, spinner, keyboard

The Grade 9 tree is one text payload. Grade 10, After Grade 10, and a section expand do not fetch again.

1. **Open a branch immediately.** Stage tabs, card taps, and +/− use the nodes already on the phone. The list for the new branch replaces the old one and the screen returns to the top of that branch. Do not replace the whole screen with a loader for that tap.
2. **Spinner only while the text is actually loading.** The first open, a child switch, or a refresh shows a spinner and keeps any text already on screen. A branch tap that only changes focus does not show a spinner.
3. **Ask parents stays above the keyboard.** The floating composer moves up with the keyboard. On Android, add the keyboard height only when the window itself does not shrink. Typing must not slide under the keyboard.
