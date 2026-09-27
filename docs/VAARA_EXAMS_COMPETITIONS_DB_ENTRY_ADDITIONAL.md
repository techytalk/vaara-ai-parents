# Vaara exams and competitions — additional database-entry records

Prepared and researched: 2026-09-27 (Asia/Kolkata)  
Additional entries: 37  
Companion to: Vaara_Exams_Competitions_DB_Entry.md (63 entries)

## Purpose and scope

This supplement contains newly gathered named events, examinations and programmes. It does not replace or modify the earlier 63 records. Together the documents contain 100 catalogue entries, not 100 currently open or fully verified competitions. Some entries are programme families, some are dated editions and some are specific challenge categories. The set is not exhaustive.

Only sourced values have been populated. Missing, ambiguous or conflicting values remain JSON null. This document is content for mapping in Cursor, not SQL, a migration or an authorisation to write to the database.

## Reading and import rules

- Import null as database NULL. Do not substitute zero, false, all boards, all India, a guessed year, or an empty string.
- A fee of 0 means explicitly free entry. Null means the fee was not established. Currency can remain null for a free global contest.
- Programme title, organiser and cycle must be used together for identity checks. ITO IMO/ISO/ICO are different from similarly named SOF exams.
- The five new local chess records are distinct listed events. Hyderabad and Ranga Reddy events share a venue/date but are separate district listings; do not merge based on those fields alone.
- Do not roll past dates forward into 2027. Keep past editions as historical records.
- A programme homepage or category rule page is not proof that a particular edition is open.
- Registration deadlines are separate from submission windows, last posting dates, examination dates and qualifier-only rounds.
- Date options in a schedule are alternatives. A tournament start does not imply its end date. A month-only announcement must retain month precision.
- Board, age and geographic nulls must not be treated as unrestricted eligibility.
- Venue locality is not a participant residence requirement.
- No participant names, birth dates, school rosters or payment details were collected into this document.
- These records require mapping to the actual schema. Required destination fields with missing source values must block publication rather than trigger invented defaults.
- Research metadata and caveats must remain separate from organiser facts.

## Fields

The data object uses the same fields as the first document.

| Field | Type | Meaning |
|---|---|---|
| name | text | Specific programme, edition or category name |
| organiser | text | Sourced organiser identity |
| subject | text | Descriptive focus, not an assumed application enum |
| edition_label | text | Explicit edition/cycle |
| eligibility_text | text | Captured class/school eligibility |
| board_eligibility | text | Explicit curriculum rule |
| age_eligibility | text | Age or birth-date rule with reference date where available |
| geographic_eligibility | text | Explicit participation/residence condition |
| participation_route | text | Direct, school, nomination or other sourced route |
| team_rules | text | Sourced team composition |
| fee_amount | number | Price only where the recorded route is unambiguous |
| fee_currency | text | Published currency |
| fee_basis | text | Per student, entry, team, challenge or other unit |
| fee_tax_note | text | Tax treatment and fee qualifications |
| registration_opens_on | date | Exact opening date |
| registration_closes_on | date | Exact deadline |
| registration_status_as_reported | text | Explicit source status, not an inferred live state |
| schedule | object | Named rounds, dates, windows, options or month |
| venue | text | Published venue |
| registration_url | URL | Explicit registration destination |
| official_url | URL | Official information source |
| source_urls | URL array | Evidence supporting the populated values |

### Additional supporting fields

- fee_options: route-specific fee objects when there is no single applicable fee. Map these to fee rows/options; do not select the lowest price as the universal fee. Each object retains route, amount, currency, basis, tax_note and, when needed, eligibility.
- research.checked_on: research date, not organiser publication date.
- research.coverage: editorial classification. edition_details means several edition fields were found, not that every field is complete; partial_listing means limited event data; programme_rules means category rules without a confirmed event schedule; programme_only means existence only.
- research.review_notes: uncertainties, conflicts, limitations and interpretation needed before publication.
- index_label and group: navigation labels in this document, not official IDs or database enums.

## Shared ITO school-route rules

The eight ITO records below describe school/offline participation only. The official 2026–27 school schedule gives Set A registration extended to 10 September 2026, Set B to 10 October 2026, and Set C to 10 November 2026. A school chooses one set per subject. Keep each set's deadline associated with its exam date; a single scalar deadline is deliberately empty.

The fee page lists school participation at INR 175 per student per subject. Do not substitute the INR 150 organiser remittance as the parent price. School/internal cutoffs may differ. Direct online entry and later-round fees must not inherit this school-route price.

