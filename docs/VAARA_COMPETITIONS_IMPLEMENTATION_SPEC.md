# Vaara Competitions & Exams — Implementation Specification

**Version:** 1.1 — proposed implementation baseline (owner decisions locked 27 Sep 2026)  
**Prepared:** 26 September 2026; updated 27 September 2026  
**Audience:** Product owner, Cursor implementation agent, backend, mobile and content editors  
**Scope:** Database-backed competition discovery, edition details, eligibility guidance and private child plans  
**Execution boundary:** Documentation only. No repository, application or database changes are authorized by this document. The owner will implement through Cursor.

## 1. Purpose and decision status

Build a maintained catalogue that helps a parent answer:

1. What competitions or exams are relevant to my child?
2. Are they school/local, district, state, national or international?
3. Are they free or paid?
4. What are the registration and event dates for this edition?
5. Is registration direct, through school, by nomination or after qualification?
6. What eligibility conditions still need checking?
7. Where is the official information, and when was it checked?
8. Can I save it to my child's plan and ask other parents about it?

The feature uses the child's existing school, curriculum, grade and location context. Browsing never changes those values or circle membership.

### 1.1 Confirmed constraints versus recommendations

| Item | Status |
| --- | --- |
| Read existing code and production schema before proposing architecture | Completed for the relevant components |
| Make no code or database changes in this session | Explicit user instruction |
| Produce a detailed Markdown implementation document | Explicit user request |
| One shared catalogue with year/cycle-specific editions | Recommended architecture in this document |
| Preserve Child's Path expandable thread | Existing repository UI rule |
| Competitions accessible across school grades | Recommended product behavior |
| Dedicated Competitive Exams surface (same class of feature as Child's Path) | **Owner locked 27 Sep 2026** |
| Direct shortcut under More | Replaced by dedicated surface; Path/Child 360 may deep-link later |
| Curated content and external registration for initial release | Recommended release scope |
| Kinds / categories vocabulary (see §5.1) | **Owner locked 27 Sep 2026** |
| Suggestions precomputed by class + curriculum + school location (not per-child ML) | **Owner locked 27 Sep 2026** |
| Geography matching via school location / state / national; not parent pincode | **Owner locked 27 Sep 2026** |
| Parent data access via Vaara API only (no mobile Supabase/RLS) | **Owner locked 27 Sep 2026** |
| Admin UI + admin APIs for catalogue create/update | **Owner locked 27 Sep 2026** |
| Automated reminders, parent submissions and registration tracking | Deferred recommendations, not approved scope |

This is a concrete implementation proposal. Section 1.2 records locked owner decisions. Section 20 lists decisions that still require owner agreement (including edge cases §10–15 from the gap review).

### 1.2 Owner decisions locked (27 September 2026)

| Topic | Decision |
| --- | --- |
| Product home | Dedicated **Competitive Exams** page (catalogue + dates + eligibility + suggestions), not only a Path chip. Path / Child 360 may deep-link into it. |
| Catalogue vs suggestions | **Full catalogue** for all competitive exams (refreshed daily for status/dates). **Suggestions** are separate: precomputed daily by **class + curriculum + school location** buckets; shown to all children in that bucket. No per-child ML personalization. |
| Kinds (vocabulary) | Locked set: `competition`, `olympiad`, `exam`, `scholarship`, `admission_route`. Use this full set in schema/admin from day one (not an artificial olympiad+exam-only launch). Keep the set small; do not invent a kind per exam name. Extend only by explicit owner decision. |
| Categories (subject tags) | Multi-tag via `opportunity_categories` / links. v1 starter set: `mathematics`, `science`, `english`, `computing`, `general_knowledge`, `arts` (extend as editorial needs). Categories describe the competition, not eligibility. |
| Kind vs category vs seed | Kind = type; category = subject tag(s); seed = named exam rows (grows over time, no hard product limit on row count). Example: SOF IMO → kind `olympiad`, categories `mathematics`, scope national. |
| Launch seed content | **Locked:** 63 programmes in `docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md`; slug map in `docs/VAARA_COMPETITIONS_SEED_SLUGS.md`. Import as draft; never invent dates/fees. |
| Geography | Match using **school location / state** and **national** scope. Do **not** use parent home pincode for eligibility/discovery matching in v1. Local/district is not a launch blocker if school locality is missing. |
| Data access | Everything through the existing authenticated **Vaara API** → `DATABASE_URL` (Supabase pooler). No parent mobile Supabase client; do not rely on RLS for parent authz. |
| Editorial ops | Admin page + admin APIs to create/update opportunities and editions. Seed/import may bootstrap; day-to-day refresh is admin-driven. |
| Active edition selection | Show **currently open** published edition(s) only as featured. If multiple sessions are open (e.g. Jan and April), **show both**, labeled by session. Once the actionable registration/event window is past “now”, treat as **closed**. Concurrent independent windows: **show both**; do **not** mark closed unless schedule/status makes that certain (benefit of the doubt). Never pick by lexicographic `edition_key`. |
| Grade equivalence | Admin may maintain optional grade mappings. Do **not** invent CBSE↔IGCSE↔MYP equivalence in product logic. Present the exam’s official eligibility text to parents; unverified board/grade checks stay “needs confirmation.” |
| Search | **Smart search** for v1 (not title/organizer substring only): include title, organizer, and edition label; ranked matches; basic typo/fuzzy tolerance. |
| Pagination | **Owner approved §9.1:** opaque cursor on sort tuple + stable tie-break (`opportunity_id`); `{ items, nextCursor }`; default limit 20, max 50. |
| Plan uniqueness | **Owner locked:** active plans unique on `(child_id, opportunity_id, edition_id)`; `plan_lifecycle` `active` \| `inactive`; same exam + different session dates = separate editions/plans. Unmapped legacy slug kept, shown unavailable, not deleted. Two legacy slugs → same opportunity+edition: keep one active (richer status / newer `updated_at`), mark other inactive. |
| Navigation / Child 360 | Dedicated Competitive Exams surface (peer to Child's Path). Child 360 **Exams** branch links into it where grade-appropriate. G1–5: Interests stays primary; **also show Exams** alongside Interests when catalogue has grade-eligible competitions for that child — **data-driven**, not a hard age ban. |
| Offline | **Online-required for catalogue/detail:** if no network, show a clear no-network / connection error. No offline cache of deadlines for v1. |
| Seed honesty | Never invent dates, fees, or eligibility. Show only verified/known fields; missing dates → “not announced” / incomplete as applicable. Always provide source/official link when parents need more detail. |
| External registration | Show disclosure that Vaara does not register or collect fees; parent leaves the app to the organizer. Require an age/consent acknowledgment before opening the external URL. |
| Kinds at launch | Use the **full agreed kind vocabulary** in schema/admin from day one (not an artificial “olympiad+exam only” subset). Do not invent kinds per exam name. Parent filters should prefer kinds that have published rows (avoid empty dimensions), while admin can assign any locked kind. |
| Deep links | App scheme already `vaara-parents://`. Locked route contract in §8.7. HTTPS/Universal Links optional when a public web URL exists — see §8.7. |

## 2. Reviewed implementation baseline

Repository: `techytalk/vaara-ai-parents`, main snapshot `3e7b29def76a5ffd1263f622dde7720746051948`.

Database reviewed: `vaara-ai-production`, public schema, read-only metadata inspection on 26 September 2026. No parent or child record export was needed. The repository snapshot is not proof of the currently deployed mobile/API version; Cursor must inspect the latest checkout and migrations before implementation.

### 2.1 Existing components

| Component | Observed implementation | Consequence |
| --- | --- | --- |
| `packages/shared/pathways-catalogue.ts` | Static opportunity/pathway catalogue | Changing event facts currently requires a code change; competition facts should become data |
| `packages/shared/pathways-types.ts` | Types include board families, states, stages, streams, qualifications, official sources and review date | Reuse concepts while separating relevance from verified application eligibility |
| `packages/shared/pathways-query.ts` | Builds hub groups from static catalogue; filters board, state, stage and stream | Do not reuse this unchanged as a full competition eligibility engine |
| `apps/api/src/routes/pathways.ts` | Authenticated hub, exploration and item endpoints | Integrate through the existing API architecture |
| `apps/api/src/services/path-explore.ts` | Database-backed exploration and existing-circle discussion integration | Preserve audience controls and thread navigation |
| `path_nodes`, `path_node_roots` | Published exploration content, matching rules and optional `pathway_item_slug` | Link catalogue facts to nodes without copying facts into every board's tree |
| `path_discussion_links` | Links nodes to existing circle messages/threads | Continue using existing conversations |
| `child_opportunity_plans` | Child, opportunity slug, status, target year and ordering | Extend this rather than inventing a second competing saved-plan feature |
| `apps/api/src/lib/child-360.ts` | Primary right-side band becomes opportunities after Grade 10 | Add access for younger children without replacing their interests/pathway interface |
| `children`, `curricula`, `curriculum_grades`, `schools`, `user_locations` | Existing profile and location references | Reuse existing identities and validated curriculum-grade relationships |
| `activities`, `activity_curricula`, `activity_pin_codes` | Activity dates, fees and simple targeting | Do not overload activities with competition editions and qualification rounds |

The live plan table has `UNIQUE(child_id, opportunity_slug)` and statuses `exploring`, `planning`, `this_season`. Its slug has no catalogue foreign key in the reviewed migration. The current mobile plan picker obtains options from the pathway hub and permits exam, olympiad and admission-route kinds.

### 2.2 Existing architecture constraints

- Mobile is React Native / Expo Router.
- The API uses Hono, its own bearer-token authentication and `pg` database access.
- `authMiddleware` checks the authenticated user and session version; child routes use explicit ownership queries.
- Do not assume the mobile app uses Supabase Auth or that `auth.uid()` automatically represents Vaara's current API user.
- Child's Path remains one expandable thread, using the existing warm-white theme. No new bottom tab, radial map or retired three-card hub.
- Ask/Read actions use existing curriculum circles. Exploring a different curriculum does not grant membership in that curriculum's circle.
- Some repository documents still say “not built” although related source and database objects exist. Treat source and live metadata as the reviewed baseline; verify deployment separately.

Relevant repository references:

- `.cursor/rules/childs-path-ui.mdc`
- `docs/CHILDS_PATH_EXPLORATION_TREE.md`
- `docs/CHILDS_PATH_FUNCTIONAL.md`
- `docs/WHAT_NEXT_AND_OPPORTUNITIES.md`
- `docs/CHILD_360.md`
- `packages/db/migrations/076_child_360.sql`

## 3. Product scope

### 3.1 Initial release

- Curated school competitions, olympiads, quizzes, science/project contests and comparable school-age opportunities.
- Local, district, state and national coverage, initially seeded for Hyderabad/Telangana and relevant national opportunities.
- Schema supports international entries, but no implied promise of international coverage.
- Board-independent and board-restricted opportunities.
- Official links, dated verification, fees, registration methods and edition-specific schedules.
- Child-context discovery, search, filters, detail pages and private saved plans.
- Existing admissions/exam plans continue working during the transition.
- Reuse Ask/Read only where existing authorized path-node discussion context is available.

### 3.2 Deferred

- Registration or payment inside Vaara.
- Automatic claims that a child is fully eligible.
- Certificates, marks, rankings or participant directories.
- Automatic publication of scraped/AI-generated facts.
- Public parent-submitted competitions and moderation UI.
- Push reminders and calendar integrations.
- A comprehensive historic participation log.
- Rebuilding career/admissions guidance as part of this feature.

Competition discovery and entrance-exam guidance can share infrastructure, but the default Competitions list must not flood younger children with college entrance exams.

## 4. Core modeling rules

### 4.1 Stable identity, changing edition

`opportunities` represents the enduring competition/exam identity. `opportunity_editions` represents a particular cycle, for example 2026–27. Dates, fees and operational eligibility belong to the edition, not the enduring identity.

One-off events still have one edition. Multiple sessions in one year use distinct edition keys when independently registered; several rounds under one registration remain stages of the same edition.

### 4.2 Independent dimensions

| Dimension | Meaning | Example |
| --- | --- | --- |
| Scope | Organizer-defined reach | National |
| Stage level | Level of this round | District qualifier |
| Venue | Where participation occurs | A Hyderabad school |
| Eligibility geography | Which residents/students/schools may enter | Telangana school students |
| Discovery location | User-selected place to browse | Hyderabad |
| Registration route | How entry is obtained | Through school |
| School role | Host, participant or restriction | Host school |
| Curriculum rule | Board eligibility | All boards / restricted / unknown |

A national competition at a local venue remains national. “Through school” is not proof that entry is restricted to the host school's students.

### 4.3 Distinct state systems

Do not overload one `status` field:

- Editorial publication: `draft`, `in_review`, `published`, `retired`.
- Event lifecycle: `scheduled`, `postponed`, `cancelled`, `completed`, `unknown`.
- Registration state: derived from verified registration windows and overrides.
- Child plan status: `exploring`, `planning`, `this_season`.
- Fact confidence: `verified`, `estimated`, `unannounced`, `unknown`, `disputed` as applicable.

A published record may have unknown dates. A saved plan does not mean the child has registered.

## 5. Proposed database design

All table names below are proposed unless explicitly called existing. Use UUID primary keys, timestamptz audit timestamps and parameterized queries. Use text plus check constraints for small controlled vocabularies unless repository conventions justify enums. Avoid placing core filter fields inside a single unvalidated JSON blob.

### 5.1 `opportunities` — stable catalogue

| Field | Suggested type | Behavior |
| --- | --- | --- |
| `id` | uuid PK | Immutable identity |
| `slug` | text UNIQUE | Stable, URL-safe; preserve migrated slugs |
| `title`, `summary`, `description` | text | Parent-friendly evergreen explanation |
| `kind` | text | **Locked v1:** `competition`, `olympiad`, `exam`, `scholarship`, `admission_route` only |
| `organizer_name` | text | Organizer display name |
| `official_url` | text nullable | Validated public URL |
| `publication_status` | text | Draft through retired |
| `retirement_reason` | text nullable | Explain unavailable/retired entries |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |
| `created_by`, `updated_by` | uuid nullable | Authorized editor identities; private |

Use `opportunity_categories(id, code, label)` and `opportunity_category_links(opportunity_id, category_id)` for multiple subject tags. Categories describe the competition, not a child's eligibility.

**Locked v1 category codes:** `mathematics`, `science`, `english`, `computing`, `general_knowledge`, `arts`. Additional codes may be added editorially without new kinds. An opportunity may link to several categories (e.g. SOF IMO → kind `olympiad`, category `mathematics`).

Parent list filters should only surface kinds/categories that have published seed rows, so empty dimensions are not shown as if covered.

Optional later: normalize organizers when organizer management becomes a real workflow. Do not require a separate organizer entity for launch.

### 5.2 `opportunity_editions` — cycle-specific facts

| Field | Suggested type | Behavior |
| --- | --- | --- |
| `id`, `opportunity_id` | uuid | PK and FK |
| `edition_key` | text | Stable cycle key; unique with opportunity ID |
| `edition_label` | text | Display label, e.g. 2026–27 |
| `scope_level` | text | school, local, district, state, national, international |
| `delivery_mode` | text | online, in_person, hybrid, unknown |
| `publication_status` | text | Editorial gate |
| `event_status` | text | Lifecycle, separate from publication |
| `registration_method` | text | direct, through_school, nomination, qualification, mixed, unknown |
| `registration_url` | text nullable | External application destination |
| `registration_instructions` | text nullable | Explain process and school coordinator role |
| `eligibility_summary` | text | Plain-language official requirements |
| `curriculum_policy` | text | all, restricted, unknown |
| `eligibility_completeness` | text | partial, reviewed_complete; never inferred from filled fields |
| `fee_status` | text | free, paid, varies, unknown |
| `official_notice_url` | text nullable | Cycle-specific bulletin |
| `last_verified_at`, `review_due_at` | timestamptz nullable | Editorial freshness |
| `verified_by` | uuid nullable | Private reviewer identity |
| `version` | integer | Optimistic edit concurrency |
| `created_at`, `updated_at` | timestamptz | Audit |

Constraints: unique `(opportunity_id, edition_key)`; forbid publishing restricted curriculum eligibility with no allowed curriculum rules. A new edition begins as draft; cloned facts must be explicitly reverified. Copying an edition never copies its verified status.

### 5.3 `opportunity_stages` — rounds and progression

Fields: `id`, `edition_id`, `stage_key`, `title`, `stage_level`, `sequence`, `entry_method`, `qualification_description`, `event_status`, `description` and audit fields.

Unique `(edition_id, stage_key)`. Store progression in `opportunity_stage_links(from_stage_id, to_stage_id, relation, conditions_text)` where relation is initially `qualifies_for`. Reject cross-edition edges, self-edges and cycles. This supports multiple regional qualifiers feeding one final without pretending every competition is a simple linear chain.

For simple competitions, create one stage. Never create duplicate opportunity identities for each qualifying round.

### 5.4 `opportunity_schedules` — multiple dates and windows

A separate schedule entity is necessary for school-specific cutoffs, several exam dates and postponed rounds.

Fields:

- `id`, `edition_id`, optional `stage_id`, optional `school_id`.
- `schedule_type`: registration, event, result, school_deadline.
- `label`, `date_status`: verified, estimated, unannounced, unknown, disputed.
- `precision`: date, datetime, month, window, unknown.
- `starts_on`, `ends_on` as nullable dates for date-only windows.
- `starts_at`, `ends_at` as nullable timestamptz for exact moments.
- `timezone` as IANA zone when timing semantics require it.
- `expected_period_text` for explicitly approximate timing, without invented exact dates.
- `registration_override`: null, suspended, closed, open; an override requires source, reviewer and review expiry.
- `source_id`, `verified_at`, `superseded_at`, `notes`.

Date-only and datetime representations are mutually exclusive. Validate end >= start when both exist. Cross-table constraints must ensure a referenced stage belongs to the same edition. Use composite FKs or equivalent database enforcement, not just UI validation.

Date-only registration deadlines are inclusive in the organizer's stated local timezone. Preserve a date-only representation instead of presenting fabricated midnight precision. If closing semantics are unspecified, label that limitation and avoid a precise countdown.

A date-only start/end window can support day-level opening/closing. An end-only verified cutoff may support “closes on,” but does not prove registration has opened. A future exam date never implies registration is open.

### 5.5 Eligibility records

Use structured, reviewed rules for predictable comparisons, with descriptive text for conditions the system cannot safely evaluate.

`opportunity_eligibility_rules` fields:

- `id`, `edition_id`, optional `stage_id`, `alternative_group`.
- `rule_type`: curriculum, grade, age, school, geography, qualification, other.
- `operator`: in, between, equals, descriptive.
- `values` JSONB: validated against a versioned schema for the specified rule type.
- `rule_text`, `source_id`, `verified_at`.
- `evaluation_mode`: automatic, manual_review, information_only.
- `rules_schema_version`.

Rules inside an alternative group are ANDed; alternative groups are ORed. Global mandatory conditions must be explicitly applied to all alternatives. Do not silently interpret an empty rule set as universally eligible.

Typed value contracts:

| Rule | Required structured values |
| --- | --- |
| Curriculum | Existing curriculum IDs or canonical board-family codes; explicit identifier type |
| Grade | Allowed existing curriculum-grade IDs; optional reviewed equivalence mapping |
| Age | Official cutoff date and allowed birth-date interval, including boundary inclusivity |
| School | Allowed school IDs or explicit membership/affiliation condition |
| Geography | Canonical geography IDs and basis: residence, school or domicile |
| Qualification | Required prior stage/result or qualification; manual unless reliably known |
| Other | Plain requirement and explicit manual-review status |

Do not compare UUID grade IDs as numeric ranges. Do not assume similarly numbered Cambridge years, CBSE grades and MYP years are equivalent. For broad “Classes 6–8 or equivalent,” create reviewed mappings to actual `curriculum_grades` records; leave uncertain mappings unresolved.

For curriculum policy `all`, the board check passes, but age, class, school and other conditions still apply. `unknown` always remains an unknown check.

### 5.6 `opportunity_locations`

Fields: `id`, `edition_id`, optional `stage_id`, `role`, `country_code`, `state_code`, optional `district_code`, optional `city_code`, `locality`, `pin_code`, optional `school_id`, `venue_name`, `address_text`, `source_id`.

`role`: eligibility_residence, eligibility_school, eligibility_domicile, venue, host_school, participating_school, discovery_area.

Use canonical geography identifiers when available; display names are not matching keys. Inspect existing reference geography before creating a new geography table. The reviewed profile metadata does not establish a canonical district relationship. If absent, add a validated district lookup/mapping as a prerequisite to accurate district filtering.

Hyderabad as a browsing city must not be equated with Hyderabad administrative district. Some relevant schools may lie in surrounding districts. A district restriction is evaluated using the organizer's stated basis, not the parent's selected browsing city.

A pincode can have ambiguous geographic mappings. Do not infer domicile, district eligibility or distance from it without adequate reference data. If no coordinates exist, label matches as “in your selected area,” not “within 5 km.”

**Owner locked (v1 geography matching):** use the child's **school location / state** (and national scope) for discovery and eligibility geography. Do **not** match on the parent's home pincode for now. National exams are available regardless of school state. State-scoped exams match when the school's state matches. Local/district matching is optional and only when school locality exists; missing local data must not block national/state listings.

### 5.7 `opportunity_fees`

Fields: `id`, `edition_id`, optional `stage_id`, `label`, `amount` numeric(12,2), `currency` char(3), `fee_type`, `applicability_text`, optional `eligibility_group`, `is_mandatory`, `source_id`, `verified_at`.

`fee_type`: registration, stage, school_admin, optional_material, concession, other. Amount must be non-negative. Unknown amounts are null, never zero. Concessions use a final applicable amount and explanation; do not model them as a negative entry fee.

Edition `fee_status` is editorially supported, not inferred from missing fee rows. “Free” requires confirmation that the described entry route has no mandatory entry charge. Show optional materials separately. If school charges or category concessions are not known for the child, display “Fee varies — check details.” Never present the sum of alternative fee categories as a total.

### 5.8 `opportunity_sources` and editorial audit

Fields: `id`, `edition_id`, `url`, `title`, `publisher`, `source_type`, `published_on`, `accessed_at`, `verification_status`, `verified_by`, `notes`.

Source types: organizer_page, official_bulletin, school_notice, government_notice, secondary_reference. A source row does not automatically verify every field in an edition: schedules, fees and eligibility rules reference the source that supports them.

Add an editor-only `opportunity_change_log` containing entity, ID, actor, timestamp, reason and before/after field changes. No child data in editorial audit records. Preserve superseded notices and dates for provenance, but parent views use only active values.

### 5.9 Child's Path links

`path_node_opportunities(path_node_id, opportunity_id, relationship, sort_order)` with a composite primary key and FKs. Relationship: explore_now, prepare_for_later, related.

One competition can appear under several curriculum paths without duplicating its data. Path placement is editorial relevance; it cannot grant eligibility or determine registration state.

Keep existing `pathway_item_slug` behavior for career/admissions content during migration. Do not force every pathway route into the opportunity table.

### 5.10 Extend existing `child_opportunity_plans`

Add nullable `opportunity_id` and `edition_id` initially. Preserve `opportunity_slug`, plan ID, child ID, status, target year and ordering. A populated edition must belong to the populated opportunity.

**Owner locked:** allow the same exam in the same year with **different start dates** (sessions) as separate plan targets; distinguish **active vs inactive** plan rows. Uniqueness on **`(child_id, opportunity_id, edition_id)`** for active plans (Jan vs April = two edition rows), plus `plan_lifecycle` `active` | `inactive`. Do not key uniqueness on free-text slug + raw start date once IDs exist. Migration: two legacy slugs → same opportunity+edition → keep one active (richer status / newer `updated_at`), mark other inactive; unmapped slug → keep, show unavailable, do not delete.

Rules:

- Existing exploring / planning / this_season statuses remain for parent intent.
- Saving does not mutate child identity or imply registration/payment.
- Changing edition requires an explicit parent action; a new year never silently replaces the saved edition.
- `target_year` is a planning preference, not verified competition timing.
- Old saved editions remain accessible with a previous-cycle label.
- Retired opportunities remain readable from saved plans with a status explanation.
- Unresolved legacy slugs stay preserved until mapped; do not delete parent plans.
- Full multi-year registration/participation history requires a later separate design.

## 6. Constraints, indexes and access boundaries

### 6.1 Integrity

- Foreign keys on all entity relationships; index referencing columns used for joins.
- Restrict deletion of opportunities/editions referenced by plans; retire them instead.
- Child-plan deletion follows existing child deletion behavior.
- Composite constraints ensure stage, schedule, fee and plan edition consistency.
- Unique category/path links; stable slugs; duplicate-edition protection.
- Validate JSON rule payloads in the API; database checks enforce essential type/version invariants.
- Server-controlled review identity, publication state and timestamps.
- Invalid date ranges, negative fees and contradictory all-board/restricted configurations block publication.

### 6.2 Initial index candidates

- `opportunity_editions(opportunity_id, edition_key)` unique.
- Published editions by `(scope_level, updated_at, id)` as an initial listing access path.
- Schedules by `(edition_id, schedule_type)` and relevant closing-date columns for registration filtering.
- Rules and locations by edition/stage; geography lookup by role + canonical state/district.
- Reverse category and path-node joins where list queries use them.
- Existing child-plan child/order index plus child/opportunity uniqueness.

Final indexes must follow actual query predicates and representative query plans. Avoid speculative indexes on every column. List endpoints should batch related data rather than issue a per-card query. Add full-text search only if simple indexed search proves insufficient.

### 6.3 Authorization

Continue using the existing authenticated Vaara API. Every plan read/write must verify `children.user_id = authenticated user ID`. Never trust a request-body user ID. An unknown or unowned child returns the existing consistent not-found response.

Parent clients can read published catalogue content only. Editor-only endpoints must verify server-side role permissions. Retired content can be read where needed for old plans; drafts must not leak through IDs, source joins or legacy routes.

**Owner locked:** parent and catalogue reads/writes go through the Vaara API only (`pg` pool + `DATABASE_URL`). Do not grant parent mobile clients direct Supabase/Data API table access for this feature. Do not introduce `auth.uid()` RLS as the parent authorization model. Application ownership checks on the API remain mandatory. If any table is ever exposed via Supabase schemas, deny broad `anon`/`authenticated` grants; that is defense-in-depth, not the primary auth path.

## 7. Matching and eligibility evaluation

Return separate objects for discovery relevance, application checks and registration state.

### 7.1 Relevance

Suggested values: `relevant_now`, `prepare_for_later`, `outside_selected_context`, `unknown`.

Inputs include child grade/curriculum, published path links, selected discovery location and category. Interests may rank a result; they never satisfy an eligibility condition. Stream selection in a pathway preview is not a verified subject record.

### 7.2 Eligibility

Evaluate each required rule as pass, fail or unknown, with a human-readable reason. For AND groups, a failed mandatory rule fails the group; otherwise any unknown makes the group unknown. For OR alternatives, a passing alternative can satisfy the alternatives; all failed alternatives fail; otherwise the result is unknown. Incomplete rule coverage prevents an overall fully matched result even if every encoded check passes.

API summary values: `known_requirements_match`, `does_not_match`, `needs_confirmation`. Initial UI copy: “Matches the requirements we could check,” “A requirement does not match,” or “Check these requirements.” Do not use an unqualified “Eligible” badge.

Birth-date checks use official cutoff rules, not today's age. Approximate `age_years` cannot conclusively satisfy a strict birth-date boundary. Missing DOB, domicile, school nomination or qualification remains unknown.

### 7.3 Registration

Suggested response states: `open`, `opening_soon`, `closed`, `dates_unannounced`, `check_with_school`, `suspended`, `cancelled`, `unknown`.

Precedence:

1. Cancelled/suspended authoritative status overrides date calculations.
2. Use only active verified schedules for the applicable stage/route/school.
3. Known start and end can derive open/closed in the organizer timezone.
4. Through-school entry without the school's confirmed cutoff displays “Check with school.” An organizer deadline may appear separately.
5. Estimated/unannounced/unknown dates never generate an “Open now” claim.
6. Multiple routes produce route-specific statuses; a later final does not reopen a closed first-round application.

Expose the evaluated time and next state-change time for cache handling. Closing-date filters must distinguish the user's actionable deadline from a general organizer deadline.

## 8. Parent app behavior

### 8.1 Navigation

**Owner locked:** ship a dedicated **Competitive Exams** surface (same product class as Child's Path): full catalogue, dates, eligibility guidance, and bucket-based suggestions. Do not replace Child's Path thread UI with a card hub.

Child's Path and Child 360 may deep-link into that surface; they are not the only home for the feature. Exact chrome placement (tab vs stack route vs More row) must follow existing app navigation patterns without adding a new bottom tab unless the owner later requests one.

Child 360: retain grade-appropriate primary branches. Provide access to saved competition plans across school grades through a secondary action/list. Do not replace Grade 1–5 interests or Grade 9–10 pathway choices with a competition-only branch.

Keep selected child when entering from Child 360 or Child's Path. If child context is ambiguous (e.g. multi-child entry), ask the parent to choose—questions may be grouped on one screen. Do not silently save against the first child.

**Owner locked — Child 360:** Grade 1–5 keep Interests as the primary right-band experience. Show an **Exams** entry together with Interests when there is at least one published competition whose grade/eligibility rules can match that child's class (data-driven). If none match that grade, hide Exams for that child. Older grades use the Exams / opportunities branch to open the same Competitive Exams surface. Do not replace Interests with Exams-only.

### 8.1.1 Suggestions (bucket personalization)

**Owner locked:** do not personalize per individual child profile beyond class, curriculum and school location. Daily batch precomputes suggestion sets keyed by class + curriculum + school geography (e.g. state). All children in that bucket see the same “suitable for your class” set. The full catalogue remains separately browsable.

### 8.1.2 Offline

**Owner locked:** catalogue list/detail and registration state require network. On failure, show a clear **no network / connection** message and retry. Do not present cached deadlines as current in v1.

### 8.7 Deep links (owner locked contract)

Existing app scheme: `vaara-parents` (see mobile `app.json`).

| Purpose | URL |
| --- | --- |
| Catalogue home (optional child) | `vaara-parents://opportunities` or `vaara-parents://opportunities?childId=<uuid>` |
| Opportunity evergreen | `vaara-parents://opportunities/<slug>` |
| Specific edition | `vaara-parents://opportunities/<slug>/editions/<editionId>` |
| Child 360 saved plans | `vaara-parents://child-360/<childId>/opportunities` |

Resolve retained slug aliases to the canonical slug; retired opportunities open with retirement status rather than a hard 404.

**Website:** not required for deep links to work inside the installed app. A public HTTPS site (e.g. `https://vaara.ai/opportunities/...`) makes sharing easier via **Universal Links (iOS) / App Links (Android)** so the same link opens the app when installed, or the web page otherwise. That is an optional packaging step on top of the `vaara-parents://` contract above.

### 8.2 List screen

Top context: selected child, board/class, browsing area and a small “Change” action. Changes to filters are temporary browsing state.

Recommended list controls:

- Segments: For your child, All, Saved.
- Scope filters: School & local, District, State, National, International.
- Additional filters: subject/category, free/paid, registration status and delivery mode.
- Search by title/organizer.
- Sorting: relevance by default; closing soon when requested.

Scope filters refer to competition scope. A national competition with a district qualifier stays under National, while its stage is labeled on the detail page. Location filtering can still include its local venues. Avoid duplicate cards for the same selected edition.

Unknown-fee entries do not pass “Free only.” Unknown eligibility is not hidden as a definitive rejection. “For later” must be visibly distinguished from competitions actionable now.

### 8.3 Card content

Show title, edition label, scope, category, concise class/age requirement, fee summary, registration state/deadline and entry route. Use one primary “View details” action and a compact save control.

No invented participant counts, unsupported urgency or “best for your child” claims. Format date and currency for display without changing organizer timing semantics.

### 8.4 Detail screen

Order content by parent decision:

1. Name, organizer, edition and event status.
2. What the child does and why a parent might consider it.
3. Who can apply: official requirement summary plus child-specific checks.
4. Free/paid details and compulsory versus optional charges.
5. Registration route, actionable deadline and school instructions.
6. Round timeline and alternate exam dates.
7. Venue/delivery information, separately from geographic eligibility.
8. Official sources and last verified date.
9. Save to child's plan; official registration or school action; Ask/Read where supported.

For through-school entry, label the action “How to apply through school” rather than a misleading direct “Register” button. For unknown dates, display “Dates not announced for this edition.” A closed entry window may still offer official information, but must not show an active-looking registration CTA.

**Owner locked — external registration:** before opening an organizer URL, show disclosure that Vaara does not register the child or collect exam fees, and that the parent is leaving the app. Require an age/consent acknowledgment, then open the link.

An edition selector clearly separates past cycles. Do not automatically label the lexicographically latest edition as open/current.

**Owner locked — featured / current editions:**

1. Prefer published editions whose registration (or actionable entry window) is **open now**.
2. If several are open (Jan session + April session, or concurrent windows), **feature all of them**, each labeled (e.g. “Jan 2026”, “Apr 2026”).
3. After the relevant window is past “now”, those sessions are **closed** (even if still published).
4. If uncertain whether a window has closed, **do not** mark closed (benefit of the doubt) unless event_status is cancelled/suspended/completed or verified schedules prove closed.
5. If none are open: show evergreen overview + closed/past editions without an active registration CTA; do not invent an open current edition.

**Owner locked — plan uniqueness:** active plans unique on `(child_id, opportunity_id, edition_id)` with `plan_lifecycle` active|inactive (see §5.10).

### 8.5 Saved plans

Reuse Exploring / Planning / This season. Let parents select an edition or leave it as a general future interest. Show “Saved for [child]” after success. Saving again updates/returns the existing plan rather than duplicating it. Preserve the existing undo behavior where supported.

### 8.6 Errors and empty states

| Situation | Behavior |
| --- | --- |
| No matching listings | “No verified listings match these filters yet” and Clear filters |
| Location missing | Show relevant national entries; offer area selection for local content |
| District unresolved | Explain district results need location confirmation; do not claim none exist |
| No published edition | Show evergreen overview and “Current edition details not available” |
| Offline cached detail | Mark last refresh; do not present cached deadline status as freshly confirmed |
| Save fails | Keep the screen state and allow retry without optimistic success text |
| Child removed/unowned | Return safe not-found behavior and prompt valid child selection |
| Old deep link | Resolve stable slug or retained alias; show retirement status rather than breaking |

Maintain accessibility labels, readable text scaling, adequate touch targets and status text in addition to color.

## 9. API contracts

All endpoints below are proposed under the existing `/v1` API and existing bearer authentication.

| Method and path | Purpose |
| --- | --- |
| `GET /v1/opportunities` | Published catalogue search and filtered child-context discovery |
| `GET /v1/opportunities/:slug` | Evergreen overview, edition summaries and selected edition |
| `GET /v1/opportunities/:slug/editions/:editionId` | Full edition details and evaluated child context |
| `GET /v1/pathways/nodes/:nodeId/opportunities` | Published links relevant to that path node |
| Existing `/v1/me/children/:childId/opportunity-plans` | List/create private plans, extended with IDs |
| Existing plan `PATCH` and `DELETE` routes | Update/remove plans with existing ownership checks |

List parameters: `childId`, `q`, `scope`, `category`, `feeStatus`, `registrationStatus`, `mode`, canonical browsing geography, `sort`, `cursor`, `limit`. Apply strict allowlists, size bounds and stable pagination. Recommended maximum page size: 50.

**Owner locked — search:** smart search over title, organizer name, and edition label; return ranked results; apply basic typo/fuzzy tolerance. Do not rely on exact substring-only matching.

### 9.1 Pagination (owner approved)

Problem: `page=2` breaks when rows insert/delete between requests. “Closing soon” often shares the same deadline, so a cursor of only `deadline` can skip or duplicate cards.

**Locked solution:**

- Default `limit` 20, max 50.
- Sort keys (examples):
  - `relevance` → `(relevance_score DESC, opportunity_id ASC)`
  - `closing_soon` → `(registration_close_at ASC NULLS LAST, opportunity_id ASC)`
- Opaque `cursor`: base64 of the last row’s sort tuple, e.g. `{"registration_close_at":"2026-10-01T18:30:00Z","opportunity_id":"…"}`.
- Next page: `WHERE (close_at, id) > (cursor.close_at, cursor.id)` under the same sort (or the SQL equivalent for DESC sorts).
- Response: `{ items, nextCursor | null }`. No total-count requirement for v1.

Returned card shape:

```json
{
  "id": "<opportunity-uuid>",
  "slug": "sample-science-challenge",
  "title": "Sample Science Challenge",
  "edition": {"id": "<edition-uuid>", "label": "2026–27"},
  "scope": "national",
  "fee": {"status": "unknown", "label": "Fee not confirmed"},
  "registration": {"state": "dates_unannounced", "deadline": null},
  "relevance": {"state": "relevant_now", "reasons": ["Relevant to this grade"]},
  "eligibility": {"state": "needs_confirmation", "unknownChecks": ["School participation"]},
  "lastVerifiedAt": null,
  "savedPlanId": null
}
```

This is illustrative data, not a real competition or verified fact.

Return server-computed status and reasons so mobile does not implement a conflicting eligibility engine. Personalized results must not enter a globally shared cache. Bulk-load saved-plan flags for a page. Keep private reviewer identities out of parent responses.

Plan requests accept `opportunityId`, optional `editionId`, existing status and optional targetYear. During compatibility, accept old `opportunitySlug` requests, resolve known slugs server-side and preserve readable unresolved legacy records. Reject arbitrary new unknown slugs; a plan must reference an available catalogue identity or an explicitly supported legacy item.

## 10. Discussion integration

Launch behavior: when entered through a path node that supports Ask/Read, retain its node context and current authorized curriculum-circle behavior. Show “Where will this be posted?” before sending.

A standalone catalogue detail without an authorized mapped discussion context must not fabricate a global thread or widen the audience. It may link back to an appropriate path node; otherwise omit Ask/Read in v1.

Later, if competition-centric discussion lookup is required, add an opportunity-to-message reference table. Every read still checks circle access. Store references, not duplicate message bodies. Private child IDs and saved-plan status must never be added to public discussion metadata.

## 11. Editorial workflow and maintenance

Minimum publish workflow:

1. Create/reuse enduring opportunity identity; check organizer and slug for duplicates.
2. Create edition as draft.
3. Record official source and cycle.
4. Enter scope, registration route, eligibility, fees and schedules; mark unknowns honestly.
5. Validate cross-field integrity and rule payloads.
6. Reviewer checks source coverage and publication preview.
7. Publish only with explicit authorization and store the review event.
8. Schedule internal review dates for changing facts.
9. Correct changed dates by superseding old schedule data and invalidating caches.
10. Retire/cancel with a reason; preserve old plans and links.

Initial content entry can use a validated import script or existing admin tooling. A new admin web application is not required for launch. The import must support dry-run validation, deterministic external keys and idempotent upserts; it must never publish by default.

Suggested review cadence, configurable rather than a factual guarantee: weekly while registration is open, before a deadline, and whenever an official notice changes. Review dates do not mean the source was actually rechecked; only a completed verification updates `last_verified_at`.

Do not import estimated historical dates as current confirmed schedules. Do not advertise coverage as “all competitions”; local school events are inherently incomplete unless verified directly.

## 12. Cache and notification behavior

Reuse existing cache utilities after inspecting their current conventions. Cache catalogue content by catalogue/edition revision and filter context. Keep ownership checks outside shared caches.

A card's registration status must expire no later than its next known transition. On publish, update, cancellation, deadline correction or retirement, invalidate affected detail/list caches. Prefer fresh reads for critical registration actions.

No push reminders in the first release. If added later, require per-child-plan opt-in, confirmed applicable deadlines, timezone-aware scheduling, quiet-hours compliance and idempotent delivery. Editing a deadline must cancel/reschedule pending reminders. Never notify “your child is eligible” based on relevance alone.

## 13. Migration and compatibility plan

### Phase A — inventory and dry run

- Recheck latest repository instructions, schema and deployed API/mobile versions.
- Inventory static opportunity items, path slug references and aggregate legacy-plan mappings.
- Separate evergreen pathways from opportunity kinds.
- Identify unknown slugs without deleting or rewriting them.
- Decide canonical grade/geography mapping and existing admin access conventions.

### Phase B — additive database objects

- Add new tables and nullable plan references through repository migration conventions.
- Do not use the old suggested migration numbers in stale docs; allocate the next valid migration at implementation time.
- Add constraints/indexes safely for actual table sizes.
- No removal of existing columns or endpoints.

### Phase C — catalogue import

- Preserve existing slugs and produce a deterministic slug-to-ID mapping.
- Import supported opportunity identities first.
- Existing general descriptions do not justify fabricated current editions, fees or dates.
- Create published editions only after source review; otherwise keep identity content available with no current details.
- Backfill only verified mappings into plans; validate counts and orphan reports.
- Keep non-migrated admissions/routes working through a compatibility resolver.

### Phase D — API transition

- Introduce database-backed endpoints and ID-based plan writes behind a feature flag.
- Adapt legacy detail/hub resolution for migrated opportunity slugs; evergreen pathways remain in their existing catalogue until separately migrated.
- Each identity has one authoritative fact source. Do not maintain conflicting live details in TypeScript and database.
- Older app requests remain supported during the agreed compatibility window.

### Phase E — mobile release

- Release list/detail and all-school-grade saved-plan access.
- Preserve current thread UI and navigation history.
- Pilot with a small manually verified dataset before wider content coverage.

### Phase F — cleanup

- Only after compatibility evidence: remove redundant static opportunity facts and tighten plan constraints where mappings are complete.
- Retain slug redirects and unresolved-plan read behavior until explicitly resolved.
- Do not add new competition kinds to global pathway types without checking every consumer.

Rollback: switch discovery back using the feature flag, retain additive tables and saved data, and preserve ID/slug compatibility. Do not drop new plan data to roll back the UI.

## 14. Suggested implementation file map

Paths marked “new” are proposals, not files created by this document.

| Area | Existing or proposed target |
| --- | --- |
| Migration | New file under `packages/db/migrations/` |
| Shared contracts | New `packages/shared/opportunities-types.ts` |
| Pure evaluation rules | New `packages/shared/opportunities-evaluation.ts` |
| DB-backed service | New `apps/api/src/services/opportunities.ts` |
| Catalogue routes | New `apps/api/src/routes/opportunities.ts`; register in API index |
| Plan extension | `apps/api/src/routes/child-360.ts`, `apps/api/src/lib/child-360.ts` |
| Path integration | `apps/api/src/routes/pathways.ts`, `apps/api/src/services/path-explore.ts` |
| Legacy compatibility | `packages/shared/pathways-query.ts` and catalogue consumers; avoid DB access inside shared pure helpers |
| Mobile API | `apps/mobile/src/lib/api.ts` |
| Catalogue list/detail | New Expo routes under `apps/mobile/app/(app)/opportunities/` |
| Child plan screens | Existing `child-360/[childId]/opportunities/index.tsx` and `form.tsx` |
| Thread action | Existing `pathways/index.tsx` and `PathExploreThread.tsx` |
| More shortcut | Identify current More screen in latest checkout; optional product decision |

Keep DB queries server-side. Pure evaluators receive normalized data; shared mobile code must not import database clients or server-only secrets.

## 15. Acceptance criteria

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Same competition appears under CBSE and IB paths | One catalogue identity, linked to both |
| A02 | Fee or deadline changes next year | New edition; old saved edition preserved |
| A03 | Fee absent | Unknown, never Free |
| A04 | All-board competition, child meets grade mapping | Board check passes; other checks still evaluated |
| A05 | Restricted-board competition, child outside allowed board | Requirement mismatch, no eligible claim |
| A06 | Curriculum rule not verified | Needs confirmation |
| A07 | Strict age cutoff, only approximate age known | Age check unknown |
| A08 | National event held locally | National scope, local venue |
| A09 | Through-school route, school cutoff unknown | Check with school; organizer deadline separate |
| A10 | Two exam dates and one entry window | Both dates retained; one correct registration state |
| A11 | Parent browses another state/grade | Profile and membership unchanged |
| A12 | Parent changes selected child | Matching and plan ownership use selected child |
| A13 | Another parent's child ID sent to plan endpoint | No read/write access |
| A14 | Draft edition requested directly | Not exposed |
| A15 | Competition cancelled after saving | Plan remains; cancellation visible; active registration CTA removed |
| A16 | Closed registration but future final | Entry remains closed |
| A17 | Grade 5 parent opens competitions | Can browse/save without replacing interests branch |
| A18 | Existing admission/exam plan | Still readable during catalogue migration |
| A19 | Save repeated concurrently | One plan, deterministic response |
| A20 | New edition published | No silent change to parent's saved edition |
| A21 | School/district unresolved | Unknown geography eligibility; national content remains accessible |
| A22 | Deadline passes while data cached | State updates at boundary; no stale open badge |
| A23 | Child browses DP from MYP | No DP-circle access gained |
| A24 | Parent opens standalone opportunity without discussion context | No fabricated or unauthorized thread |
| A25 | Import repeated | No duplicated identities, editions or plans |
| A26 | Stage belongs to different edition | Database/API reject invalid reference |
| A27 | Review source supports dates but not fees | Fees remain unknown |
| A28 | Optional materials sold for free-entry event | Entry and optional costs clearly separated |
| A29 | Historical date copied into draft | Not automatically verified or presented as current |
| A30 | Unknown existing plan slug | Parent data preserved and marked unavailable pending mapping |

## 16. Verification strategy for Cursor

Use focused tests where mistakes would affect eligibility, dates, privacy or data preservation:

- Unit tests for AND/OR/unknown evaluation, exact birth-date boundaries, school-route deadlines, date-only timezone boundaries and multi-round registration.
- Database/API integration tests for ownership, draft access, cross-edition integrity, migration mapping and concurrent duplicate saves.
- Representative migration dry run with legacy slugs and rollback flag behavior.
- Mobile manual checks for multi-child selection, Grade 5 access, thread preservation, long text, offline display and external links.
- Query-plan inspection on representative catalogue sizes for filters and deadline sorting.

Do not write snapshot tests merely to mirror copy or table field lists. Do not run destructive tests on production. Verify production changes only through the owner's authorized implementation workflow.

## 17. Analytics

Suggested events: `opportunity_list_viewed`, `opportunity_filter_changed`, `opportunity_detail_viewed`, `opportunity_saved`, `opportunity_plan_status_changed`, `opportunity_official_link_opened`.

Include opportunity/edition IDs, entry surface and coarse filter context where appropriate. Do not send child name, DOB, private notes, exact address or free-form eligibility disclosures. An official-link click is not a completed registration. Review existing analytics conventions before adding properties.

## 18. Illustrative records for implementation tests

These are fictional fixtures, not recommended competitions or real schedules.

| Fixture | Configuration | Expected behavior |
| --- | --- | --- |
| Local Art Meet | Local scope, one stage, free confirmed entry, date unannounced, all boards | Free badge; no Open now claim |
| National Science Challenge | National scope; district, state and final stages; through-school application | National listing; stage timeline and school instructions |
| School Quiz | Restricted to one school, verified eligibility and fixed fee | Only that school matches; nearby parents do not automatically qualify |
| Coding Challenge | Online delivery, restricted country eligibility | Online does not imply global eligibility |
| Future Maths Contest | Identity published, no reviewed current edition | Overview only; current dates unavailable |

## 19. Recommended implementation sequence

1. Agree on remaining product decisions in section 20.
2. Inspect latest code, live constraints and authentication boundaries.
3. Define shared contracts, geography mappings and publication validation.
4. Create additive database migrations and dry-run importer.
5. Implement catalogue services, deterministic evaluations and compatibility resolution.
6. Extend private plans with stable IDs.
7. Build list/detail screens and connect the existing thread.
8. Make saved plans accessible across school grades.
9. Seed a small official-source-verified catalogue.
10. Verify acceptance cases, pilot, then expand coverage.

## 20. Decisions still open

Locked items moved to §1.2. Remaining owner decisions (do not invent answers during implementation):

| Decision | What is already in this doc | What still needs owner answer | Consequence if left open |
| --- | --- | --- |
| Named launch seed batch | Locked to `docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md` (63 programmes) + slug map `docs/VAARA_COMPETITIONS_SEED_SLUGS.md` | Editorial publish cadence after draft import | — |
| Cancelled / retired / completed matrix (§ gap 13) | Separate publication vs event lifecycle; A15 cancels CTA; retired readable from plans | Full parent UX matrix: list visibility, detail CTAs, allowed plan create/update per state | Inconsistent buttons and saves |
| Empty / pilot mode (§ gap 20) | `app_feature_flags.competitive_exams` defaults **false** | Confirm: hide entry when flag off; when on with few drafts published, show whatever is published | Blank or premature empty screen |
| Analytics privacy (§ gap 23) | Event names listed | Confirm: same retention/sampling as existing Vaara analytics | Privacy drift |
| Standalone discussions | Only existing authorized path-node context for v1 | Confirm still accepted | Avoids new discussion system |
| Reminder scope | Defer | Confirm still deferred | No scheduler in v1 |
| Admin auth model | `opportunity_editors` table in migration 077 | Who is inserted as first editor (user_id allowlist)? | Cannot ship admin safely |
| Extra kinds beyond the five | Five kinds locked in schema | Add `sports` as kind? (CBSE sports uses category `sports` under kind `competition` for now) | Schema churn |

## 21. Cursor handoff instruction

Implement this feature only when the product owner instructs you to do so. Recheck repository rules and live schema before generating migrations. Treat the proposed names and contracts here as the design baseline, reconcile any newer implementation, and report material differences before proceeding. Preserve the expandable Child's Path, existing authentication, parent ownership checks, saved plans, stable slugs and old app compatibility. Never invent live competition dates, fees or eligibility rules to fill seed data. Keep unconfirmed product decisions visible rather than silently marking them approved.
