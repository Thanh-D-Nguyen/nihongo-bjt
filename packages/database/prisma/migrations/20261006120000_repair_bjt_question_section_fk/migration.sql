ALTER TABLE assessment.bjt_question
  DROP CONSTRAINT IF EXISTS bjt_question_section_id_fkey;

ALTER TABLE assessment.bjt_question
  ADD CONSTRAINT bjt_question_section_id_fkey
  FOREIGN KEY (section_id)
  REFERENCES assessment.bjt_test_section(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM assessment.bjt_question q
    LEFT JOIN assessment.bjt_test_section s ON s.id = q.section_id
    WHERE s.id IS NULL
  ) THEN
    ALTER TABLE assessment.bjt_question
      VALIDATE CONSTRAINT bjt_question_section_id_fkey;
  END IF;
END
$$;
