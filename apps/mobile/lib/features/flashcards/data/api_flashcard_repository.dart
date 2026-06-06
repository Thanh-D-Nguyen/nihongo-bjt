import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_exception.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/deck_detail_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_deck_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_review_item_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_dto_mapper.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Failure surfaced by [ApiFlashcardRepository] with learner-facing, non-fake
/// messaging. The underlying [cause] (an [ApiException]) is kept for logs.
class FlashcardRepositoryException implements Exception {
  const FlashcardRepositoryException(
    this.message, {
    this.cause,
    this.isAuthRequired = false,
  });

  /// Clear, user-displayable message (Vietnamese UI copy).
  final String message;

  /// Originating error for diagnostics. Never contains auth tokens.
  final Object? cause;

  /// True when the server rejected the request because the learner must sign in
  /// again (HTTP 401/403).
  final bool isAuthRequired;

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

  /// `GET /api/decks/{id}` — canonical deck detail (metadata + ordered cards),
  /// scoped to the learner's own + public decks server-side.
  static const String _deckDetailBasePath = '/api/decks';

  /// `GET /api/flashcards/reviews/due` — the learner's due-review queue. The
  /// endpoint accepts an optional `deckId` query parameter to scope the queue
  /// to a single deck (validated by `flashcardsDueQuerySchema` server-side).
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
  Future<DeckDetail> fetchDeckDetail(String deckId) async {
    final json = await _guard(
      () => _client.getJson('$_deckDetailBasePath/$deckId'),
    );
    return DeckDetailDto.fromJson(_asMap(json)).toDomain();
  }

  @override
  Future<String> createDeck(DeckFormInput input) async {
    // `POST /api/flashcards/decks` — the server derives the learner from the
    // bearer token; only deck metadata is sent (no userId, no cards).
    final json = await _guard(
      () => _client.postJson(_decksPath, body: input.toRequestBody()),
    );
    final id = _asMap(json)['id'];
    if (id is! String || id.isEmpty) {
      throw const FlashcardRepositoryException(
        'Máy chủ không trả về mã bộ thẻ vừa tạo.',
      );
    }
    return id;
  }

  @override
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) async {
    // `POST /api/flashcards/decks` with the deck metadata plus the full `cards`
    // array (one-step create). The backend `createDeckSchema` accepts an
    // optional `cards` list (max 200), so the deck and its cards are created in
    // a single request. Cards are brand-new (no cardId/deckCardId).
    final json = await _guard(
      () => _client.postJson(
        _decksPath,
        body: <String, Object?>{
          ...meta.toRequestBody(),
          'cards': cards.map((c) => c.toRequestBody()).toList(),
        },
      ),
    );
    final id = _asMap(json)['id'];
    if (id is! String || id.isEmpty) {
      throw const FlashcardRepositoryException(
        'Máy chủ không trả về mã bộ thẻ vừa tạo.',
      );
    }
    return id;
  }

  @override
  Future<void> updateDeckMeta(String deckId, DeckFormInput input) async {
    // `PATCH /api/flashcards/decks/{id}` with metadata only (no `cards`), so the
    // deck's existing card set is left untouched.
    await _guard(
      () => _client.patchJson(
        '$_decksPath/$deckId',
        body: input.toRequestBody(),
      ),
    );
  }

  @override
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) async {
    // `PATCH /api/flashcards/decks/{id}` with the deck metadata plus the FULL
    // card set. The server replaces every card link when `cards` is present, so
    // the complete desired list is sent. `titleVi` is included because the
    // update schema validates it on every call.
    await _guard(
      () => _client.patchJson(
        '$_decksPath/$deckId',
        body: <String, Object?>{
          ...meta.toRequestBody(),
          'cards': cards.map((c) => c.toRequestBody()).toList(),
        },
      ),
    );
  }

  @override
  Future<void> archiveDeck(String deckId) async {
    // `POST /api/flashcards/decks/{id}/archive` (ApiClient has no DELETE); the
    // body is empty because the learner is resolved server-side.
    await _guard(
      () => _client.postJson(
        '$_decksPath/$deckId/archive',
        body: const <String, Object?>{},
      ),
    );
  }

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async {
    // Scope the due-review queue to this deck via the `deckId` query parameter
    // so a deck review session only surfaces that deck's due cards. A blank id
    // falls back to the learner's global queue.
    final trimmed = deckId.trim();
    final path = trimmed.isEmpty
        ? _dueReviewsPath
        : '$_dueReviewsPath?deckId=${Uri.encodeQueryComponent(trimmed)}';
    final json = await _guard(() => _client.getJson(path));
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
          isAuthRequired: true,
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
