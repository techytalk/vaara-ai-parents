-- Orientation copy for Child's Path nodes.
-- Safe to run more than once. Facts match the reviewed catalogue
-- (AIU, IBO, NTA, SBTET, CBSE, Cambridge). This is not eligibility.

BEGIN;

CREATE OR REPLACE FUNCTION path_set_copy(p_slugs text[], p_summary text, p_lead text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE path_nodes
  SET summary = p_summary,
      lead = p_lead,
      updated_at = now()
  WHERE slug = ANY(p_slugs);
$$;

SELECT path_set_copy(ARRAY['ib-myp-g9'],
  'Still in MYP. Grade 10 is the Class 10 stage.',
  'Grade 9 is still the Middle Years Programme. AIU treats the end of MYP, Grade 10, as Class 10, not Class 12. Looking ahead on this screen does not change the child’s programme.');

SELECT path_set_copy(ARRAY['ib-myp-g9-next'],
  'The last MYP year. Class 10 equivalent, not Class 12.',
  'Grade 10 is the final MYP year. AIU equates that year with Class 10. It is not a university-entry qualification.');

SELECT path_set_copy(ARRAY['ib-myp-g9-stay'],
  'Finish MYP at the same school.',
  'Stay for the final MYP year. The personal project and subject grades are between the family and the school. This is not a change of board.');

SELECT path_set_copy(ARRAY['ib-myp-g9-transfer'],
  'A mid-MYP move is decided by the receiving school.',
  'Some families look at leaving MYP before Grade 10. Whether another school will accept that transfer is decided by that school. This screen does not list school vacancies.');

SELECT path_set_copy(ARRAY['ib-myp-g9-ahead','ib-myp-g10'],
  'Routes after MYP Grade 10. Exploring does not enrol the child.',
  'These are routes after MYP Grade 10. Opening one does not enrol the child and does not change curriculum or grade. MYP itself is not treated as Class 12.');

SELECT path_set_copy(ARRAY['ib-continue-g9','ib-continue-g10'],
  'Diploma or Career-related Programme, if the school offers them.',
  'After MYP, the IB routes schools usually discuss are the Diploma Programme and the Career-related Programme. The school decides which of those it teaches.');

SELECT path_set_copy(ARRAY['ib-dp-g9','ib-dp-g10'],
  'Two years. Usually 3 HL and 3 SL. AIU can treat the Diploma as Class 12.',
  'The Diploma is a two-year programme: six subjects, usually three Higher Level and three Standard Level, plus Theory of Knowledge, the Extended Essay, and Creativity, Activity, Service. AIU equates the IB Diploma — and an IB course certificate of 24 or more points with 3 HL and 3 SL — with Indian Class 12. MYP is not that equivalent. A college may still ask for an AIU equivalence certificate. NTA lists the IB Diploma, not MYP, among Class 12-equivalent qualifying exams.');

SELECT path_set_copy(ARRAY['ib-cp-g9','ib-cp-g10'],
  'Career study plus some Diploma courses. Not a Diploma substitute.',
  'The Career-related Programme combines career-related study with at least two Diploma courses. Indian university recognition is narrower than the Diploma and is checked college by college. It is not a substitute for the Diploma.');

SELECT path_set_copy(ARRAY['ib-dp-what-g9','ib-dp-what-g10'],
  'Six subjects plus the Diploma core. Official description is on ibo.org.',
  'The IB describes the Diploma as six subject groups, three Higher Level and three Standard Level, plus the core. Current subject briefs are on ibo.org. This row is orientation, not an application.');

SELECT path_set_copy(ARRAY['ib-dp-subjects-g9','ib-dp-subjects-g10'],
  'The school’s list decides what can actually be chosen.',
  'The IB publishes a subject guide. Each school publishes the smaller list it actually teaches. A subject in the guide is not automatically available at the child’s school.');

SELECT path_set_copy(ARRAY['ib-dp-workload-g9','ib-dp-workload-g10'],
  'Core plus HL hours. May exams can overlap Indian entrances.',
  'The step up from MYP includes Higher Level hours and the Diploma core. May-session written papers can fall in the same weeks as Indian entrances. Exact dates change every year. A predicted grade is not the same as sitting JEE or NEET.');

SELECT path_set_copy(ARRAY['ib-dp-college-g9','ib-dp-college-g10'],
  'Indian entrances that ask for Class 12 look at the Diploma, not MYP.',
  'JEE Main’s bulletin lists the IB Diploma as a qualifying exam and does not list MYP or IGCSE. NEET expects a Class 12 equivalent with the required sciences; a foreign board often needs an AIU equivalence certificate. Subject rules are on that year’s form. Nothing on this screen says this child is eligible.');

SELECT path_set_copy(ARRAY['ib-dp-check-g9','ib-dp-check-g10'],
  'Check the school list, the IB guide, and the college bulletin.',
  'Three checks: the school’s Diploma subject list, the IB subject brief, and the entrance or college page for the year of entry. Opening a subject here does not register the child for it.');

SELECT path_set_copy(ARRAY['ib-dp-understand-g9','ib-dp-understand-g10'],
  'Six subjects, three HL and three SL, within the school timetable.',
  'Most Diploma students take six subjects from set groups: three at Higher Level and three at Standard Level, plus the core. Which pairs fit together depends on the school timetable.');

SELECT path_set_copy(ARRAY['ib-dp-hlsl-g9','ib-dp-hlsl-g10'],
  'HL is more hours and a deeper syllabus than SL in the same subject.',
  'Higher Level means more teaching hours and a deeper syllabus than Standard Level in that subject. The IB does not require one fixed subject at HL for every university. Each college writes its own subject and level rule.');

SELECT path_set_copy(ARRAY['ib-dp-combos-g9','ib-dp-combos-g10'],
  'Groups cover languages, societies, sciences, mathematics, and the arts.',
  'Students choose across studies in language and literature, language acquisition, individuals and societies, sciences, mathematics, and the arts — or a second subject from another group instead of the arts. The school timetable is the real limit.');

SELECT path_set_copy(ARRAY['ib-dp-areas-g9','ib-dp-areas-g10'],
  'IB subject groups. Not CBSE streams such as PCM or PCB.',
  'These are Diploma subject groups. PCM and PCB are parent names for CBSE combinations. They are not Diploma labels.');

SELECT path_set_copy(ARRAY['ib-dp-math-g9','ib-dp-math-g10'],
  'One maths course: AA or AI, at HL or SL.',
  'Diploma mathematics is a single course: Analysis and approaches (AA) or Applications and interpretation (AI), at Higher Level or Standard Level. A student takes one of those four, not both courses. A school may not teach every combination.');

SELECT path_set_copy(ARRAY['ib-dp-math-aa-g9','ib-dp-math-aa-g10'],
  'AA is more algebraic. AI is more applied. Both have HL and SL.',
  'Analysis and approaches emphasises algebra, calculus, and proof. Applications and interpretation emphasises statistics, modelling, and technology. Both exist at HL and SL. Which one a college prefers is on that college’s page. There is no single national rule.');

SELECT path_set_copy(ARRAY['ib-dp-math-level-g9','ib-dp-math-level-g10'],
  'HL maths is common for some courses and is not universal.',
  'Some engineering and economics courses ask for Mathematics HL. Many do not. Confirm the course page for the year. Choosing HL on this screen does not register the child.');

SELECT path_set_copy(ARRAY['ib-dp-math-check-g9','ib-dp-math-check-g10'],
  'School offer first, then the entrance subject rule.',
  'Check whether the school teaches AA or AI, and at which level. Then read the entrance or college subject rule. MYP mathematics is not the Diploma course.');

SELECT path_set_copy(ARRAY['ib-dp-sci-g9','ib-dp-sci-g10'],
  'Biology, Chemistry, Physics — HL or SL if the school teaches them.',
  'Diploma sciences are usually Biology, Chemistry, and Physics, each at HL or SL when the school offers them. NEET looks for a Class 12 equivalent with the required sciences. Taking a science at HL is not the same as being eligible for NEET.');

SELECT path_set_copy(ARRAY['ib-dp-lang-g9','ib-dp-lang-g10'],
  'Language A is literature. Language B is an additional language.',
  'Language A is the studies-in-language-and-literature course. Language B is an additional language. The school chooses which languages it teaches. This is not a CBSE second-language rule.');

SELECT path_set_copy(ARRAY['ib-dp-soc-g9','ib-dp-soc-g10'],
  'History, Economics, Business Management, and others the school teaches.',
  'Individuals and societies includes subjects such as History, Economics, and Business Management when the school offers them. The names on the school list are the ones that can be chosen.');

SELECT path_set_copy(ARRAY['ib-dp-arts-g9','ib-dp-arts-g10'],
  'Visual arts and other arts subjects, or a second subject instead.',
  'The arts group includes Visual arts and other arts subjects if the school teaches them. IB rules also allow a student to take an extra subject from another group instead of an arts subject, if the timetable allows it.');

SELECT path_set_copy(ARRAY['ib-dp-interests-g9','ib-dp-interests-g10'],
  'Interests, not CBSE streams. They do not assign PCM or PCB.',
  'These rows are future interests. They do not place the child in a CBSE stream and they do not set Higher Level subjects.');

SELECT path_set_copy(ARRAY['ib-dp-eng-g9','ib-dp-eng-g10'],
  'Often mathematics plus a science. JEE still has its own subject rule.',
  'Families often look at Mathematics plus Physics or another science. JEE Main lists the IB Diploma as a qualifying exam and still requires the bulletin’s subject set, including Physics and Mathematics. Whether those must be HL is a college-by-college check. This row does not say the child can sit JEE.');

SELECT path_set_copy(ARRAY['ib-dp-med-g9','ib-dp-med-g10'],
  'NEET needs a Class 12 equivalent with sciences. MYP is not that.',
  'NEET is the entrance for MBBS, BDS, and related Indian medical seats. It expects a Class 12 equivalent with the required sciences. The Diploma can be that equivalent under AIU rules. MYP cannot. An AIU certificate is commonly asked for when the board is not CBSE or a state board. Subject rules are on the current NEET bulletin.');

SELECT path_set_copy(ARRAY['ib-dp-bus-g9','ib-dp-bus-g10'],
  'Economics or Business Management are common, not universally required.',
  'Economics and Business Management are frequent Diploma choices for this interest. They are not required by every business or economics degree. The university page is the check.');

SELECT path_set_copy(ARRAY['ib-dp-human-g9','ib-dp-human-g10'],
  'Languages, arts, and individuals-and-societies subjects.',
  'A humanities set is usually a language, an arts subject or a second humanity, and individuals-and-societies subjects the school teaches. The school list is the limit.');

SELECT path_set_copy(ARRAY['ib-dp-unsure-interest-g9','ib-dp-unsure-interest-g10'],
  'Keep a mix the school can teach until a direction is clearer.',
  'When a career is not settled, families often keep a language, one science or humanity, and mathematics at a level the student can sustain. The point is to avoid closing a group the school can still teach.');

SELECT path_set_copy(ARRAY['ib-dp-ask-subjects-g9','ib-dp-ask-subjects-g10'],
  'A question for parents who have already chosen Diploma subjects.',
  'This is a place to ask parents whose children have already chosen Diploma subjects. Posting a question does not lock a combination for your child.');

SELECT path_set_copy(ARRAY['ib-switch-g9','ib-switch-g10'],
  'A different qualification after Grade 10. The school may not offer it.',
  'Switching means a different qualification after Grade 10. The child’s current school may not teach that programme. This list is of real routes, not that school’s prospectus.');

SELECT path_set_copy(ARRAY['ib-alevel-g9','ib-alevel-g10','cbse-to-alevel','igcse-alevel','ssc-alevel'],
  'Usually 3 or 4 subjects. A Level can be Class 12. IGCSE and MYP are not.',
  'Cambridge International AS and A Level is usually three or four subjects. AIU can treat A Level — typically two or three Advanced-level subjects, after 12 years of school — as Class 12 equivalent. IGCSE and MYP are not that equivalent. NTA lists GCE A Level, not IGCSE, among JEE Main qualifying exams. The subject match is still required.');

SELECT path_set_copy(ARRAY['ib-cbse-g9','ib-cbse-g10','cbse-stay','igcse-cbse','ssc-cbse'],
  'Classes 11–12. PCM, PCB, Commerce, and Arts are school combinations.',
  'CBSE Classes 11 and 12 are senior secondary. The school offers the subject combinations. Parents often call them PCM, PCB, PCMB, Commerce, or Arts. Those names are not a list written into a CBSE statute. CBSE Class 12 is the usual qualifying exam for Indian entrances; the bulletin for that year still applies.');

SELECT path_set_copy(ARRAY['ib-isc-g9','ib-isc-g10','cbse-to-isc'],
  'CISCE Classes 11–12. The school has to offer ISC.',
  'ISC is the CISCE Class 11–12 certificate. It is a different board from CBSE and from the IB. Only a school that offers ISC can place the child on it.');

SELECT path_set_copy(ARRAY['ib-inter-g9','ib-inter-g10','ssc-inter'],
  'Two-year junior college in Telangana or Andhra Pradesh.',
  'After Class 10, Telangana and Andhra Pradesh students can join Intermediate at a junior college for two years. Common groups include MPC, BiPC, and MEC. Those names are not the same as CBSE’s PCM and PCB labels. This row is only for those two states.');

SELECT path_set_copy(ARRAY['ib-other-g9','ib-other-g10'],
  'Routes that are not a Class 11–12 board programme.',
  'These are education routes after Grade 10 that are not a two-year board programme such as the Diploma, A Level, or CBSE 11–12.');

SELECT path_set_copy(ARRAY['ib-poly-g9','ib-poly-g10','cbse-poly','ssc-poly'],
  'Telangana POLYCET after Class 10. Not EAPCET and not MBBS.',
  'In Telangana, POLYCET is the entrance to an engineering diploma after Class 10, or an equivalent such as CBSE or ICSE Class 10. It is not EAPCET and it is not an MBBS seat. A later ECET can be a lateral route into B.Tech. Andhra Pradesh uses a different polytechnic entrance, so this row is Telangana only.');

SELECT path_set_copy(ARRAY['ib-vocational-g9','ib-vocational-g10'],
  'Ask which certificate the programme actually awards.',
  'Skill and vocational programmes differ by school and institute. The useful question is which certificate is awarded, and which board or council recognises it.');

SELECT path_set_copy(ARRAY['ib-unsure-g9','ib-unsure-g10','cbse-unsure','igcse-unsure','ssc-unsure'],
  'Compare the routes without choosing one.',
  'You can read and compare the routes here without picking one. Nothing on this screen changes the child’s curriculum, grade, or circle membership.');

SELECT path_set_copy(ARRAY['cbse-g10'],
  'After Class 10. Class 10 alone is not Class 12.',
  'After CBSE Class 10, most families continue to CBSE Classes 11–12. Other routes are on this screen. Class 10 by itself is not a Class 12 qualification for undergraduate entrances.');

SELECT path_set_copy(ARRAY['cbse-switch'],
  'Another board after Class 10. Confirm the new school offers it.',
  'These are other qualifications after CBSE Class 10. The receiving school has to offer the programme. Switching is not automatic from the Class 10 marksheet.');

SELECT path_set_copy(ARRAY['cbse-to-dp','igcse-dp'],
  'A two-year Diploma. IGCSE or CBSE Class 10 is not Class 12.',
  'The IB Diploma is its own two-year programme, with six subjects and the core. Coming from CBSE Class 10 or IGCSE does not by itself meet a Class 12 entrance requirement. The Diploma, once completed on AIU terms, can.');

SELECT path_set_copy(ARRAY['igcse-y11'],
  'IGCSE is the Class 10 stage, not Class 12.',
  'Cambridge IGCSE at Year 11 is the Class 10 stage. A Level, the Diploma, or another senior programme comes after it. NTA does not list IGCSE as a Class 12-equivalent qualifying exam for JEE Main.');

SELECT path_set_copy(ARRAY['ssc-g10'],
  'After SSC: Intermediate, or Telangana Polytechnic.',
  'After SSC Class 10, the common next step in Telangana and Andhra Pradesh is Intermediate. In Telangana, a polytechnic diploma through POLYCET is the other public route. SSC Class 10 is not Class 12.');

DROP FUNCTION path_set_copy(text[], text, text);

COMMIT;
