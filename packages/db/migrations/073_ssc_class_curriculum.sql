-- SSC (Telangana / Andhra Pradesh) Classes 1–10.
-- Subject map follows the Telangana SCERT textbook list for 2025-26.
-- Class 10 keeps the existing after-SSC routes.
-- Same visual blocks as the CBSE and IB paths. Safe to re-run.

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
SELECT path_put_node('ssc-g1', NULL, 'root', 'This year', NULL,
  'Four subjects. No public exam.',
  'Which languages are on my child''s Class 1 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 1 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics

[[note]]
WORDS ON THIS PAGE
SSC here means the Telangana or Andhra Pradesh state board.
First language is the main language of the school: Telugu, English, Urdu, or Hindi.
Second language is another Indian language. English is listed on its own.
There is no Environmental Science textbook in Class 1. That starts in Class 3.
Telangana and Andhra Pradesh each print their own books. Ask which state your school uses.

[[ask-school]]
Which languages are on my child's Class 1 timetable, and which state's books do you use?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g1-lang1', 'ssc-g1', 'topic', 'First language', NULL,
  'The main language of the school.',
  'What is the first language in Class 1?',
  10, '{}', NULL,
  $cbse$[[lead]]
This is the main language the school teaches in.

[[checks]]
What they learn
- Listening and speaking
- Starting to read
- Starting to write

[[example]]
ONE EXAMPLE
The teacher tells a short story in Telugu, or in the school's language, and your child says who was in it.

[[note]]
WHAT MAY VARY
Telugu-medium schools use Telugu. English-medium schools often use a special English or the language the state prescribes. Urdu-medium and Hindi-medium schools use those. Ask for the name on the timetable.

[[ask-school]]
What is the first language called, and which book?
$cbse$);

SELECT path_put_node('ssc-g1-lang2', 'ssc-g1', 'topic', 'Second language', NULL,
  'Another Indian language. Not a copy of the first.',
  'What is the second language in Class 1?',
  20, '{}', NULL,
  $cbse$[[lead]]
A second Indian language, different from the first.

[[checks]]
What they learn
- A few spoken words
- Starting to recognise letters
- Songs or short lines in that language

[[example]]
ONE EXAMPLE
In a Telugu-medium school the second language is often Hindi. In an English-medium school it is often Telugu. Your school may differ.

[[note]]
WHAT MAY VARY
The state allows more than one second language. The school chooses. One language cannot be counted as both first and second.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g1-lang-en', 'ssc-g1', 'topic', 'English', NULL,
  'Its own subject, even when the school teaches in English.',
  'Which English book is Class 1 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is its own subject on the Class 1 list.

[[checks]]
What they learn
- Listening to simple English
- A few spoken sentences
- Starting to recognise words

[[example]]
ONE EXAMPLE
Point to a picture of a cat and say the English word.

[[note]]
WHAT MAY VARY
If the school already teaches in English, this class is still on the timetable. Ask whether it is the same book as the first language or a different one.

[[ask-school]]
Which English book is Class 1 using?
$cbse$);

SELECT path_put_node('ssc-g1-math', 'ssc-g1', 'topic', 'Mathematics', NULL,
  'Counting, shapes, and patterns.',
  'Which mathematics book is Class 1 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
Counting, shapes, and patterns, with objects the child can hold.

[[checks]]
What they learn
- Counting
- Shapes
- Simple patterns
- More and less

[[example]]
ONE EXAMPLE
Count 8 buttons and point to the pile that has more.

[[note]]
WHAT MAY VARY
Telangana schools use the Telangana Class 1 mathematics book. Andhra Pradesh schools use the Andhra Pradesh book.

[[ask-school]]
Which mathematics book is Class 1 using, and which state printed it?
$cbse$);

SELECT path_put_node('ssc-g1-board', 'ssc-g1', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'How will you tell me how my child is doing in Class 1?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 1 has no public SSC exam.

[[checks]]
What the school may do
- Watch your child in class
- Look at classwork
- Sometimes give a short test

[[example]]
ONE EXAMPLE
The teacher notes that your child can count to 20. That note stays at the school. The state board does not collect it.

[[note]]
WHAT THIS IS NOT
The public SSC exam is the Class 10 exam. A Class 1 mark is not that.

[[ask-school]]
How will you tell me how my child is doing this year?
$cbse$);

-- Class 2
SELECT path_put_node('ssc-g2', NULL, 'root', 'This year', NULL,
  'Four subjects. No public exam.',
  'Which languages are on my child''s Class 2 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 2 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics

[[note]]
WORDS ON THIS PAGE
Reading and number work are longer than in Class 1.
Environmental Science is still not a textbook this year. It starts in Class 3.
Ask which state prints the books: Telangana or Andhra Pradesh.

[[ask-school]]
Which languages are on my child's Class 2 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g2-lang1', 'ssc-g2', 'topic', 'First language', NULL,
  'The main language. More reading than Class 1.',
  'What is the first language in Class 2?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language of the school, with more reading than Class 1.

[[checks]]
What they learn
- Longer listening
- Short reading
- A few written words

[[example]]
ONE EXAMPLE
Read a three-line rhyme and say what it was about.

[[note]]
WHAT MAY VARY
The language name depends on the medium: Telugu, English, Urdu, or Hindi.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g2-lang2', 'ssc-g2', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 2?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language. It stays different from the first.

[[checks]]
What they learn
- More spoken lines
- Starting to read letters and words
- A short song or rhyme

[[example]]
ONE EXAMPLE
Sing a short rhyme in the second language and point to the words.

[[note]]
WHAT MAY VARY
Ask if it is the same second language as Class 1.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g2-lang-en', 'ssc-g2', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 2 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English stays its own subject.

[[checks]]
What they learn
- Simple spoken sentences
- A few written words
- Picture words from the book

[[example]]
ONE EXAMPLE
Match four picture cards to four English words.

[[note]]
WHAT MAY VARY
Ask whether this book is different from the first-language book.

[[ask-school]]
Which English book is Class 2 using?
$cbse$);

SELECT path_put_node('ssc-g2-math', 'ssc-g2', 'topic', 'Mathematics', NULL,
  'Bigger numbers, adding, and taking away.',
  'Which mathematics book is Class 2 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
Bigger numbers, adding, taking away, and shapes.

[[checks]]
What they learn
- Numbers past the first counting
- Adding and taking away
- Shapes

[[example]]
ONE EXAMPLE
There are 12 pencils. 4 are given away. How many are left?

[[note]]
WHAT MAY VARY
Use the Class 2 book from your state, not a Class 3 book.

[[ask-school]]
Which mathematics book is Class 2 using?
$cbse$);

