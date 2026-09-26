-- Cambridge Years 1–11.
-- Years 1–6 are Cambridge Primary. Years 7–9 are Cambridge Lower Secondary.
-- Years 10–11 are the IGCSE course. Year 11 keeps the existing after-IGCSE routes.
-- Subject lists follow Cambridge International's published curricula.
-- The school chooses which subjects to teach. Safe to re-run.

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

-- Year 1
SELECT path_put_node('igcse-y1', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 1. The school chooses the subjects.',
  'Which subjects are on my child''s Year 1 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 1 is Cambridge Primary, stage 1. The school chooses the subjects. There is no Cambridge exam this year.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 1 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y1-lang-en', 'igcse-y1', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 1 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Listening
- Speaking
- Starting to read
- Starting to write

[[example]]
ONE EXAMPLE
The teacher reads a picture book. Your child says what happened.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 1 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y1-langacq', 'igcse-y1', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 1 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Everyday English
- Listening
- A few spoken sentences
- Starting to recognise words

[[example]]
ONE EXAMPLE
Point to a picture of a bus and say the English word.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 1 timetable?
$cam$);

SELECT path_put_node('igcse-y1-math', 'igcse-y1', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 1 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- Counting
- Shapes
- Adding and taking away with objects
- More and less

[[example]]
ONE EXAMPLE
Count 8 buttons and point to the pile that has more.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 1 using?
$cam$);

SELECT path_put_node('igcse-y1-sci', 'igcse-y1', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 1?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Looking closely
- Living things
- Materials
- Pushes, pulls, and changes

[[example]]
ONE EXAMPLE
Sort objects into those that float and those that sink.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 1, and which book?
$cam$);

SELECT path_put_node('igcse-y1-other', 'igcse-y1', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 1 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 1 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y1-exam', 'igcse-y1', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 1 have?',
  80, '{}', NULL,
  $cam$[[lead]]
There is no Cambridge test this year.

[[checks]]
This year
- The school sets its own checks
- Cambridge Primary Checkpoint is at the end of Year 6
- A progression test, marked by the school, is for later primary years

[[example]]
ONE EXAMPLE
A class quiz stays with the teacher. Cambridge does not issue a certificate for this year.

[[note]]
WHAT THIS PAGE DOES NOT DO
Opening it does not register your child for a test.

[[ask-school]]
How do you report Year 1 progress to parents?
$cam$);

-- Year 2
SELECT path_put_node('igcse-y2', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 2. The school chooses the subjects.',
  'Which subjects are on my child''s Year 2 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 2 is Cambridge Primary, stage 2. The school chooses the subjects. There is no Cambridge exam this year.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 2 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y2-lang-en', 'igcse-y2', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 2 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Listening and speaking in longer turns
- Reading a few sentences
- Writing two or three sentences

[[example]]
ONE EXAMPLE
The teacher shows a picture of a market. Your child writes two sentences about it.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 2 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y2-langacq', 'igcse-y2', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 2 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Short spoken exchanges
- Reading very short texts
- Writing a sentence

[[example]]
ONE EXAMPLE
The teacher asks 'What is this?' and your child answers in a full English sentence.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 2 timetable?
$cam$);

SELECT path_put_node('igcse-y2-math', 'igcse-y2', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 2 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- Numbers beyond the first ten
- Adding and taking away
- Simple measuring
- Shapes

[[example]]
ONE EXAMPLE
Take 5 counters away from 14 and say how many are left.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 2 using?
$cam$);

SELECT path_put_node('igcse-y2-sci', 'igcse-y2', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 2?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Plants and animals they can see
- Materials
- How things move

[[example]]
ONE EXAMPLE
Name the leaf, stem, and root on a plant in the classroom.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 2, and which book?
$cam$);

SELECT path_put_node('igcse-y2-other', 'igcse-y2', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 2 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 2 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y2-exam', 'igcse-y2', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 2 have?',
  80, '{}', NULL,
  $cam$[[lead]]
There is no Cambridge test this year.

[[checks]]
This year
- The school sets its own checks
- Cambridge Primary Checkpoint is at the end of Year 6
- A progression test, marked by the school, is for later primary years

[[example]]
ONE EXAMPLE
A class quiz stays with the teacher. Cambridge does not issue a certificate for this year.

[[note]]
WHAT THIS PAGE DOES NOT DO
Opening it does not register your child for a test.

[[ask-school]]
How do you report Year 2 progress to parents?
$cam$);

-- Year 3
SELECT path_put_node('igcse-y3', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 3. The school chooses the subjects.',
  'Which subjects are on my child''s Year 3 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 3 is Cambridge Primary, stage 3. The school chooses the subjects. A school test called a progression test is optional.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 3 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y3-lang-en', 'igcse-y3', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 3 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading a short page
- Writing a few linked sentences
- Talking about a story

[[example]]
ONE EXAMPLE
Your child reads a page and says who was there, where they were, and what they did.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 3 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y3-langacq', 'igcse-y3', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 3 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Listening to a short talk
- Reading a simple paragraph
- Writing a few sentences

[[example]]
ONE EXAMPLE
Your child hears a short description of a classroom and points to the objects named.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 3 timetable?
$cam$);