Sources:
- https://www.indiantalent.org/offline-olympiad-exam-schedule
- https://www.indiantalent.org/olympiad-fee-structure-and-bank-details

## Index

Numbers 64–100 are document locators continuing the first document, not database IDs.

| Locator | Short label | Group | Evidence coverage |
|---:|---|---|---|
| 64 | State ranking chess | Hyderabad/Telangana | edition_details |
| 65 | State U15 chess | Hyderabad/Telangana | edition_details |
| 66 | Hyderabad U15 chess | Hyderabad/Telangana | edition_details |
| 67 | Ranga Reddy U15 chess | Hyderabad/Telangana | edition_details |
| 68 | TCI October chess | Hyderabad/Telangana | partial_listing |
| 69 | NTSC | Talent tests | edition_details |
| 70 | Computing Olympiad | Computing and science | edition_details |
| 71 | AI Olympiad | Computing and science | edition_details |
| 72 | PLO | Computing and science | edition_details |
| 73 | Breakthrough | Computing and science | edition_details |
| 74 | ISTSE | Talent tests | edition_details |
| 75 | ANTHE | Talent tests | edition_details |
| 76 | ITO GKIO | Indian Talent Olympiad | edition_details |
| 77 | ITO ICO | Indian Talent Olympiad | edition_details |
| 78 | ITO EIO | Indian Talent Olympiad | edition_details |
| 79 | ITO NSSO | Indian Talent Olympiad | edition_details |
| 80 | ITO NESO | Indian Talent Olympiad | edition_details |
| 81 | ITO IDO | Indian Talent Olympiad | edition_details |
| 82 | ITO IMO | Indian Talent Olympiad | edition_details |
| 83 | ITO ISO | Indian Talent Olympiad | edition_details |
| 84 | RoboSoccer | Robotics | programme_rules |
| 85 | Robo Race | Robotics | programme_rules |
| 86 | Line Follower | Robotics | programme_rules |
| 87 | Innovation Challenge | Robotics | programme_rules |
| 88 | Sumobot | Robotics | programme_rules |
| 89 | Maze Solver | Robotics | programme_rules |
| 90 | India Spelling Bee | Writing, language and arts | edition_details |
| 91 | Commonwealth writing | Writing, language and arts | edition_details |
| 92 | Dhai Akhar | Writing, language and arts | edition_details |
| 93 | Toyota Dream Car | Writing, language and arts | edition_details |
| 94 | Viksit Bharat painting | Writing, language and arts | edition_details |
| 95 | Clean sport painting | Writing, language and arts | edition_details |
| 96 | ISDS Team India | Debating | edition_details |
| 97 | ICYD India selections | Debating | edition_details |
| 98 | Kala Utsav | Writing, language and arts | programme_only |
| 99 | Sub-junior swimming | Aquatics | edition_details |
| 100 | Junior swimming | Aquatics | partial_listing |

## Structured records

Each block is valid JSON. Only the data and sourced fee options are candidate business values. Research metadata is for review/provenance.

### 64. State ranking chess

```json
{
  "index_label": "State ranking chess",
  "group": "Hyderabad/Telangana",
  "data": {
    "name": "61st Telangana State Ranking Chess Tournament",
    "organiser": "Telangana State Chess Association",
    "subject": "Chess",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 400,
    "fee_currency": "INR",
    "fee_basis": "Entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-09-27",
    "registration_status_as_reported": null,
    "schedule": {
      "starts_on": "2026-09-27"
    },
    "venue": "Karthik Gardens Function Hall, Lalaguda Moulali Road, Secunderabad",
    "registration_url": null,
    "official_url": "https://www.chesstelangana.com/event/61st-telangana-state-ranking-chess-tournament/",
    "source_urls": [
      "https://www.chesstelangana.com/event/61st-telangana-state-ranking-chess-tournament/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Exact birth-date and district-residence rules were not retrieved. Tournament start date is not an assumed one-day duration. Page lists a 9:00 am start on research day; do not advertise as still open."
  }
}
```

### 65. State U15 chess

