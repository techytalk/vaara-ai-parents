-- Stage panes for IB MYP Grade 9: This year + Next year topic cards.
-- Also renames the skill routes section to match the parent UI.
-- Safe to run once. Uses ON CONFLICT / existence checks.

BEGIN;

CREATE OR REPLACE FUNCTION path_put_node(
  p_slug text,
  p_parent_slug text,
  p_kind path_node_kind,
  p_title text,
  p_kicker text,
  p_summary text,
  p_prompt text,
  p_sort int,
  p_states text[] DEFAULT '{}',
  p_pathway text DEFAULT NULL,
  p_lead text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  parent uuid;
BEGIN
  IF p_parent_slug IS NULL THEN
    parent := NULL;
  ELSE
    SELECT id INTO parent FROM path_nodes WHERE slug = p_parent_slug;
    IF parent IS NULL THEN
      RAISE EXCEPTION 'missing parent %', p_parent_slug;
    END IF;
  END IF;
  INSERT INTO path_nodes (
    slug, parent_id, kind, title, kicker, summary, lead, ask_prompt_default,
    sort_order, state_codes, pathway_item_slug, status
  ) VALUES (
    p_slug, parent, p_kind, p_title, p_kicker, p_summary, p_lead, p_prompt,
    p_sort, COALESCE(p_states, '{}'), p_pathway, 'published'
  )
  ON CONFLICT (slug) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    kind = EXCLUDED.kind,
    title = EXCLUDED.title,
    kicker = EXCLUDED.kicker,
    summary = EXCLUDED.summary,
    lead = EXCLUDED.lead,
    ask_prompt_default = EXCLUDED.ask_prompt_default,
    sort_order = EXCLUDED.sort_order,
    state_codes = EXCLUDED.state_codes,
    pathway_item_slug = EXCLUDED.pathway_item_slug,
    status = 'published',
    updated_at = now();
END;
$$;

UPDATE path_nodes
SET title = 'IB MYP · Grade 9',
    summary = 'Your child is currently studying in IB MYP.',
    lead = 'Grade 9 is still the Middle Years Programme. Looking ahead on this screen does not change the child’s programme.',
    updated_at = now()
WHERE slug = 'ib-myp-g9';

SELECT path_put_node(
  'ib-myp-g9-now', 'ib-myp-g9', 'section',
  'This year in Grade 9', 'This year',
  'Your child is currently studying in IB MYP.',
  'MYP Grade 9 parents: what helped during this year?',
  5, '{}', NULL,
  'Grade 9 is still the Middle Years Programme. This pane is for the year your child is in now. Exploring a topic does not change the child’s board or grade.'
);

SELECT path_put_node(
  'ib-myp-g9-now-subjects', 'ib-myp-g9-now', 'lens',
  'Subjects and learning', NULL,
  'MYP subject groups and how schools organise them.',
  'What did your child’s school emphasise in MYP Grade 9 subjects?',
  10, '{}', NULL,
  'MYP is organised in subject groups such as language and literature, language acquisition, individuals and societies, sciences, mathematics, arts, physical and health education, and design. The school decides which courses it teaches in Grade 9. This is orientation, not a subject lock.'
);

SELECT path_put_node(
  'ib-myp-g9-now-workload', 'ib-myp-g9-now', 'lens',
  'Workload and transition', NULL,
  'Projects, assessment, and the step toward Grade 10.',
  'How did your family balance MYP Grade 9 workload with other activities?',
  20, '{}', NULL,
  'Grade 9 usually includes ongoing assessment, projects, and preparation for the final MYP year. Exact deadlines are school-specific. This screen does not set a homework plan.'
);

SELECT path_put_node(
  'ib-myp-g9-now-support', 'ib-myp-g9-now', 'lens',
  'School support', NULL,
  'What to ask the school about this year.',
  'What school support actually helped in MYP Grade 9?',
  30, '{}', NULL,
  'Useful school questions: subject teachers, the personal project timeline for later, language choices, and how the school reports MYP grades. Exploring here does not contact the school.'
);

-- Next year pane: topic cards about Grade 10 (keep stay/transfer under these topics)
UPDATE path_nodes
SET title = 'Next year · Grade 10',
    kicker = 'Next year',
    summary = 'Explore the next MYP year and the transition.',
    lead = 'Grade 10 is the final MYP year. AIU treats the end of MYP as Class 10, not Class 12. Exploring ahead does not enrol the child in a new programme.',
    sort_order = 10,
    updated_at = now()
WHERE slug = 'ib-myp-g9-next';

SELECT path_put_node(
  'ib-myp-g9-next-subjects', 'ib-myp-g9-next', 'lens',
  'Subjects and learning', NULL,
  'Final MYP year subjects and the personal project context.',
  'What changed in subjects when your child entered MYP Grade 10?',
  5, '{}', NULL,
  'The final MYP year continues the subject groups and usually includes the personal project. Subject availability is school-specific. Grade 10 MYP is still Class 10 stage, not a university-entry year.'
);

SELECT path_put_node(
  'ib-myp-g9-next-workload', 'ib-myp-g9-next', 'lens',
  'Workload and transition', NULL,
  'How families prepare for the last MYP year.',
  'What surprised you about workload in the final MYP year?',
  6, '{}', NULL,
  'Families often find Grade 10 denser because of the personal project and school assessment calendars. Dates are set by the school. This is not a counselling timetable.'
);

SELECT path_put_node(
  'ib-myp-g9-next-support', 'ib-myp-g9-next', 'lens',
  'School support', NULL,
  'Transfer rules, continuing MYP, and what to ask early.',
  'What did the school tell you before the final MYP year?',
  7, '{}', NULL,
  'Ask early whether the child continues MYP at the same school, what the personal project requires, and whether any mid-year transfer is allowed. Stay or transfer decisions are between the family and the school.'
);

-- Re-parent stay/transfer under school support for a cleaner next-year card list
UPDATE path_nodes
SET parent_id = (SELECT id FROM path_nodes WHERE slug = 'ib-myp-g9-next-support'),
    sort_order = 10,
    updated_at = now()
WHERE slug = 'ib-myp-g9-stay';

UPDATE path_nodes
SET parent_id = (SELECT id FROM path_nodes WHERE slug = 'ib-myp-g9-next-support'),
    sort_order = 20,
    updated_at = now()
WHERE slug = 'ib-myp-g9-transfer';

UPDATE path_nodes
SET title = 'Explore ahead · after Grade 10',
    kicker = 'Explore ahead',
    summary = 'Explore programmes and other education routes.',
    lead = 'These are routes after MYP Grade 10. Opening one does not enrol the child and does not change curriculum or grade.',
    sort_order = 20,
    updated_at = now()
WHERE slug = 'ib-myp-g9-ahead';

UPDATE path_nodes
SET title = 'Diploma & skill routes',
    summary = 'Explore different kinds of qualifications.',
    lead = 'These are education routes after Grade 10 that are not a two-year board programme such as the Diploma, A Level, or CBSE 11–12.',
    updated_at = now()
WHERE slug IN ('ib-other-g9', 'ib-other-g10');

UPDATE path_nodes
SET title = 'Options after Grade 10',
    kicker = 'Explore ahead',
    summary = 'Explore programmes and other education routes.',
    lead = 'These are routes after MYP Grade 10. Opening one does not enrol the child and does not change curriculum or grade.',
    updated_at = now()
WHERE slug = 'ib-myp-g10';

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
