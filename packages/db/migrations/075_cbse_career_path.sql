-- CBSE career path, matching the IB explore-ahead shape.
-- Class 9 gains Next year and Explore ahead.
-- Classes 11–12, under Stay, gains subjects, interests, workload, and college checks.
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

SELECT path_put_node('cbse-g9-next', 'cbse-g9', 'section', 'Next year · Class 10', NULL,
  'The board-exam year. Class 10 is not Class 12.',
  'Which Class 10 rules will apply to my child''s batch?',
  85, '{}', NULL,
  $cbse$[[lead]]
Next year is Class 10. That is the CBSE board exam. It is not Class 12.

[[checks]]
What changes
- The exam is set by CBSE, not only by the school
- Subjects are registered for the board
- The choices after Class 10 are a separate page

[[note]]
WHICH BATCH
The Class 10 batch sitting the exam in 2026-27 still chooses Mathematics Standard or Basic. Your child is in the Class 9 batch of 2026-27, which is on the newer subject scheme. Ask the school which rules will apply to your child's own Class 10. That session's circular is the one that counts.

[[ask-school]]
Which Class 10 rules will apply to my child's batch?

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-next-what', 'cbse-g9-next', 'topic', 'What Class 10 is', NULL,
  'The board year. Not Class 12.',
  'Is Class 10 the qualifying exam for college?',
  10, '{}', NULL,
  $cbse$[[lead]]
Class 10 is the end of this stage of school. College entrances look at Class 12.

[[checks]]
Class 10 is
- A CBSE board exam
- The end of the Class 9 subjects
- The point where the next two years are chosen

[[example]]
ONE EXAMPLE
A Class 10 marksheet lets your child enter Class 11, or another course after Class 10. It does not fill in a college form.

[[note]]
WHAT IT IS NOT
Not Class 12. Not JEE. Not NEET.

[[ask-school]]
What does the school say Class 10 qualifies the child for?
$cbse$);

SELECT path_put_node('cbse-g9-next-subjects', 'cbse-g9-next', 'topic', 'Subjects in Class 10', NULL,
  'Ask which scheme your child''s Class 10 will use.',
  'Which subjects carry from Class 9 into my child''s Class 10?',
  20, '{}', NULL,
  $cbse$[[lead]]
The Class 10 batch ahead of your child has a published subject list. Your child's Class 10 may follow the Class 9 scheme instead.

[[checks]]
This year's Class 10 board subjects
- First language
- Second language
- Mathematics Standard or Mathematics Basic
- Science
- Social Science

[[example]]
ONE EXAMPLE
The batch sitting Class 10 now can still choose Basic or Standard mathematics. The Class 9 batch was told everyone studies the same mathematics, with Advanced as an optional extra. Ask which of those two stories applies to your child's Class 10.

[[note]]
ALSO ON THE SCHOOL RECORD
Third language is a school pass, not a board paper, for the batch sitting Class 10 now. Art, health, and work experience are recorded by the school. Up to two extra subjects only if the school registers them.

[[ask-school]]
Which subjects will my child be registered for in Class 10?
$cbse$);

SELECT path_put_node('cbse-g9-next-exam', 'cbse-g9-next', 'topic', 'The board exam', NULL,
  'Classwork marks and the CBSE paper.',
  'How will classwork marks and the board paper be combined?',
  30, '{}', NULL,
  $cbse$[[lead]]
For the Class 10 batch sitting the exam now, a subject needs the school's classwork marks and the CBSE paper.

[[checks]]
Ask the school
- How classwork marks are recorded
- When the board paper is
- Which maths paper your child would be registered for, if that choice still exists

[[example]]
ONE EXAMPLE
Missing the classwork marks means that subject is not complete, even if the board paper is sat. That is the rule for the batch sitting Class 10 now.

[[note]]
YOUR CHILD'S BATCH
Ask whether the same split applies when your child reaches Class 10. Do not assume the 2026-27 Class 10 circular is the one for the following year.

[[ask-school]]
What has the school said about classwork marks and the board paper for my child's batch?
$cbse$);

SELECT path_put_node('cbse-g9-ahead', 'cbse-g9', 'section', 'Explore ahead · after Class 10', NULL,
  'Routes after the board exam. Opening one does not pick it.',
  'What helped you compare staying in CBSE with switching?',
  90, '{}', NULL,
  $cbse$[[lead]]
These are routes after Class 10. Your child is still in Class 9. Opening one does not pick it.

[[checks]]
The choices
- Stay in CBSE for Classes 11 and 12
- Switch to Cambridge A Level, the IB Diploma, or ISC
- Intermediate, in Telangana or Andhra Pradesh
- Polytechnic diploma, in Telangana
- A skill or vocational subject
- Not sure yet

[[note]]
WHAT THIS PAGE DOES NOT DO
It does not change your child's board or class. Class 10 is not Class 12.

[[ask-school]]
Which of these does the school actually offer after Class 10?

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-stay', 'cbse-g9-ahead', 'route', 'Stay in CBSE 11–12', NULL,
  'Classes 11 and 12 on CBSE. The school offers the subject groups.',
  'Which Class 11 groups does this school offer?',
  10, '{}', 'cbse-after-10-streams',
  $cbse$[[lead]]
Most families stay on CBSE for Classes 11 and 12.

[[checks]]
Names parents use
- PCM
- PCB
- PCMB
- Commerce
- Arts

[[example]]
ONE EXAMPLE
The school offers PCM with English and Computer Science. A prospectus that only says PCM does not show the Computer Science until you ask.

[[note]]
WHAT THESE NAMES MEAN
They are groups of subjects the school offers. They are not a fixed CBSE law. Class 12 is the usual qualifying exam for college entrances in India. The rules for that year still apply. The tiles below are how those groups connect to subjects and to later study.

[[ask-school]]
Which Class 11 groups does this school offer?

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-11-what', 'cbse-g9-stay', 'link', 'What is Classes 11–12?', NULL,
  'Two more years on CBSE. The school offers the subjects.',
  'Which Class 11 groups does this school offer?',
  10, '{}', 'cbse-after-10-streams',
  $cbse$[[lead]]
Classes 11 and 12 are the next two years on CBSE. The public exam is at the end of Class 12.

[[checks]]
What this stage is
- Two years
- The school offers the subjects
- Class 12 is the exam entrances look at
- Class 10 does not choose these subjects

[[example]]
ONE EXAMPLE
The Class 10 marksheet does not place your child in a Class 11 group. The school offers a list, and you choose from that list.

[[note]]
WHAT THE GROUP NAMES ARE
PCM, PCB, PCMB, Commerce, and Arts are names parents use. They are not a CBSE law. Two schools can use the same name and teach different extra subjects.

[[ask-school]]
Which Class 11 groups does this school offer?
$cbse$);

