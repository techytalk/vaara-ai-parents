# Child's Path — functional specification

**Status:** working functional spec for production behaviour.  
**UI source of truth:** [`CHILDS_PATH_BRANCH_UI.md`](CHILDS_PATH_BRANCH_UI.md)  
**Catalogue source of truth:** [`WHAT_NEXT_AND_OPPORTUNITIES.md`](WHAT_NEXT_AND_OPPORTUNITIES.md)

This file absorbs useful **behaviour** from the Astra “Model 2” functional
document (21 Sep 2026). It does **not** adopt Astra’s competing chrome
(radial map, question-led first screen, five-stop strip on the hub, or
collapse-on-second-tap). The parent-facing layout stays the branch tree
we signed: location node → 2–3 branch cards → one explore panel → ask
parents.

---

## 0. What we use from Astra vs what we leave

### Use (behaviour, conversations, safety)

| Area | Why it is useful |
|------|------------------|
| Actual stage vs viewed stage | Peek must never look like a profile update |
| Path node, topic, path discussion terms | Stable language for eng/QA |
| Default-expand **continuation**, label **Exploring** never Recommended | Matches the mock |
| Continue / Switch kickers; editorial order; max 3 + Other routes | Matches the mock |
| Connectors mean “can explore”, not admission | Safety |
| Topics Subjects / Workload / College plans; one topic at a time | Matches the mock |
| Opportunities: Explore now / For later / Choose an interest / Different subjects / Paused / Needs verification | Clearer than unnamed dimming |
| Eligibility is never inferred from browse, interest, or grade alone | Hard rule we already wanted |
| Discussions reuse **existing circles**; tags do not widen audience | Missing from our earlier UI doc |
| Composer: “Where will this be posted?”; exploring DP ≠ DP circle | Production gap |
| Drafts, idempotent post, error/empty distinction | QA-ready |
| Data contracts: stable IDs, many-to-many routes, retire don’t delete | Engineering |
| Content ops: published only, review dates, no fictional parents | Editorial |
| Analytics events and feature-flag rollback | Rollout |
| Acceptance tests AC01–AC24 | Release bar |
| A11y: 44pt, decorative tree lines ignored, reduced motion, **reflow** at narrow/large text | Production |

### Leave (conflicts with the signed UI)

| Astra idea | Why we do not use it |
|-----------|----------------------|
| “Expandable path map” as a second visual model | We already signed the **tree + explore panel** |
| Radial map / question-led first design | Explicitly out of scope |
| Five-stop strip on the first paint / “View learning stages” as hub chrome | Strip does not share the tree screen. Stage peek is later, on the location node if at all |
| Second tap **collapses** the selected branch to empty | Mock keeps one branch **Exploring**; re-tap does not clear |
| Shrink or pan the three cards | At 390 keep one row. At 320 / large text **reflow vertically** — same cards, no sideways pan, no tiny type |
| Long exam groups as the first paint | College plans lives **inside** a branch |
| Generated sample discussions or fake engagement | Empty state from the mock |

Successful use: the parent understands **where the child is**, **what can
come next**, and **what they can ask**. It does not require a career choice.

---

## 1. Product boundaries

Entry remains **More → Child’s Path**. No new bottom tab, Discover
category, or automatic path-circle membership.

Onboarding still collects curriculum and grade for **circles**. Exploring
this map never changes profile data, school, curriculum, grade, or
membership.

The complete education catalogue is gated: only **reviewed, published**
records appear. ICSE personalisation and A Level / Intermediate as saved
senior profiles stay separately scoped.

---

## 2. Identity and terms

| Term | Meaning |
|------|---------|
| Child profile | Saved school, `curriculum` code, grade |
| Board family | Display family from curriculum: CBSE, Cambridge, IB, ICSE, State |
| Actual stage | Derived from saved curriculum + grade |
| Viewed stage | Stage the parent is peeking; may differ from actual |
| Path node | A programme or transition that can be explored (a branch card) |
| Topic | Subjects, Workload, or College plans (or stage substitutes) |
| Circle | Existing audience with its own read/write rules |
| Path discussion | An existing post tagged with path + topic IDs |

