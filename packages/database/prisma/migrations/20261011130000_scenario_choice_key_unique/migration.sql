DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "content"."scenario_choice"
        GROUP BY "step_id", "choice_key"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'cannot enforce uq_scenario_choice_key: duplicate step_id/choice_key rows exist';
    END IF;
END $$;

CREATE UNIQUE INDEX "uq_scenario_choice_key" ON "content"."scenario_choice"("step_id", "choice_key");
