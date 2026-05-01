import { z } from "zod";

import { srsRatingSchema } from "./srs.js";

export {
  coachingInsight,
  percentage,
  toUtcDateKey,
  type AnalyticsInsightInput
} from "./analytics.js";
export {
  greetingForHour,
  todayDateKey,
  type DailyGreeting,
  type DailyWidgetKind
} from "./daily.js";
export * from "./learning-admin.js";
export {
  BATTLE_BOT_PROFILES,
  DEFAULT_BATTLE_BOT_KEY,
  decideBotOption,
  getBattleBotProfile,
  hashSeedToUint32,
  randomBetween,
  shuffleDeterministic,
  type BattleBotProfile
} from "./battle.js";
export { scoreBjtPractice, type QuizScoreInput, type QuizScoreResult } from "./quiz.js";
export {
  COMEBACK_MODE_INTERVAL_MULTIPLIER,
  LEECH_THRESHOLD_LAPSES,
  scheduleSrsReview,
  srsRatingSchema,
  type SrsRating,
  type SrsState
} from "./srs.js";
export {
  allCanonicalAdminPermissions,
  CANONICAL_ADMIN_ROLE_PERMISSIONS,
  CANONICAL_ADMIN_ROLES,
  type CanonicalAdminRole
} from "./admin-rbac.js";

export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  version: z.string(),
  checkedAt: z.string().datetime(),
  checks: z
    .record(
      z.string(),
      z.object({
        status: z.enum(["ok", "degraded"]),
        message: z.string().optional()
      })
    )
    .optional()
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const appSurfaceSchema = z.enum(["learner", "admin", "api"]);
export type AppSurface = z.infer<typeof appSurfaceSchema>;

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
}

export const contentKindSchema = z.enum(["lexeme", "kanji", "grammar", "example"]);
export type ContentKind = z.infer<typeof contentKindSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().min(1).max(120).optional()
});

export const searchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  q: z.string().trim().min(1).max(120)
});

export const contentSummarySchema = z.object({
  examples: z.number().int().nonnegative(),
  grammarPoints: z.number().int().nonnegative(),
  kanji: z.number().int().nonnegative(),
  lexemes: z.number().int().nonnegative()
});

export type ContentSummary = z.infer<typeof contentSummarySchema>;

export const searchResultSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  kind: contentKindSchema,
  reading: z.string().nullable(),
  title: z.string()
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const userScopedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  userId: z.uuid()
});

export const comebackSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(14),
  userId: z.uuid()
});

export const authProfileUpdateSchema = z.object({
  avatarAssetId: z.uuid().nullable().optional(),
  dailyGoalCards: z.number().int().min(1).max(500).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  explanationLocale: z.enum(["vi", "ja", "en"]).optional(),
  learningPersonality: z.string().trim().min(1).max(64).nullable().optional(),
  privacyLevel: z.enum(["standard", "private"]).optional(),
  sharePostcardOptIn: z.boolean().optional(),
  targetBjtBand: z.enum(["J5", "J4", "J3", "J2", "J1", "J1+"]).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  uiLocale: z.enum(["vi", "ja", "en"]).optional()
});

export type AuthProfileUpdateInput = z.infer<typeof authProfileUpdateSchema>;

export const bookmarkTargetTypeSchema = z.enum(["word", "lexeme", "kanji", "grammar"]);
export type BookmarkTargetType = z.infer<typeof bookmarkTargetTypeSchema>;

export const bookmarkParamsSchema = z.object({
  id: z.uuid(),
  type: bookmarkTargetTypeSchema
});

export const createDeckSchema = z.object({
  descriptionJa: z.string().trim().max(500).optional(),
  descriptionVi: z.string().trim().max(500).optional(),
  titleJa: z.string().trim().min(1).max(120).optional(),
  titleVi: z.string().trim().min(1).max(120),
  userId: z.uuid()
});

export const createCardFromContentSchema = z.object({
  backText: z.string().trim().min(1).max(1000),
  deckId: z.uuid(),
  frontText: z.string().trim().min(1).max(500),
  reading: z.string().trim().max(300).optional(),
  sourceId: z.uuid(),
  sourceType: contentKindSchema.exclude(["example"]),
  userId: z.uuid()
});

export const submitReviewSchema = z.object({
  elapsedMs: z.number().int().min(0).max(3_600_000).optional(),
  rating: srsRatingSchema,
  reviewedAt: z.string().datetime().optional(),
  userId: z.uuid()
});

export const startQuizSchema = z.object({
  testId: z.uuid(),
  userId: z.uuid()
});

export const submitQuizAnswerSchema = z.object({
  optionKey: z.string().trim().min(1).max(8),
  questionId: z.uuid(),
  userId: z.uuid()
});

export const adminContentKindSchema = z.enum(["lexeme", "kanji", "grammar", "example"]);

const emptyQueryToUndef = (v: unknown) =>
  v === null || v === "" || (typeof v === "string" && v.trim() === "") ? undefined : v;

const optionalQueryInt = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().int().min(min).max(max).optional());

const adminContentFilterFields = {
  category: z.preprocess(emptyQueryToUndef, z.string().trim().min(1).max(120).optional()),
  /** Grammar only: lọc cả nhóm (OR theo taxonomy), ưu tiên thấp hơn `category` khi cả hai có */
  categoryGroup: z.preprocess(emptyQueryToUndef, z.string().trim().min(1).max(64).optional()),
  jlptLevel: z.preprocess(emptyQueryToUndef, z.string().trim().min(1).max(20).optional()),
  level: optionalQueryInt(0, 20),
  q: z.string().trim().min(1).max(120).optional(),
  reading: z.preprocess(emptyQueryToUndef, z.string().trim().min(1).max(80).optional()),
  status: z.enum(["active", "archived", "needs_review"]).optional(),
  strokeCountMax: optionalQueryInt(0, 200),
  strokeCountMin: optionalQueryInt(0, 200),
  type: adminContentKindSchema.default("lexeme")
};

export const adminContentSummaryQuerySchema = z
  .object({
    ...adminContentFilterFields
  })
  .refine(
    (d) =>
      d.strokeCountMin == null || d.strokeCountMax == null || d.strokeCountMin <= d.strokeCountMax,
    { path: ["strokeCountMax"] }
  );

export const adminContentQuerySchema = z
  .object({
    ...adminContentFilterFields,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
  })
  .refine(
    (d) =>
      d.strokeCountMin == null || d.strokeCountMax == null || d.strokeCountMin <= d.strokeCountMax,
    { path: ["strokeCountMax"] }
  );

export type AdminContentListResponse<T = unknown> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminContentSummaryResponse = {
  /** Populated for `grammar` only: `category` field on grammar_point */
  byCategory?: Record<string, number>;
  /** Grammar only: tổng theo `mapGrammarCategoryToGroupId` */
  byCategoryGroup?: Record<string, number>;
  byLevel: Record<string, number>;
  byStatus: Record<string, number>;
  distinctLevelCount: number;
  lastUpdatedAt: string | null;
  total: number;
  type: string;
};

export const adminUpdateContentStatusSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  status: z.enum(["active", "archived", "needs_review"])
});

export const adminCreateLexemeSchema = z.object({
  type: z.literal("lexeme"),
  headword: z.string().trim().min(1).max(200),
  reading: z.string().trim().max(200).optional(),
  shortMeaningVi: z.string().trim().max(2000).optional(),
  kanjiMeaningVi: z.string().trim().max(2000).optional(),
  jlptLevel: z.string().trim().max(32).optional(),
  status: z.enum(["active", "archived", "needs_review"]).default("needs_review")
});

export const adminCreateKanjiSchema = z.object({
  type: z.literal("kanji"),
  character: z.string().trim().min(1).max(8),
  meaningVi: z.string().trim().max(2000).optional(),
  onyomi: z.string().trim().max(200).optional(),
  kunyomi: z.string().trim().max(200).optional(),
  strokeCount: z.number().int().min(0).max(200).optional(),
  level: z.number().int().min(0).max(20).optional(),
  status: z.enum(["active", "archived", "needs_review"]).default("needs_review")
});