**CTX01** Derive family, actual stage, and location from a valid selected
child. Prefer school or profile state. Do not infer state from device GPS.

**CTX02** Keep actual identity visible while exploring. Location node stays
“Your child is here” / `IB MYP · Grade 10`. Panel title is “Explore IB
Diploma”, never a rewritten profile.

**CTX03** Missing state: national paths still show. Offer “Choose a state to
explore local options”. That chooser is a **browse filter** unless the
parent edits their profile separately.

**CTX04** Do not require stream, career interest, or a chosen future
programme to open the map. **Not sure yet** keeps general content and ask
actions.

IB programme codes stay one family. Parents see **Cambridge**; profile
code remains `IGCSE`. A Level is an explored route, not a selectable
senior profile today. ICSE content must not look like a supported child
profile until curriculum + grades exist.

---

## 3. Screens (functional)

Layout of S01/S02 is defined in the branch UI doc. This is the task map.

| ID | Purpose | Primary actions |
|----|---------|-----------------|
| **S01** Path map | Current node + 2–3 branches + Other routes | Change child; select branch |
| **S02** Explore panel | In-place on S01, under the selected card | Topic chips; ask; read discussions |
| **S03** Discussions | Readable threads for path × topic | Open thread; start question |
| **S04** Thread | Existing conversation | Reply; report; existing moderation |
| **S05** Composer | Question, tags, **visible audience** | Edit; pick eligible circle; post |
| **S06** Content detail | Programme or exam explanation | Official source; ask about it |

**NAV01** Open S01 from More. No new tab.

**NAV02** One eligible child: no child picker. Two or more: chips. Restore
each child’s map position in the **session**; revalidate profile and
access. New app session starts at **actual** stage.

**NAV03** No usable school-age child: explain and offer Add child /
Complete profile. Optional labelled **Browse without a child** may show
general reviewed content; it cannot invent school or circle membership.
Preschool-only: hide Child’s Path (existing rule).

**NAV04** S02 is one orientation line, topic chips, one prompt, conversation
actions. Programme/exam depth opens **S06**, not a wall of text in the
panel.

**NAV05** S03–S06 return to the same child, viewed stage, branch, topic, and
scroll. Android Back follows that stack; at S01, Back is More.

---

## 4. Map behaviour (on top of the signed UI)

Visuals: [`CHILDS_PATH_BRANCH_UI.md`](CHILDS_PATH_BRANCH_UI.md). Behaviour:

**MAP01** First visit: root = actual stage; up to three next-step cards;
**expand the continuation** (stay on family) by default when published
content exists. Status **Exploring**, never “Recommended” or “Selected for
your child”.

**MAP02** Continuation first, then editorial alternatives. Kickers
**Continue** / **Switch**. Order is configuration, not ranking. Do not
imply the child’s school offers every switch.

**MAP03** Tapping another card moves Exploring to that card; siblings stay
visible. **Re-tapping the selected card does not collapse it** (signed UI).
Tapping the location node later may reset viewed stage to actual; it does
not clear the continuation default.

**MAP04** At most one branch and one topic. Deeper copy → S06. Map position
is preserved.

**MAP05** Stem from selected card into the panel means “belongs to this
route”. It does not mean admission, eligibility, or a required choice.

**MAP06** **Other routes / not sure yet?** holds overflow (IBCP, ISC, state
11–12, Polytechnic) and a general starter. Same panel behaviour. A
question from Other routes / the fork **must not** inherit the last
Diploma topic (see POST01).

**MAP07** Default width (390): three cards in one row, as in the mock. At
narrow width or large text: **reflow to a connected vertical list** with
the same order and labels. No sideways pan, no pinch-zoom, no shrink-to-fit
type.

**MAP08** “Ask about this path” carries the selected node + topic. “Ask
about these options” (from Other routes / not sure) carries the decision
group, not a single destination.

**MAP09** Every node is a control; min 44pt touch. Screen reader order:
root, sibling cards (selected/expanded state), panel, actions. Tree lines
are decorative (ignored).

**MAP10** Reduced motion: no jumpy expand. Keep focus on the activated
control. Do not rely on colour alone (Exploring vs Explore is text).

