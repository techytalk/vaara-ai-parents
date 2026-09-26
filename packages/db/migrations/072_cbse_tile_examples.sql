-- Fill every CBSE subject tile the way the IB tiles are filled:
-- one line, what they learn, one example, a note, and a question for the school.
-- Safe to re-run.

BEGIN;

-- Class 1
UPDATE path_nodes SET lead = $cbse$[[lead]]
Your child learns two languages in Class 1.

[[checks]]
What they learn
- Listening and speaking
- Starting to read
- Starting to write

[[example]]
ONE EXAMPLE
The teacher reads a short story. Your child says who was in it.

[[note]]
WHAT MAY VARY
The school chooses the two languages. One is often English. The other is often Hindi or the language of your state.

[[ask-school]]
Which two languages is my child learning, and what are the books called?
$cbse$, updated_at = now() WHERE slug = 'cbse-g1-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Counting, shapes, and patterns. Children use objects, not only written sums.

[[checks]]
What they learn
- Counting
- Shapes
- Simple patterns
- Comparing more and less

[[example]]
ONE EXAMPLE
Count 8 buttons, then point to the pile that has more.

[[note]]
WHAT MAY VARY
The school chooses the Class 1 mathematics book. Ask for that book, not a tuition sheet.

[[ask-school]]
Which mathematics book is Class 1 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g1-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Family, school, food, plants, and animals.

[[checks]]
What they learn
- About themselves and the family
- The school and the neighbourhood
- Plants, animals, and food

[[example]]
ONE EXAMPLE
Name three people who help at school, and what each one does.

[[note]]
WHAT MAY VARY
Some schools give this its own period. Some weave it through the day.

[[ask-school]]
Is this a separate period, or part of the rest of the day?
$cbse$, updated_at = now() WHERE slug = 'cbse-g1-world';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Drawing, music, play, and movement are part of Class 1.

[[checks]]
What they learn
- Drawing and making
- Music or movement
- Play and physical activity

[[example]]
ONE EXAMPLE
Draw the family and say who is in the picture.

[[note]]
WHAT MAY VARY
The school sets how many periods these get. They are subjects, not a reward after written work.

[[ask-school]]
How many periods a week are art and physical education?
$cbse$, updated_at = now() WHERE slug = 'cbse-g1-art';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 1 has no CBSE exam.

[[checks]]
What the school may do
- Watch your child in class
- Look at classwork
- Sometimes give a short test

[[example]]
ONE EXAMPLE
The teacher notes that your child can count to 20. That note stays at the school. CBSE does not collect it.

[[note]]
WHAT THIS IS NOT
A mark from the school is not a CBSE result.

[[ask-school]]
How will you tell me how my child is doing this year?
$cbse$, updated_at = now() WHERE slug = 'cbse-g1-board';

-- Class 2
UPDATE path_nodes SET lead = $cbse$[[lead]]
Your child still learns two languages. Not three.

[[checks]]
What they learn
- Longer reading
- Short writing
- Speaking in both languages

[[example]]
ONE EXAMPLE
Read three sentences aloud and write one sentence about the picture.

[[note]]
WHAT MAY VARY
The school keeps or changes the two languages from Class 1. A third language starts in Class 6.

[[ask-school]]
Which two languages, and which books?
$cbse$, updated_at = now() WHERE slug = 'cbse-g2-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Bigger numbers, adding, taking away, shapes, and measuring.

[[checks]]
What they learn
- Numbers past the first counting
- Adding and taking away
- Shapes and simple measuring

[[example]]
ONE EXAMPLE
There are 12 pencils. 4 are given away. How many are left?

[[note]]
WHAT MAY VARY
Children still use objects. The school chooses the Class 2 book.

[[ask-school]]
Which mathematics book is Class 2 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g2-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The neighbourhood, plants, animals, food, and people who help.

[[checks]]
What they learn
- The neighbourhood around school
- Plants and animals
- People who help, and the work they do

[[example]]
ONE EXAMPLE
Walk past the school gate and name two places you see, such as a shop or a park.

[[note]]
WHAT MAY VARY
Ask if this has its own period. Some schools still fold it into the day.

[[ask-school]]
Is this its own period in Class 2?
$cbse$, updated_at = now() WHERE slug = 'cbse-g2-world';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art and movement are still on the timetable.

