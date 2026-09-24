-- Plain answers for IB MYP Grade 9 path leaves.
-- Written for a parent who is new to IB. Safe to re-run.

BEGIN;

UPDATE path_nodes SET
  summary = 'Your school picks the subjects. The IB list is only a menu.',
  lead = 'IB gives schools a menu of eight subject areas. Your school does not have to teach all of them. The subjects on your child''s timetable are the ones for this year. If a subject is not on that timetable, the school is not teaching it now.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-list';

UPDATE path_nodes SET
  summary = 'Some subjects can still change before Grade 10. Ask which ones.',
  lead = 'Not every subject is fixed for next year. The school decides what is already locked, and what your child can still change before Grade 10. Ask those two things at the next meeting. Looking at this page does not change a subject.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-flex';

UPDATE path_nodes SET
  summary = 'A criterion is scored 0 to 8. A 7 is the subject grade.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-grades';

UPDATE path_nodes SET
  summary = '8 is the top of one criterion. A criterion only goes from 0 to 8.',
  lead = E'A criterion is one part the teacher marks.\nEach criterion is scored from 0 to 8.\n\n8 is the highest mark on that criterion.\n0 means the work did not meet the lowest description.\n\n7 is not a criterion score.\n7 is the grade for the whole subject.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-eight';

UPDATE path_nodes SET
  status = 'retired',
  updated_at = now()
WHERE slug IN (
  'ib-myp-g9-faq-seven',
  'ib-myp-g9-faq-higher',
  'ib-myp-g9-faq-percent',
  'ib-myp-g9-faq-convert'
);

UPDATE path_nodes SET
  summary = 'Eight areas. Open one to see what to ask the school.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-groups';

UPDATE path_nodes SET
  summary = 'The main language class: reading, writing, and speaking.',
  lead = 'This is the language your child uses for most schoolwork. The class covers reading, writing, and speaking. Ask the school which language it is. In many schools it is English.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-langlit';

UPDATE path_nodes SET
  summary = 'The extra language. A change is not available at any time.',
  lead = E'This is a language class besides the main one.\n\nIB says your child needs an extra language.\nIt does not say you can switch that language whenever you want.\n\nYour school chooses which languages it teaches.\nYour school also decides if a change is still allowed.\nSome schools lock the language before Grade 10.\n\nAsk two things.\nWhich languages does Grade 9 offer?\nCan my child still change this year?',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-langacq';

UPDATE path_nodes SET
  summary = 'History, geography, or a mix. The school picks the name.',
  lead = 'This subject is about people and the world. It may be history, geography, or a mix of both. Schools use different names for it. Ask what it is called on your child''s timetable this year.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-soc';

UPDATE path_nodes SET
  summary = 'Ask if science is one class, or biology, chemistry, and physics separately.',
  lead = 'Science in Grade 9 is whatever is on the timetable. It might be one combined science class, or separate classes for biology, chemistry, and physics. Ask the school which one your child has. This is not a choice about medicine or engineering. Those decisions come much later.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-sci';

UPDATE path_nodes SET
  summary = 'This year''s maths class. Not a choice for the programme after Grade 10.',
  lead = 'This is the maths class for Grade 9. After Grade 10, the IB Diploma has two maths courses. Their names are Analysis and approaches, and Applications and interpretation. Your child does not choose those now.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-math';

UPDATE path_nodes SET
  summary = 'Only if an art class is on the timetable.',
  lead = 'Arts means a class such as visual art, music, or drama. Ask if Grade 9 has an arts class, and what it is called. If it is not on the timetable, the school is not teaching it this year.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-arts';

UPDATE path_nodes SET
  summary = 'A taught subject with a grade, when the school offers it.',
  lead = 'This is more than a games period. When the school teaches it, your child gets a grade for it, in the same way as other subjects. Ask how it shows on the report.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-phe';

UPDATE path_nodes SET
  summary = 'Its own subject. The school may use another name.',
  lead = 'Design is its own IB subject, separate from art and science. Some schools use a different name on the report. Ask if Grade 9 has a design class, and what the report card calls it.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-grp-design';

UPDATE path_nodes SET
  summary = 'Short answers. Tap a question.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-subj-faq';

UPDATE path_nodes SET
  summary = 'No. Grade 10 is the last year of this programme.',
  lead = 'No. Grade 9 has no IB board exam. The school marks work during the year. Grade 10 is the last year of the Middle Years Programme, which is the IB programme your child is in now.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-exam';

