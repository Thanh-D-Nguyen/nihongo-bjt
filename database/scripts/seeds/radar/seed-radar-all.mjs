/**
 * Master Radar Seed Runner — Executes all seed scripts in order
 * Run: node scripts/seed-radar-all.mjs
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const scripts = [
  // === Phase 1: Core categories ===
  "seed-radar-workplace.mjs",
  "seed-radar-daily-life.mjs",
  "seed-radar-safety.mjs",
  "seed-radar-procedures.mjs",
  "seed-radar-news-bjt.mjs",
  "seed-radar-money.mjs",
  "seed-radar-health-transport-family.mjs",
  "seed-radar-entertainment-culture.mjs",
  "seed-radar-advanced-work.mjs",
  // === Phase 2: Expansions ===
  "seed-radar-daily-life-2.mjs",
  "seed-radar-safety-2.mjs",
  "seed-radar-procedures-2.mjs",
  "seed-radar-news-bjt-2.mjs",
  "seed-radar-money-2.mjs",
  "seed-radar-family-2.mjs",
  "seed-radar-entertainment-2.mjs",
  "seed-radar-work-advanced-2.mjs",
  // === Phase 3: Further expansions ===
  "seed-radar-life-3.mjs",
  "seed-radar-safety-health-3.mjs",
  "seed-radar-procedures-3.mjs",
  "seed-radar-news-3.mjs",
  "seed-radar-money-3.mjs",
  "seed-radar-family-3.mjs",
  "seed-radar-entertainment-3.mjs",
  "seed-radar-last-3.mjs",
  // === Phase 4: 200 milestone ===
  "seed-radar-final-200.mjs",
  "seed-radar-200-final.mjs",
  // === Phase 5: 200→300 push ===
  "seed-radar-work-3.mjs",
  "seed-radar-procedures-4.mjs",
  "seed-radar-safety-4.mjs",
  "seed-radar-news-4.mjs",
  "seed-radar-life-4.mjs",
  "seed-radar-mixed-5a.mjs",
  "seed-radar-mixed-5b.mjs",
  "seed-radar-final-300.mjs",
  "seed-radar-extra-2.mjs",
];

console.log("═══════════════════════════════════════");
console.log("  NihonGo BJT — Radar Seed Runner");
console.log("═══════════════════════════════════════\n");

let success = 0;
let failed = 0;

for (const script of scripts) {
  const path = join(__dirname, script);
  console.log(`▶ Running ${script}...`);
  try {
    execSync(`node "${path}"`, { stdio: "inherit" });
    success++;
    console.log("");
  } catch (err) {
    console.error(`✗ FAILED: ${script}\n  ${err.message}\n`);
    failed++;
  }
}

console.log("═══════════════════════════════════════");
console.log(`  Results: ${success} passed, ${failed} failed`);
console.log("═══════════════════════════════════════");

if (failed > 0) process.exit(1);