SELECT path_put_node('ssc-g2-board', 'ssc-g2', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'What will you send home for Class 2?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 2 has no public SSC exam.

[[checks]]
What you may receive
- A note from the teacher
- A look at classwork
- A school report

[[example]]
ONE EXAMPLE
The report says your child can read a short page. That report is the school's. It is not an SSC memo.

[[note]]
WHAT THIS IS NOT
An SSC memo is the Class 10 result. Class 2 does not have one.

[[ask-school]]
What will you send home, and when?
$cbse$);

-- Class 3
SELECT path_put_node('ssc-g3', NULL, 'root', 'This year', NULL,
  'Five subjects. Environmental Science starts.',
  'Which subjects are on my child''s Class 3 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 3 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Environmental Science

[[note]]
WHAT CHANGED FROM CLASS 2
Environmental Science is a textbook from Class 3. Classes 1 and 2 did not have it.
The timetable may say EVS. That is this subject.

[[ask-school]]
Which subjects are on my child's Class 3 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g3-lang1', 'ssc-g3', 'topic', 'First language', NULL,
  'The main language. Longer reading.',
  'What is the first language in Class 3?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language, with longer reading than Class 2.

[[checks]]
What they learn
- Reading a short passage
- Writing a few sentences
- Speaking in class

[[example]]
ONE EXAMPLE
Read a page from the first-language book and say what happened.

[[note]]
WHAT MAY VARY
The language follows the school medium.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g3-lang2', 'ssc-g3', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 3?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- Short reading
- A few written lines
- Speaking in that language

[[example]]
ONE EXAMPLE
Copy four words from the second-language book and read them aloud.

[[note]]
WHAT MAY VARY
Ask if it is Hindi, Telugu, Sanskrit, or another language the state allows.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g3-lang-en', 'ssc-g3', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 3 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English stays its own subject.

[[checks]]
What they learn
- Reading a short English paragraph
- Writing a few sentences
- Speaking in class

[[example]]
ONE EXAMPLE
Read four English lines and answer one question in a sentence.

[[note]]
WHAT MAY VARY
Ask for the Class 3 English book from your state.

[[ask-school]]
Which English book is Class 3 using?
$cbse$);

SELECT path_put_node('ssc-g3-math', 'ssc-g3', 'topic', 'Mathematics', NULL,
  'More written sums than Class 2.',
  'Which mathematics book is Class 3 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
Number work and measuring, with more writing than in Class 2.

[[checks]]
What they learn
- Adding and taking away with bigger numbers
- Shapes
- Measuring length

[[example]]
ONE EXAMPLE
Measure the desk with a scale and write the number.

[[note]]
WHAT MAY VARY
The chapters are the Class 3 mathematics book. A tuition sheet is not a second list.

[[ask-school]]
Which mathematics book is Class 3 using?
$cbse$);

SELECT path_put_node('ssc-g3-world', 'ssc-g3', 'topic', 'Environmental Science', NULL,
  'New this year. Some schools say EVS.',
  'Do you call this EVS or Environmental Science?',
  50, '{}', NULL,
  $cbse$[[lead]]
Places, plants, animals, food, and water. This is its own subject from Class 3.

[[checks]]
What they learn
- The world around the child
- Plants, animals, food, and water
- How people live nearby

[[example]]
ONE EXAMPLE
Draw where drinking water comes from at home.

[[note]]
WHAT THIS IS NOT
Not General Science. Not Social Studies. Those start in Class 6. The timetable may say EVS.

[[ask-school]]
What name is on the timetable, and which book are you using?
$cbse$);

SELECT path_put_node('ssc-g3-board', 'ssc-g3', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'What report will you send for Class 3?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 3 has no public SSC exam.

[[checks]]
What the school may send
- A school test
- Classwork
- A report

[[example]]
ONE EXAMPLE
A Class 3 test mark stays in the school. It does not become an SSC memo.

[[note]]
WHAT THIS IS NOT
The public exam is in Class 10.

[[ask-school]]
What report will you send home?
$cbse$);

-- Class 4
SELECT path_put_node('ssc-g4', NULL, 'root', 'This year', NULL,
  'The same five subjects, with longer reading.',
  'Which subjects are on my child''s Class 4 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 4 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Environmental Science

[[note]]
WHAT THIS YEAR IS
General Science and Social Studies are not separate yet. Those start in Class 6.
Environmental Science is still the one book for the world around the child.

[[ask-school]]
Which subjects are on my child's Class 4 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g4-lang1', 'ssc-g4', 'topic', 'First language', NULL,
  'The main language. A short paragraph.',
  'What is the first language in Class 4?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language. Children write more than in Class 3.

[[checks]]
What they learn
- A longer passage
- A short paragraph
- Speaking in class

[[example]]
ONE EXAMPLE
Read a passage and write four lines about it.

[[note]]
WHAT MAY VARY
The language follows the school medium.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g4-lang2', 'ssc-g4', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 4?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- Short reading
- A few written lines
- Speaking

[[example]]
ONE EXAMPLE
Write three sentences in the second language about a picture.

[[note]]
WHAT MAY VARY
Ask which language and which book the school chose.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g4-lang-en', 'ssc-g4', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 4 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English stays its own subject.

[[checks]]
What they learn
- A short paragraph
- Answers in sentences
- Speaking in class

[[example]]
ONE EXAMPLE
Read a short English story and write two sentences about the ending.

[[note]]
WHAT MAY VARY
Ask for the Class 4 English book from your state.

[[ask-school]]
Which English book is Class 4 using?
$cbse$);

SELECT path_put_node('ssc-g4-math', 'ssc-g4', 'topic', 'Mathematics', NULL,
  'Bigger sums, and the start of fractions.',
  'Which mathematics book is Class 4 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
Bigger calculations, measuring, and the first fractions.

[[checks]]
What they learn
- Bigger addition and subtraction
- A half and other simple fractions
- Measuring

[[example]]
ONE EXAMPLE
Fold a paper in half and say what one half means.

[[note]]
WHAT MAY VARY
Ask for the Class 4 book. A tuition sheet is not a second official list.

[[ask-school]]
Which mathematics book is Class 4 using?
$cbse$);

SELECT path_put_node('ssc-g4-world', 'ssc-g4', 'topic', 'Environmental Science', NULL,
  'Still one subject. Not Science and Social yet.',
  'Is Class 4 still Environmental Science?',
  50, '{}', NULL,
  $cbse$[[lead]]
Places, living things, and people. Still one subject.

[[checks]]
What they learn
- Places beyond the street
- Plants and animals
- How people live

[[example]]
ONE EXAMPLE
Pick one animal from the book and say where it lives and what it eats.

[[note]]
WHAT THIS IS NOT
Not General Science. Not Social Studies. Those are Class 6 subjects.

[[ask-school]]
What is this subject called, and which book?
$cbse$);

