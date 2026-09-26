-- CBSE Classes 1–10 · what this year covers.
-- Subject areas follow NCF-SE 2023 and the CBSE Secondary Curriculum 2026-27.
-- Class 10 keeps the existing after-Class-10 routes.
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

-- Class 1
SELECT path_put_node(
  'cbse-g1', NULL, 'root', 'This year', NULL,
  'Class 1. Two languages, mathematics, and the world around the child.',
  'CBSE Class 1 parents: what did the school actually put on the timetable?',
  0, '{}', NULL,
  'Class 1 is the start of formal school. CBSE plans two languages, mathematics, and learning about the world around the child, plus art and physical activity. There is no board exam. The school chooses the language names and the books. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g1-covers', 'cbse-g1', 'section', 'What Class 1 covers', NULL,
  'Languages, mathematics, the world around the child, art, and movement.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g1-lang', 'cbse-g1-covers', 'topic', 'Two languages', NULL,
  'The school chooses which two. A third language is not this year.',
  'Which two languages does your CBSE school teach in Class 1?',
  10, '{}', NULL,
  'This year the plan is two languages. One is usually the language the child is strongest in. The other is a second language the school offers. A third language is not part of Class 1. Ask the school for the two names on this timetable.'
);
SELECT path_put_node(
  'cbse-g1-math', 'cbse-g1-covers', 'topic', 'Mathematics', NULL,
  'Numbers, shapes, and patterns, with objects the child can hold.',
  'How does your school teach Class 1 mathematics?',
  20, '{}', NULL,
  'Class 1 mathematics is about numbers, shapes, patterns, and comparing amounts. Children work with objects, not only with written sums. The school follows the NCERT book it has prescribed for this year.'
);
SELECT path_put_node(
  'cbse-g1-world', 'cbse-g1-covers', 'topic', 'The world around the child', NULL,
  'Family, school, plants, and animals. Often woven into the day.',
  'Is the world around us a separate Class 1 period at your school?',
  30, '{}', NULL,
  'Children learn about themselves, family, school, food, plants, and animals. In Class 1 this is often part of the day, not a separate heavy subject. Some schools still print a name for it on the timetable. Ask what this school calls it.'
);
SELECT path_put_node(
  'cbse-g1-art', 'cbse-g1-covers', 'topic', 'Art and physical education', NULL,
  'Drawing, music, play, and movement are part of the year.',
  'How much of the Class 1 week is art and physical activity?',
  40, '{}', NULL,
  'Art and physical education are part of the Class 1 plan, not extras after the real subjects. They include drawing, music or movement, and play. The school sets how many periods they get.'
);
SELECT path_put_node(
  'cbse-g1-check', 'cbse-g1', 'section', 'How this year is checked', NULL,
  'The school watches learning. There is no CBSE board exam.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g1-board', 'cbse-g1-check', 'topic', 'No board exam', NULL,
  'Class 1 marks, if any, come from the school.',
  'Does your school give Class 1 written tests, or only observe the child?',
  10, '{}', NULL,
  'CBSE does not hold a board exam in Class 1. The school may use classwork, observation, or a short test. Those records stay with the school. They are not a board result.'
);

-- Class 2
SELECT path_put_node(
  'cbse-g2', NULL, 'root', 'This year', NULL,
  'Class 2. Reading, writing, and number work take a step up.',
  'CBSE Class 2 parents: what changed from Class 1 on the timetable?',
  0, '{}', NULL,
  'Class 2 keeps the same map as Class 1: two languages, mathematics, the world around the child, art, and physical education. Reading, writing, and number work get longer. There is still no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g2-covers', 'cbse-g2', 'section', 'What Class 2 covers', NULL,
  'The Class 1 areas, with more reading and number work.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g2-lang', 'cbse-g2-covers', 'topic', 'Two languages', NULL,
  'Same two-language plan. A third language starts later.',
  'Which two languages continued into Class 2 at your school?',
  10, '{}', NULL,
  'Class 2 still plans two languages, not three. Children read and write more than in Class 1. The school chooses which two languages, and which book. A third language is a later class.'
);
SELECT path_put_node(
  'cbse-g2-math', 'cbse-g2-covers', 'topic', 'Mathematics', NULL,
  'Larger numbers, simple operations, shapes, and measurement.',
  'What number work did Class 2 add at your school?',
  20, '{}', NULL,
  'Class 2 mathematics moves to larger numbers, adding and taking away, simple measurement, and shapes. Work is still concrete. The school uses the NCERT mathematics book prescribed for this class.'
);
SELECT path_put_node(
  'cbse-g2-world', 'cbse-g2-covers', 'topic', 'The world around the child', NULL,
  'Neighbourhood, plants, animals, and how people help.',
  'What does your school call the Class 2 world-around-us lessons?',
  30, '{}', NULL,
  'Children look further than the classroom: the neighbourhood, plants, animals, food, and people who help. Many schools still fold this into the day. Ask whether this school gives it its own period.'
);
SELECT path_put_node(
  'cbse-g2-art', 'cbse-g2-covers', 'topic', 'Art and physical education', NULL,
  'Art and movement stay on the plan.',
  'Did art or physical education change between Class 1 and Class 2?',
  40, '{}', NULL,
  'Art and physical education continue. They are part of the year, not a reward after written work. The school decides the activities and the number of periods.'
);
SELECT path_put_node(
  'cbse-g2-check', 'cbse-g2', 'section', 'How this year is checked', NULL,
  'School checks only. No CBSE board exam.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g2-board', 'cbse-g2-check', 'topic', 'No board exam', NULL,
  'Any marks are the school''s, not a board result.',
  'How does your school report Class 2 progress to parents?',
  10, '{}', NULL,
  'There is no CBSE board exam in Class 2. The school reports progress in its own way. That report is not a board marksheet.'
);

