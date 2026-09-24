-- Visual answers for Child's Path. Plain leads stay plain.
-- Blocks are rendered by the app. Safe to re-run.

BEGIN;

UPDATE path_nodes SET
  title = 'Your timetable and IB subjects',
  summary = 'Eight subject groups. The school chooses the classes.',
  ask_prompt_default = 'Which subjects is your child actually taking this year?',
  lead = $lead$[[lead]]
MYP organises learning into eight subject groups.

[[compare]]
School A | School B
# Science | Science
Integrated science | Separate science classes
# Additional language | Additional language
French | Spanish

[[checks]]
- In the final two MYP years, schools can use permitted six-group options.
- Your timetable shows your actual classes.

[[text]]
For example, School A and School B are both IB schools. Your child studies only the classes on your school's timetable.

[[ask-school]]
Which subjects and levels is my child taking?

[[more]]
Will my child take all eight?
MYP years 4 and 5 can use a permitted six-group option within IB rules. The school confirms the combination available to your child.

[[view tiles]]
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-groups';

UPDATE path_nodes SET
  summary = 'Read, write and interpret texts',
  ask_prompt_default = 'Which language is my child''s language and literature course?',
  lead = $lead$[[lead]]
Read, write and interpret texts in the school's main language.

[[checks]]
What they learn
- Reading books, articles and other texts
- Writing for different purposes
- Speaking and listening in that language

[[example]]
ONE EXAMPLE
Read a short story and explain how the ending changes what you thought.

[[note]]
WHAT MAY VARY
The school chooses the language of this course. It is the main language class, not the extra language.

[[ask-school]]
Which language is my child's language and literature course?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-langlit';

UPDATE path_nodes SET
  summary = 'Communicate in another language',
  ask_prompt_default = 'Which additional language is my child taking, and can it still be changed?',
  lead = $lead$[[lead]]
Communicate in a language other than the school's main language.

[[checks]]
What they learn
- Everyday and classroom language
- Reading and writing at the student's phase
- How to move up from the phase they are in

[[text]]
A phase is a level of that language, not a school grade. Phase 3 French is not Grade 3.

[[note]]
WHAT MAY VARY
The school chooses which languages it teaches. A change is not available at any time. Some schools close changes before Grade 10.

[[ask-school]]
Which additional language is my child taking, and can it still be changed this year?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-langacq';

UPDATE path_nodes SET
  summary = 'History, places and human decisions',
  ask_prompt_default = 'What does the school call this subject on the Grade 9 timetable?',
  lead = $lead$[[lead]]
History, places and how people make decisions.

[[checks]]
What they learn
- Ask questions about people and places
- Use evidence from sources
- Explain a change or a decision

[[example]]
ONE EXAMPLE
Compare two cities and explain why one grew faster.

[[note]]
WHAT MAY VARY
Schools name this differently: history, geography, integrated humanities, or another title.

[[ask-school]]
What is this subject called on my child's Grade 9 timetable?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-soc';

UPDATE path_nodes SET
  summary = 'Living things, materials and the physical world',
  ask_prompt_default = 'Is Grade 9 science one combined course or separate sciences?',
  lead = $lead$[[lead]]
Living things, materials and the physical world.

[[checks]]
What they learn
- How to investigate a question
- How to use evidence
- Ideas in biology, chemistry and physics

[[pair]]
Integrated science | One class that combines biology, chemistry and physics.
Separate sciences | Biology, chemistry and physics as their own classes.

[[example]]
ONE EXAMPLE
Test which material keeps a drink cold longer, then explain the result.

[[note]]
WHAT MAY VARY
The school chooses one combined course or separate sciences. This is not a Diploma science choice.

[[ask-school]]
Is Grade 9 science one combined course or separate sciences?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-sci';

UPDATE path_nodes SET
  summary = 'Numbers, patterns and problem-solving',
  ask_prompt_default = 'Which maths course is my child taking, and what would changing it involve?',
  lead = $lead$[[lead]]
Numbers, patterns and problem-solving.

[[checks]]
What they learn
- Number and algebra
- Geometry and trigonometry
- Statistics and probability

[[example]]
ONE EXAMPLE
Compare two mobile plans: which costs less at different levels of usage?

[[pair]]
Standard | Builds the main mathematical knowledge and skills.
Extended | Adds topics and skills for greater breadth and depth.

[[note]]
WHAT MAY VARY
The school may offer Standard and Extended mathematics. Confirm its courses and how students are placed. Analysis and approaches, and applications and interpretation, are Diploma courses after Grade 10.

[[ask-school]]
Which maths course is my child taking, and what would changing it involve?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-math';

UPDATE path_nodes SET
  summary = 'Create, perform and respond to art',
  ask_prompt_default = 'Is an arts subject on my child''s Grade 9 timetable?',
  lead = $lead$[[lead]]
