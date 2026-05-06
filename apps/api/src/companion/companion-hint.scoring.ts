import {
  type CompanionActionKind,
  type CompanionHintAction,
  type CompanionReasonCode
} from "@nihongo-bjt/shared";

/** Due count at/above this threshold triggers backlog-style SRS prioritization. */
export const COMPANION_DUE_BACKLOG_THRESHOLD = 15;

/** Multiplicative boost when the SRS queue is critically long. */
const SRS_BACKLOG_GATE = 1.18;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function logPressure(n: number) {
  return Math.log1p(n) / Math.log1p(40);
}

export type CompanionRankerInput = {
  bjtAccuracyPct: number;
  dueCount: number;
  flashcardRemaining: number;
  hoursSinceLastBattle: number | null;
  hoursSinceLastQuiz: number | null;
  hoursSinceLastReview: number | null;
  quizAnswerCount: number;
  reviewCount: number;
  streakDays: number;
  weakSkills: { failureRate: number; skillTag: string }[];
};

type InternalCandidate = {
  action: CompanionActionKind;
  buildReasons: () => Array<{ code: CompanionReasonCode; params: Record<string, string | number | boolean> }>;
  hrefSuffix: string;
  score: number;
};

export function rankCompanionHint(input: CompanionRankerInput): {
  alternatives: CompanionHintAction[];
  primary: CompanionHintAction;
} {
  const canSrs = input.dueCount > 0 && input.flashcardRemaining > 0;
  const quotaBlockedSrs = input.dueCount > 0 && input.flashcardRemaining <= 0;

  const candidates: InternalCandidate[] = [];

  if (canSrs) {
    let s = 0.18;
    s += 0.52 * clamp01(logPressure(input.dueCount));
    if (input.streakDays >= 1) {
      s += 0.12 + 0.06 * clamp01(input.streakDays / 7);
    }
    if (input.hoursSinceLastReview != null && input.hoursSinceLastReview < 2) {
      s *= 0.82;
    }
    if (input.dueCount >= COMPANION_DUE_BACKLOG_THRESHOLD) {
      s *= SRS_BACKLOG_GATE;
    }
    candidates.push({
      action: "srs_review",
      buildReasons: () => {
        if (input.dueCount >= COMPANION_DUE_BACKLOG_THRESHOLD) {
          return [{ code: "SRS_QUEUE_BACKLOG", params: { count: input.dueCount } }];
        }
        if (input.streakDays >= 1) {
          return [{ code: "SRS_MAINTAIN_STREAK", params: { count: input.dueCount, streak: input.streakDays } }];
        }
        return [{ code: "SRS_DUE_PRESSURE", params: { count: input.dueCount } }];
      },
      hrefSuffix: "/flashcards",
      score: s
    });
  }

  const topWeak = input.weakSkills[0];
  let q = 0.14;
  if (topWeak) {
    q += 0.45 * (topWeak.failureRate / 100);
  }
  if (input.weakSkills.length >= 2) {
    q += 0.06;
  }
  if (input.bjtAccuracyPct > 0 && input.bjtAccuracyPct < 62) {
    q += 0.22 * (1 - input.bjtAccuracyPct / 100);
  }
  if (input.hoursSinceLastQuiz != null && input.hoursSinceLastQuiz < 1.5) {
    q *= 0.78;
  }
  if (quotaBlockedSrs) {
    q += 0.38;
  }
  candidates.push({
    action: "bjt_quiz",
    buildReasons: () => {
      if (quotaBlockedSrs) {
        return [{ code: "FLASHCARD_QUOTA_EXHAUSTED_FALLBACK", params: {} }];
      }
      if (topWeak) {
        return [
          {
            code: "QUIZ_WEAK_SKILLS",
            params: { rate: topWeak.failureRate, skill: topWeak.skillTag }
          }
        ];
      }
      return [{ code: "QUIZ_GENERAL", params: {} }];
    },
    hrefSuffix: "/quiz",
    score: q
  });

  let b = 0.1;
  if (input.hoursSinceLastBattle != null) {
    b += 0.12 * clamp01(input.hoursSinceLastBattle / 36);
  } else {
    b += 0.06;
  }
  if (input.hoursSinceLastBattle != null && input.hoursSinceLastBattle < 3) {
    b *= 0.65;
  }
  candidates.push({
    action: "battle_bot",
    buildReasons: () => [{ code: "BATTLE_QUICK_WIN", params: {} }],
    hrefSuffix: "/battle",
    score: b
  });

  let d = 0.08;
  const h = new Date().getUTCHours();
  if (h >= 0 && h < 14) {
    d += 0.05;
  }
  candidates.push({
    action: "daily_hub",
    buildReasons: () => [{ code: "DAILY_HUB", params: {} }],
    hrefSuffix: "/",
    score: d
  });

  let a = 0.07;
  if (input.weakSkills.length >= 2) {
    a += 0.09;
  }
  if (input.reviewCount + input.quizAnswerCount >= 20) {
    a += 0.04;
  }
  candidates.push({
    action: "analytics_reflect",
    buildReasons: () => [{ code: "ANALYTICS_CHECK_IN", params: {} }],
    hrefSuffix: "/analytics",
    score: a
  });

  const sorted = [...candidates].sort((x, y) => y.score - x.score);

  const toAction = (c: InternalCandidate): CompanionHintAction => ({
    action: c.action,
    hrefSuffix: c.hrefSuffix,
    reasons: c.buildReasons(),
    score: Math.round(c.score * 1000) / 1000
  });

  const primary = toAction(sorted[0]!);
  const alternatives = sorted.slice(1, 4).map((c) => toAction(c));

  return { alternatives, primary };
}
