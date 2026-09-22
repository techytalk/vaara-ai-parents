-- Child's Path exploration tree.
-- Run this whole file once in the Supabase SQL editor.
-- It is one transaction: if anything fails, nothing is left behind.

BEGIN;

CREATE TYPE path_node_kind AS ENUM (
  'root',
  'section',
  'route',
  'lens',
  'topic',
  'interest',
  'link'
);

CREATE TYPE path_node_status AS ENUM ('draft', 'published', 'retired');

CREATE TABLE path_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES path_nodes(id) ON DELETE RESTRICT,
  kind path_node_kind NOT NULL,
  status path_node_status NOT NULL DEFAULT 'published',
  title text NOT NULL,
  kicker text,
  summary text,
  lead text,
  sort_order int NOT NULL DEFAULT 0,
  board_families text[] NOT NULL DEFAULT '{}',
  curriculum_codes text[] NOT NULL DEFAULT '{}',
  stage_ids text[] NOT NULL DEFAULT '{}',
  state_codes text[] NOT NULL DEFAULT '{}',
  allow_ask boolean NOT NULL DEFAULT true,
  allow_discussions boolean NOT NULL DEFAULT true,
  ask_prompt_default text,
  pathway_item_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT path_nodes_no_self CHECK (parent_id IS DISTINCT FROM id)
);

CREATE INDEX idx_path_nodes_parent_sort ON path_nodes (parent_id, sort_order);
CREATE INDEX idx_path_nodes_status ON path_nodes (status) WHERE status = 'published';

CREATE TABLE path_node_roots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  board_families text[] NOT NULL DEFAULT '{}',
  curriculum_codes text[] NOT NULL DEFAULT '{}',
  stage_ids text[] NOT NULL,
  grade_codes text[] NOT NULL DEFAULT '{}',
  include_after_10_fork boolean NOT NULL DEFAULT false,
  root_node_id uuid NOT NULL REFERENCES path_nodes(id),
  sort_order int NOT NULL DEFAULT 0,
  status path_node_status NOT NULL DEFAULT 'published'
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_messages_id_circle
  ON circle_messages (id, circle_id);

CREATE TABLE path_discussion_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_node_id uuid NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL,
  message_id uuid NOT NULL,
  thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_node_id, message_id),
  FOREIGN KEY (message_id, circle_id)
    REFERENCES circle_messages (id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id, circle_id)
    REFERENCES circle_threads (id, circle_id) ON DELETE SET NULL (thread_id)
);

CREATE INDEX idx_path_discussion_links_node
  ON path_discussion_links (path_node_id, created_at DESC);

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
  p_pathway text DEFAULT NULL
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
    slug, parent_id, kind, title, kicker, summary, ask_prompt_default,
    sort_order, state_codes, pathway_item_slug, status
  ) VALUES (
    p_slug, parent, p_kind, p_title, p_kicker, p_summary, p_prompt,
    p_sort, COALESCE(p_states, '{}'), p_pathway, 'published'
  );
END;
$$;

-- IB MYP Grade 9
SELECT path_put_node('ib-myp-g9', NULL, 'root', 'This year', NULL, 'Your child is in IB MYP.', NULL, 0, '{}', NULL);
SELECT path_put_node('ib-myp-g9-next', 'ib-myp-g9', 'section', 'Next year — Grade 10', NULL, 'The final MYP year.', NULL, 10, '{}', NULL);
SELECT path_put_node('ib-myp-g9-stay', 'ib-myp-g9-next', 'route', 'Continue IB MYP', 'Continue IB', 'Complete the final MYP year.', 'IB MYP parents: what helped in the final MYP year?', 10, '{}', NULL);
SELECT path_put_node('ib-myp-g9-transfer', 'ib-myp-g9-next', 'route', 'Considering a curriculum change?', 'Switch', 'Explore school-specific transfer options. Check with your school.', 'Parents who looked at leaving MYP before Grade 10: what did the school actually allow?', 20, '{}', NULL);
SELECT path_put_node('ib-myp-g9-ahead', 'ib-myp-g9', 'section', 'Explore ahead — after Grade 10', NULL, 'Exploring ahead does not change your child’s profile.', NULL, 20, '{}', NULL);