export const adminCreateGrammarSchema = z.object({
  type: z.literal("grammar"),
  pattern: z.string().trim().min(1).max(500),
  meaningVi: z.string().trim().min(1).max(2000),
  jlptLevel: z.string().trim().max(32).optional(),
  category: z.string().trim().max(200).optional(),
  status: z.enum(["active", "archived", "needs_review"]).default("needs_review")
});

export const adminCreateContentSchema = z.discriminatedUnion("type", [
  adminCreateLexemeSchema,
  adminCreateKanjiSchema,
  adminCreateGrammarSchema
]);

/** PATCH /admin/content/:type/:id — partial update, requires audit `reason` */
export const adminPatchContentBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    headword: z.string().trim().min(1).max(200).optional(),
    reading: z.string().trim().max(200).optional().nullable(),
    shortMeaningVi: z.string().trim().max(2000).optional().nullable(),
    kanjiMeaningVi: z.string().trim().max(2000).optional().nullable(),
    jlptLevel: z.string().trim().max(32).optional().nullable(),
    character: z.string().trim().min(1).max(8).optional(),
    meaningVi: z.string().trim().min(1).max(2000).optional(),
    onyomi: z.string().trim().max(200).optional().nullable(),
    kunyomi: z.string().trim().max(200).optional().nullable(),
    strokeCount: z.number().int().min(0).max(200).optional().nullable(),
    level: z.number().int().min(0).max(20).optional().nullable(),
    pattern: z.string().trim().min(1).max(500).optional(),
    category: z.string().trim().max(200).optional().nullable(),
    status: z.enum(["active", "archived", "needs_review"]).optional()
  })
  .refine(
    (b) => {
      const { reason, ...fields } = b;
      void reason;
      return [
        fields.headword,
        fields.reading,
        fields.shortMeaningVi,
        fields.kanjiMeaningVi,
        fields.jlptLevel,
        fields.character,
        fields.meaningVi,
        fields.onyomi,
        fields.kunyomi,
        fields.strokeCount,
        fields.level,
        fields.pattern,
        fields.category,
        fields.status
      ].some((v) => v !== undefined);
    },
    { path: ["body"], message: "At least one field to update" }
  );

/** POST /admin/lexemes/:id/examples — link new example_sentence to lexeme (via first or new sense) */
export const adminCreateLexemeExampleBodySchema = z.object({
  japaneseText: z.string().trim().min(1).max(4000),
  reading: z.string().trim().max(2000).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
  translationVi: z.string().trim().max(4000).optional().nullable()
});

/** PATCH /admin/lexemes/:id/examples/:linkId */
export const adminPatchLexemeExampleBodySchema = z
  .object({
    japaneseText: z.string().trim().min(1).max(4000).optional(),
    reading: z.string().trim().max(2000).optional().nullable(),
    reason: z.string().trim().min(3).max(500),
    status: z.enum(["active", "archived", "needs_review"]).optional(),
    translationVi: z.string().trim().max(4000).optional().nullable()
  })
  .refine(
    (b) => {
      const { reason, ...fields } = b;
      void reason;
      return (["japaneseText", "reading", "translationVi", "status"] as const).some(
        (k) => fields[k] !== undefined
      );
    },
    { path: ["body"], message: "At least one field to update" }
  );

/** DELETE /admin/lexemes/:id/examples/:linkId */
export const adminDeleteLexemeExampleBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const createUserProfileSchema = z.object({
  dailyGoalCards: z.number().int().min(1).max(500).default(20),
  displayName: z.string().trim().min(1).max(120),
  email: z.email().optional(),
  explanationLocale: z.enum(["vi", "ja"]).default("vi"),
  targetBjtBand: z.enum(["J5", "J4", "J3", "J2", "J1"]).optional(),
  timezone: z.string().trim().min(1).max(80).default("Asia/Tokyo"),
  uiLocale: z.enum(["vi", "ja"]).default("vi")
});

export const updateUserProfileSchema = createUserProfileSchema.partial().extend({
  reason: z.string().trim().min(3).max(500)
});

/** Account lifecycle for `profile.user_profile.status` (admin console + API). */
export const adminUserAccountStatusSchema = z.enum([
  "active",
  "pending",
  "disabled",
  "suspended",
  "deleted"
]);

export const adminUserListQuerySchema = z.object({
  lastActiveAfter: z.string().datetime().optional(),
  lastActiveBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  plan: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  uiLocale: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s))
});

export const adminPatchUserStatusBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  status: adminUserAccountStatusSchema
});

export const adminAssignUserPlanBodySchema = z.object({
  planSlug: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(3).max(500)
});

export const adminUserSupportNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
  reason: z.string().trim().min(3).max(200),
  visibility: z.enum(["private", "team", "audit_only"]).optional().default("team")
});

/** Filters for the global Support Notes admin list (privacy-hardened: private notes only visible to author or audit-only readers). */
export const adminSupportNotesListQuerySchema = z.object({
  userId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  createdBy: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  visibility: z.enum(["private", "team", "audit_only"]).optional(),
  dateFrom: z
    .string()
    .datetime()
    .optional(),
  dateTo: z
    .string()
    .datetime()
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

/** Body for the global "create support note for any user" admin endpoint. */
export const adminSupportNoteCreateBodySchema = z.object({
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  reason: z.string().trim().min(3).max(200),
  visibility: z.enum(["private", "team", "audit_only"]).default("team")
});

/** IAM admin actor management — list, assign role, revoke role, change status. RBAC: `iam.manage` (writes) or `viewer.audit` (read). */
export const adminIamAdminListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  role: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  status: z
    .enum(["active", "disabled", "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminIamAdminAssignRoleBodySchema = z.object({
  roleCode: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(3).max(500)
});

export const adminIamAdminRevokeRoleBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const adminIamAdminPatchStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"]),
  reason: z.string().trim().min(3).max(500)
});

/**
 * Managed Battle Config entity (admin Battle Configs surface). Distinct from `BATTLE_BOT_PROFILES`
 * (code-defined bot personality matrix) and from `BattleSession` (live runtime). Lifecycle:
 * `draft` → `published` → `archived`. All mutations require `battle.manage` and an audit `reason`.
 *
 * `level` accepts BJT and JLPT bands plus generic "business" tiers; kept open-typed via VarChar so
 * we can add new pools without migrations. `botDifficulties` is a stable enum subset.
 * `scoringRules` is a free JSON object — front-end renders it as form fields per known keys
 * (`correctPoints`, `wrongPenalty`, `speedBonusPerSec`, etc.) and stores unknown keys as JSON.
 */
export const BATTLE_CONFIG_LEVELS = [
  "jlpt_n5",
  "jlpt_n4",
  "jlpt_n3",
  "jlpt_n2",
  "jlpt_n1",
  "bjt_basic",
  "bjt_intermediate",
  "bjt_advanced",
  "business_starter",
  "business_pro"
] as const;

export const BATTLE_CONFIG_BOT_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const BATTLE_GAME_TYPES = [
  "speed_duel",
  "kanji_vocab_duel",
  "listening_challenge",
  "business_roleplay",
  "boss_rush",
  "mock_exam_sprint",
  "team_room",
  "tournament",
  "custom"
] as const;

export const BATTLE_GAME_TYPE_LABELS: Record<string, string> = {
  speed_duel: "Speed Duel — thi tốc độ trả lời",
  kanji_vocab_duel: "Kanji/Vocab Duel — đối đầu Kanji & từ vựng",
  listening_challenge: "Listening Challenge — thử thách nghe",
  business_roleplay: "Business Roleplay — tình huống kinh doanh",
  boss_rush: "Boss Rush — vượt ải liên tục",
  mock_exam_sprint: "Mock Exam Sprint — chạy đua đề thi",
  team_room: "Team Room — phòng nhóm",
  tournament: "Tournament — giải đấu",
  custom: "Custom — tùy chỉnh"
};

export const BATTLE_CONFIG_QUESTION_POOLS = [
  "bjt_questions_active",
  "jlpt_grammar_active",
  "kanji_reading_active",
  "vocab_high_freq",
  "business_phrase_pack"
] as const;

