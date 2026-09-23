-- IB MYP Grade 9 · Next year (Grade 10)
-- Replace the three theory cards with short questions.
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
SET summary = 'The final MYP year. Still Class 10, not Class 12.',
    lead = NULL,
    updated_at = now()
WHERE slug = 'ib-myp-g9-next';

SELECT path_put_node(
  'ib-myp-g9-next-subjects', 'ib-myp-g9-next', 'section',
  'Subjects and learning', NULL,
  'The personal project, and what Grade 10 counts as.',
  'What did Grade 10 add that Grade 9 did not have?',
  5, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-next-pp-what', 'ib-myp-g9-next-subjects', 'topic',
  'What is the personal project?', NULL,
  'One interest, three parts, finished in the final year.',
  'How did your school explain the personal project to parents?',
  10, '{}', NULL,
  'In the final MYP year the student works on one area of personal interest. It has three parts: the process, a product or outcome, and a reflective report. A teacher supervises it. The IB moderates the report. It is not a Diploma extended essay, and it is not a Class 12 project.'
);

SELECT path_put_node(
  'ib-myp-g9-next-pp-when', 'ib-myp-g9-next-subjects', 'topic',
  'When is the personal project finished?', NULL,
  'In Grade 10. Some schools mention it earlier.',
  'When did your school start the personal project, and when was it due?',
  20, '{}', NULL,
  'It is completed in the final MYP year. On this path that year is Grade 10. Some schools introduce it during Grade 9. Ask this school when students start, and when the report is due. The school sets those dates.'
);

SELECT path_put_node(
  'ib-myp-g9-next-subj-same', 'ib-myp-g9-next-subjects', 'topic',
  'Are Grade 10 subjects the same as Grade 9?', NULL,
  'The groups continue. The school sets the list.',
  'Which subjects changed between MYP Grade 9 and Grade 10 at your school?',
  30, '{}', NULL,
  'The same subject groups continue. The school decides which courses stay on the Grade 10 timetable, and which can still change. Ask for that list. A group in the IB guide is not automatically taught.'
);

SELECT path_put_node(
  'ib-myp-g9-next-class10', 'ib-myp-g9-next-subjects', 'topic',
  'Is Grade 10 the same as Class 10?', NULL,
  'In India, the end of MYP is Grade 10, not Class 12.',
  'How did you explain that MYP Grade 10 is Class 10, not Class 12?',
  40, '{}', NULL,
  'For recognition in India, the Association of Indian Universities equates the end of the MYP with Grade 10, not with Class 12. It is not the same exam as a CBSE Class 10 board paper. It is the same stage: the end of secondary school.'
);

SELECT path_put_node(
  'ib-myp-g9-next-not-plus2', 'ib-myp-g9-next-subjects', 'topic',
  'Does Grade 10 qualify for university or JEE?', NULL,
  'No. Those need a Class 12 equivalent, after this year.',
  'How did your family explain that MYP is not the Class 12 qualifying exam?',
  50, '{}', NULL,
  'No. University entry and exams such as JEE Main and NEET ask for a Class 12 equivalent. The MYP is not that. The Class 12 stage comes after Grade 10, for example the IB Diploma or another Classes 11–12 route. Opening this row does not choose that route.'
);

SELECT path_put_node(
  'ib-myp-g9-next-workload', 'ib-myp-g9-next', 'section',
  'Workload and transition', NULL,
  'The project, and exams only if the school offers them.',
  'What made the final MYP year heavier than Grade 9?',
  6, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-next-heavier', 'ib-myp-g9-next-workload', 'topic',
  'Why can Grade 10 feel heavier?', NULL,
  'The personal project sits on top of subject work.',
  'What surprised you about the workload in MYP Grade 10?',
  10, '{}', NULL,
  'Subject work continues, and the personal project runs across the year. School tests and deadlines are often fuller than in Grade 9. The school sets that calendar. This screen does not set a homework plan.'
);

