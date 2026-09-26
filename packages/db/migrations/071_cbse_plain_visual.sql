-- CBSE Classes 1–10: plain visual answers, full subject lists, 2026-27 exam changes.
-- Same blocks as the IB path. Safe to re-run.

BEGIN;

UPDATE path_nodes AS child
SET parent_id = root.id,
    updated_at = now()
FROM path_nodes AS parent
JOIN path_nodes AS root
  ON root.slug = regexp_replace(parent.slug, '-(covers|check)$', '')
WHERE child.parent_id = parent.id
  AND parent.slug ~ '^cbse-g(1|2|3|4|5|6|7|8|9|10)-(covers|check)$';

UPDATE path_nodes
SET status = 'retired', updated_at = now()
WHERE slug ~ '^cbse-g(1|2|3|4|5|6|7|8|9|10)-(covers|check)$';

-- Class 1
UPDATE path_nodes SET
  summary = 'Six subjects. No public exam.',
  ask_prompt_default = 'Which two languages are on my child''s Class 1 timetable?',
  lead = $cbse$[[lead]]
These are the Class 1 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Mathematics
- The world around your child
- Art
- Physical education

[[note]]
WORDS ON THIS PAGE
A public exam is a test CBSE sets for students across India. Class 1 does not have one. The school checks how your child is learning.

[[note]]
WHAT CHANGED
The new third-language rule starts in Class 6. Class 1 still has two languages, not three.

[[ask-school]]
Which two languages are on my child's Class 1 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two languages. The school names them.',
  ask_prompt_default = 'Which two languages is my child learning in Class 1?',
  lead = $cbse$[[lead]]
Your child learns two languages in Class 1.

[[checks]]
What they learn
- Listening and speaking
- Starting to read
- Starting to write

[[note]]
WHAT MAY VARY
The school chooses the two languages. One is often English. The other is often Hindi or the language of your state.

[[ask-school]]
Which two languages is my child learning, and what are the books called?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'Counting, shapes, and patterns.',
  ask_prompt_default = 'Which mathematics book is Class 1 using?',
  lead = $cbse$[[lead]]
Counting, shapes, and patterns. Children use objects, not only written sums.

[[checks]]
What they learn
- Counting
- Shapes
- Simple patterns
- Comparing more and less

[[ask-school]]
Which mathematics book is Class 1 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1-math';

UPDATE path_nodes SET
  title = 'The world around your child',
  summary = 'Family, school, plants, and animals.',
  ask_prompt_default = 'What does the school call this Class 1 subject?',
  lead = $cbse$[[lead]]
Family, school, food, plants, and animals.

[[checks]]
What they learn
- About themselves and the family
- The school and the neighbourhood
- Plants, animals, and food

[[note]]
WHAT MAY VARY
Some schools give this its own period. Some weave it through the day. Ask what your school does.

[[ask-school]]
Is this a separate period, or part of the rest of the day?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1-world';

UPDATE path_nodes SET
  title = 'Art and physical education',
  summary = 'Drawing, music, play, and movement.',
  ask_prompt_default = 'How many periods of art and movement does Class 1 have?',
  lead = $cbse$[[lead]]
Drawing, music, play, and movement are part of Class 1. They are not extra classes after the real work.

[[checks]]
What they learn
- Drawing and making
- Music or movement
- Play and physical activity

[[ask-school]]
How many periods a week are art and physical education?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1-art';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam. The school checks learning.',
  ask_prompt_default = 'Does Class 1 have written tests, or does the teacher observe?',
  lead = $cbse$[[lead]]
Class 1 has no CBSE exam.

[[checks]]
What the school may do
- Watch your child in class
- Look at classwork
- Sometimes give a short test

[[note]]
WHAT THIS IS NOT
A mark from the school is not a CBSE result. CBSE does not collect Class 1 marks.

[[ask-school]]
How will you tell me how my child is doing this year?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g1-board';

-- Class 2
UPDATE path_nodes SET
  summary = 'Six subjects. No public exam.',
  ask_prompt_default = 'Which two languages are on my child''s Class 2 timetable?',
  lead = $cbse$[[lead]]
These are the Class 2 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Mathematics
- The world around your child
- Art
- Physical education

[[note]]
WORDS ON THIS PAGE
A public exam is a test CBSE sets for students across India. Class 2 does not have one.

[[note]]
WHAT CHANGED
Reading, writing, and number work are longer than in Class 1. A third language still does not start. That starts in Class 6.

[[ask-school]]
Which two languages are on my child's Class 2 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two languages. More reading and writing than Class 1.',
  ask_prompt_default = 'Which two languages continued into Class 2?',
  lead = $cbse$[[lead]]
Your child still learns two languages. Not three.

[[checks]]
What they learn
- Longer reading
- Short writing
- Speaking in both languages

[[ask-school]]
Which two languages, and which books?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'Bigger numbers, adding, and taking away.',
  ask_prompt_default = 'Which mathematics book is Class 2 using?',
  lead = $cbse$[[lead]]
Bigger numbers, adding, taking away, shapes, and measuring.

[[checks]]
What they learn
- Numbers past the first counting
- Adding and taking away
- Shapes and simple measuring

[[ask-school]]
Which mathematics book is Class 2 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2-math';

UPDATE path_nodes SET
  title = 'The world around your child',
  summary = 'Neighbourhood, plants, animals, and helpers.',
  ask_prompt_default = 'What does the school call this Class 2 subject?',
  lead = $cbse$[[lead]]
