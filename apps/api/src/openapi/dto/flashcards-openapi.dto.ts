import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * OpenAPI response/request contracts for the learner-facing Flashcard/SRS endpoints.
 *
 * These classes mirror the runtime shapes produced by `FlashcardsRepository`/`FlashcardsService`
 * (verified against the Prisma models and service mappers). They exist only to make the generated
 * `openapi.json` type-safe for downstream clients; they are never instantiated at runtime.
 *
 * Endpoint map (real controller routes — note these differ from earlier proposed names):
 *  - `GET  /api/flashcards/decks`                  -> [FlashcardDeckOpenApiDto]
 *  - `GET  /api/flashcards/reviews/due`            -> [FlashcardReviewItemOpenApiDto]
 *  - `POST /api/flashcards/reviews/:userFlashcardId` (body SubmitFlashcardReviewRequestOpenApiDto)
 *                                                  -> SubmitFlashcardReviewResponseOpenApiDto
 *  - `POST /api/flashcards/reviews/batch` (body SubmitFlashcardReviewBatchRequestOpenApiDto)
 *                                                  -> SubmitFlashcardReviewBatchResponseOpenApiDto
 */

const SRS_RATINGS = ["again", "hard", "good", "easy"] as const;

// ─── GET /flashcards/decks ───────────────────────────────────────────

export class FlashcardDeckCountOpenApiDto {
  @ApiProperty({ type: Number, example: 24, description: "Number of cards linked to the deck." })
  cards!: number;
}

export class FlashcardDeckOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000001" })
  id!: string;

  @ApiPropertyOptional({
    type: String,
    example: "00000000-0000-4000-8000-0000000000aa",
    nullable: true,
    description: "Owner learner id; null for system/public decks."
  })
  ownerUserId?: string | null;

  @ApiProperty({ type: String, example: "Từ vựng BJT J2" })
  titleVi!: string;

  @ApiPropertyOptional({ type: String, example: "BJT 語彙 J2", nullable: true })
  titleJa?: string | null;

  @ApiPropertyOptional({ type: String, example: "Bộ thẻ luyện BJT band J2.", nullable: true })
  descriptionVi?: string | null;

  @ApiPropertyOptional({ type: String, example: "J2 帯の練習デッキ。", nullable: true })
  descriptionJa?: string | null;

  @ApiProperty({ type: String, example: "private", enum: ["private", "public"] })
  visibility!: string;

  @ApiProperty({ type: String, example: "active", enum: ["active", "archived"] })
  status!: string;

  @ApiPropertyOptional({ type: String, example: "s_8f3a1c", nullable: true })
  shareToken?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "00000000-0000-4000-8000-000000000002",
    nullable: true,
    description: "Original deck id when this deck was cloned from a shared deck."
  })
  sourceDeckId?: string | null;

  @ApiProperty({ type: Number, example: 0, description: "How many times this deck has been cloned." })
  cloneCount!: number;

  @ApiProperty({ type: String, example: "2026-05-01T08:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ type: String, example: "2026-05-02T09:30:00.000Z" })
  updatedAt!: string;

  @ApiProperty({ type: () => FlashcardDeckCountOpenApiDto })
  _count!: FlashcardDeckCountOpenApiDto;
}

// ─── GET /flashcards/reviews/due ─────────────────────────────────────

export class FlashcardReviewCardCoreOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000010" })
  id!: string;

  @ApiProperty({ type: String, example: "出張" })
  frontText!: string;

  @ApiProperty({ type: String, example: "chuyến công tác" })
  backText!: string;

  @ApiPropertyOptional({ type: String, example: "しゅっちょう", nullable: true })
  reading?: string | null;
}

export class FlashcardMediaRefOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000050" })
  assetId!: string;

  @ApiProperty({ type: String, example: "image/webp" })
  mimeType!: string;

  @ApiPropertyOptional({
    type: String,
    example: "https://cdn.example.com/assets/abc.webp",
    nullable: true,
    description: "Time-limited presigned read URL (or external URL); null when unresolved."
  })
  readUrl?: string | null;
}

export class FlashcardReviewExampleOpenApiDto {
  @ApiProperty({ type: String, example: "来週、大阪へ出張します。" })
  japaneseText!: string;

  @ApiProperty({ type: String, example: "らいしゅう、おおさかへしゅっちょうします。" })
  reading!: string;

  @ApiProperty({ type: String, example: "Tuần sau tôi sẽ đi công tác Osaka." })
  translationVi!: string;
}

export class FlashcardReviewItemOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000100", description: "userFlashcard id." })
  id!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000010", description: "Underlying card id." })
  cardId!: string;

  @ApiProperty({ type: () => FlashcardReviewCardCoreOpenApiDto })
  card!: FlashcardReviewCardCoreOpenApiDto;

  @ApiProperty({ type: String, example: "review", enum: ["new", "learning", "review", "lapsed"] })
  state!: string;

  @ApiProperty({ type: Boolean, example: false, description: "Card is in comeback (re-onboarding) mode." })
  comebackMode!: boolean;

  @ApiProperty({ type: Boolean, example: false, description: "Card flagged as leech (repeatedly failed)." })
  leeched!: boolean;

  @ApiProperty({ type: [FlashcardReviewExampleOpenApiDto], description: "Context examples (may be empty)." })
  examples!: FlashcardReviewExampleOpenApiDto[];

  @ApiPropertyOptional({ type: () => FlashcardMediaRefOpenApiDto, nullable: true })
  primaryImage?: FlashcardMediaRefOpenApiDto | null;

  @ApiPropertyOptional({ type: () => FlashcardMediaRefOpenApiDto, nullable: true })
  primaryAudio?: FlashcardMediaRefOpenApiDto | null;
}