SELECT path_put_node('ssc-g4-board', 'ssc-g4', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'Who sets Class 4 tests?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 4 has no public SSC exam. If there is a test, the school sets it.

[[checks]]
What a school test is
- Set by the teacher
- Kept at the school
- Not an SSC result

[[example]]
ONE EXAMPLE
A mid-year Class 4 paper does not become an SSC memo.

[[note]]
WHAT THIS IS NOT
The state board does not examine Class 4.

[[ask-school]]
Do you hold Class 4 tests, and who sets them?
$cbse$);

-- Class 5
SELECT path_put_node('ssc-g5', NULL, 'root', 'This year', NULL,
  'The last year before Science and Social Studies split off.',
  'Which subjects are on my child''s Class 5 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 5 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Environmental Science

[[note]]
NEXT YEAR, NOT THIS YEAR
In Class 6, Environmental Science is replaced by General Science and Social Studies.
The first public SSC exam is still Class 10.

[[ask-school]]
Which subjects are on my child's Class 5 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g5-lang1', 'ssc-g5', 'topic', 'First language', NULL,
  'The main language.',
  'What is the first language in Class 5?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language of the school.

[[checks]]
What they learn
- A full page
- A short paragraph
- Speaking clearly

[[example]]
ONE EXAMPLE
Read one page and write five lines about it.

[[note]]
WHAT MAY VARY
The language follows the medium.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g5-lang2', 'ssc-g5', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 5?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- A short passage
- A few written lines
- Speaking

[[example]]
ONE EXAMPLE
Read a short lesson and answer two oral questions.

[[note]]
WHAT MAY VARY
Ask which language the school has chosen for Class 5.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g5-lang-en', 'ssc-g5', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 5 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English stays its own subject.

[[checks]]
What they learn
- A page of English
- Short written answers
- Speaking in class

[[example]]
ONE EXAMPLE
Read one page and write five lines in English about it.

[[note]]
WHAT MAY VARY
Ask for the Class 5 English book from your state.

[[ask-school]]
Which English book is Class 5 using?
$cbse$);

SELECT path_put_node('ssc-g5-math', 'ssc-g5', 'topic', 'Mathematics', NULL,
  'The last primary mathematics book.',
  'Which mathematics book is Class 5 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
The Class 5 mathematics book. Class 6 mathematics is a new book.

[[checks]]
What they learn
- Number work from the Class 5 book
- Fractions
- Measuring

[[example]]
ONE EXAMPLE
Share 12 sweets among 4 children and say what share each child gets.

[[note]]
WHAT MAY VARY
Do not start the Class 6 book unless the school says so.

[[ask-school]]
Which mathematics book is Class 5 using?
$cbse$);

SELECT path_put_node('ssc-g5-world', 'ssc-g5', 'topic', 'Environmental Science', NULL,
  'The last year of this one subject.',
  'Is Class 5 still Environmental Science?',
  50, '{}', NULL,
  $cbse$[[lead]]
Still one subject: places, living things, and people.

[[checks]]
What they learn
- A simple map
- Living things
- How a neighbourhood works

[[example]]
ONE EXAMPLE
Look at a simple map and point to the school.

[[note]]
NEXT YEAR
Class 6 replaces this with General Science and Social Studies.

[[ask-school]]
What is this subject called on the Class 5 timetable?
$cbse$);

SELECT path_put_node('ssc-g5-board', 'ssc-g5', 'topic', 'Exams', NULL,
  'No public SSC exam. The first one is Class 10.',
  'Does CBSE or the state board see the Class 5 marks?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 5 has no public SSC exam.

[[checks]]
What this year is
- School tests, if the school holds them
- A report you can ask for
- Not an SSC memo

[[example]]
ONE EXAMPLE
Some schools hold a bigger test before Class 6. The state board does not mark it.

[[note]]
WORDS ON THIS PAGE
The public SSC exam is at the end of Class 10.

[[ask-school]]
Do you hold a Class 5 exam, and does the state board see it?
$cbse$);

-- Class 6
SELECT path_put_node('ssc-g6', NULL, 'root', 'This year', NULL,
  'Six subjects. Science and Social Studies start.',
  'Which subjects are on my child''s Class 6 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 6 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- General Science
- Social Studies

[[note]]
WHAT CHANGED FROM CLASS 5
Environmental Science is replaced by two subjects: General Science, and Social Studies.
General Science is still one book. Physical Science and Biological Science become separate books in Class 8.

[[ask-school]]
Which subjects are on my child's Class 6 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g6-lang1', 'ssc-g6', 'topic', 'First language', NULL,
  'The main language.',
  'What is the first language in Class 6?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language of the school.

[[checks]]
What they learn
- Prose and poetry from the Class 6 book
- Writing a short answer
- Grammar the book sets

[[example]]
ONE EXAMPLE
Read one lesson and write a short answer in that language.

[[note]]
WHAT MAY VARY
Telugu, English, Urdu, or Hindi, matching the medium.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g6-lang2', 'ssc-g6', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 6?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language on the timetable.

[[checks]]
What they learn
- The Class 6 second-language book
- Short writing
- Speaking

[[example]]
ONE EXAMPLE
In many Telugu-medium schools this is Hindi. In many English-medium schools this is Telugu. Ask yours.

[[note]]
WHAT MAY VARY
The school chooses from the languages the state allows.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g6-lang-en', 'ssc-g6', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 6 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is its own subject, separate from the first and second languages.

[[checks]]
What they learn
- The Class 6 English book
- Short writing
- Speaking in class

[[example]]
ONE EXAMPLE
Read a lesson and answer two questions in English sentences.

[[note]]
WHAT MAY VARY
On the Class 10 memo, English is the third language. In Class 6 it is already its own subject.

[[ask-school]]
Which English book is Class 6 using?
$cbse$);

SELECT path_put_node('ssc-g6-math', 'ssc-g6', 'topic', 'Mathematics', NULL,
  'The Class 6 mathematics book.',
  'Which mathematics book is Class 6 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
A new mathematics book, not the Class 5 book.

[[checks]]
What they learn
- The chapters in the Class 6 book
- Written working, not only the answer

[[example]]
ONE EXAMPLE
A Class 6 question asks for the working. The chapter list is that book, not a coaching list.

[[note]]
WHAT MAY VARY
Telangana and Andhra Pradesh print different Class 6 books.

[[ask-school]]
Which mathematics book is Class 6 using?
$cbse$);

