# Child 360

**Status:** product spec. Not built.  
**Date:** 26 September 2026.

Child 360 is the place a parent adds a child, edits that child, and opens the parts of the child’s life they want to keep. School-age children have studies, sports, health, and age-appropriate exams or career. Preschool children have preschool, activities, interests, and health. It is a primary tab: **Home · Messages · Child 360 · Discover · More**.

For a school-age child, Studies is the existing Child’s Path. For a preschool child, the left side is a short Preschool summary, not a path. Age decides the labels and content on the four sides. An empty side says + Add. There is no separate on/off switch.

Related:

- Add and edit child — `apps/mobile/app/onboarding/children/`
- Child’s Path layout — [`CHILDS_PATH_EXPLORATION_TREE.md`](./CHILDS_PATH_EXPLORATION_TREE.md)
- Child’s Path behaviour — [`CHILDS_PATH_FUNCTIONAL.md`](./CHILDS_PATH_FUNCTIONAL.md)
- Boards, stages, exams — [`WHAT_NEXT_AND_OPPORTUNITIES.md`](./WHAT_NEXT_AND_OPPORTUNITIES.md)
- Preschool (3 and 4) — [`PRESCHOOL_ONBOARDING.md`](./PRESCHOOL_ONBOARDING.md)
- Pregnancy stays parked — [`FUTURE_PREGNANCY_ONBOARDING.md`](./FUTURE_PREGNANCY_ONBOARDING.md)

---

## What the parent sees

```
Home · Messages · Child 360 · Discover · More

Child 360
  │
  ├ list of children          (today’s “My children”)
  │     add child
  │     edit child
  │
  └ one child
        school-age       →  studies · sports · health · exams/career
        preschool        →  preschool · activities · interests · health
```

**Why five tabs.** Home and Messages stay first. Child 360 takes the centre-right slot — identity and planning for *their* child. Discover stays for explore-and-find. More holds settings and the rest. Five tabs is normal on phones (labels stay short; icons carry recognition). Discover does not move into More.

One child opens straight onto that child’s hub. More than one child opens the list first. Add and edit share one target form: nickname, date of birth, gender, and either preschool (campus + 3 or 4 years) or school (school + board + class). Edit already supports both tracks; Add must gain the same School / Preschool choice. The screen title becomes Child 360.

More → My Children and More → Child’s Path stay as shortcuts into the same screens. Child’s Path does not get its own tab. It is the studies branch inside Child 360.

Opening a branch does not change the child’s school, board, or class. That lock already exists on Child’s Path and applies to every branch.

---

## Screens

The child sits in the centre. A school-age child has studies on the left, exams/career on the right, sports on top, and health on the bottom. A preschool child has preschool on the left, interests on the right, activities on top, and health on the bottom. Tap a side to open its page. Edit stays on the child, not on a branch.

### Tab

```
┌─────────────────────────────────────────┐
│ Home  Messages  Child 360  Discover  More │
└─────────────────────────────────────────┘
```

Child 360 sits between Messages and Discover. Five tabs; short labels.

### Several children

```
┌─────────────────────────────────────────┐
│ Child 360                               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ A   Aanya                           │ │
│ │     CBSE · Class 8                  │ │
│ │     Oakridge                     ✎  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ R   Riya                            │ │
│ │     4 years · Kidzee                │ │
│ │                                  ✎  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ + Add a child ]                       │
└─────────────────────────────────────────┘
```

Tap the card to open that child’s hub. The pencil edits the child. Add a child opens the shared School / Preschool form specified below.

### Just added

The left side is already filled, because add-child asked for school, board, and class or preschool campus and age. The other sides stay **+ Add** until the parent writes something. Nothing is invented for them.

Class 8. All four sides are on the circle. The right side is + Add, not an exam name.

```
┌─────────────────────────────────────────┐
│ Child 360                          Edit │
│ Aanya · CBSE · Class 8 · Oakridge       │
│                                         │
│              ┌───────────┐              │
│              │  Sports   │              │
│              │   + Add   │              │
│              └─────┬─────┘              │
│                    │                    │
│┌─────────┐   ┌─────┴─────┐   ┌─────────┐│
││ Studies ├───┤   AANYA   ├───┤  Exams  ││
││CBSE · 8 │   │  Class 8  │   │  + Add  ││
│└─────────┘   └─────┬─────┘   └─────────┘│
│                    │                    │
│              ┌─────┴─────┐              │
│              │  Health   │              │
│              │   + Add   │              │
│              └───────────┘              │
└─────────────────────────────────────────┘
```

Preschool. The four sides use preschool language. There is no exams side and no Child’s Path.

```
┌─────────────────────────────────────────┐
│ Child 360                          Edit │
│ Riya · 4 years · Kidzee                 │
│                                         │
│              ┌───────────┐              │
│              │Activities │              │
│              │   + Add   │              │
│              └─────┬─────┘              │
│                    │                    │
│┌─────────┐   ┌─────┴─────┐   ┌─────────┐│
││Preschool├───┤   RIYA    ├───┤Interests││
││ Kidzee  │   │  4 years  │   │  + Add  ││
│└─────────┘   └─────┬─────┘   └─────────┘│
│                    │                    │
│              ┌─────┴─────┐              │
│              │  Health   │              │
│              │   + Add   │              │
│              └───────────┘              │
└─────────────────────────────────────────┘
```

