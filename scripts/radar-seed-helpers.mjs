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
  workplace_mission: "b24a6dc1-fdc2-4a9f-a7ed-8c3068fc53d9",
  honne_tatemae: "685d968f-a567-4c9e-8b12-45881b20ea3c",
  japan_today: "219fc125-4cf2-443b-9672-7746d0edcf87",
  weather_japanese: "8cbdda7c-b303-4f49-992d-8cc734c6032b",
  life_hack: "36f44003-430e-4bf2-adb6-fac41cd80235",
  visa_cityhall: "546c4198-2d32-4cdb-977a-2b139381d1fd",
  news_bjt: "74a9cab1-f08b-4c5f-8f54-ce48f306e5e7",
  interview_career: "431cf27b-3f93-457a-a2fd-4bf251083a2a",
  market_watch: "22150723-16b9-4b7e-bafa-dfd60a85cf64",
  safety_emergency: "f2e1b4f4-7b13-45d5-bddf-01d072d1f650",
  loto_ai_lab: "42391596-e350-4ce0-9789-18083754f52f",
  health_clinic: "766aaf06-b838-4996-abfb-6706f93576d3",
  transport_commute: "50e2fa7b-e338-4635-87f2-c13418d8bd09",
  family_school: "fc8c4ed7-7d57-4475-84af-3e49fadc8873",
  deals_points: "fce74dc4-5c9c-4c80-b572-0389ed6dbfbc",
};