Session view (not profile): child id, actual stage, viewed stage, state
filter, expanded route, topic, optional interest, scroll. Drafts are
separate (existing draft policy).

---

## 5. Stages and qualification

Phone stops and family mappings stay in the catalogue spec. Functional
rules:

**STG01** Actual stage only from a validated curriculum + grade ID pair.
Never guess from a label substring or age.

**STG02** Six content stages; five phone stops. Final Class 10-equivalent
year injects after-10 fork into the 10 stop without duplicating cards.

**STG03** Final-year triggers: CBSE/ICSE **G10**, Cambridge **Y11**, IB
**MYP G10**. Earlier years inside the 10 stop (e.g. CBSE G9, IGCSE Y10)
label next choices **Coming next**.

**STG04** Peeking another stage: “Exploring ahead · Your child is currently
in Grade 10”. Returning restores the actual-stage branch. Peek does not
change circles or grade.

**STG05** Avoid one generic middle-school line for every grade. Prefer
specific copy, e.g. “Explore what comes after Class 10 when you are
ready.”

**STG06** An IGCSE or MYP child browsing A Level or DP is still IGCSE/MYP.
Browse does not grant senior-qualification eligibility.

SSC: G1–5 Early, G6–8 Middle, G9–10 the 10 stop. Intermediate is browse
content until a senior profile exists. Do not invent Nursery or SSC G12.

---

## 6. Routes by family (content behaviour)

Board lists in the UI doc §5 stand. Extra functional constraints:

**BRD01** CBSE 11–12: PCM, PCB, PCMB, Commerce, Arts are **exploration
intents** inside Subjects — not tree cards. Expand abbreviations on first
use. Combinations depend on the school.

**BRD02** An intent refines topics and opportunities. **Not sure yet**
stays. Do not write `stream` onto the child.

**BRD03** SSC senior: MPC, BiPC, MEC, HEC with plain language.
Polytechnic is a **route**; POLYCET is an **exam**. Telangana cards must
not be reused for Andhra Pradesh.

**BRD04** A state exam hangs off a route + state. It is never a top-level
branch for every family. Unknown state → national only.

**BRD05** Show **Cambridge** in the UI; keep `IGCSE` in the profile.
Checkpoint/diagnostic is not Class 10.

**BRD06** Final IGCSE year: A Level is continuation. Copy must make
**IGCSE = Class 10, not Class 12** obvious. Exam-series and recognition
copy only if reviewed against current official sources.

**BRD07–BRD08** IB family grouping as today. MYP G10 row: Diploma, A
Level, CBSE 11–12. IBCP / ISC in Other routes. Nodes are exploration, not
admission.

**BRD09** Inside DP / A Level, intents are Engineering, Medicine,
Commerce/Business, Arts, Not sure — **never MPC**. No blanket “all MYP is
Class 10 equivalent” or “all DP dates clash with every entrance” on the
hub; detail/S06 holds reviewed nuance.

**BRD10** ICSE/ISC: labelled browse only until profile support. No fake
“your child is ICSE”. No ICSE-only entrance catalogue.

**Foundation:** every supported early stage needs at least one learning /
transition branch and a question starter. Do not force careers or an empty
exam screen. Topics may substitute **Learning** and **Next grade** for
younger stages (TOP01).

Illustrative starters (editable, not published):

- CBSE: “How did your child choose subjects for Class 11, and what
  surprised you after the move?”
- State: “Parents who explored Intermediate and Polytechnic after Class
  10: what helped you compare the options?”
- IB Diploma · Subjects: use the signed mock quote.

---

## 7. Topics and opportunities

**TOP01** Senior paths: Subjects, Workload, College plans. Younger stages
may substitute Learning / Next grade. Topics belong to the selected
branch, not global tabs.

**TOP02** One editable starter per topic. Changing topic changes
explanation, opportunity list, and discussion query. **Never overwrite an
unsent edited draft** when switching topic; prompt Keep / Discard /
Continue.

**OPP01** College plans lists opportunities **under the selected route**.
Currently relevant first. Later items in collapsed **For later** with a
specific reason (not a long dump).