SELECT path_put_node('igcse-y3-math', 'igcse-y3', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 3 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- Place value
- Adding and subtracting
- Sharing into equal groups
- Measuring length

[[example]]
ONE EXAMPLE
Share 12 counters into 3 equal groups and say how many are in each.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 3 using?
$cam$);

SELECT path_put_node('igcse-y3-sci', 'igcse-y3', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 3?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Living things and their needs
- Materials and their uses
- Forces in a simple test

[[example]]
ONE EXAMPLE
Two paper towels. Your child checks which one soaks up more water.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 3, and which book?
$cam$);

SELECT path_put_node('igcse-y3-other', 'igcse-y3', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 3 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 3 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y3-exam', 'igcse-y3', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 3 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The school may use a Cambridge progression test. It does not have to.

[[checks]]
If the school uses one
- English, or English as a second language
- Mathematics
- Science
- Marked by the school

[[example]]
ONE EXAMPLE
The class sits a mathematics progression test in school. The teacher marks it. Cambridge does not issue a certificate for this year.

[[note]]
WHAT THIS IS NOT
Not Primary Checkpoint. That is at the end of Year 6. Not IGCSE. Not every school uses progression tests.

[[ask-school]]
Do you use Cambridge progression tests this year, and in which subjects?
$cam$);

-- Year 4
SELECT path_put_node('igcse-y4', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 4. The school chooses the subjects.',
  'Which subjects are on my child''s Year 4 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 4 is Cambridge Primary, stage 4. The school chooses the subjects. A school test called a progression test is optional.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 4 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y4-lang-en', 'igcse-y4', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 4 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading for the main point
- Writing a short paragraph
- Speaking to the class

[[example]]
ONE EXAMPLE
Your child writes one paragraph about a school trip, in the order things happened.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 4 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y4-langacq', 'igcse-y4', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 4 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Reading for meaning
- Writing a short message
- Speaking in a pair

[[example]]
ONE EXAMPLE
Your child writes a short message to a classmate about what they did yesterday.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 4 timetable?
$cam$);

SELECT path_put_node('igcse-y4-math', 'igcse-y4', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 4 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- Multiplication and division
- Fractions as parts of a whole
- Measuring
- Reading a simple chart

[[example]]
ONE EXAMPLE
Fold a paper into 4 equal parts and shade 1 part.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 4 using?
$cam$);

SELECT path_put_node('igcse-y4-sci', 'igcse-y4', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 4?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Habitats
- Changes in materials
- A test where one thing is changed

[[example]]
ONE EXAMPLE
Two ramps, one steeper. Your child says which car travels further, and what they kept the same.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 4, and which book?
$cam$);

SELECT path_put_node('igcse-y4-other', 'igcse-y4', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 4 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 4 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y4-exam', 'igcse-y4', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 4 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The school may use a Cambridge progression test. It does not have to.

[[checks]]
If the school uses one
- English, or English as a second language
- Mathematics
- Science
- Marked by the school

[[example]]
ONE EXAMPLE
The class sits a mathematics progression test in school. The teacher marks it. Cambridge does not issue a certificate for this year.

[[note]]
WHAT THIS IS NOT
Not Primary Checkpoint. That is at the end of Year 6. Not IGCSE. Not every school uses progression tests.

[[ask-school]]
Do you use Cambridge progression tests this year, and in which subjects?
$cam$);

-- Year 5
SELECT path_put_node('igcse-y5', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 5. The school chooses the subjects.',
  'Which subjects are on my child''s Year 5 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 5 is Cambridge Primary, stage 5. The school chooses the subjects. A school test called a progression test is optional.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 5 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y5-lang-en', 'igcse-y5', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 5 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading longer texts
- Writing for a reader
- Explaining an opinion in speech

[[example]]
ONE EXAMPLE
Your child reads a short article and says what the writer thinks, in their own words.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 5 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y5-langacq', 'igcse-y5', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 5 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Longer listening
- Reading a page
- Writing a short paragraph

[[example]]
ONE EXAMPLE
Your child listens to a short story and retells it in a few English sentences.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 5 timetable?
$cam$);

SELECT path_put_node('igcse-y5-math', 'igcse-y5', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 5 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- Larger calculations
- Fractions and decimals in a simple form
- Area and perimeter in a simple form
- Charts

[[example]]
ONE EXAMPLE
A chart shows favourite fruits. Your child says which fruit was chosen most.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 5 using?
$cam$);

SELECT path_put_node('igcse-y5-sci', 'igcse-y5', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 5?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Grouping living things
- Earth and space in a simple form
- Explaining a result

[[example]]
ONE EXAMPLE
Sort five animals into groups by what they have in common, and say the rule used.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 5, and which book?
$cam$);

SELECT path_put_node('igcse-y5-other', 'igcse-y5', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 5 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 5 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y5-exam', 'igcse-y5', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 5 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The school may use a Cambridge progression test. It does not have to.

[[checks]]
If the school uses one
- English, or English as a second language
- Mathematics
- Science
- Marked by the school

[[example]]
ONE EXAMPLE
The class sits a mathematics progression test in school. The teacher marks it. Cambridge does not issue a certificate for this year.

[[note]]
WHAT THIS IS NOT
Not Primary Checkpoint. That is at the end of Year 6. Not IGCSE. Not every school uses progression tests.

[[ask-school]]
Do you use Cambridge progression tests this year, and in which subjects?
$cam$);

