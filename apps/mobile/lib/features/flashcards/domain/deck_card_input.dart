import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';

/// Validated, normalized payload for one card inside a deck's full-set save.
///
/// The backend replaces a deck's entire card set on `PATCH` when `cards` is
/// present (`updateDeckSchema` → `bulkDeckCardRowSchema`), so card add / edit /
/// delete are all expressed as the COMPLETE list. Each row may carry the
/// existing [cardId] / [deckCardId] so the server can preserve the shared card
/// and the learner's SRS row where possible.
///
/// Construct via [DeckCardInput.fromRaw] (trims, collapses blank optionals to
/// `null`) or [DeckCardInput.fromDeckCard] (re-materialize an existing card for
/// a full-set resend). Only build from input that has passed
/// [DeckCardFormValidator].
class DeckCardInput {
  const DeckCardInput({
    required this.frontText,
    required this.backText,
    this.reading,
    this.imageUrl,
    this.cardId,
    this.deckCardId,
  });

  /// Builds a normalized input from raw form text.
  factory DeckCardInput.fromRaw({
    required String frontText,
    required String backText,
    required String reading,
    String? imageUrl,
    String? cardId,
    String? deckCardId,
  }) {
    String? optional(String? value) {
      final trimmed = value?.trim() ?? '';
      return trimmed.isEmpty ? null : trimmed;
    }

    return DeckCardInput(
      frontText: frontText.trim(),
      backText: backText.trim(),
      reading: optional(reading),
      imageUrl: optional(imageUrl),
      cardId: cardId,
      deckCardId: deckCardId,
    );
  }

  /// Re-materializes an existing [DeckCard] for inclusion in a full-set resend.
  factory DeckCardInput.fromDeckCard(DeckCard card) {
    final reading = card.reading.trim();
    final imageUrl = card.imageUrl?.trim();
    return DeckCardInput(
      frontText: card.frontText.trim(),
      backText: card.backText.trim(),
      reading: reading.isEmpty ? null : reading,
      imageUrl: (imageUrl == null || imageUrl.isEmpty) ? null : imageUrl,
      cardId: card.cardId,
      deckCardId: card.deckCardId,
    );
  }

  /// Front side — Japanese term, required, 1..[DeckCardLimits.frontMaxLength].
  final String frontText;

  /// Back side — Vietnamese meaning, required,
  /// 1..[DeckCardLimits.backMaxLength].
  final String backText;

  /// Optional reading (furigana / kana), up to
  /// [DeckCardLimits.readingMaxLength].
  final String? reading;

  /// Optional http(s) image URL for the card.
  final String? imageUrl;

  /// Existing shared `card` id, when editing/resending an existing card.
  final String? cardId;

  /// Existing `deck_card` link id, when editing/resending an existing card.
  final String? deckCardId;

  /// JSON row for the deck update endpoint's `cards` array.
  ///
  /// Omits blank optionals and the identifiers when absent (a brand-new card),
  /// matching `updateDeckCardRowSchema`.
  Map<String, Object?> toRequestBody() {
    return <String, Object?>{
      'frontText': frontText,
      'backText': backText,
      if (reading != null) 'reading': reading,
      if (imageUrl != null) 'imageUrl': imageUrl,
      if (cardId != null) 'cardId': cardId,
      if (deckCardId != null) 'deckCardId': deckCardId,
    };
  }

  /// Returns a copy with the given fields replaced.
  DeckCardInput copyWith({
    String? frontText,
    String? backText,
    String? reading,
    String? imageUrl,
  }) {
    return DeckCardInput(
      frontText: frontText ?? this.frontText,
      backText: backText ?? this.backText,
      reading: reading ?? this.reading,
      imageUrl: imageUrl ?? this.imageUrl,
      cardId: cardId,
      deckCardId: deckCardId,
    );
  }
}

/// Length limits shared by the card form and validator, mirroring the backend
/// `bulkDeckCardRowSchema` exactly.
abstract final class DeckCardLimits {
  /// Max length of the front (Japanese) field (server: `max(500)`).
  static const int frontMaxLength = 500;

  /// Max length of the back (Vietnamese) field (server: `max(2000)`).
  static const int backMaxLength = 2000;

  /// Max length of the reading field (server: `max(300)`).
  static const int readingMaxLength = 300;

  /// Max number of cards in one deck (server: `array(...).max(200)`).
  static const int maxCards = 200;
}

/// Per-field validation errors for a card form. All `null` means valid.
class DeckCardFormErrors {
  const DeckCardFormErrors({this.frontText, this.backText, this.reading});

  final DeckFieldError? frontText;
  final DeckFieldError? backText;
  final DeckFieldError? reading;

  /// Whether the form passed every field rule.
  bool get isValid => frontText == null && backText == null && reading == null;
}

/// Pure validator mirroring the backend card row schema.
abstract final class DeckCardFormValidator {
  /// Validates raw card form text against the server's rules.
  static DeckCardFormErrors validate({
    required String frontText,
    required String backText,
    required String reading,
  }) {
    return DeckCardFormErrors(
      frontText: _required(frontText, DeckCardLimits.frontMaxLength),
      backText: _required(backText, DeckCardLimits.backMaxLength),
      reading: _optional(reading, DeckCardLimits.readingMaxLength),
    );
  }

  static DeckFieldError? _required(String value, int max) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return DeckFieldError.required;
    if (trimmed.length > max) return DeckFieldError.tooLong;
    return null;
  }

  static DeckFieldError? _optional(String value, int max) {
    final trimmed = value.trim();
    if (trimmed.length > max) return DeckFieldError.tooLong;
    return null;
  }
}