SELECT path_put_node('ssc-g6-sci', 'ssc-g6', 'topic', 'General Science', NULL,
  'One science book. It splits in Class 8.',
  'Which General Science book is Class 6 using?',
  50, '{}', NULL,
  $cbse$[[lead]]
Science is its own subject now. It is one book called General Science.

[[checks]]
What they learn
- The chapters in the Class 6 General Science book
- A simple observation
- Writing what they saw

[[example]]
ONE EXAMPLE
Grow a seed and write what changed after a week.

[[note]]
WHAT THIS IS NOT
Not two books yet. Physical Science and Biological Science become separate books in Class 8.

[[ask-school]]
Which General Science book is Class 6 using?
$cbse$);

SELECT path_put_node('ssc-g6-sst', 'ssc-g6', 'topic', 'Social Studies', NULL,
  'History, geography, and civics in one book.',
  'How is Class 6 Social Studies taught?',
  60, '{}', NULL,
  $cbse$[[lead]]
History, geography, and civics, in the Class 6 Social Studies book.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Look at a map in the book and name one river.

[[note]]
WHAT THIS IS NOT
Not the Class 10 public exam. The school teaches it. The state board does not examine Class 6.

[[ask-school]]
How is Social Studies split across the week?
$cbse$);

SELECT path_put_node('ssc-g6-board', 'ssc-g6', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'Do Class 6 marks leave the school?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 6 has no public SSC exam.

[[checks]]
What a Class 6 mark is
- Set by the school
- Kept by the school
- Not an SSC memo

[[example]]
ONE EXAMPLE
A General Science unit test is the teacher's test. The state board does not collect it.

[[note]]
WORDS ON THIS PAGE
The public SSC exam is at the end of Class 10.

[[ask-school]]
How often do you test, and do those marks leave the school?
$cbse$);

-- Class 7
SELECT path_put_node('ssc-g7', NULL, 'root', 'This year', NULL,
  'The six Class 7 subjects. Science is still one book.',
  'Which subjects are on my child''s Class 7 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 7 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- General Science
- Social Studies

[[note]]
WHAT THIS YEAR IS
General Science is still one book.
Physical Science and Biological Science become two books in Class 8, not this year.

[[ask-school]]
Which subjects are on my child's Class 7 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g7-lang1', 'ssc-g7', 'topic', 'First language', NULL,
  'The main language. The Class 7 book.',
  'What is the first language in Class 7?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language. The lessons are the Class 7 book.

[[checks]]
What they learn
- Prose and poetry in that book
- Short written answers
- Grammar the book sets

[[example]]
ONE EXAMPLE
Read one poem from the book and say what it is about, in that language.

[[note]]
WHAT MAY VARY
Ask if the first language is the same as in Class 6.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g7-lang2', 'ssc-g7', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 7?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- The Class 7 second-language book
- Short writing
- Speaking

[[example]]
ONE EXAMPLE
Write five lines in the second language about a festival.

[[note]]
WHAT MAY VARY
Ask whether the school still offers the same second language as Class 6.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g7-lang-en', 'ssc-g7', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 7 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is its own subject.

[[checks]]
What they learn
- The Class 7 English book
- Paragraph writing
- Speaking in class

[[example]]
ONE EXAMPLE
Write a short paragraph in English about a school event.

[[note]]
WHAT MAY VARY
Ask for the book name for this session.

[[ask-school]]
Which English book is Class 7 using?
$cbse$);

SELECT path_put_node('ssc-g7-math', 'ssc-g7', 'topic', 'Mathematics', NULL,
  'The Class 7 mathematics book.',
  'Which mathematics book is Class 7 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
The Class 7 mathematics book is the list of topics.

[[checks]]
What they learn
- The chapters in that book
- Showing the working

[[example]]
ONE EXAMPLE
Finish one exercise from the Class 7 book and show the working.

[[note]]
WHAT MAY VARY
A tuition sheet is not a second official list.

[[ask-school]]
Which mathematics book is Class 7 using?
$cbse$);

SELECT path_put_node('ssc-g7-sci', 'ssc-g7', 'topic', 'General Science', NULL,
  'Still one science book.',
  'Which General Science book is Class 7 using?',
  50, '{}', NULL,
  $cbse$[[lead]]
One science book. Not yet split into Physical Science and Biological Science.

[[checks]]
What they learn
- The chapters in the Class 7 General Science book
- A short activity
- Writing the result

[[example]]
ONE EXAMPLE
Do the activity in the chapter and write three lines on what changed.

[[note]]
NEXT YEAR
Class 8 has two science books: Physical Science and Biological Science.

[[ask-school]]
Which General Science book is Class 7 using?
$cbse$);

SELECT path_put_node('ssc-g7-sst', 'ssc-g7', 'topic', 'Social Studies', NULL,
  'History, geography, and civics.',
  'How is Class 7 Social Studies taught?',
  60, '{}', NULL,
  $cbse$[[lead]]
History, geography, and civics in the Class 7 book.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Read one history section and say what changed.

[[note]]
WHAT THIS IS NOT
Not the Class 10 public exam.

[[ask-school]]
How is Social Studies split across the week?
$cbse$);

SELECT path_put_node('ssc-g7-board', 'ssc-g7', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'Do Class 7 marks go to the state board?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 7 has no public SSC exam. Marks stay with the school.

[[checks]]
What a Class 7 mark is
- The school's test or project
- A report you can ask for
- Not an SSC memo

[[example]]
ONE EXAMPLE
A Class 7 final paper set by the school stays in the school.

[[note]]
WHAT THIS IS NOT
These marks are not a public SSC result.

[[ask-school]]
Do these marks go to the state board?
$cbse$);

-- Class 8
SELECT path_put_node('ssc-g8', NULL, 'root', 'This year', NULL,
  'Science becomes two books.',
  'Which subjects are on my child''s Class 8 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 8 subjects. There is no public exam.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Physical Science
- Biological Science
- Social Studies

[[note]]
WHAT CHANGED FROM CLASS 7
General Science is replaced by two books: Physical Science and Biological Science.
On the Class 10 memo they come back together as one Science subject with two parts. In Class 8 they are two books.

[[ask-school]]
Which subjects are on my child's Class 8 timetable?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g8-lang1', 'ssc-g8', 'topic', 'First language', NULL,
  'The main language. The Class 8 book.',
  'What is the first language in Class 8?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language. The lessons are the Class 8 book.

[[checks]]
What they learn
- Prose and poetry in that book
- Longer written answers
- Grammar the book sets

[[example]]
ONE EXAMPLE
Write a page in the first language about a lesson from the book.

[[note]]
WHAT MAY VARY
Ask if it is the same first language as Class 7.

[[ask-school]]
What is the first language, and which book?
$cbse$);