SELECT path_put_node('cbse-g9-11-subjects', 'cbse-g9-stay', 'lens', 'Subjects and choices', NULL,
  'The school list is the real list.',
  'Which subjects can this timetable actually hold?',
  20, '{}', NULL,
  $cbse$[[lead]]
The school publishes a Class 11 list. Families then pick a group from that list.

[[checks]]
On this page
- How the group names work
- Subject areas
- Future interests
- A question for parents who have already chosen

[[example]]
ONE EXAMPLE
You open Mathematics, then Engineering. Neither one enrols your child. The school list is the enrolment.

[[note]]
WHAT THIS PAGE DOES NOT DO
Opening a subject here does not register your child for it.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-11-combos', 'cbse-g9-11-subjects', 'topic', 'How the groups work', NULL,
  'Parent names for bundles of subjects.',
  'What subjects are inside each group at this school?',
  10, '{}', NULL,
  $cbse$[[lead]]
A group is a bundle the school offers. The name is a shortcut, not the full timetable.

[[checks]]
Names parents use
- PCM: physics, chemistry, mathematics
- PCB: physics, chemistry, biology
- PCMB: those four together
- Commerce: often accountancy, business studies, economics
- Arts: humanities subjects the school teaches

[[example]]
ONE EXAMPLE
Two schools both say PCM. One adds Computer Science. The other adds Physical Education. Ask what sits inside the name.

[[note]]
WHAT ELSE IS ON THE LIST
Most schools include a language, often English. Some offer a sixth subject. Applied Mathematics is a different mathematics course some schools teach. Ask whether it is on this list.

[[ask-school]]
What subjects are inside each group, including the language?
$cbse$);

SELECT path_put_node('cbse-g9-11-areas', 'cbse-g9-11-subjects', 'section', 'Subject areas', NULL,
  'The kinds of subjects CBSE schools teach in Classes 11 and 12.',
  'Which of these areas does the school teach?',
  20, '{}', NULL,
  $cbse$[[lead]]
These are the areas. Your school teaches some of them.

[[checks]]
Areas
- Mathematics
- Sciences
- Languages
- Commerce subjects
- Humanities

[[note]]
THE SCHOOL LIST
A subject can exist in the CBSE curriculum and still be absent from your school.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-11-math', 'cbse-g9-11-areas', 'topic', 'Mathematics', NULL,
  'Mathematics, and sometimes Applied Mathematics.',
  'Does the school teach Mathematics, Applied Mathematics, or both?',
  10, '{}', NULL,
  $cbse$[[lead]]
Mathematics in Classes 11 and 12 is a full course. It is not the Class 10 paper.

[[checks]]
Ask which course
- Mathematics
- Applied Mathematics, if the school teaches it
- One course, not both, unless the school says a student may take both

[[example]]
ONE EXAMPLE
A child aiming at engineering is often on Mathematics. Applied Mathematics is a different course. Ask which one this school teaches.

[[note]]
WHAT MAY VARY
Class 10 Mathematics Standard or Basic was a Class 10 choice for one batch. It does not decide the Class 11 book. The school does.

[[ask-school]]
Which mathematics course is on the Class 11 list?
$cbse$);

SELECT path_put_node('cbse-g9-11-sci', 'cbse-g9-11-areas', 'topic', 'Sciences', NULL,
  'Physics, Chemistry, and Biology are separate subjects here.',
  'Which sciences are on the Class 11 list?',
  20, '{}', NULL,
  $cbse$[[lead]]
Physics, Chemistry, and Biology are each their own subject in Classes 11 and 12, if the school teaches them.

[[checks]]
Subjects to ask about
- Physics
- Chemistry
- Biology
- Computer Science or Informatics Practices, if offered

[[example]]
ONE EXAMPLE
PCB on a prospectus means Physics, Chemistry, and Biology. Computer Science is an extra on some lists. It is not a substitute for those three.

[[note]]
WHAT MAY VARY
The school may not teach all three sciences. Ask which ones are actually scheduled.

[[ask-school]]
Which sciences are taught, and can a student take all three?
$cbse$);

SELECT path_put_node('cbse-g9-11-lang', 'cbse-g9-11-areas', 'topic', 'Languages', NULL,
  'Usually one language, sometimes two.',
  'Which languages are compulsory in Class 11?',
  30, '{}', NULL,
  $cbse$[[lead]]
A language stays on the timetable in Classes 11 and 12 at most schools.

[[checks]]
Ask which
- The main language, often English
- A second language, if the school offers one

[[example]]
ONE EXAMPLE
English Core is the name on many school lists. Your school may use another language as the main one. Ask for the name on the form.

[[note]]
WHAT MAY VARY
The Class 10 third language does not automatically continue. Ask whether it is even offered in Class 11.

[[ask-school]]
Which language is on every Class 11 group?
$cbse$);

SELECT path_put_node('cbse-g9-11-commerce', 'cbse-g9-11-areas', 'topic', 'Commerce subjects', NULL,
  'Accountancy, Business Studies, and Economics.',
  'Which commerce subjects does the school teach?',
  40, '{}', NULL,
  $cbse$[[lead]]
These are the subjects parents usually mean by Commerce.

[[checks]]
Often on the list
- Accountancy
- Business Studies
- Economics
- Mathematics, on some commerce groups

[[example]]
ONE EXAMPLE
A commerce group at one school is Accountancy, Business Studies, Economics, and English. Another school adds Mathematics. Ask which four or five are in the bundle.

[[note]]
WHAT THE NAME IS
Commerce is a parent name. It is not a CBSE statute.

[[ask-school]]
What is inside the commerce group here?
$cbse$);