The neighbourhood, plants, animals, food, and people who help.

[[ask-school]]
Is this its own period in Class 2?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2-world';

UPDATE path_nodes SET
  title = 'Art and physical education',
  summary = 'Art and movement stay on the timetable.',
  ask_prompt_default = 'How many art and movement periods does Class 2 have?',
  lead = $cbse$[[lead]]
Art and movement are still on the timetable. They are subjects, not a reward.

[[ask-school]]
What art and physical education does Class 2 do each week?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2-art';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam.',
  ask_prompt_default = 'How does the school report Class 2 progress?',
  lead = $cbse$[[lead]]
Class 2 has no CBSE exam. The school tells you how your child is doing.

[[note]]
WHAT THIS IS NOT
A school report is not a CBSE marksheet.

[[ask-school]]
What will you send home, and when?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g2-board';

-- Class 3
UPDATE path_nodes SET
  summary = 'The subject list, plus thinking practice inside those classes.',
  ask_prompt_default = 'Which subjects are on my child''s Class 3 timetable?',
  lead = $cbse$[[lead]]
These are the Class 3 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Mathematics
- The world around us
- Art
- Physical education

[[note]]
WHAT CHANGED IN 2026
Schools must now practise computational thinking inside these subjects. That means spotting a pattern and putting steps in order. It is not a new subject, not a new period, and not an exam.

[[note]]
WORDS ON THIS PAGE
Many schools still say EVS for "the world around us". It is the same area. Science and Social Science become separate subjects in Class 6, not now.

[[ask-school]]
Which subjects are printed on my child's Class 3 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two languages. More reading than Class 2.',
  ask_prompt_default = 'Which two languages does Class 3 teach?',
  lead = $cbse$[[lead]]
Two languages. Not three.

[[checks]]
What they learn
- Reading longer pieces
- Writing short answers
- Speaking in class

[[ask-school]]
Which two languages, and which books?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'More written sums than Class 2.',
  ask_prompt_default = 'Which mathematics book is Class 3 using?',
  lead = $cbse$[[lead]]
Number work, shapes, and measuring, with more writing than in Class 2.

[[ask-school]]
Which mathematics book is Class 3 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-math';

UPDATE path_nodes SET
  title = 'The world around us',
  summary = 'Its own subject. Some schools say EVS.',
  ask_prompt_default = 'Do you call this EVS or The World Around Us?',
  lead = $cbse$[[lead]]
Places, plants, animals, food, water, and how people live. This is now its own subject.

[[note]]
WHAT MAY VARY
Your timetable may say EVS. That is this subject. It is not Science, and it is not Social Science. Those start in Class 6.

[[ask-school]]
What name is on the timetable, and which book are you using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-world';

UPDATE path_nodes SET
  title = 'Computational thinking',
  summary = 'New in 2026. Inside other subjects. Not an exam.',
  ask_prompt_default = 'Where does this show up in the Class 3 week?',
  lead = $cbse$[[lead]]
This is new from 2026. It is practice inside the subjects your child already has.

[[checks]]
What they practise
- Spotting a pattern
- Putting steps in order
- Sorting things into groups

[[note]]
WHAT THIS IS NOT
Not a coding class. Not a new period. Not a mark on a board exam. CBSE asked schools not to add extra class time for it.

[[ask-school]]
In which subjects will my child do this, and how will you show me?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-ct';

UPDATE path_nodes SET
  title = 'Art and physical education',
  summary = 'Art and movement. Not exam subjects.',
  ask_prompt_default = 'Are art and physical education graded in Class 3?',
  lead = $cbse$[[lead]]
Art and movement are on the Class 3 plan. CBSE does not examine them.

[[ask-school]]
Are these graded, and how many periods a week?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-art';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam.',
  ask_prompt_default = 'What report will you send for Class 3?',
  lead = $cbse$[[lead]]
Class 3 has no CBSE exam.

[[note]]
WHAT THIS IS NOT
A school test is not a CBSE result.

[[ask-school]]
What report will you send home?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g3-board';

-- Class 4
UPDATE path_nodes SET
  summary = 'The full subject list. No public exam.',
  ask_prompt_default = 'Which subjects are on my child''s Class 4 timetable?',
  lead = $cbse$[[lead]]
These are the Class 4 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Mathematics
- The world around us
- Art
- Physical education

[[note]]
WHAT CHANGED IN 2026
Computational thinking stays inside these subjects. It is not a new exam. Science and Social Science are still not separate. That split is Class 6.

[[ask-school]]
Which subjects are on my child's Class 4 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two languages. Longer reading.',
  ask_prompt_default = 'Which books are used for the two Class 4 languages?',
  lead = $cbse$[[lead]]
Two languages. Children read longer pieces and write more.

[[ask-school]]
Which two languages, and which books?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'Operations, measuring, and the start of fractions.',
  ask_prompt_default = 'Which mathematics book is Class 4 using?',
  lead = $cbse$[[lead]]
Bigger calculations, measuring, shapes, and the first work with fractions.

[[note]]
WHAT TO ASK FOR
Ask for the Class 4 mathematics book the school is using. A tuition worksheet is not a second official list.

[[ask-school]]
Which mathematics book is Class 4 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-math';

UPDATE path_nodes SET
  title = 'The world around us',
  summary = 'Places, living things, and people. Not Science yet.',
  ask_prompt_default = 'Is Class 4 still one book, or have you split Science?',
  lead = $cbse$[[lead]]
