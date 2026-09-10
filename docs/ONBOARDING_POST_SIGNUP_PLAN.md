# Post-Signup Onboarding Plan

This document specifies the work that follows the signup redesign in
`ONBOARDING_SIGNUP_REDESIGN.md`. That redesign cut the path to home down to
sign up → PIN → school → board/class. This plan covers everything we
deliberately moved *out* of signup and now owe the parent inside the app:
child identity, additional children, and repairing incomplete school data.

No code changes have been made for this plan yet.

## Where phase 1 left us

| Collected at signup | Deferred to in-app |
| --- | --- |
| Account (Apple / Google / email) | Child nickname |
| PIN, locality | Child date of birth |
| School (mandatory) | Additional children |
| Board, class (no defaults) | Housing community name |

A parent who finishes signup has one child row carrying school, board and class,
with `nickname` and `date_of_birth` left `null`. They land on the payoff screen
listing their five circles, then home.

The gap: **nothing ever asks for the deferred fields.** A parent can use Vaara
indefinitely with a child shown as "Child" unless they find
**More → My Children** themselves.

## Principles for this phase

1. **Never block.** Every prompt in this phase is dismissible. Nothing here may
   gate access to the app, or we have reintroduced the problem phase 1 solved.
2. **Ask after value, not before.** A parent who has read a post from their
   child's class understands why we want the child's details. A parent who has
   seen nothing does not.
3. **Search and suggestions are different tools.** Phase 1 removed the location
   filter from school *search* because it hid correct answers. Locality
   filtering is still right for *suggestion* lists, where the parent is browsing
   rather than naming something. Do not "re-fix" the search filter.
4. **Don't nag.** Dismissals must be remembered and re-prompts must back off.
5. **No silent defaults.** Same rule as phase 1: an unset field stays unset
   rather than being guessed.

---

## A. Post-signup tour and child identity

### Goal

Introduce the app, get the parent to their first meaningful action, and only
then ask for the child's private details.

### Sequence

```
Payoff screen ("You're in 5 circles")
      |
      v
+--------------------------------------------+
|  TOUR 1 of 3 — Your circles                |
|  "Each circle is a group of parents you     |
|   share something with."                    |
|  [ Next ]                       Skip tour   |
+--------------------------------------------+
      |
      v
+--------------------------------------------+
|  TOUR 2 of 3 — Ask anything                |
|  "Post a question to your school or         |
|   locality circle. You stay anonymous."     |
|  [ Ask your first question ]  [ Later ]     |
+--------------------------------------------+
      |
      v
+--------------------------------------------+
|  TOUR 3 of 3 — Your child                   |
|  "Add a private nickname so your circles     |
|   make sense to you. Other parents never    |
|   see it."                                  |
|  Nickname        [            ]             |
|  Date of birth   [            ]             |
|  [ Save ]                    [ Later ]      |
+--------------------------------------------+
      |
      v
    HOME
```

Tour steps 1 and 2 are informational. Step 3 is the only one that collects data,
and it is the reason the tour exists.

### Behaviour

- The tour runs once, immediately after first reaching home.
- **Skip tour** on any step goes straight to home and marks the tour seen.
- **Later** on step 3 marks the tour seen but leaves child identity incomplete,
  which the recurring prompt in section D.3 then picks up.
- Step 2's primary action opens the existing composer against the parent's
  primary circle (`pickPrimaryCircle`), so the tour ends in real usage rather
  than a dead end.

### Changes required

| File | Change |
| --- | --- |
| `app/onboarding/ready.tsx` | "Start exploring" routes into the tour instead of `/(app)`. |
| `app/tour/_layout.tsx` | **New.** Modal-style stack for the tour. |
| `app/tour/circles.tsx` | **New.** Tour step 1. |
| `app/tour/ask.tsx` | **New.** Tour step 2, links to the composer. |
| `app/tour/child.tsx` | **New.** Tour step 3, nickname + date of birth via `api.updateChild`. |
| `src/lib/app-tour.ts` | **New.** Seen/dismissed state, same shape as the deleted `intro.ts` used. |
| `src/lib/analytics.ts` | Add the tour events listed below. |
| `src/lib/clarity.ts` | Add a `tour` funnel branch in `funnelFromSegments`. |

