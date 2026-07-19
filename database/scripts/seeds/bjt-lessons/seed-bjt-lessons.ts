import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient, Prisma } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_BJT_LESSON_UNITS } from "./levels/index.js";
import { CONTENT_VERSION_NUMBER } from "./shared/constants.js";
import { parseSeedOptions, seedUnits } from "./seed-service.js";
import type { ExistingLessonRecord, LessonSeedStore } from "./seed-service.js";
import type { ProductionLessonUnit } from "./types.js";
import { validateBjtLessons } from "./validators/index.js";

class PrismaLessonSeedStore implements LessonSeedStore {
  constructor(private readonly prisma: ReturnType<typeof createPrismaClient>) {}

  findBySlugs(slugs: string[]): Promise<ExistingLessonRecord[]> {
    return this.prisma.bjtLesson.findMany({
      select: { id: true, slug: true, contentHash: true },
      where: { slug: { in: slugs } }
    });
  }

  async writeBatch(
    units: ProductionLessonUnit[],
    existingBySlug: Map<string, ExistingLessonRecord>
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const unit of units) {
        const data = {
          seedKey: unit.seedKey,
          levelCode: unit.levelCode,
          weekNumber: unit.weekNumber,
          unitType: unit.unitType,
          unitOrder: unit.unitOrder,
          sortOrder: unit.sortOrder,
          titleVi: unit.titleVi,
          titleJa: unit.titleJa,
          descriptionVi: unit.descriptionVi,
          descriptionJa: unit.descriptionJa,
          estimatedDurationMin: unit.estimatedDurationMin,
          difficulty: unit.difficulty,
          skillTags: unit.skillTags,
          businessTopics: unit.businessTopics,
          prerequisiteKeys: unit.prerequisiteKeys,
          lessonContent: unit.lessonContent as unknown as Prisma.InputJsonValue,
          contentVersion: unit.contentVersion,
          contentHash: unit.contentHash,
          status: unit.status,
          publishedAt: now
        };
        const lesson = await tx.bjtLesson.upsert({
          where: { slug: unit.slug },
          create: { id: unit.id, slug: unit.slug, ...data },
          update: data
        });
        await tx.contentVersion.upsert({
          where: {
            entityType_entityId_versionNumber: {
              entityType: "bjt_lesson",
              entityId: lesson.id,
              versionNumber: CONTENT_VERSION_NUMBER
            }
          },
          create: {
            entityType: "bjt_lesson",
            entityId: lesson.id,
            versionNumber: CONTENT_VERSION_NUMBER,
            changeSummary: `Production BJT curriculum ${unit.contentVersion}`,
            snapshot: {
              ...data,
              id: lesson.id,
              slug: unit.slug
            } as unknown as Prisma.InputJsonValue,
            status: "published",
            publishedAt: now
          },
          update: {
            changeSummary: `Production BJT curriculum ${unit.contentVersion}`,
            snapshot: {
              ...data,
              id: lesson.id,
              slug: unit.slug
            } as unknown as Prisma.InputJsonValue,
            status: "published",
            publishedAt: now
          }
        });
        existingBySlug.set(unit.slug, {
          id: lesson.id,
          slug: lesson.slug,
          contentHash: unit.contentHash
        });
      }
    });
  }
}

async function main() {
  const options = parseSeedOptions(process.argv.slice(2));
  const validationScope = options.level
    ? ALL_BJT_LESSON_UNITS.filter((unit) => unit.levelCode === options.level)
    : ALL_BJT_LESSON_UNITS;
  const report = validateBjtLessons(validationScope);
  if (report.errors.length > 0)
    throw new Error(
      `Content validation failed with ${report.errors.length} errors; database was not touched.`
    );
  if (options.dryRun) {
    const noWriteStore: LessonSeedStore = {
      findBySlugs: async () => {
        throw new Error("Dry-run must not read the database.");
      },
      writeBatch: async () => {
        throw new Error("Dry-run must not write the database.");
      }
    };
    const stats = await seedUnits(noWriteStore, ALL_BJT_LESSON_UNITS, options);
    process.stdout.write(
      `Dry-run valid: ${stats.selected} units selected; 0 database reads, 0 writes.\n`
    );
    return;
  }

  loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });
  const env = parseServerEnv(process.env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const stats = await seedUnits(new PrismaLessonSeedStore(prisma), ALL_BJT_LESSON_UNITS, options);
    process.stdout.write(
      `BJT lesson seed: selected=${stats.selected} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} failed=${stats.failed}.\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `BJT lesson seed failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
