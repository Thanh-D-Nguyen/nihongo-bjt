import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LearnerProfileOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000001" })
  id!: string;

  @ApiProperty({ type: String, example: "Nguyen Thanh" })
  displayName!: string;

  @ApiPropertyOptional({ type: String, example: "learner@example.com", nullable: true })
  email?: string | null;

  @ApiProperty({ type: String, example: "vi" })
  uiLocale!: string;

  @ApiProperty({ type: String, example: "vi" })
  explanationLocale!: string;

  @ApiProperty({ type: String, example: "Asia/Tokyo" })
  timezone!: string;

  @ApiPropertyOptional({ type: String, example: "J2", nullable: true })
  targetBjtBand?: string | null;

  @ApiProperty({ type: Number, example: 20 })
  dailyGoalCards!: number;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: "Explicit learner consent for creating public share postcards/pages."
  })
  sharePostcardOptIn!: boolean;

  @ApiProperty({ type: String, example: "active" })
  status!: string;
}

export class LearnerProfileEnvelopeOpenApiDto {
  @ApiProperty({ type: () => LearnerProfileOpenApiDto })
  profile!: LearnerProfileOpenApiDto;
}

export class BookmarkToggleOpenApiDto {
  @ApiProperty({ type: Boolean, example: true })
  bookmarked!: boolean;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000010" })
  targetId!: string;

  @ApiProperty({ type: String, example: "word", enum: ["word", "lexeme", "kanji", "grammar"] })
  type!: string;

  @ApiPropertyOptional({ type: String, example: "00000000-0000-4000-8000-000000000011", nullable: true })
  bookmarkId?: string | null;
}

export class FeatureFlagOpenApiDto {
  @ApiProperty({ type: String, example: "reading_assist" })
  key!: string;

  @ApiProperty({ type: Boolean, example: true })
  enabled!: boolean;

  @ApiProperty({ type: Boolean, example: false })
  killSwitch!: boolean;

  @ApiPropertyOptional({ type: String, example: "Enable reading assist." })
  description?: string | null;
}

export class AdminModuleContractOpenApiDto {
  @ApiProperty({ type: String, example: "u.360" })
  moduleId!: string;

  @ApiProperty({ type: String, enum: ["implemented", "partial", "planned"], example: "implemented" })
  status!: "implemented" | "partial" | "planned";

  @ApiProperty({ type: String, example: "User support console and per-user diagnostic detail are available." })
  notes!: string;

  @ApiProperty({ type: [String], example: ["GET /api/admin/users", "GET /api/admin/users/:id"] })
  endpoints!: string[];

  @ApiPropertyOptional({ type: String, example: "admin.privacy.requests", nullable: true })
  featureFlag?: string;
}

export class DeadLetterEntryOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000201" })
  id!: string;

  @ApiProperty({ type: String, example: "content_import_error" })
  source!: string;

  @ApiPropertyOptional({ type: String, example: "content.import", nullable: true })
  queueName?: string | null;

  @ApiPropertyOptional({ type: String, example: "content_import_error:err-1", nullable: true })
  eventType?: string | null;

  @ApiProperty({ type: String, example: "open" })
  status!: string;

  @ApiPropertyOptional({ type: String, example: "2026-04-29T10:00:00.000Z", nullable: true })
  resolvedAt?: string | null;
}

export class ImportStagingBatchOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000101" })
  id!: string;

  @ApiProperty({ type: String, example: "javi" })
  sourceType!: string;

  @ApiProperty({ type: String, example: "archive/phase-00-data-import/json" })
  sourceDir!: string;
}

export class ImportStagingRawItemOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000102" })
  id!: string;

  @ApiProperty({ type: String, example: "lexemes.json" })
  sourceFile!: string;

  @ApiProperty({ type: String, example: "lexeme:1" })
  sourceKey!: string;

  @ApiProperty({ type: String, example: "pending" })
  validationState!: string;
}