SELECT path_put_node('ssc-g8-lang2', 'ssc-g8', 'topic', 'Second language', NULL,
  'The other Indian language.',
  'What is the second language in Class 8?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- The Class 8 second-language book
- Short writing
- Speaking

[[example]]
ONE EXAMPLE
Answer two questions from the second-language lesson in that language.

[[note]]
WHAT MAY VARY
On the Class 10 memo this subject has a lower pass mark than the others. That rule is for the public exam, not for Class 8.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g8-lang-en', 'ssc-g8', 'topic', 'English', NULL,
  'Its own English subject.',
  'Which English book is Class 8 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is its own subject.

[[checks]]
What they learn
- The Class 8 English book
- A longer paragraph
- Speaking

[[example]]
ONE EXAMPLE
Write eight lines in English about a person you know.

[[note]]
WHAT MAY VARY
Ask for this year's book. On the Class 10 memo, English is called the third language.

[[ask-school]]
Which English book is Class 8 using?
$cbse$);

SELECT path_put_node('ssc-g8-math', 'ssc-g8', 'topic', 'Mathematics', NULL,
  'The Class 8 mathematics book.',
  'Which mathematics book is Class 8 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
The Class 8 mathematics book. Class 9 mathematics is a different book.

[[checks]]
What they learn
- The chapters in the Class 8 book
- Written working

[[example]]
ONE EXAMPLE
Finish a chapter exercise from the Class 8 book. Do not use a Class 10 guide as this year's list.

[[note]]
WHAT MAY VARY
Ask the school to name the book and the state that printed it.

[[ask-school]]
Which mathematics book is Class 8 using?
$cbse$);

SELECT path_put_node('ssc-g8-sci-phy', 'ssc-g8', 'topic', 'Physical Science', NULL,
  'Its own book from Class 8.',
  'Which Physical Science book is Class 8 using?',
  50, '{}', NULL,
  $cbse$[[lead]]
Physical Science is its own book from Class 8.

[[checks]]
What they learn
- The chapters in the Class 8 Physical Science book
- A practical the school sets from that book

[[example]]
ONE EXAMPLE
Do the practical in the chapter and write what you measured.

[[note]]
WHAT THIS IS NOT
Not the Class 10 board paper. In Class 10, Physical Science is one part of the Science paper.

[[ask-school]]
Which Physical Science book is Class 8 using?
$cbse$);

SELECT path_put_node('ssc-g8-sci-bio', 'ssc-g8', 'topic', 'Biological Science', NULL,
  'Its own book from Class 8.',
  'Which Biological Science book is Class 8 using?',
  55, '{}', NULL,
  $cbse$[[lead]]
Biological Science is its own book from Class 8. It is about living things.

[[checks]]
What they learn
- The chapters in the Class 8 Biological Science book
- A practical or observation from that book

[[example]]
ONE EXAMPLE
Draw a plant part from the chapter and label two things.

[[note]]
WHAT THIS IS NOT
Not a separate Class 10 board paper. In Class 10 it is the other part of the one Science subject.

[[ask-school]]
Which Biological Science book is Class 8 using?
$cbse$);

SELECT path_put_node('ssc-g8-sst', 'ssc-g8', 'topic', 'Social Studies', NULL,
  'History, geography, and civics.',
  'How is Class 8 Social Studies taught?',
  60, '{}', NULL,
  $cbse$[[lead]]
History, geography, and civics in the Class 8 book.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Answer one civics question from the book using an example from your town.

[[note]]
WHAT THIS IS NOT
The school marks it. It is not the Class 10 public exam.

[[ask-school]]
How is Class 8 Social Studies taught?
$cbse$);

SELECT path_put_node('ssc-g8-board', 'ssc-g8', 'topic', 'Exams', NULL,
  'No public SSC exam.',
  'Is the Class 8 exam only a school exam?',
  80, '{}', NULL,
  $cbse$[[lead]]
Class 8 has no public SSC exam.

[[checks]]
What a Class 8 exam is
- Set by the school, if the school holds one
- Not the SSC public exam
- Not a choice of Intermediate groups

[[example]]
ONE EXAMPLE
A school may call Class 8 a rehearsal. The state board does not set that paper.

[[note]]
WORDS ON THIS PAGE
The public SSC exam is at the end of Class 10. Intermediate groups such as MPC and BiPC come after that.

[[ask-school]]
Is your Class 8 exam only a school exam?
$cbse$);

-- Class 9
SELECT path_put_node('ssc-g9', NULL, 'root', 'This year', NULL,
  'The Class 9 subjects. The public exam is next year.',
  'Which subjects are on my child''s Class 9 timetable?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 9 subjects. The exam this year is set by the school.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Physical Science
- Biological Science
- Social Studies
- Environmental Education

[[note]]
WORDS ON THIS PAGE
The public SSC exam is at the end of Class 10, not this year.
Environmental Education is a school subject. It is not one of the six public-exam papers.
Telangana Class 10 keeps 80 marks for the public paper and 20 marks from the school. That rule is next year. Andhra Pradesh runs its own exam.

[[ask-school]]
Which subjects are on my child's Class 9 timetable, and which state are they registered in?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g9-lang1', 'ssc-g9', 'topic', 'First language', NULL,
  'The main language. It will be a Class 10 board paper.',
  'What is the first language in Class 9?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language. This is the subject that becomes the first-language paper in Class 10.

[[checks]]
What they learn
- The Class 9 first-language book
- Longer answers
- The kind of writing the Class 10 paper will ask for

[[example]]
ONE EXAMPLE
Write a page on a lesson from the Class 9 book. The public paper on this subject is next year.

[[note]]
WHAT MAY VARY
The name depends on the medium. Ask what will be printed as First Language on the Class 10 hall ticket.

[[ask-school]]
What will be registered as the first language for Class 10?
$cbse$);

SELECT path_put_node('ssc-g9-lang2', 'ssc-g9', 'topic', 'Second language', NULL,
  'The other Indian language. A lower pass mark later.',
  'What is the second language in Class 9?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language.

[[checks]]
What they learn
- The Class 9 second-language book
- Reading and short writing

[[example]]
ONE EXAMPLE
Answer a lesson question in the second language. In the Telangana Class 10 exam, this paper needs 20 out of 100 to pass, not 35.

[[note]]
THE CLASS 10 RULE, NOT THIS YEAR'S EXAM
That lower pass mark is for the Telangana public exam in Class 10. Class 9 is still a school exam. Andhra Pradesh sets its own pass marks.

[[ask-school]]
What is the second language, and which book?
$cbse$);