Places, plants, animals, and how people live. Still one subject.

[[note]]
WHAT THIS IS NOT
Not Science. Not Social Science. Those are Class 6 subjects. The timetable may still say EVS.

[[ask-school]]
What is this subject called, and which book are you using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-world';

UPDATE path_nodes SET
  title = 'Computational thinking',
  summary = 'Inside other subjects. Not an exam.',
  ask_prompt_default = 'Where does this show up in Class 4?',
  lead = $cbse$[[lead]]
Pattern spotting and steps, inside the subjects already on the list. Not a new period and not an exam.

[[ask-school]]
In which Class 4 subjects will my child do this?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-ct';

UPDATE path_nodes SET
  title = 'Art and physical education',
  summary = 'Art and movement. Not exam subjects.',
  ask_prompt_default = 'How are art and physical education timetabled in Class 4?',
  lead = $cbse$[[lead]]
Art and movement stay on the plan. CBSE does not examine them.

[[ask-school]]
How many periods a week, and are they graded?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-art';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam.',
  ask_prompt_default = 'Who sets Class 4 tests, the school or CBSE?',
  lead = $cbse$[[lead]]
Class 4 has no CBSE exam. If there is a test, the school sets it.

[[ask-school]]
Do you hold Class 4 tests, and who sets them?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g4-board';

-- Class 5
UPDATE path_nodes SET
  summary = 'The full subject list. Science splits off next year.',
  ask_prompt_default = 'Which subjects are on my child''s Class 5 timetable?',
  lead = $cbse$[[lead]]
These are the Class 5 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Mathematics
- The world around us
- Art
- Physical education

[[note]]
WHAT CHANGES NEXT YEAR
In Class 6, this list changes. Science and Social Science become their own subjects. A third language is added. Class 5 does not have those yet.

[[ask-school]]
Which subjects are on my child's Class 5 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two languages. A third language is Class 6.',
  ask_prompt_default = 'Which two languages is Class 5 teaching?',
  lead = $cbse$[[lead]]
Two languages this year.

[[note]]
WHAT CHANGES NEXT YEAR
A third language becomes required in Class 6, from 2026. Some schools offer one early. Ask if yours does.

[[ask-school]]
Which two languages are on the timetable? Is a third language already offered?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'The last primary mathematics book.',
  ask_prompt_default = 'Which mathematics book is Class 5 using?',
  lead = $cbse$[[lead]]
The last primary mathematics book. Class 6 mathematics is a new book.

[[checks]]
What they learn
- Number work from the Class 5 book
- Fractions
- Measuring and shapes

[[ask-school]]
Which mathematics book is Class 5 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-math';

UPDATE path_nodes SET
  title = 'The world around us',
  summary = 'Still one subject. Science starts in Class 6.',
  ask_prompt_default = 'Will Science and Social Science start only in Class 6?',
  lead = $cbse$[[lead]]
Still one subject: places, living things, and people.

[[note]]
NEXT YEAR, NOT THIS YEAR
Class 6 splits this into Science and Social Science. Class 5 is not that split. The timetable may say EVS.

[[ask-school]]
What is this subject called on the Class 5 timetable?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-world';

UPDATE path_nodes SET
  title = 'Computational thinking',
  summary = 'Inside other subjects. A first look at AI starts in Class 6.',
  ask_prompt_default = 'Is this still inside other Class 5 subjects?',
  lead = $cbse$[[lead]]
Still inside the other subjects. Not its own exam.

[[note]]
NEXT YEAR
From Class 6, schools also give a first look at AI. That is also inside existing periods, not a board subject.

[[ask-school]]
Is this still inside other subjects in Class 5?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-ct';

UPDATE path_nodes SET
  title = 'Art and physical education',
  summary = 'Art and movement. Not exam subjects.',
  ask_prompt_default = 'What art and physical education does Class 5 keep?',
  lead = $cbse$[[lead]]
Art and movement stay on the plan. They are not CBSE exam subjects.

[[ask-school]]
What does Class 5 do for art and physical education?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-art';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam. The first board exam is Class 10.',
  ask_prompt_default = 'Is Class 5 a school exam only?',
  lead = $cbse$[[lead]]
Class 5 has no CBSE exam.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam. On this path, the first one is at the end of Class 10. A Class 5 school test is not that exam.

[[ask-school]]
Do you hold a Class 5 exam, and does CBSE see it?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g5-board';

-- Class 6
UPDATE path_nodes SET
  summary = 'The full list, including the new third language.',
  ask_prompt_default = 'Which third language did the school choose for Class 6?',
  lead = $cbse$[[lead]]
These are the Class 6 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Third language
- Mathematics
- Science
- Social Science
- Art
- Physical education
- Work and skills
- Computational thinking and a first look at AI, inside the classes above

[[note]]
WHAT CHANGED IN 2026
A third language is now required from Class 6. It must be different from the first two. In a school in India, at least two of the three languages are Indian languages. The school chooses which ones.

[[note]]
WORDS ON THIS PAGE
Science and Social Science are separate subjects from this year. They were one area, often called EVS, up to Class 5.

[[ask-school]]
Which three languages are on my child's timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6';

UPDATE path_nodes SET
  title = 'Three languages',
  summary = 'First, second, and a new third language.',
  ask_prompt_default = 'Which language is the third language in Class 6?',
  lead = $cbse$[[lead]]