For a school-age child through Class 5, the right side remains Interests. From Class 6 its label becomes Exams / career, beginning with what the child enjoys.

### Where a tap goes

```
Hub
 ├ Left           →  Child's Path          (school)
 │                  or Preschool summary  (preschool)
 ├ Top + Add      →  Add a sport           (school)
 │                  or Add an activity     (preschool)
 ├ Health + Add   →  Add a note
 ├ Right + Add    →  Interests             (preschool–Class 5)
 │                  or What they enjoy     (Class 6–8)
 │                  or After Class 10      (Class 9–10)
 │                  or Add an exam         (Class 11–12)
 └ Edit           →  Edit child
                     nickname, school, board, class

After the first save, that side shows a summary.
Tap the filled side → its list.
Tap a row on the list → the same form, filled in, with Remove.
```

Edit on the hub changes the child. It does not edit a sport, a note, or an exam. Save on an add form returns to that side’s list. Back from the list returns to the hub, and the side now shows what was saved (Football, 2 notes, JEE). Cancel on an add form returns to the hub still showing + Add.

### Add a preschool child

The API and edit-child form already support a preschool child. The post-onboarding add-child form must expose it instead of always creating `track = school`.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360          Add child          │
│                                         │
│ Who are you adding?                     │
│                                         │
│ ( Preschool · 3–4 years )               │
│ ( School-age child )                    │
└─────────────────────────────────────────┘
```

Preschool asks for:

1. Campus — the existing preschool-or-school campus picker.
2. Age circle — exactly 3 years or 4 years.
3. Optional nickname and date of birth.
4. Gender.
5. Save.

It never asks for board or class. School-age remains school, board, and class.

When a parent adds a child from inside the app, Save opens that child’s hub. During first-time onboarding, Save continues the existing onboarding route: location if it is missing, then Ready. It must not skip location to open the hub.

### Preschool

The left side is a summary. It never opens Child’s Path.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360        Preschool            │
│                                         │
│ Riya                                    │
│ Age circle       4 years                │
│ Campus           Kidzee Kondapur        │
│                                         │
│ [ Edit campus or age ]                  │
└─────────────────────────────────────────┘
```

Edit campus or age opens Edit child. Saving updates the child’s age and campus circles.

### Preschool activities

The top side is called Activities, not Sports. It uses the same rows and ownership rules as sports, but age-appropriate settings.

```
┌─────────────────────────────────────────┐
│ ‹ Activities      Add an activity       │
│                                         │
│ Activity                                │
│ ┌─────────────────────────────────────┐ │
│ │ Swimming                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Where                                   │
│ ( Preschool ) ( Outside class )         │
│ ( At home )                             │
│                                         │
│ How often       Weekends                │
│ Status          ( Active ) ( Paused )   │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Save opens the Activities list. Tap a row to edit it. Remove uses the same confirm and Undo flow as a sport. The centre card shows the first active activity; if none are active, it shows the first paused activity.

### Preschool interests

Interests are parent observations. They are not developmental milestones, readiness scores, diagnoses, or recommendations.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360         Interests           │
│                                         │
│ What does Riya enjoy?                   │
│                                         │
│ ( Stories ) ( Music ) ( Drawing )       │
│ ( Nature )  ( Numbers ) ( Building )    │
│ ( Pretend play ) ( Movement )           │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

This is one selection, not a list of duplicate rows. Tap Interests to reopen it. Clearing every selection and saving returns the side to + Add. The same Interests side continues through Class 5 so the data does not disappear when the child becomes school-age.

### Add a sport

Opened from Sports + Add.

```
┌─────────────────────────────────────────┐
│ ‹ Sports             Add a sport        │
│                                         │
│ Sport                                   │
│ ┌─────────────────────────────────────┐ │
│ │ Football                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Where                                   │
│ ( School )  ( Academy )  ( Casual )     │
│                                         │
│ How often                               │
│ ┌─────────────────────────────────────┐ │
│ │ 4 days a week                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Save opens the sports list. Tap the row to edit. Edit is the same form, with the fields filled, plus Remove.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360          Sports             │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Football                         ✎  │ │
│ │ School · 4 days a week              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ + Add a sport ]                       │
└─────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────┐
│ ‹ Sports            Edit sport          │
│                                         │
│ Sport          Football                 │
│ Where          ( School )               │
│ How often      4 days a week            │
│                                         │
│ [ Save ]                                │
│                                         │
│ Remove this sport                       │
└─────────────────────────────────────────┘
```

### Add a health note

Opened from Health + Add. The page says it stays private.

```
┌─────────────────────────────────────────┐
│ ‹ Health             Add a note         │
│                                         │
│ Private to your account.                │
│                                         │
│ What is it                              │
│ ( Allergy ) ( Vision ) ( Sleep )        │
│ ( Dental )  ( Doctor ) ( Other )        │
│                                         │
│ Note                                    │
│ ┌─────────────────────────────────────┐ │
│ │ Dust. Inhaler in the school bag.    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Save opens the health list. Tap a note to edit it. Remove sits on that edit page.