```json
{
  "index_label": "State U15 chess",
  "group": "Hyderabad/Telangana",
  "data": {
    "name": "Telangana State Under-15 Chess Championship",
    "organiser": "Telangana State Chess Association",
    "subject": "Chess",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 750,
    "fee_currency": "INR",
    "fee_basis": "Entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-09-17",
    "registration_status_as_reported": "Closed",
    "schedule": {
      "starts_on": "2026-09-18"
    },
    "venue": "Karthik Gardens Function Hall, Lalapet Moulaali Road, Secunderabad",
    "registration_url": null,
    "official_url": "https://www.chesstelangana.com/event/telangana-state-under-15-chess-championship-2026/",
    "source_urls": [
      "https://www.chesstelangana.com/event/telangana-state-under-15-chess-championship-2026/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Exact birth-date and district-residence rules were not retrieved. Tournament start date is not an assumed one-day duration. Past dated edition; do not roll dates forward."
  }
}
```

### 66. Hyderabad U15 chess

```json
{
  "index_label": "Hyderabad U15 chess",
  "group": "Hyderabad/Telangana",
  "data": {
    "name": "Hyderabad District Under-15 Chess Championship",
    "organiser": "Telangana State Chess Association",
    "subject": "Chess",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 400,
    "fee_currency": "INR",
    "fee_basis": "Entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-09-05",
    "registration_status_as_reported": "Closed",
    "schedule": {
      "starts_on": "2026-09-05"
    },
    "venue": "Epistemo Vikas Leadership School, Nallagandla, Near BHEL, Hyderabad",
    "registration_url": null,
    "official_url": "https://www.chesstelangana.com/event/hyderabad-district-under-15-chess-championship-2026/",
    "source_urls": [
      "https://www.chesstelangana.com/event/hyderabad-district-under-15-chess-championship-2026/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Exact birth-date and district-residence rules were not retrieved. Tournament start date is not an assumed one-day duration. Past dated edition; do not roll dates forward."
  }
}
```

### 67. Ranga Reddy U15 chess

```json
{
  "index_label": "Ranga Reddy U15 chess",
  "group": "Hyderabad/Telangana",
  "data": {
    "name": "Ranga Reddy District Under-15 Championship",
    "organiser": "Telangana State Chess Association",
    "subject": "Chess",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 400,
    "fee_currency": "INR",
    "fee_basis": "Entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-09-05",
    "registration_status_as_reported": "Closed",
    "schedule": {
      "starts_on": "2026-09-05"
    },
    "venue": "Epistemo Vikas Leadership School, Nallagandla, Near BHEL, Hyderabad",
    "registration_url": null,
    "official_url": "https://www.chesstelangana.com/event/ranga-reddy-district-under-15-championship-2026/",
    "source_urls": [
      "https://www.chesstelangana.com/event/ranga-reddy-district-under-15-championship-2026/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Exact birth-date and district-residence rules were not retrieved. Tournament start date is not an assumed one-day duration. Past dated edition; do not roll dates forward."
  }
}
```

### 68. TCI October chess

```json
{
  "index_label": "TCI October chess",
  "group": "Hyderabad/Telangana",
  "data": {
    "name": "36th All India TCI 8,12 & 16 Chess Tournament",
    "organiser": null,
    "subject": "Chess",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "date": "2026-10-11"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.telanganachessacademy.com/events",
    "source_urls": [
      "https://www.telanganachessacademy.com/events"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "partial_listing",
    "review_notes": "Event title supplies category labels 8, 12 and 16; precise age-cutoff wording, fees, venue and actual organiser identity are not confirmed by the listing."
  }
}
```

### 69. NTSC

```json
{
  "index_label": "NTSC",
  "group": "Talent tests",
  "data": {
    "name": "Narayana Talent Search Competitive Test",
    "organiser": "Narayana",
    "subject": "Academic talent/admission assessment",
    "edition_label": "2026",
    "eligibility_text": "Students moving from Class V to VI through Class VIII to IX",
    "board_eligibility": "All boards, including CBSE and State",
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "Online form or Narayana branch",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": "Closed",
    "schedule": {
      "date": "2026-04-12",
      "mode": "Offline"
    },
    "venue": "Selected Narayana CO Schools across Telangana",
    "registration_url": null,
    "official_url": "https://ntsc.narayanagroup.com/",
    "source_urls": [
      "https://ntsc.narayanagroup.com/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Admission-related test for Narayana CO Schools. Past edition; not an independent government scholarship."
  }
}
```

### 70. Computing Olympiad