[[checks]]
What they learn
- Drawing and making
- Music or movement
- Games and physical activity

[[example]]
ONE EXAMPLE
Learn a short song or a game and show it at home.

[[note]]
WHAT MAY VARY
These are subjects. They are not a prize after written work. The school sets the periods.

[[ask-school]]
What art and physical education does Class 2 do each week?
$cbse$, updated_at = now() WHERE slug = 'cbse-g2-art';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 2 has no CBSE exam. The school tells you how your child is doing.

[[checks]]
What you may receive
- A note from the teacher
- A look at classwork
- A school report

[[example]]
ONE EXAMPLE
The report says your child can read a short page. That report is the school's. It is not a CBSE marksheet.

[[note]]
WHAT THIS IS NOT
A school report is not a CBSE result.

[[ask-school]]
What will you send home, and when?
$cbse$, updated_at = now() WHERE slug = 'cbse-g2-board';

-- Class 3
UPDATE path_nodes SET lead = $cbse$[[lead]]
Two languages. Not three.

[[checks]]
What they learn
- Reading longer pieces
- Writing short answers
- Speaking in class

[[example]]
ONE EXAMPLE
Read a page and write two sentences about what happened.

[[note]]
WHAT MAY VARY
The school chooses the two languages and the books. A third language is not the Class 3 plan.

[[ask-school]]
Which two languages, and which books?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Number work, shapes, and measuring, with more writing than in Class 2.

[[checks]]
What they learn
- Adding and taking away with bigger numbers
- Shapes
- Measuring length and weight
- Writing the sums, not only using objects

[[example]]
ONE EXAMPLE
Measure the desk with a scale, then write the number.

[[note]]
WHAT MAY VARY
The chapters are the Class 3 mathematics book the school is using. A tuition sheet is not a second list.

[[ask-school]]
Which mathematics book is Class 3 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Places, plants, animals, food, water, and how people live. This is now its own subject.

[[checks]]
What they learn
- Places around them
- Plants, animals, food, and water
- How people live and work

[[example]]
ONE EXAMPLE
Draw where drinking water comes from at home, and say who brings it or where the tap is.

[[note]]
WHAT MAY VARY
The timetable may say EVS. That is this subject. It is not Science, and it is not Social Science. Those start in Class 6.

[[ask-school]]
What name is on the timetable, and which book are you using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-world';

UPDATE path_nodes SET lead = $cbse$[[lead]]
This is new from 2026. It is practice inside the subjects your child already has.

[[checks]]
What they practise
- Spotting a pattern
- Putting steps in order
- Sorting things into groups

[[example]]
ONE EXAMPLE
Sort classroom objects by colour, then say the steps in the order you did them.

[[note]]
WHAT THIS IS NOT
Not a coding class. Not a new period. Not a mark on a board exam. CBSE asked schools not to add extra class time for it.

[[ask-school]]
In which subjects will my child do this, and how will you show me?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art and movement are on the Class 3 plan. CBSE does not examine them.

[[checks]]
What they learn
- Drawing, music, or making
- Games and movement
- Working with the class

[[example]]
ONE EXAMPLE
Learn one game in physical education and explain the rules in one sentence.

[[note]]
WHAT MAY VARY
The school decides if these are graded, and how many periods they get.

[[ask-school]]
Are these graded, and how many periods a week?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-art';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 3 has no CBSE exam.

[[checks]]
What the school may send
- A school test
- A look at classwork
- A report from the teacher

[[example]]
ONE EXAMPLE
A Class 3 test mark stays in the school file. CBSE does not turn it into a board result.

[[note]]
WHAT THIS IS NOT
A school test is not a CBSE result.

[[ask-school]]
What report will you send home?
$cbse$, updated_at = now() WHERE slug = 'cbse-g3-board';

-- Class 4
UPDATE path_nodes SET lead = $cbse$[[lead]]
Two languages. Children read longer pieces and write more.

[[checks]]
What they learn
- Reading a longer passage
- Writing a short paragraph
- Speaking in both languages

[[example]]
ONE EXAMPLE
Read a short passage and write four lines about it in the other language, if the school asks for that.

