import { BJT_LEVELS } from "../types.js";
import type { ProductionLessonUnit, ValidationIssue } from "../types.js";

export function validateCurriculumCompleteness(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const level of BJT_LEVELS) {
    const levelUnits = units.filter((unit) => unit.levelCode === level);
    if (levelUnits.length === 0) continue;
    const weeks = new Set(levelUnits.map((unit) => unit.weekNumber));
    if (weeks.size !== 12)
      issues.push({
        severity: "error",
        code: "WEEK_COUNT",
        message: `${level} has ${weeks.size}/12 weeks.`,
        level
      });
    for (let week = 1; week <= 12; week += 1) {
      const weekUnits = levelUnits
        .filter((unit) => unit.weekNumber === week)
        .sort((a, b) => a.unitOrder - b.unitOrder);
      const core = weekUnits.filter((unit) => unit.unitType === "lesson");
      const review = weekUnits.filter((unit) => unit.unitType === "review");
      const checkpoint = weekUnits.filter((unit) => unit.unitType === "checkpoint");
      if (core.length !== 5 || review.length !== 1 || checkpoint.length !== 1)
        issues.push({
          severity: "error",
          code: "WEEK_UNIT_MIX",
          message: `${level} week ${week}: expected 5/1/1, got ${core.length}/${review.length}/${checkpoint.length}.`,
          level
        });
      if (weekUnits.some((unit, index) => unit.unitOrder !== index + 1))
        issues.push({
          severity: "error",
          code: "NON_CONTIGUOUS_UNIT_ORDER",
          message: `${level} week ${week} unit order is not continuous.`,
          level
        });
      for (const unit of core)
        if (unit.lessonContent.activities.length < 5)
          issues.push({
            severity: "error",
            code: "CORE_ACTIVITY_COUNT",
            message: `${unit.seedKey} has fewer than five activities.`,
            level,
            seedKey: unit.seedKey
          });
      for (const unit of review)
        if (unit.lessonContent.activities.length < 8)
          issues.push({
            severity: "error",
            code: "REVIEW_ACTIVITY_COUNT",
            message: `${unit.seedKey} has fewer than eight activities.`,
            level,
            seedKey: unit.seedKey
          });
      for (const unit of checkpoint)
        if (unit.lessonContent.activities.length < 10)
          issues.push({
            severity: "error",
            code: "CHECKPOINT_ACTIVITY_COUNT",
            message: `${unit.seedKey} has fewer than ten activities.`,
            level,
            seedKey: unit.seedKey
          });
    }
    const orders = levelUnits
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((unit) => unit.sortOrder);
    if (orders.some((order, index) => order !== index + 1))
      issues.push({
        severity: "error",
        code: "NON_CONTIGUOUS_SORT_ORDER",
        message: `${level} curriculum sort order is not 1..84.`,
        level
      });
  }
  return issues;
}

export function validateTaxonomyCoverage(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const level of BJT_LEVELS) {
    const levelUnits = units.filter((unit) => unit.levelCode === level);
    if (levelUnits.length === 0) continue;
    const activities = levelUnits.flatMap((unit) => unit.lessonContent.activities);
    const questionTypes = new Set(activities.map((activity) => activity.questionType));
    const stimulusTypes = new Set(activities.map((activity) => activity.stimulusType));
    const topics = new Set(levelUnits.flatMap((unit) => unit.businessTopics));
    const skills = new Set(levelUnits.flatMap((unit) => unit.skillTags));
    if (questionTypes.size < 8)
      issues.push({
        severity: "error",
        code: "QUESTION_TYPE_COVERAGE",
        message: `${level} covers only ${questionTypes.size} question types.`,
        level
      });
    if (stimulusTypes.size < 6)
      issues.push({
        severity: "error",
        code: "STIMULUS_COVERAGE",
        message: `${level} covers only ${stimulusTypes.size} stimulus types.`,
        level
      });
    if (topics.size < 12)
      issues.push({
        severity: "error",
        code: "TOPIC_COVERAGE",
        message: `${level} covers only ${topics.size} business topics.`,
        level
      });
    if (skills.size < 12)
      issues.push({
        severity: "error",
        code: "SKILL_COVERAGE",
        message: `${level} covers only ${skills.size} skills.`,
        level
      });
  }
  return issues;
}