Three languages. The third one is new for Class 6 from 2026.

[[checks]]
The three languages
- First language
- Second language, a different one
- Third language, different again

[[note]]
THE RULE
At least two of the three are Indian languages if the school is in India. One language cannot be counted twice. The school picks the names and records them.

[[ask-school]]
What are the three language names, and which books?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'The Class 6 mathematics book.',
  ask_prompt_default = 'Which mathematics book is Class 6 using?',
  lead = $cbse$[[lead]]
This is a new mathematics book, not the Class 5 book.

[[note]]
WHAT TO ASK FOR
The chapters are the ones in the Class 6 book the school was told to use. Ask for that book. A coaching list is not the official list.

[[ask-school]]
Which mathematics book is Class 6 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-math';

UPDATE path_nodes SET
  title = 'Science',
  summary = 'Its own subject from Class 6.',
  ask_prompt_default = 'Which science book is Class 6 using?',
  lead = $cbse$[[lead]]
Science is its own subject now. It is no longer inside "the world around us".

[[note]]
WHAT TO ASK FOR
The chapters are the Class 6 science book. Ask which book the school is using this year.

[[ask-school]]
Which science book is Class 6 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-sci';

UPDATE path_nodes SET
  title = 'Social Science',
  summary = 'History, geography, and civics in one subject.',
  ask_prompt_default = 'Is Social Science one period or three?',
  lead = $cbse$[[lead]]
History, geography, and civics, taught as Social Science.

[[note]]
WHAT MAY VARY
Some schools use one period. Some split history, geography, and civics across the week. It is still one Class 6 subject. It is not the Class 10 exam.

[[ask-school]]
How have you split Social Science across the week?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-sst';

UPDATE path_nodes SET
  title = 'Computational thinking and AI',
  summary = 'Inside other classes. Not an exam.',
  ask_prompt_default = 'In which subjects will Class 6 do this?',
  lead = $cbse$[[lead]]
A first look at patterns, steps, and AI. It sits inside classes your child already has.

[[note]]
WHAT THIS IS NOT
Not its own period. Not a device you must buy. Not a board exam.

[[ask-school]]
In which subjects will my child do this, and what will I see at home?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-ct';

UPDATE path_nodes SET
  title = 'Art, physical education, and work',
  summary = 'On the timetable. Not board exams.',
  ask_prompt_default = 'What art, sport, and work lessons are in Class 6?',
  lead = $cbse$[[lead]]
Art, physical education, and a first look at work are on the Class 6 plan.

[[note]]
WHAT THIS IS NOT
CBSE does not hold a board exam in these. The school chooses the activities.

[[ask-school]]
What exactly is on the timetable for art, sport, and work?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-other';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam. The board exam is Class 10.',
  ask_prompt_default = 'Do Class 6 marks leave the school?',
  lead = $cbse$[[lead]]
Class 6 has no CBSE exam. Tests, if any, stay with the school.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam at the end of Class 10. Class 6 marks are not sent to CBSE as a board result.

[[ask-school]]
How often do you test, and do those marks leave the school?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g6-board';

-- Class 7
UPDATE path_nodes SET
  summary = 'Every subject is listed. No public exam.',
  ask_prompt_default = 'Which subjects are on my child''s Class 7 timetable?',
  lead = $cbse$[[lead]]
These are the Class 7 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Third language
- Mathematics
- Science
- Social Science
- Art
- Physical education
- Work and skills
- Computational thinking and a first look at AI, inside the classes above

[[note]]
WHAT CHANGED
The new third-language books reach Class 7 in 2027-28. This year, ask which three languages are already on the timetable. None of the subjects above is dropped.

[[ask-school]]
Which subjects, and which three languages, are on the Class 7 timetable?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7';

UPDATE path_nodes SET
  title = 'Three languages',
  summary = 'First, second, and third language.',
  ask_prompt_default = 'Which three languages is Class 7 teaching?',
  lead = $cbse$[[lead]]
First language, second language, and third language.

[[note]]
WHAT CHANGED
New third-language books for Class 7 arrive in 2027-28. This year, use the languages already on the timetable. In a school in India, at least two of the three are Indian languages.

[[ask-school]]
What are the three language names this year?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'The Class 7 mathematics book.',
  ask_prompt_default = 'Which mathematics book is Class 7 using?',
  lead = $cbse$[[lead]]
The Class 7 mathematics book is the list of topics. A tuition sheet is not a second official list.

[[ask-school]]
Which mathematics book is Class 7 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-math';

UPDATE path_nodes SET
  title = 'Science',
  summary = 'The Class 7 science book.',
  ask_prompt_default = 'Which science book is Class 7 using?',
  lead = $cbse$[[lead]]
Science is its own subject. The chapters are the Class 7 science book for this session.

[[ask-school]]
Which science book is Class 7 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-sci';

UPDATE path_nodes SET
  title = 'Social Science',
  summary = 'History, geography, and civics.',
  ask_prompt_default = 'How is Class 7 Social Science split across the week?',
  lead = $cbse$[[lead]]
History, geography, and civics, in the Class 7 Social Science book.

[[note]]
WHAT THIS IS NOT
Not the Class 10 board syllabus.

[[ask-school]]
How is Social Science split across the week?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-sst';

UPDATE path_nodes SET
  title = 'Computational thinking and AI',
  summary = 'Inside other classes. Not an exam.',
  ask_prompt_default = 'Is this inside other subjects, or its own period?',
  lead = $cbse$[[lead]]