[[note]]
WHAT MAY VARY
The school chooses the two languages. A third language is not required in Class 4.

[[ask-school]]
Which two languages, and which books?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Bigger calculations, measuring, shapes, and the first work with fractions.

[[checks]]
What they learn
- Bigger addition and subtraction
- The first fractions, such as a half
- Measuring
- Shapes

[[example]]
ONE EXAMPLE
Fold a paper in half and say what one half means.

[[note]]
WHAT MAY VARY
Ask for the Class 4 mathematics book. A tuition worksheet is not a second official list.

[[ask-school]]
Which mathematics book is Class 4 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Places, plants, animals, and how people live. Still one subject.

[[checks]]
What they learn
- Places beyond the neighbourhood
- Living things
- How people live together

[[example]]
ONE EXAMPLE
Pick one animal from the book and say where it lives and what it eats.

[[note]]
WHAT THIS IS NOT
Not Science. Not Social Science. Those are Class 6 subjects. The timetable may still say EVS.

[[ask-school]]
What is this subject called, and which book are you using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-world';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Pattern spotting and steps, inside the subjects already on the list.

[[checks]]
What they practise
- Finding a pattern in numbers or pictures
- Writing steps in order
- Checking the steps with a classmate

[[example]]
ONE EXAMPLE
Continue a number pattern such as 2, 4, 6, and say the rule in one line.

[[note]]
WHAT THIS IS NOT
Not a new period. Not an exam. Not a device the school can require.

[[ask-school]]
In which Class 4 subjects will my child do this?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art and movement stay on the plan. CBSE does not examine them.

[[checks]]
What they learn
- Art work over several classes
- Games and fitness
- Taking part with the class

[[example]]
ONE EXAMPLE
Finish one drawing across two art periods and say what you changed the second time.

[[note]]
WHAT MAY VARY
The school sets the periods and whether they are graded.

[[ask-school]]
How many periods a week, and are they graded?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-art';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 4 has no CBSE exam. If there is a test, the school sets it.

[[checks]]
What a school test is
- Set by the teacher
- Kept at the school
- Not sent to CBSE as a board result

[[example]]
ONE EXAMPLE
A mid-year Class 4 paper is the school's paper. It does not become a CBSE marksheet.

[[note]]
WHAT THIS IS NOT
CBSE does not examine Class 4.

[[ask-school]]
Do you hold Class 4 tests, and who sets them?
$cbse$, updated_at = now() WHERE slug = 'cbse-g4-board';

-- Class 5
UPDATE path_nodes SET lead = $cbse$[[lead]]
Two languages this year.

[[checks]]
What they learn
- Reading a full page
- Writing a short paragraph
- Speaking clearly in both languages

[[example]]
ONE EXAMPLE
Read one page from the language book and write five lines about it.

[[note]]
WHAT CHANGES NEXT YEAR
A third language becomes required in Class 6, from 2026. Some schools offer one early. Ask if yours does.

[[ask-school]]
Which two languages are on the timetable? Is a third language already offered?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The last primary mathematics book. Class 6 mathematics is a new book.

[[checks]]
What they learn
- Number work from the Class 5 book
- Fractions
- Measuring and shapes

[[example]]
ONE EXAMPLE
Share 12 sweets among 4 children and say what fraction each child gets.

[[note]]
WHAT MAY VARY
Use the Class 5 book. Do not start the Class 6 book early unless the school says so.

[[ask-school]]
Which mathematics book is Class 5 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Still one subject: places, living things, and people.

[[checks]]
What they learn
- Places and maps in simple form
- Living things
- How a community works

[[example]]
ONE EXAMPLE
Look at a simple map of the area and point to the school.

[[note]]
NEXT YEAR, NOT THIS YEAR
Class 6 splits this into Science and Social Science. The timetable may say EVS.

[[ask-school]]
What is this subject called on the Class 5 timetable?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-world';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Still inside the other subjects. Not its own exam.

[[checks]]
What they practise
- Patterns
- Steps in order
- Checking a result

[[example]]
ONE EXAMPLE
Write the steps to get ready for school, in order, then swap with a classmate and follow theirs.

[[note]]
NEXT YEAR
From Class 6, schools also give a first look at AI. That stays inside existing periods. It is not a board subject.