const battleConfigScoringRulesSchema = z
  .object({
    correctPoints: z.coerce.number().int().min(0).max(1000).optional(),
    wrongPenalty: z.coerce.number().int().min(0).max(1000).optional(),
    speedBonusPerSec: z.coerce.number().min(0).max(100).optional(),
    streakMultiplier: z.coerce.number().min(1).max(5).optional()
  })
  .passthrough();

const adminBattleConfigBaseShape = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  level: z.string().trim().min(1).max(32),
  questionPoolKey: z.string().trim().min(1).max(64),
  questionCount: z.coerce.number().int().min(5).max(30),
  timePerQuestionSec: z.coerce.number().int().min(10).max(120),
  maxParticipants: z.coerce.number().int().min(2).max(8),
  botDifficulties: z.array(z.enum(BATTLE_CONFIG_BOT_DIFFICULTIES)).min(1).max(3),
  scoringRules: battleConfigScoringRulesSchema.optional(),
  scheduleStart: z.coerce.date().optional().nullable(),
  scheduleEnd: z.coerce.date().optional().nullable()
};

export const adminBattleConfigCreateSchema = z
  .object({
    ...adminBattleConfigBaseShape,
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((value, ctx) => {
    if (value.scheduleStart && value.scheduleEnd && value.scheduleEnd <= value.scheduleStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduleEnd must be after scheduleStart",
        path: ["scheduleEnd"]
      });
    }
  });

export const adminBattleConfigPatchSchema = z
  .object({
    name: adminBattleConfigBaseShape.name.optional(),
    description: adminBattleConfigBaseShape.description.optional(),
    level: adminBattleConfigBaseShape.level.optional(),
    questionPoolKey: adminBattleConfigBaseShape.questionPoolKey.optional(),
    questionCount: adminBattleConfigBaseShape.questionCount.optional(),
    timePerQuestionSec: adminBattleConfigBaseShape.timePerQuestionSec.optional(),
    maxParticipants: adminBattleConfigBaseShape.maxParticipants.optional(),
    botDifficulties: adminBattleConfigBaseShape.botDifficulties.optional(),
    scoringRules: adminBattleConfigBaseShape.scoringRules,
    scheduleStart: adminBattleConfigBaseShape.scheduleStart,
    scheduleEnd: adminBattleConfigBaseShape.scheduleEnd,
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((value, ctx) => {
    if (value.scheduleStart && value.scheduleEnd && value.scheduleEnd <= value.scheduleStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduleEnd must be after scheduleStart",
        path: ["scheduleEnd"]
      });
    }
  });

export const adminBattleConfigListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum(["draft", "published", "archived", "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminBattleConfigReasonOnlyBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/**
 * ----- Growth admin: campaigns / postcards / referrals / social -----
 *
 * Schemas for in-product growth pushes (`GrowthCampaign`), postcard + social share templates
 * (`ShareTemplate` with `config.surface` discriminator), referral codes (read + revoke), and the
 * share-event log (`ShareItem` with moderation via expiry). Privacy class is enforced server-side:
 * publishing a `public` template requires `noPiiVerified=true`.
 */
export const GROWTH_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "ended",
  "archived"
] as const;
export const GROWTH_CAMPAIGN_CHANNELS = ["email", "push", "in_app"] as const;
export const GROWTH_TEMPLATE_PRIVACY_CLASSES = [
  "public",
  "learner_private",
  "anonymized"
] as const;
export const GROWTH_POSTCARD_EVENT_KINDS = [
  "streak",
  "level_up",
  "bjt_pass",
  "battle_win",
  "daily_phrase",
  "bjt_result"
] as const;
export const GROWTH_SOCIAL_TEMPLATE_KINDS = [
  "social_link",
  "social_quote",
  "social_progress",
  "social_invite"
] as const;

const growthAudienceSchema = z
  .object({
    locale: z.string().trim().max(16).optional(),
    plan: z.string().trim().max(64).optional(),
    level: z.string().trim().max(32).optional(),
    country: z.string().trim().max(8).optional()
  })
  .strict()
  .partial();

const growthCtaSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    url: z.string().trim().url().max(2000).optional()
  })
  .strict()
  .partial();

const growthUtmSchema = z
  .object({
    source: z.string().trim().max(64).optional(),
    medium: z.string().trim().max(64).optional(),
    campaign: z.string().trim().max(120).optional(),
    term: z.string().trim().max(120).optional(),
    content: z.string().trim().max(120).optional()
  })
  .strict()
  .partial();

const growthCampaignBaseShape = {
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  channel: z.enum(GROWTH_CAMPAIGN_CHANNELS),
  audience: growthAudienceSchema.optional(),
  cta: growthCtaSchema.optional(),
  contentBody: z.string().trim().max(20000).optional(),
  trackingUtm: growthUtmSchema.optional(),
  scheduleStart: z.coerce.date().optional().nullable(),
  scheduleEnd: z.coerce.date().optional().nullable()
};

export const adminGrowthCampaignCreateSchema = z
  .object({
    ...growthCampaignBaseShape,
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((v, ctx) => {
    if (v.scheduleStart && v.scheduleEnd && v.scheduleEnd <= v.scheduleStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduleEnd must be after scheduleStart",
        path: ["scheduleEnd"]
      });
    }
  });

export const adminGrowthCampaignPatchSchema = z
  .object({
    name: growthCampaignBaseShape.name.optional(),
    description: growthCampaignBaseShape.description.optional(),
    channel: growthCampaignBaseShape.channel.optional(),
    audience: growthCampaignBaseShape.audience,
    cta: growthCampaignBaseShape.cta,
    contentBody: growthCampaignBaseShape.contentBody,
    trackingUtm: growthCampaignBaseShape.trackingUtm,
    scheduleStart: growthCampaignBaseShape.scheduleStart,
    scheduleEnd: growthCampaignBaseShape.scheduleEnd,
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((v, ctx) => {
    if (v.scheduleStart && v.scheduleEnd && v.scheduleEnd <= v.scheduleStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduleEnd must be after scheduleStart",
        path: ["scheduleEnd"]
      });
    }
  });

export const adminGrowthCampaignListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...GROWTH_CAMPAIGN_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  channel: z
    .enum([...GROWTH_CAMPAIGN_CHANNELS, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminGrowthReasonOnlyBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/* Postcard / Social templates share the same ShareTemplate table; `surface` discriminator in
 * config separates postcard vs social. Body template + variables + privacy class live in config. */

const shareTemplateConfigSchema = z
  .object({
    surface: z.enum(["postcard", "social"]),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    bodyTemplate: z.string().trim().min(1).max(20000),
    variables: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
    thumbnailKey: z.string().trim().max(255).optional(),
    privacyClass: z.enum(GROWTH_TEMPLATE_PRIVACY_CLASSES),
    noPiiVerified: z.boolean().optional(),
    brandBg: z.string().trim().max(32).optional(),
    brandFg: z.string().trim().max(32).optional(),
    brandAccent: z.string().trim().max(32).optional(),
    badgeKey: z.string().trim().max(64).optional()
  })
  .passthrough();

export const adminGrowthPostcardCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, "slug must be alphanumeric/underscore/dash"),
  kind: z.enum(GROWTH_POSTCARD_EVENT_KINDS),
  config: shareTemplateConfigSchema.refine((c) => c.surface === "postcard", {
    message: "config.surface must be 'postcard'",
    path: ["surface"]
  }),
  reason: z.string().trim().min(3).max(500)
});

export const adminGrowthPostcardPatchSchema = z.object({
  slug: adminGrowthPostcardCreateSchema.shape.slug.optional(),
  kind: z.enum(GROWTH_POSTCARD_EVENT_KINDS).optional(),
  config: shareTemplateConfigSchema.optional(),
  reason: z.string().trim().min(3).max(500)
});

