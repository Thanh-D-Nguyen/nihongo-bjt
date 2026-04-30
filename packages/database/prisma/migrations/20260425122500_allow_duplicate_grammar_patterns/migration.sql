-- Grammar source data can contain the same pattern with different detail rows.
-- Keep pattern indexed for lookup, but do not use it as canonical identity.

DROP INDEX "uq_grammar_point_pattern";