[[ask-school]]
Is this still inside other subjects in Class 5?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art and movement stay on the plan. They are not CBSE exam subjects.

[[checks]]
What they learn
- A finished piece of art
- Games, fitness, and health habits
- Working with others

[[example]]
ONE EXAMPLE
Complete one art piece and say which part took the longest.

[[note]]
WHAT MAY VARY
The school chooses the activities and the number of periods.

[[ask-school]]
What does Class 5 do for art and physical education?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-art';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 5 has no CBSE exam.

[[checks]]
What this year is
- School tests, if the school holds them
- A report you can ask for
- Not a board result

[[example]]
ONE EXAMPLE
Some schools hold a bigger test before Class 6. That test is still the school's. CBSE does not mark it.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam. On this path, the first one is at the end of Class 10.

[[ask-school]]
Do you hold a Class 5 exam, and does CBSE see it?
$cbse$, updated_at = now() WHERE slug = 'cbse-g5-board';

-- Class 6
UPDATE path_nodes SET lead = $cbse$[[lead]]
Three languages. The third one is new for Class 6 from 2026.

[[checks]]
The three languages
- First language
- Second language, a different one
- Third language, different again

[[example]]
ONE EXAMPLE
English, Hindi, and Sanskrit. Or Telugu, English, and Hindi. The school picks the three. One language cannot be counted twice.

[[note]]
THE RULE
At least two of the three are Indian languages if the school is in India. The school records the names.

[[ask-school]]
What are the three language names, and which books?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
This is a new mathematics book, not the Class 5 book.

[[checks]]
What they learn
- The chapters in the Class 6 mathematics book
- More algebra and shapes than in Class 5
- Written working, not only the answer

[[example]]
ONE EXAMPLE
A Class 6 question asks for the working, not only the final number. The chapter list is that book.

[[note]]
WHAT TO ASK FOR
Ask for the Class 6 book the school was told to use. A coaching list is not the official list.

[[ask-school]]
Which mathematics book is Class 6 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Science is its own subject now. It is no longer inside "the world around us".

[[checks]]
What they learn
- The chapters in the Class 6 science book
- A simple test or observation
- Writing what they saw

[[example]]
ONE EXAMPLE
Grow a seed on cotton and write what changed after a week. The topics are the chapters in the Class 6 book.

[[note]]
WHAT TO ASK FOR
Ask which science book the school is using this year.

[[ask-school]]
Which science book is Class 6 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-sci';

UPDATE path_nodes SET lead = $cbse$[[lead]]
History, geography, and civics, taught as Social Science.

[[checks]]
What they learn
- History: what changed, and when
- Geography: places and maps
- Civics: how people are governed

[[example]]
ONE EXAMPLE
Look at a map in the book and name one river and the state it runs through.

[[note]]
WHAT MAY VARY
Some schools use one period. Some split history, geography, and civics across the week. It is still one Class 6 subject. It is not the Class 10 exam.

[[ask-school]]
How have you split Social Science across the week?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-sst';

UPDATE path_nodes SET lead = $cbse$[[lead]]
A first look at patterns, steps, and AI. It sits inside classes your child already has.

[[checks]]
What they practise
- A pattern or a set of steps
- A classroom activity about how a computer follows instructions
- Saying what a machine should not decide for a person

[[example]]
ONE EXAMPLE
Write steps for a classmate to draw a square. If a step is missing, the drawing goes wrong. That is the idea. It is not a coding course.

[[note]]
WHAT THIS IS NOT
Not its own period. Not a device you must buy. Not a board exam.

[[ask-school]]
In which subjects will my child do this, and what will I see at home?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art, physical education, and a first look at work are on the Class 6 plan.

[[checks]]
What they learn
- An art activity
- Games, health, and fitness
- A simple look at a kind of work

[[example]]
ONE EXAMPLE
Visit or watch one kind of work, such as how a meal is prepared at school, and say the steps.

[[note]]
WHAT THIS IS NOT
CBSE does not hold a board exam in these. The school chooses the activities.

[[ask-school]]
What exactly is on the timetable for art, sport, and work?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-other';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 6 has no CBSE exam. Tests, if any, stay with the school.

[[checks]]
What a Class 6 mark is
- Set by the school
- Kept by the school
- Not a board result