Still inside the other subjects. Not its own period and not an exam.

[[ask-school]]
Is this inside other subjects, or have you given it its own period?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-ct';

UPDATE path_nodes SET
  title = 'Art, physical education, and work',
  summary = 'On the timetable. Not board exams.',
  ask_prompt_default = 'What work or skill lesson is in Class 7?',
  lead = $cbse$[[lead]]
Art, physical education, and work are on the Class 7 plan. CBSE does not examine them.

[[ask-school]]
What work or skill lesson is on the timetable?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-other';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam.',
  ask_prompt_default = 'Do Class 7 marks go to CBSE?',
  lead = $cbse$[[lead]]
Class 7 has no CBSE exam. Marks stay with the school.

[[ask-school]]
Do these marks go anywhere outside the school?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g7-board';

-- Class 8
UPDATE path_nodes SET
  summary = 'Every subject is listed. No public exam.',
  ask_prompt_default = 'Which third language must my child pass by the end of Class 8?',
  lead = $cbse$[[lead]]
These are the Class 8 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- Third language
- Mathematics
- Science
- Social Science
- Art
- Physical education
- Work and skills
- Computational thinking and a first look at AI, inside the classes above

[[note]]
WHAT CHANGED
Your child should have studied three languages by the end of Class 8. If the third language is not passed, the school can test it again in Class 9, and again in Class 10, before the board exam. The newer third-language books reach Class 8 in 2028-29.

[[ask-school]]
Which third language is on the timetable, and what counts as a pass?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8';

UPDATE path_nodes SET
  title = 'Three languages',
  summary = 'All three should be done by the end of Class 8.',
  ask_prompt_default = 'Which third language must Class 8 students pass?',
  lead = $cbse$[[lead]]
First language, second language, and third language.

[[note]]
THE PASS
The third language must be passed at school by the end of Class 8. If it is not, the school tests it again in Class 9 or Class 10. It is not a Class 10 board paper for this batch. The newer books for this language reach Class 8 in 2028-29.

[[ask-school]]
Which third language, and what mark counts as a pass?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-lang';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'The Class 8 mathematics book. Class 9 is a new book.',
  ask_prompt_default = 'Which mathematics book is Class 8 using?',
  lead = $cbse$[[lead]]
The Class 8 mathematics book. Class 9 mathematics is a different book. Do not use the Class 9 book this year.

[[ask-school]]
Which mathematics book is Class 8 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-math';

UPDATE path_nodes SET
  title = 'Science',
  summary = 'The Class 8 science book.',
  ask_prompt_default = 'Which science book is Class 8 using?',
  lead = $cbse$[[lead]]
The Class 8 science book. Class 9 Science is a different course. A Class 9 guide is not this year's list.

[[ask-school]]
Which science book is Class 8 using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-sci';

UPDATE path_nodes SET
  title = 'Social Science',
  summary = 'History, geography, and civics.',
  ask_prompt_default = 'How is Class 8 Social Science taught?',
  lead = $cbse$[[lead]]
History, geography, and civics in the Class 8 book. The school marks it. It is not the Class 10 exam.

[[ask-school]]
How is Class 8 Social Science taught?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-sst';

UPDATE path_nodes SET
  title = 'Computational thinking and AI',
  summary = 'Inside other classes. A separate subject comes later.',
  ask_prompt_default = 'Is AI its own Class 8 subject?',
  lead = $cbse$[[lead]]
Still inside other classes. Not its own subject.

[[note]]
LATER, NOT THIS YEAR
CBSE brings Computational Thinking and AI in as its own subject from 2027-28, starting in Class 9. Class 8 is not that year.

[[ask-school]]
Is this inside other subjects, or its own period?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-ct';

UPDATE path_nodes SET
  title = 'Art, physical education, and work',
  summary = 'On the timetable. Not board exams.',
  ask_prompt_default = 'What skill or work lesson is in Class 8?',
  lead = $cbse$[[lead]]
Art, physical education, and work. The school may mark them. CBSE does not examine them.

[[ask-school]]
What skill or work lesson is on the Class 8 timetable?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-other';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'No CBSE exam. Class 10 is the board exam.',
  ask_prompt_default = 'Is the Class 8 exam only a school exam?',
  lead = $cbse$[[lead]]
Class 8 has no CBSE exam.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam at the end of Class 10. A Class 8 school test does not choose Class 11 subjects.

[[ask-school]]
Is your Class 8 exam only a school exam?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g8-board';

-- Class 9
UPDATE path_nodes SET
  summary = 'The subject list, and the exam rules that changed in 2026.',
  ask_prompt_default = 'Which subjects will continue from Class 9 into Class 10?',
  lead = $cbse$[[lead]]
These are the Class 9 subjects. The exam this year is set by the school, not by CBSE.

[[checks]]
Subjects this year
- First language
- Second language
- Third language
- Mathematics
- Science
- Social Science
- Art
- Physical education
- Work and skills
- Individual in Society, when the textbook is out
- Mathematics Advanced, only if you opt in
- Science Advanced, only if you opt in

[[compare]]
Before this change | Class 9 from 2026-27
Two languages | Two languages, plus a third language the school marks
Maths Basic or Standard was a Class 10 choice | Every child studies the same maths. Advanced is an optional extra
One science course | Every child studies the same science. Advanced is an optional extra
The school sets the Class 9 exam | The school still sets the Class 9 exam