### Fix required alongside it

The edit screen still refuses to save without a nickname and date of birth:

```92:102:apps/mobile/app/onboarding/children/edit/[id].tsx
  async function onSave() {
    if (!token || !curriculumId || !gradeId || !selectedSchool) return;
    const nick = nickname.trim();
    if (!nick) {
      setError("Nickname is required");
      return;
    }
    if (!dateOfBirth) {
      setError("Date of birth is required");
      return;
    }
```

This now contradicts the API, which accepts both as optional, and it actively
blocks the "Add school for your child" repair path in section D — a parent
trying to fix their school is forced to invent a nickname and a date of birth
first. Both checks must go, and `canSave` (line 142) must drop them too.

`app/onboarding/children/add.tsx` has the same two checks. Nickname and date of
birth should become optional there as well, so the "add another child" flow in
section B asks only what circle placement needs.

### Instrumentation

| Event | Fires when |
| --- | --- |
| `tour_started` | tour step 1 mounts |
| `tour_step_view` | each step, with a `step` property |
| `tour_skipped` | Skip tour, with the step it was skipped from |
| `tour_completed` | step 3 dismissed or saved |
| `tour_first_post_started` | step 2 primary action tapped |
| `child_identity_saved` | nickname or date of birth saved, with `source: "tour"` |

### Acceptance criteria

- A brand-new parent sees the tour exactly once.
- Skipping at any point lands on home with no repeat on next launch.
- Saving on step 3 sets nickname and date of birth on the child created at
  signup, and My Children stops showing "Child".
- Declining step 3 leaves a working account with full circle membership.

---

## B. Multiple children

### Goal

Support the real case: an elder child on IB and a younger on CBSE, giving the
parent both sets of circles from one account.

This already works at the data layer. `syncCircleMembership` iterates every
child and de-duplicates by circle key, so two children produce the union of
their circles — two school-class circles, two class circles, two curriculum
circles, one shared locality circle. What is missing is that **nothing tells the
parent a second child is possible**, and the UI does not make two children
legible once they exist.

### Changes required

| File | Change |
| --- | --- |
| `app/onboarding/children/index.tsx` | Make "+ Add another child" the visually primary action when exactly one child exists, and state what it unlocks. |
| `app/onboarding/children/add.tsx` | Reuse the signup ordering — school, then board, then class — with nickname and date of birth optional. |
| `app/(app)/circles/index.tsx` | Group circles by child where a circle belongs to one child, so two children do not read as one confusing list. |
| `src/lib/analytics.ts` | `second_child_prompted`, `second_child_added`. |

### Copy

> Have another child in a different class or board? Add them to join their
> school and class circles too.

### The tour does not ask for a second child

The tour is for the tour: circles, posting, and the one child the parent already
entered at signup. Asking for a second child there would stack a second request
onto a parent who has just finished answering questions, which is the exact
failure phase 1 removed.

The multi-child ask arrives later instead, through the `add_another_child`
completion prompt in section D.3 — after the tour, subject to the same backoff
as every other nudge, and only for a parent with exactly one child. My children
also keeps its own "+ Add another child" action for parents who go looking.

### Edge cases

| Case | Handling |
| --- | --- |
| Two children, same school and class | Circle keys collide and de-duplicate correctly; the parent sees one set. No error. |
| Two children, same school, different classes | One `school` circle, two `school_class` circles. |
| Children at different schools | Two `school` circles. Locality circle stays single, since it comes from the parent's PIN. |
| Child leaves / graduates | Out of scope here; deletion already exists via `DELETE /me/children/:id`. |

### Acceptance criteria

- A parent with two children on different boards is a member of both curriculum
  circles and both class circles.
- The circles list makes it obvious which circle belongs to which child.
- Removing the second child removes only the circles unique to that child.