-- IB MYP Grade 10 (no "next year — Grade 10")
SELECT path_put_node('ib-myp-g10', NULL, 'root', 'After Grade 10', NULL, 'Some options after MYP Grade 10.', NULL, 0, '{}', NULL);

DO $$
DECLARE
  suffix text;
  continue_parent text;
BEGIN
  FOREACH suffix IN ARRAY ARRAY['g9', 'g10']
  LOOP
    continue_parent := CASE WHEN suffix = 'g9' THEN 'ib-myp-g9-ahead' ELSE 'ib-myp-g10' END;

    PERFORM path_put_node('ib-continue-' || suffix, continue_parent, 'section', 'Continue within IB', 'Continue IB', NULL, NULL, 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-' || suffix, 'ib-continue-' || suffix, 'route', 'IB Diploma Programme', 'Continue IB', 'Two years. HL and SL subjects. Not a profile change.', 'Parents with children in IB DP: how did you choose HL and SL subjects?', 10, '{}', 'ib-diploma');
    PERFORM path_put_node('ib-cp-' || suffix, 'ib-continue-' || suffix, 'route', 'IB Career-related Programme', 'Other route', 'Career-related study plus DP courses.', 'Parents who looked at IBCP: how is it different from the full Diploma?', 20, '{}', NULL);

    PERFORM path_put_node('ib-dp-what-' || suffix, 'ib-dp-' || suffix, 'link', 'What is this programme?', NULL, 'Orientation only. Open official details.', NULL, 10, '{}', 'ib-diploma');
    PERFORM path_put_node('ib-dp-subjects-' || suffix, 'ib-dp-' || suffix, 'lens', 'Subjects and choices', NULL, 'How families pick HL and SL.', 'How did your child choose IB DP subjects?', 20, '{}', NULL);
    PERFORM path_put_node('ib-dp-workload-' || suffix, 'ib-dp-' || suffix, 'lens', 'Workload and transition', NULL, 'The jump from MYP and exam timing.', 'DP parents: how did you plan around May exams and Indian entrance dates?', 30, '{}', NULL);
    PERFORM path_put_node('ib-dp-college-' || suffix, 'ib-dp-' || suffix, 'lens', 'College and career possibilities', NULL, 'Indian entrances need a recognised Class 12 equivalent. MYP is not that.', 'Parents whose children did IB DP: how did you weigh Indian entrances with abroad routes?', 40, '{}', NULL);
    PERFORM path_put_node('ib-dp-check-' || suffix, 'ib-dp-' || suffix, 'lens', 'Requirements to check', NULL, 'School offering, subject rules, and college pages. Not eligibility.', 'What did your child’s school require before confirming DP subjects?', 50, '{}', NULL);

    PERFORM path_put_node('ib-dp-understand-' || suffix, 'ib-dp-subjects-' || suffix, 'section', 'Understand subject selection', NULL, NULL, NULL, 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-hlsl-' || suffix, 'ib-dp-understand-' || suffix, 'topic', 'What are HL and SL?', NULL, 'Most students take three HL and three SL, plus the core.', 'How did you explain HL versus SL to your child?', 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-combos-' || suffix, 'ib-dp-understand-' || suffix, 'topic', 'How do subject combinations work?', NULL, 'Groups and combinations depend on the school.', 'Which DP combinations did your school actually offer?', 20, '{}', NULL);

    PERFORM path_put_node('ib-dp-areas-' || suffix, 'ib-dp-subjects-' || suffix, 'section', 'Explore subject areas', NULL, NULL, NULL, 20, '{}', NULL);
    PERFORM path_put_node('ib-dp-math-' || suffix, 'ib-dp-areas-' || suffix, 'topic', 'Mathematics', NULL, 'Analysis and approaches, or applications and interpretation.', 'How did your child choose between Maths AA and AI?', 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-math-aa-' || suffix, 'ib-dp-math-' || suffix, 'topic', 'Understand AA and AI', NULL, 'AA is more algebraic. AI is more applied. The school decides what it offers.', 'Parents: what surprised you about Maths AA versus AI?', 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-math-level-' || suffix, 'ib-dp-math-' || suffix, 'topic', 'Understand HL and SL choices', NULL, 'HL is not required for every engineering college. Check the college page.', 'Who chose Maths HL, and what did it change for college?', 20, '{}', NULL);
    PERFORM path_put_node('ib-dp-math-check-' || suffix, 'ib-dp-math-' || suffix, 'topic', 'What requirements should we check?', NULL, 'School list, then the college’s subject rules. Exploring does not make the child eligible.', 'Which college pages did you check before locking DP Maths?', 30, '{}', NULL);
    PERFORM path_put_node('ib-dp-sci-' || suffix, 'ib-dp-areas-' || suffix, 'topic', 'Sciences', NULL, 'Biology, Chemistry, Physics — HL or SL as the school offers.', 'How did you choose DP sciences when medicine was only a maybe?', 20, '{}', NULL);
    PERFORM path_put_node('ib-dp-lang-' || suffix, 'ib-dp-areas-' || suffix, 'topic', 'Languages', NULL, 'Language A and Language B rules are school-specific.', 'How did you pick DP languages?', 30, '{}', NULL);
    PERFORM path_put_node('ib-dp-soc-' || suffix, 'ib-dp-areas-' || suffix, 'topic', 'Individuals and societies', NULL, 'History, economics, business management, and others.', 'Which individuals-and-societies subject did families actually use?', 40, '{}', NULL);
    PERFORM path_put_node('ib-dp-arts-' || suffix, 'ib-dp-areas-' || suffix, 'topic', 'Arts', NULL, 'Visual arts and other arts subjects, if the school offers them.', 'Did anyone keep an arts subject in DP alongside sciences?', 50, '{}', NULL);

    PERFORM path_put_node('ib-dp-interests-' || suffix, 'ib-dp-subjects-' || suffix, 'section', 'Connect subjects to future interests', NULL, 'These are interests, not CBSE streams.', NULL, 30, '{}', NULL);
    PERFORM path_put_node('ib-dp-eng-' || suffix, 'ib-dp-interests-' || suffix, 'interest', 'Engineering', NULL, 'Often Maths plus a science. Check each college. Not JEE eligibility.', 'DP parents aiming at engineering: which HL subjects mattered?', 10, '{}', NULL);
    PERFORM path_put_node('ib-dp-med-' || suffix, 'ib-dp-interests-' || suffix, 'interest', 'Medicine', NULL, 'NEET needs a recognised Class 12 equivalent. DP is not automatic eligibility.', 'DP parents who looked at medicine: what did you verify first?', 20, '{}', NULL);
    PERFORM path_put_node('ib-dp-bus-' || suffix, 'ib-dp-interests-' || suffix, 'interest', 'Business and economics', NULL, 'Economics or business management are common, not required everywhere.', 'How did you choose DP subjects for business or economics?', 30, '{}', NULL);
    PERFORM path_put_node('ib-dp-human-' || suffix, 'ib-dp-interests-' || suffix, 'interest', 'Arts and humanities', NULL, 'Languages, arts, and individuals and societies.', 'DP parents in arts or humanities: what did you refuse to drop?', 40, '{}', NULL);
    PERFORM path_put_node('ib-dp-unsure-interest-' || suffix, 'ib-dp-interests-' || suffix, 'interest', 'My child is unsure', NULL, 'Keep a balanced set the school can teach.', 'Your child was unsure in DP. What subject set did you keep open?', 50, '{}', NULL);
    PERFORM path_put_node('ib-dp-ask-subjects-' || suffix, 'ib-dp-subjects-' || suffix, 'topic', 'Ask parents about choosing subjects', NULL, NULL, 'How did your child choose IB DP subjects when a career was not settled?', 40, '{}', NULL);

    PERFORM path_put_node('ib-switch-' || suffix, continue_parent, 'section', 'Switch curriculum', 'Switch', 'The child’s school may not offer every option.', NULL, 20, '{}', NULL);
    PERFORM path_put_node('ib-alevel-' || suffix, 'ib-switch-' || suffix, 'route', 'Cambridge AS / A Level', 'Switch', 'Usually three or four subjects.', 'After MYP, what helped you compare A Level with IB Diploma?', 10, '{}', 'cambridge-a-level');
    PERFORM path_put_node('ib-cbse-' || suffix, 'ib-switch-' || suffix, 'route', 'CBSE Classes 11–12', 'Switch', 'Subject combinations depend on the school. Often described as PCM, PCB, Commerce, or Arts.', 'Parents who switched from MYP to CBSE: how did you choose Class 11 subjects?', 20, '{}', 'cbse-after-10-streams');
    PERFORM path_put_node('ib-isc-' || suffix, 'ib-switch-' || suffix, 'route', 'ISC Classes 11–12', 'Switch', 'CISCE senior secondary. Confirm the school offers it.', 'Has anyone moved from MYP to ISC? What was the first year like?', 30, '{}', NULL);
    PERFORM path_put_node('ib-inter-' || suffix, 'ib-switch-' || suffix, 'route', 'State Intermediate', 'Switch', 'Telangana or Andhra Pradesh junior college groups.', 'Parents who compared Intermediate after an international Grade 10: what was the catch?', 40, ARRAY['TG','AP'], NULL);

    PERFORM path_put_node('ib-other-' || suffix, continue_parent, 'section', 'Explore other education routes', NULL, NULL, NULL, 30, '{}', NULL);
    PERFORM path_put_node('ib-poly-' || suffix, 'ib-other-' || suffix, 'route', 'Polytechnic diploma', 'Other route', 'Telangana POLYCET is after Class 10. Not EAPCET and not MBBS.', 'Parents who chose Polytechnic after Class 10: what should we know before POLYCET?', 10, ARRAY['TG'], 'tg-polycet');
    PERFORM path_put_node('ib-vocational-' || suffix, 'ib-other-' || suffix, 'route', 'Vocational / skill programmes', 'Other route', 'School-specific. Ask what certificate the programme actually gives.', 'Which vocational options after Grade 10 were real, not just a brochure?', 20, '{}', NULL);
    PERFORM path_put_node('ib-unsure-' || suffix, continue_parent, 'route', 'Not sure yet', NULL, 'Compare the options without picking one for your child.', 'Parents comparing Diploma, A Level, and CBSE after MYP: what actually helped you decide?', 40, '{}', NULL);
  END LOOP;
END $$;

-- CBSE Grade 10
SELECT path_put_node('cbse-g10', NULL, 'root', 'After Class 10', NULL, 'Some options for Classes 11–12.', NULL, 0, '{}', NULL);
SELECT path_put_node('cbse-stay', 'cbse-g10', 'route', 'Stay in CBSE 11–12', 'Stay on CBSE', 'PCM, PCB, PCMB, Commerce, and Arts are school combinations, not a statute.', 'How did your child choose subjects for Class 11, and what surprised you?', 10, '{}', 'cbse-after-10-streams');
SELECT path_put_node('cbse-switch', 'cbse-g10', 'section', 'Switch curriculum', 'Switch', NULL, NULL, 20, '{}', NULL);
SELECT path_put_node('cbse-to-alevel', 'cbse-switch', 'route', 'Cambridge AS / A Level', 'Switch', 'A new assessment style.', 'Parents who left CBSE for A Level after Class 10: what was hardest?', 10, '{}', 'cambridge-a-level');
SELECT path_put_node('cbse-to-dp', 'cbse-switch', 'route', 'IB Diploma Programme', 'Switch', 'Orientation only.', 'Parents who moved from CBSE to DP: what did you check first?', 20, '{}', 'ib-diploma');
SELECT path_put_node('cbse-to-isc', 'cbse-switch', 'route', 'ISC Classes 11–12', 'Switch', 'Confirm the school offers ISC.', 'Why did you move from CBSE to ISC, if you did?', 30, '{}', NULL);
SELECT path_put_node('cbse-poly', 'cbse-g10', 'route', 'Polytechnic diploma', 'Other route', 'Telangana POLYCET after Class 10. Not for Andhra Pradesh.', 'Did diploma-then-ECET feel like a real engineering path?', 30, ARRAY['TG'], 'tg-polycet');
SELECT path_put_node('cbse-unsure', 'cbse-g10', 'route', 'Not sure yet', NULL, 'You can ask without choosing a stream.', 'CBSE parents still deciding after Class 10: what helped you compare staying and switching?', 40, '{}', NULL);

-- Cambridge Year 11
SELECT path_put_node('igcse-y11', NULL, 'root', 'After IGCSE', NULL, 'IGCSE is the Class 10 equivalent, not Class 12.', NULL, 0, '{}', NULL);
SELECT path_put_node('igcse-alevel', 'igcse-y11', 'route', 'Cambridge AS / A Level', 'Continue Cambridge', 'Usually three or four subjects.', 'Cambridge parents: which A Levels did you pick, and what did colleges check?', 10, '{}', 'cambridge-a-level');
SELECT path_put_node('igcse-dp', 'igcse-y11', 'route', 'IB Diploma Programme', 'Switch', 'Another two-year programme.', 'After IGCSE, what helped you compare A Level with IB Diploma?', 20, '{}', 'ib-diploma');
SELECT path_put_node('igcse-cbse', 'igcse-y11', 'route', 'CBSE Classes 11–12', 'Switch', 'Indian board combinations. Not JEE eligibility from IGCSE alone.', 'After IGCSE, what helped you compare A Level with CBSE 11–12?', 30, '{}', 'cbse-after-10-streams');
SELECT path_put_node('igcse-unsure', 'igcse-y11', 'route', 'Not sure yet', NULL, NULL, 'After IGCSE, what helped you compare A Level, IB Diploma, and CBSE?', 40, '{}', NULL);

-- SSC Grade 10
SELECT path_put_node('ssc-g10', NULL, 'root', 'After SSC', NULL, 'Some options after Class 10.', NULL, 0, '{}', NULL);
SELECT path_put_node('ssc-inter', 'ssc-g10', 'route', 'Intermediate', 'Continue state', 'Telangana and Andhra Pradesh groups such as MPC, BiPC, and MEC.', 'Parents who explored Intermediate after SSC: what helped you compare the groups?', 10, ARRAY['TG','AP'], NULL);
SELECT path_put_node('ssc-cbse', 'ssc-g10', 'route', 'CBSE Classes 11–12', 'Switch', NULL, 'Parents who switched from SSC to CBSE: how did you choose Class 11 subjects?', 20, '{}', 'cbse-after-10-streams');
SELECT path_put_node('ssc-alevel', 'ssc-g10', 'route', 'Cambridge AS / A Level', 'Switch', NULL, 'Has anyone moved from SSC to A Level after Class 10? What was the catch-up like?', 30, '{}', 'cambridge-a-level');
SELECT path_put_node('ssc-poly', 'ssc-g10', 'route', 'Polytechnic diploma', 'Other route', 'Telangana POLYCET. Not Andhra Pradesh.', 'Parents who compared Intermediate and Polytechnic after SSC: what helped?', 40, ARRAY['TG'], 'tg-polycet');
SELECT path_put_node('ssc-unsure', 'ssc-g10', 'route', 'Not sure yet', NULL, NULL, 'Parents who explored Intermediate and Polytechnic after Class 10: what helped you compare?', 50, '{}', NULL);

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order
)
SELECT 'IB MYP Grade 9', ARRAY['IB'], ARRAY['IB_MYP'], ARRAY['board_10'], ARRAY['G9'],
       false, id, 10