SELECT path_put_node('cbse-g9-11-human', 'cbse-g9-11-areas', 'topic', 'Humanities', NULL,
  'History, politics, geography, and other subjects the school teaches.',
  'Which humanities subjects are on the list?',
  50, '{}', NULL,
  $cbse$[[lead]]
Humanities is the area parents often call Arts.

[[checks]]
Subjects schools often teach
- History
- Political Science
- Geography
- Psychology
- Sociology
- A language

[[example]]
ONE EXAMPLE
An arts group might be History, Political Science, Psychology, and English. Your school may teach Geography instead of Psychology.

[[note]]
WHAT MAY VARY
Fine arts and Physical Education can sit alongside these. Ask if they count as one of the main subjects.

[[ask-school]]
Which humanities subjects are actually taught?
$cbse$);

SELECT path_put_node('cbse-g9-11-interests', 'cbse-g9-11-subjects', 'section', 'Future interests', NULL,
  'A direction to ask about. Not a group the school has assigned.',
  'Which interest should we read first?',
  30, '{}', NULL,
  $cbse$[[lead]]
These are future interests. They do not place your child in a group.

[[checks]]
Interests
- Engineering
- Medicine
- Business and economics
- Arts and humanities
- My child is unsure

[[note]]
WHAT THESE ARE NOT
They do not fill in a Class 11 form. The school group is a separate choice.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-11-eng', 'cbse-g9-11-interests', 'interest', 'Engineering', NULL,
  'Often physics, chemistry, and mathematics. The entrance has its own rule.',
  'Which mathematics and science courses does the school teach for this direction?',
  10, '{}', NULL,
  $cbse$[[lead]]
Families looking at engineering often choose Physics, Chemistry, and Mathematics.

[[checks]]
What to check
- JEE Main is the engineering entrance for NITs, IIITs, and similar colleges
- JEE Advanced comes after a qualifying JEE Main rank
- The bulletin allows Physics and Mathematics with Chemistry, or with Biology, Biotechnology, or a technical vocational subject
- The bulletin for the year of Class 12 is the rule

[[example]]
ONE EXAMPLE
A school calls the group PCM. The JEE form may also accept Physics, Mathematics, and a technical vocational subject. Ask the school what it teaches, then read that year's bulletin.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say your child can sit JEE. PCM is a parent name. The bulletin does not use that name.

[[ask-school]]
Which mathematics and science courses are on the Class 11 list?
$cbse$);

SELECT path_put_node('cbse-g9-11-med', 'cbse-g9-11-interests', 'interest', 'Medicine', NULL,
  'Often physics, chemistry, and biology. NEET is the medical entrance.',
  'Which sciences does the school teach for this direction?',
  20, '{}', NULL,
  $cbse$[[lead]]
Families looking at medicine often choose Physics, Chemistry, and Biology.

[[checks]]
What to check
- NEET UG is the entrance for MBBS, BDS, and AYUSH
- It looks at Class 12, with the sciences that year's bulletin requires
- Class 10 is not the qualifying exam
- TG EAPCET is not an MBBS exam

[[example]]
ONE EXAMPLE
PCB on a school list is Physics, Chemistry, and Biology. Sitting those subjects is not the same as a NEET seat. The bulletin for the year of Class 12 is the check.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say your child can sit NEET. It does not choose PCB for them.

[[ask-school]]
Does the school teach Physics, Chemistry, and Biology together?
$cbse$);

SELECT path_put_node('cbse-g9-11-bus', 'cbse-g9-11-interests', 'interest', 'Business and economics', NULL,
  'Accountancy, business studies, and economics are common. Not every degree requires them.',
  'Does the school teach Accountancy, Business Studies, and Economics?',
  30, '{}', NULL,
  $cbse$[[lead]]
Families looking at business often choose Accountancy, Business Studies, and Economics.

[[checks]]
What to check
- Those three are school subjects
- Not every business or economics degree requires all three
- CA Foundation can be registered after Class 10
- The CA Foundation exam itself is after the student is appearing for Class 12

[[example]]
ONE EXAMPLE
A child can register for CA Foundation after Class 10 and still be in school. The exam waits until Class 12 is being taken. The commerce group at school is a separate choice.

[[note]]
WHAT MAY VARY
Some commerce groups include Mathematics. Ask if this school does, and whether a later degree you care about asks for it.

[[ask-school]]
What is inside the commerce group, and is CA something the school advises on?
$cbse$);

SELECT path_put_node('cbse-g9-11-arts', 'cbse-g9-11-interests', 'interest', 'Arts and humanities', NULL,
  'History, politics, and other subjects the school teaches.',
  'Which arts and humanities subjects are on the Class 11 list?',
  40, '{}', NULL,
  $cbse$[[lead]]
A humanities set is a language plus the history, politics, or other subjects the school teaches.

[[checks]]
Directions parents ask about
- History, Political Science, Geography, Psychology
- Law: CLAT is after Class 12, for the five-year law degree at national law universities
- NLU Delhi uses AILET, a different exam

[[example]]
ONE EXAMPLE
A child taking History and Political Science is not automatically on a law path. CLAT looks at Class 12. The school still has to teach those subjects.

[[note]]
WHAT MAY VARY
The school list is the limit. A subject in a career conversation may not be on the timetable.

[[ask-school]]
Which humanities subjects are taught here?
$cbse$);

SELECT path_put_node('cbse-g9-11-unsure', 'cbse-g9-11-interests', 'interest', 'My child is unsure', NULL,
  'Keep a mix the school can still teach.',
  'Which balanced set can this timetable still hold?',
  50, '{}', NULL,
  $cbse$[[lead]]
When a direction is not settled, keep subjects that still leave more than one group open.

[[checks]]
A mix parents keep
- A language
- Mathematics, or one science
- One humanities or commerce subject the school teaches

[[example]]
ONE EXAMPLE
English, Mathematics, and Economics can leave engineering and commerce both still discussable. The school has to offer that trio.

[[note]]
WHY THIS MIX
The aim is to avoid closing a group the school can still teach. It is not a recommended career.

[[ask-school]]
Which set can we take now without closing mathematics or a science?
$cbse$);