UPDATE path_nodes SET
  summary = 'No. Two IB schools can teach different subjects in Grade 9.',
  lead = E'No.\n\nIB does not give every school the same subjects.\nYour school chooses from a menu.\n\n| | School 1 | School 2 |\n| Science | One class. Biology, chemistry, and physics together. | Three classes: biology, chemistry, and physics. |\n| Extra language | French | Spanish |\n\nBoth schools are IB.\nYour child studies only your school''s timetable.\nAsk the school for that list.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-same';

UPDATE path_nodes SET
  summary = 'Only the school can say. Ask which subjects are required.',
  lead = 'Ask the school which subjects are required this year. Only the school can allow a subject to be dropped. This page cannot remove one.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-drop';

UPDATE path_nodes SET
  summary = 'Four questions for the school.',
  lead = E'Ask four things.\nWhich subjects are already fixed?\nWhich ones can still change before Grade 10?\nHow do criterion scores from 0 to 8 become the subject grade from 1 to 7?\nAre Design, Arts, and Physical education separate classes at this school?',
  updated_at = now()
WHERE slug = 'ib-myp-g9-faq-meeting';

UPDATE path_nodes SET
  summary = 'School tests and projects. No IB board exam this year.',
  lead = 'Grade 9 has tests, projects, and homework set by the school. There is no IB board exam this year. The heavier year is usually Grade 10, the last year of this programme. Ask the school for this year''s dates.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-now-workload';

UPDATE path_nodes SET
  summary = 'Who to talk to, and how the school explains the report.',
  lead = E'Ask the school three things.\nWho do I talk to about a subject?\nHow will you explain a criterion score from 0 to 8, and a subject grade from 1 to 7?\nCan the extra language still change?',
  updated_at = now()
WHERE slug = 'ib-myp-g9-now-support';

UPDATE path_nodes SET
  summary = 'The last year of this IB programme. In India it counts as Class 10, not Class 12.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next';

UPDATE path_nodes SET
  summary = 'What is new in Grade 10, including the personal project.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-subjects';

UPDATE path_nodes SET
  summary = 'A year-long project on something your child cares about.',
  lead = 'In the last year of this programme, your child works on one topic they care about. The project has three parts: the work along the way, something they make or do, and a short report about it. A teacher guides it. IB then checks the report so schools are marking it in a similar way. It is not the long essay that comes in the Diploma, after Grade 10.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-pp-what';

UPDATE path_nodes SET
  summary = 'It is finished in Grade 10. Some schools mention it earlier.',
  lead = 'The project is finished in Grade 10, the last year of this programme. Some schools start talking about it in Grade 9. Ask your school when students begin, and when the report is due. The school sets those dates.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-pp-when';

UPDATE path_nodes SET
  summary = 'The same kinds of subjects. The school decides the exact list.',
  lead = 'Grade 10 keeps the same kinds of subjects as Grade 9. The school decides which classes stay, and which ones can still change. Ask for the Grade 10 list. A subject on the IB menu is not automatically taught at your school.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-subj-same';

UPDATE path_nodes SET
  summary = 'In India, finishing this programme counts as Class 10, not Class 12.',
  lead = 'Yes, for the stage of school. In India, finishing the Middle Years Programme is treated like the end of Class 10, not Class 12. It is not the same paper as a CBSE Class 10 board exam. It is the same point in school: the end of secondary school, before Classes 11 and 12.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-class10';

UPDATE path_nodes SET
  summary = 'No. University and JEE need Class 12, which comes after this year.',
  lead = 'No. University, JEE, and NEET ask for Class 12. Grade 10 of this programme is Class 10, so it is not enough for those. Class 12 comes later, for example in the IB Diploma or in CBSE Classes 11 and 12. Opening this page does not choose that next step.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-not-plus2';

UPDATE path_nodes SET
  summary = 'The project runs all year. Extra IB exams only if the school offers them.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-workload';

UPDATE path_nodes SET
  summary = 'Subject classes continue, and the personal project is added.',
  lead = 'Your child still has subject classes. On top of that, the personal project runs through the year. The school often has more tests and deadlines than in Grade 9. The school sets that calendar.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-heavier';

UPDATE path_nodes SET
  summary = 'The project is checked by IB. Other exams only if the school offers them.',
  lead = 'The project report is marked by the teacher, and IB checks that marking. That is part of finishing Grade 10. Separate IB exams on a computer, and folders of coursework, are extra. The school chooses whether to offer those.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-exam';

UPDATE path_nodes SET
  summary = 'No. Ask if this school signs students up for it.',
  lead = 'No. eAssessment is the optional set of IB exams and coursework in Grade 10. Your child can sit it only if this school signs students up. A normal school report is not the same thing. Ask whether this school offers it, and for which subjects.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-eassess';

