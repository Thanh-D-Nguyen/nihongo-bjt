/**
 * Career RPG Production Seed — Orchestrator
 * Runs all seed files in order and verifies counts.
 *
 * Usage:
 *   node scripts/career-rpg-production/run.mjs
 */
import { createClient } from "./_helpers.mjs";
import { seedRanksAndNpcs } from "./01-ranks-npcs.mjs";
import { seedR1 } from "./02-r1-arcs.mjs";
import { seedR2 } from "./03-r2-arcs.mjs";
import { seedR3 } from "./04-r3-arcs.mjs";
import { seedR4 } from "./05-r4-arcs.mjs";
import { seedR5 } from "./06-r5-arcs.mjs";
import { seedR6 } from "./07-r6-arcs.mjs";
import { seedR7 } from "./08-r7-arcs.mjs";
import { seedR8 } from "./09-r8-arcs.mjs";

const EXPECTED_COUNTS = {
  ranks: 8,
  npcs: 12,
  arcs: 22,
  chapters: 88
};

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Career RPG — Production Seed                   ║");
  console.log("║  R1→R8 | 22 arcs | 88 chapters | 12 NPCs       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const client = await createClient();
  const t0 = Date.now();

  try {
    await client.query("DELETE FROM career.mission_arc WHERE slug = 'arc.onboarding'");

    console.log("── Phase 1: Ranks & NPCs ──────────────────────────");
    await seedRanksAndNpcs(client);

    console.log("\n── Phase 2: Arcs & Chapters ───────────────────────");
    await seedR1(client);
    await seedR2(client);
    await seedR3(client);
    await seedR4(client);
    await seedR5(client);
    await seedR6(client);
    await seedR7(client);
    await seedR8(client);

    console.log("\n── Verification ───────────────────────────────────");
    const ranksResult = await client.query("SELECT COUNT(*) as n FROM career.career_rank");
    const npcsResult = await client.query("SELECT COUNT(*) as n FROM career.story_npc");
    const arcsResult = await client.query("SELECT COUNT(*) as n FROM career.mission_arc");
    const chaptersResult = await client.query("SELECT COUNT(*) as n FROM career.mission_chapter");

    const ranks = parseInt(ranksResult.rows[0].n);
    const npcs = parseInt(npcsResult.rows[0].n);
    const arcs = parseInt(arcsResult.rows[0].n);
    const chapters = parseInt(chaptersResult.rows[0].n);

    console.log(`  Ranks:    ${ranks} (expected: ${EXPECTED_COUNTS.ranks})`);
    console.log(`  NPCs:     ${npcs} (expected: ${EXPECTED_COUNTS.npcs})`);
    console.log(`  Arcs:     ${arcs} (expected: ${EXPECTED_COUNTS.arcs})`);
    console.log(`  Chapters: ${chapters} (expected: ${EXPECTED_COUNTS.chapters})`);

    const ok =
      ranks === EXPECTED_COUNTS.ranks &&
      npcs === EXPECTED_COUNTS.npcs &&
      arcs === EXPECTED_COUNTS.arcs &&
      chapters === EXPECTED_COUNTS.chapters;
    if (!ok) {
      console.warn(
        "\n⚠️  Counts do not match expected production seed totals. Check for stale seed data or missing inserts."
      );
      process.exitCode = 1;
    } else {
      console.log("\n✅ All counts match. Seed complete.");
    }
  } finally {
    await client.end();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n⏱  Done in ${elapsed}s`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