-- Year 6
SELECT path_put_node('igcse-y6', NULL, 'root', 'This year', NULL,
  'Cambridge Primary, stage 6. The school chooses the subjects.',
  'Which subjects are on my child''s Year 6 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 6 is Cambridge Primary, stage 6. The school chooses the subjects. Primary Checkpoint, at the end of this year, is optional.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Primary is Years 1 to 6 in this app. Lower Secondary is Years 7 to 9. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 6 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y6-lang-en', 'igcse-y6', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 6 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading and writing at the end of primary
- Speaking and listening
- Using what they have read in their own writing

[[example]]
ONE EXAMPLE
Your child reads a short article and writes what it is mainly about.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 6 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y6-langacq', 'igcse-y6', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 6 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- The English needed for the end of primary
- Reading, writing, speaking, and listening

[[example]]
ONE EXAMPLE
Your child reads a short text and answers in English who did what.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 6 timetable?
$cam$);

SELECT path_put_node('igcse-y6-math', 'igcse-y6', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 6 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, shape, measuring, and data. The stage decides how far they go.

[[checks]]
What they learn
- The full primary mathematics stage
- Number, shape, measuring, and data
- Problems with more than one step

[[example]]
ONE EXAMPLE
There are 3 packs of 8 pencils. 4 are given away. Your child works out how many are left.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 6 using?
$cam$);

SELECT path_put_node('igcse-y6-sci', 'igcse-y6', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 6?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Living things, materials, forces, and Earth and space, still as one subject
- Planning a simple test

[[example]]
ONE EXAMPLE
Your child chooses a question, says what they would change, and what they would measure.

[[note]]
WHAT MAY VARY
The school chooses how much of this is a separate lesson. Ask for this year's topics. Cambridge does not publish one textbook that every school must use.

[[ask-school]]
Is science its own lesson in Year 6, and which book?
$cam$);

SELECT path_put_node('igcse-y6-other', 'igcse-y6', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 6 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 6 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y6-exam', 'igcse-y6', 'topic', 'Checkpoint', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 6 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The optional test at the end of primary is Cambridge Primary Checkpoint.

[[checks]]
If the school enters
- English, or English as a second language, marked by Cambridge
- Mathematics, marked by Cambridge
- Science, marked by Cambridge
- Global Perspectives, a team project marked by the teacher and checked by Cambridge

[[example]]
ONE EXAMPLE
Cambridge marks the English, mathematics, and science tests. The teacher marks the Global Perspectives team project, and Cambridge checks that marking.

[[note]]
WHAT THIS IS NOT
Not IGCSE. Not Class 10. The school can skip Checkpoint and use its own tests. Ask which month, and whether your child is entered. Many schools in India use March.

[[ask-school]]
Is my child entered for Primary Checkpoint, and in which subjects?
$cam$);

-- Year 7
SELECT path_put_node('igcse-y7', NULL, 'root', 'This year', NULL,
  'Cambridge Lower Secondary, stage 7. The school chooses the subjects.',
  'Which subjects are on my child''s Year 7 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 7 is Cambridge Lower Secondary, stage 7. The school chooses the subjects. A school test called a progression test is optional. Checkpoint is in Year 9.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Lower Secondary is Years 7 to 9 in this app. Primary was Years 1 to 6. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
Science is still one subject. It splits only if the school chooses separate sciences at IGCSE.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 7 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y7-lang-en', 'igcse-y7', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 7 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading fiction and non-fiction
- Writing for a purpose
- Speaking and listening

[[example]]
ONE EXAMPLE
Your child reads a non-fiction page and says the main point in one sentence.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 7 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y7-langacq', 'igcse-y7', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 7 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- English for lessons, not only for chat
- Reading a textbook page
- Writing a short answer

[[example]]
ONE EXAMPLE
Your child reads a science sentence and says it again in their own English.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 7 timetable?
$cam$);

SELECT path_put_node('igcse-y7-math', 'igcse-y7', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 7 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, algebra, geometry, measuring, and statistics. Still one mathematics subject.

[[checks]]
What they learn
- Number
- The start of algebra
- Geometry and measuring
- Data

[[example]]
ONE EXAMPLE
If n + 5 = 12, your child finds n and checks by putting it back.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 7 using?
$cam$);

SELECT path_put_node('igcse-y7-sci', 'igcse-y7', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 7?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Biology, chemistry, and physics ideas, still in one subject
- Earth and space
- A scientific question

[[example]]
ONE EXAMPLE
A plant kept in the dark looks different from one by the window. Your child says what was different.

[[note]]
WHAT MAY VARY
Cambridge Lower Secondary Science includes biology, chemistry, physics, and Earth and space, inside this one subject. The split into separate IGCSE sciences is a later choice, in Years 10 and 11. Ask for this year's topics.

[[ask-school]]
Is science its own lesson in Year 7, and which book?
$cam$);

SELECT path_put_node('igcse-y7-other', 'igcse-y7', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 7 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses. If the school teaches Computing, learners write programs in a text language such as Python.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 7 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y7-exam', 'igcse-y7', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 7 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The school may use a Cambridge progression test. Checkpoint is at the end of Year 9.

[[checks]]
If the school uses one
- English, or English as a second language
- Mathematics
- Science
- Marked by the school

[[example]]
ONE EXAMPLE
The class sits a science progression test in school. The teacher marks it. Cambridge does not issue a Year 7 certificate.

[[note]]
WHAT THIS IS NOT
Not Lower Secondary Checkpoint. That is at the end of Year 9. Not IGCSE. Not every school uses progression tests.

[[ask-school]]
Do you use Cambridge progression tests this year, and in which subjects?
$cam$);