-- Class 3
SELECT path_put_node(
  'cbse-g3', NULL, 'root', 'This year', NULL,
  'Class 3. The world around us becomes its own area.',
  'CBSE Class 3 parents: which subjects are on the timetable this year?',
  0, '{}', NULL,
  'Class 3 is the start of the preparatory years. The plan is two languages, mathematics, the world around us, art, and physical education. Computational thinking is folded into existing lessons. There is no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g3-covers', 'cbse-g3', 'section', 'What Class 3 covers', NULL,
  'Two languages, mathematics, the world around us, art, and movement.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g3-lang', 'cbse-g3-covers', 'topic', 'Two languages', NULL,
  'Still two languages. The school names them.',
  'Which two languages does your school teach in Class 3?',
  10, '{}', NULL,
  'Class 3 keeps two languages. Reading and writing get more space than in Class 2. The school chooses the languages and the books. A third language is not the Class 3 plan.'
);
SELECT path_put_node(
  'cbse-g3-math', 'cbse-g3-covers', 'topic', 'Mathematics', NULL,
  'Number work, shapes, and the start of more written sums.',
  'How much of Class 3 mathematics is still with objects, and how much is written?',
  20, '{}', NULL,
  'Class 3 mathematics continues number sense, operations, shapes, and measurement, with more written work than Class 2. The school follows the NCERT book for this class.'
);
SELECT path_put_node(
  'cbse-g3-world', 'cbse-g3-covers', 'topic', 'The world around us', NULL,
  'Its own area now. Many schools still say EVS.',
  'Does your school call this EVS or The World Around Us in Class 3?',
  30, '{}', NULL,
  'From Class 3, the world around the child is its own area: places, plants, animals, food, water, and how people live. Older timetables call this EVS. The ideas are the same. Science and Social Science as separate subjects come later, from Class 6.'
);
SELECT path_put_node(
  'cbse-g3-ct', 'cbse-g3-covers', 'topic', 'Computational thinking', NULL,
  'Inside other lessons. Not a new subject and not a new period.',
  'How did your school add computational thinking in Class 3 without a new period?',
  40, '{}', NULL,
  'From 2026-27, CBSE asks schools to build computational thinking into Classes 3 to 5. It sits inside subjects the child already has: patterns, steps, and sorting. It is not a separate subject, not an extra period, and not a board exam.'
);
SELECT path_put_node(
  'cbse-g3-art', 'cbse-g3-covers', 'topic', 'Art and physical education', NULL,
  'Art and movement stay on the plan.',
  'Are art and physical education graded in Class 3 at your school?',
  50, '{}', NULL,
  'Art education and physical education continue as part of the year. The school decides the activities. They are not board subjects.'
);
SELECT path_put_node(
  'cbse-g3-check', 'cbse-g3', 'section', 'How this year is checked', NULL,
  'The school assesses. CBSE does not.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g3-board', 'cbse-g3-check', 'topic', 'No board exam', NULL,
  'Class 3 results, if the school issues them, are not a board result.',
  'What does your school send home as the Class 3 report?',
  10, '{}', NULL,
  'There is no CBSE board exam in Class 3. Tests and projects, if any, are the school''s. They do not become a board marksheet.'
);

