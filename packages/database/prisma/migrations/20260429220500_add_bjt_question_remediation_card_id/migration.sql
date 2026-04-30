ALTER TABLE assessment.bjt_question
ADD COLUMN remediation_card_id UUID;

ALTER TABLE assessment.bjt_question
ADD CONSTRAINT fk_bjt_question_remediation_card
FOREIGN KEY (remediation_card_id)
REFERENCES learning.flashcard_variant(id)
ON DELETE SET NULL;

CREATE INDEX idx_bjt_question_remediation_card
ON assessment.bjt_question(remediation_card_id);