SELECT path_put_node(
  'ib-myp-g9-next-exam', 'ib-myp-g9-next-workload', 'topic',
  'Is there an IB exam in Grade 10?', NULL,
  'The project is moderated. Other exams are optional.',
  'Did your school register students for anything beyond the personal project?',
  20, '{}', NULL,
  'The personal project report is assessed at school and moderated by the IB. That is part of finishing the final MYP year. On-screen exams and coursework portfolios are separate. The school chooses whether to offer those.'
);

SELECT path_put_node(
  'ib-myp-g9-next-eassess', 'ib-myp-g9-next-workload', 'topic',
  'Does every school offer eAssessment?', NULL,
  'No. Ask whether this school registers students.',
  'Did your school offer MYP eAssessment in Grade 10?',
  30, '{}', NULL,
  'No. eAssessment is the optional set of IB exams and portfolios. It is only available if this school registers students for it. A Grade 10 report from the school is not the same thing. Ask whether this school offers it, and in which subjects.'
);

SELECT path_put_node(
  'ib-myp-g9-next-certificate', 'ib-myp-g9-next-workload', 'topic',
  'What is the MYP certificate?', NULL,
  'An optional IB award. Not the school report.',
  'How did your school explain the MYP certificate versus the school report?',
  40, '{}', NULL,
  'The IB MYP certificate is awarded only when the school registers the student for the full eAssessment. That is eight parts, each graded from 1 to 7: six subjects, an interdisciplinary assessment, and the personal project. The IB asks for at least 28 points out of 56, with at least 3 in each part, plus the school''s service requirement. A normal school report is not this certificate.'
);

SELECT path_put_node(
  'ib-myp-g9-next-dates', 'ib-myp-g9-next-workload', 'topic',
  'Who sets the Grade 10 dates?', NULL,
  'The school.',
  'Where did your school publish the Grade 10 dates?',
  50, '{}', NULL,
  'The school sets the personal-project deadlines and the assessment calendar. If the school offers eAssessment, it also sets how students are registered. Ask for those dates at the start of Grade 10.'
);

SELECT path_put_node(
  'ib-myp-g9-next-support', 'ib-myp-g9-next', 'section',
  'School support', NULL,
  'What continuing MYP requires, and what to confirm.',
  'What did you confirm with the school before MYP Grade 10?',
  7, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-next-continue', 'ib-myp-g9-next-support', 'topic',
  'What does continuing MYP require?', NULL,
  'Finish Grade 10 at the school: subjects and the project.',
  'What did your school require before confirming the final MYP year?',
  10, '{}', NULL,
  'Continuing means finishing the final MYP year, usually at the same school. That year includes the subject courses and the personal project. The school confirms the place. It does not enrol the child in the Diploma, and it does not change the curriculum on this profile.'
);

SELECT path_put_node(
  'ib-myp-g9-next-board', 'ib-myp-g9-next-support', 'topic',
  'Does staying change the board?', NULL,
  'No. MYP stays MYP.',
  'Did anyone in your family think staying on meant a new board?',
  20, '{}', NULL,
  'No. Staying keeps the child in IB MYP. It is not a move to CBSE, Cambridge, or a state board, and it is not the start of the IB Diploma. Those are later choices, after Grade 10.'
);

SELECT path_put_node(
  'ib-myp-g9-next-confirm', 'ib-myp-g9-next-support', 'topic',
  'What should we confirm before Grade 10?', NULL,
  'Four questions for the school.',
  'What do you wish you had asked the school before MYP Grade 10?',
  30, '{}', NULL,
  'Ask four things: that Grade 10 is this school''s final MYP year, when the personal project starts and is due, whether the school offers eAssessment, and which subjects are fixed for Grade 10.'
);