-- Class 4
SELECT path_put_node(
  'cbse-g4', NULL, 'root', 'This year', NULL,
  'Class 4. Longer reading, and a wider look at places and living things.',
  'CBSE Class 4 parents: what did the school add this year?',
  0, '{}', NULL,
  'Class 4 uses the same areas as Class 3: two languages, mathematics, the world around us, art, and physical education. Computational thinking stays inside those lessons. There is no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g4-covers', 'cbse-g4', 'section', 'What Class 4 covers', NULL,
  'Same areas as Class 3, with more reading and written mathematics.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g4-lang', 'cbse-g4-covers', 'topic', 'Two languages', NULL,
  'Reading gets longer. Still two languages.',
  'Which books is your school using for the two Class 4 languages?',
  10, '{}', NULL,
  'Class 4 still plans two languages. Children read longer pieces and write more. The school chooses the languages. A third language is not required in Class 4.'
);
SELECT path_put_node(
  'cbse-g4-math', 'cbse-g4-covers', 'topic', 'Mathematics', NULL,
  'Larger operations, fractions begin to appear, and measurement.',
  'Which mathematics topics did Class 4 add at your school?',
  20, '{}', NULL,
  'Class 4 mathematics extends operations, measurement, shapes, and the first work with fractions, as set in the NCERT book for this class. The school timetable is the list. Ask for that book, not a coaching syllabus.'
);
SELECT path_put_node(
  'cbse-g4-world', 'cbse-g4-covers', 'topic', 'The world around us', NULL,
  'Places, plants, animals, and how people live. Not yet separate Science.',
  'Is Class 4 still one world-around-us book, or has the school split Science?',
  30, '{}', NULL,
  'The world around us continues as one area. It looks further into places, living things, and community life. It is not yet split into Science and Social Science. That split starts in Class 6. Schools may still print EVS on the timetable.'
);
SELECT path_put_node(
  'cbse-g4-ct', 'cbse-g4-covers', 'topic', 'Computational thinking', NULL,
  'Still inside other lessons. No extra period.',
  'Where does computational thinking show up in your Class 4 week?',
  40, '{}', NULL,
  'Computational thinking in Class 4 stays inside existing subjects. CBSE has said it should not add a new period or depend on a particular device. It is not a board subject.'
);
SELECT path_put_node(
  'cbse-g4-art', 'cbse-g4-covers', 'topic', 'Art and physical education', NULL,
  'Art and movement remain part of the year.',
  'How does your school timetable art and physical education in Class 4?',
  50, '{}', NULL,
  'Art and physical education continue. They are part of the Class 4 plan. The school sets the periods. They are not board subjects.'
);
SELECT path_put_node(
  'cbse-g4-check', 'cbse-g4', 'section', 'How this year is checked', NULL,
  'School assessment only.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g4-board', 'cbse-g4-check', 'topic', 'No board exam', NULL,
  'No CBSE board paper in Class 4.',
  'Does your school hold Class 4 exams, and who sets them?',
  10, '{}', NULL,
  'CBSE does not examine Class 4. If the school holds a test, the school sets it and keeps the result. That result is not a board marksheet.'
);

-- Class 5
SELECT path_put_node(
  'cbse-g5', NULL, 'root', 'This year', NULL,
  'Class 5. Last year before Science and Social Science split apart.',
  'CBSE Class 5 parents: what is still one subject that will split next year?',
  0, '{}', NULL,
  'Class 5 is the last preparatory year. The plan is still two languages, mathematics, the world around us, art, and physical education. Science and Social Science become separate subjects in Class 6, not this year. There is no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g5-covers', 'cbse-g5', 'section', 'What Class 5 covers', NULL,
  'Two languages, mathematics, the world around us, art, and movement.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g5-lang', 'cbse-g5-covers', 'topic', 'Two languages', NULL,
  'Two languages this year. A third language is a Class 6 change.',
  'Will your school add a third language only in Class 6?',
  10, '{}', NULL,
  'Class 5 still plans two languages. From 2026-27, the third language becomes compulsory in Class 6, not in Class 5. Ask this school which two languages are on the Class 5 timetable, and whether it already offers a third as an extra.'
);
SELECT path_put_node(
  'cbse-g5-math', 'cbse-g5-covers', 'topic', 'Mathematics', NULL,
  'The last primary mathematics book before middle school.',
  'Which mathematics topics is your school finishing in Class 5?',
  20, '{}', NULL,
  'Class 5 mathematics consolidates number work, fractions, measurement, and shapes from the NCERT book for this class. It is still primary mathematics. The middle-school course starts in Class 6.'
);
SELECT path_put_node(
  'cbse-g5-world', 'cbse-g5-covers', 'topic', 'The world around us', NULL,
  'Still one area. Science and Social Science split in Class 6.',
  'How did your school explain the move from EVS to Science and Social Science?',
  30, '{}', NULL,
  'In Class 5, places, living things, and community life are still one area. Many schools call it EVS. From Class 6, CBSE separates Science and Social Science. This year is not that split yet.'
);
SELECT path_put_node(
  'cbse-g5-ct', 'cbse-g5-covers', 'topic', 'Computational thinking', NULL,
  'Inside other lessons, for the last primary year.',
  'Is computational thinking still inside other subjects in Class 5?',
  40, '{}', NULL,
  'In Classes 3 to 5, computational thinking stays inside existing lessons. Class 5 is the last of those years. From Class 6, CBSE adds a first look at AI, still inside existing periods, not as a board subject.'
);
SELECT path_put_node(
  'cbse-g5-art', 'cbse-g5-covers', 'topic', 'Art and physical education', NULL,
  'Art and movement stay on the plan.',
  'What art and physical education does your school keep in Class 5?',
  50, '{}', NULL,
  'Art and physical education remain part of Class 5. They are not board subjects. The school sets the activities.'
);
SELECT path_put_node(
  'cbse-g5-check', 'cbse-g5', 'section', 'How this year is checked', NULL,
  'The school checks Class 5. CBSE does not.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g5-board', 'cbse-g5-check', 'topic', 'No board exam', NULL,
  'Class 5 is not a board year.',
  'Does your school treat Class 5 as a big exam year anyway?',
  10, '{}', NULL,
  'There is no CBSE board exam in Class 5. Some schools hold their own tests before middle school. Those tests are not the CBSE board. The first CBSE board exam on this path is Class 10.'
);