export const adminGrowthPostcardListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  kind: z
    .enum([...GROWTH_POSTCARD_EVENT_KINDS, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  status: z
    .enum(["all", "draft", "published", "archived"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminGrowthSocialTemplateCreateSchema = z.object({
  slug: adminGrowthPostcardCreateSchema.shape.slug,
  kind: z.enum(GROWTH_SOCIAL_TEMPLATE_KINDS),
  config: shareTemplateConfigSchema.refine((c) => c.surface === "social", {
    message: "config.surface must be 'social'",
    path: ["surface"]
  }),
  reason: z.string().trim().min(3).max(500)
});

export const adminGrowthSocialTemplatePatchSchema = z.object({
  slug: adminGrowthPostcardCreateSchema.shape.slug.optional(),
  kind: z.enum(GROWTH_SOCIAL_TEMPLATE_KINDS).optional(),
  config: shareTemplateConfigSchema.optional(),
  reason: z.string().trim().min(3).max(500)
});

export const adminGrowthSocialTemplateListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  kind: z
    .enum([...GROWTH_SOCIAL_TEMPLATE_KINDS, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  status: z
    .enum(["all", "draft", "published", "archived"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

/* Referral admin: list user-owned codes with abuse heuristics; revoke = delete + audit. */
export const adminGrowthReferralListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  flagged: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

/* Share-event admin: read-only paginated log + moderation (hide via expiry). */
export const adminGrowthShareEventListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  templateId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  hidden: z
    .enum(["all", "active", "hidden"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminGrowthShareModerateBodySchema = z.object({
  action: z.enum(["dismiss", "hide_from_public", "report_to_legal"]),
  reason: z.string().trim().min(3).max(500)
});

/**
 * ----- Battle Matches admin (read + abort/rerun) -----
 *
 * Matches are surfaced from `learning.battle_session`. Admin actions abort an `in_progress` session
 * (sets `abandonedReason='admin_abort'`) or rerun a completed/aborted session by cloning its config
 * (mode, botKey, maxRounds) into a fresh session for the same user. Both actions audit with reason.
 */
export const BATTLE_MATCH_STATUSES = ["in_progress", "completed", "abandoned"] as const;

export const adminBattleMatchListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...BATTLE_MATCH_STATUSES, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  userId: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().uuid().optional()),
  mode: z.string().trim().min(1).max(32).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminBattleMatchActionBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/**
 * ----- Battle Leaderboard admin (read-only, window-based) -----
 *
 * Window-based aggregation from `battle_session` (no `BattleSeason` model yet — season management
 * tracked as `partial_schema_pending`). `window` selects the time slice for ranking.
 */
export const BATTLE_LEADERBOARD_WINDOWS = ["all", "30d", "90d"] as const;

export const adminBattleLeaderboardQuerySchema = z.object({
  window: z.enum(BATTLE_LEADERBOARD_WINDOWS).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

/**
 * ----- Battle Bots admin (CRUD on `learning.battle_bot`) -----
 *
 * Editorial bot personas. `accuracyPct` is the target answer-correctness rate (0–100). Delay range
 * gates the bot's response time so matches feel natural. `vocabularyLevel` references BJT/JLPT
 * bands, kept open-typed so we can add bands without migrations.
 */
export const BATTLE_BOT_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const BATTLE_BOT_STATUSES = ["active", "disabled", "archived"] as const;
export const BATTLE_BOT_VOCAB_LEVELS = [
  "jlpt_n5",
  "jlpt_n4",
  "jlpt_n3",
  "jlpt_n2",
  "jlpt_n1",
  "bjt_basic",
  "bjt_intermediate",
  "bjt_advanced"
] as const;

const adminBattleBotBaseShape = {
  name: z.string().trim().min(2).max(80),
  difficulty: z.enum(BATTLE_BOT_DIFFICULTIES),
  persona: z.string().trim().max(2000).optional().nullable(),
  accuracyPct: z.coerce.number().int().min(0).max(100),
  minDelayMs: z.coerce.number().int().min(0).max(60000),
  maxDelayMs: z.coerce.number().int().min(0).max(60000),
  vocabularyLevel: z.string().trim().min(1).max(32)
};

export const adminBattleBotCreateSchema = z
  .object({
    ...adminBattleBotBaseShape,
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((value, ctx) => {
    if (value.maxDelayMs < value.minDelayMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxDelayMs must be >= minDelayMs",
        path: ["maxDelayMs"]
      });
    }
  });

export const adminBattleBotPatchSchema = z
  .object({
    name: adminBattleBotBaseShape.name.optional(),
    difficulty: adminBattleBotBaseShape.difficulty.optional(),
    persona: adminBattleBotBaseShape.persona,
    accuracyPct: adminBattleBotBaseShape.accuracyPct.optional(),
    minDelayMs: adminBattleBotBaseShape.minDelayMs.optional(),
    maxDelayMs: adminBattleBotBaseShape.maxDelayMs.optional(),
    vocabularyLevel: adminBattleBotBaseShape.vocabularyLevel.optional(),
    reason: z.string().trim().min(3).max(500)
  })
  .superRefine((value, ctx) => {
    if (value.minDelayMs != null && value.maxDelayMs != null && value.maxDelayMs < value.minDelayMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxDelayMs must be >= minDelayMs",
        path: ["maxDelayMs"]
      });
    }
  });

export const adminBattleBotListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  difficulty: z
    .enum([...BATTLE_BOT_DIFFICULTIES, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  status: z
    .enum([...BATTLE_BOT_STATUSES, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminBattleBotReasonOnlyBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/**
 * ----- Battle Abuse admin (moderation queue on `learning.battle_abuse_report`) -----
 *
 * Resolution actions: `warning`, `temp_ban`, `perm_ban`, `dismissed`. Escalation marks a report for
 * higher review (e.g. legal). Both audit. RBAC requires `battle.manage` (no `battle.moderate` yet).
 */
export const BATTLE_ABUSE_KINDS = ["cheating", "harassment", "inappropriate", "afk", "other"] as const;
export const BATTLE_ABUSE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const BATTLE_ABUSE_STATUSES = ["open", "triaged", "resolved", "dismissed", "escalated"] as const;
export const BATTLE_ABUSE_ACTIONS = ["warning", "temp_ban", "perm_ban", "dismissed"] as const;

export const adminBattleAbuseListQuerySchema = z.object({
  status: z
    .enum([...BATTLE_ABUSE_STATUSES, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  severity: z
    .enum([...BATTLE_ABUSE_SEVERITIES, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  kind: z
    .enum([...BATTLE_ABUSE_KINDS, "all"])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  reporterId: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().uuid().optional()),
  subjectId: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().uuid().optional()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminBattleAbuseResolveSchema = z.object({
  action: z.enum(BATTLE_ABUSE_ACTIONS),
  notes: z.string().trim().min(3).max(2000),
  reason: z.string().trim().min(3).max(500)
});

export const adminBattleAbuseEscalateSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/**
 * IAM role-audit timeline filter query.
 *
 * - `actorId`: admin who performed the action.
 * - `targetActorId`: target admin actor id (matched against `target_id` for `authz.*` rows).
 * - `action`: substring match against `action` (e.g. `role_assigned`, `role_revoked`, `actor_status_changed`).
 * - `from`/`to`: ISO timestamps; both optional.
 * - `q`: free-text search applied to `reason` (best effort).
 * - `page` + `pageSize`: bounded pagination so SaaS audit timeline can scroll without unbounded scans.
 */
export const adminIamRoleAuditQuerySchema = z.object({
  actorId: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().uuid().optional()),
  targetActorId: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().uuid().optional()),
  action: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((s) => (s === "" || s === "all" || s === undefined ? undefined : s)),
  from: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().datetime().optional()),
  to: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .pipe(z.string().datetime().optional()),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

const adminUserInviteLocale = z.enum(["vi", "ja", "en"]);

export const adminUserAccountTypeSchema = z.enum([
  "learner",
  "content_editor",
  "support_staff",
  "analytics_viewer",
  "billing_manager",
  "admin"
]);

export const adminUserInviteBodySchema = z
  .object({
    accountType: adminUserAccountTypeSchema,
    email: z.string().email(),
    displayName: z.string().trim().min(1).max(120),
    uiLocale: adminUserInviteLocale,
    explanationLocale: adminUserInviteLocale,
    timezone: z.string().trim().min(1).max(80),
    creationMode: z.enum(["invite_only", "create_keycloak_user", "sync_existing_keycloak_user"]),
    sendInvitationEmail: z.boolean(),
    requireEmailVerification: z.boolean(),
    requirePasswordResetOnFirstLogin: z.boolean(),
    initialStatus: z.enum(["pending", "active", "disabled"]),
    planSlug: z.string().trim().min(1).max(64),
    trialDays: z.number().int().min(0).max(365).optional().nullable(),
    quotaOverride: z
      .object({ flashcardDayLimit: z.number().int().min(0).max(1_000_000).optional() })
      .strict()
      .optional(),
    planReason: z.string().trim().min(3).max(500),
    /** Realm-style labels for audit only; not full IAM in MVP. */
    internalAdminRoleCodes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    adminAccess: z.boolean().optional(),
    creationReason: z.string().trim().min(3).max(2000),
    supportNote: z.string().trim().max(4000).optional().nullable(),
    learner: z
      .object({
        targetBjtBand: z.enum(["J5", "J4", "J3", "J2", "J1"]).optional().nullable(),
        dailyStudyMinutes: z.number().int().min(5).max(600).optional().nullable(),
        learningPurpose: z.string().trim().max(200).optional().nullable(),
        learningPersonality: z.string().trim().max(64).optional().nullable(),
        furiganaMode: z
          .enum(["hover", "full_furigana", "beginner", "difficult", "off"])
          .optional()
          .nullable(),
        lowPressureMode: z.boolean().optional(),
        onboardingRequired: z.boolean()
      })
      .optional()
  })
  .superRefine((b, ctx) => {
    if (b.accountType === "learner" && b.learner == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "learner block required for accountType learner",
        path: ["learner"]
      });
    }
    if (
      b.adminAccess === true &&
      !["content_editor", "support_staff", "admin", "billing_manager", "analytics_viewer"].includes(b.accountType)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "admin access only for staff account types",
        path: ["adminAccess"]
      });
    }
  });

export const analyticsEventSchema = z.object({
  anonymousId: z.string().trim().min(1).max(120).optional(),
  eventName: z.string().trim().min(3).max(120),
  payload: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().trim().min(1).max(120).optional(),
  source: z.enum(["learner_web", "admin_web", "api"]).default("learner_web"),
  userId: z.uuid().optional()
});

export const analyticsRangeQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  userId: z.uuid().optional()
});

/** Admin executive dashboard query: rollups are global; optional filters only apply to user-scoped series. */
export const adminAnalyticsExecutiveQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  locale: z.enum(["all", "vi", "ja"]).default("all"),
  plan: z.string().trim().min(1).max(64).optional(),
  segment: z.enum(["all", "new", "returning"]).default("all")
});

export const dailyLocaleSchema = z.enum(["vi", "ja"]);

export const dailyHomeQuerySchema = z.object({
  locale: dailyLocaleSchema.default("vi"),
  userId: z.uuid().optional()
});

export const dailyActionSchema = z.object({
  userId: z.uuid().optional()
});

export const adminDailyWidgetUpdateSchema = z.object({
  displayOrder: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional()
});

const imageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const presignMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(imageMimeTypes),
  userId: z.uuid()
});

export const linkCardMediaSchema = z.object({
  assetId: z.uuid(),
  role: z.string().trim().min(1).max(32).default("primary_image"),
  userId: z.uuid()
});

const maxImageBytes = 10 * 1024 * 1024;
export const completeMediaUploadSchema = z.object({
  assetId: z.uuid(),
  byteSize: z.number().int().min(1).max(maxImageBytes),
  userId: z.uuid()
});

const httpUrlString = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "Must use http(s) URL"
  });

export const mediaReadUrlQuerySchema = z.object({
  userId: z.uuid()
});

const mediaProvenanceMetadataSchema = z
  .object({
    capturedAt: z.string().datetime().optional(),
    creatorName: z.string().trim().min(1).max(160).optional(),
    isAiGenerated: z.boolean().optional(),
    licenseEvidenceUrl: z.preprocess(emptyQueryToUndef, httpUrlString.optional()),
    sourceName: z.string().trim().min(1).max(160).optional()
  })
  .strict();

const mediaAccessibilityMetadataSchema = z
  .object({
    altText: z.string().trim().min(1).max(240),
    caption: z.string().trim().min(1).max(500).optional(),
    reducedMotionSafe: z.boolean().default(false),
    transcript: z.string().trim().min(1).max(5000).optional()
  })
  .strict();

export const updateMediaRightsMetadataSchema = z.object({
  accessibility: mediaAccessibilityMetadataSchema.optional(),
  license: z.string().trim().min(1).max(200),
  provenance: mediaProvenanceMetadataSchema.optional(),
  sourceUrl: z.preprocess(emptyQueryToUndef, httpUrlString.optional()),
  userId: z.uuid()
});

export const dailyQuickQuizCompleteSchema = z.object({
  selectedIndex: z.number().int().min(0).max(20),
  userId: z.uuid().optional()
});

export const battleChallengeBotSchema = z.object({
  botKey: z.string().trim().min(1).max(32),
  userId: z.uuid()
});

export const battleAnswerSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
  optionKey: z.string().trim().min(1).max(8),
  roomCode: z.string().trim().min(4).max(16),
  roundIndex: z.coerce.number().int().min(0).max(99),
  userId: z.uuid()
});

export const battleRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  userId: z.uuid()
});

export const learnerOnboardingQuerySchema = z.object({
  userId: z.uuid()
});

export const placementStartSchema = z.object({
  userId: z.uuid()
});

export const placementSubmitSchema = z.object({
  answers: z.record(z.string().uuid(), z.string().min(1).max(8)),
  sessionId: z.uuid(),
  userId: z.uuid()
});

export const notificationPreferencesUpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  productNewsEnabled: z.boolean().optional(),
  studyRemindersEnabled: z.boolean().optional(),
  userId: z.uuid()
});