SELECT path_put_node('cbse-g9-11-ask', 'cbse-g9-11-subjects', 'topic', 'Ask parents about choosing subjects', NULL,
  'For parents whose children have already chosen.',
  'How did your child choose Class 11 subjects when a career was not settled?',
  40, '{}', NULL,
  $cbse$[[lead]]
This is a question for parents whose children have already chosen Class 11 subjects.

[[checks]]
What you can ask
- Which group they chose
- What the school could not timetable
- What they would ask earlier

[[example]]
ONE EXAMPLE
A parent answers from their own child's school. Their PCM list may not match yours.

[[note]]
WHAT POSTING DOES
Posting a question does not lock a combination for your child. It does not change the class or the board.

[[ask-school]]
Which combinations can this timetable actually hold?
$cbse$);

SELECT path_put_node('cbse-g9-11-workload', 'cbse-g9-stay', 'lens', 'Workload and transition', NULL,
  'Class 11 is a step up. The board exam is in Class 12.',
  'How does this school treat Class 11 marks?',
  30, '{}', NULL,
  $cbse$[[lead]]
Class 11 is harder than Class 10. The CBSE board exam for this stage is at the end of Class 12.

[[checks]]
What changes
- Each science or commerce subject is its own course
- The school sets Class 11 tests
- Entrance dates in Class 12 move every year

[[example]]
ONE EXAMPLE
A physics test in Class 11 is the school's test. It is not the Class 12 board paper, and it is not JEE.

[[note]]
WHAT TO ASK
Ask how Class 11 marks are used for promotion into Class 12. Ask nothing on this page to predict an entrance date.

[[ask-school]]
How are Class 11 marks used, and when do you start Class 12 board talk?
$cbse$);

SELECT path_put_node('cbse-g9-11-college', 'cbse-g9-stay', 'lens', 'College and career possibilities', NULL,
  'Entrances look at Class 12. Class 10 is not that exam.',
  'Which entrance matches the direction we are reading about?',
  40, '{}', NULL,
  $cbse$[[lead]]
College entrances in India look at Class 12, or at appearing for Class 12. They do not look at Class 10 as the qualifying exam.

[[checks]]
Exams parents ask about
- JEE Main, for engineering
- NEET UG, for MBBS, BDS, and AYUSH
- CUET, for many central universities
- TG EAPCET, in Telangana, for engineering, agriculture, and pharmacy

[[example]]
ONE EXAMPLE
A child in Class 10 can read about NEET. The form, when it opens, will ask about Class 12. TG EAPCET is not the medical entrance.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say this child is eligible. Subject rules are on that year's bulletin. Domicile rules for a state exam are on that exam's page.

[[ask-school]]
Which exam are we actually talking about, and which Class 12 subjects does it ask for?
$cbse$);

SELECT path_put_node('cbse-g9-11-check', 'cbse-g9-stay', 'lens', 'Requirements to check', NULL,
  'School list first, then the entrance bulletin.',
  'Can I see the Class 11 subject list and the entrance rule side by side?',
  50, '{}', NULL,
  $cbse$[[lead]]
Three checks, in this order.

[[checks]]
Check
- The school's Class 11 subject list
- The entrance bulletin for the year your child finishes Class 12
- Whether that bulletin's subjects are on the school list

[[example]]
ONE EXAMPLE
The school teaches Physics and Mathematics, but not the vocational subject named in a bulletin. That is a timetable fact. You find it by putting the two lists next to each other.

[[note]]
WHAT OPENING THIS DOES
It does not choose a group. It does not register your child for an entrance.

[[ask-school]]
Can you show the Class 11 list that matches the exam we are asking about?
$cbse$);

SELECT path_put_node('cbse-g9-switch', 'cbse-g9-ahead', 'section', 'Switch curriculum', NULL,
  'Another board. The new school must teach it.',
  'Which other board is actually available after Class 10?',
  20, '{}', NULL,
  $cbse$[[lead]]
A different board after Class 10. The new school must teach that course.

[[checks]]
The switches
- Cambridge A Level
- IB Diploma
- ISC
- Intermediate in Telangana or Andhra Pradesh

[[note]]
A Class 10 marksheet does not move your child across by itself.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-alevel', 'cbse-g9-switch', 'route', 'Cambridge AS / A Level', NULL,
  'Usually 3 or 4 subjects. A Level can count as Class 12.',
  'Does the new school offer A Level, and which subjects?',
  10, '{}', 'cambridge-a-level',
  $cbse$[[lead]]
Cambridge A Level is usually 3 or 4 subjects. It can count as Class 12. Class 10 does not.

[[checks]]
What to check
- The school offers A Level
- Which subjects it teaches
- How many subjects your child would take

[[example]]
ONE EXAMPLE
The child finishes CBSE Class 10 and starts A Level at a school that teaches it. The Class 10 marksheet does not enrol them.

[[note]]
WHAT THESE CERTIFICATES ARE
The Association of Indian Universities can treat A Level, typically two or three Advanced-level subjects after 12 years of school, as Class 12. CBSE Class 10 is not that. NTA lists GCE A Level among the qualifying exams for JEE Main. The subject match is still required.

[[ask-school]]
Does the new school offer A Level, and which subjects?
$cbse$);

SELECT path_put_node('cbse-g9-dp', 'cbse-g9-switch', 'route', 'IB Diploma Programme', NULL,
  'Six subjects plus a core. Class 10 is not Class 12.',
  'Does the school offer the Diploma, and which subjects?',
  20, '{}', 'ib-diploma',
  $cbse$[[lead]]
The IB Diploma is two years. It has six subjects plus a core. Finishing it can count as Class 12. Class 10 by itself does not.

[[checks]]
What to check
- The school offers the Diploma
- Six subjects, plus a core the school will name
- The subjects on that school's list

[[example]]
ONE EXAMPLE
A CBSE Class 10 marksheet does not place your child in the Diploma. The new school has to offer it.

[[note]]
WHAT THIS IS NOT
Not CBSE Classes 11 and 12. The Diploma, once finished on the terms the Association of Indian Universities sets, can be the Class 12 stage.

[[ask-school]]
Does the school offer the Diploma, and which subjects?
$cbse$);