| Display | Behaviour |
|---------|-----------|
| Explore now | Relevant to this stage; does **not** certify the child can apply |
| For later | Short label: required future stage or qualification |
| Choose an interest | Hide stream-specific exams until an intent is chosen; keep general guidance |
| Different subjects | Published subject rule does not match; still browsable |
| Paused | Separate (e.g. NTSE); reviewed status copy |
| Needs verification | Missing/expired rules; official check action — never infer eligible |

**OPP02** Stage relevance, interest match, location match, and
**application eligibility** are separate. Grade, interest, or a browsed
senior path cannot produce **Eligible**.

**OPP03** Populate only from reviewed catalogue rows. UCAS / Common App
are **application routes**, not exams. Paused records stay content, not
hardcoded forever.

**OPP04** S06: title, 1–2 sentence lead, type, stage, subjects/qualifications
to check, what it can open, state, official source, review date. Dates and
cut-offs only when verified for the cycle. “Needs DP or another recognised
Class 12-equivalent” is a **future requirement**, not “DP satisfies every
college.”

---

## 8. Finding and reading discussions

**DIS01** Read discussions → S03 with stable path + topic IDs. A switch
can tag source and destination. A comparison uses a decision-group id +
multiple route ids — do not force it under one destination.

**DIS02** Fetch only what existing circle permissions allow. Path tags are
discovery, not a permission override. Same checks for snippets, counts,
and notifications.

**DIS03** Prefer exact path × topic, then same path. Broader results:
label **More discussions about this path** and show the original circle.
Do not silently mix boards, years, or locations.

**DIS04** Sort by latest activity. Show preview, circle, anonymous
treatment, relative date, real reply count. Paginate as elsewhere; restore
position from a thread.

**DIS05** Open threads with existing behaviour. Replies stay in that
thread’s audience. The map must not clone a conversation into a new circle.

**Reach:** a Grade 10 circle may have few parents already in 11–12. Do not
promise “parents with experience” just because a topic is tagged. If a
broader eligible circle exists, show it as audience. Otherwise launch with
audiences that actually exist.

**DIS06** Never auto-join a senior-grade circle, post as another grade, or
DM other parents. Guest posting only if the product already supports it
and the parent **chooses** an eligible destination.

Empty: **No discussions on this branch yet** (UI doc) / topic yet, plus
Start the conversation. Do not invent counts or sample parents. A fetch
failure is **Retry**, not empty.

---

## 9. Composer and replies

**POST01** Ask anonymously → S05 with editable question and visible path /
topic chips. Fork / Other routes questions keep **general** context; they
must not inherit the last Diploma topic.

**POST02** Before submit, **Where will this be posted?** List only
currently eligible destinations from the existing circle system. Display
names are not write IDs.

**POST03** Default to the relevant board+grade circle only if it exists
and the parent may post. Else an eligible school circle, shown explicitly.
If none: keep draft, offer existing eligibility/onboarding. **Never create
a circle silently.**

**POST04** Exploration context ≠ posting audience. MYP G10 asking about DP
posts in an eligible **MYP** (or school) circle unless they already belong
to a DP circle. Composer must show the actual audience.

**POST05** Edit the full question. Existing limits, attachments,
moderation. Tags are visible; removing optional tags changes
discoverability, not audience. Public payload: no child name, id, or
private profile snapshot.

**POST06** Existing authenticated write. Server rechecks rights.
Idempotency key on submit. Disable button in flight. Success only after
confirm.

**POST07** Success: open the thread in its circle; associate path tags;
Back to the originating branch. Notifications follow existing prefs.

**POST08** Failure: keep text, tags, audience; specific retry. After
timeout, check operation status before a second post.

Drafts: Keep / Discard / Continue before replacing when changing child or
map context. Do not move a draft to another child. Replies use the
thread’s audience — no destination picker. Anonymity wording must not
promise more than Vaara’s existing identity policy.

---

## 10. Loading, errors, unusual states