SELECT path_put_node('ssc-g9-lang-en', 'ssc-g9', 'topic', 'English', NULL,
  'English. On the Class 10 memo this is the third language.',
  'Which English book is Class 9 using?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is its own subject. On the Class 10 memo it is called the third language.

[[checks]]
What they learn
- The Class 9 English book
- Reading and writing the board will test next year

[[example]]
ONE EXAMPLE
Write a letter in the form the Class 9 English book teaches. The public English paper is in Class 10.

[[note]]
WHAT MAY VARY
Ask the school to show you where English sits on a sample Class 10 memo. It is the third-language row.

[[ask-school]]
Which English book is Class 9 using?
$cbse$);

SELECT path_put_node('ssc-g9-math', 'ssc-g9', 'topic', 'Mathematics', NULL,
  'The Class 9 mathematics book.',
  'Which mathematics book is Class 9 using?',
  40, '{}', NULL,
  $cbse$[[lead]]
The Class 9 mathematics book. The public mathematics paper is in Class 10.

[[checks]]
What they learn
- The chapters in the Class 9 book
- Written working
- The school exam on this book

[[example]]
ONE EXAMPLE
Sit the school's Class 9 mathematics paper. That paper is not the SSC public paper.

[[note]]
WHAT MAY VARY
Ask which state's Class 9 book the school is using.

[[ask-school]]
Which mathematics book is Class 9 using?
$cbse$);

SELECT path_put_node('ssc-g9-sci-phy', 'ssc-g9', 'topic', 'Physical Science', NULL,
  'One of the two science books.',
  'Which Physical Science book is Class 9 using?',
  50, '{}', NULL,
  $cbse$[[lead]]
Physical Science is its own book in Class 9.

[[checks]]
What they learn
- The Class 9 Physical Science chapters
- Practicals the school sets

[[example]]
ONE EXAMPLE
Write up one practical. In the Class 10 public exam this becomes one part of the single Science paper, not its own memo row.

[[note]]
NEXT YEAR
Telangana's Class 10 Science paper has two parts: Physical Science and Biological Science. Together they are one subject out of 100.

[[ask-school]]
Which Physical Science book is Class 9 using?
$cbse$);

SELECT path_put_node('ssc-g9-sci-bio', 'ssc-g9', 'topic', 'Biological Science', NULL,
  'The living-things book.',
  'Which Biological Science book is Class 9 using?',
  55, '{}', NULL,
  $cbse$[[lead]]
Biological Science is the living-things book.

[[checks]]
What they learn
- The Class 9 Biological Science chapters
- A practical or a labelled drawing

[[example]]
ONE EXAMPLE
Label a diagram from the chapter. Next year this is the other half of the Class 10 Science paper.

[[note]]
WHAT THIS IS NOT
Not a separate public-exam subject. It is part of Science.

[[ask-school]]
Which Biological Science book is Class 9 using?
$cbse$);

SELECT path_put_node('ssc-g9-sst', 'ssc-g9', 'topic', 'Social Studies', NULL,
  'History, geography, and civics.',
  'How is Class 9 Social Studies taught?',
  60, '{}', NULL,
  $cbse$[[lead]]
History, geography, and civics. This becomes the Class 10 Social Studies paper.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Answer a map question from the Class 9 book. The public Social Studies paper is next year.

[[note]]
THIS YEAR'S EXAM
The school sets the Class 9 paper.

[[ask-school]]
How is Class 9 Social Studies split across the week?
$cbse$);

SELECT path_put_node('ssc-g9-world-ee', 'ssc-g9', 'topic', 'Environmental Education', NULL,
  'A school subject. Not one of the six exam papers.',
  'Is Environmental Education marked, and does it appear on the SSC memo?',
  70, '{}', NULL,
  $cbse$[[lead]]
A school subject about the environment. Telangana prints a Class 9 book for it.

[[checks]]
What to know
- It is on the Class 9 book list
- The school may mark it
- It is not one of the six public-exam papers

[[example]]
ONE EXAMPLE
A project on water at school can be this subject. It does not become a seventh row on the SSC memo.

[[note]]
WHAT THIS IS NOT
The six public papers are first language, second language, English, mathematics, science, and social studies.

[[ask-school]]
Do you teach Environmental Education, and does it count in the school report?
$cbse$);

SELECT path_put_node('ssc-g9-board', 'ssc-g9', 'topic', 'Exams', NULL,
  'A school exam. The public SSC exam is Class 10.',
  'Who sets the Class 9 final paper?',
  80, '{}', NULL,
  $cbse$[[lead]]
The school sets the Class 9 exam. The state board does not.

[[checks]]
What Class 9 is
- School tests through the year
- A final school paper
- Not the SSC public exam

[[example]]
ONE EXAMPLE
The school's final Science paper covers Physical Science and Biological Science. It is not the Class 10 public paper.

[[note]]
NEXT YEAR
Telangana's public exam is 80 marks, plus 20 marks from the school. A plan to make the public paper the full 100 marks was dropped in August 2025. Andhra Pradesh sets its own Class 10 exam.

[[ask-school]]
Who sets the Class 9 final papers, the school or the state board?
$cbse$);

-- Class 10: this year, then the existing after-SSC routes
SELECT path_put_node('ssc-g10', NULL, 'root', 'This year', NULL,
  'The six public-exam subjects, then the choices after SSC.',
  'Which state board is my child registered with for the SSC exam?',
  0, '{}', NULL,
  $cbse$[[lead]]
These are the Class 10 subjects. This is the public SSC exam year.

[[checks]]
Subjects this year
- First language
- Second language
- English
- Mathematics
- Physical Science
- Biological Science
- Social Studies
- Environmental Education, at school, not as a seventh exam paper

[[note]]
THE TELANGANA EXAM
Six papers. Each subject is out of 100: 20 marks from the school and 80 marks from the public paper.
Science is one of those six. Physical Science and Biological Science are its two parts.
Most subjects need 35 out of 100 to pass, and at least 28 of the 80 public marks.
Second language needs 20 out of 100, and at least 16 of the 80 public marks.
A plan to drop the 20 school marks and make the public paper the full 100 was withdrawn in August 2025.
Andhra Pradesh runs its own SSC exam. Ask which state your child is registered in.
Class 10 is not Class 12. The choices after this exam are further down the page.

[[ask-school]]
Which state is my child registered in, Telangana or Andhra Pradesh?

[[view tiles]]
$cbse$);