-- Year 8
SELECT path_put_node('igcse-y8', NULL, 'root', 'This year', NULL,
  'Cambridge Lower Secondary, stage 8. The school chooses the subjects.',
  'Which subjects are on my child''s Year 8 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 8 is Cambridge Lower Secondary, stage 8. The school chooses the subjects. A school test called a progression test is optional. Checkpoint is in Year 9.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Lower Secondary is Years 7 to 9 in this app. Primary was Years 1 to 6. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
Science is still one subject. It splits only if the school chooses separate sciences at IGCSE.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 8 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y8-lang-en', 'igcse-y8', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 8 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading with more care about the writer's choices
- Writing to explain or persuade
- Speaking to people who were not in the room

[[example]]
ONE EXAMPLE
Your child writes a short piece asking the school to change one rule, and gives a reason.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 8 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y8-langacq', 'igcse-y8', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 8 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Longer reading
- Writing a paragraph with a reason
- Speaking in a small group

[[example]]
ONE EXAMPLE
Your child writes a paragraph giving one reason for an opinion, in English.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 8 timetable?
$cam$);

SELECT path_put_node('igcse-y8-math', 'igcse-y8', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 8 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, algebra, geometry, measuring, and statistics. Still one mathematics subject.

[[checks]]
What they learn
- Algebra
- Number
- Geometry and measuring
- Statistics

[[example]]
ONE EXAMPLE
A rectangle is 6 cm by 4 cm. Your child finds the area.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 8 using?
$cam$);

SELECT path_put_node('igcse-y8-sci', 'igcse-y8', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 8?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- Why a change happens, not only what happens
- Living things, materials, forces, Earth and space

[[example]]
ONE EXAMPLE
Ice melting can be reversed. Burning wood cannot. Your child says which change is which.

[[note]]
WHAT MAY VARY
Cambridge Lower Secondary Science includes biology, chemistry, physics, and Earth and space, inside this one subject. The split into separate IGCSE sciences is a later choice, in Years 10 and 11. Ask for this year's topics.

[[ask-school]]
Is science its own lesson in Year 8, and which book?
$cam$);

SELECT path_put_node('igcse-y8-other', 'igcse-y8', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 8 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses. If the school teaches Computing, learners write programs in a text language such as Python.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 8 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y8-exam', 'igcse-y8', 'topic', 'Tests', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 8 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The school may use a Cambridge progression test. Checkpoint is at the end of Year 9.

[[checks]]
If the school uses one
- English, or English as a second language
- Mathematics
- Science
- Marked by the school

[[example]]
ONE EXAMPLE
The class sits a science progression test in school. The teacher marks it. Cambridge does not issue a Year 8 certificate.

[[note]]
WHAT THIS IS NOT
Not Lower Secondary Checkpoint. That is at the end of Year 9. Not IGCSE. Not every school uses progression tests.

[[ask-school]]
Do you use Cambridge progression tests this year, and in which subjects?
$cam$);

-- Year 9
SELECT path_put_node('igcse-y9', NULL, 'root', 'This year', NULL,
  'Cambridge Lower Secondary, stage 9. The school chooses the subjects.',
  'Which subjects are on my child''s Year 9 timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 9 is Cambridge Lower Secondary, stage 9. The school chooses the subjects. Lower Secondary Checkpoint, at the end of this year, is optional.

[[checks]]
Subjects Cambridge publishes
- English
- English as a second language
- Mathematics
- Science
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[note]]
WORDS ON THIS PAGE
Cambridge Lower Secondary is Years 7 to 9 in this app. Primary was Years 1 to 6. The IGCSE exams are in Years 10 and 11.
Cambridge does not make every school teach every subject on this list.
Science is still one subject. It splits only if the school chooses separate sciences at IGCSE.
If your school uses a different year name, ask which Cambridge stage this class is.

[[ask-school]]
Which of these subjects are on my child's Year 9 timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y9-lang-en', 'igcse-y9', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 9 using?',
  10, '{}', NULL,
  $cam$[[lead]]
This is the English course for children already learning in English.

[[checks]]
What they learn
- Reading more than one text
- Writing at length
- Speaking and listening

[[example]]
ONE EXAMPLE
Your child reads two short texts on the same topic and says one way they differ.

[[note]]
WHAT MAY VARY
If English is new for your child, the school may use English as a second language instead, or as well. Cambridge does not set one textbook for every school.

[[ask-school]]
Is Year 9 English the first-language course, and which book?
$cam$);

SELECT path_put_node('igcse-y9-langacq', 'igcse-y9', 'topic', 'English as a second language', NULL,
  'A different English course. The school may use this instead.',
  'Is English as a second language on the Year 9 timetable?',
  20, '{}', NULL,
  $cam$[[lead]]
A different English course, for children who use another language at home.

[[checks]]
What they learn
- Reading and writing closer to the end of lower secondary
- Speaking and listening

[[example]]
ONE EXAMPLE
Your child reads a page and writes five sentences in English about what it says.

[[note]]
WHAT THIS IS
Cambridge publishes this separately from English. The school chooses one course, or both. It is not a language such as Hindi or French. Those sit under the other subjects, if the school teaches them.

[[ask-school]]
Is English as a second language on the Year 9 timetable?
$cam$);

