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
  reason: z.string().trim().min(3).max(200)
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