SELECT path_put_node('ssc-g10-lang1', 'ssc-g10', 'topic', 'First language', NULL,
  'A public-exam paper. 20 school marks and 80 public marks.',
  'What is registered as the first language?',
  10, '{}', NULL,
  $cbse$[[lead]]
The main language. It is one of the six public papers.

[[checks]]
Telangana marks
- 20 from the school
- 80 from the public paper
- Pass at 35 out of 100, with at least 28 of the 80

[[example]]
ONE EXAMPLE
Telugu is the first language. The public paper is 80 marks. The school adds up to 20. The memo shows one row called First Language.

[[note]]
WHAT MAY VARY
The name depends on the medium. Andhra Pradesh prints its own paper and its own pass rule. Ask which state.

[[ask-school]]
What language is registered as First Language?
$cbse$);

SELECT path_put_node('ssc-g10-lang2', 'ssc-g10', 'topic', 'Second language', NULL,
  'A public paper with a lower pass mark in Telangana.',
  'What is registered as the second language?',
  20, '{}', NULL,
  $cbse$[[lead]]
The other Indian language. It is its own public paper.

[[checks]]
Telangana marks
- 20 from the school
- 80 from the public paper
- Pass at 20 out of 100, with at least 16 of the 80

[[example]]
ONE EXAMPLE
Hindi is the second language. A score of 20 out of 100 can be a pass in Telangana. The other subjects need 35.

[[note]]
WHAT MAY VARY
Andhra Pradesh may not use this same pass mark. Ask the school which rule applies.

[[ask-school]]
What language is registered as Second Language?
$cbse$);

SELECT path_put_node('ssc-g10-lang-en', 'ssc-g10', 'topic', 'English', NULL,
  'The third language on the SSC memo.',
  'Is English registered as the third language?',
  30, '{}', NULL,
  $cbse$[[lead]]
English is a public paper. On the Telangana memo it is the third language.

[[checks]]
Telangana marks
- 20 from the school
- 80 from the public paper
- Pass at 35 out of 100, with at least 28 of the 80

[[example]]
ONE EXAMPLE
The memo row says Third Language. For most schools that row is English.

[[note]]
WHAT MAY VARY
Ask to see the registered name. Do not assume from the medium alone.

[[ask-school]]
Is English the third language on my child's registration?
$cbse$);

SELECT path_put_node('ssc-g10-math', 'ssc-g10', 'topic', 'Mathematics', NULL,
  'One public paper.',
  'How is Class 10 mathematics split between school marks and the public paper?',
  40, '{}', NULL,
  $cbse$[[lead]]
Mathematics is one of the six public papers.

[[checks]]
Telangana marks
- 20 from the school
- 80 from the public paper
- One paper, not two

[[example]]
ONE EXAMPLE
The public paper is the Class 10 mathematics course for this session. The school marks are the other 20. Both have to be there.

[[note]]
WHAT MAY VARY
Ask how your school records the 20. Andhra Pradesh may split the marks differently.

[[ask-school]]
How are the 20 school marks recorded in mathematics?
$cbse$);

SELECT path_put_node('ssc-g10-sci-phy', 'ssc-g10', 'topic', 'Physical Science', NULL,
  'One part of the Science paper.',
  'How many marks is Physical Science on the public paper?',
  50, '{}', NULL,
  $cbse$[[lead]]
Physical Science is one part of the single Science subject.

[[checks]]
Telangana Science, out of 100
- Physical Science: 10 school marks and 40 public marks
- Biological Science: 10 school marks and 40 public marks
- One Science row on the memo

[[example]]
ONE EXAMPLE
The public Science paper has a Physical Science part and a Biological Science part. They are not two separate pass-or-fail subjects.

[[note]]
WHAT MAY VARY
Ask the school how it splits the 20 Science marks between the two parts.

[[ask-school]]
How are the Science school marks split between the two parts?
$cbse$);

SELECT path_put_node('ssc-g10-sci-bio', 'ssc-g10', 'topic', 'Biological Science', NULL,
  'The other part of the Science paper.',
  'Is Biological Science its own row on the SSC memo?',
  55, '{}', NULL,
  $cbse$[[lead]]
Biological Science is the other part of the one Science subject.

[[checks]]
What it is
- Its own textbook
- Half of the Science marks
- Not its own row on the memo

[[example]]
ONE EXAMPLE
A question on the human heart sits in this part. The marks join the Physical Science marks under Science.

[[note]]
WHAT THIS IS NOT
Not a seventh public paper.

[[ask-school]]
Is Biological Science taught from its own book this year?
$cbse$);

SELECT path_put_node('ssc-g10-sst', 'ssc-g10', 'topic', 'Social Studies', NULL,
  'One public paper: history, geography, and civics.',
  'How is Social Studies divided before the public exam?',
  60, '{}', NULL,
  $cbse$[[lead]]
History, geography, and civics. One public paper.

[[checks]]
Telangana marks
- 20 from the school
- 80 from the public paper

[[example]]
ONE EXAMPLE
One public paper can include a map question and a history question. They are the same subject.

[[note]]
WHAT MAY VARY
The school divides the teaching across the year. The public paper is still one Social Studies paper.

[[ask-school]]
How have you divided Social Studies before the public exam?
$cbse$);

SELECT path_put_node('ssc-g10-world-ee', 'ssc-g10', 'topic', 'Environmental Education', NULL,
  'Taught at school. Not a seventh public paper.',
  'Does Environmental Education appear on the SSC memo?',
  70, '{}', NULL,
  $cbse$[[lead]]
Telangana has a Class 10 Environmental Education book. It is not one of the six public papers.

[[checks]]
The six public papers
- First language
- Second language
- English
- Mathematics
- Science
- Social Studies

[[example]]
ONE EXAMPLE
An environment project can be done at school. It does not add a row to the SSC memo.

[[note]]
WHAT TO ASK
Ask if the school teaches this book, and whether it appears anywhere on the school report.

[[ask-school]]
Do you teach Environmental Education, and is it on the memo?
$cbse$);

