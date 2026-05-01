/**
 * Learning + Daily admin schemas (Zod) for management workflows.
 *
 * - Learning paths: full CRUD + lifecycle (draft/published/archived) with audited reasons
 * - Competencies: full CRUD + lifecycle
 * - Daily content items: scheduled phrase/grammar/quiz items per locale per date
 * - Learning review: read-only retention dashboard + audited force-reintroduce action on a card
 *
 * RBAC enforced server-side: writes require `admin.content.write`; reads accept any of
 * `admin.content.read | admin.content.write | viewer.audit`.
 */
import { z } from "zod";

export const LEARNING_PATH_STATUSES = ["draft", "published", "archived"] as const;
export const COMPETENCY_STATUSES = ["draft", "published", "archived"] as const;
export const COMPETENCY_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "BJT-J5",
  "BJT-J4",
  "BJT-J3",
  "BJT-J2",
  "BJT-J1"
] as const;
export const DAILY_CONTENT_ITEM_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived"
] as const;
export const DAILY_CONTENT_LOCALES = ["vi", "ja"] as const;

const reason = z.string().trim().min(3).max(500);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s === undefined || s === "" ? undefined : s));

const optionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((s) => {
      if (s === undefined) return undefined;
      if (s === null || s === "") return null;
      return s;
    });

/* ────────── Learning Paths ────────── */
export const adminLearningPathListQuerySchema = z.object({
  q: optionalText(200),
  status: z
    .enum([...LEARNING_PATH_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" || s === undefined ? undefined : s)),
  targetLevel: optionalText(32).transform((s) => (s === "all" ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const learningPathBase = {
  slug: z
    .string()
    .trim()
    .min(2)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9-]*$/, {
      message: "slug must be lowercase letters, digits and dashes"
    }),
  titleVi: z.string().trim().min(2).max(200),
  titleJa: optionalNullableText(200),
  descriptionVi: optionalNullableText(2000),
  descriptionJa: optionalNullableText(2000),
  targetLevel: optionalNullableText(32),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0)
};

export const adminLearningPathCreateSchema = z.object({
  ...learningPathBase,
  reason
});

export const adminLearningPathPatchSchema = z.object({
  slug: learningPathBase.slug.optional(),
  titleVi: learningPathBase.titleVi.optional(),
  titleJa: learningPathBase.titleJa,
  descriptionVi: learningPathBase.descriptionVi,
  descriptionJa: learningPathBase.descriptionJa,
  targetLevel: learningPathBase.targetLevel,
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  reason
});

export const adminLearningPathReasonOnlySchema = z.object({ reason });

/* ────────── Competencies ────────── */
export const adminCompetencyListQuerySchema = z.object({
  q: optionalText(200),
  status: z
    .enum([...COMPETENCY_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" || s === undefined ? undefined : s)),
  level: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "all" || s === "" || s === undefined ? undefined : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const competencyBase = {
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, {
      message: "code must be uppercase letters, digits, dot, dash, underscore"
    }),
  titleVi: z.string().trim().min(2).max(200),
  titleJa: optionalNullableText(200),
  descriptionVi: optionalNullableText(2000),
  level: z.enum(COMPETENCY_LEVELS).default("intermediate")
};

export const adminCompetencyCreateSchema = z.object({
  ...competencyBase,
  reason
});

export const adminCompetencyPatchSchema = z.object({
  code: competencyBase.code.optional(),
  titleVi: competencyBase.titleVi.optional(),
  titleJa: competencyBase.titleJa,
  descriptionVi: competencyBase.descriptionVi,
  level: competencyBase.level.optional(),
  reason
});

export const adminCompetencyReasonOnlySchema = z.object({ reason });

/* ────────── Daily Content Items ────────── */
export const adminDailyContentItemListQuerySchema = z.object({
  q: optionalText(200),
  status: z
    .enum([...DAILY_CONTENT_ITEM_STATUSES, "all"] as [string, ...string[]])
    .optional()
    .transform((s) => (s === "all" || s === undefined ? undefined : s)),
  locale: z.enum([...DAILY_CONTENT_LOCALES, "all"] as [string, ...string[]]).optional()
    .transform((s) => (s === "all" || s === undefined ? undefined : s)),
  widgetKind: optionalText(64).transform((s) => (s === "all" ? undefined : s)),
  from: optionalText(32),
  to: optionalText(32),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const isoDateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" });

const dailyItemBase = {
  widgetKind: z.string().trim().min(1).max(64),
  contentDate: isoDateOnly,
  locale: z.enum(DAILY_CONTENT_LOCALES),
  title: z.string().trim().min(1).max(200),
  bodyMd: optionalNullableText(8000),
  japaneseText: optionalNullableText(4000),
  readingText: optionalNullableText(4000),
  explanationText: optionalNullableText(8000),
  sourceProvider: optionalNullableText(80),
  sourceRef: optionalNullableText(500)
};

export const adminDailyContentItemCreateSchema = z.object({
  ...dailyItemBase,
  reason
});

export const adminDailyContentItemPatchSchema = z.object({
  widgetKind: dailyItemBase.widgetKind.optional(),
  contentDate: dailyItemBase.contentDate.optional(),
  locale: dailyItemBase.locale.optional(),
  title: dailyItemBase.title.optional(),
  bodyMd: dailyItemBase.bodyMd,
  japaneseText: dailyItemBase.japaneseText,
  readingText: dailyItemBase.readingText,
  explanationText: dailyItemBase.explanationText,
  sourceProvider: dailyItemBase.sourceProvider,
  sourceRef: dailyItemBase.sourceRef,
  reason
});

export const adminDailyContentItemReasonOnlySchema = z.object({ reason });

/* ────────── Learning Review (spaced repetition admin) ────────── */
export const adminLearningReviewProblemQuerySchema = z.object({
  q: optionalText(200),
  minLapses: z.coerce.number().int().min(0).max(100).optional().default(2),
  maxRetention: z.coerce.number().int().min(0).max(100).optional().default(60),
  leeched: z
    .enum(["all", "leeched", "non_leeched"])
    .optional()
    .default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const adminLearningReviewRetentionQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(180).optional().default(30)
});

export const adminLearningReviewForceReintroduceSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});