---

## C. Defer child row creation (conditional)

### Status: hold unless A proves insufficient

The stricter reading of "don't add a child the parent didn't ask for." Today
step 3 of signup creates the child row from the school, board and class the
parent just entered — the row is not invented, but it is unnamed, which is what
makes it feel like a silent record.

### Why it is not a copy change

```215:226:apps/api/src/services/circle-sync.ts
export async function evaluateOnboardingComplete(
  client: PoolClient,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM children WHERE user_id = $1) AS has_children,
       EXISTS (SELECT 1 FROM user_locations WHERE user_id = $1) AS has_location`,
    [userId]
  );
  return rows[0]?.has_children && rows[0]?.has_location;
}
```

With no child row, `onboarding_complete` stays false and home bounces the parent
back into onboarding. School, board and class are also columns on `children`, so
there is nowhere else to hold them between signup and child creation.

### What it would require

1. Relax the gate to location-only, or introduce an explicit
   `onboarding_step` column instead of inferring completion from row existence.
2. Somewhere to park school, board and class — either client-side draft state
   surviving app restarts, or a nullable staging area on `users`.
3. Reworking the four screens that call `resolveParentOnboardingHref`.

### Recommendation

Do A first. Once the tour names the child and explains the row, the "mystery
child" problem is gone and this becomes an internal modelling preference rather
than a user-facing issue.

---

## D. School completeness

### Goal

Every parent ends up attached to a real school, so they receive their `school`
and `school_class` circles. New signups already do, because school is mandatory.
This section is about parents who slip through: legacy accounts and anyone whose
school data is wrong or placeholder.

### D.1 What already exists

The Circles tab already detects and surfaces this:

```271:293:apps/mobile/app/(app)/circles/index.tsx
  const childrenMissingSchool = children.filter((child) =>
    isPlaceholderSchool(child.school)
  );

  const placeholders: CirclePlaceholder[] = [];
  if (circles.filter((c) => c.circleType === "locality").length === 0) {
    placeholders.push({
      key: "missing-area",
      cta: "Add your pin code and area",
      onPress: () => router.push("/onboarding/location"),
    });
  }
  for (const child of childrenMissingSchool) {
    placeholders.push({
      key: `missing-school-${child.id}`,
      cta: `Add school for ${child.nickname || "your child"}`,
      onPress: () =>
        router.push({
          pathname: "/onboarding/children/edit/[id]",
          params: { id: child.id },
        }),
    });
  }
```

So the detection and a passive card are in place. Three things are missing:
the card is buried in one tab, the repair screen it opens is blocked by the
nickname requirement described in section A, and there is no re-prompt if the
parent ignores it.

### D.2 Locality-narrowed school suggestions

When a parent needs to pick a school, offer a browsable list of schools near
them before making them type. `GET /v1/schools/nearby` already does exactly
this, filtering by the parent's PIN and city and falling back to the city of an
existing child's school:

```200:209:apps/api/src/routes/schools.ts
         WHERE normalized_key <> $1
           AND (
             ($2::text IS NOT NULL AND pin_code = $2)
             OR ($3::text IS NOT NULL AND city ILIKE $3)
           )
         ORDER BY
           CASE WHEN pin_code = $2 THEN 0 ELSE 1 END,
           ${ratingOrder}
         LIMIT $4`,
        [PLACEHOLDER_SCHOOL_KEY, pin ?? null, city ?? null, limit]
```

**This filtering is correct here and must not be confused with search.** The
suggestion list is a convenience for browsing, so excluding far-away schools is
helpful. Search stays name-authoritative and unfiltered, because there the
parent has already told us exactly which school they mean.

Proposed change to `SchoolPicker`: when the field is empty, show up to five
nearby schools as tappable suggestions. Typing replaces them with search
results. This also reduces duplicate creation, since a parent who would have
typed a slightly different name may recognise the correct record in the list.

As the catalogue seeding progresses, these suggestions get better automatically
— no code change needed.

