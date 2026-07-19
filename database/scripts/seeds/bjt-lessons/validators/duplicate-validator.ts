import type { ProductionLessonUnit, ValidationIssue } from "../types.js";

export function normalizeContent(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(value: string, size = 3): Set<string> {
  const normalized = normalizeContent(value).replace(/\s/g, "");
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1)
    result.add(normalized.slice(index, index + size));
  return result;
}

export function jaccardSimilarity(left: string, right: string): number {
  return jaccardSets(ngrams(left), ngrams(right));
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function validateDuplicates(units: ProductionLessonUnit[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const records: Array<{
    kind: string;
    value: string;
    level: ProductionLessonUnit["levelCode"];
    seedKey: string;
  }> = [];
  for (const unit of units) {
    records.push({
      kind: "title",
      value: `${unit.titleJa} ${unit.titleVi}`,
      level: unit.levelCode,
      seedKey: unit.seedKey
    });
    for (const activity of unit.lessonContent.activities)
      records.push({
        kind: "question",
        value: `${activity.scenarioJa} ${activity.prompt} ${activity.options.map((option) => option.text).join(" ")}`,
        level: unit.levelCode,
        seedKey: unit.seedKey
      });
  }
  const exact = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const key = `${record.kind}:${normalizeContent(record.value)}`;
    const previous = exact.get(key);
    if (previous)
      issues.push({
        severity: "error",
        code: "EXACT_DUPLICATE",
        message: `${record.kind} duplicates ${previous.seedKey}.`,
        level: record.level,
        seedKey: record.seedKey
      });
    else exact.set(key, record);
  }
  const questions = records
    .filter((record) => record.kind === "question")
    .map((record) => ({ ...record, gramSet: ngrams(record.value) }));
  const weekOf = (seedKey: string) => seedKey.match(/:w(\d{2}):/)?.[1] ?? "";
  for (let left = 0; left < questions.length; left += 1) {
    const a = questions[left];
    if (!a) continue;
    for (let right = left + 1; right < questions.length; right += 1) {
      const b = questions[right];
      if (
        !b ||
        a.level !== b.level ||
        a.seedKey === b.seedKey ||
        weekOf(a.seedKey) === weekOf(b.seedKey)
      )
        continue;
      // Computing n-grams once keeps the deterministic pairwise audit fast enough
      // to run in every seed dry-run and CI validation.
      const similarity = jaccardSets(a.gramSet, b.gramSet);
      if (similarity >= 0.97)
        issues.push({
          severity: "warning",
          code: "NEAR_DUPLICATE",
          message: `Question similarity ${(similarity * 100).toFixed(1)}% with ${a.seedKey}.`,
          level: b.level,
          seedKey: b.seedKey
        });
    }
  }
  return issues;
}