[[example]]
ONE EXAMPLE
A unit test in Science is the teacher's test. It is not sent to CBSE as a board mark.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam at the end of Class 10.

[[ask-school]]
How often do you test, and do those marks leave the school?
$cbse$, updated_at = now() WHERE slug = 'cbse-g6-board';

-- Class 7
UPDATE path_nodes SET lead = $cbse$[[lead]]
First language, second language, and third language.

[[checks]]
The three languages
- First language
- Second language
- Third language

[[example]]
ONE EXAMPLE
If Class 6 was English, Hindi, and Sanskrit, Class 7 usually keeps those three unless the school says one can change.

[[note]]
WHAT CHANGED
New third-language books for Class 7 arrive in 2027-28. This year, use the languages already on the timetable. In a school in India, at least two of the three are Indian languages.

[[ask-school]]
What are the three language names this year?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The Class 7 mathematics book is the list of topics.

[[checks]]
What they learn
- The chapters in the Class 7 book
- More algebra than in Class 6
- Showing the working

[[example]]
ONE EXAMPLE
A question from the Class 7 book, with the working written out. A tuition sheet is not a second official list.

[[note]]
WHAT MAY VARY
Ask for the book name for this session. Editions change. The school should name the one it was told to use.

[[ask-school]]
Which mathematics book is Class 7 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Science is its own subject. The chapters are the Class 7 science book for this session.

[[checks]]
What they learn
- The chapters in that book
- A short practical or observation
- Writing the result in their own words

[[example]]
ONE EXAMPLE
Do the activity in the chapter, then write three lines on what changed.

[[note]]
WHAT MAY VARY
Ask which edition the school is using this year.

[[ask-school]]
Which science book is Class 7 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-sci';

UPDATE path_nodes SET lead = $cbse$[[lead]]
History, geography, and civics, in the Class 7 Social Science book.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Read one history section and say what changed, and why the book says it changed.

[[note]]
WHAT THIS IS NOT
Not the Class 10 board syllabus.

[[ask-school]]
How is Social Science split across the week?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-sst';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Still inside the other subjects. Not its own period and not an exam.

[[checks]]
What they practise
- Steps and patterns
- A classroom look at how instructions are followed
- What should stay a human decision

[[example]]
ONE EXAMPLE
Give a partner four instructions to draw a shape. Compare the drawing with what you meant.

[[note]]
WHAT THIS IS NOT
Not a separate subject. Not a board mark.

[[ask-school]]
Is this inside other subjects, or have you given it its own period?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art, physical education, and work are on the Class 7 plan.

[[checks]]
What they learn
- Art work
- Health and games
- One kind of skill or work

[[example]]
ONE EXAMPLE
Try one skill the school offers, such as a simple repair or a kitchen task, and list the tools used.

[[note]]
WHAT THIS IS NOT
CBSE does not examine these.

[[ask-school]]
What work or skill lesson is on the timetable?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-other';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 7 has no CBSE exam. Marks stay with the school.

[[checks]]
What a Class 7 mark is
- The school's test or project
- A report you can ask for
- Not a CBSE board result

[[example]]
ONE EXAMPLE
A Class 7 final paper set by the school stays in the school. It is not uploaded as a board mark.

[[note]]
WHAT THIS IS NOT
These marks do not go to CBSE as a board result.

[[ask-school]]
Do these marks go anywhere outside the school?
$cbse$, updated_at = now() WHERE slug = 'cbse-g7-board';

-- Class 8
UPDATE path_nodes SET lead = $cbse$[[lead]]
First language, second language, and third language.

[[checks]]
What has to be done
- Study all three
- Pass the third language at school by the end of Class 8
- If it is not passed, the school tests it again in Class 9 or Class 10

[[example]]
ONE EXAMPLE
The third language is Sanskrit. The school test is in June. A pass in that test is what CBSE asks for. It is not a Class 10 board paper.

[[note]]
THE PASS
The newer books for this language reach Class 8 in 2028-29. This year, ask which language is already on the timetable.

[[ask-school]]
Which third language, and what mark counts as a pass?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The Class 8 mathematics book. Class 9 mathematics is a different book.

[[checks]]
What they learn
- The chapters in the Class 8 book
- Algebra, shapes, and data from that book
- Written working

