# Vaara exams and competitions — database-entry source document

Prepared: 2026-09-27  
Scope: the programmes gathered in this conversation; not an exhaustive directory.  
Purpose: structured content for Cursor to map into Vaara's database. No database or application changes have been made.

## 1. Rules for using this document

- Missing or unresolved values are `null` in the JSON records. Import them as database NULL, not as the text "null", zero, false, an empty array, "TBD", or "all".
- A zero fee is populated only where participation was explicitly described as free.
- No IDs, foreign keys, slugs, publication flags or application enum values have been invented.
- These are staging records, not executable inserts and not a claim to match the current database schema. Map them to the actual schema in Cursor before insertion.
- Programme-only entries remain useful catalogue drafts. An absent edition does not mean a confirmed 2026–27 offering.
- Review notes are editorial metadata, not organiser facts to display as confirmed fields. They explain omitted values, source conflicts or limited coverage.
- A blank board restriction does not mean all boards are accepted. A blank geographic restriction does not mean nationwide eligibility. An organiser's location does not establish participation geography.
- Do not translate nursery, kindergarten, IB or Cambridge labels to numeric grades without an explicit mapping.
- Alternative dates are choices, not a continuous event range. Dates use YYYY-MM-DD. Month-only announcements remain YYYY-MM, with no invented day.
- Source-reported open/closed status is a research snapshot. Do not infer current availability from an upcoming exam date.
- Registration, payment, school nomination, project submission and examination deadlines are distinct.
- Source links below are carried forward from the research in this conversation. This document is a consolidation, not a fresh re-verification of every page.
- Do not publish a complete eligibility match from a partial record. Do not auto-publish all records merely because they are included here.

## 2. Field dictionary

All business fields are nullable. The keys below describe a neutral interchange format, not proposed changes to live tables.

| Field | Type | Meaning |
|---|---|---|
| name | text | Programme or exam name as identified in research |
| organiser | text | Named organiser, where captured |
| subject | text | Captured subject/focus; not a database enum |
| edition_label | text | Explicit cycle/year; left empty when not captured |
| eligibility_text | text | Captured class or other eligibility wording |
| board_eligibility | text | Explicit curriculum acceptance/restrictions only |
| age_eligibility | text | Explicit age/birth-date rule only |
| geographic_eligibility | text | Explicit residence/participation restriction only |
| participation_route | text | School, individual, nomination, or stated combination |
| team_rules | text | Individual/team participation rules; not school nomination quotas |
| fee_amount | number | Unambiguous participation price; zero only for confirmed free entry |
| fee_currency | text | Currency of the populated fee |
| fee_basis | text | Per student, project, subject or other captured unit |
| fee_tax_note | text | Tax treatment and optional extras, where stated |
| registration_opens_on | date | Exact registration opening, if unambiguous |
| registration_closes_on | date | Exact registration deadline, if unambiguous |
| registration_status_as_reported | text | Source statement; no computed status |
| schedule | object | Explicit event dates, options, stage, window or month |
| venue | text | Published venue description; no inferred city |
| registration_url | URL | Verified registration destination; homepage is not substituted |
| official_url | URL | Official information destination |
| source_urls | URL array | Pages supporting the captured record; null if not captured |
| review_notes | text | Editorial caveats outside the business-data object |

### Schedule object conventions

`date` is a single event date; `date_options` are alternatives. `window_start` and `window_end` represent a published window. `closes_on` belongs to the named stage, not automatically to registration. `month` retains month precision. Route-specific and level-specific keys preserve relationships that would be lost in one generic exam-date field.

### Fee handling

Unified Council records have empty scalar fee fields because the route changes the fee and online pricing conflicts. The captured school price and online quotations are retained in review notes for later route-specific mapping. CREST fees are empty because the fee evidence did not cover each record's full class range. Do not interpret either as free.

## 3. Catalogue index

The row number is only a document locator, not a database ID.