SELECT path_put_node(
  'ib-myp-g9-stay', 'ib-myp-g9-next-support', 'route',
  'Continue IB MYP', 'Continue IB',
  'Finish the final MYP year at this school.',
  'IB MYP parents: what helped in the final MYP year?',
  80, '{}', NULL,
  'Staying means the subjects plus the personal project, usually at the same school. The school confirms the place. It does not change the board and it does not enrol the child in the Diploma.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer', 'ib-myp-g9-next-support', 'section',
  'Considering a curriculum change?', NULL,
  'A move before Grade 10 ends. The new school decides.',
  'Parents who looked at leaving MYP before Grade 10: what did the school actually allow?',
  90, '{}', NULL,
  NULL
);

SELECT path_put_node(
  'ib-myp-g9-transfer-when', 'ib-myp-g9-transfer', 'topic',
  'Can we leave before Grade 10 ends?', NULL,
  'Some families do. It is a move between schools.',
  'Did your family look at leaving MYP before the final year was finished?',
  10, '{}', NULL,
  'Yes, some families look at leaving during Grade 9 or Grade 10. That is a move to another school, on that school''s timetable. It is not a switch inside this app. Opening this row does not change the child''s curriculum or grade.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-who', 'ib-myp-g9-transfer', 'topic',
  'Who decides if another school will take the child?', NULL,
  'The school that would receive the child.',
  'What did the new school actually ask for before offering a place?',
  20, '{}', NULL,
  'The receiving school decides. It chooses whether there is a place, which grade it will offer, and which subjects. The current school decides what records it will release, and when. This screen does not list schools or vacancies.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-grade', 'ib-myp-g9-transfer', 'topic',
  'Which class would the new school offer?', NULL,
  'Ask them. A mid-MYP move is not a jump to Class 11.',
  'Which grade did the new school actually offer when you left MYP early?',
  30, '{}', NULL,
  'The new school names the class. Leaving during MYP Grade 9 or 10 usually means joining that school''s matching class, not Classes 11–12. Ask which grade, and which subjects, before you assume anything is carried across.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-partial', 'ib-myp-g9-transfer', 'topic',
  'Does a year in the middle count as Class 10?', NULL,
  'No. Class 10 recognition is for finishing MYP.',
  'What record did the current school give you for the years already completed?',
  40, '{}', NULL,
  'No. In India, the end of the MYP is what is equated with Grade 10. A year in the middle is a school report for the time completed. It is not a Class 10 certificate, and it is not Class 12. Ask the current school what document it will issue if the child leaves early.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-project', 'ib-myp-g9-transfer', 'topic',
  'What happens to the personal project?', NULL,
  'It belongs to the final MYP year. Leaving early stops it.',
  'If you left before Grade 10, what happened to the personal project?',
  50, '{}', NULL,
  'The personal project is completed in the final MYP year, and the IB moderates that report. If the child leaves before that year is finished, the project is not completed as an IB project. Ask the current school what it will record for work already done.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-boards', 'ib-myp-g9-transfer', 'topic',
  'Which curricula do families ask about?', NULL,
  'The same stage on another board. The new school still decides.',
  'Which board did you actually compare when leaving MYP before Grade 10?',
  60, '{}', NULL,
  'For a move during the MYP years, families usually ask about the same stage on another curriculum: CBSE, Cambridge, ICSE, or a state board. None of those is automatic. The new school decides if it has a place.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-after', 'ib-myp-g9-transfer', 'topic',
  'Is this the same as the choices after Grade 10?', NULL,
  'No. Diploma and Classes 11–12 come after Grade 10.',
  'How did you keep a mid-MYP move separate from the after-Grade-10 choice?',
  70, '{}', NULL,
  'No. The IB Diploma, Cambridge A Level, and CBSE or ISC Classes 11–12 are choices after Grade 10. They sit under Explore ahead. This card is only about leaving while the child is still in the MYP years.'
);

SELECT path_put_node(
  'ib-myp-g9-transfer-ask', 'ib-myp-g9-transfer', 'topic',
  'What should we ask both schools?', NULL,
  'Grade, subjects, records, and timing.',
  'What questions were worth asking before a move out of MYP?',
  80, '{}', NULL,
  'Ask four things: which grade the new school will offer, which subjects it will place, what documents the current school will give, and whether the move would be before Grade 10 ends or only after it.'
);

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