```json
{
  "index_label": "Computing Olympiad",
  "group": "Computing and science",
  "data": {
    "name": "Indian Computing Olympiad",
    "organiser": "IARCS",
    "subject": "Algorithms and programming",
    "edition_label": "2026",
    "eligibility_text": "Enrolled in school up to Class 12 in academic year 2025–26; Class 12 completers excluded",
    "board_eligibility": "Any school board",
    "age_eligibility": "No lower age limit",
    "geographic_eligibility": "School students across India",
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": "Closed",
    "schedule": {
      "stages": [
        {
          "name": "ZIO",
          "date": "2025-11-15"
        },
        {
          "name": "ZCO",
          "date": "2026-02-08"
        },
        {
          "name": "INOI",
          "date": "2026-02-14"
        }
      ]
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.iarcs.org.in/inoi/",
    "source_urls": [
      "https://www.iarcs.org.in/inoi/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "ZIO and ZCO are alternative first-round routes; INOI requires qualification. The page announces October 2026 registration for ICO-2027 without an exact day; do not reuse the 2026 dates or eligibility for 2027."
  }
}
```

### 71. AI Olympiad

```json
{
  "index_label": "AI Olympiad",
  "group": "Computing and science",
  "data": {
    "name": "Indian National AI Olympiad (INAIO)",
    "organiser": "ACM India with ACM IKDD",
    "subject": "Artificial intelligence",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-01-15",
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://manageexam.com/INAIO2026/",
    "source_urls": [
      "https://manageexam.com/INAIO2026/",
      "https://www.iarcs.org.in/inoi/"
    ]
  },
  "fee_options": [
    {
      "route": "Individual",
      "amount": 1200,
      "currency": "INR",
      "basis": "Per applicant",
      "tax_note": null
    },
    {
      "route": "Bulk, non-JNV school; minimum 10 students",
      "amount": 1000,
      "currency": "INR",
      "basis": "Per applicant",
      "tax_note": null
    },
    {
      "route": "Bulk, JNV school; minimum 10 students",
      "amount": 500,
      "currency": "INR",
      "basis": "Per applicant",
      "tax_note": null
    }
  ],
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Portal shows a 5 PM deadline but no timezone in captured text. Its lower timeline retains 2025 material, so event dates are empty. School/age eligibility not captured."
  }
}
```

### 72. PLO

```json
{
  "index_label": "PLO",
  "group": "Computing and science",
  "data": {
    "name": "Panini Linguistics Olympiad",
    "organiser": "IIIT Hyderabad",
    "subject": "Linguistics and language puzzles",
    "edition_label": "2027",
    "eligibility_text": "Junior: Grades 6–8; Senior: Grades 9–12. Previous invitational campers must enter Senior. Class 12 completers excluded.",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": "Non-citizens may enter Round 1 if resident and enrolled in school in India",
    "participation_route": "Individual or school group",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": "2026-09-19",
    "registration_closes_on": "2026-10-31",
    "registration_status_as_reported": "Open",
    "schedule": {
      "stage": "Round 1",
      "date": "2026-11-29"
    },
    "venue": null,
    "registration_url": "https://ltrc.iiit.ac.in/plo/registration.html",
    "official_url": "https://ltrc.iiit.ac.in/plo/index.html",
    "source_urls": [
      "https://ltrc.iiit.ac.in/plo/index.html",
      "https://ltrc.iiit.ac.in/plo/registration.html",
      "https://ltrc.iiit.ac.in/plo/eligibility.html"
    ]
  },
  "fee_options": [
    {
      "route": "Regular",
      "amount": 1180,
      "currency": "INR",
      "basis": "Per student",
      "tax_note": "Includes 18% GST"
    },
    {
      "route": "Access",
      "amount": 354,
      "currency": "INR",
      "basis": "Per student",
      "tax_note": "Includes 18% GST",
      "eligibility": "Regional-language medium, or English-medium family income below INR 6 lakh/year, or JNV student; documentation required"
    }
  ],
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "School groups of at least 10 receive tiered base-fee discounts; consult registration page. Non-school entrants require equivalent-grade assessment. Eligibility page mentions walk-ins; confirm centre acceptance before relying on that exception."
  }
}
```

### 73. Breakthrough

```json
{
  "index_label": "Breakthrough",
  "group": "Computing and science",
  "data": {
    "name": "Breakthrough Junior Challenge",
    "organiser": "Breakthrough Prize Foundation",
    "subject": "Science communication",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "At least 13 on 2026-05-11 at 00:01 PDT; not yet 19 on 2026-10-01 at 23:59 PDT",
    "geographic_eligibility": null,
    "participation_route": "Individual online submission",
    "team_rules": "Individual only; no group submissions",
    "fee_amount": 0,
    "fee_currency": null,
    "fee_basis": "Entry; no purchase/payment required",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "entry_window_opens_at": "2026-05-11T00:01:00-07:00",
      "entry_window_closes_at": "2026-09-15T23:59:00-07:00",
      "peer_review_closes_at": "2026-09-30T23:59:00-07:00"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://breakthroughjuniorchallenge.org/rules",
    "source_urls": [
      "https://breakthroughjuniorchallenge.org/rules"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "English video up to two minutes; at least five peer reviews required. Minors need guardian permission. Eligibility exclusions apply in full rules. Submission deadline has passed; peer review is not new registration."
  }
}
```