| Row | Programme | Organiser | Edition |
|---:|---|---|---|
| 1 | IGKO | Science Olympiad Foundation | 2026–27 |
| 2 | IEO | Science Olympiad Foundation | 2026–27 |
| 3 | ISO | Science Olympiad Foundation | 2026–27 |
| 4 | IMO | Science Olympiad Foundation | 2026–27 |
| 5 | ICSO | Science Olympiad Foundation | 2026–27 |
| 6 | ISSO | Science Olympiad Foundation | 2026–27 |
| 7 | IHO | Science Olympiad Foundation | 2026–27 |
| 8 | ICO | Science Olympiad Foundation | 2026–27 |
| 9 | NSTSE | Unified Council | 2026–27 |
| 10 | UIMO | Unified Council | 2026–27 |
| 11 | UIEO | Unified Council | 2026–27 |
| 12 | UICO | Unified Council | 2026–27 |
| 13 | CEO | CREST Olympiads |  |
| 14 | CMO | CREST Olympiads |  |
| 15 | CSO | CREST Olympiads |  |
| 16 | CRO | CREST Olympiads |  |
| 17 | CCO | CREST Olympiads |  |
| 18 | IGWO | CREST Olympiads |  |
| 19 | Spell Bee — Winter | CREST Olympiads |  |
| 20 | Spell Bee — Summer | CREST Olympiads |  |
| 21 | CIDO | CREST Olympiads |  |
| 22 | CMMO | CREST Olympiads |  |
| 23 | Vidyarthi Vigyan Manthan (VVM) |  | 2026–27 |
| 24 | Bebras India |  | 2026 |
| 25 | GREEN Olympiad | TERI | 2026–27 |
| 26 | Wild Wisdom Global Challenge | WWF India |  |
| 27 | IRIS National Fair |  |  |
| 28 | INSPIRE Awards–MANAK |  | 2026–27 |
| 29 | National Painting Competition on Energy Conservation | Bureau of Energy Efficiency | 2026 |
| 30 | NSEP |  | 2026–27 |
| 31 | NSEC |  | 2026–27 |
| 32 | NSEB |  | 2026–27 |
| 33 | NSEA |  | 2026–27 |
| 34 | IOQM |  | 2026 |
| 35 | NSEJS | IAPT |  |
| 36 | SRMO | SRF/SRMOE |  |
| 37 | CVRSO | SRF/SRMOE |  |
| 38 | AKO | SRF/SRMOE |  |
| 39 | SEO | SRF/SRMOE |  |
| 40 | SCO | SRF/SRMOE |  |
| 41 | Mathematics Olympiad | SilverZone |  |
| 42 | Science Olympiad | SilverZone |  |
| 43 | English Language Olympiad | SilverZone |  |
| 44 | Computer Science Olympiad | SilverZone |  |
| 45 | General Knowledge Olympiad | SilverZone |  |
| 46 | Akhil Bharatiya Hindi Olympiad | SilverZone |  |
| 47 | Social Studies Olympiad | SilverZone |  |
| 48 | Reasoning and Aptitude Olympiad | SilverZone |  |
| 49 | STEM Innovation Olympiad | SilverZone |  |
| 50 | Aryabhata Ganit Challenge | CBSE |  |
| 51 | Science Challenge | CBSE |  |
| 52 | Reading Challenge | CBSE |  |
| 53 | Heritage India Quiz | CBSE |  |
| 54 | Budding Authors | CBSE |  |
| 55 | Expression Series | CBSE |  |
| 56 | Storytelling Competition | CBSE |  |
| 57 | Science Exhibition | CBSE |  |
| 58 | Skill Expo | CBSE |  |
| 59 | Sports competitions | CBSE |  |
| 60 | Young India Culinary Championship | CBSE |  |
| 61 | NMMS — Telangana |  |  |
| 62 | World Robot Olympiad India |  |  |
| 63 | INTACH Heritage Quiz |  |  |

## 4. Structured records

Each JSON block is independently parseable. `data` holds candidate content values. `review_notes` must remain separate from published facts.

### 1. IGKO