SELECT path_put_node('cbse-g9-isc', 'cbse-g9-switch', 'route', 'ISC Classes 11–12', NULL,
  'Classes 11 and 12 on ISC. The school must offer it.',
  'Does the school teach ISC?',
  30, '{}', NULL,
  $cbse$[[lead]]
ISC is Classes 11 and 12 on a different board, CISCE. Only a school that teaches ISC can place your child on it.

[[checks]]
What to check
- The school offers ISC
- Which subject groups it teaches
- That it is not the same board as CBSE

[[example]]
ONE EXAMPLE
The CBSE Class 10 marksheet does not transfer the child onto ISC. You ask the ISC school which group it offers.

[[note]]
WHAT THIS IS NOT
Not CBSE. Not the IB Diploma.

[[ask-school]]
Does the school teach ISC, and which groups?
$cbse$);

SELECT path_put_node('cbse-g9-inter', 'cbse-g9-switch', 'route', 'State Intermediate', NULL,
  'Two years of junior college in Telangana or Andhra Pradesh.',
  'Which Intermediate group would accept a CBSE Class 10 certificate?',
  40, ARRAY['TG','AP'], NULL,
  $cbse$[[lead]]
After Class 10, a student in Telangana or Andhra Pradesh can join Intermediate at a junior college for two years.

[[checks]]
Groups parents ask about
- MPC: maths, physics, chemistry
- BiPC: biology, physics, chemistry
- MEC: maths, economics, commerce

[[example]]
ONE EXAMPLE
A CBSE family in Hyderabad looks at MPC at a junior college. The college has to accept the CBSE Class 10 certificate and offer the group.

[[note]]
WHAT THESE NAMES ARE
They are junior-college groups in these two states. They are not CBSE's PCM and PCB labels. This row is only for Telangana and Andhra Pradesh.

[[ask-school]]
Which groups does the college offer, and does it take CBSE Class 10?
$cbse$);

SELECT path_put_node('cbse-g9-other', 'cbse-g9-ahead', 'section', 'Other routes', NULL,
  'A diploma or a skill certificate. Not a Class 11 board group.',
  'Which certificate would this route actually give?',
  30, '{}', NULL,
  $cbse$[[lead]]
These are routes after Class 10 that are not Classes 11 and 12 on a school board.

[[checks]]
The routes
- Polytechnic diploma, in Telangana
- A skill or vocational subject

[[note]]
Ask which certificate is awarded, and who recognises it.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-g9-poly', 'cbse-g9-other', 'route', 'Polytechnic diploma', NULL,
  'Telangana only. An engineering diploma after Class 10.',
  'Is POLYCET the exam you mean, and is it offered in your state?',
  10, ARRAY['TG'], 'tg-polycet',
  $cbse$[[lead]]
In Telangana, POLYCET is the entrance to an engineering diploma after Class 10.

[[checks]]
What it is
- After Class 10
- An engineering diploma
- A later ECET can be a route into B.Tech

[[example]]
ONE EXAMPLE
A Telangana student sits POLYCET after CBSE Class 10 and joins a diploma. CBSE Class 10 is accepted as equivalent for that counselling. The seat is not chosen on this page.

[[note]]
WHAT THIS IS NOT
Not an MBBS seat. Not EAPCET. Not JEE. Andhra Pradesh uses a different polytechnic entrance, so this row is Telangana only.

[[ask-school]]
Is POLYCET the exam you mean?
$cbse$);

SELECT path_put_node('cbse-g9-vocational', 'cbse-g9-other', 'route', 'Skill or vocational study', NULL,
  'Ask which certificate the course actually awards.',
  'Which certificate does this skill course award?',
  20, '{}', NULL,
  $cbse$[[lead]]
Some schools offer a skill subject with Classes 11 and 12, or a separate certificate course after Class 10.

[[checks]]
Ask
- The name of the certificate
- Who issues it
- Whether it sits inside CBSE Class 11 or instead of it

[[example]]
ONE EXAMPLE
A school adds a skill subject next to Physics and Mathematics. Another school offers a standalone certificate. They are not the same route.

[[note]]
WHAT THIS IS NOT
Not POLYCET, unless the school says that exam by name. Not an MBBS seat. The useful question is which certificate is awarded.

[[ask-school]]
What is the certificate called, and is it part of Class 11?
$cbse$);

SELECT path_put_node('cbse-g9-unsure', 'cbse-g9-ahead', 'route', 'Not sure yet', NULL,
  'Read the choices. Nothing here picks one.',
  'What helped you compare staying and switching?',
  40, '{}', NULL,
  $cbse$[[lead]]
You can read the choices and not pick one.

[[note]]
NOTHING CHANGES
Opening this page does not change your child's board, class, or group.

[[ask-school]]
What helped you compare staying in CBSE with switching?
$cbse$);

SELECT path_put_node('cbse-11-what', 'cbse-stay', 'link', 'What is Classes 11–12?', NULL,
  'Two more years on CBSE. The school offers the subjects.',
  'Which Class 11 groups does this school offer?',
  10, '{}', 'cbse-after-10-streams',
  $cbse$[[lead]]
Classes 11 and 12 are the next two years on CBSE. The public exam is at the end of Class 12.

[[checks]]
What this stage is
- Two years
- The school offers the subjects
- Class 12 is the exam entrances look at
- Class 10 does not choose these subjects

[[example]]
ONE EXAMPLE
The Class 10 marksheet does not place your child in a Class 11 group. The school offers a list, and you choose from that list.

[[note]]
WHAT THE GROUP NAMES ARE
PCM, PCB, PCMB, Commerce, and Arts are names parents use. They are not a CBSE law. Two schools can use the same name and teach different extra subjects.

[[ask-school]]
Which Class 11 groups does this school offer?
$cbse$);

