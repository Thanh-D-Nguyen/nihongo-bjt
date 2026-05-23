/**
 * Create recommendation schema and onboarding_preferences table.
 *
 * Run: node database/scripts/create-recommendation-schema.mjs
 * Idempotent — safe to run multiple times.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS recommendation;

      CREATE TABLE IF NOT EXISTS recommendation.onboarding_preferences (
        user_id UUID PRIMARY KEY,
        current_level INTEGER NOT NULL DEFAULT 0,
        goal VARCHAR(50) NOT NULL DEFAULT 'general',
        topics TEXT[] NOT NULL DEFAULT '{}',
        daily_minutes INTEGER NOT NULL DEFAULT 10,
        style VARCHAR(30) NOT NULL DEFAULT 'mixed',
        completed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_onboarding_prefs_completed
        ON recommendation.onboarding_preferences (user_id) WHERE completed = false;
    `);

    console.log("✅ recommendation schema + onboarding_preferences table ready");
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