-- Class 6
SELECT path_put_node(
  'cbse-g6', NULL, 'root', 'This year', NULL,
  'Class 6. Science and Social Science become separate subjects.',
  'CBSE Class 6 parents: which third language did the school choose?',
  0, '{}', NULL,
  'Class 6 starts the middle years. Mathematics, Science, and Social Science are separate subjects. A third language is compulsory this year. Art, physical education, and a first look at work sit alongside them. There is no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g6-covers', 'cbse-g6', 'section', 'What Class 6 covers', NULL,
  'Three languages, mathematics, science, social science, art, and movement.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g6-lang', 'cbse-g6-covers', 'topic', 'Three languages', NULL,
  'The third language is compulsory in Class 6 from 2026-27.',
  'Which language did your school offer as the third language in Class 6?',
  10, '{}', NULL,
  'From 2026-27, CBSE makes a third language compulsory in Class 6. The school chooses it and records the choice. At least two of the three languages are native to India. One language cannot be counted twice. Ask for the three names on this timetable.'
);
SELECT path_put_node(
  'cbse-g6-math', 'cbse-g6-covers', 'topic', 'Mathematics', NULL,
  'Middle-school mathematics starts. The NCERT book is the syllabus.',
  'Which Class 6 mathematics book is your school following?',
  20, '{}', NULL,
  'Class 6 mathematics is the start of the middle-school course. The syllabus is the NCERT book the school has been told to follow for this year, not a coaching list. Ask for that book''s name.'
);
SELECT path_put_node(
  'cbse-g6-sci', 'cbse-g6-covers', 'topic', 'Science', NULL,
  'Science is its own subject from this year.',
  'How did your school start Science as its own subject in Class 6?',
  30, '{}', NULL,
  'From Class 6, Science is a separate subject. It is no longer folded into the world-around-us book used in Classes 3 to 5. The school teaches the NCERT science book prescribed for Class 6. Topics for the year are the chapters in that book.'
);
SELECT path_put_node(
  'cbse-g6-sst', 'cbse-g6-covers', 'topic', 'Social Science', NULL,
  'History, geography, and civics begin as one school subject.',
  'Does your school teach Class 6 Social Science as one subject or three periods?',
  40, '{}', NULL,
  'Social Science also becomes its own subject in Class 6. It brings together history, geography, and civics. Some schools timetable them as one subject. Some split the periods. The content is still the Class 6 social science course, not a board syllabus.'
);
SELECT path_put_node(
  'cbse-g6-ct', 'cbse-g6-covers', 'topic', 'Computational thinking and AI', NULL,
  'Inside existing periods. Not a board subject.',
  'How is your school teaching the first AI lessons in Class 6?',
  50, '{}', NULL,
  'From 2026-27, Classes 6 to 8 add computational thinking and a first look at AI. CBSE has said this stays inside existing periods, through activities and projects. It does not need a new device, and it is not a board exam.'
);
SELECT path_put_node(
  'cbse-g6-other', 'cbse-g6-covers', 'topic', 'Art, movement, and work', NULL,
  'Art, physical education, and a first look at vocational work.',
  'What art, sport, and work lessons are on your Class 6 timetable?',
  60, '{}', NULL,
  'Art education, physical education, and an introduction to work are part of the middle-school plan. They are school subjects, not board subjects. The school chooses the activities.'
);
SELECT path_put_node(
  'cbse-g6-check', 'cbse-g6', 'section', 'How this year is checked', NULL,
  'School tests only. The board exam is Class 10.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g6-board', 'cbse-g6-check', 'topic', 'No board exam', NULL,
  'Class 6 marks are the school''s marks.',
  'How often does your school test Class 6, and do those marks leave the school?',
  10, '{}', NULL,
  'CBSE does not hold a board exam in Class 6. Periodic tests, if the school holds them, stay with the school. The first board exam on this path is at the end of Class 10.'
);

