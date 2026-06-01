import 'package:drift/drift.dart';

/// Drift table definitions for the offline flashcard cache + review queue.
///
/// The cache tables ([FlashcardDecks], [FlashcardReviewCards]) mirror the read
/// models the learner sees (Phase 6A). [FlashcardReviewQueue] (Phase 6B) holds
/// review grades that could not be submitted online, for later manual sync.
/// There is no background worker or SRS scheduling here.

/// Cached deck list rows (`GET /api/flashcards/decks`).
@DataClassName('FlashcardDeckRow')
class FlashcardDecks extends Table {
  /// Server deck id (primary key).
  TextColumn get id => text()();

  /// Display title (Japanese-first, already resolved by the mapper).
  TextColumn get title => text()();

  /// Vietnamese description; empty string when the deck has none.
  TextColumn get description => text()();

  /// Number of cards in the deck.
  IntColumn get cardCount => integer()();

  /// When this row was last written to the cache (UTC).
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// Cached due-review cards (`GET /api/flashcards/reviews/due`).
///
/// Keyed by `(deckId, userFlashcardId)`: the due queue is global server-side,
/// but the repository fetches it per review session, so the cache is scoped by
/// the requesting `deckId` to match the read contract.
@DataClassName('FlashcardReviewCardRow')
class FlashcardReviewCards extends Table {
  /// Deck id this snapshot was fetched for.
  TextColumn get deckId => text()();

  /// Per-learner review row id (`userFlashcard.id`), used to submit grades.
  TextColumn get userFlashcardId => text()();

  /// Underlying card id (stable display identity).
  TextColumn get cardId => text()();

  /// Japanese prompt shown first.
  TextColumn get front => text()();

  /// Kana reading; empty string when unavailable.
  TextColumn get reading => text()();

  /// Vietnamese meaning, revealed after answering.
  TextColumn get back => text()();

  /// When this row was last written to the cache (UTC).
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {deckId, userFlashcardId};
}

/// Pending SRS grades that failed to submit online, awaiting manual sync.
///
/// One row per review event. [idempotencyKey] is unique so re-enqueuing the
/// same logical event is ignored (no duplicates). It is stored locally for a
/// future server-enforced idempotency contract; the current submit endpoint
/// does not read it (see IMPLEMENTATION_LOG Phase 6B blocker).
@DataClassName('FlashcardReviewQueueRow')
class FlashcardReviewQueue extends Table {
  /// Local autoincrement id.
  IntColumn get id => integer().autoIncrement()();

  /// Per-learner review row id (`userFlashcard.id`) the grade applies to.
  TextColumn get userFlashcardId => text()();

  /// SRS grade, stored as the enum name (`again|hard|good|easy`).
  TextColumn get rating => text()();

  /// When the learner graded the card (UTC).
  DateTimeColumn get answeredAt => dateTime()();

  /// Locally generated idempotency key; unique to prevent duplicate enqueues.
  TextColumn get idempotencyKey => text().unique()();

  /// `pending` (needs sync) or `synced`.
  TextColumn get status => text().withDefault(const Constant('pending'))();

  /// Number of failed sync attempts (incremented by `markFailed`).
  IntColumn get attemptCount => integer().withDefault(const Constant(0))();

  /// Last sync error message; null until a sync attempt fails.
  TextColumn get lastError => text().nullable()();

  /// When this row was first enqueued (UTC).
  DateTimeColumn get createdAt => dateTime()();

  /// When this row was last updated (UTC).
  DateTimeColumn get updatedAt => dateTime()();
}
