CREATE UNIQUE INDEX IF NOT EXISTS "uq_ad_impression_decision_event"
ON "monetization"."ad_impression" ("decision_key")
WHERE "decision_key" LIKE 'decision:%';