[[note]]
WORDS ON THIS PAGE
Board exam means the public exam CBSE holds at the end of Class 10. Class 9 is not that exam.
Advanced means extra topics and an extra short paper. Those marks are not added to the total.
Take in Class 9 only what your child will keep in Class 10. The school should say which subjects carry on.

[[ask-school]]
Which languages is my child taking, and do you offer Advanced maths or Advanced science?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Two different languages. The school names them.',
  ask_prompt_default = 'Which languages are the first and second in Class 9?',
  lead = $cbse$[[lead]]
Two main languages. They must be different from each other.

[[note]]
WHAT MAY VARY
The school chooses them from the CBSE language list. The book can be the same and the test still different. In a school in India, at least two of the three languages are Indian languages.

[[ask-school]]
Which language is first, which is second, and which books?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-lang';

UPDATE path_nodes SET
  title = 'Third language',
  summary = 'Required. The school marks it. It is not a board paper.',
  ask_prompt_default = 'Which third language, and which book, in Class 9?',
  lead = $cbse$[[lead]]
A third language is required from 2026-27. The school marks it. CBSE does not set a board paper for it.

[[checks]]
This year's book
- The Class 6 book for that language
- Plus one local story, poem, or other short text

[[note]]
WHY A CLASS 6 BOOK
CBSE is bringing this in step by step. This Class 9 batch uses the Class 6 book. Passing it is required before CBSE issues the Class 10 pass certificate. Not passing it does not, by itself, stop the admit card for the other subjects.

[[ask-school]]
Which third language, which book, and how do you mark it?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-r3';

UPDATE path_nodes SET
  title = 'Mathematics',
  summary = 'The same course for everyone. Advanced is optional.',
  ask_prompt_default = 'Do you offer Mathematics Advanced in Class 9?',
  lead = $cbse$[[lead]]
Every child studies the same mathematics course and sits that paper.

[[compare]]
Standard, for everyone | Advanced, only if you opt in
The Class 9 course | Extra topics beyond that course
School exam, 80 marks, 3 hours | An extra short paper
Counts in the result | Does not get added to the total

[[note]]
WHAT THIS REPLACES
Maths Basic and Maths Standard were the old Class 10 choice. They are not the Class 9 choice from 2026-27. Ask if the school offers Advanced. This page does not sign your child up.

[[ask-school]]
Is Mathematics Advanced offered, and what does my child study if we say no?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-math';

UPDATE path_nodes SET
  title = 'Science',
  summary = 'Four areas. Advanced is optional.',
  ask_prompt_default = 'Do you offer Science Advanced in Class 9?',
  lead = $cbse$[[lead]]
Every child studies the same science course.

[[checks]]
The four areas
- Living things
- Matter, and how it behaves
- Motion, force, work, and sound
- Earth as a system

[[note]]
ADVANCED
Science Advanced is an optional extra paper. Those marks are not added to the total. The school has to offer it before you can opt in.

[[ask-school]]
Do you offer Science Advanced, and which of the four areas takes the most time?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-sci';

UPDATE path_nodes SET
  title = 'Social Science',
  summary = 'History, geography, and civics. It carries into Class 10.',
  ask_prompt_default = 'How is Class 9 Social Science split?',
  lead = $cbse$[[lead]]
History, geography, and civics. This subject is meant to continue in Class 10.

[[note]]
THIS YEAR'S EXAM
The school sets the Class 9 exam. The CBSE board paper is next year, on the Class 10 course.

[[ask-school]]
How have you split history, geography, and civics?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-sst';

UPDATE path_nodes SET
  title = 'Individual in Society',
  summary = 'A new subject. Only when the textbook is out.',
  ask_prompt_default = 'Has Individual in Society started, or are you waiting for the book?',
  lead = $cbse$[[lead]]
A new subject about people and society. It starts when the NCERT textbook is available.

[[note]]
IF THE BOOK IS NOT HERE
The school should not invent a stand-in syllabus. Ask whether the book has arrived.

[[ask-school]]
Has this subject started, and which book are you using?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-society';

UPDATE path_nodes SET
  title = 'Art, physical education, and work',
  summary = 'Required at school. Not board papers.',
  ask_prompt_default = 'How do you mark art, physical education, and work in Class 9?',
  lead = $cbse$[[lead]]
Art, physical education, and work are required. The school marks them. They are not board papers.

[[note]]
AN EXTRA SUBJECT
A further academic subject is possible only if this school offers it.

[[ask-school]]
How do you mark art, physical education, and work?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-other';

UPDATE path_nodes SET
  title = 'Exams',
  summary = 'A school exam. Not the CBSE board exam.',
  ask_prompt_default = 'What share of the Class 9 mark is classwork, and what share is the final paper?',
  lead = $cbse$[[lead]]
The school sets this exam. CBSE does not.

[[checks]]
Both parts are required
- Classwork and projects through the year
- A final paper set by the school
- Main papers are 80 marks and 3 hours

[[note]]
NOT THE BOARD EXAM
The board exam is at the end of Class 10, on the Class 10 syllabus. Computational Thinking and AI become their own subject in 2027-28, not this year.

[[ask-school]]
What share is classwork, and what share is the final paper?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-exam';

UPDATE path_nodes SET
  title = 'Computational thinking and AI',
  summary = 'Not a Class 9 subject yet. It starts in 2027-28.',
  ask_prompt_default = 'Have you started this early in Class 9?',
  lead = $cbse$[[lead]]