[[example]]
ONE EXAMPLE
Finish a chapter exercise from the Class 8 book. Do not use a Class 9 guide as this year's list.

[[note]]
WHAT MAY VARY
Ask the school to name the book. Class 9 has its own book next year.

[[ask-school]]
Which mathematics book is Class 8 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The Class 8 science book. Class 9 Science is a different course.

[[checks]]
What they learn
- The chapters in the Class 8 book
- Practicals the school sets from that book
- Writing what was observed

[[example]]
ONE EXAMPLE
Do the practical in the chapter and write what you measured. A Class 9 guide is not this year's list.

[[note]]
WHAT MAY VARY
Ask which book and which practicals are on this year's plan.

[[ask-school]]
Which science book is Class 8 using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-sci';

UPDATE path_nodes SET lead = $cbse$[[lead]]
History, geography, and civics in the Class 8 book.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Answer one civics question from the book in five lines, using an example from your city.

[[note]]
WHAT THIS IS NOT
The school marks it. It is not the Class 10 exam.

[[ask-school]]
How is Class 8 Social Science taught?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-sst';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Still inside other classes. Not its own subject.

[[checks]]
What they practise
- Steps and patterns
- A first look at AI in a classroom activity
- What a person should still decide

[[example]]
ONE EXAMPLE
Sort photos into two groups and say the rule you used. That is the activity. It is not a coding exam.

[[note]]
LATER, NOT THIS YEAR
CBSE brings this in as its own subject from 2027-28, starting in Class 9. Class 8 is not that year.

[[ask-school]]
Is this inside other subjects, or its own period?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-ct';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art, physical education, and work. The school may mark them.

[[checks]]
What they learn
- Art
- Health and games
- A skill or work lesson

[[example]]
ONE EXAMPLE
Complete the work lesson the school set, such as a simple project, and say what skill it practised.

[[note]]
WHAT THIS IS NOT
CBSE does not examine these as board papers.

[[ask-school]]
What skill or work lesson is on the Class 8 timetable?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-other';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Class 8 has no CBSE exam.

[[checks]]
What a Class 8 exam is
- Set by the school, if the school holds one
- Not the board exam
- Not a choice of Class 11 subjects

[[example]]
ONE EXAMPLE
A school calls its Class 8 final "the board rehearsal". It is still a school paper. CBSE does not set it.

[[note]]
WORDS ON THIS PAGE
The board exam is the public CBSE exam at the end of Class 10.

[[ask-school]]
Is your Class 8 exam only a school exam?
$cbse$, updated_at = now() WHERE slug = 'cbse-g8-board';

-- Class 9
UPDATE path_nodes SET lead = $cbse$[[lead]]
Two main languages. They must be different from each other.

[[checks]]
What they learn
- Reading and writing in the first language
- Reading and writing in the second language
- A test that can differ even if the book is the same

[[example]]
ONE EXAMPLE
Hindi as the first language and English as the second. The books may match. The test for each one does not.

[[note]]
WHAT MAY VARY
The school chooses them from the CBSE language list. In a school in India, at least two of the three languages are Indian languages.

[[ask-school]]
Which language is first, which is second, and which books?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
A third language is required from 2026-27. The school marks it. CBSE does not set a board paper for it.

[[checks]]
This year's book
- The Class 6 book for that language
- Plus one local story, poem, or other short text

[[example]]
ONE EXAMPLE
The third language is Malayalam. The book is the Class 6 Malayalam book, plus one local poem. The school sets the test.

[[note]]
WHY A CLASS 6 BOOK
CBSE is bringing this in step by step. Passing it is required before CBSE issues the Class 10 pass certificate. Not passing it does not, by itself, stop the admit card for the other subjects.

[[ask-school]]
Which third language, which book, and how do you mark it?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-r3';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Every child studies the same mathematics course and sits that paper.

[[checks]]
What they learn
- The Class 9 mathematics course
- One paper for every child: 80 marks, 3 hours, set by the school
- Extra Advanced topics only if you opt in

[[compare]]
Standard, for everyone | Advanced, only if you opt in
The Class 9 course | Extra topics beyond that course
School exam, 80 marks, 3 hours | An extra short paper
Counts in the result | Does not get added to the total

