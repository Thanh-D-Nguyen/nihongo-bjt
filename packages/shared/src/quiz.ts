export interface QuizScoreInput {
  correctCount: number;
  totalQuestions: number;
}

export interface QuizScoreResult {
  accuracy: number;
  estimatedBjtBand: "J5" | "J4" | "J3" | "J2" | "J1";
  estimatedScore: number;
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

function bandForEstimatedScore(score: number): QuizScoreResult["estimatedBjtBand"] {
  if (score >= 600) {
    return "J1";
  }
  if (score >= 470) {
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