```
┌─────────────────────────────────────────┐
│ ‹ Health            Edit note           │
│                                         │
│ Private to your account.                │
│                                         │
│ What is it     ( Allergy )              │
│ Note           Dust. Inhaler in the     │
│                school bag.              │
│                                         │
│ [ Save ]                                │
│                                         │
│ Remove this note                        │
└─────────────────────────────────────────┘
```

### Add exams

Opened from Exams + Add. The form depends on the class already saved on the child.

Class 6–8. Interests only. No attempt year, no JEE target.

```
┌─────────────────────────────────────────┐
│ ‹ Exams        What they enjoy          │
│                                         │
│ Aanya · CBSE · Class 8                  │
│                                         │
│ ( Maths ) ( Science ) ( Art )           │
│ ( Sport ) ( Business ) ( Design )       │
│                                         │
│ Entrance exams are later.               │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Class 9–10. The page asks which way they are leaning after Class 10. Entrance papers stay marked later. They are not this year’s target.

```
┌─────────────────────────────────────────┐
│ ‹ Exams         After Class 10          │
│                                         │
│ Aanya · CBSE · Class 10                 │
│ Telangana                               │
│                                         │
│ Leaning toward                          │
│ ( PCM ) ( PCB ) ( Commerce ) ( Arts )   │
│ ( Not sure yet )                        │
│                                         │
│ Entrance exams are later.               │
│ They are not this year's target.        │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Class 11–12. One exam from the catalogue for this board, subjects, and state. The parent sets a plan status and an attempt year. A paper that needs subjects the child does not have sits under Later. It cannot be marked This season. Saving a row does not mean the child is eligible.

```
┌─────────────────────────────────────────┐
│ ‹ Exams            Add an exam          │
│                                         │
│ Aanya · CBSE · Class 11 · PCM           │
│ Telangana                               │
│                                         │
│ Matches these subjects                  │
│ ( ) JEE Main                            │
│ ( ) JEE Advanced                        │
│ ( ) TG EAPCET                           │
│                                         │
│ Later                                   │
│ NEET · needs biology                    │
│ Not a target until subjects match.      │
│                                         │
│ Status                                  │
│ ( Exploring ) ( Planning ) (This season)│
│                                         │
│ Attempt year                            │
│ ┌─────────────────────────────────────┐ │
│ │ 2028                                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

Tap a saved exam on the list to open this same form filled in, with Remove this exam.

### Edit the child

Edit on the hub opens the child form that already exists. This is how school, board, class, campus, or age change. Child’s Path does not write those fields.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360         Edit child          │
│                                         │
│ Nickname       Aanya                    │
│ Date of birth  12 Mar 2013              │
│ School         Oakridge                 │
│ Board          CBSE                     │
│ Class          8                        │
│                                         │
│ [ Save ]                                │
└─────────────────────────────────────────┘
```

### One school child — Class 8

From Class 6 the exams side is always on the circle. Here it shows what she enjoys. It does not list JEE as this year’s plan.

```
┌─────────────────────────────────────────┐
│ Child 360                          Edit │
│ Aanya · CBSE · Class 8 · Oakridge       │
│                                         │
│              ┌───────────┐              │
│              │  Sports   │              │
│              │ Football  │              │
│              └─────┬─────┘              │
│                    │                    │
│┌─────────┐   ┌─────┴─────┐   ┌─────────┐│
││ Studies ├───┤   AANYA   ├───┤  Exams  ││
││CBSE · 8 │   │  Class 8  │   │  Later  ││
│└─────────┘   └─────┬─────┘   └─────────┘│
│                    │                    │
│              ┌─────┴─────┐              │
│              │  Health   │              │
│              │  2 notes  │              │
│              └───────────┘              │
└─────────────────────────────────────────┘
```

### Preschool — 4 years

Four preschool sides: preschool, activities, interests, and health. Exams is not offered.

```
┌─────────────────────────────────────────┐
│ Child 360                          Edit │
│ Riya · 4 years · Kidzee                 │
│                                         │
│              ┌───────────┐              │
│              │Activities │              │
│              │   Dance   │              │
│              └─────┬─────┘              │
│                    │                    │
│┌─────────┐   ┌─────┴─────┐   ┌─────────┐│
││Preschool├───┤   RIYA    ├───┤Interests││
││ Kidzee  │   │  4 years  │   │ Stories ││
│└─────────┘   └─────┬─────┘   └─────────┘│
│                    │                    │
│              ┌─────┴─────┐              │
│              │  Health   │              │
│              │  1 note   │              │
│              └───────────┘              │
└─────────────────────────────────────────┘
```

### Class 11 — exams are the plan

```
┌─────────────────────────────────────────┐
│ Child 360                          Edit │
│ Aanya · CBSE · Class 11 · PCM           │
│                                         │
│              ┌───────────┐              │
│              │  Sports   │              │
│              │  Paused   │              │
│              └─────┬─────┘              │
│                    │                    │
│┌─────────┐   ┌─────┴─────┐   ┌─────────┐│
││ Studies ├───┤   AANYA   ├───┤  Exams  ││
││Class 11 │   │    PCM    │   │   JEE   ││
│└─────────┘   └─────┬─────┘   └─────────┘│
│                    │                    │
│              ┌─────┴─────┐              │
│              │  Health   │              │
│              │   Sleep   │              │
│              └───────────┘              │
└─────────────────────────────────────────┘
```