FROM path_nodes WHERE slug = 'ib-myp-g9';

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order
)
SELECT 'IB MYP Grade 10', ARRAY['IB'], ARRAY['IB_MYP'], ARRAY['board_10','after_10'], ARRAY['G10'],
       true, id, 10
FROM path_nodes WHERE slug = 'ib-myp-g10';

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order
)
SELECT 'CBSE Grade 10', ARRAY['CBSE'], ARRAY['CBSE'], ARRAY['board_10','after_10'], ARRAY['G10'],
       true, id, 10
FROM path_nodes WHERE slug = 'cbse-g10';

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order
)
SELECT 'Cambridge Year 11', ARRAY['CAMBRIDGE'], ARRAY['IGCSE'], ARRAY['board_10','after_10'], ARRAY['Y11'],
       true, id, 10
FROM path_nodes WHERE slug = 'igcse-y11';

INSERT INTO path_node_roots (
  label, board_families, curriculum_codes, stage_ids, grade_codes,
  include_after_10_fork, root_node_id, sort_order
)
SELECT 'SSC Grade 10', ARRAY['STATE'], ARRAY['SSC'], ARRAY['board_10','after_10'], ARRAY['G10'],
       true, id, 10
FROM path_nodes WHERE slug = 'ssc-g10';

DROP FUNCTION path_put_node(
  text, text, path_node_kind, text, text, text, text, int, text[], text
);

COMMIT;