SELECT path_put_node('igcse-y9-math', 'igcse-y9', 'topic', 'Mathematics', NULL,
  'Number, shape, and measuring.',
  'Which mathematics course is Year 9 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Number, algebra, geometry, measuring, and statistics. Still one mathematics subject.

[[checks]]
What they learn
- Number, algebra, geometry, and statistics at the end of lower secondary
- Problems that use more than one of those

[[example]]
ONE EXAMPLE
Five scores are 6, 7, 7, 8, and 7. Your child finds the mean.

[[note]]
WHAT MAY VARY
The school chooses the book or scheme. Ask for that name, not a tuition sheet.

[[ask-school]]
Which mathematics book or scheme is Year 9 using?
$cam$);

SELECT path_put_node('igcse-y9-sci', 'igcse-y9', 'topic', 'Science', NULL,
  'One science subject. Not split into three.',
  'How is science organised in Year 9?',
  40, '{}', NULL,
  $cam$[[lead]]
One science subject. It is not split into biology, chemistry, and physics.

[[checks]]
What they learn
- The end of lower-secondary science, still one subject
- Reading a results table

[[example]]
ONE EXAMPLE
A table shows plant height after one week in light and in the dark. Your child says what the table shows.

[[note]]
WHAT MAY VARY
Cambridge Lower Secondary Science includes biology, chemistry, physics, and Earth and space, inside this one subject. The split into separate IGCSE sciences is a later choice, in Years 10 and 11. Ask for this year's topics.

[[ask-school]]
Is science its own lesson in Year 9, and which book?
$cam$);

SELECT path_put_node('igcse-y9-other', 'igcse-y9', 'topic', 'Subjects the school may add', NULL,
  'Published by Cambridge. Not all are on every timetable.',
  'Which other subjects are on the Year 9 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
Cambridge publishes these as well. Your school may teach only some of them.

[[checks]]
Ask which of these are taught
- Global Perspectives
- Digital Literacy
- Computing
- Art and Design
- Music
- Physical Education
- Humanities
- A modern foreign language
- Wellbeing

[[example]]
ONE EXAMPLE
Art on Tuesday and PE on Thursday, and no Computing lesson. That timetable is allowed.

[[note]]
WHAT THE NAMES MEAN
Computing is how computers work. Digital Literacy is using technology and staying safe. They are two courses. If the school teaches Computing, learners write programs in a text language such as Python.
Humanities and a modern foreign language are newer. Many schools do not teach them yet.
Global Perspectives is a subject where children look at a question from more than one side.
Wellbeing is its own subject. Ask what the school calls that lesson.

[[ask-school]]
Which of these are on the Year 9 timetable, and which are left out?
$cam$);

SELECT path_put_node('igcse-y9-exam', 'igcse-y9', 'topic', 'Checkpoint', NULL,
  'What Cambridge tests, if any, happen this year.',
  'What tests does Year 9 have?',
  80, '{}', NULL,
  $cam$[[lead]]
The optional test at the end of lower secondary is Cambridge Lower Secondary Checkpoint.

[[checks]]
If the school enters
- English, or English as a second language, marked by Cambridge
- Mathematics, marked by Cambridge
- Science, marked by Cambridge
- Global Perspectives, a research report marked by the teacher and checked by Cambridge

[[example]]
ONE EXAMPLE
Cambridge marks the English, mathematics, and science tests. The Global Perspectives piece is a research report, not a team project. The teacher marks it, and Cambridge checks that marking.

[[note]]
WHAT THIS IS NOT
Not IGCSE. Not Class 10. The school can skip Checkpoint. Ask which month, and whether your child is entered. Many schools in India use March.

[[ask-school]]
Is my child entered for Lower Secondary Checkpoint, and in which subjects?
$cam$);

-- Year 10
SELECT path_put_node('igcse-y10', NULL, 'root', 'This year', NULL,
  'First year of IGCSE. The school chooses the subjects.',
  'Which subjects are on my child''s IGCSE timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 10 is the first year of Cambridge IGCSE. The course is usually two years. The school chooses every subject.

[[checks]]
Ask the school for this year's subjects
- English: First Language, Literature, or English as a second language
- Mathematics, and whether Additional Mathematics is also taught
- Science: three separate sciences, or one combined course
- Every other subject on the timetable

[[note]]
WORDS ON THIS PAGE
IGCSE is the qualification at the end of this two-year course. It is the Class 10 stage, not Class 12.
Cambridge publishes over 70 subjects, including about 30 languages, and does not make any of them compulsory.
The timetable is the list. This page is not a registration.

[[ask-school]]
Which subjects are on my child's IGCSE timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y10-lang-en', 'igcse-y10', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 10 using?',
  10, '{}', NULL,
  $cam$[[lead]]
The school chooses the English courses. Cambridge does not set one English for every school.

[[checks]]
Courses Cambridge publishes
- English — First Language
- Literature in English, often taken as well, not instead
- English as a Second Language, a different course

[[example]]
ONE EXAMPLE
The timetable shows First Language English and Literature. A classmate is on English as a Second Language instead. Both can be right. Ask which courses your child is entered for.

[[note]]
WHAT MAY VARY
Literature is its own subject. It is often taught next to First Language English. English as a Second Language is the course for learners who use another language at home. Ask for the name on the timetable, not a tuition label.

[[ask-school]]
Which English courses is my child entered for?
$cam$);