### 74. ISTSE

```json
{
  "index_label": "ISTSE",
  "group": "Talent tests",
  "data": {
    "name": "Indian School Talent Search Exam",
    "organiser": null,
    "subject": "Mental ability, mathematics, science and English",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "Direct online or school paper-based",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "direct_online": {
        "month": "2026-11"
      },
      "school_paper": {
        "date": "2027-02-03"
      }
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://istse.org/",
    "source_urls": [
      "https://istse.org/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Only month precision retained for online exam from live homepage. Fees and registration deadlines were not captured."
  }
}
```

### 75. ANTHE

```json
{
  "index_label": "ANTHE",
  "group": "Talent tests",
  "data": {
    "name": "Aakash National Talent Hunt Exam",
    "organiser": "Aakash",
    "subject": "Academic scholarship assessment",
    "edition_label": "2026",
    "eligibility_text": "Classes V–XII listed in the FAQ examination pattern",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "Online or offline",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://anthe.aakash.ac.in/home",
    "source_urls": [
      "https://anthe.aakash.ac.in/home",
      "https://anthe.aakash.ac.in/faqs"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Exam dates left empty because retrieved homepage snippets carry inconsistent schedules. Live FAQ lists offline 11/25 October and 1 November, online 27 October–1 November; obtain current circular before populating. Registration rule: five days before offline or two days before online date. Scholarship is for provider courses; fee not captured."
  }
}
```

### 76. ITO GKIO