SELECT path_put_node('ssc-g10-board', 'ssc-g10', 'topic', 'The public exam', NULL,
  'Six papers. School marks plus the public paper.',
  'Which state board will issue my child''s SSC memo?',
  80, '{}', NULL,
  $cbse$[[lead]]
This is the public SSC exam.

[[checks]]
Telangana, from 2025-26 onward
- Six papers
- 20 marks from the school in each subject
- 80 marks from the public paper
- The 20 school marks stay. They were not dropped.

[[example]]
ONE EXAMPLE
Mathematics is 20 from the school and 80 from the public paper. Missing the school marks does not leave a full 100 from the public paper.

[[note]]
WHAT CLASS 10 IS NOT
Class 10 is not Class 12. Intermediate, or another Class 11 route, comes after this. Andhra Pradesh issues its own memo. Opening this page does not register your child.

[[ask-school]]
Which board will print the memo, BSE Telangana or BSE Andhra Pradesh?
$cbse$);

SELECT path_put_node('ssc-g10-after', 'ssc-g10', 'section', 'After Class 10', NULL,
  'The choices for the next two years. Opening one does not pick it.',
  'What helped you compare Intermediate with the other routes?',
  90, '{}', NULL,
  $cbse$[[lead]]
These are the choices after the SSC exam. Opening one does not pick it.

[[checks]]
The choices
- Intermediate in Telangana or Andhra Pradesh
- Switch to CBSE for Classes 11 and 12
- Switch to Cambridge A Level
- Polytechnic diploma, in Telangana
- Not sure yet

[[note]]
WHAT SSC IS NOT
SSC Class 10 is not Class 12. The next college or school has to offer the course. Most families in these two states go to Intermediate.

[[view tiles]]
$cbse$);

UPDATE path_nodes SET
  parent_id = (SELECT id FROM path_nodes WHERE slug = 'ssc-g10-after'),
  updated_at = now()
WHERE slug IN ('ssc-inter', 'ssc-cbse', 'ssc-alevel', 'ssc-poly', 'ssc-unsure');

UPDATE path_nodes SET
  summary = 'Two years of junior college. MPC, BiPC, or MEC.',
  ask_prompt_default = 'Which Intermediate group did your child take, and why?',
  lead = $cbse$[[lead]]
After SSC, most families in Telangana and Andhra Pradesh join Intermediate for two years.

[[checks]]
Groups parents ask about
- MPC: maths, physics, chemistry
- BiPC: biology, physics, chemistry
- MEC: maths, economics, commerce

[[example]]
ONE EXAMPLE
A child who wants engineering often looks at MPC. A child who wants medicine often looks at BiPC. The college has to offer the group.

[[note]]
WHAT THESE NAMES ARE
They are junior-college groups in these two states. They are not CBSE's PCM and PCB labels. This row is only for Telangana and Andhra Pradesh.

[[ask-school]]
Which groups does the college offer, and which state is the syllabus?
$cbse$,
  updated_at = now()
WHERE slug = 'ssc-inter';

UPDATE path_nodes SET
  summary = 'Classes 11 and 12 on CBSE. The new school must offer it.',
  ask_prompt_default = 'How did you choose Class 11 subjects after leaving SSC?',
  lead = $cbse$[[lead]]
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
The SSC memo does not place your child in PCM. The CBSE school offers a group, and you ask which one.

[[note]]
WHAT THESE NAMES ARE
They are groups the CBSE school offers. They are not the same labels as Intermediate MPC and BiPC.

[[ask-school]]
Does the school offer CBSE Class 11, and which groups?
$cbse$,
  updated_at = now()
WHERE slug = 'ssc-cbse';

UPDATE path_nodes SET
  summary = 'Usually 3 or 4 subjects. The new school must offer A Level.',
  ask_prompt_default = 'What was the catch-up like after SSC?',
  lead = $cbse$[[lead]]
Cambridge A Level is usually 3 or 4 subjects. It can count as Class 12. SSC Class 10 does not.

[[example]]
ONE EXAMPLE
The child leaves after SSC and starts A Level at a school that teaches it. The SSC marksheet does not enrol them.

[[note]]
WHAT TO CHECK
Ask which subjects that school teaches, and how it treats an SSC Class 10 certificate.

[[ask-school]]
Does the school offer A Level, and which subjects?
$cbse$,
  updated_at = now()
WHERE slug = 'ssc-alevel';

UPDATE path_nodes SET
  summary = 'Telangana only. An engineering diploma after Class 10.',
  ask_prompt_default = 'How did you compare Intermediate and Polytechnic?',
  lead = $cbse$[[lead]]
In Telangana, POLYCET is the entrance to an engineering diploma after Class 10.

[[example]]
ONE EXAMPLE
A Telangana student sits POLYCET after SSC and joins a diploma. A later ECET can be a route into B.Tech.

[[note]]
WHAT THIS IS NOT
Not an MBBS seat. Not EAPCET. Andhra Pradesh uses a different polytechnic entrance, so this row is Telangana only.

[[ask-school]]
Is POLYCET the exam you mean, and is it offered in your state?
$cbse$,
  updated_at = now()
WHERE slug = 'ssc-poly';

UPDATE path_nodes SET
  summary = 'Read the choices. Nothing here picks one.',
  ask_prompt_default = 'What helped you compare Intermediate and Polytechnic?',
  lead = $cbse$[[lead]]
You can read the choices and not pick one.

[[note]]
NOTHING CHANGES
Opening this page does not change your child's board, class, or college group.

[[ask-school]]
What helped you compare Intermediate with the other routes?
$cbse$,
  updated_at = now()
WHERE slug = 'ssc-unsure';

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order, status
)
SELECT v.label, ARRAY['STATE'], ARRAY['SSC'], v.stages, v.grades,
       v.fork, n.id, 10, 'published'
FROM (VALUES
  ('SSC Class 1', ARRAY['foundation']::text[], ARRAY['G1']::text[], false),
  ('SSC Class 2', ARRAY['foundation'], ARRAY['G2'], false),
  ('SSC Class 3', ARRAY['foundation'], ARRAY['G3'], false),
  ('SSC Class 4', ARRAY['foundation'], ARRAY['G4'], false),
  ('SSC Class 5', ARRAY['foundation'], ARRAY['G5'], false),
  ('SSC Class 6', ARRAY['middle'], ARRAY['G6'], false),
  ('SSC Class 7', ARRAY['middle'], ARRAY['G7'], false),
  ('SSC Class 8', ARRAY['middle'], ARRAY['G8'], false),
  ('SSC Class 9', ARRAY['board_10'], ARRAY['G9'], false)
) AS v(label, stages, grades, fork)
JOIN path_nodes n ON n.slug = 'ssc-g' || substring(v.grades[1] from 2)
WHERE NOT EXISTS (
  SELECT 1 FROM path_node_roots r
  WHERE 'SSC' = ANY(r.curriculum_codes)
    AND v.grades[1] = ANY(r.grade_codes)
);

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