### D.3 Recurring completion prompts

A single prompt that gets dismissed is a single prompt wasted. Introduce one
small shared mechanism for all the optional-data nudges in this phase:

| Prompt | Condition | Destination |
| --- | --- | --- |
| Add your child's school | any child on the placeholder school | child edit |
| Add a private nickname | any child with `nickname = null` | child edit |
| Add your area | no `locality` circle | location screen |
| Add your community | no `community` circle | location screen |
| Add another child | exactly one child, tour completed | add child |

Cadence rules:

- At most one prompt visible at a time, in the priority order above.
- School comes first, because it unlocks two circles rather than cosmetic detail.
- Dismissing a prompt suppresses it for a backoff period — suggested 7 days,
  then 30, then stop.
- Never show any prompt during the first session after signup; the tour owns
  that moment.

Where to store dismissals is an open question. Local storage is simpler and
matches how the old intro flag worked; server-side survives reinstalls and new
devices. Local is the recommended starting point.

### Changes required

| File | Change |
| --- | --- |
| `src/lib/completion-prompts.ts` | **New.** Condition evaluation, priority order, dismissal and backoff state. |
| `src/components/CompletionPrompt.tsx` | **New.** One dismissible banner. |
| `app/(app)/index.tsx` | Render the highest-priority prompt on home. |
| `app/(app)/circles/index.tsx` | Keep the existing placeholder cards; source their conditions from the shared module so the two never disagree. |
| `src/components/onboarding/SchoolPicker.tsx` | Nearby suggestions when the query is empty, via `api.getNearbySchools`. |
| `app/onboarding/children/edit/[id].tsx` | Drop the nickname and date-of-birth requirements (also required by section A). |

### Instrumentation

| Event | Fires when |
| --- | --- |
| `completion_prompt_shown` | with a `prompt` property |
| `completion_prompt_tapped` | with a `prompt` property |
| `completion_prompt_dismissed` | with `prompt` and dismissal count |
| `school_suggestion_tapped` | a nearby suggestion is chosen instead of typing |

`school_suggestion_tapped` versus `school_created` is the signal for how well
the catalogue covers a given area.

### D.4 Placeholder-school audit

A one-off read-only check of how many accounts are affected before building the
remediation:

```sql
SELECT count(DISTINCT ch.user_id) AS parents,
       count(*)                   AS children
FROM children ch
JOIN schools s ON s.id = ch.school_id
WHERE s.normalized_key = 'school_not_specified||unknown';
```

At current install numbers this is expected to return zero, in which case D.1
and D.3 are purely preventative and can be scheduled behind A and B.

### Acceptance criteria

- No parent with a placeholder school can go a full session without seeing one
  prompt about it.
- Dismissing a prompt does not show it again the same week.
- Fixing a school from the prompt requires only choosing a school — no nickname,
  no date of birth.
- An empty school field offers nearby schools; typing switches to name search
  across all cities.

---

## Sequencing

| Order | Item | Depends on |
| --- | --- | --- |
| 1 | A — tour and child identity, plus the edit/add screen unblocking | phase 1 (done) |
| 2 | B — multiple children | A, for the "add another" prompt |
| 3 | D.2 — nearby school suggestions | none; independent |
| 4 | D.3 — recurring completion prompts | A, so prompts never collide with the tour |
| 5 | D.4 — audit query | none; run any time |
| — | C — defer child creation | only if A proves insufficient |

The edit-screen unblocking in section A is a prerequisite for D, so it should
not be split off.

## Open questions

1. **Dismissal storage** — local (simple, resets on reinstall) or server-side
   (survives devices, needs a schema change)?
2. **Tour length** — three steps as drafted, or two if the circles explanation
   is better placed as an empty-state hint inside the Circles tab?
3. **Date of birth** — is it worth asking at all? Nothing currently reads it
   except display. If it has no near-term use, the tour could ask for the
   nickname only and drop a field.
4. **Second-child prompt timing** — immediately after the tour, or after the
   parent has actually engaged with a circle?