export const inAppNotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  userId: z.uuid()
});

export const inAppMarkReadParamSchema = z.object({
  id: z.uuid(),
  userId: z.uuid()
});

export const privacyRequestCreateSchema = z.object({
  kind: z.enum(["data_export", "account_deletion"]),
  userId: z.uuid()
});

export const privacyRequestListQuerySchema = z.object({
  userId: z.uuid()
});

export const legalConsentKeySchema = z.enum([
  "terms_of_service",
  "privacy_policy",
  "cookie_policy"
]);

export const legalConsentStatusQuerySchema = z.object({
  userId: z.uuid()
});

export const legalConsentAcceptSchema = z.object({
  consentKey: legalConsentKeySchema,
  policyVersion: z.string().trim().min(1).max(40),
  source: z.enum(["web", "mobile", "admin"]).default("web"),
  userId: z.uuid()
});

export const reviewBatchItemSchema = z.object({
  clientMutationId: z.string().min(1).max(64),
  elapsedMs: z.number().int().min(0).max(3_600_000).optional(),
  rating: srsRatingSchema,
  reviewedAt: z.string().datetime().optional(),
  userFlashcardId: z.uuid()
});

export const reviewBatchSchema = z.object({
  items: z.array(reviewBatchItemSchema).min(1).max(50),
  userId: z.uuid()
});

export const monetizationUserQuerySchema = z.object({
  userId: z.uuid()
});

export const monetizationCheckoutSchema = z.object({
  planSlug: z.string().min(1).max(64),
  userId: z.uuid()
});

export const adsLearningContextSchema = z.object({
  planSlug: z.string().max(64).optional(),
  sessionKind: z
    .enum(["default", "flashcard_review", "bjt_timed", "quiz_active"])
    .optional()
});

export const adsRuntimeClientContextSchema = z
  .object({
    device: z.enum(["mobile", "desktop", "unknown"]).optional(),
    locale: z.string().max(16).optional(),
    planSlug: z.string().max(64).optional()
  })
  .strict();

export const adsRuntimeDecisionBodySchema = z.object({
  learningContext: adsLearningContextSchema.optional(),
  locale: z.string().max(16).optional(),
  placementCode: z.string().min(1).max(64),
  userId: z.uuid()
});