### Studies

School opens the Child’s Path already in the app. The header stays Child’s Path. Preschool uses the separate Preschool summary above.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360     Child's Path            │
│                                         │
│ Aanya · CBSE · Class 8 · Telangana      │
│                                         │
│         ┌─────────────────────┐         │
│         │ YOUR CHILD IS HERE  │         │
│         │ CBSE · Class 8      │         │
│         └──────────┬──────────┘         │
│                    │                    │
│         (existing path thread)          │
└─────────────────────────────────────────┘
```

### Sports

```
┌─────────────────────────────────────────┐
│ ‹ Child 360         Sports              │
│                                         │
│ Aanya                                   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Football                            │ │
│ │ School · 4 days a week              │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Swimming                            │ │
│ │ Academy · weekends                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ + Add a sport ]                       │
└─────────────────────────────────────────┘
```

The first tap on Sports + Add opens Add a sport, above. This list is what they see after the first save.

### Health

```
┌─────────────────────────────────────────┐
│ ‹ Child 360         Health              │
│                                         │
│ Private to your account.                │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Allergy                             │ │
│ │ Dust. Inhaler in the school bag.    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Vision                              │ │
│ │ Glasses since Class 6.              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ + Add a note ]                        │
└─────────────────────────────────────────┘
```

### Exams / career

Class 6–8. The side is on the circle. The page is what they enjoy:

```
┌─────────────────────────────────────────┐
│ ‹ Child 360      Exams                  │
│                                         │
│ Aanya · CBSE · Class 8                  │
│                                         │
│ What she enjoys                         │
│ ┌────────┐ ┌─────────┐ ┌────────────┐   │
│ │ Maths  │ │ Science │ │ + Add      │   │
│ └────────┘ └─────────┘ └────────────┘   │
│                                         │
│ Entrance exams are later.               │
│ They are not a target this year.        │
└─────────────────────────────────────────┘
```

Class 11, live plan. Names come from the catalogue for this board, stream, and state.

```
┌─────────────────────────────────────────┐
│ ‹ Child 360      Exams                  │
│                                         │
│ Aanya · CBSE · Class 11 · PCM           │
│ Telangana                               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ JEE Main                            │ │
│ │ This season · attempt 2028          │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ TG EAPCET                           │ │
│ │ Planning · attempt 2028             │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ NEET                                │ │
│ │ Later · needs biology               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ + Add an exam ]                       │
└─────────────────────────────────────────┘
```

---

## The four branches

Age decides the labels and content on the four sides. The parent does not turn a side on or off. An empty side says + Add.

| Side | Preschool | School-age |
|------|-----------|------------|
| Left | **Preschool** — campus and age | **Studies** — existing Child’s Path |
| Top | **Activities** — movement or classes | **Sports** — sports they do or want to try |
| Right | **Interests** | **Interests** through Class 5; **Exams / career** from Class 6 |
| Bottom | **Health** — private notes | **Health** — private notes |

Studies is on for every school-age child. It is the record of school, board, and class, so it is not something the parent turns off. Preschool has no board, so its left side is campus and age, not Child’s Path.

Empty sides show one add action. They do not show sample children, coaching ads, developmental scores, or medical advice.

---

## Age bands

These are the same bands the app already uses. Preschool is its own track. School ages follow Child’s Path stages in [`WHAT_NEXT_AND_OPPORTUNITIES.md`](./WHAT_NEXT_AND_OPPORTUNITIES.md) §5.

| Band | Who | How we know |
|------|-----|-------------|
| Preschool | 3 or 4 years | `track = preschool` |
| Early years | Nursery–Class 5, Cambridge Y1–Y6, IB PYP | stage `foundation` |
| Middle school | Class 6–8, Cambridge Y7–Y9, MYP through Grade 8 | stage `middle` |
| Board years | Class 9–10, IGCSE, MYP Grades 9–10 | stage `board_10` |
| Senior years | Class 11–12, Intermediate / PUC / HSC, A Level, IB Diploma | stage `senior` |
| After school | School finished | stage `after_12` |

Pregnancy is not a Child 360 band. It stays parked.

A child can sit in only one band. The band updates when the parent edits class or age. Removing a sport, a note, or an exam does not change the band.

---

## What each age needs

### Preschool (3 and 4)

The job is the child in front of them, not a board or an entrance exam.

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Preschool | Yes, as campus + age | Campus name, 3 or 4 years. No Child’s Path. No CBSE, SSC, IGCSE, or IB. |
| Activities | Yes | Movement the parent names: swimming, dance, skating, football, play. Setting: at preschool, outside class, or at home. |
| Interests | Yes | Stories, music, drawing, nature, numbers, building, pretend play, or movement. No scores or milestones. |
| Health | Yes | Allergies, regular doctor, anything the parent wants remembered. Private. |
| Exams / career | Off, and not offered | Do not show olympiads, JEE, NEET, or “plan a career”. |

Needed: the preschool child we already store, plus activities, interests, and private health notes.

### Early years (through Class 5)

School has started. Entrance exams have not.

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Studies | Yes | Child’s Path at early years. Stay on the current board. Switching boards is explore-only. |
| Sports | Yes | School sport and outside classes. Name, where (school / academy / casual), how often. |
| Interests | Yes | Keep and edit what the child enjoys. No exam framing. |
| Health | Yes | Allergies, vision, dental, activity. Parent-written notes. |
| Exams / career | Off | No target sheet. JEE and NEET are not this season. |

Needed: Child’s Path already covers studies. Activities become sports when the child moves from preschool to school; interests remain on the right. The exams label stays hidden so a Class 2 parent is not asked to pick a stream.

### Middle school (Class 6–8)

Interests get specific. Big exams are still ahead.

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Studies | Yes | Child’s Path at middle school. Class 10 can be peeked. Peek does not change the profile. |
| Sports | Yes | School team or academy, and how many days a week. A note if they may pause later. |
| Health | Yes | Sleep, screen, eyes, sports niggles. Still notes, not a clinic. |
| Exams / career | Optional | “What they enjoy” (maths, biology, design, business, sport). Olympiads only as a watch list. Indian entrance exams stay a dim “later”, and only when the catalogue already allows a preview. |

Needed: an interest list on the exams branch (enjoyment, not a target score). Catalogue rules already keep JEE, NEET, and EAPCET off IGCSE and MYP as live exams. Child 360 must not add a second list that breaks that.

### Board years (Class 9–10)

This is the first year a plan is real: board exam, then a fork.

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Studies | Yes | Child’s Path. In the final Class 10-equivalent year, the after-10 fork is included (stream, stay, or switch). |
| Sports | Yes | Continue, ease off, or pause for the board year. |
| Health | Yes | Sleep, meals, eyes during the board year. |
| Exams / career | Yes, as planning | What opens after Class 10, from the child’s board and state. Optional target: which stream or which switch they are leaning toward. Entrance papers that need Class 12 stay marked “later”. |

Needed: the exams page reads the same stage and state as Child’s Path. A target is a parent choice (for example “leaning PCM” or “looking at IB Diploma”). It is not written back onto the child’s class.

SSC stops at Class 10 in the app today. After that, studies follow Intermediate, not an SSC Class 12. The exams page uses that same fork.

### Senior years (Class 11–12 and equivalents)

Board marks and entrance papers run together. This is the age the exams branch is a real plan.

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Studies | Yes | Child’s Path at senior years: stream or subject set, college plans. |
| Sports | Yes | Keep, or pause for the entrance season. |
| Health | Yes | Sleep, meals, stress the parent wants noted. No diagnosis, no “tips from other parents” on this page. |
| Exams / career | Yes | Exams that match this board, stream or subjects, and state. Parent marks each as exploring, planning, or this season, and can set an attempt year. |

The exam names come from the existing catalogue, not a new one. Examples already specified there: JEE Main, JEE Advanced, NEET, CUET, state counselling (EAPCET, TNEA, KEAM, and the rest), CLAT, CA Foundation, design and architecture routes. A Level and IB Diploma use subject sets, not Indian stream names. IGCSE and MYP are Class 10 equivalent, so they never land on this band’s live entrance list.

Needed: a plan row per exam (status, attempt year, optional score goal), filtered by the eligibility rules in the catalogue. Grade alone never makes an exam “eligible”.

### After school

| Branch | On by default | What the page holds |
|--------|----------------|---------------------|
| Studies | Yes | Child’s Path college routes. |
| Sports | Yes, still on the circle | The same sports list. Empty says + Add. |
| Health | Yes, still on the circle | The same private notes. Empty says + Add. |
| Exams / career | Yes | Applications, results, and the next step. Counselling names stay the state ones already in the catalogue. |

---

## What we already have

| Piece | Today | In Child 360 |
|-------|--------|----------------|
| Child list, add, edit | `My children` under More and onboarding | Same screens, titled Child 360 |
| School child | School, board, class | Studies branch |
| Preschool child | Campus, 3 or 4 years | Preschool shows that. No path tree. |
| Child’s Path | More → Child’s Path, one school child | Studies, for the child on screen |
| Exam catalogue | Stages, streams, state exams | Source for the exams branch from Class 9 up |
| Local doctors, playdates | Discover / More, behind flags | Stay in Discover / More. Health may link to doctors later. It does not replace that screen. |
| Discover tab | Tab beside Messages | Stays on the tab bar after Child 360. |

---

## What is new

Per child, stored against that child only:

1. **No branch switches.** The four age-appropriate sides are always on the circle. Exams / career replaces Interests from Class 6.
2. **Activities / sports** — name, setting, how often, active or paused, optional note. Preschool settings are preschool / outside class / at home. School settings are school / academy / casual.
3. **Health notes** — short private text the parent writes. Optional labels: allergy, doctor, vision, dental, sleep, other. Never posted to a circle, never used to match parents.
4. **Interests** — one set of parent-selected labels from preschool through Class 8. From Class 6 the page sits under Exams / career, but it is still enjoyment, not a score.
5. **Exam plan** — catalogue exam, parent status (exploring / planning / this season), attempt year. The app keeps a separate mark (later / matches these subjects / needs verification). From Class 9, a lean after Class 10.

No new circle for a sport, a health note, or an exam. Asking other parents stays where it already is: Child’s Path discussions, in the circles the parent is already in.

---

## Rules

1. Tab bar is Home · Messages · Child 360 · Discover · More. Child’s Path is inside Child 360.
2. Add child and edit child keep today’s identity fields and add the School / Preschool choice. Preschool requires campus + age 3 or 4. School requires school + board + class.
3. Age chooses the labels and content. Preschool and school through Class 5 show Interests; Exams / career begins in Class 6. The parent fills a side with + Add. They do not toggle the side itself.
4. Exploring studies or an exam does not write school, board, or class.
5. Health notes stay on the account. They are not feed content and not a medical record.
6. Exam names, “later” versus live, and state counselling follow [`WHAT_NEXT_AND_OPPORTUNITIES.md`](./WHAT_NEXT_AND_OPPORTUNITIES.md). Child 360 does not invent a parallel exam list.
7. IGCSE and MYP do not show JEE, NEET, or EAPCET as live.
8. Preschool does not show a board, Child’s Path, or an exam. Its four sides are Preschool, Activities, Interests, and Health.
9. Pregnancy is out of this spec.
10. Empty states ask the parent to add one activity or sport, choose interests, add one note, or add one exam. They do not fill the page with suggestions that look like the child’s real life.
11. How the gaps below are handled is part of this spec. A screen earlier in the doc follows this section when the two disagree.

---

## Gaps and how we handle them

### 1. Adding versus turning a side on

The circle always shows the sides this age is allowed to have. + Add means the side is empty. It does not mean the parent must enable the side first.

| Age | Sides on the circle |
|-----|---------------------|
| Preschool | Preschool, activities, interests, health |
| School through Class 5 | Studies, sports, interests, health |
| Class 6 through after school | Studies, sports, health, exams |

There is no hide control in v1. Removing the last activity, sport, note, or exam—or clearing every interest—puts that side back to + Add. The side stays on the circle.

### 2. Where save lands after a new child

Save on add-child opens that child’s hub when the parent entered Add child from inside the app. During first-time onboarding it continues to Location when location is missing, then Ready. It must not skip onboarding. If save fails, the form stays open with the error.

### 3. Studies opens the child on screen

The hub passes that child’s id into Child’s Path. The path must not choose a different child while that id is loading, and it must not show another child’s path if the id is missing. A preschool child opens the Preschool summary, not the path.

Today the path can open without a child id and then settle on whoever the query returns. Child 360 does not keep that behaviour.

### 4. When class or age changes

Rows stay until the parent removes them. Editing class never deletes sports, notes, interests, or exam plans.

| Change | What the parent sees |
|--------|----------------------|
| Preschool → school | Preschool becomes Studies; Activities becomes Sports; Interests and Health stay. The parent must choose School, board, and class. |
| Class 5 → 6 | Interests moves under the Exams / career label. Sports and health stay as they were. |
| Class 8 → 9 | Old interests stay on the exams page under “From middle school”. The new prompt is the after-Class-10 lean. Interests are not turned into JEE targets. |
| Class 10 → 11 | The lean stays on the page as context. It is not written onto the child’s class or stream. The parent then adds exams. |
| Class 12 → after school | Plans stay. A row marked This season is labelled Past season. Sports and health stay on the circle. |
| Class edited downward, so exams is no longer offered | The exams side leaves the circle. The rows stay stored. They show again if the child moves back into Class 6 or above. |

### 5. Class 9–10 is a direction, not an entrance form

The exams side in Class 9–10 asks which way they are leaning after Class 10: PCM, PCB, Commerce, Arts, or not sure. Papers that need Class 12 stay under Later. They are not a target for this year. The “Add an exam” form begins at Class 11.

### 6. A saved exam is not eligibility

The catalogue still decides what can appear, including the existing rule that IGCSE and MYP do not show JEE, NEET, or EAPCET as live.

On the Class 11–12 form the parent’s status and the app’s mark are different:

| Parent can set | App shows beside it |
|----------------|---------------------|
| Exploring | Later, when the paper is ahead of this stage |
| Planning | Matches these subjects, when the stored subjects fit |
| This season | Needs verification, when the catalogue cannot confirm the subjects |

This season is only offered when the mark is “Matches these subjects”. A paper under Later can be read. It cannot be saved as This season. Grade, browsing, or a saved row never produces the word Eligible. That word stays out of Child 360. Eligibility remains the rule already in [`CHILDS_PATH_FUNCTIONAL.md`](./CHILDS_PATH_FUNCTIONAL.md): it is never inferred from browse, interest, or grade alone.

### 7. Health stays on the account

The page says “Private to your account.” That line is enforced:

- Only the signed-in owner can read or write the notes. Another parent’s child id returns not found.
- Notes are not posts, not circle content, not search results, and not fields on an analytics event.
- They are deleted with the child and with the account.
- The page does not diagnose, prescribe, or collect an emergency contact. Discover → Local doctors stays a separate screen.

### 8. Remove, confirm, and an empty side

Remove on a sport, a note, or an exam asks first: “Remove football?” Confirm deletes the row and returns to the list. For a few seconds the list offers Undo. Leaving the list drops the undo.

When the last row is gone, back on the hub shows + Add on that side.

### 9. More than one child

The hub names the child in the header. When the account has more than one child, that name opens the child list as a sheet. Picking a child replaces the hub. The parent does not have to leave the circle and find the list again.

One child has no switcher. The name is plain text.

### 10. The circle on a small screen or with large text

The centre-and-four-sides layout is the normal phone layout. When the system text size is large, or the four cards no longer fit, school-age sides stack Studies, Sports, Health, then Interests or Exams. Preschool sides stack Preschool, Activities, Interests, then Health. The child is announced first. Each side is one button. Screen-reader order matches the stack, not a left-to-right guess across the circle.

### 11. What we store (normalized schema)

`children` stays the identity and school/preschool record. Child 360 extras are **not** JSON columns on `children`. Each kind of fact is its own table, keyed to `child_id`, with `ON DELETE CASCADE`.

Ownership is not duplicated on those tables. Every read and write joins through `children` and checks `children.user_id = signed-in parent`. A foreign `child_id` returns not found.

#### Naming

Table names stay **domain-neutral**. The mobile copy can say Sports, Activities, Exams, or Career. The database does not encode India-only words like hobbies, sports, or competitive exams.

| Table / column | Why this name | UI may say |
|----------------|---------------|------------|
| `child_activities` | Any repeated pursuit: football, dance, swimming, music class | Activities, Sports |
| `child_health_notes` | Private parent notes about care | Health |
| `child_interests` | What the child enjoys, any age | Interests, What they enjoy |
| `children.pathway_lean` | One optional direction after the current stage | After Class 10, Stream, Subject direction |
| `child_opportunity_plans` | Parent plan against a catalogue opportunity slug | Exams, Career, Opportunities |

Do **not** name tables `child_sports`, `child_hobbies`, `child_competitive_exams`, or `child_jee_plans`. Those freeze today’s India school vocabulary into the schema.

```
users
  └── children                             (already exists)
        ├── child_activities               (many)
        ├── child_health_notes             (many)
        ├── child_interests                (many labels, unique per child)
        └── child_opportunity_plans        (many, unique per catalogue slug)