[[example]]
ONE EXAMPLE
Your child sits the same 3-hour paper as the class. If you opt for Advanced, there is a second, shorter paper. Those marks are not added to the total.

[[note]]
WHAT THIS REPLACES
Maths Basic and Maths Standard were the old Class 10 choice. They are not the Class 9 choice from 2026-27. This page does not sign your child up.

[[ask-school]]
Is Mathematics Advanced offered, and what does my child study if we say no?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Every child studies the same science course.

[[checks]]
The four areas
- Living things
- Matter, and how it behaves
- Motion, force, work, and sound
- Earth as a system

[[example]]
ONE EXAMPLE
A question on how a plant takes in water sits in "living things". The Advanced paper, if you opt in, is extra and is not added to the total.

[[note]]
ADVANCED
Science Advanced is an optional extra paper. The school has to offer it before you can opt in.

[[ask-school]]
Do you offer Science Advanced, and which of the four areas takes the most time?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-sci';

UPDATE path_nodes SET lead = $cbse$[[lead]]
History, geography, and civics. This subject is meant to continue in Class 10.

[[checks]]
What they learn
- History
- Geography
- Civics

[[example]]
ONE EXAMPLE
Answer a map question from the geography section and a short history question in the same paper. The school sets this paper. The CBSE paper is next year.

[[note]]
THIS YEAR'S EXAM
The school sets the Class 9 exam. The CBSE board paper is next year, on the Class 10 course.

[[ask-school]]
How have you split history, geography, and civics?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-sst';

UPDATE path_nodes SET lead = $cbse$[[lead]]
A new subject about people and society. It starts when the NCERT textbook is available.

[[checks]]
What to check
- Has the textbook arrived?
- Has the school started the classes?
- Is it marked by the school, not by CBSE?

[[example]]
ONE EXAMPLE
The book is not in the school yet. The honest answer is "not started". The school should not invent a stand-in syllabus.

[[note]]
IF THE BOOK IS NOT HERE
Ask whether the book has arrived before you expect classes or marks.

[[ask-school]]
Has this subject started, and which book are you using?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-society';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Art, physical education, and work are required. The school marks them. They are not board papers.

[[checks]]
What they do
- Art
- Physical education
- A work or skill lesson

[[example]]
ONE EXAMPLE
The school records art as "completed" after the portfolio. That record is not a board mark.

[[note]]
AN EXTRA SUBJECT
A further academic subject is possible only if this school offers it.

[[ask-school]]
How do you mark art, physical education, and work?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-other';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The school sets this exam. CBSE does not.

[[checks]]
Both parts are required
- Classwork and projects through the year
- A final paper set by the school
- Main papers are 80 marks and 3 hours

[[example]]
ONE EXAMPLE
Science classwork is 20 marks from the school. The final paper is 80 marks, also set by the school. Together they are the Class 9 result. They are not the board exam.

[[note]]
NOT THE BOARD EXAM
The board exam is at the end of Class 10, on the Class 10 syllabus. Computational Thinking and AI become their own subject in 2027-28, not this year.

[[ask-school]]
What share is classwork, and what share is the final paper?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-exam';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Not a Class 9 subject this year.

[[checks]]
What is true this year
- No CBSE subject called Computational Thinking and AI
- No board mark for it
- A school may still run a club or an activity

[[example]]
ONE EXAMPLE
The school runs a Friday AI club. That club is the school's activity. It is not a Class 9 board subject.

[[note]]
WHEN IT STARTS
CBSE adds it for Classes 9 to 12 in 2027-28.

[[ask-school]]
Have you started anything early, and does it count in the mark?
$cbse$, updated_at = now() WHERE slug = 'cbse-g9-ct';

-- Class 10
UPDATE path_nodes SET lead = $cbse$[[lead]]
Both languages are board subjects. The school registers the names.

[[checks]]
What they are
- First language, a board paper
- Second language, a board paper
- Two of the five compulsory board subjects

[[example]]
ONE EXAMPLE
English and Hindi are registered. Both have a board paper. The names on the registration are the ones that count.

[[note]]
WHAT MAY VARY
The school chooses which two, from the languages it teaches. Ask for the registered names, not the nicknames.

[[ask-school]]
Which two languages is my child registered for?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-lang';