SELECT path_put_node('cbse-11-subjects', 'cbse-stay', 'lens', 'Subjects and choices', NULL,
  'The school list is the real list.',
  'Which subjects can this timetable actually hold?',
  20, '{}', NULL,
  $cbse$[[lead]]
The school publishes a Class 11 list. Families then pick a group from that list.

[[checks]]
On this page
- How the group names work
- Subject areas
- Future interests
- A question for parents who have already chosen

[[example]]
ONE EXAMPLE
You open Mathematics, then Engineering. Neither one enrols your child. The school list is the enrolment.

[[note]]
WHAT THIS PAGE DOES NOT DO
Opening a subject here does not register your child for it.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-11-combos', 'cbse-11-subjects', 'topic', 'How the groups work', NULL,
  'Parent names for bundles of subjects.',
  'What subjects are inside each group at this school?',
  10, '{}', NULL,
  $cbse$[[lead]]
A group is a bundle the school offers. The name is a shortcut, not the full timetable.

[[checks]]
Names parents use
- PCM: physics, chemistry, mathematics
- PCB: physics, chemistry, biology
- PCMB: those four together
- Commerce: often accountancy, business studies, economics
- Arts: humanities subjects the school teaches

[[example]]
ONE EXAMPLE
Two schools both say PCM. One adds Computer Science. The other adds Physical Education. Ask what sits inside the name.

[[note]]
WHAT ELSE IS ON THE LIST
Most schools include a language, often English. Some offer a sixth subject. Applied Mathematics is a different mathematics course some schools teach. Ask whether it is on this list.

[[ask-school]]
What subjects are inside each group, including the language?
$cbse$);

SELECT path_put_node('cbse-11-areas', 'cbse-11-subjects', 'section', 'Subject areas', NULL,
  'The kinds of subjects CBSE schools teach in Classes 11 and 12.',
  'Which of these areas does the school teach?',
  20, '{}', NULL,
  $cbse$[[lead]]
These are the areas. Your school teaches some of them.

[[checks]]
Areas
- Mathematics
- Sciences
- Languages
- Commerce subjects
- Humanities

[[note]]
THE SCHOOL LIST
A subject can exist in the CBSE curriculum and still be absent from your school.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-11-math', 'cbse-11-areas', 'topic', 'Mathematics', NULL,
  'Mathematics, and sometimes Applied Mathematics.',
  'Does the school teach Mathematics, Applied Mathematics, or both?',
  10, '{}', NULL,
  $cbse$[[lead]]
Mathematics in Classes 11 and 12 is a full course. It is not the Class 10 paper.

[[checks]]
Ask which course
- Mathematics
- Applied Mathematics, if the school teaches it
- One course, not both, unless the school says a student may take both

[[example]]
ONE EXAMPLE
A child aiming at engineering is often on Mathematics. Applied Mathematics is a different course. Ask which one this school teaches.

[[note]]
WHAT MAY VARY
Class 10 Mathematics Standard or Basic was a Class 10 choice for one batch. It does not decide the Class 11 book. The school does.

[[ask-school]]
Which mathematics course is on the Class 11 list?
$cbse$);

SELECT path_put_node('cbse-11-sci', 'cbse-11-areas', 'topic', 'Sciences', NULL,
  'Physics, Chemistry, and Biology are separate subjects here.',
  'Which sciences are on the Class 11 list?',
  20, '{}', NULL,
  $cbse$[[lead]]
Physics, Chemistry, and Biology are each their own subject in Classes 11 and 12, if the school teaches them.

[[checks]]
Subjects to ask about
- Physics
- Chemistry
- Biology
- Computer Science or Informatics Practices, if offered

[[example]]
ONE EXAMPLE
PCB on a prospectus means Physics, Chemistry, and Biology. Computer Science is an extra on some lists. It is not a substitute for those three.

[[note]]
WHAT MAY VARY
The school may not teach all three sciences. Ask which ones are actually scheduled.

[[ask-school]]
Which sciences are taught, and can a student take all three?
$cbse$);

SELECT path_put_node('cbse-11-lang', 'cbse-11-areas', 'topic', 'Languages', NULL,
  'Usually one language, sometimes two.',
  'Which languages are compulsory in Class 11?',
  30, '{}', NULL,
  $cbse$[[lead]]
A language stays on the timetable in Classes 11 and 12 at most schools.

[[checks]]
Ask which
- The main language, often English
- A second language, if the school offers one

[[example]]
ONE EXAMPLE
English Core is the name on many school lists. Your school may use another language as the main one. Ask for the name on the form.

[[note]]
WHAT MAY VARY
The Class 10 third language does not automatically continue. Ask whether it is even offered in Class 11.

[[ask-school]]
Which language is on every Class 11 group?
$cbse$);

SELECT path_put_node('cbse-11-commerce', 'cbse-11-areas', 'topic', 'Commerce subjects', NULL,
  'Accountancy, Business Studies, and Economics.',
  'Which commerce subjects does the school teach?',
  40, '{}', NULL,
  $cbse$[[lead]]
These are the subjects parents usually mean by Commerce.

[[checks]]
Often on the list
- Accountancy
- Business Studies
- Economics
- Mathematics, on some commerce groups

[[example]]
ONE EXAMPLE
A commerce group at one school is Accountancy, Business Studies, Economics, and English. Another school adds Mathematics. Ask which four or five are in the bundle.

[[note]]
WHAT THE NAME IS
Commerce is a parent name. It is not a CBSE statute.

[[ask-school]]
What is inside the commerce group here?
$cbse$);

SELECT path_put_node('cbse-11-human', 'cbse-11-areas', 'topic', 'Humanities', NULL,
  'History, politics, geography, and other subjects the school teaches.',
  'Which humanities subjects are on the list?',
  50, '{}', NULL,
  $cbse$[[lead]]
Humanities is the area parents often call Arts.

[[checks]]
Subjects schools often teach
- History
- Political Science
- Geography
- Psychology
- Sociology
- A language

[[example]]
ONE EXAMPLE
An arts group might be History, Political Science, Psychology, and English. Your school may teach Geography instead of Psychology.

[[note]]
WHAT MAY VARY
Fine arts and Physical Education can sit alongside these. Ask if they count as one of the main subjects.

[[ask-school]]
Which humanities subjects are actually taught?
$cbse$);

SELECT path_put_node('cbse-11-interests', 'cbse-11-subjects', 'section', 'Future interests', NULL,
  'A direction to ask about. Not a group the school has assigned.',
  'Which interest should we read first?',
  30, '{}', NULL,
  $cbse$[[lead]]
These are future interests. They do not place your child in a group.

[[checks]]
Interests
- Engineering
- Medicine
- Business and economics
- Arts and humanities
- My child is unsure

[[note]]
WHAT THESE ARE NOT
They do not fill in a Class 11 form. The school group is a separate choice.

[[view tiles]]
$cbse$);