SELECT path_put_node('igcse-y10-math', 'igcse-y10', 'topic', 'Mathematics', NULL,
  'Its own IGCSE subject. Ask about Core, Extended, and Additional.',
  'Which mathematics course is Year 10 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Mathematics is its own IGCSE subject. The school chooses the course.

[[checks]]
Ask which course
- Cambridge IGCSE Mathematics
- Whether your child is entered for Core or Extended
- Whether Additional Mathematics is a separate subject

[[example]]
ONE EXAMPLE
Two classmates both study mathematics. One is entered for Extended, which includes the harder questions. The other is on Core. Ask which paper your child will sit.

[[note]]
WHAT CORE AND EXTENDED MEAN
Many Cambridge mathematics courses have two versions. Extended includes harder questions and can award the top grade. Core is the shorter version. Ask which one your child is entered for, and what the highest grade on that paper is. Additional Mathematics is a different subject. Not every school teaches it.

[[ask-school]]
Is my child on Core or Extended, and is Additional Mathematics on the timetable?
$cam$);

SELECT path_put_node('igcse-y10-sci', 'igcse-y10', 'topic', 'Science', NULL,
  'Separate sciences, or one combined course. Ask how many grades.',
  'How is science organised in Year 10?',
  40, '{}', NULL,
  $cam$[[lead]]
At IGCSE, the school chooses how science is organised.

[[checks]]
Three ways schools set it
- Biology, Chemistry, and Physics as three subjects
- Co-ordinated Sciences: one course, two grades
- Combined Science: one course, one grade

[[example]]
ONE EXAMPLE
One timetable has Biology, Chemistry, and Physics as three lines. Another has one science course. Ask which timetable your child is on, and how many grades it gives.

[[note]]
WHAT TO ASK
Ask for the course name and how many grades it awards. A double course is two grades. A single combined course is one. Three separate sciences are three. Some schools use another science syllabus. Ask if yours does.

[[ask-school]]
Which science course is my child taking, and how many grades does it give?
$cam$);

SELECT path_put_node('igcse-y10-other', 'igcse-y10', 'topic', 'Other subjects', NULL,
  'Languages, humanities, and the rest of the timetable.',
  'Which other subjects are on the Year 10 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
These are the other groups. Cambridge publishes many subjects inside each one. The timetable shows which.

[[checks]]
Groups to ask about
- Another language, such as Hindi or French
- Humanities: History, Geography, Economics, Global Perspectives
- Business, or Computer Science
- Art and Design, Music, or Physical Education

[[example]]
ONE EXAMPLE
The timetable has Hindi, Geography, and Computer Science, and no Art. That is a school choice. It is not a Cambridge rule.

[[note]]
WHAT THIS LIST IS
Not the full catalogue. There are over 70 IGCSE subjects. Ask for the timetable, including any subject examined this year and any subject left until Year 11.

[[ask-school]]
Can I have the full IGCSE subject list for my child?
$cam$);

SELECT path_put_node('igcse-y10-exam', 'igcse-y10', 'topic', 'Exams this year', NULL,
  'Most papers are in Year 11. Ask if any are this year.',
  'What tests does Year 10 have?',
  80, '{}', NULL,
  $cam$[[lead]]
Year 10 is usually the teaching year. Most schools sit the IGCSE papers in Year 11.

[[checks]]
Ask this year
- Which subjects are on the timetable
- Which of those, if any, have an exam this year
- Which month the school uses
- Whether the certificate will show A* to G

[[example]]
ONE EXAMPLE
English is taught all year and the papers are in Year 11. A school can enter one subject early. Ask before you assume none are examined now.

[[note]]
GRADES AND A GROUP CERTIFICATE
Around the world, IGCSE grades run from A*, the highest, down to G. A 9-to-1 scale is a choice for some schools, mainly in the UK. Ask which scale your school enters.
Cambridge ICE is an optional group certificate. It is not automatic. It needs passes in at least seven subjects from five groups, including two different languages. The groups are languages, humanities, sciences, mathematics, and creative or vocational. The school has to enter your child for it.
IGCSE is the Class 10 stage, not Class 12.

[[ask-school]]
Which subjects, if any, are examined this year, and in which month?
$cam$);

-- Year 11
SELECT path_put_node('igcse-y11', NULL, 'root', 'This year', NULL,
  'IGCSE exam year. The school chooses the subjects.',
  'Which subjects are on my child''s IGCSE timetable?',
  0, '{}', NULL,
  $cam$[[lead]]
Year 11 is the exam year of Cambridge IGCSE. The course is usually two years. The school chooses every subject.

[[checks]]
Ask the school for this year's subjects
- English: First Language, Literature, or English as a second language
- Mathematics, and whether Additional Mathematics is also taught
- Science: three separate sciences, or one combined course
- Every other subject on the timetable

[[note]]
WORDS ON THIS PAGE
IGCSE is the qualification at the end of this two-year course. It is the Class 10 stage, not Class 12.
Cambridge publishes over 70 subjects, including about 30 languages, and does not make any of them compulsory.
The timetable is the list. This page is not a registration.

[[ask-school]]
Which subjects are on my child's IGCSE timetable?

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-y11-lang-en', 'igcse-y11', 'topic', 'English', NULL,
  'The English course the school has chosen.',
  'Which English course is Year 11 using?',
  10, '{}', NULL,
  $cam$[[lead]]
The school chooses the English courses. Cambridge does not set one English for every school.

[[checks]]
Courses Cambridge publishes
- English — First Language
- Literature in English, often taken as well, not instead
- English as a Second Language, a different course

[[example]]
ONE EXAMPLE
The First Language papers and the Literature papers are separate results, if the school has entered both.

[[note]]
WHAT MAY VARY
Literature is its own subject. It is often taught next to First Language English. English as a Second Language is the course for learners who use another language at home. Ask for the name on the timetable, not a tuition label.

[[ask-school]]
Which English courses is my child entered for?
$cam$);

