import { ACTIVITY_TYPES, ANSWER_KEYS, BJT_LEVELS, STIMULUS_TYPES, UNIT_TYPES } from "../types.js";
import type { ProductionLessonUnit, ValidationIssue } from "../types.js";

export function validateSchema(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const seedKeys = new Set<string>();
  const slugs = new Set<string>();
  const keys = new Set(units.map((unit) => unit.seedKey));
  for (const unit of units) {
    const context = { level: unit.levelCode, seedKey: unit.seedKey } as const;
    const requiredStrings = [
      unit.id,
      unit.seedKey,
      unit.slug,
      unit.titleJa,
      unit.titleVi,
      unit.descriptionJa,
      unit.descriptionVi,
      unit.contentVersion,
      unit.contentHash
    ];
    if (requiredStrings.some((value) => value.trim().length === 0))
      issues.push({
        severity: "error",
        code: "SCHEMA_REQUIRED_STRING",
        message: "Required string is empty.",
        ...context
      });
    for (const [label, value, set] of [
      ["id", unit.id, ids],
      ["seedKey", unit.seedKey, seedKeys],
      ["slug", unit.slug, slugs]
    ] as const) {
      if (set.has(value))
        issues.push({
          severity: "error",
          code: `DUPLICATE_${label.toUpperCase()}`,
          message: `Duplicate ${label}: ${value}`,
          ...context
        });
      set.add(value);
    }
    if (!BJT_LEVELS.includes(unit.levelCode))
      issues.push({
        severity: "error",
        code: "INVALID_LEVEL",
        message: `Invalid level ${unit.levelCode}`,
        ...context
      });
    if (!UNIT_TYPES.includes(unit.unitType))
      issues.push({
        severity: "error",
        code: "INVALID_UNIT_TYPE",
        message: `Invalid unit type ${unit.unitType}`,
        ...context
      });
    if (unit.weekNumber < 1 || unit.weekNumber > 12)
      issues.push({
        severity: "error",
        code: "INVALID_WEEK",
        message: `Invalid week ${unit.weekNumber}`,
        ...context
      });
    if (unit.unitOrder < 1 || unit.unitOrder > 7)
      issues.push({
        severity: "error",
        code: "INVALID_UNIT_ORDER",
        message: `Invalid unit order ${unit.unitOrder}`,
        ...context
      });
    if (unit.estimatedDurationMin < 15 || unit.estimatedDurationMin > 45)
      issues.push({
        severity: "error",
        code: "INVALID_DURATION",
        message: `Duration ${unit.estimatedDurationMin} is outside 15–45 minutes.`,
        ...context
      });
    for (const prerequisite of unit.prerequisiteKeys)
      if (!keys.has(prerequisite))
        issues.push({
          severity: "error",
          code: "MISSING_PREREQUISITE",
          message: `Missing prerequisite ${prerequisite}`,
          ...context
        });
    if (unit.lessonContent.learningObjectives.length < 2)
      issues.push({
        severity: "error",
        code: "MISSING_OBJECTIVES",
        message: "At least two learning objectives are required.",
        ...context
      });
    if (unit.lessonContent.vocabulary.length < 6)
      issues.push({
        severity: "error",
        code: "VOCABULARY_TOO_SMALL",
        message: "At least six vocabulary items are required.",
        ...context
      });
    if (unit.lessonContent.grammar.length < 2)
      issues.push({
        severity: "error",
        code: "GRAMMAR_TOO_SMALL",
        message: "At least two grammar points are required.",
        ...context
      });
    for (const activity of unit.lessonContent.activities) {
      if (activity.audioAssetStatus === "tts_ready") {
        if (!activity.audioScript || activity.audioProvider !== "browser_tts")
          issues.push({
            severity: "error",
            code: "INVALID_TTS_AUDIO",
            message: `${activity.id} requires a script and browser_tts provenance.`,
            ...context
          });
        if (activity.audioUrl !== null)
          issues.push({
            severity: "error",
            code: "FAKE_TTS_URL",
            message: `${activity.id} browser TTS must not claim a generated audio URL.`,
            ...context
          });
      }
      if (
        activity.audioAssetStatus === "generated" &&
        (!activity.audioUrl?.startsWith("https://") || !activity.audioProvider)
      )
        issues.push({
          severity: "error",
          code: "INVALID_GENERATED_AUDIO",
          message: `${activity.id} generated audio requires an HTTPS URL and provider provenance.`,
          ...context
        });
      if (
        activity.audioAssetStatus === "not_required" &&
        (activity.audioScript !== null || activity.audioUrl !== null)
      )
        issues.push({
          severity: "error",
          code: "UNEXPECTED_AUDIO",
          message: `${activity.id} has audio data although audio is not required.`,
          ...context
        });
      if (!ACTIVITY_TYPES.includes(activity.questionType))
        issues.push({
          severity: "error",
          code: "INVALID_QUESTION_TYPE",
          message: `Invalid question type ${activity.questionType}`,
          ...context
        });
      if (!STIMULUS_TYPES.includes(activity.stimulusType))
        issues.push({
          severity: "error",
          code: "INVALID_STIMULUS_TYPE",
          message: `Invalid stimulus type ${activity.stimulusType}`,
          ...context
        });
      if (!ANSWER_KEYS.includes(activity.answer))
        issues.push({
          severity: "error",
          code: "INVALID_ANSWER",
          message: `Invalid answer ${activity.answer}`,
          ...context
        });
      if (activity.options.length !== 4)
        issues.push({
          severity: "error",
          code: "OPTION_COUNT",
          message: `${activity.id} must have four options.`,
          ...context
        });
      const correct = activity.options.filter((option) => option.isCorrect);
      if (correct.length !== 1 || correct[0]?.key !== activity.answer)
        issues.push({
          severity: "error",
          code: "ANSWER_MISMATCH",
          message: `${activity.id} must have exactly one matching correct answer.`,
          ...context
        });
      if (
        new Set(activity.options.map((option) => option.text.trim())).size !==
        activity.options.length
      )
        issues.push({
          severity: "error",
          code: "DUPLICATE_OPTIONS",
          message: `${activity.id} has duplicate option text.`,
          ...context
        });
    }
  }
  return issues;
}