export class ImportStagingErrorOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000103" })
  id!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000101" })
  importBatchId!: string;

  @ApiPropertyOptional({ type: String, example: "00000000-0000-4000-8000-000000000102", nullable: true })
  rawItemId?: string | null;

  @ApiPropertyOptional({ type: String, example: "lexemes.json", nullable: true })
  sourceFile?: string | null;

  @ApiPropertyOptional({ type: String, example: "lexeme:1", nullable: true })
  sourceKey?: string | null;

  @ApiProperty({ type: String, example: "validate" })
  phase!: string;

  @ApiProperty({ type: String, example: "error" })
  severity!: string;

  @ApiProperty({ type: String, example: "missing_translation" })
  code!: string;

  @ApiProperty({ type: String, example: "translationVi is required" })
  message!: string;

  @ApiPropertyOptional({ type: () => ImportStagingBatchOpenApiDto, nullable: true })
  batch?: ImportStagingBatchOpenApiDto;

  @ApiPropertyOptional({ type: () => ImportStagingRawItemOpenApiDto, nullable: true })
  rawItem?: ImportStagingRawItemOpenApiDto | null;
}

export class SearchRebuildSummaryOpenApiDto {
  @ApiProperty({ type: Number, example: 12450 })
  indexed!: number;

  @ApiProperty({ type: String, example: "PostgreSQL" })
  sourceSystem!: string;

  @ApiProperty({ type: String, example: "2026-04-29T16:00:00.000Z" })
  timestamp!: string;
}

export class MediaRightsMetadataUpdateRequestOpenApiDto {
  @ApiProperty({ type: String, example: "CC-BY-4.0" })
  license!: string;

  @ApiPropertyOptional({ type: String, example: "https://example.com/source-image", nullable: true })
  sourceUrl?: string | null;

  @ApiPropertyOptional({
    type: Object,
    example: {
      sourceName: "Internal glossary",
      creatorName: "Nihongo BJT Team",
      licenseEvidenceUrl: "https://example.com/license-evidence"
    }
  })
  provenance?: {
    capturedAt?: string;
    creatorName?: string;
    isAiGenerated?: boolean;
    licenseEvidenceUrl?: string;
    sourceName?: string;
  };

  @ApiPropertyOptional({
    type: Object,
    example: {
      altText: "Tax terminology chart for reading practice",
      caption: "Sample usage context for business communication",
      reducedMotionSafe: true
    }
  })
  accessibility?: {
    altText: string;
    caption?: string;
    reducedMotionSafe?: boolean;
    transcript?: string;
  };

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000001" })
  userId!: string;
}

export class MediaAssetRightsMetadataOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000301" })
  id!: string;

  @ApiProperty({ type: String, example: "local" })
  provider!: string;

  @ApiProperty({ type: String, example: "cleared" })
  rightsStatus!: string;

  @ApiProperty({ type: String, example: "CC-BY-4.0" })
  license!: string;

  @ApiPropertyOptional({ type: String, example: "https://example.com/source-image", nullable: true })
  sourceUrl?: string | null;

  @ApiPropertyOptional({
    type: Object,
    example: {
      sourceName: "Internal glossary",
      creatorName: "Nihongo BJT Team",
      licenseEvidenceUrl: "https://example.com/license-evidence"
    }
  })
  provenance?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    example: {
      altText: "Tax terminology chart for reading practice",
      caption: "Sample usage context for business communication",
      reducedMotionSafe: true
    }
  })
  accessibility?: Record<string, unknown> | null;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000001" })
  ownerUserId!: string;
}

export class SubmitReviewRequestOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000001" })
  userId!: string;

  @ApiProperty({ type: String, enum: ["again", "hard", "good", "easy"], example: "good" })
  rating!: "again" | "hard" | "good" | "easy";

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000401" })
  userFlashcardId!: string;

  @ApiPropertyOptional({ type: Number, example: 3500, minimum: 0, maximum: 3600000 })
  elapsedMs?: number;

  @ApiPropertyOptional({ type: String, example: "2026-04-29T10:00:00.000Z" })
  reviewedAt?: string;
}