-- Class 7
SELECT path_put_node(
  'cbse-g7', NULL, 'root', 'This year', NULL,
  'Class 7. The middle-school subjects continue.',
  'CBSE Class 7 parents: which subjects grew harder this year?',
  0, '{}', NULL,
  'Class 7 continues the middle-school subjects: languages, mathematics, science, and social science, plus art, physical education, and work. There is no board exam. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g7-covers', 'cbse-g7', 'section', 'What Class 7 covers', NULL,
  'The Class 6 subjects, one year on.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g7-lang', 'cbse-g7-covers', 'topic', 'Languages', NULL,
  'Ask which languages are on this year''s timetable.',
  'Which languages is your school teaching in Class 7 this year?',
  10, '{}', NULL,
  'Languages stay on the Class 7 timetable. The new third-language textbook rule reaches Class 7 in 2027-28, not as a fresh start this session. Ask which languages this school is teaching now. At least two should be native to India where the school is in India.'
);
SELECT path_put_node(
  'cbse-g7-math', 'cbse-g7-covers', 'topic', 'Mathematics', NULL,
  'The Class 7 NCERT book is the plan.',
  'Which mathematics book is your Class 7 following?',
  20, '{}', NULL,
  'Class 7 mathematics follows the NCERT book prescribed for this class. That book is the syllabus. A tuition worksheet is not a second official syllabus.'
);
SELECT path_put_node(
  'cbse-g7-sci', 'cbse-g7-covers', 'topic', 'Science', NULL,
  'Science continues as its own subject.',
  'What did Class 7 Science add that Class 6 did not have?',
  30, '{}', NULL,
  'Science continues as a separate subject. The chapters are the ones in the Class 7 NCERT science book the school is using this year. Ask for that list from the school, because the book edition is the one CBSE has prescribed for the session.'
);
SELECT path_put_node(
  'cbse-g7-sst', 'cbse-g7-covers', 'topic', 'Social Science', NULL,
  'History, geography, and civics continue together.',
  'How does your school split Class 7 Social Science across the week?',
  40, '{}', NULL,
  'Social Science continues, still bringing history, geography, and civics together. The school may use one teacher or several. The course is the Class 7 social science book, not a Class 10 board syllabus.'
);
SELECT path_put_node(
  'cbse-g7-ct', 'cbse-g7-covers', 'topic', 'Computational thinking and AI', NULL,
  'Still inside existing lessons.',
  'Is AI still inside other subjects in Class 7, or a period of its own?',
  50, '{}', NULL,
  'Computational thinking and a first look at AI continue inside existing periods. CBSE has said not to add a separate instructional period for this in Classes 6 to 8. It is not a board subject.'
);
SELECT path_put_node(
  'cbse-g7-other', 'cbse-g7-covers', 'topic', 'Art, movement, and work', NULL,
  'Art, physical education, and vocational exposure continue.',
  'What work or skill lesson does your school offer in Class 7?',
  60, '{}', NULL,
  'Art, physical education, and an introduction to work remain part of the year. They are assessed by the school, if at all. They are not CBSE board subjects.'
);
SELECT path_put_node(
  'cbse-g7-check', 'cbse-g7', 'section', 'How this year is checked', NULL,
  'School assessment. No board exam.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g7-board', 'cbse-g7-check', 'topic', 'No board exam', NULL,
  'Class 7 results stay with the school.',
  'Do Class 7 marks at your school affect anything outside the school?',
  10, '{}', NULL,
  'There is no CBSE board exam in Class 7. Marks the school awards are school marks. They are not submitted as a board result.'
);

