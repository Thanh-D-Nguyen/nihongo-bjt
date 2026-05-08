import { z } from "zod";

/** Version bump when weights, gates, or candidate sets change (for analytics + debugging). */
export const COMPANION_HINT_ALGORITHM_VERSION = "2026-02-02a";

export const companionActionKindSchema = z.enum([
  "srs_review",
  "bjt_quiz",
  "battle_bot",
  "daily_hub",
  "analytics_reflect"
]);

export type CompanionActionKind = z.infer<typeof companionActionKindSchema>;

export const companionReasonCodeSchema = z.enum([
  "SRS_DUE_PRESSURE",
  "SRS_MAINTAIN_STREAK",
  "SRS_QUEUE_BACKLOG",
  "QUIZ_WEAK_SKILLS",
  "QUIZ_GENERAL",
  "BATTLE_QUICK_WIN",
  "DAILY_HUB",
  "ANALYTICS_CHECK_IN",
  "FLASHCARD_QUOTA_EXHAUSTED_FALLBACK",
  "FALLBACK_BALANCE"
]);

/* ── Companion event system ── */

export const companionEventKindSchema = z.enum([
  "streak_milestone",
  "review_completed",
  "quiz_completed",
  "battle_won",
  "battle_lost",
  "first_login",
  "comeback",
  "achievement_unlocked",
  "daily_goal_met",
  "level_up",
  "page_visit"
]);

export type CompanionEventKind = z.infer<typeof companionEventKindSchema>;

/* ── Companion message types ── */

export const companionMessageTypeSchema = z.enum([
  "greeting",
  "hint",
  "celebration",
  "tip",
  "nudge",
  "onboarding",
  "reaction",
  "context_aware"
]);

export type CompanionMessageType = z.infer<typeof companionMessageTypeSchema>;

export type CompanionMessageSender = "bot" | "user";

export type CompanionMessage = {
  id: string;
  type: CompanionMessageType;
  sender: CompanionMessageSender;
  textJa: string;
  textVi: string;
  textEn?: string;
  emoji?: string;
  action?: { label: string; href: string };
  timestamp: number;
  seen?: boolean;
};

/* ── Companion tip (mini-lesson) ── */

export type CompanionTip = {
  id: string;
  category: "grammar" | "vocab" | "keigo" | "culture" | "business";
  jlptLevel?: string;
  contentJa: string;
  contentVi: string;
  exampleJa?: string;
  exampleVi?: string;
};

/* ── LLM-ready provider interface ── */

export type CompanionContext = {
  page?: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  isLoggedIn: boolean;
  isFirstVisit: boolean;
  daysSinceLastVisit?: number;
  streakDays?: number;
  dueCount?: number;
  recentEvent?: CompanionEventKind;
  locale: string;
};

export type CompanionReasonCode = z.infer<typeof companionReasonCodeSchema>;

export const companionHintQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  userId: z.uuid().optional()
});

export type CompanionHintQuery = z.infer<typeof companionHintQuerySchema>;

export const companionHintReasonSchema = z.object({
  code: companionReasonCodeSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
});

export const companionHintActionSchema = z.object({
  action: companionActionKindSchema,
  hrefSuffix: z.string().min(1),
  score: z.number(),
  reasons: z.array(companionHintReasonSchema)
});

export type CompanionHintReason = z.infer<typeof companionHintReasonSchema>;

export type CompanionHintAction = z.infer<typeof companionHintActionSchema>;

export const companionHintResponseSchema = z.object({
  algorithmVersion: z.literal(COMPANION_HINT_ALGORITHM_VERSION),
  alternatives: z.array(companionHintActionSchema),
  computedAt: z.string().datetime(),
  primary: companionHintActionSchema,
  /** Non-secret summary for debugging / support (omit from prod UI if desired). */
  context: z
    .object({
      bjtAccuracyPct: z.number(),
      completedBjtSessions: z.number(),
      dueCount: z.number(),
      flashcardRemaining: z.number(),
      quizAnswerCount: z.number(),
      reviewCount: z.number(),
      signalDays: z.number(),
      streakDays: z.number(),
      topWeakSkill: z.string().nullable(),
      weakSkillCount: z.number()
    })
    .optional()
});

export type CompanionHintResponse = z.infer<typeof companionHintResponseSchema>;
