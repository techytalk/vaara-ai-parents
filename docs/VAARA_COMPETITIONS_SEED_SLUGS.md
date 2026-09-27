# Competitive Exams — seed slug map (launch batch)

Source: `docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md` (63 programmes).  
Rules: import as **draft** until editorially published. Never invent missing dates/fees. Map `null` to SQL NULL.

| # | Proposed slug | Title (short) | Organiser | Suggested kind | Suggested category codes |
|---:|---|---|---|---|---|
| 1 | sof-igko | IGKO | Science Olympiad Foundation | olympiad | general_knowledge |
| 2 | sof-ieo | IEO | Science Olympiad Foundation | olympiad | english |
| 3 | sof-iso | ISO | Science Olympiad Foundation | olympiad | science |
| 4 | sof-imo | IMO | Science Olympiad Foundation | olympiad | mathematics |
| 5 | sof-icso | ICSO | Science Olympiad Foundation | olympiad | computing |
| 6 | sof-isso | ISSO | Science Olympiad Foundation | olympiad | general_knowledge |
| 7 | sof-iho | IHO | Science Olympiad Foundation | olympiad | science |
| 8 | sof-ico | ICO | Science Olympiad Foundation | olympiad | computing |
| 9 | unified-nstse | NSTSE | Unified Council | exam | science,mathematics |
| 10 | unified-uimo | UIMO | Unified Council | olympiad | mathematics |
| 11 | unified-uieo | UIEO | Unified Council | olympiad | english |
| 12 | unified-uico | UICO | Unified Council | olympiad | computing |
| 13 | crest-ceo | CEO | CREST Olympiads | olympiad | english |
| 14 | crest-cmo | CMO | CREST Olympiads | olympiad | mathematics |
| 15 | crest-cso | CSO | CREST Olympiads | olympiad | science |
| 16 | crest-cro | CRO | CREST Olympiads | olympiad | reasoning |
| 17 | crest-cco | CCO | CREST Olympiads | olympiad | computing |
| 18 | crest-igwo | IGWO | CREST Olympiads | olympiad | general_knowledge |
| 19 | crest-spell-bee-winter | Spell Bee — Winter | CREST Olympiads | competition | english |
| 20 | crest-spell-bee-summer | Spell Bee — Summer | CREST Olympiads | competition | english |
| 21 | crest-cido | CIDO | CREST Olympiads | olympiad | arts |
| 22 | crest-cmmo | CMMO | CREST Olympiads | olympiad | mathematics |
| 23 | vvm | Vidyarthi Vigyan Manthan | null until confirmed | exam | science |
| 24 | bebras-india | Bebras India | null until confirmed | competition | computing |
| 25 | teri-green-olympiad | GREEN Olympiad | TERI | olympiad | environment |
| 26 | wwf-wild-wisdom | Wild Wisdom Global Challenge | WWF India | competition | environment |
| 27 | iris-national-fair | IRIS National Fair | null until confirmed | competition | science |
| 28 | inspire-manak | INSPIRE Awards–MANAK | null until confirmed | competition | science |
| 29 | bee-painting-energy | National Painting Competition on Energy Conservation | Bureau of Energy Efficiency | competition | arts |
| 30 | iapt-nsep | NSEP | null until confirmed | exam | science |
| 31 | iapt-nsec | NSEC | null until confirmed | exam | science |
| 32 | iapt-nseb | NSEB | null until confirmed | exam | science |
| 33 | iapt-nsea | NSEA | null until confirmed | exam | science |
| 34 | ioqm | IOQM | null until confirmed | exam | mathematics |
| 35 | iapt-nsejs | NSEJS | IAPT | exam | science |
| 36 | srmo | SRMO | SRF/SRMOE | olympiad | mathematics |
| 37 | cvrso | CVRSO | SRF/SRMOE | olympiad | science |
| 38 | ako | AKO | SRF/SRMOE | olympiad | general_knowledge |
| 39 | seo | SEO | SRF/SRMOE | olympiad | english |
| 40 | sco | SCO | SRF/SRMOE | olympiad | computing |
| 41 | silverzone-math | Mathematics Olympiad | SilverZone | olympiad | mathematics |
| 42 | silverzone-science | Science Olympiad | SilverZone | olympiad | science |
| 43 | silverzone-english | English Language Olympiad | SilverZone | olympiad | english |
| 44 | silverzone-cs | Computer Science Olympiad | SilverZone | olympiad | computing |
| 45 | silverzone-gk | General Knowledge Olympiad | SilverZone | olympiad | general_knowledge |
| 46 | silverzone-hindi | Akhil Bharatiya Hindi Olympiad | SilverZone | olympiad | language |
| 47 | silverzone-sst | Social Studies Olympiad | SilverZone | olympiad | general_knowledge |
| 48 | silverzone-reasoning | Reasoning and Aptitude Olympiad | SilverZone | olympiad | reasoning |
| 49 | silverzone-stem | STEM Innovation Olympiad | SilverZone | olympiad | science,computing |
| 50 | cbse-aryabhata-ganit | Aryabhata Ganit Challenge | CBSE | competition | mathematics |
| 51 | cbse-science-challenge | Science Challenge | CBSE | competition | science |
| 52 | cbse-reading-challenge | Reading Challenge | CBSE | competition | english |
| 53 | cbse-heritage-quiz | Heritage India Quiz | CBSE | competition | heritage |
| 54 | cbse-budding-authors | Budding Authors | CBSE | competition | english |
| 55 | cbse-expression-series | Expression Series | CBSE | competition | arts |
| 56 | cbse-storytelling | Storytelling Competition | CBSE | competition | arts |
| 57 | cbse-science-exhibition | Science Exhibition | CBSE | competition | science |
| 58 | cbse-skill-expo | Skill Expo | CBSE | competition | science |
| 59 | cbse-sports | Sports competitions | CBSE | competition | sports |
| 60 | cbse-culinary | Young India Culinary Championship | CBSE | competition | arts |
| 61 | nmms-telangana | NMMS — Telangana | null until confirmed | scholarship | general_knowledge |
| 62 | wro-india | World Robot Olympiad India | null until confirmed | competition | robotics |
| 63 | intach-heritage-quiz | INTACH Heritage Quiz | null until confirmed | competition | heritage |

## Import order (next coding step)

1. Apply migration `077_opportunities_catalogue`.
2. Insert `opportunities` rows as `publication_status = draft` using this slug map.
3. Create `opportunity_editions` only where `edition_label` exists in the staging JSON; else opportunity-only until an edition is verified.
4. Attach categories via `opportunity_category_links`.
5. Map fees/schedules/sources from staging JSON — leave NULL where staging is null.
6. Publish via admin only after verification.
