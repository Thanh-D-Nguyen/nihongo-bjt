export interface AnalyticsInsightInput {
  bjtAccuracyPct: number;
  reviewCount: number;
  streakDays: number;
}

export function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

export function coachingInsight(input: AnalyticsInsightInput): string {
  if (input.reviewCount === 0) {
    return "Start with a small review set today so the streak has a clear anchor.";
  }
  if (input.bjtAccuracyPct > 0 && input.bjtAccuracyPct < 60) {
    return "Accuracy is still forming; review missed items first, then try a short BJT sprint.";
  }
  if (input.streakDays >= 7) {
    return "Your weekly rhythm is strong; keep the next session short and consistent.";
  }

  return "Progress is moving; one focused review and one practice question is enough today.";
}
