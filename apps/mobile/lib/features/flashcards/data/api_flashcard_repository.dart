import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_exception.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_deck_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_review_item_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_dto_mapper.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Failure surfaced by [ApiFlashcardRepository] with learner-facing, non-fake
/// messaging. The underlying [cause] (an [ApiException]) is kept for logs.
class FlashcardRepositoryException implements Exception {
  const FlashcardRepositoryException(this.message, {this.cause});

  /// Clear, user-displayable message (Vietnamese UI copy).
  final String message;

  /// Originating error for diagnostics. Never contains auth tokens.
  final Object? cause;

  @override
  String toString() => 'FlashcardRepositoryException: $message';
}

/// API-backed [FlashcardRepository].
///
/// Talks to the real KotobaWorks flashcard/SRS endpoints through [ApiClient].
/// Authentication is enforced server-side: the [ApiClient] attaches the bearer
/// token (Phase 4 seam) when a valid session exists. When the learner is not
/// authenticated the server returns 401/403, which is mapped to a clear error —
/// the repository never fabricates cards.
class ApiFlashcardRepository implements FlashcardRepository {
  const ApiFlashcardRepository(this._client);

  final ApiClient _client;

  static const String _decksPath = '/api/flashcards/decks';

  /// The contract exposes the due-review queue globally (no deck filter on
  /// `GET /api/flashcards/reviews/due`), so a deck review session uses the
  /// learner's due cards.
  static const String _dueReviewsPath = '/api/flashcards/reviews/due';

  /// `POST /api/flashcards/reviews/{userFlashcardId}` — the learner is resolved
  /// server-side from the bearer token, so only the grade is sent.
  static const String _reviewsPath = '/api/flashcards/reviews';

  @override
  Future<List<FlashcardDeck>> fetchDecks() async {
    final json = await _guard(() => _client.getJson(_decksPath));
    return _asList(
      json,
    ).map((e) => FlashcardDeckDto.fromJson(_asMap(e)).toDomain()).toList();
  }

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async {
    // `deckId` is accepted to satisfy the repository contract, but the current
    // OpenAPI due-reviews endpoint is not deck-scoped; it returns the learner's
    // global due queue. Per-deck filtering is a future server capability.
    final json = await _guard(() => _client.getJson(_dueReviewsPath));
    return _asList(json)
        .map((e) => FlashcardReviewItemDto.fromJson(_asMap(e)).toDomain())
        .toList();
  }

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    // `userId` is intentionally omitted: the server derives the learner from
    // the verified bearer token and rejects mismatched ids. Only the grade is
    // sent. `SrsRating.name` matches the contract enum (again|hard|good|easy).
    await _guard(
      () => _client.postJson(
        '$_reviewsPath/$userFlashcardId',
        body: {'rating': rating.name},
      ),
    );
  }

  /// Runs an [ApiClient] call and normalizes failures to a clear,
  /// learner-facing [FlashcardRepositoryException].
  Future<Object?> _guard(Future<Object?> Function() request) async {
    try {
      return await request();
    } on HttpApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        throw FlashcardRepositoryException(
          'Bạn cần đăng nhập để đồng bộ thẻ học.',
          cause: error,
        );
      }
      throw FlashcardRepositoryException(
        'Không tải được thẻ học (mã ${error.statusCode}).',
        cause: error,
      );
    } on NetworkApiException catch (error) {
      throw FlashcardRepositoryException(
        'Không kết nối được tới máy chủ. Vui lòng thử lại.',
        cause: error,
      );
    }
  }

  List<Object?> _asList(Object? json) {
    if (json is List) return json;
    throw const FlashcardRepositoryException(
      'Phản hồi từ máy chủ không hợp lệ.',
    );
  }

  Map<String, dynamic> _asMap(Object? json) {
    if (json is Map<String, dynamic>) return json;
    throw const FlashcardRepositoryException(
      'Bản ghi từ máy chủ không hợp lệ.',
    );
  }
}
