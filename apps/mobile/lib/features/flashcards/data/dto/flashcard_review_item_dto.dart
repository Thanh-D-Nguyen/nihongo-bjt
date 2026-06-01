import 'package:json_annotation/json_annotation.dart';

part 'flashcard_review_item_dto.g.dart';

/// Wire model for `FlashcardReviewItemOpenApiDto`
/// (`GET /api/flashcards/reviews/due`).
///
/// Only the fields the review session renders are modelled. `fromJson` is
/// generated (`*.g.dart`) and committed — never hand-edit the generated file.
@JsonSerializable(createToJson: false)
class FlashcardReviewItemDto {
  const FlashcardReviewItemDto({
    required this.id,
    required this.cardId,
    required this.card,
  });

  factory FlashcardReviewItemDto.fromJson(Map<String, dynamic> json) =>
      _$FlashcardReviewItemDtoFromJson(json);

  /// `userFlashcard` id (the per-learner review row).
  final String id;

  /// Underlying card id (stable card identity).
  final String cardId;

  /// Card content shown to the learner.
  final FlashcardReviewCardCoreDto card;
}

/// Wire model for `FlashcardReviewCardCoreOpenApiDto`.
@JsonSerializable(createToJson: false)
class FlashcardReviewCardCoreDto {
  const FlashcardReviewCardCoreDto({
    required this.id,
    required this.frontText,
    required this.backText,
    this.reading,
  });

  factory FlashcardReviewCardCoreDto.fromJson(Map<String, dynamic> json) =>
      _$FlashcardReviewCardCoreDtoFromJson(json);

  final String id;

  /// Japanese prompt shown first (e.g. `出張`).
  final String frontText;

  /// Meaning revealed after answering (e.g. `chuyến công tác`).
  final String backText;

  /// Kana reading of [frontText]; null when unavailable.
  final String? reading;
}
