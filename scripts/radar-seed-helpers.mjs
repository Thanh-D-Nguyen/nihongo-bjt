/**
 * Shared helper for radar seed scripts.
 * Provides DB connection and idempotent upsert for DailyRadarCard.
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

export function createClient() {
  return new pg.Client({ connectionString: DATABASE_URL });
}

/**
 * Upsert a radar card. Uses slug as unique key.
 * If card exists, updates metadata + titles. If not, inserts.
 */
export async function upsertRadarCard(client, card) {
  const {
    slug,
    moduleConfigId,
    titleVi,
    titleJa = null,
    descriptionVi,
    recommendationReasonVi = null,
    category,
    moduleType = "content",
    badgeTextVi = null,
    estimatedMinutes = 3,
    levelLabel = null,
    ctaLabelVi = "Học ngay",
    visualTheme = null,
    priority = 100,
    metadata = {},
  } = card;

  const result = await client.query(
    `INSERT INTO daily.daily_radar_card (
       slug, module_config_id, title_vi, title_ja, description_vi,
       recommendation_reason_vi, category, module_type, badge_text_vi,
       estimated_minutes, level_label, cta_label_vi, visual_theme,
       priority, status, metadata, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'published',$15::jsonb, NOW(), NOW())
     ON CONFLICT (slug) DO UPDATE SET
       metadata = $15::jsonb,
       title_vi = $3,
       title_ja = $4,
       description_vi = $5,
       recommendation_reason_vi = $6,
       estimated_minutes = $10,
       level_label = $11,
       visual_theme = $13,
       priority = $14,
       updated_at = NOW()
     RETURNING id, slug`,
    [
      slug, moduleConfigId, titleVi, titleJa, descriptionVi,
      recommendationReasonVi, category, moduleType, badgeTextVi,
      estimatedMinutes, levelLabel, ctaLabelVi, visualTheme,
      priority, JSON.stringify(metadata),
    ]
  );

  return result.rows[0];
}

/**
 * Run a batch of card upserts with progress reporting.
 */
export async function runBatch(client, cards, batchName) {
  let success = 0;
  let failed = 0;

  for (const card of cards) {
    try {
      await upsertRadarCard(client, card);
      success++;
    } catch (err) {
      console.error(`  ❌ Failed: ${card.slug} — ${err.message}`);
      failed++;
    }
  }

  console.log(`  ${batchName}: ${success} ✅ | ${failed} ❌`);
  return { success, failed };
}

/** Module config IDs */
export const MODULES = {
  workplace_mission: "be4e6c48-6c17-429c-9411-3fc2fbd0eac8",
  honne_tatemae: "fc6ab201-f868-429d-a2c0-215f84022b6d",
  japan_today: "4b52834c-e915-4537-8aa8-a34fc9ae5d53",
  weather_japanese: "8ed6dd36-40b9-448e-b8c7-6312de60e9f7",
  life_hack: "eba91372-51df-4c01-bcb9-25d90456a558",
  visa_cityhall: "95eeb6f1-a153-45dc-a1fd-f2ccdfeca20c",
  news_bjt: "97a249b1-eabd-4665-92d2-d300551a2d96",
  interview_career: "bd7e0f44-d711-4c6f-8f76-4897d17173f0",
  market_watch: "d6751fb3-abc2-4af3-af7b-9a00660b4390",
  safety_emergency: "fed6e448-8595-40ee-84b8-093f9ebd8ca2",
  loto_ai_lab: "947dd573-a039-4f74-bc7f-a546d36a847f",
  health_clinic: "54825065-34f1-4998-95a3-e3efefd94805",
  transport_commute: "1c5461bd-4198-482d-b2fd-c44626ee02bf",
  family_school: "54aa10b7-abe5-444e-8016-eec913a720b3",
  deals_points: "ff1ee60e-f8b1-420c-9383-bb3b7629bc08",
};