export class ReviewRemediationLinkOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000777" })
  sourceId!: string;

  @ApiProperty({ type: String, enum: ["lexeme", "kanji", "grammar", "reading_assist"], example: "lexeme" })
  sourceType!: "lexeme" | "kanji" | "grammar" | "reading_assist";

  @ApiProperty({ type: String, enum: ["canonical_id", "opaque_ref"], example: "canonical_id" })
  sourceIdKind!: "canonical_id" | "opaque_ref";
}

export class ReviewRemediationPolicyOpenApiDto {
  @ApiProperty({ type: String, enum: ["after_answer"], example: "after_answer" })
  availability!: "after_answer";

  @ApiProperty({ type: String, example: "Remediation metadata is returned only after a review answer is submitted." })
  note!: string;
}

export class ReviewSubmitOutcomeOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000401" })
  userFlashcardId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000402" })
  reviewEventId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000403" })
  cardId!: string;

  @ApiProperty({ type: String, example: "review" })
  state!: string;

  @ApiProperty({ type: String, example: "2026-05-01T10:00:00.000Z" })
  dueAt!: string;

  @ApiProperty({ type: Number, example: 2 })
  intervalDays!: number;

  @ApiProperty({ type: Number, example: 2.5 })
  easeFactor!: number;

  @ApiProperty({ type: Number, example: 3 })
  repetitions!: number;

  @ApiProperty({ type: Number, example: 0 })
  lapses!: number;

  @ApiProperty({ type: String, enum: ["again", "hard", "good", "easy"], example: "good" })
  rating!: string;

  @ApiProperty({ type: String, example: "2026-04-29T10:00:00.000Z" })
  reviewedAt!: string;

  @ApiProperty({ type: String, example: "2026-04-29T09:00:00.000Z" })
  previousDueAt!: string;

  @ApiProperty({ type: String, example: "2026-05-01T10:00:00.000Z" })
  nextDueAt!: string;

  @ApiProperty({ type: () => ReviewRemediationLinkOpenApiDto })
  remediation!: ReviewRemediationLinkOpenApiDto;

  @ApiProperty({ type: () => ReviewRemediationPolicyOpenApiDto })
  remediationPolicy!: ReviewRemediationPolicyOpenApiDto;

  @ApiProperty({ type: Boolean, example: false, description: "Whether card was detected as leeched on this review" })
  leechDetected!: boolean;

  @ApiProperty({ type: Boolean, example: false, description: "Whether card is currently in leeched state (detected at >=8 lapses)" })
  leeched!: boolean;

  @ApiProperty({ type: Boolean, example: false, description: "Whether card is currently in comeback recovery mode" })
  comebackMode!: boolean;
}

export class QuizRemediationCardOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000901" })
  id!: string;

  @ApiProperty({ type: String, example: "請求書" })
  frontText!: string;

  @ApiProperty({ type: String, example: "invoice" })
  backText!: string;

  @ApiPropertyOptional({ type: String, example: "せいきゅうしょ", nullable: true })
  reading?: string | null;

  @ApiProperty({ type: String, enum: ["lexeme", "kanji", "grammar", "reading_assist"], example: "lexeme" })
  sourceType!: "lexeme" | "kanji" | "grammar" | "reading_assist";

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000902" })
  sourceId!: string;
}

export class QuizSessionRemediationItemOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000903" })
  questionId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000901" })
  remediationCardId!: string;

  @ApiProperty({ type: () => QuizRemediationCardOpenApiDto })
  card!: QuizRemediationCardOpenApiDto;
}

export class DueFlashcardMediaOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000501" })
  assetId!: string;

  @ApiProperty({ type: String, example: "image/jpeg" })
  mimeType!: string;

  @ApiPropertyOptional({ type: String, example: "https://cdn.example.com/path/to/image", nullable: true })
  readUrl?: string | null;
}

