/**
 * Seed flashcard styles — 3 free + 3 premium + 1 exclusive.
 * Idempotent: uses upsert on slug.
 *
 * Run: pnpm -F api tsx scripts/seed-flashcard-styles.ts
 */
import { createPrismaClient } from "@nihongo-bjt/database";

const prisma = createPrismaClient();

const styles = [
  // ── Free Styles ──────────────────────────────────────────
  {
    slug: "minimal-ink",
    nameKey: "flashcard_style.minimal_ink",
    descriptionKey: "flashcard_style.minimal_ink_desc",
    tier: "free",
    sortOrder: 1,
    status: "active",
    config: {
      cardBg: "#ffffff",
      textColor: "#1a1a2e",
      fontFamily: "'Noto Sans JP', sans-serif",
      borderRadius: "16px",
      flipAnimation: "rotateY",
      accentColor: "#6366f1",
      shadow: "0 4px 24px rgba(0,0,0,0.08)"
    }
  },
  {
    slug: "warm-paper",
    nameKey: "flashcard_style.warm_paper",
    descriptionKey: "flashcard_style.warm_paper_desc",
    tier: "free",
    sortOrder: 2,
    status: "active",
    config: {
      cardBg: "#faf6f1",
      textColor: "#3d3225",
      fontFamily: "'Noto Serif JP', serif",
      borderRadius: "12px",
      flipAnimation: "rotateY",
      accentColor: "#d97706",
      shadow: "0 2px 16px rgba(139,90,43,0.1)"
    }
  },
  {
    slug: "dark-focus",
    nameKey: "flashcard_style.dark_focus",
    descriptionKey: "flashcard_style.dark_focus_desc",
    tier: "free",
    sortOrder: 3,
    status: "active",
    config: {
      cardBg: "#1e1e2e",
      textColor: "#e4e4ef",
      fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      borderRadius: "20px",
      flipAnimation: "rotateY",
      accentColor: "#8b5cf6",
      shadow: "0 8px 32px rgba(0,0,0,0.4)"
    }
  },
  // ── Premium Styles ───────────────────────────────────────
  {
    slug: "sakura-bloom",
    nameKey: "flashcard_style.sakura_bloom",
    descriptionKey: "flashcard_style.sakura_bloom_desc",
    tier: "premium",
    sortOrder: 10,
    status: "active",
    config: {
      cardBg: "linear-gradient(135deg, #fff5f7 0%, #ffe4ec 100%)",
      textColor: "#4a1942",
      fontFamily: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
      borderRadius: "24px",
      flipAnimation: "rotateX",
      accentColor: "#ec4899",
      backdropBlur: "12px",
      shadow: "0 8px 40px rgba(236,72,153,0.15)"
    }
  },
  {
    slug: "neon-tokyo",
    nameKey: "flashcard_style.neon_tokyo",
    descriptionKey: "flashcard_style.neon_tokyo_desc",
    tier: "premium",
    sortOrder: 11,
    status: "active",
    config: {
      cardBg: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      textColor: "#e0e7ff",
      fontFamily: "'M PLUS 1', 'Inter', sans-serif",
      borderRadius: "8px",
      flipAnimation: "rotateY",
      accentColor: "#06ffa5",
      backdropBlur: "0",
      shadow: "0 0 30px rgba(6,255,165,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
    }
  },
  {
    slug: "ocean-calm",
    nameKey: "flashcard_style.ocean_calm",
    descriptionKey: "flashcard_style.ocean_calm_desc",
    tier: "premium",
    sortOrder: 12,
    status: "active",
    config: {
      cardBg: "linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)",
      textColor: "#004d61",
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      borderRadius: "28px",
      flipAnimation: "rotateX",
      accentColor: "#0891b2",
      backdropBlur: "8px",
      shadow: "0 12px 48px rgba(8,145,178,0.12)"
    }
  },
  // ── Exclusive Style ──────────────────────────────────────
  {
    slug: "gold-calligraphy",
    nameKey: "flashcard_style.gold_calligraphy",
    descriptionKey: "flashcard_style.gold_calligraphy_desc",
    tier: "exclusive",
    sortOrder: 50,
    status: "active",
    config: {
      cardBg: "linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%)",
      textColor: "#f5e6c8",
      fontFamily: "'Shippori Mincho', serif",
      borderRadius: "4px",
      flipAnimation: "rotateY",
      accentColor: "#d4a853",
      shadow: "0 4px 20px rgba(212,168,83,0.2), inset 0 1px 0 rgba(212,168,83,0.1)"
    }
  }
];

async function main() {
  console.log("🎨 Seeding flashcard styles...");

  for (const style of styles) {
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

  console.log(`\n✅ Done — ${styles.length} styles seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