| Condition | Parent experience |
|-----------|-------------------|
| Profile loading | Skeleton; do not flash another child |
| Map loading | Keep root; progress where cards will be |
| Unsupported curriculum/grade | Personalised map unavailable; profile review or labelled general browse |
| Missing school | General path browse; no fake school audience |
| Missing state | National + optional state chooser |
| No published branches | Stage explanation + general question if posting allowed |
| Discussion fetch failed | Keep branch; Retry |
| Offline | Cached orientation with freshness; drafts kept; posting disabled |
| Membership changed | Revalidate; keep draft; explain dead destination |
| Node retired / stale link | Nearest valid parent stage + explanation; no silent remap |
| Profile changed elsewhere | Refresh actual context; offer return to current stage |
| Child removed | Leave that view; keep private drafts without showing deleted profile |
| Moderation hold | Pending status; not “published” |
| Notification opened | Resolve thread + permissions; return to path context if still valid |

**ERR01** Child/branch switch cancels in-flight results. Late responses
must not paint the old child or attach the old topic to a new draft.

**ERR02** Browsing state is independent of profile. Failed request, restart,
or deep link must never overwrite curriculum, grade, school, or membership.

**ERR03** Sign-in expiry, block, removed posts, reporting: existing flows.
Recovery must not leak hidden circle or account identifiers.

---

## 11. Logical data contracts

Not table names. Map onto existing children, circles, posts, and the
pathways catalogue.

| Record | Must hold |
|--------|-----------|
| Profile context | Child id; curriculum + grade; school; state; permissions |
| Stage mapping | Curriculum/grade IDs; family; actual stage; five-stop index; final-year trigger; supported |
| Path node | Stable ID; type; decision group; title; one-line lead; family/stage; order; publication |
| Path relationship | Source/target; continue / switch / later / topic; view conditions |
| Topic and prompt | Stable topic ID; path; label; short explanation; editable starter; locale; version |
| Opportunity | Stable ID; exam vs application; stage; subject/qualification rules; state; status; official source; review |
| Discussion association | Existing post ID; path IDs; source/destination if switch; topic; origin; **explicit audience ID** |
| Draft context | Author draft ID; text; path/topic; audience; origin; recoverable |
| Session view | Child; actual + viewed stage; branch; topic; interest; state filter; scroll |

**DATA01** IDs are not display text. Renaming “IB Diploma” must not detach
discussions.

**DATA02** One authoritative audience per post; many path tags. Tags never
widen audience. No internal child ids in public payloads.

**DATA03** Validate tags, write access, post state server-side. Store
content version used when useful.

**DATA04** Many-to-many: several curricula can lead to one route; one exam
can sit on several routes. Do not copy JEE facts into every board’s copy.

**DATA05** Retire nodes without deleting identity. Redirect or unavailable
for old links. Post deletion follows ordinary moderation, independent of
catalogue retirement.

---

## 12. Content operations

**CNT01** Each enabled family×stage: reviewed root copy, at least one
useful branch or honest fallback, plain labels, a starter. No empty node
posing as advice.

**CNT02** Transitions say what the node **is**. No implied automatic
equivalence or admission. School offering and recognition live in reviewed
S06 with official source.

**CNT03** Draft / published / retired. Only published on the live map.
Preview and illustrative posts never appear as community content.

**CNT04** Owner, review date, source on exam/qualification guidance.
Expired review: drop unverified dates/eligibility; keep general
orientation.

**CNT05** Publish mappings, nodes, topics, prompts as one coherent version.
Rollback restores a compatible content version; conversations stay.

### Parent language

| Situation | Wording |
|-----------|---------|
| Actual profile | Your child is here |
| Expanded route | Exploring IB Diploma |
| Uncertain interest | Not sure yet |
| Future stage | Exploring ahead · Your child is currently in Grade 10 |
| No conversations | No discussions on this branch yet |
| Posting audience | Where will this be posted? |
| Profile preservation | Exploring does not change your child’s profile |
| Unverified eligibility | Check current subjects and entry requirements |

Launch priority: complete Class 10 transitions for **CBSE, Cambridge, IB**;
honest Early/Middle/Senior fallbacks; SSC with validated state. Gate ICSE
personalisation. Prefer fewer truthful options over generated claims.

---