-- Class 8
SELECT path_put_node(
  'cbse-g8', NULL, 'root', 'This year', NULL,
  'Class 8. The last middle-school year before Class 9.',
  'CBSE Class 8 parents: which third language must be cleared by the end of this year?',
  0, '{}', NULL,
  'Class 8 is the last middle year. Languages, mathematics, science, and social science continue. Students are expected to have studied three languages by the end of Class 8. Class 9 is the next change, not a board exam yet. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g8-covers', 'cbse-g8', 'section', 'What Class 8 covers', NULL,
  'Middle-school subjects, in their last year.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g8-lang', 'cbse-g8-covers', 'topic', 'Three languages by the end of this year', NULL,
  'Ask which third language is on the timetable.',
  'Which third language does your school expect Class 8 students to clear?',
  10, '{}', NULL,
  'CBSE expects students to have studied three languages by the end of Class 8. The newer textbook rule for the third language reaches Class 8 in 2028-29. This year, ask which third language is already on the timetable, and what the school counts as a pass in it. A student who has not cleared it can be examined again by the school in Class 9, and if needed in Class 10, before the board exam.'
);
SELECT path_put_node(
  'cbse-g8-math', 'cbse-g8-covers', 'topic', 'Mathematics', NULL,
  'The last middle-school mathematics book.',
  'What does your school say Class 8 mathematics must finish before Class 9?',
  20, '{}', NULL,
  'Class 8 mathematics is the last middle-school course. The syllabus is the NCERT book for this class. Class 9 mathematics is a new course, with its own book. This year does not use the Class 9 book.'
);
SELECT path_put_node(
  'cbse-g8-sci', 'cbse-g8-covers', 'topic', 'Science', NULL,
  'Science continues. The Class 9 course is next year.',
  'Which Science chapters is your school finishing in Class 8?',
  30, '{}', NULL,
  'Science remains its own subject. The chapters are those in the Class 8 book the school is using. Class 9 Science is a different course, with units CBSE publishes for that class. Do not treat a Class 9 guide as this year''s syllabus.'
);
SELECT path_put_node(
  'cbse-g8-sst', 'cbse-g8-covers', 'topic', 'Social Science', NULL,
  'History, geography, and civics in the Class 8 book.',
  'How does your school teach Class 8 Social Science?',
  40, '{}', NULL,
  'Social Science continues as history, geography, and civics in the Class 8 course. It is school-assessed. It is not the Class 10 board syllabus.'
);
SELECT path_put_node(
  'cbse-g8-ct', 'cbse-g8-covers', 'topic', 'Computational thinking and AI', NULL,
  'Still inside other lessons in Class 8.',
  'Is AI a separate Class 8 subject at your school, or inside other periods?',
  50, '{}', NULL,
  'In Class 8, computational thinking and foundational AI stay inside existing periods. A separate CT and AI subject is a later session, from 2027-28 in Classes 9 and 10. It is not a Class 8 board subject.'
);
SELECT path_put_node(
  'cbse-g8-other', 'cbse-g8-covers', 'topic', 'Art, movement, and work', NULL,
  'These continue. They are not board subjects.',
  'What skill or work lesson does Class 8 include at your school?',
  60, '{}', NULL,
  'Art, physical education, and vocational exposure continue. The school assesses them if it assesses them at all. They do not appear as CBSE board papers.'
);
SELECT path_put_node(
  'cbse-g8-check', 'cbse-g8', 'section', 'How this year is checked', NULL,
  'School assessment. The board is still two years away.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g8-board', 'cbse-g8-check', 'topic', 'No board exam', NULL,
  'Class 8 is not the board year. Class 10 is.',
  'Does your school treat Class 8 as a board rehearsal?',
  10, '{}', NULL,
  'There is no CBSE board exam in Class 8. The board exam is at the end of Class 10. A school test in Class 8 is not that exam, and it does not choose the Class 11 stream.'
);

