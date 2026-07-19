import { SEED_BATCH_SIZE } from "./shared/constants.js";
import { BJT_LEVELS } from "./types.js";
import type { BjtLevel, ProductionLessonUnit } from "./types.js";

export interface SeedOptions {
  dryRun: boolean;
  level?: BjtLevel;
  week?: number;
  batchSize?: number;
}

export interface SeedStats {
  selected: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
}

export interface ExistingLessonRecord {
  id: string;
  slug: string;
  contentHash: string | null;
}

export interface LessonSeedStore {
  findBySlugs(slugs: string[]): Promise<ExistingLessonRecord[]>;
  writeBatch(
    units: ProductionLessonUnit[],
    existingBySlug: Map<string, ExistingLessonRecord>
  ): Promise<void>;
}

export function parseSeedOptions(argv: string[]): SeedOptions {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const rawLevel = valueAfter("--level")?.toUpperCase();
  if (rawLevel && !BJT_LEVELS.includes(rawLevel as BjtLevel))
    throw new Error(`Unknown BJT level: ${rawLevel}`);
  const rawWeek = valueAfter("--week");
  const week = rawWeek === undefined ? undefined : Number.parseInt(rawWeek, 10);
  if (week !== undefined && (!Number.isInteger(week) || week < 1 || week > 12))
    throw new Error(`Week must be 1..12: ${rawWeek}`);
  return { dryRun: argv.includes("--dry-run"), level: rawLevel as BjtLevel | undefined, week };
}

export function selectUnits(
  units: ProductionLessonUnit[],
  options: SeedOptions
): ProductionLessonUnit[] {
  return units.filter(
    (unit) =>
      (!options.level || unit.levelCode === options.level) &&
      (!options.week || unit.weekNumber === options.week)
  );
}

export async function seedUnits(
  store: LessonSeedStore,
  units: ProductionLessonUnit[],
  options: SeedOptions
): Promise<SeedStats> {
  const selected = selectUnits(units, options);
  const stats: SeedStats = {
    selected: selected.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    dryRun: options.dryRun
  };
  if (options.dryRun) return stats;

  const existingRows = await store.findBySlugs(selected.map((unit) => unit.slug));
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
  const changed = selected.filter((unit) => {
    const existing = existingBySlug.get(unit.slug);
    if (existing?.contentHash === unit.contentHash) {
      stats.skipped += 1;
      return false;
    }
    if (existing) stats.updated += 1;
    else stats.created += 1;
    return true;
  });

  const batchSize = options.batchSize ?? SEED_BATCH_SIZE;
  for (let offset = 0; offset < changed.length; offset += batchSize) {
    const batch = changed.slice(offset, offset + batchSize);
    try {
      await store.writeBatch(batch, existingBySlug);
    } catch (error) {
      stats.failed += batch.length;
      throw error;
    }
  }
  return stats;
}
