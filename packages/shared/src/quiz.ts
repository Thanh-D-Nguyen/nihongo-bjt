export interface QuizScoreInput {
  correctCount: number;
  totalQuestions: number;
}

export interface QuizScoreResult {
  accuracy: number;
  estimatedBjtBand: "J5" | "J4" | "J3" | "J2" | "J1" | "J1+";
  estimatedScore: number;
}

export interface BjtScoredItem {
  answered?: boolean;
  difficulty?: string | null;
  isCorrect: boolean;
  sectionCode?: string | null;
  skillTag?: string | null;
}

export interface BjtPerformanceAggregate {
  accuracy: number;
  answeredCount: number;
  correctCount: number;
  key: string;
  totalQuestions: number;
  weightedAccuracy: number;
}

export interface BjtMockScoreResult extends QuizScoreResult {
  algorithmVersion: "bjt-estimate-v2";
  answeredCount: number;
  sectionPerformance: BjtPerformanceAggregate[];
  skillPerformance: BjtPerformanceAggregate[];
}

export function scoreBjtPractice(input: QuizScoreInput): QuizScoreResult {
  if (input.totalQuestions <= 0) {
    return { accuracy: 0, estimatedBjtBand: "J5", estimatedScore: 0 };
  }

  const accuracy = input.correctCount / input.totalQuestions;
  const estimatedScore = Math.round(accuracy * 800);

  return {
    accuracy,
    estimatedBjtBand: bandForEstimatedScore(estimatedScore),
    estimatedScore
  };
}

/**
 * Produces an estimated BJT score for a mock exam.
 *
 * The official BJT score is statistically equated and cannot be reproduced
 * from raw answers alone. This deterministic proxy avoids presenting raw
 * accuracy as an official score by balancing section performance. Difficulty
 * labels remain diagnostic only until calibrated item parameters exist, so
 * they never change the score. Persisted/API fields remain named `estimated*`.
 */
export function scoreBjtMockExam(input: { items: BjtScoredItem[] }): BjtMockScoreResult {
  if (input.items.length === 0) {
    return {
      accuracy: 0,
      algorithmVersion: "bjt-estimate-v2",
      answeredCount: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0,
      sectionPerformance: [],
      skillPerformance: []
    };
  }

  const sectionPerformance = aggregatePerformance(input.items, (item) =>
    normalizedAggregateKey(item.sectionCode)
  );
  const skillPerformance = aggregatePerformance(input.items, (item) =>
    normalizedAggregateKey(item.skillTag)
  );
  const overall = performanceForItems("overall", input.items);
  const sectionBalancedAccuracy =
    sectionPerformance.reduce((sum, section) => sum + section.weightedAccuracy, 0) /
    sectionPerformance.length;
  const compositeAccuracy =
    sectionPerformance.length > 1
      ? sectionBalancedAccuracy * 0.7 + overall.weightedAccuracy * 0.3
      : overall.weightedAccuracy;
  const estimatedScore = clampScore(Math.round(compositeAccuracy * 800));

  return {
    accuracy: overall.accuracy,
    algorithmVersion: "bjt-estimate-v2",
    answeredCount: overall.answeredCount,
    estimatedBjtBand: bandForEstimatedScore(estimatedScore),
    estimatedScore,
    sectionPerformance,
    skillPerformance
  };
}

function aggregatePerformance(
  items: BjtScoredItem[],
  keyForItem: (item: BjtScoredItem) => string
): BjtPerformanceAggregate[] {
  const grouped = new Map<string, BjtScoredItem[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  return [...grouped.entries()]
    .map(([key, groupedItems]) => performanceForItems(key, groupedItems))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function performanceForItems(key: string, items: BjtScoredItem[]): BjtPerformanceAggregate {
  let answeredCount = 0;
  let correctCount = 0;
  let earnedWeight = 0;
  let availableWeight = 0;

  for (const item of items) {
    const answered = item.answered !== false;
    const correct = answered && item.isCorrect;
    const weight = difficultyWeight(item.difficulty);
    answeredCount += answered ? 1 : 0;
    correctCount += correct ? 1 : 0;
    earnedWeight += correct ? weight : 0;
    availableWeight += weight;
  }

  return {
    accuracy: items.length > 0 ? correctCount / items.length : 0,
    answeredCount,
    correctCount,
    key,
    totalQuestions: items.length,
    weightedAccuracy: availableWeight > 0 ? earnedWeight / availableWeight : 0
  };
}

function difficultyWeight(_difficulty: string | null | undefined): number {
  return 1;
}

function normalizedAggregateKey(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "unclassified";
}

function clampScore(score: number): number {
  return Math.min(800, Math.max(0, score));
}

function bandForEstimatedScore(score: number): QuizScoreResult["estimatedBjtBand"] {
  if (score >= 600) {
    return "J1+";
  }
  if (score >= 530) {
    return "J1";
  }
  if (score >= 420) {
    return "J2";
  }
  if (score >= 320) {
    return "J3";
  }
  if (score >= 200) {
    return "J4";
  }
  return "J5";
}