children.pathway_lean                      (0..1 scalar on the child row)
```

#### `children` — no new Child 360 blob

Keep using today’s columns for the left side:

| Already on `children` | Used for |
|-----------------------|----------|
| `track`, `age_years`, `school_id` | Preschool summary |
| `school_id`, `curriculum_id`, `grade_id` | Studies → Child’s Path |

**One new nullable column** on `children` for the optional pathway lean (at most one value per child):

```sql
ALTER TABLE children
  ADD COLUMN pathway_lean text
  CHECK (
    pathway_lean IS NULL
    OR char_length(btrim(pathway_lean)) BETWEEN 1 AND 40
  );
```

v1 UI writes curated values such as `pcm`, `pcb`, `commerce`, `arts`, `not_sure`. The column is plain text so later boards and countries can add values (for example A Level subject sets) without a rename. The API validates the allowed set for the child’s board and stage.

This stays on `children` because it is a single optional attribute of the child’s plan, not a repeating list. Do not store activities, notes, interests, or opportunity plans here.

#### `child_activities`

One row per activity. Same table for preschool and school; the allowed `setting` values depend on `children.track` in the API, not on two nearly identical tables.

```sql
CREATE TABLE child_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name text NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  setting text NOT NULL
    CHECK (setting IN (
      'preschool', 'outside_class', 'at_home',
      'school', 'academy', 'casual'
    )),
  how_often text
    CHECK (how_often IS NULL OR char_length(how_often) <= 80),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX child_activities_child_sort
  ON child_activities (child_id, sort_order, created_at);