export const adsRuntimeImpressionBodySchema = z.object({
  campaignId: z.uuid().optional(),
  clientContext: adsRuntimeClientContextSchema.optional(),
  decisionKey: z.string().max(120).optional(),
  kind: z.enum(["impression", "blocked"]),
  placementCode: z.string().min(1).max(64),
  userId: z.uuid()
});

export const adsRuntimeClickBodySchema = z.object({
  campaignId: z.uuid().optional(),
  clientContext: adsRuntimeClientContextSchema.optional(),
  decisionKey: z.string().max(120).optional(),
  placementCode: z.string().min(1).max(64),
  userId: z.uuid()
});

export const monetizationAdDecideQuerySchema = z.object({
  learningContext: z.string().max(4000).optional(),
  locale: z.string().max(16).optional(),
  placementCode: z.string().min(1).max(64),
  userId: z.uuid()
});

export const authLinkExchangeSchema = z.object({
  code: z.string().min(16).max(256)
});

const shareStreak = z.object({
  kind: z.literal("streak"),
  payload: z.object({ streakDays: z.number().int().min(0).max(100_000) }),
  userId: z.uuid()
});

const shareBjt = z.object({
  kind: z.literal("bjt_result"),
  payload: z.object({
    band: z.string().min(1).max(32),
    includeScorePercent: z.boolean().optional(),
    scorePercent: z.number().min(0).max(100).optional()
  }),
  userId: z.uuid()
});

const shareDaily = z.object({
  kind: z.literal("daily_phrase"),
  payload: z.object({ phraseLabel: z.string().min(1).max(160) }),
  userId: z.uuid()
});

const shareBattle = z.object({
  kind: z.literal("battle"),
  payload: z.object({
    result: z.enum(["win", "lose", "draw"]),
    band: z.string().min(1).max(32).optional(),
    scorePercent: z.number().min(0).max(100).optional(),
    opponentName: z.string().min(1).max(128).optional()
  }),
  userId: z.uuid()
});

export const shareCreateSchema = z.discriminatedUnion("kind", [shareStreak, shareBjt, shareDaily, shareBattle]);

export const readingAssistDisplayModeSchema = z.enum([
  "off",
  "hover",
  "difficult",
  "full_furigana",
  "beginner"
]);
export type ReadingAssistDisplayMode = z.infer<typeof readingAssistDisplayModeSchema>;

export const readingAssistExamContextSchema = z
  .object({
    answerSubmitted: z.boolean().optional(),
    kind: z.literal("bjt_quiz"),
    mode: z.enum(["practice", "timed"])
  })
  .optional();
export type ReadingAssistExamContext = z.infer<typeof readingAssistExamContextSchema>;

export const readingAssistAnalyzeSchema = z.object({
  examContext: readingAssistExamContextSchema,
  quizSessionId: z.uuid().optional(),
  text: z.string().trim().min(1).max(2000),
  userId: z.uuid()
});
export type ReadingAssistAnalyzeInput = z.infer<typeof readingAssistAnalyzeSchema>;

export const readingAssistPreferenceQuerySchema = z.object({
  userId: z.uuid()
});
export type ReadingAssistPreferenceQuery = z.infer<typeof readingAssistPreferenceQuerySchema>;

export const readingAssistPreferenceUpdateSchema = z.object({
  displayMode: readingAssistDisplayModeSchema,
  showRomaji: z.boolean().optional(),
  userId: z.uuid()
});
export type ReadingAssistPreferenceUpdate = z.infer<typeof readingAssistPreferenceUpdateSchema>;

export const readingAssistAddCardSchema = z.object({
  backText: z.string().trim().min(1).max(2000),
  deckId: z.uuid(),
  frontText: z.string().trim().min(1).max(2000),
  reading: z.string().trim().max(500).optional(),
  userId: z.uuid()
});
export type ReadingAssistAddCard = z.infer<typeof readingAssistAddCardSchema>;

export const readingAssistReportSchema = z.object({
  context: z.string().trim().max(200).optional(),
  kind: z.enum(["wrong_meaning", "tokenization_failed", "missing_reading"]),
  textHash: z.string().length(64),
  userId: z.uuid().optional()
});
export type ReadingAssistReport = z.infer<typeof readingAssistReportSchema>;

export const readingAssistAnalyticsSchema = z.object({
  anonymousId: z.string().trim().min(1).max(120).optional(),
  deckId: z.uuid().optional(),
  displayMode: readingAssistDisplayModeSchema.optional(),
  eventName: z.enum([
    "reading_assist_cache_miss",
    "reading_assist_token_open",
    "reading_assist_furigana_toggle",
    "reading_assist_add_card",
    "reading_assist_report_submitted"
  ]),
  sessionId: z.string().trim().min(1).max(120).optional(),
  textHash: z.string().length(64).optional(),
  tokenIndex: z.number().int().min(0).max(5000).optional(),
  userId: z.uuid().optional()
});
export type ReadingAssistAnalyticsEvent = z.infer<typeof readingAssistAnalyticsSchema>;

export const adminReadingAssistReportsQuerySchema = z.object({
  kind: z.enum(["wrong_meaning", "tokenization_failed", "missing_reading"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type AdminReadingAssistReportsQuery = z.infer<typeof adminReadingAssistReportsQuerySchema>;

export {
  aggregateByCategoryGroup,
  getGrammarCategoryGroupFilterClauses,
  GRAMMAR_CATEGORY_GROUP_CHART_ORDER,
  GRAMMAR_CATEGORY_GROUP_SPECS,
  mapGrammarCategoryToGroupId,
  type GrammarCategoryGroupId
} from "./grammar-category-taxonomy.js";
export {
  ADMIN_PERMISSION,
  ADMIN_ROUTE_GROUP_PERMISSIONS,
  ADMIN_SYSTEM_ROLE,
  ADMIN_SYSTEM_ROLE_PERMISSION_MATRIX,
  canCreateLearnerProfile,
  canInviteOrCreateUser,
  canListLearnerProfiles,
  canReadSensitiveUserProfile,
  toRolePermissionSet,
  type AdminSystemRole,
  type AdminSupportUserPermissionCode
} from "./admin-permissions.js";

/**
 * ----- Content Enrichment + Versions admin -----
 *
 * Enrichment jobs augment canonical content (furigana / translation / audio / scoring / level-tag).
 * Provider provenance + license metadata MUST be surfaced to operators (AGENTS.md non-negotiable).
 * Versions track per-entity drafts with publish + revert lifecycle.
 */
export const CONTENT_ENRICHMENT_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
] as const;

export const CONTENT_ENRICHMENT_TYPES = [
  "furigana",
  "translate",
  "audio",
  "examples",
  "scoring",
  "bjt_level"
] as const;

export const CONTENT_VERSION_STATUSES = [
  "draft",
  "published",
  "superseded"
] as const;

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined))
  .pipe(z.string().uuid().optional());

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined))
  .pipe(z.string().datetime().optional());

export const adminContentEnrichmentListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...CONTENT_ENRICHMENT_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  type: z
    .enum([...CONTENT_ENRICHMENT_TYPES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  entityType: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  entityId: optionalUuid,
  provider: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminContentEnrichmentReasonBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const adminContentEnrichmentBulkRetrySchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().trim().min(3).max(500)
});