Create, perform and respond to art.

[[checks]]
What they learn
- Make or perform a piece of work
- Look closely at other artists' work
- Explain the choices in their own work

[[example]]
ONE EXAMPLE
Compose a short piece of music for a scene and say why those sounds fit.

[[note]]
WHAT MAY VARY
Arts is on the timetable only if the school is teaching an arts subject this year. The art form depends on the school.

[[ask-school]]
Is an arts subject on my child's Grade 9 timetable, and which art is it?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-arts';

UPDATE path_nodes SET
  summary = 'Movement, teamwork and healthy living',
  ask_prompt_default = 'How is physical and health education reported this year?',
  lead = $lead$[[lead]]
Movement, teamwork and healthy living.

[[checks]]
What they learn
- Move with control in different activities
- Work with other students
- Plan for health, not only for a game

[[example]]
ONE EXAMPLE
Plan a warm-up for the class and explain why each part is there.

[[note]]
WHAT MAY VARY
When the school offers it, this is a taught subject with MYP grades, not only a games period.

[[ask-school]]
How is physical and health education shown on my child's report?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-phe';

UPDATE path_nodes SET
  summary = 'Solve a problem by making something',
  ask_prompt_default = 'What will students design, and what evidence should they keep?',
  lead = $lead$[[lead]]
Solve a problem by making something.

[[checks]]
What they learn
- Investigate a problem
- Develop and make a solution
- Test it and suggest improvements

[[example]]
ONE EXAMPLE
Design a desk organiser, build it and check whether the items fit.

[[note]]
WHAT MAY VARY
Projects can involve physical products or digital solutions. Available tools and courses depend on the school. Some schools use another name on the report.

[[ask-school]]
What will students design, and what evidence should they keep?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-design';

UPDATE path_nodes SET
  summary = 'No. Two IB schools can teach different subjects.',
  ask_prompt_default = 'How different was your school''s Grade 9 list from another IB school?',
  lead = $lead$[[lead]]
No. Two IB schools can teach different subjects in Grade 9.

[[compare]]
School A | School B
# Science | Science
Integrated science | Separate science classes
# Additional language | Additional language
French | Spanish

[[text]]
For example, both schools follow the IB. Your child studies only your school's timetable.

[[ask-school]]
Which subjects are on my child's timetable this year?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-same';

UPDATE path_nodes SET
  summary = '8 is the top mark on one criterion.',
  ask_prompt_default = 'What does this 8 refer to on my child''s report?',
  lead = $lead$[[lead]]
8 is the top mark on one criterion.

[[checks]]
- A criterion is one part the teacher marks.
- Each criterion is scored from 0 to 8.
- 8 is the highest mark on that criterion.
- 0 means the work did not meet the lowest description.

[[ask-school]]
What does this 8 refer to on my child's report?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-eight';

UPDATE path_nodes SET
  title = 'What changes in Grade 10?',
  summary = 'The final MYP year: subjects, the personal project, and optional exams.',
  lead = $lead$[[lead]]
In this school-stage view, Grade 10 is the final MYP year.

[[checks]]
- Subject learning continues alongside the personal project.
- Some students also take registered IB eAssessments.

[[note]]
PLAN
Subjects, project milestones, and the next programme choice.

[[text]]
Grade 10 here is Class 10, not a university year. JEE Main and NEET need a Class 12 equivalent. MYP is not that.
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-subjects';

UPDATE path_nodes SET
  summary = 'Process, outcome, and a report. Finished in the final MYP year.',
  ask_prompt_default = 'When does the personal project start, and what are the checkpoints?',
  lead = $lead$[[lead]]
A student-led project in the final MYP year. It is not the Diploma extended essay.

[[steps]]
Process | The student investigates and plans, with a supervisor.
Outcome | Something they make, do, or write.
Report | A written account. The supervisor assesses it. IB may moderate a sample.

[[example]]
FOR EXAMPLE
A student looks at plastic waste in the school canteen, tries one change, and writes up what happened.

[[ask-school]]
When does the personal project start, and what are the checkpoints?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-pp-what';

UPDATE path_nodes SET
  title = 'IB Diploma, at a glance',
  summary = 'A two-year senior-school route after Grade 10.',
  lead = $lead$[[lead]]
A senior-school route, usually in Grades 11–12.

[[facts]]
2 | years | Programme length
6 | subjects | A planned combination
+ | core | Work beyond subjects

[[text]]
The core is Theory of Knowledge, the Extended Essay, and Creativity, Activity, Service. This comes after Grade 10. It is not the programme your child is in now.

[[checks]]
- In India, a completed IB Diploma can be treated as a Class 12 equivalent. MYP Grade 10 is not that.
- A college can still set its own subject conditions.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-what-g9', 'ib-dp-what-g10');