## 13. Measurement and rollout

Proposed events (map to existing analytics conventions; no child names,
school names, question text, email, or precise location):

| Event | When | Properties |
|-------|------|------------|
| `child_path_opened` | Usable map shown | Entry, family, actual stage |
| `path_stage_viewed` | Viewed stop changes | Actual + viewed stage |
| `path_branch_opened` | Route selected | Path ID, source stage |
| `path_topic_selected` | Topic changes | Path ID, topic ID |
| `path_discussions_opened` | S03 opens | Path, topic, result state |
| `path_composer_opened` | Ask opens | Origin node, starter ID |
| `path_post_created` | Server confirms post | Post ID, path IDs, audience type |
| `path_reply_created` | Server confirms reply | Post ID, reply ID, path association |

Outcomes: share who open a branch, view discussions, create a post; share
of path posts with a **non-author** reply in 7 days; time to that reply.
Count writes once. Exclude self-replies, spam, test.

**REL01** Feature flag. Incomplete family/stage → labelled fallback or
prior list, not a blank map.

**REL02** Rollback disables the new presentation; does **not** delete tags,
posts, or replies. Threads stay in original circles.

Delivery: validate mappings + circle write rules → S01/S02 + accessibility
→ S03–S05 on existing composer → S06 + analytics + recovery → flagged
release.

---

## 14. Acceptance tests

Minimum observable results. Use real curriculum records, two children,
restricted circles, and a real catalogue version.

**Identity / map**

- **AC01** One valid child: correct board, grade, stage; no child picker.
- **AC02** Two children, different curricula: switch updates root, routes,
  discussions; late response from child A cannot paint child B.
- **AC03** First MYP G10 visit: continuation (IB Diploma) Exploring; **no
  profile write**.
- **AC04** A Level tap while Diploma Exploring: only A Level Exploring;
  siblings remain; re-tap does **not** collapse to none.
- **AC05** Other routes: extra published nodes selectable; general
  question does not inherit DP Subjects.
- **AC06** Narrow width + large text: vertical reflow, readable labels,
  44pt targets; SR announces names and expanded state.
- **AC07** G9: future labelled Coming next. Final G10-equivalent: after-10
  fork in the 10 stop, no duplicate cards.
- **AC08** MYP G10 peeking senior: actual profile still MYP; not Eligible
  via browse or interest.
- **AC09** Unsupported ICSE profile cannot be fabricated; browse labelled.
- **AC10** SSC, unknown state: national only. Choosing Telangana is browse
  unless they save profile.
- **AC11** Early stage: useful learning/transition; no mandatory stream.
- **AC12** Open thread or S06 and return: same child, stage, topic, scroll.
- **AC13** Renaming a node does not detach discussions (stable IDs).

**Conversations / release**

- **AC14** Path query returns only readable posts; private circle never
  leaks via tags.
- **AC15** Zero results → empty state + starter. Network error → Retry.
- **AC16** Exploring DP: only destinations they can post to; missing
  circle → explicit alternative or no-audience recovery.
- **AC17** Edited draft survives navigation/child change; audience
  rechecked before send.
- **AC18** Double-tap / timeout retry → at most one post; error keeps
  draft; no false success.
- **AC19** Successful question opens its thread; reply stays in that
  circle.
- **AC20** Public metadata has no child id/snapshot; analytics have no
  question text.
- **AC21** Paused / For later / Needs verification are distinct; interest
  ≠ eligibility.
- **AC22** Revoked membership, retired node, expired session: safe
  recovery, draft kept, no leaked content.
- **AC23** Post/reply analytics once after confirm; no self-reply inflation.
- **AC24** Flag off: prior experience available; posts and circle access
  intact.

---

## 15. Open implementation checks (do not reopen the UI)

1. Which board / grade / school / guest audiences **actually exist**, and
   whether any broader readable circle can reach parents already in 11–12.
2. Enabled content subset, school grade exceptions, catalogue owners,
   draft storage.
3. ICSE profile seed and A Level / Intermediate as saved senior grades
   remain **separate** work.

The UX decision is closed: implement the **signed branch tree** with
conversations attached to branches.
