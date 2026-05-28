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

/** Cache of module_key → UUID, populated on first upsert */
let _moduleIdMap = null;

async function resolveModuleId(client, moduleConfigId) {
  // If it's already a UUID (36 chars with dashes), return as-is
  if (moduleConfigId && moduleConfigId.length === 36 && moduleConfigId.includes("-")) {
    return moduleConfigId;
  }
  // Otherwise resolve module_key string to UUID
  if (!_moduleIdMap) {
    const res = await client.query("SELECT id, module_key FROM daily.daily_radar_module_config");
    _moduleIdMap = {};
    for (const row of res.rows) {
      _moduleIdMap[row.module_key] = row.id;
    }
  }
  return _moduleIdMap[moduleConfigId] || null;
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

  // Resolve module_key string to actual UUID
  const resolvedModuleId = await resolveModuleId(client, moduleConfigId);
  if (!resolvedModuleId) {
    throw new Error(`Unknown module: ${moduleConfigId}`);
  }

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
      slug, resolvedModuleId, titleVi, titleJa, descriptionVi,
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

/** Module config IDs — loaded from DB at runtime */
let _modulesCache = null;


// Keep MODULES as module_key strings — resolved to UUIDs at runtime in upsertRadarCard
export let MODULES = {
  workplace_mission: "workplace_mission",
  honne_tatemae: "honne_tatemae",
  japan_today: "japan_today",
  weather_japanese: "weather_japanese",
  life_hack: "life_hack",
  visa_cityhall: "visa_cityhall",
  news_bjt: "news_bjt",
  interview_career: "interview_career",
  market_watch: "market_watch",
  safety_emergency: "safety_emergency",
  loto_ai_lab: "loto_ai_lab",
  health_clinic: "health_clinic",
  transport_commute: "transport_commute",
  family_school: "family_school",
  deals_points: "deals_points",
};