UPDATE path_nodes SET
  title = 'HL and SL',
  summary = 'Same subject family. Different depth.',
  ask_prompt_default = 'Which HL and SL plan can the school actually offer?',
  lead = $lead$[[lead]]
Same subject family. Different depth and scope.

[[pair]]
HL | Higher Level. Greater depth and scope. 240 teaching hours across the course, not homework hours.
SL | Standard Level. A smaller course scope. 150 teaching hours across the course, not homework hours.

[[note]]
EXAMPLE PLAN
3 Higher Level + 3 Standard Level. Six subjects in total. Another plan is 4 Higher Level and 2 Standard Level. The school confirms which plan it can offer.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-hlsl-g9', 'ib-dp-hlsl-g10');

UPDATE path_nodes SET
  title = 'Your six-subject plan',
  summary = 'Six subjects. The school confirms the combination.',
  lead = $lead$[[lead]]
Build one plan with six subjects.

[[text]]
A usual pattern is language and literature, an additional language, people and society, a science, mathematics, and arts or an extra subject. Tap a subject area for a plain-language explanation. Your school confirms permitted combinations and timetable availability.

[[view tiles]]
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-areas-g9', 'ib-dp-areas-g10');

UPDATE path_nodes SET
  summary = 'Numbers, patterns and problem-solving. AA or AI, if the school offers them.',
  updated_at = now()
WHERE slug IN ('ib-dp-math-g9', 'ib-dp-math-g10');

UPDATE path_nodes SET
  summary = 'Living things, materials and the physical world.',
  updated_at = now()
WHERE slug IN ('ib-dp-sci-g9', 'ib-dp-sci-g10');

UPDATE path_nodes SET
  summary = 'The school''s language courses. The school sets the combination.',
  updated_at = now()
WHERE slug IN ('ib-dp-lang-g9', 'ib-dp-lang-g10');

UPDATE path_nodes SET
  summary = 'History, places and human decisions.',
  updated_at = now()
WHERE slug IN ('ib-dp-soc-g9', 'ib-dp-soc-g10');

UPDATE path_nodes SET
  summary = 'Create, perform and respond to art, if the school offers it.',
  updated_at = now()
WHERE slug IN ('ib-dp-arts-g9', 'ib-dp-arts-g10');

UPDATE path_nodes SET
  summary = 'The same kinds of subjects. The exact classes can change.',
  ask_prompt_default = 'Which Grade 9 classes continue, and which ones can still change?',
  lead = $lead$[[lead]]
The same kinds of subjects continue. The exact classes can change.

[[pair]]
Grade 9 | The classes on this year's timetable.
Grade 10 | The school decides which of those classes stay, and which can still change.

[[example]]
FOR EXAMPLE
Grade 9 science might be one combined class. Grade 10 at the same school might teach biology, chemistry, and physics separately. Another school might keep the combined class.

[[checks]]
- The eight subject groups are still the frame.
- A subject in the IB guide is not automatically taught.

[[ask-school]]
Which Grade 9 classes continue, and which ones can still change?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-subj-same';

UPDATE path_nodes SET
  summary = 'Finished in Grade 10. Some schools mention it earlier.',
  ask_prompt_default = 'When do students begin the personal project, and when is the report due?',
  lead = $lead$[[lead]]
The project is finished in Grade 10.

[[checks]]
- Grade 10 is the last year of this programme, and the project is completed then.
- Some schools start talking about it in Grade 9.

[[note]]
WHAT MAY VARY
The school sets the start date and the date the report is due.

[[ask-school]]
When do students begin the personal project, and when is the report due?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-pp-when';

UPDATE path_nodes SET
  summary = 'In India, this Grade 10 is the Class 10 stage.',
  ask_prompt_default = 'How does the school describe Grade 10 for Class 10 records?',
  lead = $lead$[[lead]]
Yes. In India, this Grade 10 is the Class 10 stage.

[[checks]]
- Finishing this programme is the end of Class 10, not Class 12.
- It is the end of secondary school, before Classes 11 and 12.

[[pair]]
This programme | The Class 10 stage.
A CBSE Class 10 exam | A different paper. Not the same exam.

[[ask-school]]
How does the school describe Grade 10 on records for Class 10?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-class10';

UPDATE path_nodes SET
  summary = 'No. University, JEE, and NEET need Class 12.',
  ask_prompt_default = 'What does the school offer after Grade 10?',
  lead = $lead$[[lead]]
No. University, JEE, and NEET need Class 12.

[[pair]]
This year | Class 10. Not enough for university, JEE, or NEET.
Class 12 | Comes later. For example, the IB Diploma, or CBSE Classes 11 and 12.

[[checks]]
- Opening this page does not choose the next step.

[[ask-school]]
What does the school offer after Grade 10?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-not-plus2';

COMMIT;
