import { BJT_LEVELS } from "../types.js";
import type { LevelValidationSummary, ProductionLessonUnit, ValidationReport } from "../types.js";
import { answerCountsFor, validateAnswerDistribution } from "./answer-distribution-validator.js";
import { validateContentQuality } from "./content-quality-validator.js";
import {
  validateCurriculumCompleteness,
  validateTaxonomyCoverage
} from "./curriculum-coverage-validator.js";
import { validateDuplicates } from "./duplicate-validator.js";
import { validateSchema } from "./schema-validator.js";

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function validateBjtLessons(units: ProductionLessonUnit[]): ValidationReport {
  const issues = [
    ...validateSchema(units),
    ...validateCurriculumCompleteness(units),
    ...validateContentQuality(units),
    ...validateAnswerDistribution(units),
    ...validateDuplicates(units),
    ...validateTaxonomyCoverage(units)
  ];
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const levels: Record<string, LevelValidationSummary> = {};
  for (const level of BJT_LEVELS) {
    const levelUnits = units.filter((unit) => unit.levelCode === level);
    if (levelUnits.length === 0) continue;
    const skillCoverage: Record<string, number> = {};
    const topicCoverage: Record<string, number> = {};
    levelUnits
      .flatMap((unit) => unit.skillTags)
      .forEach((skill) => increment(skillCoverage, skill));
    levelUnits
      .flatMap((unit) => unit.businessTopics)
      .forEach((topic) => increment(topicCoverage, topic));
    const exerciseCount = levelUnits.reduce(
      (sum, unit) => sum + unit.lessonContent.activities.length,
      0
    );
    levels[level] = {
      weeks: new Set(levelUnits.map((unit) => unit.weekNumber)).size,
      coreLessons: levelUnits.filter((unit) => unit.unitType === "lesson").length,
      reviews: levelUnits.filter((unit) => unit.unitType === "review").length,
      checkpoints: levelUnits.filter((unit) => unit.unitType === "checkpoint").length,
      totalLearningUnits: levelUnits.length,
      exerciseCount,
      questionCount: exerciseCount,
      ttsActivityCount: levelUnits.reduce(
        (sum, unit) =>
          sum +
          unit.lessonContent.activities.filter(
            (activity) => activity.audioAssetStatus === "tts_ready"
          ).length,
        0
      ),
      answerDistribution: answerCountsFor(levelUnits),
      skillCoverage,
      topicCoverage,
      validation: {
        errors: errors.filter((issue) => issue.level === level).length,
        warnings: warnings.filter((issue) => issue.level === level).length
      }
    };
  }
  return { errors, warnings, levels };
}
