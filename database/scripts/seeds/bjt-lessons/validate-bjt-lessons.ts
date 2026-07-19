import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CONTENT_VERSION } from "./shared/constants.js";
import { ALL_BJT_LESSON_UNITS } from "./levels/index.js";
import { BJT_LEVELS } from "./types.js";
import type { BjtLevel, ProductionLessonUnit, ValidationReport } from "./types.js";
import { validateBjtLessons } from "./validators/index.js";

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function valuesAfter(flag: string): string[] {
  return process.argv.flatMap((value, index) =>
    value === flag && process.argv[index + 1] ? [process.argv[index + 1] as string] : []
  );
}

function operationalArgs(): string[] {
  const metadataFlags = new Set(["--verified-command", "--passed-test", "--failed-test"]);
  const result: string[] = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value && metadataFlags.has(value)) {
      index += 1;
      continue;
    }
    if (value) result.push(value);
  }
  return result;
}

function filteredUnits(): ProductionLessonUnit[] {
  const rawLevel = valueAfter("--level")?.toUpperCase();
  const rawWeek = valueAfter("--week");
  if (rawLevel && !BJT_LEVELS.includes(rawLevel as BjtLevel))
    throw new Error(`Unknown BJT level: ${rawLevel}`);
  const week = rawWeek ? Number.parseInt(rawWeek, 10) : undefined;
  if (week !== undefined && (!Number.isInteger(week) || week < 1 || week > 12))
    throw new Error(`Week must be 1..12: ${rawWeek}`);
  return ALL_BJT_LESSON_UNITS.filter(
    (unit) => (!rawLevel || unit.levelCode === rawLevel) && (!week || unit.weekNumber === week)
  );
}

function totals(report: ValidationReport) {
  return Object.values(report.levels).reduce(
    (sum, level) => ({
      levels: sum.levels + 1,
      weeks: sum.weeks + level.weeks,
      coreLessons: sum.coreLessons + level.coreLessons,
      reviews: sum.reviews + level.reviews,
      checkpoints: sum.checkpoints + level.checkpoints,
      totalLearningUnits: sum.totalLearningUnits + level.totalLearningUnits,
      exerciseCount: sum.exerciseCount + level.exerciseCount,
      questionCount: sum.questionCount + level.questionCount,
      ttsActivityCount: sum.ttsActivityCount + level.ttsActivityCount
    }),
    {
      levels: 0,
      weeks: 0,
      coreLessons: 0,
      reviews: 0,
      checkpoints: 0,
      totalLearningUnits: 0,
      exerciseCount: 0,
      questionCount: 0,
      ttsActivityCount: 0
    }
  );
}

export async function writeGenerationReport(
  report: ValidationReport,
  commandsExecuted: string[],
  tests: { passed: string[]; failed: string[] }
): Promise<void> {
  const artifactPath = resolve("artifacts/bjt-content-generation-report.json");
  await mkdir(resolve("artifacts"), { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        contentVersion: CONTENT_VERSION,
        levels: Object.entries(report.levels).map(([level, summary]) => ({ level, ...summary })),
        totals: totals(report),
        commandsExecuted,
        tests
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function main() {
  const units = filteredUnits();
  const report = validateBjtLessons(units);
  const args = operationalArgs();
  const command = `pnpm validate:bjt-lessons${args.length ? ` ${args.join(" ")}` : ""}`;
  const verifiedCommands = valuesAfter("--verified-command");
  const tests = {
    passed: valuesAfter("--passed-test"),
    failed: valuesAfter("--failed-test")
  };
  if (!process.argv.includes("--no-report"))
    await writeGenerationReport(report, [command, ...verifiedCommands], tests);
  for (const [level, summary] of Object.entries(report.levels)) {
    process.stdout.write(
      `${level}: ${summary.weeks} weeks, ${summary.totalLearningUnits} units, ${summary.exerciseCount} activities, answers ${JSON.stringify(summary.answerDistribution)}\n`
    );
  }
  for (const issue of [...report.errors, ...report.warnings])
    process.stderr.write(
      `${issue.severity.toUpperCase()} ${issue.code}${issue.seedKey ? ` ${issue.seedKey}` : ""}: ${issue.message}\n`
    );
  process.stdout.write(
    `Validation: ${report.errors.length} errors, ${report.warnings.length} warnings.\n`
  );
  if (report.errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