export const adminContentVersionListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  entityType: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  entityId: optionalUuid,
  authorUserId: optionalUuid,
  status: z
    .enum([...CONTENT_VERSION_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminContentVersionDiffQuerySchema = z.object({
  from: z.string().uuid(),
  to: z.string().uuid()
});

export const adminContentVersionRevertBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

/**
 * ----- Assessment admin: mock exams / question bank / quiz sessions / quiz templates / remediation -----
 *
 * Schemas for the assessment admin slice. Mock exams and quiz templates share `BjtMockTest` storage
 * with `type` discriminator: `type === "mock"` are exams; `type IN {practice, daily, weekly,
 * topic_mastery, diagnostic}` are templates. Question bank is `BjtQuestion`. Sessions are
 * `QuizSession`. Remediation has dedicated rule + trigger tables. RBAC: `assessment.manage` for
 * writes, `assessment.review` for read+suggest, `viewer.audit` for read.
 */
export const ASSESSMENT_BJT_LEVELS = [
  "BJT-J5",
  "BJT-J4",
  "BJT-J3",
  "BJT-J2",
  "BJT-J1",
  "BJT-J1+"
] as const;

export const ASSESSMENT_MOCK_EXAM_STATUSES = ["draft", "published", "archived"] as const;
export const ASSESSMENT_QUIZ_TEMPLATE_TYPES = [
  "practice",
  "daily",
  "weekly",
  "topic_mastery",
  "diagnostic"
] as const;
export const ASSESSMENT_QUESTION_STATUSES = ["draft", "published", "archived"] as const;
export const ASSESSMENT_QUIZ_SESSION_STATUSES = [
  "in_progress",
  "completed",
  "abandoned",
  "timed_out"
] as const;
export const ASSESSMENT_QUESTION_DIFFICULTIES = [
  "easy",
  "standard",
  "hard",
  "elite"
] as const;

export const ASSESSMENT_BJT_PARTS = [
  "listening",
  "listening_reading",
  "reading"
] as const;

export const ASSESSMENT_BJT_SECTIONS = [
  "LC_SCENE",
  "LC_STATEMENT",
  "LC_INTEGRATED",
  "LR_SITUATION",
  "LR_DOCUMENT",
  "LR_INTEGRATED",
  "RC_VOCAB_GRAMMAR",
  "RC_EXPRESSION",
  "RC_INTEGRATED"
] as const;

export const ASSESSMENT_BJT_SECTION_LABELS: Record<string, string> = {
  LC_SCENE: "Nghe – Cảnh huống",
  LC_STATEMENT: "Nghe – Phát ngôn",
  LC_INTEGRATED: "Nghe – Tổng hợp",
  LR_SITUATION: "Nghe-Đọc – Tình huống",
  LR_DOCUMENT: "Nghe-Đọc – Tài liệu",
  LR_INTEGRATED: "Nghe-Đọc – Tổng hợp",
  RC_VOCAB_GRAMMAR: "Đọc – Từ vựng & Ngữ pháp",
  RC_EXPRESSION: "Đọc – Biểu hiện",
  RC_INTEGRATED: "Đọc – Tổng hợp"
};

export const ASSESSMENT_BUSINESS_SITUATIONS = [
  "meeting",
  "phone",
  "presentation",
  "negotiation",
  "complaint",
  "report_document",
  "email_chat",
  "schedule",
  "chart_table",
  "hr_interview",
  "sales_customer",
  "internal_coordination",
  "other"
] as const;

export const ASSESSMENT_STIMULUS_KINDS = [
  "audio",
  "photo",
  "illustration",
  "chart",
  "table",
  "document",
  "email",
  "memo",
  "conversation",
  "text"
] as const;

const assessmentReasonField = z.string().trim().min(3).max(500);

const mockExamSectionSchema = z.object({
  code: z.string().trim().min(1).max(64),
  titleVi: z.string().trim().min(1).max(200),
  titleJa: z.string().trim().max(200).optional().nullable(),
  type: z.string().trim().min(1).max(32),
  questionCount: z.number().int().min(1).max(200),
  timeLimitSec: z.number().int().min(0).max(60 * 60 * 4),
  sourcePool: z.string().trim().max(120).optional().nullable()
});

const mockExamScoringRubricSchema = z
  .object({
    passingScore: z.number().int().min(0).max(1000).optional(),
    perCorrectPoints: z.number().min(0).max(1000).optional(),
    bandThresholds: z
      .array(
        z.object({
          band: z.string().trim().min(1).max(16),
          min: z.number().int().min(0).max(1000)
        })
      )
      .max(20)
      .optional()
  })
  .partial();

const mockExamBlueprintMetaSchema = z.object({
  sections: z.array(mockExamSectionSchema).min(1).max(20),
  totalTimeMin: z.number().int().min(1).max(360),
  scoringRubric: mockExamScoringRubricSchema.optional().default({})
});

export type AdminMockExamSection = z.infer<typeof mockExamSectionSchema>;
export type AdminMockExamBlueprintMeta = z.infer<typeof mockExamBlueprintMetaSchema>;

const mockExamBaseShape = {
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "slug must be alnum/dash/underscore"),
  titleVi: z.string().trim().min(1).max(200),
  titleJa: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  level: z.enum(ASSESSMENT_BJT_LEVELS),
  timeLimitSeconds: z.number().int().min(60).max(60 * 60 * 4),
  blueprintMeta: mockExamBlueprintMetaSchema
};

export const adminMockExamCreateSchema = z
  .object({ ...mockExamBaseShape, reason: assessmentReasonField })
  .superRefine((value, ctx) => {
    const declared = value.blueprintMeta.totalTimeMin * 60;
    if (Math.abs(declared - value.timeLimitSeconds) > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "timeLimitSeconds must match blueprintMeta.totalTimeMin within 60s",
        path: ["timeLimitSeconds"]
      });
    }
  });

export const adminMockExamPatchSchema = z.object({
  slug: mockExamBaseShape.slug.optional(),
  titleVi: mockExamBaseShape.titleVi.optional(),
  titleJa: mockExamBaseShape.titleJa,
  description: mockExamBaseShape.description,
  level: mockExamBaseShape.level.optional(),
  timeLimitSeconds: mockExamBaseShape.timeLimitSeconds.optional(),
  blueprintMeta: mockExamBlueprintMetaSchema.optional(),
  reason: assessmentReasonField
});

export const adminMockExamListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...ASSESSMENT_MOCK_EXAM_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminMockExamReasonOnlyBodySchema = z.object({ reason: assessmentReasonField });

/** Quiz templates (BjtMockTest with type IN ASSESSMENT_QUIZ_TEMPLATE_TYPES). */
const quizTemplateGenerationRulesSchema = z.object({
  questionCount: z.number().int().min(1).max(200),
  timeLimitSec: z.number().int().min(60).max(60 * 60 * 4),
  difficultyMix: z
    .array(
      z.object({
        difficulty: z.enum(ASSESSMENT_QUESTION_DIFFICULTIES),
        weight: z.number().min(0).max(1)
      })
    )
    .min(1)
    .max(8),
  topicMix: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(64),
        weight: z.number().min(0).max(1)
      })
    )
    .max(20)
    .optional()
    .default([])
});

const quizTemplateBaseShape = {
  slug: mockExamBaseShape.slug,
  titleVi: mockExamBaseShape.titleVi,
  titleJa: mockExamBaseShape.titleJa,
  description: mockExamBaseShape.description,
  level: mockExamBaseShape.level,
  type: z.enum(ASSESSMENT_QUIZ_TEMPLATE_TYPES),
  generationRules: quizTemplateGenerationRulesSchema
};

export const adminQuizTemplateCreateSchema = z.object({
  ...quizTemplateBaseShape,
  reason: assessmentReasonField
});

export const adminQuizTemplatePatchSchema = z.object({
  slug: quizTemplateBaseShape.slug.optional(),
  titleVi: quizTemplateBaseShape.titleVi.optional(),
  titleJa: quizTemplateBaseShape.titleJa,
  description: quizTemplateBaseShape.description,
  level: quizTemplateBaseShape.level.optional(),
  type: quizTemplateBaseShape.type.optional(),
  generationRules: quizTemplateGenerationRulesSchema.optional(),
  reason: assessmentReasonField
});

