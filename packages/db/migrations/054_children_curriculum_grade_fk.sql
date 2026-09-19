-- Keep a child's grade inside the selected curriculum.
-- Preschool rows keep curriculum_id and grade_id NULL (MATCH SIMPLE skips the FK).
-- Also reject a preschool child with a missing age: `age_years IN (3, 4)` is NULL
-- when age_years is NULL, and a CHECK that is NULL passes.

CREATE UNIQUE INDEX IF NOT EXISTS curriculum_grades_curriculum_id_id_key
  ON curriculum_grades (curriculum_id, id);

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_curriculum_grade_fkey;

ALTER TABLE children
  ADD CONSTRAINT children_curriculum_grade_fkey
  FOREIGN KEY (curriculum_id, grade_id)
  REFERENCES curriculum_grades (curriculum_id, id);

ALTER TABLE children
  DROP CONSTRAINT IF EXISTS children_track_fields_check;

ALTER TABLE children
  ADD CONSTRAINT children_track_fields_check CHECK (
    (
      track = 'school'
      AND curriculum_id IS NOT NULL
      AND grade_id IS NOT NULL
      AND age_years IS NULL
    )
    OR (
      track = 'preschool'
      AND curriculum_id IS NULL
      AND grade_id IS NULL
      AND age_years IS NOT NULL
      AND age_years IN (3, 4)
    )
  );