```

Hub card: first `active` by `sort_order`, else first `paused`. Duplicate names for the same child are allowed. `name` is free text so a parent can store cricket, ballet, coding club, or anything else without a country-specific enum.

#### `child_health_notes`

One row per note. Two allergies are two rows. Labels are a closed set that can grow later by migration.

```sql
CREATE TABLE child_health_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  label text NOT NULL
    CHECK (label IN (
      'allergy', 'doctor', 'vision', 'dental', 'sleep', 'other'
    )),
  body text NOT NULL
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 280),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX child_health_notes_child_sort
  ON child_health_notes (child_id, sort_order, created_at);
```

Hub card: count of rows for that child. Never join this table into feed, circle, search, or analytics payloads.

#### `child_interests`

One row per label per child. Preschool interests and Class 6–8 “what they enjoy” share this table so promotion and class moves do not copy data between stores.

```sql
CREATE TABLE child_interests (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  label text NOT NULL
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, label)
);
```

Clearing every interest deletes all rows for that child. Hub card: any one label (stable order: `label` ascending) through Class 8; empty means + Add.

`label` is curated in the UI (stories, maths, design, …) but stored as text so new chips can ship without renaming the table. Do not invent a separate middle-school interests table.

#### `child_opportunity_plans`

One plan per catalogue opportunity per child. The catalogue stays the existing What next / Opportunities source. This table only stores the parent’s plan against a stable slug — JEE, NEET, SAT, CUET, UCAS routes, or whatever that catalogue later contains.

```sql
CREATE TABLE child_opportunity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  opportunity_slug text NOT NULL
    CHECK (char_length(btrim(opportunity_slug)) BETWEEN 1 AND 80),
  status text NOT NULL
    CHECK (status IN ('exploring', 'planning', 'this_season')),
  target_year smallint
    CHECK (
      target_year IS NULL
      OR target_year BETWEEN 2000 AND 2100
    ),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, opportunity_slug)
);