SELECT path_put_node('cbse-11-eng', 'cbse-11-interests', 'interest', 'Engineering', NULL,
  'Often physics, chemistry, and mathematics. The entrance has its own rule.',
  'Which mathematics and science courses does the school teach for this direction?',
  10, '{}', NULL,
  $cbse$[[lead]]
Families looking at engineering often choose Physics, Chemistry, and Mathematics.

[[checks]]
What to check
- JEE Main is the engineering entrance for NITs, IIITs, and similar colleges
- JEE Advanced comes after a qualifying JEE Main rank
- The bulletin allows Physics and Mathematics with Chemistry, or with Biology, Biotechnology, or a technical vocational subject
- The bulletin for the year of Class 12 is the rule

[[example]]
ONE EXAMPLE
A school calls the group PCM. The JEE form may also accept Physics, Mathematics, and a technical vocational subject. Ask the school what it teaches, then read that year's bulletin.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say your child can sit JEE. PCM is a parent name. The bulletin does not use that name.

[[ask-school]]
Which mathematics and science courses are on the Class 11 list?
$cbse$);

SELECT path_put_node('cbse-11-med', 'cbse-11-interests', 'interest', 'Medicine', NULL,
  'Often physics, chemistry, and biology. NEET is the medical entrance.',
  'Which sciences does the school teach for this direction?',
  20, '{}', NULL,
  $cbse$[[lead]]
Families looking at medicine often choose Physics, Chemistry, and Biology.

[[checks]]
What to check
- NEET UG is the entrance for MBBS, BDS, and AYUSH
- It looks at Class 12, with the sciences that year's bulletin requires
- Class 10 is not the qualifying exam
- TG EAPCET is not an MBBS exam

[[example]]
ONE EXAMPLE
PCB on a school list is Physics, Chemistry, and Biology. Sitting those subjects is not the same as a NEET seat. The bulletin for the year of Class 12 is the check.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say your child can sit NEET. It does not choose PCB for them.

[[ask-school]]
Does the school teach Physics, Chemistry, and Biology together?
$cbse$);

SELECT path_put_node('cbse-11-bus', 'cbse-11-interests', 'interest', 'Business and economics', NULL,
  'Accountancy, business studies, and economics are common. Not every degree requires them.',
  'Does the school teach Accountancy, Business Studies, and Economics?',
  30, '{}', NULL,
  $cbse$[[lead]]
Families looking at business often choose Accountancy, Business Studies, and Economics.

[[checks]]
What to check
- Those three are school subjects
- Not every business or economics degree requires all three
- CA Foundation can be registered after Class 10
- The CA Foundation exam itself is after the student is appearing for Class 12

[[example]]
ONE EXAMPLE
A child can register for CA Foundation after Class 10 and still be in school. The exam waits until Class 12 is being taken. The commerce group at school is a separate choice.

[[note]]
WHAT MAY VARY
Some commerce groups include Mathematics. Ask if this school does, and whether a later degree you care about asks for it.

[[ask-school]]
What is inside the commerce group, and is CA something the school advises on?
$cbse$);

SELECT path_put_node('cbse-11-arts', 'cbse-11-interests', 'interest', 'Arts and humanities', NULL,
  'History, politics, and other subjects the school teaches.',
  'Which arts and humanities subjects are on the Class 11 list?',
  40, '{}', NULL,
  $cbse$[[lead]]
A humanities set is a language plus the history, politics, or other subjects the school teaches.

[[checks]]
Directions parents ask about
- History, Political Science, Geography, Psychology
- Law: CLAT is after Class 12, for the five-year law degree at national law universities
- NLU Delhi uses AILET, a different exam

[[example]]
ONE EXAMPLE
A child taking History and Political Science is not automatically on a law path. CLAT looks at Class 12. The school still has to teach those subjects.

[[note]]
WHAT MAY VARY
The school list is the limit. A subject in a career conversation may not be on the timetable.

[[ask-school]]
Which humanities subjects are taught here?
$cbse$);

SELECT path_put_node('cbse-11-unsure', 'cbse-11-interests', 'interest', 'My child is unsure', NULL,
  'Keep a mix the school can still teach.',
  'Which balanced set can this timetable still hold?',
  50, '{}', NULL,
  $cbse$[[lead]]
When a direction is not settled, keep subjects that still leave more than one group open.

[[checks]]
A mix parents keep
- A language
- Mathematics, or one science
- One humanities or commerce subject the school teaches

[[example]]
ONE EXAMPLE
English, Mathematics, and Economics can leave engineering and commerce both still discussable. The school has to offer that trio.

[[note]]
WHY THIS MIX
The aim is to avoid closing a group the school can still teach. It is not a recommended career.

[[ask-school]]
Which set can we take now without closing mathematics or a science?
$cbse$);

SELECT path_put_node('cbse-11-ask', 'cbse-11-subjects', 'topic', 'Ask parents about choosing subjects', NULL,
  'For parents whose children have already chosen.',
  'How did your child choose Class 11 subjects when a career was not settled?',
  40, '{}', NULL,
  $cbse$[[lead]]
This is a question for parents whose children have already chosen Class 11 subjects.

[[checks]]
What you can ask
- Which group they chose
- What the school could not timetable
- What they would ask earlier

[[example]]
ONE EXAMPLE
A parent answers from their own child's school. Their PCM list may not match yours.

[[note]]
WHAT POSTING DOES
Posting a question does not lock a combination for your child. It does not change the class or the board.

[[ask-school]]
Which combinations can this timetable actually hold?
$cbse$);

SELECT path_put_node('cbse-11-workload', 'cbse-stay', 'lens', 'Workload and transition', NULL,
  'Class 11 is a step up. The board exam is in Class 12.',
  'How does this school treat Class 11 marks?',
  30, '{}', NULL,
  $cbse$[[lead]]
Class 11 is harder than Class 10. The CBSE board exam for this stage is at the end of Class 12.

[[checks]]
What changes
- Each science or commerce subject is its own course
- The school sets Class 11 tests
- Entrance dates in Class 12 move every year

[[example]]
ONE EXAMPLE
A physics test in Class 11 is the school's test. It is not the Class 12 board paper, and it is not JEE.

[[note]]
WHAT TO ASK
Ask how Class 11 marks are used for promotion into Class 12. Ask nothing on this page to predict an entrance date.

[[ask-school]]
How are Class 11 marks used, and when do you start Class 12 board talk?
$cbse$);