UPDATE path_nodes SET
  summary = 'An optional IB certificate. It is not the school report.',
  lead = 'The MYP certificate is an extra IB award. The school has to sign your child up for the full set of Grade 10 IB assessments. That set has eight parts, each scored from 1 to 7: six subjects, one mixed-subject paper, and the personal project. IB asks for at least 28 points out of 56, at least 3 in every part, and the school''s service requirement. The report the school sends home is not this certificate.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-certificate';

UPDATE path_nodes SET
  summary = 'The school sets them.',
  lead = 'The school sets the project deadlines and the test dates. If it offers the optional IB exams, it also decides how students are signed up. Ask for those dates at the start of Grade 10.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-dates';

UPDATE path_nodes SET
  summary = 'What staying on means, and what to check with the school.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-support';

UPDATE path_nodes SET
  summary = 'Finish Grade 10 at the school: classes plus the project.',
  lead = 'Staying means your child finishes Grade 10, usually at the same school. That year includes the subject classes and the personal project. The school confirms there is a place. It does not move your child into the Diploma, and it does not change the curriculum saved on this profile.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-continue';

UPDATE path_nodes SET
  summary = 'No. Your child stays in the same IB programme.',
  lead = 'No. Staying does not move your child to CBSE, Cambridge, or a state board. It also does not start the IB Diploma. The Diploma, and other Class 11–12 choices, come after Grade 10.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-board';

UPDATE path_nodes SET
  summary = 'Four questions to ask the school.',
  lead = 'Ask four things. Is Grade 10 the last year of this programme at our school? When does the personal project start, and when is it due? Does the school offer the optional IB exams? Which subjects are already fixed for Grade 10?',
  updated_at = now()
WHERE slug = 'ib-myp-g9-next-confirm';

UPDATE path_nodes SET
  summary = 'Finish Grade 10 at this school.',
  lead = 'Staying means the subject classes plus the personal project, usually at the same school. The school confirms the place. It does not change the board, and it does not start the Diploma.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-stay';

UPDATE path_nodes SET
  summary = 'Leaving before Grade 10 ends. The new school decides.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer';

UPDATE path_nodes SET
  summary = 'Yes. It means moving to another school.',
  lead = 'Yes. Some families leave during Grade 9 or Grade 10. That means joining another school and following that school''s timetable. It is not a switch you can make inside this app. Opening this page does not change your child''s curriculum or grade.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-when';

UPDATE path_nodes SET
  summary = 'The school your child would be joining.',
  lead = 'The new school decides. It says whether it has a place, which class it will offer, and which subjects. Your current school decides which reports it will share, and when. This page does not list schools.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-who';

UPDATE path_nodes SET
  summary = 'Ask the new school. This is not a jump to Class 11.',
  lead = 'The new school names the class. Leaving during Grade 9 or 10 usually means joining the matching class at that school, not jumping to Class 11. Ask which class, and which subjects, before you assume anything carries over.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-grade';

UPDATE path_nodes SET
  summary = 'No. Class 10 recognition is for finishing the programme.',
  lead = 'No. In India, Class 10 recognition is for finishing this IB programme. A year in the middle is only a school report for the time your child was there. It is not a Class 10 certificate, and it is not Class 12. Ask the current school what document it will give if your child leaves early.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-partial';

UPDATE path_nodes SET
  summary = 'It is finished in Grade 10. Leaving earlier means it stops.',
  lead = 'The personal project is finished in Grade 10, and IB checks that report. If your child leaves before Grade 10 is finished, the project is not completed as an IB project. Ask the current school what it will record for work already done.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-project';

UPDATE path_nodes SET
  summary = 'Usually the same school year on another board. The new school still decides.',
  lead = 'Families usually ask about the same school year on another board: CBSE, Cambridge, ICSE, or a state board. None of these is automatic. The new school decides if it has a place.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-boards';

UPDATE path_nodes SET
  summary = 'No. The Diploma and Classes 11–12 come after Grade 10.',
  lead = 'No. The IB Diploma, Cambridge A Level, and CBSE or ISC Classes 11–12 are choices after Grade 10. You will find them under Explore ahead. This page is only about leaving while your child is still in Grade 9 or 10.',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-after';

UPDATE path_nodes SET
  summary = 'Ask about the class, the subjects, the papers, and the timing.',
  lead = 'Ask four things. Which class will the new school offer? Which subjects will it place? What papers will the current school give you? Would the move happen before Grade 10 ends, or only after it?',
  updated_at = now()
WHERE slug = 'ib-myp-g9-transfer-ask';

COMMIT;