SELECT path_put_node('igcse-y11-math', 'igcse-y11', 'topic', 'Mathematics', NULL,
  'Its own IGCSE subject. Ask about Core, Extended, and Additional.',
  'Which mathematics course is Year 11 using?',
  30, '{}', NULL,
  $cam$[[lead]]
Mathematics is its own IGCSE subject. The school chooses the course.

[[checks]]
Ask which course
- Cambridge IGCSE Mathematics
- Whether your child is entered for Core or Extended
- Whether Additional Mathematics is a separate subject

[[example]]
ONE EXAMPLE
The mathematics papers are only mathematics. A result in Additional Mathematics, if the school offers it, is a second subject.

[[note]]
WHAT CORE AND EXTENDED MEAN
Many Cambridge mathematics courses have two versions. Extended includes harder questions and can award the top grade. Core is the shorter version. Ask which one your child is entered for, and what the highest grade on that paper is. Additional Mathematics is a different subject. Not every school teaches it.

[[ask-school]]
Is my child on Core or Extended, and is Additional Mathematics on the timetable?
$cam$);

SELECT path_put_node('igcse-y11-sci', 'igcse-y11', 'topic', 'Science', NULL,
  'Separate sciences, or one combined course. Ask how many grades.',
  'How is science organised in Year 11?',
  40, '{}', NULL,
  $cam$[[lead]]
At IGCSE, the school chooses how science is organised.

[[checks]]
Three ways schools set it
- Biology, Chemistry, and Physics as three subjects
- Co-ordinated Sciences: one course, two grades
- Combined Science: one course, one grade

[[example]]
ONE EXAMPLE
A biology paper and a physics paper may be two subjects, or two parts of one course. The statement of entry shows which.

[[note]]
WHAT TO ASK
Ask for the course name and how many grades it awards. A double course is two grades. A single combined course is one. Three separate sciences are three. Some schools use another science syllabus. Ask if yours does.

[[ask-school]]
Which science course is my child taking, and how many grades does it give?
$cam$);

SELECT path_put_node('igcse-y11-other', 'igcse-y11', 'topic', 'Other subjects', NULL,
  'Languages, humanities, and the rest of the timetable.',
  'Which other subjects are on the Year 11 timetable?',
  50, '{}', NULL,
  $cam$[[lead]]
These are the other groups. Cambridge publishes many subjects inside each one. The timetable shows which.

[[checks]]
Groups to ask about
- Another language, such as Hindi or French
- Humanities: History, Geography, Economics, Global Perspectives
- Business, or Computer Science
- Art and Design, Music, or Physical Education

[[example]]
ONE EXAMPLE
The timetable has Hindi, Geography, and Computer Science, and no Art. That is a school choice. It is not a Cambridge rule.

[[note]]
WHAT THIS LIST IS
Not the full catalogue. There are over 70 IGCSE subjects. Ask for the timetable, including any subject examined this year and any subject left until Year 11.

[[ask-school]]
Can I have the full IGCSE subject list for my child?
$cam$);

SELECT path_put_node('igcse-y11-exam', 'igcse-y11', 'topic', 'The IGCSE exams', NULL,
  'One result for each subject. IGCSE is the Class 10 stage.',
  'What tests does Year 11 have?',
  80, '{}', NULL,
  $cam$[[lead]]
This is the IGCSE exam year for most subjects. Each subject is its own set of papers.

[[checks]]
On the certificate
- One result for each subject entered
- Grades usually from A*, the highest, down to G
- The month the school entered

[[example]]
ONE EXAMPLE
A strong English grade does not change the mathematics grade. They are separate results.

[[note]]
WHAT IGCSE IS
IGCSE is the Class 10 stage, not Class 12. A Level, the IB Diploma, or CBSE Classes 11–12 comes after it. NTA does not list IGCSE as a Class 12 qualifying exam for JEE Main.
A 9-to-1 scale is a choice for some schools, mainly in the UK. Ask which scale is on your child's certificate.
Cambridge ICE is optional. It needs passes in at least seven subjects from five groups, including two different languages. The school has to enter it. Opening this page does not enter your child.

[[ask-school]]
Which subjects are entered this series, which month, and is the scale A* to G?
$cam$);