Not a Class 9 subject this year.

[[note]]
WHEN IT STARTS
CBSE adds it for Classes 9 to 12 in 2027-28. If your school has started activities early, those are the school's activities. They are not a board subject.

[[ask-school]]
Have you started anything early, and does it count in the mark?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g9-ct';

-- Class 10
UPDATE path_nodes SET
  summary = 'Board subjects for this batch, then the choices after Class 10.',
  ask_prompt_default = 'Which board subjects is my child registered for?',
  lead = $cbse$[[lead]]
These are the Class 10 board subjects for children sitting the exam this year.

[[checks]]
Board subjects
- First language
- Second language
- Mathematics Standard or Mathematics Basic
- Science
- Social Science

[[checks]]
The school records these. They are not board papers.
- Third language, already passed at school
- Art
- Health and physical education
- Work experience
- Up to two extra subjects, only if the school registered them

[[compare]]
This Class 10 batch | The Class 9 batch behind them
Maths Standard or Maths Basic | The same maths for everyone, plus optional Advanced
Third language is a school pass, not a board paper | Third language is still a school pass
Five board subjects | Five board subjects

[[note]]
WORDS ON THIS PAGE
Board exam means the public exam CBSE sets this year. You need the classwork marks and the board paper. Missing either one means that subject is not complete.
Standard maths is the paper if maths may continue after Class 10. Basic maths is the paper if it will not. This is the last Class 10 batch that can choose Basic.
Class 10 is not Class 12. The choices after this exam are further down the page.

[[ask-school]]
Which maths paper is my child registered for, Standard or Basic?

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10';

UPDATE path_nodes SET
  title = 'First and second language',
  summary = 'Both are board subjects.',
  ask_prompt_default = 'Which two languages is my child registered for?',
  lead = $cbse$[[lead]]
Both languages are board subjects. The school registers the names.

[[ask-school]]
Which two languages is my child registered for?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-lang';

UPDATE path_nodes SET
  title = 'Mathematics Standard or Basic',
  summary = 'This batch still chooses. The next batch does not.',
  ask_prompt_default = 'Is my child registered for Standard or Basic?',
  lead = $cbse$[[lead]]
This Class 10 batch still chooses one maths paper.

[[compare]]
Standard | Basic
The usual paper if maths may continue in Class 11 | The core paper if maths will not continue
Still available this year | Still available this year, for this batch only

[[note]]
THE NEXT BATCH
From 2026-27, new Class 9 students do not get Basic or Standard. They all study the same course, and Advanced is an optional extra. Your Class 10 child is not on that new rule.

[[ask-school]]
Which paper is my child registered for? This page does not change it.
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-math';

UPDATE path_nodes SET
  title = 'Science',
  summary = 'A board subject.',
  ask_prompt_default = 'How is the Class 10 science course split across the year?',
  lead = $cbse$[[lead]]
Science is a board subject. The list is the Class 10 science course for this session.

[[checks]]
Both parts are required
- Classwork marks from the school
- The CBSE board paper

[[ask-school]]
How have you split the science course across the year?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-sci';

UPDATE path_nodes SET
  title = 'Social Science',
  summary = 'A board subject. History, geography, civics, and economics.',
  ask_prompt_default = 'How is Class 10 Social Science divided?',
  lead = $cbse$[[lead]]
History, geography, civics, and economics. This is one of the five board subjects.

[[ask-school]]
How have you divided Social Science before the board exam?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-sst';

UPDATE path_nodes SET
  title = 'Extra board subjects',
  summary = 'Up to two more, only if the school registered them.',
  ask_prompt_default = 'Is my child taking a sixth board subject?',
  lead = $cbse$[[lead]]
Five subjects are compulsory. Up to two more can be added.

[[checks]]
The five compulsory board subjects
- First language
- Second language
- Mathematics
- Science
- Social Science

[[note]]
THE EXTRA ONES
A skill subject, or another subject the school offers, can be an extra board paper. The school has to register it. This page does not add a subject.

[[ask-school]]
Is my child registered for a sixth subject? What is it called?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-extra';

UPDATE path_nodes SET
  title = 'Third language',
  summary = 'A school pass. Not a board paper for this batch.',
  ask_prompt_default = 'Has my child already passed the third language at school?',
  lead = $cbse$[[lead]]
For this Class 10 batch, the third language is not a board paper. It still has to be passed at school.

[[note]]
IF IT WAS NOT PASSED EARLIER
The school can test it in Class 9, and again in Class 10. CBSE does not give the board admit card until that school pass is done.

[[ask-school]]
Has my child passed the third language, and which language was it?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-r3';

UPDATE path_nodes SET
  title = 'Art, health, and work',
  summary = 'The school records them. They are not board papers.',
  ask_prompt_default = 'How are art, health, and work recorded for Class 10?',
  lead = $cbse$[[lead]]
The school records these. They are not board papers, and they still have to be completed.

[[checks]]
What the school records
- Art
- Health and physical education
- Work experience, recorded with health and physical education

[[ask-school]]
How are these recorded, and are they already complete?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-internal';

UPDATE path_nodes SET
  title = 'The board exam',
  summary = 'CBSE sets it. Classwork marks are also required.',
  ask_prompt_default = 'What has the school said about classwork marks and the board paper?',
  lead = $cbse$[[lead]]
CBSE sets the board paper on this year's Class 10 course.