CREATE INDEX child_opportunity_plans_child_sort
  ON child_opportunity_plans (child_id, sort_order, created_at);
```

Saving the same slug again updates this row; it does not insert a second. Hub card: a `this_season` row’s short catalogue name if any, else the first plan by `sort_order`.

Use `opportunity_slug` and `target_year`, not `exam_slug` / `attempt_year`, so the same row can mean an entrance paper, a counselling route, or a later non-exam opportunity. Catalogue copy and eligibility stay outside this table. If a slug is later retired, the plan row remains readable so the parent can remove it.

#### Normalization rules

| Do | Do not |
|----|--------|
| One fact kind → one table | Stuff activities, health, and plans into a `children.metadata` jsonb |
| Many activities / notes / plans → many rows | One CSV or array column on `children` |
| Interests as `(child_id, label)` rows | A second interests table after Class 6 |
| Opportunity slug references catalogue identity by text | Duplicate full exam definitions in Child 360 |
| Domain-neutral table names | `sports`, `hobbies`, `competitive_exams` as table names |
| Cascade delete from `children` | Soft-delete health notes for Undo |
| Check ownership via `children.user_id` | Store `user_id` again on every Child 360 table |

New list rows append with the next `sort_order`. Undo after a row delete re-inserts a new row with the same fields; it does not keep a deleted tombstone.

Routes live under the signed-in parent’s children, with the child id in the path. A child id that is not theirs is not found.

### 12. Save can fail, and the form can be half filled

Save stays quiet until the required field is filled. While the save is in flight the button shows a busy state and a second tap does nothing. If the save fails, the form stays filled and shows the error, with a way to try again. Back, with anything typed, asks “Leave without saving?” Cancel on a clean form returns to the hub still showing + Add.

### 13. Preschool does not auto-promote

A birthday does not change the child to School. The parent explicitly uses Edit child and chooses School, then school, board, and class. On save:

- clear `age_years` and set `track = school`;
- run the existing circle sync, including the experienced-age overlap already specified for preschool;
- change Preschool to Studies and open the school Child’s Path from then on;
- relabel Activities as Sports without deleting rows;
- keep Interests and Health.

Switching a school child back to preschool is allowed only when the parent selects age 3 or 4 and a valid campus. It clears board and class as the current API requires. Existing school path history is not rewritten.

### 14. Removing the only child

The current API permits deleting the final child and marks onboarding incomplete. Child 360 must not show an empty hub.

For the final child, Remove child uses consequence-specific copy:

```
┌─────────────────────────────────────────┐
│ Remove Riya?                            │
│                                         │
│ This is your only child profile.        │
│ Removing it will delete Riya’s Child    │
│ 360 information and remove you from     │
│ her parent circles.                     │
│                                         │
│ You’ll need to add a child to continue. │
│                                         │
│ [ Keep Riya ]                           │
│ [ Remove and add another ]              │
└─────────────────────────────────────────┘
```

On confirm:

1. Delete the child and all dependent Child 360 rows in the same database transaction.
2. Recalculate circle memberships and mark onboarding incomplete, as the API does today.
3. Refresh and persist the returned/current user session so the client does not keep stale `onboardingComplete`.
4. Replace navigation with Add child using a `last_child_removed` source. Back cannot reopen the deleted child or an empty hub.
5. After replacement child save, use the existing location if it is still present and open the new child’s hub. If location is missing, continue to Location.

If another child remains, deletion selects another child and opens that hub. A failed delete stays on Edit child and shows the error. Child deletion has confirmation but no Undo; row-level sports, activity, health, and exam removal keeps its short Undo.

---

## Build order

1. Tab, and retitle the child list. Add child gains the School / Preschool choice. In-app save opens the hub; initial onboarding still completes Location and Ready.
2. Child hub with the four labels for its track and age. Studies opens Child’s Path with this child’s id; Preschool opens the short campus-and-age page.
3. Activities / sports page, including active or paused, remove, Undo, and the return to + Add.
4. Health page, owner-only, with the same remove behaviour.
5. Interests from preschool through Class 8; the after-10 lean in Class 9–10; catalogue exam plans from Class 11.
6. Last-child deletion navigation and stale-session protection.

Each step is usable on its own. Steps 3–5 can ship one branch at a time. The gap handling in the section above applies to whichever step is being built.