UPDATE path_nodes SET lead = $cbse$[[lead]]
This Class 10 batch still chooses one maths paper.

[[checks]]
What they learn
- The Class 10 mathematics course
- One board paper: Standard or Basic
- Classwork marks as well as the board paper

[[compare]]
Standard | Basic
The usual paper if maths may continue in Class 11 | The core paper if maths will not continue
Still available this year | Still available this year, for this batch only

[[example]]
ONE EXAMPLE
Your child is registered for Basic. The board paper is the Basic paper. Changing to Standard is a school registration change. This page does not change it.

[[note]]
THE NEXT BATCH
From 2026-27, new Class 9 students do not get Basic or Standard. They all study the same course, and Advanced is an optional extra. Your Class 10 child is not on that new rule.

[[ask-school]]
Which paper is my child registered for?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-math';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Science is a board subject. The list is the Class 10 science course for this session.

[[checks]]
Both parts are required
- Classwork marks from the school
- The CBSE board paper

[[example]]
ONE EXAMPLE
The practical and the project are the classwork marks. The written board paper is the other part. Missing either one means Science is not complete.

[[note]]
WHAT MAY VARY
The school splits the course across the year. Ask for that split. The syllabus is still the Class 10 science course CBSE published for this session.

[[ask-school]]
How have you split the science course across the year?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-sci';

UPDATE path_nodes SET lead = $cbse$[[lead]]
History, geography, civics, and economics. This is one of the five board subjects.

[[checks]]
What the paper covers
- History
- Geography
- Civics
- Economics

[[example]]
ONE EXAMPLE
One board paper can include a map question and a short economics question. They are parts of the same subject.

[[note]]
WHAT MAY VARY
The school divides the teaching across the year. The board paper is still one Social Science paper.

[[ask-school]]
How have you divided Social Science before the board exam?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-sst';

UPDATE path_nodes SET lead = $cbse$[[lead]]
Five subjects are compulsory. Up to two more can be added.

[[checks]]
The five compulsory board subjects
- First language
- Second language
- Mathematics
- Science
- Social Science

[[example]]
ONE EXAMPLE
Information Technology is registered as a sixth subject. It is a board paper only because the school registered it. This page cannot add it.

[[note]]
THE EXTRA ONES
A skill subject, or another subject the school offers, can be an extra board paper.

[[ask-school]]
Is my child registered for a sixth subject? What is it called?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-extra';

UPDATE path_nodes SET lead = $cbse$[[lead]]
For this Class 10 batch, the third language is not a board paper. It still has to be passed at school.

[[checks]]
What the school must have
- A third language already studied
- A pass in the school's own test
- That pass done before the board admit card

[[example]]
ONE EXAMPLE
Sanskrit was not passed in Class 8. The school tests it again in Class 10. Until that pass is recorded, CBSE does not give the admit card.

[[note]]
IF IT WAS NOT PASSED EARLIER
The school can test it in Class 9, and again in Class 10.

[[ask-school]]
Has my child passed the third language, and which language was it?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-r3';

UPDATE path_nodes SET lead = $cbse$[[lead]]
The school records these. They are not board papers, and they still have to be completed.

[[checks]]
What the school records
- Art
- Health and physical education
- Work experience, recorded with health and physical education

[[example]]
ONE EXAMPLE
The school marks health and physical education as completed after the year's activities. There is no CBSE written paper for it.

[[note]]
WHAT MAY VARY
Ask how your school records them, and whether they are already complete.

[[ask-school]]
How are these recorded, and are they already complete?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-internal';

UPDATE path_nodes SET lead = $cbse$[[lead]]
CBSE sets the board paper on this year's Class 10 course.

[[checks]]
Both parts are required
- Classwork marks from the school
- The board paper
- Missing either one means that subject is not complete

[[example]]
ONE EXAMPLE
Mathematics classwork is with the school. The written paper is set by CBSE. Both have to be there for the subject to count.

[[note]]
WHAT CLASS 10 IS NOT
Class 10 is the end of this stage of school. It is not Class 12. It does not choose Class 11 subjects by itself.

[[ask-school]]
What has the school said about classwork marks and the board paper?
$cbse$, updated_at = now() WHERE slug = 'cbse-g10-board';

COMMIT;
