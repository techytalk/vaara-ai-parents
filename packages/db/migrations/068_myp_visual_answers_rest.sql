-- Remaining Child's Path answers, in the same card layout.
-- Safe to re-run. Does not touch pages that already use [[ blocks.

BEGIN;

UPDATE path_nodes SET
  lead = $lead$[[lead]]
These are routes after Grade 10.

[[checks]]
- Opening one does not enrol your child.
- It does not change the curriculum or grade saved on this profile.
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-ahead';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Grade 9 is the year your child is in now.

[[checks]]
- It is still the Middle Years Programme.
- Exploring a topic does not change the board or grade.
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-now';

UPDATE path_nodes SET
  summary = 'Who to talk to about a subject, a report mark, or a language.',
  lead = $lead$[[lead]]
The school is the place that can explain this year's report.

[[checks]]
- Who do I talk to about a subject?
- What does an 8 on the report refer to?
- Can the extra language still change?

[[note]]
WHAT MAY VARY
A language change is not available at any time. The school sets the deadline.

[[ask-school]]
Who do I talk to about a subject, and can the extra language still change?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-now-support';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Only the school can allow a subject to be dropped.

[[checks]]
- Some subjects are required this year.
- This page cannot remove one.

[[ask-school]]
Which subjects are required this year, and which can be dropped?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-drop';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
No. Grade 9 has no IB board exam.

[[checks]]
- The school marks tests, projects, and homework during the year.
- Grade 10 is the last year of this programme.

[[ask-school]]
Which tests does the school set in Grade 9, and when?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-exam';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Four questions are enough for the next meeting.

[[checks]]
- Which subjects are already fixed?
- Which ones can still change before Grade 10?
- What does an 8 on the report refer to?
- Are Design, Arts, and Physical education separate classes here?

[[ask-school]]
Which subjects are already fixed, and which can still change before Grade 10?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-meeting';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Not every subject is fixed for next year.

[[checks]]
- The school decides what is already locked.
- It also decides what can still change before Grade 10.
- Looking at this page does not change a subject.

[[ask-school]]
Which subjects are locked, and which can still change before Grade 10?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-flex';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The timetable is the list for this year. The IB menu is wider than that.

[[checks]]
- IB names eight subject areas.
- The school does not have to teach all of them.
- A subject that is not on the timetable is not being taught now.

[[ask-school]]
Which subjects are on my child's timetable this year?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-list';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Grade 9 work is set by the school. There is no IB board exam this year.

[[checks]]
- Tests, projects, and homework come from the school.
- The heavier year is usually Grade 10.

[[ask-school]]
What are this year's test and project dates?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-now-workload';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Yes. Leaving means joining another school.

[[checks]]
- Some families leave during Grade 9 or Grade 10.
- The child then follows that school's timetable.
- This page does not change the curriculum or grade saved here.

[[ask-school]]
If we leave before Grade 10 ends, which class would you offer?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-when';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
No. A year in the middle is not a Class 10 certificate.

[[pair]]
Finishing this programme | In India, that is the Class 10 stage.
Leaving in the middle | A school report for the time already completed. Not Class 10, and not Class 12.

[[ask-school]]
What document will the school give if my child leaves early?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-partial';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
No. Those are two different decisions.

[[pair]]
This page | Leaving while your child is still in Grade 9 or 10.
After Grade 10 | The Diploma, Cambridge A Level, and CBSE or ISC Classes 11–12. Those are under Explore ahead.
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-after';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The personal project is finished in Grade 10.

[[checks]]
- IB checks that Grade 10 report.
- If your child leaves before Grade 10 is finished, it is not completed as an IB project.

[[ask-school]]
What will the school record for project work already done?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-project';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Ask both schools before a move.

[[checks]]
- Which class will the new school offer?
- Which subjects will it place?
- What papers will the current school give you?
- Would the move happen before Grade 10 ends, or only after it?

[[ask-school]]
Which class, which subjects, and which papers should we confirm before a move?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-ask';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The new school names the class.

[[checks]]
- Leaving during Grade 9 or 10 usually means the matching class, not a jump to Class 11.
- Subjects do not automatically carry over.

[[ask-school]]
Which class and which subjects would you offer?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-grade';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Families usually ask about the same school year on another board.

[[checks]]
- CBSE, Cambridge, ICSE, or a state board.
- None of these is automatic.
- The new school decides if it has a place.

[[ask-school]]
Do you have a place in the same school year, and on which curriculum?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-boards';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The school your child would be joining decides.

[[checks]]
- It says whether it has a place, which class, and which subjects.
- The current school decides which reports it will share, and when.
- This page does not list schools.

[[ask-school]]
What reports do you need before you can offer a place?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-who';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Staying means finishing Grade 10, usually at the same school.

[[checks]]
- That year is the subject classes plus the personal project.
- The school confirms there is a place.
- It does not change the board, and it does not start the Diploma.

[[ask-school]]
Is there a Grade 10 place, and what does that year include?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-stay';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
No. Staying keeps the same IB programme.

[[checks]]
- It does not move your child to CBSE, Cambridge, or a state board.
- It does not start the Diploma.
- The Diploma and other Class 11–12 choices come after Grade 10.
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-board';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Continuing means finishing Grade 10 at the school.

[[checks]]
- The year includes subject classes and the personal project.
- The school confirms there is a place.
- It does not move your child into the Diploma.
- It does not change the curriculum saved on this profile.

[[ask-school]]
What does the school require before it confirms Grade 10?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-continue';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Four things are worth confirming before Grade 10.

[[checks]]
- Is Grade 10 the last year of this programme at our school?
- When does the personal project start, and when is it due?
- Does the school offer the optional IB exams?
- Which subjects are already fixed for Grade 10?

[[ask-school]]
Which subjects are already fixed for Grade 10, and when does the project start?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-confirm';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
No. eAssessment is optional, and only if this school signs students up.

[[checks]]
- It is a set of IB exams and coursework in Grade 10.
- A normal school report is not the same thing.

[[ask-school]]
Does this school offer eAssessment, and for which subjects?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-eassess';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The project is part of finishing Grade 10. Other IB exams are extra.

[[checks]]
- The teacher marks the project report. IB checks that marking.
- Computer exams and coursework folders happen only if the school offers them.

[[ask-school]]
Does the school register students for anything beyond the personal project?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-exam';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
An extra IB award. It is not the report the school sends home.

[[facts]]
8 | parts | Six subjects, one mixed paper, and the personal project
28 | of 56 | The least IB asks for, with at least 3 in every part

[[note]]
WHAT MAY VARY
The school has to sign your child up for the full set. It also has a service requirement. Each part of this certificate is graded from 1 to 7. That is the certificate, not the mark on one criterion in a school report.

[[ask-school]]
Does the school enter students for the MYP certificate?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-certificate';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The school sets the Grade 10 dates.

[[checks]]
- Project deadlines and test dates come from the school.
- If it offers the optional IB exams, it also decides how students are signed up.

[[ask-school]]
Where are the Grade 10 project and test dates published?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-dates';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Subject classes continue, and the personal project is added.

[[checks]]
- The project runs through the year.
- The school often sets more tests and deadlines than in Grade 9.

[[ask-school]]
What is on the Grade 10 calendar that was not on the Grade 9 calendar?
$lead$,
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-heavier';

UPDATE path_nodes SET
  lead = $lead$[[lead]]
After this programme, schools usually discuss two IB routes.

[[pair]]
Diploma Programme | Six subjects over two years, plus a core.
Career-related Programme | Career study plus at least two Diploma courses.

[[note]]
WHAT MAY VARY
The school decides which of these it teaches.

[[ask-school]]
Which IB route does this school offer after Grade 10?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-continue-g9', 'ib-continue-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Career study, plus at least two Diploma courses.

[[checks]]
- It is not a substitute for the full Diploma.
- In India, university recognition is narrower than the Diploma.
- A college checks that one by one.

[[ask-school]]
Does this school offer the Career-related Programme, and which career study is it?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-cp-g9', 'ib-cp-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
A two-year programme after Grade 10. In India it can count as Class 12.

[[checks]]
- Six subjects, usually 3 Higher Level and 3 Standard Level, plus the core.
- A full Diploma can be treated as Class 12.
- A course certificate of 24 or more points, with 3 Higher Level and 3 Standard Level, can also be treated that way.
- MYP Grade 10 is not that equivalent.

[[note]]
WHAT MAY VARY
A college may still ask for an equivalence certificate. JEE Main lists the Diploma, not MYP. The subject rules on that year's form still apply. Nothing here says this child is eligible.

[[ask-school]]
Does this school offer the Diploma, and which subjects are on its list?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-g9', 'ib-dp-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Entrances that ask for Class 12 look at the Diploma, not this Grade 10.

[[pair]]
JEE Main | Its bulletin lists the IB Diploma. It does not list MYP or IGCSE.
NEET | It expects a Class 12 equivalent with the required sciences. A foreign board often needs an equivalence certificate.

[[checks]]
- Nothing on this screen says this child is eligible.
- Subject rules are on that year's form.

[[ask-school]]
Which classes does the school offer after Grade 10?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-college-g9', 'ib-dp-college-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Three checks, in this order.

[[checks]]
- The school's Diploma subject list.
- The IB subject brief.
- The entrance or college page for the year of entry.

[[note]]
Opening a subject here does not register your child for it.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-check-g9', 'ib-dp-check-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The IB publishes a subject guide. The school publishes a smaller list.

[[checks]]
- A subject in the guide is not automatically taught here.

[[ask-school]]
Which Diploma subjects does this school actually teach?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-subjects-g9', 'ib-dp-subjects-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
This is for parents whose children have already chosen Diploma subjects.

[[checks]]
- Posting a question does not lock a combination for your child.

[[ask-school]]
Which combinations can this timetable actually hold?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-ask-subjects-g9', 'ib-dp-ask-subjects-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
These are future interests. They are not CBSE streams.

[[checks]]
- They do not place your child in PCM or PCB.
- They do not set Higher Level subjects.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-interests-g9', 'ib-dp-interests-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
A language, an arts subject or a second humanity, and people-and-societies subjects the school teaches.

[[note]]
WHAT MAY VARY
The school list is the limit.

[[ask-school]]
Which arts and humanities subjects are on the Diploma list?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-human-g9', 'ib-dp-human-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Economics and Business Management are frequent choices. They are not required by every degree.

[[checks]]
- The university page is the check.
- The school may not teach both.

[[ask-school]]
Does the school teach Economics, Business Management, or both?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-bus-g9', 'ib-dp-bus-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Families often look at Mathematics plus Physics or another science.

[[checks]]
- JEE Main lists the IB Diploma as a qualifying exam.
- It still requires the bulletin's subject set, including Physics and Mathematics.
- Whether those must be Higher Level is a college-by-college check.
- This page does not say your child can sit JEE.

[[ask-school]]
Which mathematics and science courses does the school teach at Higher Level?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-eng-g9', 'ib-dp-eng-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
NEET expects a Class 12 equivalent with the required sciences.

[[pair]]
Diploma | Can be that Class 12 equivalent, under the equivalence rules.
This Grade 10 | Cannot. MYP is not the Class 12 stage.

[[note]]
WHAT MAY VARY
An equivalence certificate is commonly asked for when the board is not CBSE or a state board. Subject rules are on the current NEET bulletin. Taking a science subject is not the same as being eligible.

[[ask-school]]
Which sciences does the school teach, and at which level?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-med-g9', 'ib-dp-med-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Keep a mix the school can still teach.

[[checks]]
- A language.
- One science or one humanity.
- Mathematics at a level the student can sustain.

[[note]]
The point is not to close a group the school can still offer.

[[ask-school]]
Which balanced set can this timetable still hold?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-unsure-interest-g9', 'ib-dp-unsure-interest-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Most students take six subjects: three Higher Level and three Standard Level, plus the core.

[[note]]
WHAT MAY VARY
Which pairs fit together depends on the school timetable.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-understand-g9', 'ib-dp-understand-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Students choose across six areas, or replace the arts with an extra subject.

[[checks]]
- Language and literature
- An additional language
- People and societies
- Sciences
- Mathematics
- Arts, or an extra subject from another area

[[ask-school]]
Which of these combinations does the timetable allow?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-combos-g9', 'ib-dp-combos-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Create, perform, and respond to art, if the school teaches an arts subject.

[[checks]]
- Visual arts and other arts subjects depend on the school.
- A student may take an extra subject from another area instead of the arts, if the timetable allows it.

[[ask-school]]
Which arts subjects are taught, and can a student take an extra subject instead?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-arts-g9', 'ib-dp-arts-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
History, places, and how people decide.

[[checks]]
- History, Economics, and Business Management are examples.
- Only the names on the school list can be chosen.

[[ask-school]]
Which individuals-and-societies subjects are on the school list?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-soc-g9', 'ib-dp-soc-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
One course is the main language. One course is an additional language.

[[pair]]
Language A | Studies in language and literature. The main language course.
Language B | An additional language.

[[note]]
WHAT MAY VARY
The school chooses which languages it teaches. This is not a CBSE second-language rule.

[[ask-school]]
Which languages are offered as Language A and Language B?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-lang-g9', 'ib-dp-lang-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
One mathematics course. Not both.

[[pair]]
Analysis and approaches | More algebra, calculus, and proof.
Applications and interpretation | More statistics, modelling, and technology.

[[checks]]
- Each exists at Higher Level and Standard Level.
- A student takes one of those four.
- A school may not teach every combination.
- This is not the Grade 9 mathematics course.

[[ask-school]]
Which of AA and AI does the school teach, and at which level?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-math-g9', 'ib-dp-math-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Two courses. The same levels.

[[pair]]
Analysis and approaches | Algebra, calculus, and proof.
Applications and interpretation | Statistics, modelling, and technology.

[[checks]]
- Both exist at Higher Level and Standard Level.
- Which one a college prefers is on that college's page.
- There is no single national rule.

[[ask-school]]
Which course does the school recommend, and which does it actually teach?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-math-aa-g9', 'ib-dp-math-aa-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Higher Level is a deeper course. It is not required everywhere.

[[checks]]
- Some engineering and economics courses ask for Mathematics Higher Level.
- Many do not.
- Choosing it here does not register your child.

[[ask-school]]
Does the school teach Mathematics at Higher Level, and for which course?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-math-level-g9', 'ib-dp-math-level-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Check the school first, then the college page.

[[checks]]
- Does the school teach Analysis and approaches, Applications and interpretation, or both?
- At which level?
- What does the entrance or college page require that year?
- Grade 9 mathematics is not this Diploma course.

[[ask-school]]
Which mathematics courses are taught, and at which level?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-math-check-g9', 'ib-dp-math-check-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Biology, Chemistry, and Physics, when the school offers them.

[[checks]]
- Each can be Higher Level or Standard Level.
- Taking a science at Higher Level is not the same as being eligible for NEET.
- NEET looks for a Class 12 equivalent with the required sciences. This Grade 10 is not that.

[[ask-school]]
Which sciences are taught, and at which level?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-sci-g9', 'ib-dp-sci-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The step up adds Higher Level hours and the Diploma core.

[[checks]]
- The core is Theory of Knowledge, the Extended Essay, and Creativity, Activity, Service.
- May written papers can fall in the same weeks as Indian entrances.

[[note]]
WHAT MAY VARY
Exact dates change every year. A predicted grade is not the same as sitting JEE or NEET.

[[ask-school]]
When are the school's Diploma exams, and do they overlap entrance dates?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-dp-workload-g9', 'ib-dp-workload-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
These routes come after Grade 10, and they are not a two-year board programme.

[[checks]]
- Not the Diploma.
- Not Cambridge A Level.
- Not CBSE or ISC Classes 11–12.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-other-g9', 'ib-other-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
In Telangana, POLYCET is the entrance to an engineering diploma after Class 10.

[[checks]]
- It is after Class 10, or an equivalent such as CBSE or ICSE Class 10.
- It is not EAPCET.
- It is not an MBBS seat.
- A later ECET can be a route into B.Tech.

[[note]]
WHAT MAY VARY
Andhra Pradesh uses a different polytechnic entrance. This page is Telangana only.

[[ask-school]]
Does finishing Grade 10 here meet the Class 10 requirement for POLYCET?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-poly-g9', 'ib-poly-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The useful question is which certificate the programme awards.

[[checks]]
- Skill programmes differ by school and institute.
- Ask which board or council recognises the certificate.

[[ask-school]]
Which certificate is awarded, and who recognises it?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-vocational-g9', 'ib-vocational-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
You can compare the routes here without picking one.

[[checks]]
- Nothing on this screen changes the curriculum.
- It does not change the grade.
- It does not change circle membership.
$lead$,
  updated_at = now()
WHERE slug IN ('ib-unsure-g9', 'ib-unsure-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
A different qualification after Grade 10.

[[checks]]
- The current school may not teach that programme.
- This list is of real routes, not that school's prospectus.

[[ask-school]]
Which of these programmes, if any, does this school offer after Grade 10?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-switch-g9', 'ib-switch-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Usually three or four subjects. A Level can count as Class 12. This Grade 10 cannot.

[[checks]]
- Cambridge International AS and A Level is the course.
- A Level, typically two or three Advanced-level subjects after 12 years of school, can be treated as Class 12.
- IGCSE and MYP are not that equivalent.
- JEE Main lists GCE A Level, not IGCSE. The subject match is still required.

[[ask-school]]
Does any school we are considering offer A Level after this Grade 10?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-alevel-g9', 'ib-alevel-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Classes 11 and 12. The school offers the subject combinations.

[[checks]]
- Parents often call them PCM, PCB, PCMB, Commerce, or Arts.
- Those names are not a list written into a CBSE rule.
- CBSE Class 12 is the usual qualifying exam for Indian entrances. That year's bulletin still applies.

[[ask-school]]
Which Class 11 combinations would a CBSE school offer after this Grade 10?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-cbse-g9', 'ib-cbse-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
The CISCE Class 11–12 certificate. A different board from CBSE and from the IB.

[[checks]]
- Only a school that offers ISC can place a student on it.

[[ask-school]]
Does the school we are considering offer ISC?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-isc-g9', 'ib-isc-g10');

UPDATE path_nodes SET
  lead = $lead$[[lead]]
Two years at a junior college, in Telangana or Andhra Pradesh.

[[checks]]
- It comes after Class 10.
- Common groups include MPC, BiPC, and MEC.
- Those names are not the same as CBSE's PCM and PCB labels.

[[note]]
This page is only for Telangana and Andhra Pradesh.

[[ask-school]]
Would a junior college treat this Grade 10 as Class 10 for Intermediate entry?
$lead$,
  updated_at = now()
WHERE slug IN ('ib-inter-g9', 'ib-inter-g10');

COMMIT;
