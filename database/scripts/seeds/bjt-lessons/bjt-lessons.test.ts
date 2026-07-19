import { describe, expect, it } from "vitest";

import { ALL_BJT_LESSON_UNITS } from "./levels/index.js";
import { seedUnits, selectUnits } from "./seed-service.js";
import type { ExistingLessonRecord, LessonSeedStore, SeedOptions } from "./seed-service.js";
import { BJT_LEVELS } from "./types.js";
import type { ProductionLessonUnit } from "./types.js";
import { validateBjtLessons } from "./validators/index.js";

class FakeLessonSeedStore implements LessonSeedStore {
  readonly lessons = new Map<string, ExistingLessonRecord>();
  readonly learnerProgress = new Map([["learner-1", { completed: 17, lastUnit: "legacy-unit" }]]);
  findCalls = 0;
  writeCalls = 0;

  async findBySlugs(slugs: string[]) {
    this.findCalls += 1;
    return slugs.flatMap((slug) => this.lessons.get(slug) ?? []);
  }

  async writeBatch(units: ProductionLessonUnit[]) {
    this.writeCalls += 1;
    for (const unit of units)
      this.lessons.set(unit.slug, { id: unit.id, slug: unit.slug, contentHash: unit.contentHash });
  }
}

const allOptions: SeedOptions = { dryRun: false };

describe("production BJT lesson curriculum", () => {
  it("contains a complete, validated 12-week curriculum for every canonical level", () => {
    const report = validateBjtLessons(ALL_BJT_LESSON_UNITS);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(ALL_BJT_LESSON_UNITS).toHaveLength(504);
    for (const level of BJT_LEVELS) {
      expect(report.levels[level]).toMatchObject({
        weeks: 12,
        coreLessons: 60,
        reviews: 12,
        checkpoints: 12,
        totalLearningUnits: 84,
        exerciseCount: 516
      });
      expect(report.levels[level]?.answerDistribution).toEqual({
        A: 129,
        B: 129,
        C: 129,
        D: 129
      });
    }
  }, 20_000);

  it("uses stable unique identifiers, slugs, valid prerequisites, explanations, and no placeholders", () => {
    expect(new Set(ALL_BJT_LESSON_UNITS.map((unit) => unit.id)).size).toBe(504);
    expect(new Set(ALL_BJT_LESSON_UNITS.map((unit) => unit.slug)).size).toBe(504);
    const keys = new Set(ALL_BJT_LESSON_UNITS.map((unit) => unit.seedKey));
    for (const unit of ALL_BJT_LESSON_UNITS) {
      expect(unit.lessonContent.learningObjectives.length).toBeGreaterThanOrEqual(2);
      expect(unit.prerequisiteKeys.every((key) => keys.has(key))).toBe(true);
      expect(JSON.stringify(unit).toLowerCase()).not.toMatch(/todo|tbd|placeholder|sample content/);
      for (const activity of unit.lessonContent.activities) {
        expect(activity.explanationVi.length).toBeGreaterThan(90);
        expect(activity.options.filter((option) => option.isCorrect)).toHaveLength(1);
        if (activity.audioAssetStatus === "tts_ready") {
          expect(activity.audioScript).toBeTruthy();
          expect(activity.audioProvider).toBe("browser_tts");
          expect(activity.audioUrl).toBeNull();
          expect(activity.audioVersion).toBe("tts-v1");
        }
      }
    }
    for (const level of BJT_LEVELS)
      expect(
        ALL_BJT_LESSON_UNITS.filter((unit) => unit.levelCode === level)
          .flatMap((unit) => unit.lessonContent.activities)
          .filter((activity) => activity.audioAssetStatus === "tts_ready").length
      ).toBeGreaterThan(0);
  });

  it("filters by level and week without disturbing curriculum order", () => {
    const selected = selectUnits(ALL_BJT_LESSON_UNITS, { dryRun: true, level: "J3", week: 4 });
    expect(selected).toHaveLength(7);
    expect(selected.map((unit) => unit.unitOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(selected.map((unit) => unit.sortOrder)).toEqual([22, 23, 24, 25, 26, 27, 28]);
    expect(selected.map((unit) => unit.unitType)).toEqual([
      "lesson",
      "lesson",
      "lesson",
      "lesson",
      "lesson",
      "review",
      "checkpoint"
    ]);
  });

  it("is idempotent and never creates duplicate rows on rerun", async () => {
    const store = new FakeLessonSeedStore();
    const j5 = selectUnits(ALL_BJT_LESSON_UNITS, { dryRun: false, level: "J5" });
    const first = await seedUnits(store, j5, allOptions);
    const second = await seedUnits(store, j5, allOptions);
    expect(first).toMatchObject({ created: 84, updated: 0, skipped: 0, failed: 0 });
    expect(second).toMatchObject({ created: 0, updated: 0, skipped: 84, failed: 0 });
    expect(store.lessons.size).toBe(84);
  });

  it("performs no database read/write in dry-run mode", async () => {
    const store = new FakeLessonSeedStore();
    const stats = await seedUnits(store, ALL_BJT_LESSON_UNITS, {
      dryRun: true,
      level: "J2",
      week: 8
    });
    expect(stats).toMatchObject({
      selected: 7,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun: true
    });
    expect(store.findCalls).toBe(0);
    expect(store.writeCalls).toBe(0);
  });

  it("preserves learner progress while content is seeded", async () => {
    const store = new FakeLessonSeedStore();
    const before = structuredClone(store.learnerProgress.get("learner-1"));
    await seedUnits(
      store,
      selectUnits(ALL_BJT_LESSON_UNITS, { dryRun: false, level: "J4", week: 2 }),
      allOptions
    );
    expect(store.learnerProgress.get("learner-1")).toEqual(before);
  });
});