SELECT path_put_node('igcse-y11-after', 'igcse-y11', 'section', 'After IGCSE', NULL,
  'The choices for the next two years. Opening one does not pick it.',
  'What helped you compare A Level with the other routes?',
  90, '{}', NULL,
  $cam$[[lead]]
These are the choices after IGCSE. Opening one does not pick it.

[[checks]]
The choices
- Stay with Cambridge for AS and A Level
- Switch to the IB Diploma
- Switch to CBSE for Classes 11 and 12
- Not sure yet

[[note]]
WHAT IGCSE IS NOT
IGCSE is the Class 10 stage, not Class 12. The next school has to offer the course.

[[view tiles]]
$cam$);

SELECT path_put_node('igcse-alevel', 'igcse-y11-after', 'route', 'Cambridge AS / A Level', NULL,
  'Usually 3 or 4 subjects. A Level can be Class 12. IGCSE is not.',
  'Which A Level subjects does the school teach?',
  10, '{}', 'cambridge-a-level',
  $cam$[[lead]]
Cambridge A Level comes after IGCSE. It is usually 3 or 4 subjects. It can count as Class 12. IGCSE does not.

[[checks]]
What to check
- The school offers A Level
- Which subjects it teaches
- How many subjects your child would take

[[example]]
ONE EXAMPLE
A child finishes IGCSE and starts three A Level subjects at a school that teaches them. The IGCSE certificates do not enrol them.

[[note]]
WHAT THESE CERTIFICATES ARE
The Association of Indian Universities can treat A Level, typically two or three Advanced-level subjects after 12 years of school, as Class 12. IGCSE is the Class 10 stage. NTA lists GCE A Level, not IGCSE, among the qualifying exams for JEE Main. The subject match is still required.

[[ask-school]]
Which A Level subjects does the school teach?
$cam$);

SELECT path_put_node('igcse-dp', 'igcse-y11-after', 'route', 'IB Diploma Programme', NULL,
  'A two-year Diploma. IGCSE is not Class 12.',
  'Does the school offer the IB Diploma, and which subjects?',
  20, '{}', 'ib-diploma',
  $cam$[[lead]]
The IB Diploma is its own two-year programme. Finishing IGCSE does not place your child on it.

[[checks]]
The Diploma
- Six subjects
- A core the school will name
- A school that offers the Diploma

[[example]]
ONE EXAMPLE
The IGCSE certificate is the Class 10 stage. The Diploma, once finished on the terms the Association of Indian Universities sets, can be the Class 12 stage.

[[note]]
WHAT THIS IS NOT
Not Cambridge A Level. The new school has to offer the Diploma.

[[ask-school]]
Does the school offer the IB Diploma, and which subjects?
$cam$);

SELECT path_put_node('igcse-cbse', 'igcse-y11-after', 'route', 'CBSE Classes 11–12', NULL,
  'Classes 11–12. PCM, PCB, Commerce, and Arts are school combinations.',
  'Does the school offer CBSE Class 11, and which groups?',
  30, '{}', 'cbse-after-10-streams',
  $cam$[[lead]]
CBSE Classes 11 and 12 are a different board. The new school has to teach them.

[[checks]]
Names parents use
- PCM
- PCB
- PCMB
- Commerce
- Arts

[[example]]
ONE EXAMPLE
The IGCSE certificates do not place your child in PCM. The CBSE school offers a group, and you ask which one.

[[note]]
WHAT THESE NAMES ARE
They are groups the school offers. They are not written into a CBSE statute. CBSE Class 12 is the usual qualifying exam for Indian entrances. The rules for that year still apply.

[[ask-school]]
Does the school offer CBSE Class 11, and which groups?
$cam$);

SELECT path_put_node('igcse-unsure', 'igcse-y11-after', 'route', 'Not sure yet', NULL,
  'Read the choices. Nothing here picks one.',
  'What helped you compare A Level, the IB Diploma, and CBSE?',
  40, '{}', NULL,
  $cam$[[lead]]
You can read the choices and not pick one.

[[note]]
NOTHING CHANGES
Opening this page does not change your child's board, year, or subjects.

[[ask-school]]
What helped you compare A Level, the IB Diploma, and CBSE?
$cam$);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT v.label, ARRAY['CAMBRIDGE'], ARRAY['IGCSE'], v.stages, v.grades,
       v.fork, n.id, 10, 'published'
FROM (VALUES
  ('Cambridge Year 1', ARRAY['foundation']::text[], ARRAY['Y1']::text[], false),
  ('Cambridge Year 2', ARRAY['foundation'], ARRAY['Y2'], false),
  ('Cambridge Year 3', ARRAY['foundation'], ARRAY['Y3'], false),
  ('Cambridge Year 4', ARRAY['foundation'], ARRAY['Y4'], false),
  ('Cambridge Year 5', ARRAY['foundation'], ARRAY['Y5'], false),
  ('Cambridge Year 6', ARRAY['foundation'], ARRAY['Y6'], false),
  ('Cambridge Year 7', ARRAY['middle'], ARRAY['Y7'], false),
  ('Cambridge Year 8', ARRAY['middle'], ARRAY['Y8'], false),
  ('Cambridge Year 9', ARRAY['middle'], ARRAY['Y9'], false),
  ('Cambridge Year 10', ARRAY['board_10'], ARRAY['Y10'], false)
) AS v(label, stages, grades, fork)
JOIN path_nodes n ON n.slug = 'igcse-y' || substring(v.grades[1] from 2)
WHERE NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'IGCSE' = ANY(r.curriculum_codes)
    AND v.grades[1] = ANY(r.grade_codes)
);

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