```json
{
  "index_label": "ITO GKIO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "General Knowledge International Olympiad (GKIO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "General knowledge",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-09-28",
      "set_b": "2026-11-18",
      "set_c": "2026-12-15"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 77. ITO ICO

```json
{
  "index_label": "ITO ICO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "International Computer Olympiad (ICO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Computing",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-09-29",
      "set_b": "2026-11-19",
      "set_c": "2027-01-05"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 78. ITO EIO

```json
{
  "index_label": "ITO EIO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "English International Olympiad (EIO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "English",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-05",
      "set_b": "2026-11-26",
      "set_c": "2026-12-16"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 79. ITO NSSO

```json
{
  "index_label": "ITO NSSO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "National Social Studies Olympiad (NSSO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Social studies",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-06",
      "set_b": "2026-11-27",
      "set_c": "2027-01-08"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 80. ITO NESO

```json
{
  "index_label": "ITO NESO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "National Essay Olympiad (NESO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Essay writing",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-06",
      "set_b": "2026-11-27",
      "set_c": "2027-01-08"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 81. ITO IDO

```json
{
  "index_label": "ITO IDO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "International Drawing Olympiad (IDO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Drawing",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-07",
      "set_b": "2026-11-30",
      "set_c": "2027-01-11"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 82. ITO IMO

```json
{
  "index_label": "ITO IMO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "International Maths Olympiad (IMO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Mathematics",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-08",
      "set_b": "2026-12-01",
      "set_c": "2026-12-17"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 83. ITO ISO

```json
{
  "index_label": "ITO ISO",
  "group": "Indian Talent Olympiad",
  "data": {
    "name": "International Science Olympiad (ISO)",
    "organiser": "Indian Talent Olympiad",
    "subject": "Science",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline",
    "team_rules": null,
    "fee_amount": 175,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject, school entry",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "set_a": "2026-10-09",
      "set_b": "2026-12-02",
      "set_c": "2026-12-18"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiantalent.org/offline-olympiad-exam-schedule",
    "source_urls": [
      "https://www.indiantalent.org/offline-olympiad-exam-schedule",
      "https://www.indiantalent.org/olympiad-fee-structure-and-bank-details"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Shared ITO school-route rules below apply. Other organisers use similar acronyms; retain organiser identity."
  }
}
```

### 84. RoboSoccer

```json
{
  "index_label": "RoboSoccer",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian RoboSoccer — Junior",
    "organiser": "AICRA and WORSO",
    "subject": "Robotics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "8–16; upper age limit assessed on 2026-06-30",
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/robosoccer",
    "source_urls": [
      "https://www.technoxian.com/robosoccer"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. "
  }
}
```

### 85. Robo Race

```json
{
  "index_label": "Robo Race",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian Robo Race — Junior",
    "organiser": "AICRA and WORSO",
    "subject": "Robotics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "8–16; upper age limit assessed on 2026-06-30",
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/robo-race",
    "source_urls": [
      "https://www.technoxian.com/robo-race"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. "
  }
}
```

### 86. Line Follower

```json
{
  "index_label": "Line Follower",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian Line Follower — Junior",
    "organiser": "AICRA and WORSO",
    "subject": "Robotics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "8–16; upper age limit assessed on 2026-06-30",
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/fastest-line-follower",
    "source_urls": [
      "https://www.technoxian.com/fastest-line-follower"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. "
  }
}
```

### 87. Innovation Challenge

```json
{
  "index_label": "Innovation Challenge",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian Innovation Challenge — Junior",
    "organiser": "AICRA and WORSO",
    "subject": "Technology innovation",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "8–16; upper age limit assessed on 2026-06-30",
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/innovation-contest",
    "source_urls": [
      "https://www.technoxian.com/innovation-contest"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. "
  }
}
```

### 88. Sumobot

```json
{
  "index_label": "Sumobot",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian Sumobot — Junior",
    "organiser": "AICRA and WORSO",
    "subject": "Robotics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "8–16; upper age limit assessed on 2026-06-30",
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/sumobot",
    "source_urls": [
      "https://www.technoxian.com/sumobot"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. "
  }
}
```

### 89. Maze Solver

```json
{
  "index_label": "Maze Solver",
  "group": "Robotics",
  "data": {
    "name": "TechnoXian Maze Solver",
    "organiser": "AICRA and WORSO",
    "subject": "Robotics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "Online via RoboClub",
    "team_rules": null,
    "fee_amount": 2500,
    "fee_currency": "INR",
    "fee_basis": "National registration (India), per challenge",
    "fee_tax_note": "18% GST additional",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": "NRC: Noida Indoor Stadium, Noida–Delhi/NCR, India",
    "registration_url": "https://roboclub.technoxian.com",
    "official_url": "https://www.technoxian.com/maze-solver",
    "source_urls": [
      "https://www.technoxian.com/maze-solver"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_rules",
    "review_notes": "National-route fee only; international WRC fee differs. Exact event cycle/dates not established from the challenge page. Team rules left empty where summary and detailed wording need reconciliation. Page says open to all ages but also contains a generic junior age sentence; age filter held empty."
  }
}
```

### 90. India Spelling Bee

```json
{
  "index_label": "India Spelling Bee",
  "group": "Writing, language and arts",
  "data": {
    "name": "India Spelling Bee",
    "organiser": null,
    "subject": "Spelling",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–9",
    "board_eligibility": "Irrespective of board",
    "age_eligibility": null,
    "geographic_eligibility": "Students across India",
    "participation_route": "School; individual only if school has not registered",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": "2026-03-06",
    "registration_closes_on": null,
    "registration_status_as_reported": "Open",
    "schedule": null,
    "venue": null,
    "registration_url": "https://indiaspellingbee.com/registration.php",
    "official_url": "https://www.indiaspellingbee.com/",
    "source_urls": [
      "https://indiaspellingbee.com/faq.php",
      "https://indiaspellingbee.com/competition.php",
      "https://indiaspellingbee.com/individual.php"
    ]
  },
  "fee_options": [
    {
      "route": "School",
      "amount": 175,
      "currency": "INR",
      "basis": "Per student, minimum guide-book charge",
      "tax_note": null
    },
    {
      "route": "Individual",
      "amount": 270,
      "currency": "INR",
      "basis": "Per student",
      "tax_note": null
    }
  ],
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "School participation minimum 50, at least 10 per group. Individual registration has its own linked page. School/regional/national progression; dates not captured."
  }
}
```

### 91. Commonwealth writing

```json
{
  "index_label": "Commonwealth writing",
  "group": "Writing, language and arts",
  "data": {
    "name": "The Queen's Commonwealth Writing Competition",
    "organiser": "Royal Commonwealth Society",
    "subject": "Writing",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "18 or younger on 2026-04-30",
    "geographic_eligibility": "Commonwealth national or resident",
    "participation_route": "Online entry form",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Submission deadline",
      "closes_on": "2026-04-30"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.royalcwsociety.org/writing-competition/qcwc2026",
    "source_urls": [
      "https://www.royalcwsociety.org/writing-competition/qcwc2026"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past deadline. One response to an official question, up to 1,000 words. Theme: Common Ground: Better Together. Fee not established from retrieved page; empty rather than assumed free."
  }
}
```

### 92. Dhai Akhar

```json
{
  "index_label": "Dhai Akhar",
  "group": "Writing, language and arts",
  "data": {
    "name": "Dhai Akhar National Letter Writing Competition",
    "organiser": "Department of Posts",
    "subject": "Letter writing",
    "edition_label": "2026–27",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "Separate categories up to 18 and above 18; age certificate refers to 2026-01-01",
    "geographic_eligibility": null,
    "participation_route": "Handwritten postal entry",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Last posting date",
      "closes_on": "2026-10-31"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.indiapost.gov.in/",
    "source_urls": [
      "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2292171&lang=2&reg=48"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Theme: A Letter to Mother Earth: My Promise to Protect Nature. Inland card up to 500 words or envelope/A4 up to 1,000. Source is a Gujarat-circle release; Telangana destination and accepted regional languages remain unverified. Do not assume free postage."
  }
}
```

### 93. Toyota Dream Car

```json
{
  "index_label": "Toyota Dream Car",
  "group": "Writing, language and arts",
  "data": {
    "name": "Toyota Dream Car Art Contest — India",
    "organiser": "Toyota Kirloskar Motor",
    "subject": "Art",
    "edition_label": "19th edition (2026)",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "15 years and under",
    "geographic_eligibility": "Children across India",
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Entry window",
      "window_start": "2026-01-12",
      "window_end": "2026-02-12"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.toyotabharat.com/dream-car-contest/",
    "source_urls": [
      "https://www.toyotabharat.com/news/2026/tkm-announces-the-19th-edition-of-the-toyota-dream-car-art-contest.html"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past India edition. Do not substitute a global 2027 calendar for India's next registration window."
  }
}
```

### 94. Viksit Bharat painting

```json
{
  "index_label": "Viksit Bharat painting",
  "group": "Writing, language and arts",
  "data": {
    "name": "My Vision for Viksit Bharat 2047 Painting Competition",
    "organiser": "MyGov",
    "subject": "Painting",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Submission window",
      "window_start": "2026-06-01",
      "window_end": "2026-07-15"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.mygov.in/task/my-vision-viksit-bharat-2047-painting-competition",
    "source_urls": [
      "https://www.mygov.in/task/my-vision-viksit-bharat-2047-painting-competition"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past event. Age eligibility and fee not captured; school-age access must be checked before targeting parents."
  }
}
```

### 95. Clean sport painting

```json
{
  "index_label": "Clean sport painting",
  "group": "Writing, language and arts",
  "data": {
    "name": "Road to Glory — Winning the Right Way Painting Contest",
    "organiser": "NADA India with MyGov",
    "subject": "Painting",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Submission window",
      "window_start": "2026-07-15",
      "window_end": "2026-08-15"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://secure.mygov.in/task/road-glory-winning-right-way-painting-contest-2026",
    "source_urls": [
      "https://secure.mygov.in/task/road-glory-winning-right-way-painting-contest-2026"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past event. Exact age restrictions and fee were not captured."
  }
}
```

### 96. ISDS Team India

```json
{
  "index_label": "ISDS Team India",
  "group": "Debating",
  "data": {
    "name": "ISDS Team India Selections",
    "organiser": "Indian Schools Debating Society",
    "subject": "Debating",
    "edition_label": "2026–27",
    "eligibility_text": "Studying in India and still in school during July–August 2027; source states 12th graders eligible",
    "board_eligibility": null,
    "age_eligibility": "12–18",
    "geographic_eligibility": null,
    "participation_route": "Regional team track or Open Access individual track",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://indianschoolsdebatingsociety.com/team-india-selections-information/",
    "source_urls": [
      "https://indianschoolsdebatingsociety.com/team-india-selections-information/"
    ]
  },
  "fee_options": [
    {
      "route": "Team track",
      "amount": 2000,
      "currency": "INR",
      "basis": "Per student",
      "tax_note": null
    },
    {
      "route": "Open Access, selected applicants",
      "amount": 1000,
      "currency": "INR",
      "basis": "Per student",
      "tax_note": null
    }
  ],
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "South Junior round listed 26 September 2026 (Grades 7–9); national Senior round 25 October (Grades 10–12). Team grade/gender-composition rules apply; confirm complete rules. Open Access applications planned for November; exact day absent."
  }
}
```

### 97. ICYD India selections

```json
{
  "index_label": "ICYD India selections",
  "group": "Debating",
  "data": {
    "name": "ISDS ICYD Selections",
    "organiser": "Indian Schools Debating Society",
    "subject": "Debating",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": "15 or younger on 2026-08-31",
    "geographic_eligibility": null,
    "participation_route": "School team",
    "team_rules": "Two students from the same school",
    "fee_amount": 3000,
    "fee_currency": "INR",
    "fee_basis": "Per team",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-03-07",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Round 1",
      "date": "2026-03-14"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://indianschoolsdebatingsociety.com/icyd-selections/",
    "source_urls": [
      "https://indianschoolsdebatingsociety.com/icyd-selections/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past selection cycle. Registration deadline time: 12:00 PM IST. Further rounds invitation-based."
  }
}
```

### 98. Kala Utsav

```json
{
  "index_label": "Kala Utsav",
  "group": "Writing, language and arts",
  "data": {
    "name": "Kala Utsav",
    "organiser": "Ministry of Education / NCERT",
    "subject": "Arts and culture",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://kalautsav.ncert.gov.in/",
    "source_urls": [
      "https://kalautsav.ncert.gov.in/Samriddhi.php",
      "https://www.kalautsav.ncert.gov.in/pdf/2024/Kala_Utsav_2025_Guidelines.pdf"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "programme_only",
    "review_notes": "Programme existence confirmed; search found 2025 guidelines but full PDF retrieval failed. Current classes, art categories, route, fee and dates remain empty. Samriddhi is a separate extension; it is not imported as a student competition."
  }
}
```

### 99. Sub-junior swimming

```json
{
  "index_label": "Sub-junior swimming",
  "group": "Aquatics",
  "data": {
    "name": "42nd Sub Junior National Aquatic Championships — Swimming",
    "organiser": "Swimming Federation of India",
    "subject": "Swimming",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "window_start": "2026-08-06",
      "window_end": "2026-08-09"
    },
    "venue": "Jaipur",
    "registration_url": null,
    "official_url": "https://www.swimming.org.in/42nd-sub-junior-national-aquatic-championships-swimming-2026/",
    "source_urls": [
      "https://www.swimming.org.in/42nd-sub-junior-national-aquatic-championships-swimming-2026/",
      "https://www.swimming.org.in/circulars/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "edition_details",
    "review_notes": "Past edition. Birth-year groups, qualifying standards, state nomination and fees need the event circular. Do not treat results availability as direct registration."
  }
}
```

### 100. Junior swimming

```json
{
  "index_label": "Junior swimming",
  "group": "Aquatics",
  "data": {
    "name": "52nd Junior National Aquatic Championships — Swimming",
    "organiser": "Swimming Federation of India",
    "subject": "Swimming",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.swimming.org.in/52nd-junior-national-championship-2026/",
    "source_urls": [
      "https://www.swimming.org.in/circulars/"
    ]
  },
  "fee_options": null,
  "research": {
    "checked_on": "2026-09-27",
    "coverage": "partial_listing",
    "review_notes": "Current official circular index confirms the event, but detailed circular was not retrieved. Dates, venue, age groups, qualifications and fees deliberately empty."
  }
}
```

## Coverage gaps remaining

This supplement adds concrete local and national/international entries but does not establish complete coverage. Telangana school/district athletics, badminton, football, swimming selection trials, music and dance events, abacus providers, MUNs, hackathons and short-lived school-hosted competitions still need organiser-specific circulars.

Additional ITO subjects and preschool categories were visible in the organiser's schedule but are not included in these eight school-subject records. Do not assume the school-grade eligibility applies to preschool categories.

Do not import social-media mentions, search-result date snippets, generic training programmes or school achievement reports as confirmed open competitions. A separate discovery backlog is appropriate until an organiser source establishes the event and its applicable fields.

## Handoff checklist

1. Import the supplement separately from the earlier 63; compare name plus organiser plus category/cycle to avoid duplicates.
2. Resolve programme versus edition versus category before insertion. For Indian Computing Olympiad, ZIO/ZCO/INOI are stages in one record here, not three unrelated entry opportunities.
3. Preserve fee_options and ITO set/deadline relationships.
4. Keep sparse and conflict-bearing records as unpublished drafts.
5. Recheck deadlines, prices, source status and complete eligibility before making registration claims to parents.
6. Leave every unresolved field NULL. No code or database changes were performed to prepare this document.