```json
{
  "data": {
    "name": "IGKO",
    "organiser": "Science Olympiad Foundation",
    "subject": "General knowledge",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-09-22",
        "2026-10-06",
        "2026-11-03"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 2. IEO

```json
{
  "data": {
    "name": "IEO",
    "organiser": "Science Olympiad Foundation",
    "subject": "English",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-09-30",
        "2026-10-27",
        "2026-11-17"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 3. ISO

```json
{
  "data": {
    "name": "ISO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Science",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-10-30",
        "2026-11-19",
        "2026-12-03"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 4. IMO

```json
{
  "data": {
    "name": "IMO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Mathematics",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-10-23",
        "2026-11-26",
        "2026-12-10"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 5. ICSO

```json
{
  "data": {
    "name": "ICSO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Computer science",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-09-24",
        "2026-12-17"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 6. ISSO

```json
{
  "data": {
    "name": "ISSO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Social studies",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 3–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-11-30",
        "2027-01-19"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 7. IHO

```json
{
  "data": {
    "name": "IHO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Hindi",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 3–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-11-23",
        "2027-01-22"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 8. ICO

```json
{
  "data": {
    "name": "ICO",
    "organiser": "Science Olympiad Foundation",
    "subject": "Commerce",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 11–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": 170,
    "fee_currency": "INR",
    "fee_basis": "Per student per Olympiad",
    "fee_tax_note": "Includes GST; school collection total must be confirmed",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "First examination",
      "date_options": [
        "2026-11-30",
        "2027-01-19"
      ],
      "selection_rule": "School chooses one date"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://sofworld.org/",
    "source_urls": [
      "https://sofworld.org/node/1511/www.sofworld.org",
      "https://sofworld.org/nso/about-nso-exam/how-to-participate"
    ]
  },
  "review_notes": "School submission is due 30 days before its selected date. No single registration deadline is populated. SOF IMO is distinct from the IOQM selection pathway."
}
```

### 9. NSTSE

```json
{
  "data": {
    "name": "NSTSE",
    "organiser": "Unified Council",
    "subject": "Mathematics and science",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline; individual/online",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "school_offline_date_options": [
        "2026-11-20",
        "2026-12-02"
      ],
      "direct_online_date": "2027-01-24"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.unifiedcouncil.com/about-nstse.html",
    "source_urls": [
      "https://www.unifiedcouncil.com/about-nstse.html",
      "https://www.unifiedcouncil.com/Registration-2026-27.aspx"
    ]
  },
  "review_notes": "Fee depends on route: school/offline ₹150 per student; direct portal displays a ₹413 bundle. Some programme text quotes a different online price. A single fee is intentionally empty; create route-specific fee rows after resolving online pricing. NSTSE syllabus suitability does not establish all-board eligibility."
}
```

### 10. UIMO

```json
{
  "data": {
    "name": "UIMO",
    "organiser": "Unified Council",
    "subject": "Mathematics",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline; individual/online",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "school_offline_date_options": [
        "2026-12-11"
      ],
      "direct_online_date": "2027-01-10"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.unifiedcouncil.com/about-uimo.html",
    "source_urls": [
      "https://www.unifiedcouncil.com/about-uimo.html",
      "https://www.unifiedcouncil.com/Registration-2026-27.aspx"
    ]
  },
  "review_notes": "Fee depends on route: school/offline ₹150 per student; direct portal displays a ₹413 bundle. Some programme text quotes a different online price. A single fee is intentionally empty; create route-specific fee rows after resolving online pricing. NSTSE syllabus suitability does not establish all-board eligibility."
}
```

### 11. UIEO

```json
{
  "data": {
    "name": "UIEO",
    "organiser": "Unified Council",
    "subject": "English",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 1–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline; individual/online",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "school_offline_date_options": [
        "2026-10-29",
        "2026-11-13"
      ],
      "direct_online_date": "2027-01-03"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.unifiedcouncil.com/about-uieo.html",
    "source_urls": [
      "https://www.unifiedcouncil.com/about-uieo.html",
      "https://www.unifiedcouncil.com/Registration-2026-27.aspx"
    ]
  },
  "review_notes": "Fee depends on route: school/offline ₹150 per student; direct portal displays a ₹413 bundle. Some programme text quotes a different online price. A single fee is intentionally empty; create route-specific fee rows after resolving online pricing. NSTSE syllabus suitability does not establish all-board eligibility."
}
```

### 12. UICO

```json
{
  "data": {
    "name": "UICO",
    "organiser": "Unified Council",
    "subject": "Computing",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 2–10",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/offline; individual/online",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "school_offline_date_options": [
        "2026-09-18"
      ],
      "direct_online_date": "2026-12-27"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.unifiedcouncil.com/about-uco.html",
    "source_urls": [
      "https://www.unifiedcouncil.com/about-uco.html",
      "https://www.unifiedcouncil.com/Registration-2026-27.aspx"
    ]
  },
  "review_notes": "Fee depends on route: school/offline ₹150 per student; direct portal displays a ₹413 bundle. Some programme text quotes a different online price. A single fee is intentionally empty; create route-specific fee rows after resolving online pricing. NSTSE syllabus suitability does not establish all-board eligibility."
}
```

### 13. CEO

```json
{
  "data": {
    "name": "CEO",
    "organiser": "CREST Olympiads",
    "subject": "English",
    "edition_label": null,
    "eligibility_text": "Nursery–Class 10",
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
      "date_options": [
        "2026-12-01",
        "2026-12-05"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/english-olympiad-ceo",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 14. CMO

```json
{
  "data": {
    "name": "CMO",
    "organiser": "CREST Olympiads",
    "subject": "Mathematics",
    "edition_label": null,
    "eligibility_text": "Nursery–Class 10",
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
      "date_options": [
        "2026-12-10",
        "2026-12-19"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/maths-olympiad-cmo",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 15. CSO

```json
{
  "data": {
    "name": "CSO",
    "organiser": "CREST Olympiads",
    "subject": "Science",
    "edition_label": null,
    "eligibility_text": "Nursery–Class 10",
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
      "date_options": [
        "2026-12-03",
        "2026-12-12"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/science-olympiad-cso",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 16. CRO

```json
{
  "data": {
    "name": "CRO",
    "organiser": "CREST Olympiads",
    "subject": "Reasoning",
    "edition_label": null,
    "eligibility_text": "Classes 1–10",
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
      "date_options": [
        "2027-01-09",
        "2027-01-19"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/reasoning-olympiad-cro",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 17. CCO

```json
{
  "data": {
    "name": "CCO",
    "organiser": "CREST Olympiads",
    "subject": "Cyber/computing",
    "edition_label": null,
    "eligibility_text": "Classes 1–10",
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
      "date_options": [
        "2027-01-12",
        "2027-01-27"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/cyber-olympiad-cco",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 18. IGWO

```json
{
  "data": {
    "name": "IGWO",
    "organiser": "CREST Olympiads",
    "subject": "Environment",
    "edition_label": null,
    "eligibility_text": "Classes 1–10",
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
      "date_options": [
        "2027-01-14",
        "2027-01-23"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/green-olympiad-gwo",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 19. Spell Bee — Winter

```json
{
  "data": {
    "name": "Spell Bee — Winter",
    "organiser": "CREST Olympiads",
    "subject": "English spelling",
    "edition_label": null,
    "eligibility_text": "Senior KG–Class 8",
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
      "date_options": [
        "2027-01-07",
        "2027-01-16"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/spellbee-winter-csbw",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 20. Spell Bee — Summer

```json
{
  "data": {
    "name": "Spell Bee — Summer",
    "organiser": "CREST Olympiads",
    "subject": "English spelling",
    "edition_label": null,
    "eligibility_text": "Senior KG–Class 8",
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
      "date_options": [
        "2026-07-07",
        "2026-07-11"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/spellbee-summer-csb",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 21. CIDO

```json
{
  "data": {
    "name": "CIDO",
    "organiser": "CREST Olympiads",
    "subject": "Drawing",
    "edition_label": null,
    "eligibility_text": "Senior KG–Class 10",
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
      "date_options": [
        "2026-07-21",
        "2026-07-25"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/drawing-olympiad-cido",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 22. CMMO

```json
{
  "data": {
    "name": "CMMO",
    "organiser": "CREST Olympiads",
    "subject": "Mental mathematics",
    "edition_label": null,
    "eligibility_text": "Senior KG–Class 12",
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
      "date_options": [
        "2026-07-09",
        "2026-07-14"
      ]
    },
    "venue": null,
    "registration_url": "https://www.crestolympiads.com/registration",
    "official_url": "https://www.crestolympiads.com/mental-maths-mmo",
    "source_urls": [
      "https://www.crestolympiads.com/register-school",
      "https://www.crestolympiads.com/exam-schedule",
      "https://www.crestolympiads.com/syllabus",
      "https://www.crestolympiads.com/sample-papers"
    ]
  },
  "review_notes": "Fee left empty: checked class-specific pages quote ₹225 for some subjects, but the full eligible class range was not verified. Do not apply that fee to every subject or preschool class. Student registration URL is the shared CREST page and does not show that this edition is still open."
}
```

### 23. Vidyarthi Vigyan Manthan (VVM)

```json
{
  "data": {
    "name": "Vidyarthi Vigyan Manthan (VVM)",
    "organiser": null,
    "subject": "Science",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 6–11",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": "Students currently studying in India",
    "participation_route": "School or individual",
    "team_rules": null,
    "fee_amount": 200,
    "fee_currency": "INR",
    "fee_basis": "Per student",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-09-30",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Level 1",
      "window_start": "2026-11-16",
      "window_end": "2026-11-21"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://vvm.org.in/",
    "source_urls": [
      "https://vvm.org.in/student-registration",
      "https://vvm.org.in/registration-process",
      "https://d32lt7x711uuz8.cloudfront.net/2627/Endorsement/Kendriya_Vidyalayas.pdf"
    ]
  },
  "review_notes": null
}
```

### 24. Bebras India

```json
{
  "data": {
    "name": "Bebras India",
    "organiser": null,
    "subject": "Computational thinking",
    "edition_label": "2026",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School/coordinator",
    "team_rules": null,
    "fee_amount": 0,
    "fee_currency": "INR",
    "fee_basis": "Participation",
    "fee_tax_note": null,
    "registration_opens_on": "2026-10-01",
    "registration_closes_on": "2026-11-28",
    "registration_status_as_reported": null,
    "schedule": {
      "window_start": "2026-11-16",
      "window_end": "2026-12-05"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.bebras.in/",
    "source_urls": [
      "https://www.bebras.in/register",
      "https://www.bebras.in/"
    ]
  },
  "review_notes": "Exact class/age mapping left empty: prior summary was approximate. Use the current category rules before eligibility filtering."
}
```

### 25. GREEN Olympiad

```json
{
  "data": {
    "name": "GREEN Olympiad",
    "organiser": "TERI",
    "subject": "Environment and sustainability",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 4–12",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School; minimum 20 students",
    "team_rules": null,
    "fee_amount": 250,
    "fee_currency": "INR",
    "fee_basis": "Per student in India",
    "fee_tax_note": "Includes taxes; optional mock paper ₹100",
    "registration_opens_on": null,
    "registration_closes_on": "2026-08-10",
    "registration_status_as_reported": "Closed",
    "schedule": {
      "date_options": [
        "2026-10-08",
        "2026-11-18"
      ]
    },
    "venue": "Participating school",
    "registration_url": null,
    "official_url": "https://www.teriin.org/olympiad/",
    "source_urls": [
      "https://www.teriin.org/olympiad/faq.php",
      "https://teriin.org/press-release/teri-extends-green-olympiad-2026-27-registration-deadline-10-august-invites-more"
    ]
  },
  "review_notes": null
}
```

### 26. Wild Wisdom Global Challenge

```json
{
  "data": {
    "name": "Wild Wisdom Global Challenge",
    "organiser": "WWF India",
    "subject": "Wildlife and biodiversity",
    "edition_label": null,
    "eligibility_text": "Classes 6–9",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School; minimum 50 students",
    "team_rules": null,
    "fee_amount": 0,
    "fee_currency": "INR",
    "fee_basis": "Participation",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": "2026-08-15",
    "registration_status_as_reported": "Closed",
    "schedule": {
      "stage": "Classroom challenge",
      "closes_on": "2026-09-28"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://wildwisdom.wwfindia.org/",
    "source_urls": [
      "https://wildwisdom.wwfindia.org/",
      "https://wildwisdom.wwfindia.org/register/school/"
    ]
  },
  "review_notes": "28 September is the challenge extension for registered schools, not a registration extension."
}
```

### 27. IRIS National Fair

```json
{
  "data": {
    "name": "IRIS National Fair",
    "organiser": null,
    "subject": "Science and engineering research",
    "edition_label": null,
    "eligibility_text": "Classes 5–12; Indian-origin students residing in India",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": "Individual or team of two",
    "fee_amount": 5000,
    "fee_currency": "INR",
    "fee_basis": "Per project",
    "fee_tax_note": "Applicable taxes additional; EWS waiver subject to documents",
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "National fair",
      "month": "2026-11"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://iris.exstemplar.com/",
    "source_urls": [
      "https://iris.exstemplar.com/"
    ]
  },
  "review_notes": "Registration deadline empty because the page conflicts: current FAQ/key dates say 3 October 2026, while other text contains 15 October/August references. Verify with organiser. Required submission includes synopsis, research paper and 90-second video."
}
```

### 28. INSPIRE Awards–MANAK

```json
{
  "data": {
    "name": "INSPIRE Awards–MANAK",
    "organiser": null,
    "subject": "Innovation",
    "edition_label": "2026–27",
    "eligibility_text": "Classes 6–12; Classes 11–12 science stream only",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School nomination",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": "Open",
    "schedule": null,
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.inspireawards-dst.gov.in/",
    "source_urls": [
      "https://www.inspireawards-dst.gov.in/"
    ]
  },
  "review_notes": "Open is the source-reported status at research time, not a live guarantee. School nomination limits are not student team-size limits. School may nominate up to five ideas, at most two from Classes 11–12."
}
```

### 29. National Painting Competition on Energy Conservation

```json
{
  "data": {
    "name": "National Painting Competition on Energy Conservation",
    "organiser": "Bureau of Energy Efficiency",
    "subject": "Painting and energy conservation",
    "edition_label": "2026",
    "eligibility_text": "Classes 5–7 and Classes 8–10, separate groups; central/state recognised schools",
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": "School",
    "team_rules": null,
    "fee_amount": null,
    "fee_currency": null,
    "fee_basis": null,
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "Painting submission",
      "closes_on": "2026-10-15"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://paintings.beeindia.gov.in/",
    "source_urls": [
      "https://paintings.beeindia.gov.in/show_content.php?lang=1&level=0&lid=18&ls_id=93"
    ]
  },
  "review_notes": "Painting submission deadline is not stored as a registration deadline. Progression is school, state and national."
}
```

### 30. NSEP

```json
{
  "data": {
    "name": "NSEP",
    "organiser": null,
    "subject": "Physics",
    "edition_label": "2026–27",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 300,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject",
    "fee_tax_note": null,
    "registration_opens_on": "2026-08-21",
    "registration_closes_on": "2026-09-14",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "National Standard Examination",
      "date": "2026-11-22"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/",
    "source_urls": [
      "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/"
    ]
  },
  "review_notes": "Exact birth-date, nationality, residence and education eligibility must be checked in the cycle brochure; do not derive eligibility from school class."
}
```

### 31. NSEC

```json
{
  "data": {
    "name": "NSEC",
    "organiser": null,
    "subject": "Chemistry",
    "edition_label": "2026–27",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 300,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject",
    "fee_tax_note": null,
    "registration_opens_on": "2026-08-21",
    "registration_closes_on": "2026-09-14",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "National Standard Examination",
      "date": "2026-11-22"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/",
    "source_urls": [
      "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/"
    ]
  },
  "review_notes": "Exact birth-date, nationality, residence and education eligibility must be checked in the cycle brochure; do not derive eligibility from school class."
}
```

### 32. NSEB

```json
{
  "data": {
    "name": "NSEB",
    "organiser": null,
    "subject": "Biology",
    "edition_label": "2026–27",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 300,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject",
    "fee_tax_note": null,
    "registration_opens_on": "2026-08-21",
    "registration_closes_on": "2026-09-14",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "National Standard Examination",
      "date": "2026-11-22"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/",
    "source_urls": [
      "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/"
    ]
  },
  "review_notes": "Exact birth-date, nationality, residence and education eligibility must be checked in the cycle brochure; do not derive eligibility from school class."
}
```

### 33. NSEA

```json
{
  "data": {
    "name": "NSEA",
    "organiser": null,
    "subject": "Astronomy",
    "edition_label": "2026–27",
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 300,
    "fee_currency": "INR",
    "fee_basis": "Per student per subject",
    "fee_tax_note": null,
    "registration_opens_on": "2026-08-21",
    "registration_closes_on": "2026-09-14",
    "registration_status_as_reported": null,
    "schedule": {
      "stage": "National Standard Examination",
      "date": "2026-11-21"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/",
    "source_urls": [
      "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/"
    ]
  },
  "review_notes": "Exact birth-date, nationality, residence and education eligibility must be checked in the cycle brochure; do not derive eligibility from school class."
}
```

### 34. IOQM

```json
{
  "data": {
    "name": "IOQM",
    "organiser": null,
    "subject": "Mathematics",
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
    "registration_closes_on": "2026-07-27",
    "registration_status_as_reported": null,
    "schedule": {
      "date": "2026-09-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.mtai.org.in/ioqm-2026/",
    "source_urls": [
      "https://www.mtai.org.in/ioqm-2026/"
    ]
  },
  "review_notes": "Registration opening differs by route and source text; left empty. Fee and precise eligibility not captured. Subsequent stages require qualification."
}
```

### 35. NSEJS

```json
{
  "data": {
    "name": "NSEJS",
    "organiser": "IAPT",
    "subject": "Junior science",
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
    "official_url": "https://jso.indapt.org.in/",
    "source_urls": [
      "https://olympiads.hbcse.tifr.res.in/science-olympiad-2026-2027/"
    ]
  },
  "review_notes": "Current cycle dates, fee and eligibility not verified. Official_url is the linked junior-science destination, not proof that its contents were reviewed."
}
```

### 36. SRMO

```json
{
  "data": {
    "name": "SRMO",
    "organiser": "SRF/SRMOE",
    "subject": "Mathematics",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 150,
    "fee_currency": "INR",
    "fee_basis": "Per Olympiad; covers Levels 1 and 2",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "level_1": "2026-11-04",
      "level_2": "2026-12-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.srmoe.com/",
    "source_urls": [
      "https://www.srmoe.com/",
      "https://www.srmoe.com/exam.php"
    ]
  },
  "review_notes": "Organiser lists Classes 3–12 generally; per-paper eligibility left empty. Registration date left empty due to current banner 29 September versus generic 31 August text. Government-school free quotas conflict. "
}
```

### 37. CVRSO

```json
{
  "data": {
    "name": "CVRSO",
    "organiser": "SRF/SRMOE",
    "subject": "Science",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 150,
    "fee_currency": "INR",
    "fee_basis": "Per Olympiad; covers Levels 1 and 2",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "level_1": "2026-11-04",
      "level_2": "2026-12-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.srmoe.com/",
    "source_urls": [
      "https://www.srmoe.com/",
      "https://www.srmoe.com/exam.php"
    ]
  },
  "review_notes": "Organiser lists Classes 3–12 generally; per-paper eligibility left empty. Registration date left empty due to current banner 29 September versus generic 31 August text. Government-school free quotas conflict. "
}
```

### 38. AKO

```json
{
  "data": {
    "name": "AKO",
    "organiser": "SRF/SRMOE",
    "subject": "Multidisciplinary knowledge",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 150,
    "fee_currency": "INR",
    "fee_basis": "Per Olympiad; covers Levels 1 and 2",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "level_1": "2026-11-05",
      "level_2": "2026-12-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.srmoe.com/",
    "source_urls": [
      "https://www.srmoe.com/",
      "https://www.srmoe.com/exam.php"
    ]
  },
  "review_notes": "Organiser lists Classes 3–12 generally; per-paper eligibility left empty. Registration date left empty due to current banner 29 September versus generic 31 August text. Government-school free quotas conflict. "
}
```

### 39. SEO

```json
{
  "data": {
    "name": "SEO",
    "organiser": "SRF/SRMOE",
    "subject": "English",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 150,
    "fee_currency": "INR",
    "fee_basis": "Per Olympiad; covers Levels 1 and 2",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "level_1": "2026-11-06",
      "level_2": "2026-12-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.srmoe.com/",
    "source_urls": [
      "https://www.srmoe.com/",
      "https://www.srmoe.com/exam.php"
    ]
  },
  "review_notes": "Organiser lists Classes 3–12 generally; per-paper eligibility left empty. Registration date left empty due to current banner 29 September versus generic 31 August text. Government-school free quotas conflict. "
}
```

### 40. SCO

```json
{
  "data": {
    "name": "SCO",
    "organiser": "SRF/SRMOE",
    "subject": "Cyber/computing",
    "edition_label": null,
    "eligibility_text": null,
    "board_eligibility": null,
    "age_eligibility": null,
    "geographic_eligibility": null,
    "participation_route": null,
    "team_rules": null,
    "fee_amount": 150,
    "fee_currency": "INR",
    "fee_basis": "Per Olympiad; covers Levels 1 and 2",
    "fee_tax_note": null,
    "registration_opens_on": null,
    "registration_closes_on": null,
    "registration_status_as_reported": null,
    "schedule": {
      "level_1": null,
      "level_2": "2026-12-06"
    },
    "venue": null,
    "registration_url": null,
    "official_url": "https://www.srmoe.com/",
    "source_urls": [
      "https://www.srmoe.com/",
      "https://www.srmoe.com/exam.php"
    ]
  },
  "review_notes": "Organiser lists Classes 3–12 generally; per-paper eligibility left empty. Registration date left empty due to current banner 29 September versus generic 31 August text. Government-school free quotas conflict. SCO Level 1 conflicts between 6 and 7 November 2026."
}
```

### 41. Mathematics Olympiad

```json
{
  "data": {
    "name": "Mathematics Olympiad",
    "organiser": "SilverZone",
    "subject": "Mathematics",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 12 are eligible for Level 1. Level 2 is for the top 1000 students who rank between 4th and 1003rd in Level 1, in classes 3 to 12, with at least 50% marks, and for class 1st rank holders in classes 3 to 12 with at least 75% marks and 100 participation from the school in this subject. Level 3 is for international Olympiad 1st rank holders of classes 6 to 12 from Level 2, and is held in New Delhi.",
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
    "official_url": "https://www.silverzone.org/Mathematics-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Mathematics-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 42. Science Olympiad

```json
{
  "data": {
    "name": "Science Olympiad",
    "organiser": "SilverZone",
    "subject": "Science",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 12 are eligible for Level 1. Level 2 is for the top 1000 students who rank between 4th and 1003rd in Level 1, in classes 3 to 12, with at least 50% marks, and for class 1st rank holders in classes 3 to 12 with at least 75% marks and 100 participation from the school in this subject. Level 3 is for international Olympiad 1st rank holders of classes 6 to 12 from Level 2, and is held in New Delhi.",
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
    "official_url": "https://www.silverzone.org/Science-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Science-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 43. English Language Olympiad

```json
{
  "data": {
    "name": "English Language Olympiad",
    "organiser": "SilverZone",
    "subject": "English",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 12 are eligible for Level 1. Level 2 is for the top 1000 students who rank between 4th and 1003rd in Level 1, in classes 3 to 12, with at least 50% marks, and for class 1st rank holders in classes 3 to 12 with at least 75% marks and 100 participation from the school in this subject. Level 3 is for international Olympiad 1st rank holders of classes 6 to 12 from Level 2, and is held in New Delhi.",
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
    "official_url": "https://www.silverzone.org/English-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/English-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 44. Computer Science Olympiad

```json
{
  "data": {
    "name": "Computer Science Olympiad",
    "organiser": "SilverZone",
    "subject": "Computer science",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 12 are eligible to take part in Level 1 only.",
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
    "official_url": "https://www.silverzone.org/Computer-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Computer-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 45. General Knowledge Olympiad

```json
{
  "data": {
    "name": "General Knowledge Olympiad",
    "organiser": "SilverZone",
    "subject": "General knowledge",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 10 are eligible to take part in Level 1 only.",
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
    "official_url": "https://www.silverzone.org/General-Knowledge-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/General-Knowledge-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 46. Akhil Bharatiya Hindi Olympiad

```json
{
  "data": {
    "name": "Akhil Bharatiya Hindi Olympiad",
    "organiser": "SilverZone",
    "subject": "Hindi",
    "edition_label": null,
    "eligibility_text": "Open to students of classes 1 to 10. The Hindi page says the competition is open from class 1 to class 10.",
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
    "official_url": "https://www.silverzone.org/Hindi-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Hindi-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 47. Social Studies Olympiad

```json
{
  "data": {
    "name": "Social Studies Olympiad",
    "organiser": "SilverZone",
    "subject": "Social studies",
    "edition_label": null,
    "eligibility_text": "The examination is conducted for classes 1 to 10.",
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
    "official_url": "https://www.silverzone.org/Social-Studies-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Social-Studies-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 48. Reasoning and Aptitude Olympiad

```json
{
  "data": {
    "name": "Reasoning and Aptitude Olympiad",
    "organiser": "SilverZone",
    "subject": "Reasoning and aptitude",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 12 are eligible to take part in Level 1 only.",
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
    "official_url": "https://www.silverzone.org/Reasoning-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Reasoning-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 49. STEM Innovation Olympiad

```json
{
  "data": {
    "name": "STEM Innovation Olympiad",
    "organiser": "SilverZone",
    "subject": "STEM",
    "edition_label": null,
    "eligibility_text": "All students of classes 1 to 10 are eligible to take part in Level 1 only.",
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
    "official_url": "https://www.silverzone.org/Stem-Olympiad",
    "source_urls": [
      "https://www.silverzone.org/Stem-Olympiad"
    ]
  },
  "review_notes": "Programme catalogue entry only. Exact edition, classes, price, dates and route left empty; family-wide registration announcement is not sufficient for per-exam values. Class range taken from the subject page. Dates and fees are still empty because that page does not state them."
}
```

### 50. Aryabhata Ganit Challenge

```json
{
  "data": {
    "name": "Aryabhata Ganit Challenge",
    "organiser": "CBSE",
    "subject": "Mathematics",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 51. Science Challenge

```json
{
  "data": {
    "name": "Science Challenge",
    "organiser": "CBSE",
    "subject": "Science",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 52. Reading Challenge

```json
{
  "data": {
    "name": "Reading Challenge",
    "organiser": "CBSE",
    "subject": "Reading",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 53. Heritage India Quiz

```json
{
  "data": {
    "name": "Heritage India Quiz",
    "organiser": "CBSE",
    "subject": "Heritage",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 54. Budding Authors

```json
{
  "data": {
    "name": "Budding Authors",
    "organiser": "CBSE",
    "subject": "Writing",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 55. Expression Series

```json
{
  "data": {
    "name": "Expression Series",
    "organiser": "CBSE",
    "subject": "Creative expression",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 56. Storytelling Competition

```json
{
  "data": {
    "name": "Storytelling Competition",
    "organiser": "CBSE",
    "subject": "Storytelling",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 57. Science Exhibition

```json
{
  "data": {
    "name": "Science Exhibition",
    "organiser": "CBSE",
    "subject": "Science projects",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 58. Skill Expo

```json
{
  "data": {
    "name": "Skill Expo",
    "organiser": "CBSE",
    "subject": "Skills",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 59. Sports competitions

```json
{
  "data": {
    "name": "Sports competitions",
    "organiser": "CBSE",
    "subject": null,
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 60. Young India Culinary Championship

```json
{
  "data": {
    "name": "Young India Culinary Championship",
    "organiser": "CBSE",
    "subject": "Culinary skills",
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
    "official_url": "https://cbseacademic.nic.in/circulars.html",
    "source_urls": [
      "https://cbseacademic.nic.in/circulars.html"
    ]
  },
  "review_notes": "Programme/discovery entry only. No current-cycle eligibility or dates populated. Sports is an umbrella record: split into named sports and editions before event import."
}
```

### 61. NMMS — Telangana

```json
{
  "data": {
    "name": "NMMS — Telangana",
    "organiser": null,
    "subject": "Scholarship examination",
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
    "official_url": "https://bse.telangana.gov.in/NMMS.aspx",
    "source_urls": [
      "https://bse.telangana.gov.in/NMMS.aspx"
    ]
  },
  "review_notes": "Detailed current eligibility, school type, income limits, fee and dates were not retrieved; all remain empty."
}
```

### 62. World Robot Olympiad India

```json
{
  "data": {
    "name": "World Robot Olympiad India",
    "organiser": null,
    "subject": "Robotics",
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
    "official_url": "https://wroindia.org/season-2026/",
    "source_urls": [
      "https://wroindia.org/season-2026/"
    ]
  },
  "review_notes": "Category-level records required before import as individual competitions; age, fees and dates vary by category."
}
```

### 63. INTACH Heritage Quiz

```json
{
  "data": {
    "name": "INTACH Heritage Quiz",
    "organiser": null,
    "subject": "Heritage",
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
    "official_url": null,
    "source_urls": null
  },
  "review_notes": "Previously identified programme; current official source and cycle details not captured. Discovery-only entry."
}
```

## 5. Import and review instructions for Cursor

1. Read the actual schema and map this document's keys to existing/proposed fields from the implementation specification. Do not execute these records as SQL.
2. Resolve organisers and programme identities before creating editions. Reuse existing records after checking identity; acronyms alone are insufficient. SOF IMO, SRMO and IOQM are different programmes.
3. Keep records with missing current-edition data as programme drafts. Umbrella entries such as CBSE sports and WRO India need category/event decomposition before creating dated opportunities.
4. Convert JSON null to database NULL. If the destination column is required and the source value is missing, hold that row for completion; do not manufacture a default.
5. Preserve original eligibility labels. Do not populate board, age, geography, gender, disability access, language, team-size or venue filters from assumptions.
6. Split alternate event dates into linked schedule rows where supported. Do not create a start/end range spanning unrelated date options.
7. Keep route-dependent prices separate. Optional materials, taxes, fee waivers and school collections must not silently change the participation fee.
8. Carry source URLs and review notes into provenance/review storage. Do not treat a catalogue homepage as evidence for every empty field.
9. Recheck time-sensitive registration, fees and dates before publication. Source conflicts remain NULL until resolved.
10. Let the database generate IDs and audit timestamps. No database write is authorised by this document itself.

## 6. Remaining gaps

Exact school-level internal deadlines, many curriculum/age restrictions, category-specific fees, local/district events, application URLs and some current-cycle circulars remain unavailable in the collected evidence. Contact details, prizes, syllabus URLs, durations, result dates, exact venues and refund terms were not systematically gathered and must not be generated during import.

The document deliberately retains sparse records for the previously identified programmes instead of filling them with typical or previous-year values.