-- Class 9 (session 2026-27 scheme)
SELECT path_put_node(
  'cbse-g9', NULL, 'root', 'This year', NULL,
  'Class 9. The subjects chosen now are meant to continue in Class 10.',
  'CBSE Class 9 parents: which subjects did the school say will continue into Class 10?',
  0, '{}', NULL,
  'Class 9 and Class 10 are one course. CBSE asks schools to offer in Class 9 only the subjects the student will continue in Class 10. This year is school-assessed, including a school annual exam. It is not the board year. The board exam is at the end of Class 10. Opening this page does not change the child profile.'
);
SELECT path_put_node(
  'cbse-g9-covers', 'cbse-g9', 'section', 'What Class 9 covers', NULL,
  'Languages, mathematics, science, social science, and school subjects around them.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g9-lang', 'cbse-g9-covers', 'topic', 'Two main languages', NULL,
  'R1 and R2. The school chooses them. They must differ.',
  'Which languages did your school offer as the first and second language in Class 9?',
  10, '{}', NULL,
  'Class 9 has two main languages. CBSE calls them R1 and R2. R2 must be a different language from R1. In a school in India, at least two of the three languages overall are native to India. The same textbook may be used at both levels, but the assessment is not the same. Ask which two this school is teaching.'
);
SELECT path_put_node(
  'cbse-g9-r3', 'cbse-g9-covers', 'topic', 'Third language', NULL,
  'Compulsory this year. School-assessed. Not a board paper.',
  'Which third language is your school teaching in Class 9, and which book?',
  20, '{}', NULL,
  'From 2026-27 the third language is compulsory in Class 9. For this batch the book is the Class 6 level book, plus one local literary text. That is a transition year, not a mistake on the timetable. The school assesses it. There is no separate board exam in the third language. Passing it is required before CBSE issues the Class 10 certificate. Not passing it does not, by itself, block the admit card for the other board subjects.'
);
SELECT path_put_node(
  'cbse-g9-math', 'cbse-g9-covers', 'topic', 'Mathematics', NULL,
  'Everyone studies the standard course. Advanced is an optional extra.',
  'Is your school offering Mathematics Advanced in Class 9, and did you opt in?',
  30, '{}', NULL,
  'Every Class 9 student studies the standard mathematics course. Mathematics Advanced is optional extra topics, for students who want more. Everyone sits the standard paper. A student who opts for Advanced also sits an extra paper. Marks on that extra paper are not added to the total. From 2026-27, Mathematics Basic and Mathematics Standard are the Class 10 scheme for the batch already in Class 10. They are not the new Class 9 choice. Ask the school whether it is offering Advanced this year.'
);
SELECT path_put_node(
  'cbse-g9-sci', 'cbse-g9-covers', 'topic', 'Science', NULL,
  'Four areas this year. Advanced is an optional extra.',
  'Which of the four Class 9 Science areas is your school spending the most time on?',
  40, '{}', NULL,
  'The Class 9 science course for 2026-27 is in four areas: the living world; matter and how it behaves; motion, force, work, and sound; and Earth as a system. Everyone studies the standard course and sits that paper. Science Advanced is an optional extra paper on extra topics. Those extra marks are not added to the total. The school has to be offering Advanced before a student can opt for it.'
);
SELECT path_put_node(
  'cbse-g9-sst', 'cbse-g9-covers', 'topic', 'Social Science', NULL,
  'A main subject. It continues into Class 10.',
  'How has your school split Class 9 Social Science across history, geography, and civics?',
  50, '{}', NULL,
  'Social Science is one of the main Class 9 subjects and is meant to continue in Class 10. It covers the history, geography, and civics in the Class 9 book. The school annual exam includes it. The board paper is next year, not this year.'
);
SELECT path_put_node(
  'cbse-g9-society', 'cbse-g9-covers', 'topic', 'Individual in Society', NULL,
  'Part of the plan. The book comes when NCERT releases it.',
  'Has your school started Individual in Society, or is it waiting for the book?',
  60, '{}', NULL,
  'CBSE is adding Individual in Society in Class 9 from 2026-27, when the NCERT book is available. It is a school area, not a board paper this year. If the book is not in the school yet, the school cannot invent a parallel syllabus. Ask whether it has started.'
);
SELECT path_put_node(
  'cbse-g9-other', 'cbse-g9-covers', 'topic', 'Art, physical education, and work', NULL,
  'Compulsory at school. Not board papers.',
  'How does your school assess art, physical education, and vocational work in Class 9?',
  70, '{}', NULL,
  'Art education, physical education and well-being, and vocational education are part of Class 9. The school assesses them. They are not the board papers. An optional extra academic subject is possible only if this school offers it.'
);
SELECT path_put_node(
  'cbse-g9-check', 'cbse-g9', 'section', 'How this year is checked', NULL,
  'School internal assessment plus a school annual exam.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g9-exam', 'cbse-g9-check', 'topic', 'School exam, not the board', NULL,
  'Both the internal part and the annual exam count. CBSE does not set this paper.',
  'What share of the Class 9 mark is internal, and what share is the annual exam?',
  10, '{}', NULL,
  'Class 9 is checked by the school: internal assessment and a school annual exam. A student has to complete both. The main papers are three hours and 80 marks for the standard course. This is not the CBSE board exam. That exam is at the end of Class 10, on the Class 10 syllabus.'
);
SELECT path_put_node(
  'cbse-g9-ct', 'cbse-g9-check', 'topic', 'Computational thinking and AI', NULL,
  'Not a Class 9 subject yet. Planned from 2027-28.',
  'Has your school already started CT or AI in Class 9, ahead of 2027-28?',
  20, '{}', NULL,
  'CBSE will bring Computational Thinking and AI into Classes 9 to 12 as modules in 2027-28, and as a subject from that session. It is not a Class 9 board subject this year. If a school has started activities early, those are the school''s activities.'
);

-- Class 10: this year, then the existing after-Class-10 routes
UPDATE path_nodes SET
  title = 'This year',
  summary = 'Class 10 subjects for this batch, then the choices after the board exam.',
  lead = 'This Class 10 batch sits the board exam on the existing scheme. Five subjects are compulsory. Mathematics Basic is still available for this batch only. Routes after Class 10 are further down this page. Class 10 is not Class 12. Opening this page does not change the child profile.',
  ask_prompt_default = 'CBSE Class 10 parents: which board subjects is your child registered for?',
  updated_at = now()
WHERE slug = 'cbse-g10';

