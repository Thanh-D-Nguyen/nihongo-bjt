import type { ProductionLessonUnit, ValidationIssue } from "../types.js";

const FORBIDDEN = [/\bTODO\b/i, /\bTBD\b/i, /placeholder/i, /sample content/i, /bài học số\s*\d+/i];
const VIETNAMESE_DIACRITICS =
  /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹĂÂĐÊÔƠƯÀÁẠẢÃẰẮẶẲẴẦẤẬẨẪÈÉẸẺẼỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕỒỐỘỔỖỜỚỢỞỠÙÚỤỦŨỪỨỰỬỮỲÝỴỶỸ]/u;

function visitStrings(
  value: unknown,
  path: string,
  visit: (text: string, path: string) => void
): void {
  if (typeof value === "string") return visit(value, path);
  if (Array.isArray(value))
    return void value.forEach((item, index) => visitStrings(item, `${path}[${index}]`, visit));
  if (value && typeof value === "object")
    Object.entries(value).forEach(([key, item]) => visitStrings(item, `${path}.${key}`, visit));
}

export function validateContentQuality(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const unit of units) {
    const context = { level: unit.levelCode, seedKey: unit.seedKey } as const;
    visitStrings(unit, "unit", (text, path) => {
      if (text.trim().length === 0)
        issues.push({
          severity: "error",
          code: "EMPTY_STRING",
          message: `${path} is empty.`,
          ...context
        });
      if (FORBIDDEN.some((pattern) => pattern.test(text)))
        issues.push({
          severity: "error",
          code: "PLACEHOLDER_CONTENT",
          message: `${path} contains forbidden placeholder text.`,
          ...context
        });
    });
    const scenario = unit.lessonContent.workplaceScenario;
    if (
      scenario.contextJa.length < 30 ||
      scenario.contextVi.length < 40 ||
      scenario.problemVi.length < 20 ||
      scenario.desiredOutcomeVi.length < 20
    )
      issues.push({
        severity: "error",
        code: "THIN_SCENARIO",
        message: "Workplace scenario lacks role, problem, or intended outcome context.",
        ...context
      });
    for (const activity of unit.lessonContent.activities) {
      const japaneseFields = [
        unit.titleJa,
        unit.descriptionJa,
        activity.scenarioJa,
        activity.stimulusText,
        activity.prompt,
        activity.explanationJa
      ];
      if (japaneseFields.some((text) => VIETNAMESE_DIACRITICS.test(text)))
        issues.push({
          severity: "error",
          code: "MIXED_LANGUAGE_JAPANESE_FIELD",
          message: `${activity.id} contains Vietnamese text in a Japanese field.`,
          ...context
        });
      if (activity.explanationVi.length < 90 || activity.explanationJa.length < 35)
        issues.push({
          severity: "error",
          code: "THIN_EXPLANATION",
          message: `${activity.id} explanation is too short.`,
          ...context
        });
      if (activity.options.some((option) => option.rationaleVi.length < 35))
        issues.push({
          severity: "error",
          code: "THIN_DISTRACTOR_RATIONALE",
          message: `${activity.id} has a weak option rationale.`,
          ...context
        });
    }
  }
  return issues;
}