export class DueFlashcardDetailOpenApiDto {
  @ApiProperty({ type: String, example: "front text" })
  frontText!: string;

  @ApiProperty({ type: String, example: "back text" })
  backText!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000502" })
  id!: string;

  @ApiPropertyOptional({ type: String, example: "ふりがな", nullable: true })
  reading?: string | null;
}

export class DueFlashcardOpenApiDto {
  @ApiProperty({ type: () => DueFlashcardDetailOpenApiDto })
  card!: DueFlashcardDetailOpenApiDto;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000503" })
  cardId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000504" })
  id!: string;

  @ApiProperty({ type: Boolean, example: false, description: "Whether card is currently in leeched state (detected at >=8 lapses)" })
  leeched!: boolean;

  @ApiProperty({ type: Boolean, example: false, description: "Whether card is currently in comeback recovery mode" })
  comebackMode!: boolean;

  @ApiPropertyOptional({ type: () => DueFlashcardMediaOpenApiDto, nullable: true })
  primaryImage?: DueFlashcardMediaOpenApiDto | null;

  @ApiProperty({ type: String, example: "new", enum: ["new", "learning", "review", "lapsed"] })
  state!: string;
}

export class BjtQuestionQualityValidationOpenApiDto {
  @ApiProperty({ type: Boolean, example: false })
  isValid!: boolean;

  @ApiProperty({ type: [String], example: ["No correct option found"] })
  issues!: string[];
}

export class BjtQuestionQualityFlagOpenApiDto {
  @ApiPropertyOptional({ type: Boolean, example: true, nullable: true })
  low_accuracy?: boolean | null;

  @ApiPropertyOptional({ type: Boolean, example: false, nullable: true })
  high_confusion?: boolean | null;

  @ApiPropertyOptional({ type: String, example: "thanhnv", nullable: true })
  owner?: string | null;

  @ApiPropertyOptional({ type: String, example: "2026-04-28T10:30:00Z", nullable: true })
  reviewed_at?: string | null;
}

export class BjtQuestionQualityIssueOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000905" })
  questionId!: string;

  @ApiProperty({ type: String, example: "listening" })
  skillTag!: string;

  @ApiProperty({ type: () => BjtQuestionQualityValidationOpenApiDto })
  validation!: BjtQuestionQualityValidationOpenApiDto;

  @ApiPropertyOptional({ type: () => BjtQuestionQualityFlagOpenApiDto, nullable: true })
  qualityFlags?: BjtQuestionQualityFlagOpenApiDto | null;
}

export class QuizBreakdownQuestionOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000906" })
  questionId!: string;

  @ApiProperty({ type: String, example: "What is the correct reading of 請求書?" })
  prompt!: string;

  @ApiProperty({ type: String, example: "A", enum: ["A", "B", "C", "D"] })
  selectedOption!: string;

  @ApiProperty({ type: Boolean, example: true })
  isCorrect!: boolean;

  @ApiProperty({ type: String, example: "請求書 is a noun meaning invoice." })
  explanationVi!: string;

  @ApiPropertyOptional({ type: String, example: "00000000-0000-4000-8000-000000000901", nullable: true })
  remediationCardId?: string | null;
}

export class QuizSessionBreakdownOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000801" })
  sessionId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000701" })
  testId!: string;

  @ApiProperty({ type: String, example: "BJT N2 Mock Test 2026-04" })
  testTitleVi!: string;

  @ApiPropertyOptional({ type: String, example: "BJT N2 模擬試験 2026-04", nullable: true })
  testTitleJa?: string | null;

  @ApiPropertyOptional({ type: Number, example: 78, nullable: true })
  estimatedScore?: number | null;

  @ApiPropertyOptional({ type: String, example: "N2", nullable: true })
  estimatedBjtBand?: string | null;

  @ApiProperty({ type: [QuizBreakdownQuestionOpenApiDto] })
  breakdown!: QuizBreakdownQuestionOpenApiDto[];
}