[[checks]]
Both parts are required
- Classwork marks from the school
- The board paper
- Missing either one means that subject is not complete

[[note]]
WHAT CLASS 10 IS NOT
Class 10 is the end of this stage of school. It is not Class 12. It does not choose Class 11 subjects by itself.

[[ask-school]]
What has the school said about classwork marks and the board paper?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-board';

UPDATE path_nodes SET
  title = 'After Class 10',
  summary = 'The choices for the next two years. Opening one does not pick it.',
  ask_prompt_default = 'What helped you compare staying in CBSE with switching?',
  sort_order = 90,
  lead = $cbse$[[lead]]
These are the choices after the Class 10 exam. Opening one does not pick it.

[[checks]]
The choices
- Stay in CBSE for Classes 11 and 12
- Switch to Cambridge A Level
- Switch to the IB Diploma
- Switch to ISC
- Polytechnic diploma, in Telangana
- Not sure yet

[[note]]
WHAT CLASS 10 IS NOT
Class 10 is not Class 12. The next school has to offer the course. Most families stay in CBSE.

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-g10-after';

UPDATE path_nodes SET
  summary = 'Classes 11 and 12 on CBSE. The school offers the subject groups.',
  ask_prompt_default = 'How did your child choose Class 11 subjects?',
  lead = $cbse$[[lead]]
Most families stay on CBSE for Classes 11 and 12.

[[checks]]
Names parents use
- PCM
- PCB
- PCMB
- Commerce
- Arts

[[note]]
WHAT THESE NAMES MEAN
They are groups of subjects the school offers. They are not a fixed CBSE law. Class 12 is the usual qualifying exam for college entrances in India. The rules for that year still apply.

[[ask-school]]
Which Class 11 groups does this school offer?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-stay';

UPDATE path_nodes SET
  summary = 'Another board. The new school must teach it.',
  lead = $cbse$[[lead]]
A different board after Class 10. The new school must teach that course. A Class 10 marksheet does not move your child across by itself.

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-switch';

UPDATE path_nodes SET
  summary = 'Usually 3 or 4 subjects. A Level can count as Class 12.',
  ask_prompt_default = 'What was hardest about leaving CBSE for A Level?',
  lead = $cbse$[[lead]]
Cambridge A Level is usually 3 or 4 subjects. It can count as Class 12. Class 10 does not.

[[ask-school]]
Does the new school offer A Level, and which subjects?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-to-alevel';

UPDATE path_nodes SET
  summary = 'Six subjects plus a core. Class 10 is not Class 12.',
  ask_prompt_default = 'What did you check first before moving from CBSE to the IB Diploma?',
  lead = $cbse$[[lead]]
The IB Diploma is two years. It has six subjects plus a core. Finishing it can count as Class 12. Class 10 by itself does not.

[[ask-school]]
Does the school offer the Diploma, and which subjects?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-to-dp';

UPDATE path_nodes SET
  summary = 'Classes 11 and 12 on ISC. The school must offer it.',
  ask_prompt_default = 'Why did you move from CBSE to ISC?',
  lead = $cbse$[[lead]]
ISC is Classes 11 and 12 on a different board. Only a school that teaches ISC can place your child on it.

[[ask-school]]
Does the school teach ISC?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-to-isc';

UPDATE path_nodes SET
  summary = 'Telangana only. An engineering diploma after Class 10.',
  ask_prompt_default = 'Did diploma-then-ECET feel like a real engineering path?',
  lead = $cbse$[[lead]]
In Telangana, POLYCET is the entrance to an engineering diploma after Class 10.

[[note]]
WHAT THIS IS NOT
Not an MBBS seat. Not EAPCET. A later ECET can be a route into B.Tech. Andhra Pradesh uses a different entrance, so this row is Telangana only.

[[ask-school]]
Is this the route you mean, and is it offered where you live?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-poly';

UPDATE path_nodes SET
  summary = 'Read the choices. Nothing here picks one.',
  ask_prompt_default = 'What helped you compare staying and switching?',
  lead = $cbse$[[lead]]
You can read the choices and not pick one.

[[note]]
NOTHING CHANGES
Opening this page does not change your child's board, class, or group.

[[ask-school]]
What helped you compare staying in CBSE with switching?
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-unsure';

UPDATE path_nodes SET sort_order = 80, updated_at = now()
WHERE slug ~ '^cbse-g(1|2|3|4|5|6|7|8|10)-board$'
   OR slug = 'cbse-g9-exam';

UPDATE path_nodes SET sort_order = 75, updated_at = now()
WHERE slug = 'cbse-g9-ct';

UPDATE path_nodes SET sort_order = CASE slug
  WHEN 'cbse-g10-lang' THEN 10
  WHEN 'cbse-g10-math' THEN 20
  WHEN 'cbse-g10-sci' THEN 30
  WHEN 'cbse-g10-sst' THEN 40
  WHEN 'cbse-g10-extra' THEN 50
  WHEN 'cbse-g10-r3' THEN 60
  WHEN 'cbse-g10-internal' THEN 70
  WHEN 'cbse-g10-board' THEN 80
  WHEN 'cbse-g10-after' THEN 90
  ELSE sort_order
END,
updated_at = now()
WHERE slug IN (
  'cbse-g10-lang','cbse-g10-math','cbse-g10-sci','cbse-g10-sst',
  'cbse-g10-extra','cbse-g10-r3','cbse-g10-internal','cbse-g10-board',
  'cbse-g10-after'
);

COMMIT;
