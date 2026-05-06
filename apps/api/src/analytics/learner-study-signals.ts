import { type PrismaClient } from "@nihongo-bjt/database";
import { percentage } from "@nihongo-bjt/shared";

export type LearnerDailyActivityPoint = {
  date: string;
  quizAnswers: number;
  quizSessionsCompleted: number;
  reviews: number;
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive UTC calendar days from start through end (by date component). */
export function utcDayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

export async function loadLearnerDailyActivity(
  prisma: PrismaClient,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<LearnerDailyActivityPoint[]> {
  const dayKeys = utcDayKeysBetween(rangeStart, rangeEnd);
  const counts = new Map<string, { reviews: number; quizAnswers: number; quizSessionsCompleted: number }>();
  for (const k of dayKeys) {
    counts.set(k, { reviews: 0, quizAnswers: 0, quizSessionsCompleted: 0 });
  }

  const [reviewRows, answerRows, completedSessions] = await Promise.all([
    prisma.reviewEvent.findMany({
      select: { reviewedAt: true },
      where: { reviewedAt: { gte: rangeStart, lt: rangeEnd }, userId }
    }),
    prisma.quizAnswer.findMany({
      select: { answeredAt: true },
      where: { answeredAt: { gte: rangeStart, lt: rangeEnd }, session: { userId } }
    }),
    prisma.quizSession.findMany({
      select: { completedAt: true },
      where: {
        completedAt: { gte: rangeStart, lt: rangeEnd },
        status: "completed",
        userId
      }
    })
  ]);

  for (const r of reviewRows) {
    const k = utcDayKey(r.reviewedAt);
    const row = counts.get(k);
    if (row) {
      row.reviews += 1;
    }
  }
  for (const a of answerRows) {
    const k = utcDayKey(a.answeredAt);
    const row = counts.get(k);
    if (row) {
      row.quizAnswers += 1;
    }
  }
  for (const s of completedSessions) {
    if (!s.completedAt) {
      continue;
    }
    const k = utcDayKey(s.completedAt);
    const row = counts.get(k);
    if (row) {
      row.quizSessionsCompleted += 1;
    }
  }

  return dayKeys.map((date) => {
    const c = counts.get(date)!;
    return {
      date,
      quizAnswers: c.quizAnswers,
      quizSessionsCompleted: c.quizSessionsCompleted,
      reviews: c.reviews
    };
  });
}

export async function countLearnerDueFlashcards(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  return prisma.userFlashcard.count({
    where: {
      dueAt: { lte: new Date() },
      state: { in: ["new", "learning", "review", "lapsed"] },
      userId
    }
  });
}

export type LearnerStudySignals = {
  bjtAccuracyPct: number;
  bjtSessions: number;
  completedBjtSessions: number;
  correctQuizAnswers: number;
  quizAnswerCount: number;
  range: { days: number; end: Date; start: Date };
  reviewCount: number;
  streakDays: number;
  weakSkills: Array<{
    attempts: number;
    failureRate: number;
    incorrect: number;
    skillTag: string;
  }>;
};

export function streakDaysFromReviewDates(dates: Date[]): number {
  const dayKeys = new Set(dates.map((date) => date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function weakSkillsFromQuizAnswers(
  answers: Array<{ isCorrect: boolean; question: { skillTag: string } }>
) {
  const bySkill = new Map<string, { attempts: number; incorrect: number }>();
  for (const answer of answers) {
    const tag = answer.question.skillTag;
    const current = bySkill.get(tag) ?? { attempts: 0, incorrect: 0 };
    current.attempts += 1;
    if (!answer.isCorrect) {
      current.incorrect += 1;
    }
    bySkill.set(tag, current);
  }

  return Array.from(bySkill.entries())
    .map(([skillTag, stats]) => ({
      attempts: stats.attempts,
      failureRate: percentage(stats.incorrect, stats.attempts),
      incorrect: stats.incorrect,
      skillTag
    }))
    .filter((skill) => skill.attempts >= 3 && skill.failureRate >= 60)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 6);
}

/** Shared learner activity window for analytics + companion (single definition of streak / weak skills). */
export async function loadLearnerStudySignals(
  prisma: PrismaClient,
  userId: string,
  days: number
): Promise<LearnerStudySignals> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - days);

  const [reviews, answers, sessions, answersBySkill] = await Promise.all([
    prisma.reviewEvent.findMany({
      select: { rating: true, reviewedAt: true },
      where: { reviewedAt: { gte: start, lt: end }, userId }
    }),
    prisma.quizAnswer.findMany({
      select: { answeredAt: true, isCorrect: true },
      where: { answeredAt: { gte: start, lt: end }, session: { userId } }
    }),
    prisma.quizSession.findMany({
      select: { completedAt: true, estimatedBjtBand: true, estimatedScore: true, status: true },
      where: { startedAt: { gte: start, lt: end }, userId }
    }),
    prisma.quizAnswer.findMany({
      select: {
        isCorrect: true,
        question: { select: { skillTag: true } }
      },
      where: { answeredAt: { gte: start, lt: end }, session: { userId } }
    })
  ]);

  const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
  const streakDays = streakDaysFromReviewDates(reviews.map((review) => review.reviewedAt));
  const bjtAccuracyPct = percentage(correctAnswers, answers.length);
  const weakSkills = weakSkillsFromQuizAnswers(answersBySkill);

  return {
    bjtAccuracyPct,
    bjtSessions: sessions.length,
    completedBjtSessions: sessions.filter((session) => session.status === "completed").length,
    correctQuizAnswers: correctAnswers,
    quizAnswerCount: answers.length,
    range: { days, end, start },
    reviewCount: reviews.length,
    streakDays,
    weakSkills
  };
}