SELECT path_put_node('cbse-11-college', 'cbse-stay', 'lens', 'College and career possibilities', NULL,
  'Entrances look at Class 12. Class 10 is not that exam.',
  'Which entrance matches the direction we are reading about?',
  40, '{}', NULL,
  $cbse$[[lead]]
College entrances in India look at Class 12, or at appearing for Class 12. They do not look at Class 10 as the qualifying exam.

[[checks]]
Exams parents ask about
- JEE Main, for engineering
- NEET UG, for MBBS, BDS, and AYUSH
- CUET, for many central universities
- TG EAPCET, in Telangana, for engineering, agriculture, and pharmacy

[[example]]
ONE EXAMPLE
A child in Class 10 can read about NEET. The form, when it opens, will ask about Class 12. TG EAPCET is not the medical entrance.

[[note]]
WHAT THIS PAGE DOES NOT SAY
It does not say this child is eligible. Subject rules are on that year's bulletin. Domicile rules for a state exam are on that exam's page.

[[ask-school]]
Which exam are we actually talking about, and which Class 12 subjects does it ask for?
$cbse$);

SELECT path_put_node('cbse-11-check', 'cbse-stay', 'lens', 'Requirements to check', NULL,
  'School list first, then the entrance bulletin.',
  'Can I see the Class 11 subject list and the entrance rule side by side?',
  50, '{}', NULL,
  $cbse$[[lead]]
Three checks, in this order.

[[checks]]
Check
- The school's Class 11 subject list
- The entrance bulletin for the year your child finishes Class 12
- Whether that bulletin's subjects are on the school list

[[example]]
ONE EXAMPLE
The school teaches Physics and Mathematics, but not the vocational subject named in a bulletin. That is a timetable fact. You find it by putting the two lists next to each other.

[[note]]
WHAT OPENING THIS DOES
It does not choose a group. It does not register your child for an entrance.

[[ask-school]]
Can you show the Class 11 list that matches the exam we are asking about?
$cbse$);

UPDATE path_nodes SET
  lead = $cbse$[[lead]]
Most families stay on CBSE for Classes 11 and 12.

[[checks]]
Names parents use
- PCM
- PCB
- PCMB
- Commerce
- Arts

[[example]]
ONE EXAMPLE
The school offers PCM with English and Computer Science. A prospectus that only says PCM does not show the Computer Science until you ask.

[[note]]
WHAT THESE NAMES MEAN
They are groups of subjects the school offers. They are not a fixed CBSE law. Class 12 is the usual qualifying exam for college entrances in India. The rules for that year still apply. The tiles below are how those groups connect to subjects and to later study.

[[ask-school]]
Which Class 11 groups does this school offer?

[[view tiles]]
$cbse$,
  summary = 'Classes 11 and 12 on CBSE. Subjects, interests, and the checks before a choice.',
  ask_prompt_default = 'Which Class 11 groups does this school offer?',
  updated_at = now()
WHERE slug = 'cbse-stay';

UPDATE path_nodes SET
  lead = $cbse$[[lead]]
These are the choices after the Class 10 exam. Opening one does not pick it.

[[checks]]
The choices
- Stay in CBSE for Classes 11 and 12
- Switch to Cambridge A Level, the IB Diploma, or ISC
- Intermediate, in Telangana or Andhra Pradesh
- Polytechnic diploma, in Telangana
- A skill or vocational subject
- Not sure yet

[[note]]
WHAT CLASS 10 IS NOT
Class 10 is not Class 12. The next school has to offer the course. Most families stay in CBSE.

[[view tiles]]
$cbse$,
  summary = 'The choices for the next two years, including subjects and careers inside CBSE.',
  updated_at = now()
WHERE slug = 'cbse-g10-after';

UPDATE path_nodes SET
  lead = $cbse$[[lead]]
A different board after Class 10. The new school must teach that course. A Class 10 marksheet does not move your child across by itself.

[[checks]]
The switches
- Cambridge A Level
- IB Diploma
- ISC
- Intermediate in Telangana or Andhra Pradesh

[[view tiles]]
$cbse$,
  updated_at = now()
WHERE slug = 'cbse-switch';

SELECT path_put_node('cbse-to-inter', 'cbse-switch', 'route', 'State Intermediate', NULL,
  'Two years of junior college in Telangana or Andhra Pradesh.',
  'Which Intermediate group would accept a CBSE Class 10 certificate?',
  40, ARRAY['TG','AP'], NULL,
  $cbse$[[lead]]
After Class 10, a student in Telangana or Andhra Pradesh can join Intermediate at a junior college for two years.

[[checks]]
Groups parents ask about
- MPC: maths, physics, chemistry
- BiPC: biology, physics, chemistry
- MEC: maths, economics, commerce

[[example]]
ONE EXAMPLE
A CBSE family in Hyderabad looks at MPC at a junior college. The college has to accept the CBSE Class 10 certificate and offer the group.

[[note]]
WHAT THESE NAMES ARE
They are junior-college groups in these two states. They are not CBSE's PCM and PCB labels. This row is only for Telangana and Andhra Pradesh.

[[ask-school]]
Which groups does the college offer, and does it take CBSE Class 10?
$cbse$);

SELECT path_put_node('cbse-vocational', 'cbse-g10-after', 'route', 'Skill or vocational study', NULL,
  'Ask which certificate the course actually awards.',
  'Which certificate does this skill course award?',
  35, '{}', NULL,
  $cbse$[[lead]]
Some schools offer a skill subject with Classes 11 and 12, or a separate certificate course after Class 10.

[[checks]]
Ask
- The name of the certificate
- Who issues it
- Whether it sits inside CBSE Class 11 or instead of it

[[example]]
ONE EXAMPLE
A school adds a skill subject next to Physics and Mathematics. Another school offers a standalone certificate. They are not the same route.

[[note]]
WHAT THIS IS NOT
Not POLYCET, unless the school says that exam by name. Not an MBBS seat. The useful question is which certificate is awarded.

[[ask-school]]
What is the certificate called, and is it part of Class 11?
$cbse$);


DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text, text
);

COMMIT;