// ─── POST /flashcards/reviews/:userFlashcardId ───────────────────────

export class SubmitFlashcardReviewRequestOpenApiDto {
  @ApiProperty({ type: String, enum: SRS_RATINGS, example: "good" })
  rating!: (typeof SRS_RATINGS)[number];

  @ApiProperty({ type: String, format: "uuid", example: "00000000-0000-4000-8000-0000000000aa" })
  userId!: string;

  @ApiPropertyOptional({ type: Number, example: 4200, description: "Answer latency in ms (0..3_600_000)." })
  elapsedMs?: number;

  @ApiPropertyOptional({ type: String, example: "2026-05-02T09:30:00.000Z", description: "ISO datetime of review." })
  reviewedAt?: string;
}

export class FlashcardReviewRemediationOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000010" })
  sourceId!: string;

  @ApiProperty({ type: String, enum: ["canonical_id", "opaque_ref"], example: "canonical_id" })
  sourceIdKind!: string;

  @ApiProperty({ type: String, example: "lexeme" })
  sourceType!: string;
}

export class FlashcardReviewRemediationPolicyOpenApiDto {
  @ApiProperty({ type: String, enum: ["after_answer"], example: "after_answer" })
  availability!: string;

  @ApiProperty({
    type: String,
    example: "Remediation metadata is returned only after a review answer is submitted."
  })
  note!: string;
}

export class SubmitFlashcardReviewResponseOpenApiDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000100", description: "userFlashcard id." })
  userFlashcardId!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000010" })
  cardId!: string;

  @ApiProperty({ type: String, example: "review", enum: ["new", "learning", "review", "lapsed"] })
  state!: string;

  @ApiProperty({ type: String, enum: SRS_RATINGS, example: "good" })
  rating!: string;

  @ApiProperty({ type: String, example: "2026-05-05T09:30:00.000Z", description: "New due datetime." })
  dueAt!: string;

  @ApiProperty({ type: String, example: "2026-05-02T09:30:00.000Z" })
  previousDueAt!: string;

  @ApiProperty({ type: String, example: "2026-05-05T09:30:00.000Z" })
  nextDueAt!: string;

  @ApiProperty({ type: Number, example: 2.5 })
  easeFactor!: number;

  @ApiProperty({ type: Number, example: 3 })
  intervalDays!: number;

  @ApiProperty({ type: Number, example: 4 })
  repetitions!: number;

  @ApiProperty({ type: Number, example: 0 })
  lapses!: number;

  @ApiProperty({ type: Boolean, example: false, description: "Card became a leech on this review." })
  leechDetected!: boolean;

  @ApiProperty({ type: Boolean, example: false })
  leeched!: boolean;

  @ApiProperty({ type: Boolean, example: false })
  comebackMode!: boolean;

  @ApiProperty({ type: String, example: "2026-05-02T09:30:00.000Z" })
  reviewedAt!: string;

  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000200" })
  reviewEventId!: string;

  @ApiProperty({ type: () => FlashcardReviewRemediationOpenApiDto })
  remediation!: FlashcardReviewRemediationOpenApiDto;

  @ApiProperty({ type: () => FlashcardReviewRemediationPolicyOpenApiDto })
  remediationPolicy!: FlashcardReviewRemediationPolicyOpenApiDto;
}

// ─── POST /flashcards/reviews/batch ──────────────────────────────────

export class ReviewBatchItemRequestOpenApiDto {
  @ApiProperty({ type: String, example: "m_001", description: "Client-supplied id to reconcile partial success." })
  clientMutationId!: string;

  @ApiProperty({ type: String, format: "uuid", example: "00000000-0000-4000-8000-000000000100" })
  userFlashcardId!: string;

  @ApiProperty({ type: String, enum: SRS_RATINGS, example: "good" })
  rating!: (typeof SRS_RATINGS)[number];

  @ApiPropertyOptional({ type: Number, example: 4200 })
  elapsedMs?: number;

  @ApiPropertyOptional({ type: String, example: "2026-05-02T09:30:00.000Z" })
  reviewedAt?: string;
}

export class SubmitFlashcardReviewBatchRequestOpenApiDto {
  @ApiProperty({ type: [ReviewBatchItemRequestOpenApiDto], description: "1..50 review items." })
  items!: ReviewBatchItemRequestOpenApiDto[];

  @ApiProperty({ type: String, format: "uuid", example: "00000000-0000-4000-8000-0000000000aa" })
  userId!: string;
}

export class FlashcardReviewBatchResultOpenApiDto {
  @ApiProperty({ type: String, example: "m_001" })
  clientMutationId!: string;

  @ApiProperty({ type: Boolean, example: true, description: "Whether this item persisted successfully." })
  ok!: boolean;

  @ApiPropertyOptional({
    type: String,
    example: "quota_exceeded",
    nullable: true,
    description: "Present only when ok is false."
  })
  error?: string | null;
}

export class SubmitFlashcardReviewBatchResponseOpenApiDto {
  @ApiProperty({ type: [FlashcardReviewBatchResultOpenApiDto], description: "Per-item outcome, order preserved." })
  results!: FlashcardReviewBatchResultOpenApiDto[];
}