SELECT path_put_node(
  'cbse-g10-covers', 'cbse-g10', 'section', 'What Class 10 covers', NULL,
  'The board subjects for the batch sitting the exam this year.',
  NULL, 10, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g10-lang', 'cbse-g10-covers', 'topic', 'Two languages', NULL,
  'Both are compulsory board subjects.',
  'Which two languages is your child registered for in the Class 10 board exam?',
  10, '{}', NULL,
  'Language 1 and Language 2 are compulsory board subjects for this Class 10 batch. The school registers the names. They are two of the five compulsory board subjects.'
);
SELECT path_put_node(
  'cbse-g10-math', 'cbse-g10-covers', 'topic', 'Mathematics Standard or Basic', NULL,
  'This batch can still choose Basic. Later batches cannot.',
  'Did your child register for Mathematics Standard or Mathematics Basic?',
  20, '{}', NULL,
  'Students in Class 10 in 2026-27 stay on the existing mathematics scheme. Mathematics Standard is the usual paper if mathematics may continue after Class 10. Mathematics Basic covers the core course for students not taking mathematics next. From 2026-27, Basic and Standard are discontinued for new Class 9 students. Those students will see Standard plus an optional Advanced paper instead. This Class 10 batch is not on that new scheme. Ask the school which paper the child is registered for. This page does not change the registration.'
);
SELECT path_put_node(
  'cbse-g10-sci', 'cbse-g10-covers', 'topic', 'Science', NULL,
  'A compulsory board subject.',
  'How is your school splitting the Class 10 Science board syllabus across the year?',
  30, '{}', NULL,
  'Science is a compulsory Class 10 board subject for this batch. The syllabus is the Class 10 science curriculum CBSE published for this session. Internal assessment and the board paper both have to be completed.'
);
SELECT path_put_node(
  'cbse-g10-sst', 'cbse-g10-covers', 'topic', 'Social Science', NULL,
  'A compulsory board subject.',
  'How has your school divided Class 10 Social Science before the board exam?',
  40, '{}', NULL,
  'Social Science is a compulsory board subject. It is the Class 10 history, geography, civics, and economics course for this session. It is one of the five compulsory board subjects, together with two languages, mathematics, and science.'
);
SELECT path_put_node(
  'cbse-g10-extra', 'cbse-g10-covers', 'topic', 'Extra board subjects', NULL,
  'Up to two more subjects can be offered. Five are compulsory.',
  'Is your child taking a sixth subject in the Class 10 board exam?',
  50, '{}', NULL,
  'The board exam can include up to seven subjects: five compulsory, plus up to two optional. The five compulsory subjects are the two languages, mathematics, science, and social science. A skill subject or another subject the school offers can be one of the optional papers. Offering it is the school''s decision. This page does not add a subject.'
);
SELECT path_put_node(
  'cbse-g10-r3', 'cbse-g10-covers', 'topic', 'Third language', NULL,
  'Must be passed at school before the board exam.',
  'Has your child already passed the third language in the school assessment?',
  60, '{}', NULL,
  'For this Class 10 batch, the third language is not a separate board paper. The student must still have passed it in the school''s own assessment. A student who did not pass it in Class 8 can be assessed again by the school in Class 9, and if needed in Class 10. CBSE does not issue the admit card for the board exam unless that school assessment is done.'
);
SELECT path_put_node(
  'cbse-g10-internal', 'cbse-g10-covers', 'topic', 'Art, health, and work', NULL,
  'School-assessed. Not board papers.',
  'How does your school record art, health, and work experience for Class 10?',
  70, '{}', NULL,
  'Art education, health and physical education, and work experience are assessed by the school. For this batch, work experience sits with health and physical education. These are not the board papers. The board still expects them to be completed.'
);
SELECT path_put_node(
  'cbse-g10-check', 'cbse-g10', 'section', 'How the board exam works', NULL,
  'Internal assessment plus the board paper. Both are required.',
  NULL, 20, '{}', NULL, NULL
);
SELECT path_put_node(
  'cbse-g10-board', 'cbse-g10-check', 'topic', 'The Class 10 board exam', NULL,
  'CBSE sets the board paper on this year''s Class 10 syllabus.',
  'What has your school said about internal marks and the board paper?',
  10, '{}', NULL,
  'The external exam at the end of Class 10 is set by CBSE, on the Class 10 syllabus for this session. Every candidate also has to complete the internal assessment. Missing either part means the subject is not complete. Class 10 is the end of secondary school. It is not a Class 12 qualification, and it does not by itself choose a Class 11 stream.'
);

SELECT path_put_node(
  'cbse-g10-after', 'cbse-g10', 'section', 'After Class 10', NULL,
  'Routes for Classes 11 and 12. Looking does not choose one.',
  'CBSE parents still deciding after Class 10: what helped you compare staying and switching?',
  30, '{}', NULL,
  'After CBSE Class 10, most families continue to CBSE Classes 11 and 12. Other routes are in this section. The receiving school has to offer the programme. Class 10 by itself is not a Class 12 qualification. Opening a route does not change the child profile.'
);

UPDATE path_nodes SET
  parent_id = (SELECT id FROM path_nodes WHERE slug = 'cbse-g10-after'),
  updated_at = now()
WHERE slug IN ('cbse-stay', 'cbse-switch', 'cbse-poly', 'cbse-unsure');

-- Roots for Classes 1–9. Class 10 already has a root.
INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 1', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['foundation'], ARRAY['G1'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g1'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G1' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 2', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['foundation'], ARRAY['G2'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g2'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G2' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 3', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['foundation'], ARRAY['G3'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g3'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G3' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 4', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['foundation'], ARRAY['G4'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g4'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G4' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 5', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['foundation'], ARRAY['G5'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g5'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G5' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 6', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['middle'], ARRAY['G6'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g6'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G6' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 7', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['middle'], ARRAY['G7'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g7'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G7' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 8', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['middle'], ARRAY['G8'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g8'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G8' = ANY(r.grade_codes)
);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT 'CBSE Class 9', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['board_10'], ARRAY['G9'],
       false, id, 10, 'published'
FROM path_nodes WHERE slug = 'cbse-g9'
AND NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'CBSE' = ANY(r.curriculum_codes) AND 'G9' = ANY(r.grade_codes)
);

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
