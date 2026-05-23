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

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Career RPG — Production Seed                   ║");
  console.log("║  R1→R8 | 22 arcs | 84 chapters | 12 NPCs       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const client = await createClient();
  const t0 = Date.now();

  try {
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
    const counts = await Promise.all([
      client.query("SELECT COUNT(*) as n FROM career.career_rank"),
      client.query("SELECT COUNT(*) as n FROM career.story_npc"),
      client.query("SELECT COUNT(*) as n FROM career.mission_arc"),
      client.query("SELECT COUNT(*) as n FROM career.mission_chapter"),
    ]);

    const [ranks, npcs, arcs, chapters] = counts.map((r) => parseInt(r.rows[0].n));

    console.log(`  Ranks:    ${ranks} (expected: 8)`);
    console.log(`  NPCs:     ${npcs} (expected: 12)`);
    console.log(`  Arcs:     ${arcs} (expected: 22)`);
    console.log(`  Chapters: ${chapters} (expected: 84)`);

    const ok = ranks >= 8 && npcs >= 12 && arcs >= 22 && chapters >= 84;
    if (!ok) {
      console.warn("\n⚠️  Some counts are below expected. Check for errors above.");
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
