import { ANSWER_KEYS, BJT_LEVELS } from "../types.js";
import type { AnswerKey, ProductionLessonUnit, ValidationIssue } from "../types.js";

export function answerCountsFor(units: ProductionLessonUnit[]): Record<AnswerKey, number> {
  const result: Record<AnswerKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const activity of units.flatMap((unit) => unit.lessonContent.activities))
    result[activity.answer] += 1;
  return result;
}

export function validateAnswerDistribution(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const level of BJT_LEVELS) {
    const levelUnits = units.filter((unit) => unit.levelCode === level);
    if (levelUnits.length === 0) continue;
    const ordered = levelUnits
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((unit) => unit.lessonContent.activities);
    const counts = answerCountsFor(levelUnits);
    for (const key of ANSWER_KEYS) {
      const ratio = counts[key] / ordered.length;
      if (ratio < 0.2 || ratio > 0.3)
        issues.push({
          severity: "error",
          code: "ANSWER_DISTRIBUTION",
          message: `${level} ${key} is ${(ratio * 100).toFixed(1)}%, outside 20–30%.`,
          level
        });
    }
    let run = 1;
    for (let index = 1; index < ordered.length; index += 1) {
      run = ordered[index]?.answer === ordered[index - 1]?.answer ? run + 1 : 1;
      if (run > 4)
        issues.push({
          severity: "error",
          code: "ANSWER_RUN",
          message: `${level} has an answer run longer than four at activity ${index + 1}.`,
          level
        });
    }
    for (let week = 1; week <= 12; week += 1) {
      const weekCounts = answerCountsFor(levelUnits.filter((unit) => unit.weekNumber === week));
      const total = Object.values(weekCounts).reduce((sum, value) => sum + value, 0);
      for (const key of ANSWER_KEYS) {
        const ratio = weekCounts[key] / total;
        if (ratio < 0.18 || ratio > 0.32)
          issues.push({
            severity: "warning",
            code: "WEEK_ANSWER_DISTRIBUTION",
            message: `${level} week ${week} ${key} is ${(ratio * 100).toFixed(1)}%.`,
            level
          });
      }
    }
  }
  return issues;
}
