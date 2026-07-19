/**
 * Seed flashcard styles — 3 free + 3 premium + 1 exclusive.
 * Idempotent: uses upsert on slug.
 *
 * Run: pnpm exec tsx scripts/seed-flashcard-styles.ts
 */
import "dotenv/config";

import { FLASHCARD_THEME_DEFINITIONS } from "@nihongo-bjt/shared";

import { createPrismaClient } from "../../../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  console.log("🎨 Seeding flashcard styles...");

  for (const style of FLASHCARD_THEME_DEFINITIONS) {
    await prisma.flashcardStyle.upsert({
      where: { slug: style.slug },
      create: {
        slug: style.slug,
        nameKey: style.nameKey,
        descriptionKey: style.descriptionKey,
        config: style.config,
        tier: style.tier,
        sortOrder: style.sortOrder,
        status: style.status
      },
      update: {
        nameKey: style.nameKey,
        descriptionKey: style.descriptionKey,
        config: style.config,
        tier: style.tier,
        sortOrder: style.sortOrder,
        status: style.status
      }
    });
    console.log(`  ✓ ${style.slug} (${style.tier})`);
  }

  console.log(`\n✅ Done — ${FLASHCARD_THEME_DEFINITIONS.length} styles seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
