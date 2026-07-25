import { validateOfficialMockForms } from "./official-mock-data.js";

const report = validateOfficialMockForms();

process.stdout.write(
  [
    `BJT full-mock content validation passed.`,
    `Forms: ${report.mockCount}`,
    `Questions: ${report.totalQuestions}`,
    `Parts: ${JSON.stringify(report.partCounts)}`,
    `Correct answers: ${JSON.stringify(report.correctAnswerCounts)}`,
    `Difficulty: ${JSON.stringify(report.difficultyCounts)}`,
    `Normalized signatures: ${report.normalizedSignatureCount}`,
    `Normalized duplicates: ${report.normalizedDuplicateCount}`,
    `Normalized form signatures: ${JSON.stringify(report.normalizedFormSignatureCounts)}`,
    `Normalized form overlaps: ${JSON.stringify(report.normalizedFormOverlaps)}`
  ].join("\n") + "\n"
);
