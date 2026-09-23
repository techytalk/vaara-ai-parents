-- IB MYP Grade 9 · Subjects and learning
-- Replace the theory paragraph with categories and short Q&A.
-- Safe to re-run.

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
    sort_order, state_codes, pathway_item_slug, status, allow_ask, allow_discussions
  ) VALUES (
    p_slug, parent, p_kind, p_title, p_kicker, p_summary, p_lead, p_prompt,
    p_sort, COALESCE(p_states, '{}'), p_pathway, 'published', true, true
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
    allow_ask = true,
    allow_discussions = true,
    updated_at = now();
END;
$$;

UPDATE path_nodes
SET title = 'Subjects and learning',
    summary = 'What this year includes, and the questions to ask the school.',
    lead = NULL,
    ask_prompt_default = 'MYP Grade 9 parents: which subjects did the school actually require this year?',
    updated_at = now()
WHERE slug = 'ib-myp-g9-now-subjects';

SELECT path_put_node(
  'ib-myp-g9-subj-list', 'ib-myp-g9-now-subjects', 'topic',
  'What the school teaches now', NULL,
  'The timetable is the list, not the full IB menu.',
  'Which Grade 9 subjects did your school actually put on the timetable?',
  10, '{}', NULL,
  'The IB names eight subject groups. Your school chooses the courses and the names on the Grade 9 timetable. Ask for this year''s list. A group in the IB guide is not automatically taught here.'
);

SELECT path_put_node(
  'ib-myp-g9-subj-flex', 'ib-myp-g9-now-subjects', 'topic',
  'What can still change', NULL,
  'Ask which subjects are locked before Grade 10.',
  'Which MYP subjects could still be changed before Grade 10?',
  20, '{}', NULL,
  'Some choices can still move before the final MYP year. The school decides which ones. Ask what is locked this year, and what can change before Grade 10. Opening this row does not change a subject.'
);

SELECT path_put_node(
  'ib-myp-g9-subj-grades', 'ib-myp-g9-now-subjects', 'section',
  'How this year is graded', NULL,
  '8 on a task. 7 for the subject.',
  'How does your school show an 8 and a 7 on the same Grade 9 report?',
  30, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-faq-eight', 'ib-myp-g9-subj-grades', 'topic',
  'Why does the report show 8?', NULL,
  '8 is the top mark on one criterion.',
  'How does your school show a criterion mark of 8?',
  10, '{}', NULL,
  'Each criterion on a piece of work is marked from 1 to 8. 8 is the top of that criterion. If the work meets no descriptor, the teacher can record 0. An 8 on the report is that criterion mark.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-seven', 'ib-myp-g9-subj-grades', 'topic',
  'What does a 7 mean?', NULL,
  '7 is the top subject grade.',
  'How did your school explain a 7 to parents?',
  20, '{}', NULL,
  '7 is the top grade for the subject. The school adds the criterion marks and converts the total to a grade from 1 to 7. That 1 to 7 grade is the subject grade, including on the MYP certificate later.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-higher', 'ib-myp-g9-subj-grades', 'topic',
  'Is 8 higher than 7?', NULL,
  'No. They are different scales.',
  'How did you explain an 8 and a 7 on the same report?',
  30, '{}', NULL,
  'No. 8 is the best mark on one criterion. 7 is the best grade for the whole subject. An 8 does not sit above a 7.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-percent', 'ib-myp-g9-subj-grades', 'topic',
  'Is a 7 the same as 70%?', NULL,
  'No. It is not a percentage.',
  'How does your school stop parents reading a 7 as a percentage?',
  40, '{}', NULL,
  'No. A 7 is not 70%, and it is not a CBSE mark. It is the top of the IB 1 to 7 subject grade.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-convert', 'ib-myp-g9-subj-grades', 'topic',
  'How does 8 become a 7?', NULL,
  'Criterion marks are added, then converted.',
  'How does your school turn criterion marks into the 1 to 7 grade?',
  50, '{}', NULL,
  'A subject usually has four criteria, each marked up to 8. The school adds those marks and converts the total into the subject grade from 1 to 7.'
);

SELECT path_put_node(
  'ib-myp-g9-subj-groups', 'ib-myp-g9-now-subjects', 'section',
  'The subject groups', NULL,
  'Eight groups. Open one for what to ask.',
  NULL,
  40, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-grp-langlit', 'ib-myp-g9-subj-groups', 'topic',
  'Language and literature', NULL,
  'The main language course.',
  'Which language is your child''s language and literature course?',
  10, '{}', NULL,
  'This is the main language course: reading, writing, and speaking in the school''s language of instruction. Ask which language that is this year.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-langacq', 'ib-myp-g9-subj-groups', 'topic',
  'Additional language', NULL,
  'The other language on the timetable.',
  'Which additional language does Grade 9 offer, and can it be changed?',
  20, '{}', NULL,
  'This is the extra language, not the main one. The school chooses which languages it teaches. Ask whether a change is still possible before Grade 10.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-soc', 'ib-myp-g9-subj-groups', 'topic',
  'Individuals and societies', NULL,
  'History, geography, or whatever the school named it.',
  'What does your school call individuals and societies in Grade 9?',
  30, '{}', NULL,
  'Schools name this differently: history, geography, integrated humanities, or another title. Ask what is actually on the Grade 9 timetable.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-sci', 'ib-myp-g9-subj-groups', 'topic',
  'Sciences', NULL,
  'Whichever science is on this year''s list.',
  'Is Grade 9 science one combined course or separate sciences?',
  40, '{}', NULL,
  'Ask whether Grade 9 is one combined science or separate biology, chemistry, or physics. This is not Diploma science, and it is not a medicine or engineering choice.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-math', 'ib-myp-g9-subj-groups', 'topic',
  'Mathematics', NULL,
  'This year''s maths. Not Diploma AA or AI.',
  'How is MYP Grade 9 maths different from what comes in the Diploma?',
  50, '{}', NULL,
  'This is the school''s MYP mathematics course for Grade 9. Analysis and approaches, and applications and interpretation, are Diploma courses after Grade 10. They are not choices on this screen.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-arts', 'ib-myp-g9-subj-groups', 'topic',
  'Arts', NULL,
  'Only if the school is teaching an arts subject now.',
  'Is an arts subject required in Grade 9 at your school?',
  60, '{}', NULL,
  'Ask whether arts is a separate Grade 9 course, and which art it is. If it is not on the timetable, the school is not teaching it this year.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-phe', 'ib-myp-g9-subj-groups', 'topic',
  'Physical and health education', NULL,
  'PHE is its own group when the school offers it.',
  'How is physical and health education graded in Grade 9?',
  70, '{}', NULL,
  'When the school offers it, this is a taught subject with MYP grades, not only a games period. Ask how it is reported.'
);

SELECT path_put_node(
  'ib-myp-g9-grp-design', 'ib-myp-g9-subj-groups', 'topic',
  'Design', NULL,
  'A separate group. The school may use another name.',
  'Does your school teach Design as its own Grade 9 subject?',
  80, '{}', NULL,
  'Design is its own MYP group. Schools sometimes file it under another name. Ask whether Grade 9 has a design course, and what the report card calls it.'
);

SELECT path_put_node(
  'ib-myp-g9-subj-faq', 'ib-myp-g9-now-subjects', 'section',
  'Common questions', NULL,
  'Short answers. Open a question.',
  NULL,
  50, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-faq-exam', 'ib-myp-g9-subj-faq', 'topic',
  'Is Grade 9 an exam year?', NULL,
  NULL,
  'Did your school treat Grade 9 as an exam year, or only Grade 10?',
  10, '{}', NULL,
  'No. Grade 10 is the final MYP year. Grade 9 is assessed by the school. There is no MYP board exam in Grade 9.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-same', 'ib-myp-g9-subj-faq', 'topic',
  'Do all IB schools teach the same subjects?', NULL,
  NULL,
  'How different was your school''s Grade 9 list from the IB groups?',
  20, '{}', NULL,
  'No. The IB names the groups. The school chooses the courses. Two MYP Grade 9 classes can have different timetables.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-drop', 'ib-myp-g9-subj-faq', 'topic',
  'Can my child drop a subject this year?', NULL,
  NULL,
  'Which Grade 9 subjects did your school say were required?',
  40, '{}', NULL,
  'Ask the school which groups are required this year. The school sets that rule. This screen cannot remove a subject.'
);

SELECT path_put_node(
  'ib-myp-g9-faq-meeting', 'ib-myp-g9-subj-faq', 'topic',
  'What should I ask at the next meeting?', NULL,
  NULL,
  'What did you wish you had asked the school in MYP Grade 9?',
  50, '{}', NULL,
  'Ask four things: which subjects are fixed, which can change before Grade 10, how marks out of 8 become the 1 to 7 grade, and whether Design, Arts, or PHE are separate courses here.'
);

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