export const adminQuizTemplateListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...ASSESSMENT_MOCK_EXAM_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  type: z
    .enum([...ASSESSMENT_QUIZ_TEMPLATE_TYPES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminQuizTemplateReasonOnlyBodySchema = adminMockExamReasonOnlyBodySchema;

/** Question bank. */
const questionOptionSchema = z.object({
  optionKey: z.string().trim().min(1).max(8),
  text: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean()
});

const questionBaseShape = {
  sectionId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(4000),
  scenario: z.string().trim().max(4000).optional().nullable(),
  explanationVi: z.string().trim().min(1).max(4000),
  skillTag: z.string().trim().min(1).max(64),
  difficulty: z.enum(ASSESSMENT_QUESTION_DIFFICULTIES),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).default([]),
  sourceType: z.string().trim().max(64).optional().nullable(),
  sourceId: optionalUuid,
  options: z.array(questionOptionSchema).min(2).max(8)
};

const enforceSingleCorrectQuestionOptions = (
  options: { optionKey: string; isCorrect: boolean }[],
  ctx: z.RefinementCtx
) => {
  const correct = options.filter((o) => o.isCorrect).length;
  if (correct !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `exactly one option must be marked correct (got ${correct})`,
      path: ["options"]
    });
  }
  const seen = new Set<string>();
  for (const o of options) {
    if (seen.has(o.optionKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate optionKey ${o.optionKey}`,
        path: ["options"]
      });
    }
    seen.add(o.optionKey);
  }
};

export const adminQuestionBankCreateSchema = z
  .object({ ...questionBaseShape, reason: assessmentReasonField })
  .superRefine((value, ctx) => enforceSingleCorrectQuestionOptions(value.options, ctx));

export const adminQuestionBankPatchSchema = z
  .object({
    sectionId: questionBaseShape.sectionId.optional(),
    prompt: questionBaseShape.prompt.optional(),
    scenario: questionBaseShape.scenario,
    explanationVi: questionBaseShape.explanationVi.optional(),
    skillTag: questionBaseShape.skillTag.optional(),
    difficulty: questionBaseShape.difficulty.optional(),
    tags: questionBaseShape.tags.optional(),
    sourceType: questionBaseShape.sourceType,
    sourceId: questionBaseShape.sourceId,
    options: z.array(questionOptionSchema).min(2).max(8).optional(),
    reason: assessmentReasonField
  })
  .superRefine((value, ctx) => {
    if (value.options) enforceSingleCorrectQuestionOptions(value.options, ctx);
  });

export const adminQuestionBankListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...ASSESSMENT_QUESTION_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  topic: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  difficulty: z
    .enum([...ASSESSMENT_QUESTION_DIFFICULTIES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : v.split(",");
      const cleaned = arr.map((s) => s.trim()).filter((s) => s.length > 0);
      return cleaned.length > 0 ? cleaned : undefined;
    }),
  sectionId: optionalUuid,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminQuestionBankBulkActionSchema = z.object({
  action: z.enum(["publish", "archive", "tag", "untag"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
  reason: assessmentReasonField
});

export const adminQuestionBankSuggestEditSchema = z.object({
  field: z.enum(["prompt", "explanationVi", "tags", "options", "skillTag", "difficulty"]),
  proposedValue: z.unknown(),
  rationale: z.string().trim().min(8).max(2000),
  reason: assessmentReasonField
});

/** Quiz sessions (read + abort + extend). */
export const adminQuizSessionListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  status: z
    .enum([...ASSESSMENT_QUIZ_SESSION_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" ? undefined : s)),
  userId: optionalUuid,
  testId: optionalUuid,
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminQuizSessionAbortBodySchema = z.object({ reason: assessmentReasonField });
export const adminQuizSessionExtendTimeBodySchema = z.object({
  addSeconds: z.coerce.number().int().min(15).max(60 * 60),
  reason: assessmentReasonField
});

/** Remediation rules + triggers. */
const remediationContentTypeEnum = z.enum([
  "lesson",
  "flashcard_deck",
  "flashcard_variant",
  "kanji",
  "lexeme",
  "grammar",
  "reading_passage",
  "video"
]);

const remediationRuleBaseShape = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  topicSkillTag: z.string().trim().min(1).max(64),
  level: z.enum(ASSESSMENT_BJT_LEVELS),
  thresholdFailedCount: z.number().int().min(1).max(50),
  thresholdWindowQuestions: z.number().int().min(1).max(200),
  recommendedContentType: remediationContentTypeEnum,
  recommendedContentId: z.string().uuid()
};

export const adminRemediationRuleCreateSchema = z
  .object({ ...remediationRuleBaseShape, reason: assessmentReasonField })
  .superRefine((value, ctx) => {
    if (value.thresholdFailedCount > value.thresholdWindowQuestions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "thresholdFailedCount cannot exceed thresholdWindowQuestions",
        path: ["thresholdFailedCount"]
      });
    }
  });

export const adminRemediationRulePatchSchema = z
  .object({
    name: remediationRuleBaseShape.name.optional(),
    description: remediationRuleBaseShape.description,
    topicSkillTag: remediationRuleBaseShape.topicSkillTag.optional(),
    level: remediationRuleBaseShape.level.optional(),
    thresholdFailedCount: remediationRuleBaseShape.thresholdFailedCount.optional(),
    thresholdWindowQuestions: remediationRuleBaseShape.thresholdWindowQuestions.optional(),
    recommendedContentType: remediationRuleBaseShape.recommendedContentType.optional(),
    recommendedContentId: remediationRuleBaseShape.recommendedContentId.optional(),
    reason: assessmentReasonField
  })
  .superRefine((value, ctx) => {
    if (
      value.thresholdFailedCount !== undefined &&
      value.thresholdWindowQuestions !== undefined &&
      value.thresholdFailedCount > value.thresholdWindowQuestions
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "thresholdFailedCount cannot exceed thresholdWindowQuestions",
        path: ["thresholdFailedCount"]
      });
    }
  });

export const adminRemediationRuleListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((s) => (s === "" ? undefined : s)),
  topicSkillTag: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s)),
  active: z
    .enum(["true", "false", "all"])
    .optional()
    .transform((s) => (s === undefined || s === "all" ? undefined : s === "true")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminRemediationToggleBodySchema = z.object({ reason: assessmentReasonField });

export const adminRemediationTriggerListQuerySchema = z.object({
  ruleId: optionalUuid,
  userId: optionalUuid,
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

/* ============================================================================
 * Analytics admin (per-domain) — battle, bjt, flashcards, growth, system.
 * Read-only with audited export + refresh. No PII surfaced in series; learner-level
 * drill-downs reuse User 360 access-reason gate at the controller layer.
 * ========================================================================== */

export const ANALYTICS_DOMAIN_KEYS = [
  "battle",
  "bjt",
  "flashcards",
  "growth",
  "system",
  "learning",
  "content",
  "search"
] as const;
export type AnalyticsDomainKey = (typeof ANALYTICS_DOMAIN_KEYS)[number];

export const ANALYTICS_GRANULARITIES = ["day", "hour"] as const;

const isoDateField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .optional()
  .transform((s) => (s === "" ? undefined : s));

const optionalEnumLike = (max = 64) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s));

/** Filters applied to all per-domain analytics endpoints (summary, timeseries, breakdown, export). */
export const adminAnalyticsCommonFilterSchema = z.object({
  from: isoDateField,
  to: isoDateField,
  /** 7d|30d|90d|custom — when custom, `from` and `to` must be present. */
  range: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
  level: optionalEnumLike(32),
  locale: optionalEnumLike(8),
  segment: optionalEnumLike(32),
  configId: z.uuid().optional(),
  deckId: z.uuid().optional(),
  topic: optionalEnumLike(64),
  source: optionalEnumLike(32),
  campaign: optionalEnumLike(64),
  service: optionalEnumLike(32),
  endpointPattern: optionalEnumLike(120)
});

export const adminAnalyticsTimeseriesQuerySchema = adminAnalyticsCommonFilterSchema.extend({
  metric: z.string().trim().min(1).max(64),
  granularity: z.enum(ANALYTICS_GRANULARITIES).default("day")
});

export const adminAnalyticsBreakdownQuerySchema = adminAnalyticsCommonFilterSchema.extend({
  dimension: z.string().trim().min(1).max(64).default("default"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

export const adminAnalyticsExportQuerySchema = adminAnalyticsCommonFilterSchema.extend({
  view: z.enum(["summary", "timeseries", "breakdown"]).default("breakdown"),
  metric: z.string().trim().min(1).max(64).optional(),
  dimension: z.string().trim().min(1).max(64).optional(),
  granularity: z.enum(ANALYTICS_GRANULARITIES).default("day"),
  format: z.enum(["csv"]).default("csv"),
  reason: z.string().trim().min(3).max(500)
});

export const adminAnalyticsRefreshBodySchema = z.object({
  reason: z.string().trim().min(3).max(500)
});
