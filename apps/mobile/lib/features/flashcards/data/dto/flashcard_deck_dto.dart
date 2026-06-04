import 'package:json_annotation/json_annotation.dart';

part 'flashcard_deck_dto.g.dart';

/// Wire model for `FlashcardDeckOpenApiDto` (`GET /api/flashcards/decks`).
///
/// Only the fields the mobile deck-list screen consumes are modelled; unknown
/// JSON keys are ignored. `fromJson` is generated (`*.g.dart`) and committed —
/// never hand-edit the generated file.
@JsonSerializable(createToJson: false)
class FlashcardDeckDto {
  const FlashcardDeckDto({
    required this.id,
    required this.titleVi,
    required this.count,
    this.titleJa,
    this.descriptionVi,
    this.descriptionJa,
    this.visibility,
  });

  factory FlashcardDeckDto.fromJson(Map<String, dynamic> json) =>
      _$FlashcardDeckDtoFromJson(json);

  final String id;

  /// Vietnamese deck title (always present per contract).
  final String titleVi;

  /// Japanese deck title; null for decks without a Japanese label.
  final String? titleJa;

  /// Vietnamese description; null when the deck has none.
  final String? descriptionVi;

  /// Japanese description; null when the deck has none.
  final String? descriptionJa;

  /// Deck visibility (`private` | `public`); null treated as private.
  final String? visibility;

  /// Aggregate counts; `cards` drives the list summary.
  @JsonKey(name: '_count')
  final FlashcardDeckCountDto count;
}

/// Wire model for `FlashcardDeckCountOpenApiDto`.
@JsonSerializable(createToJson: false)
class FlashcardDeckCountDto {
  const FlashcardDeckCountDto({required this.cards});

  factory FlashcardDeckCountDto.fromJson(Map<String, dynamic> json) =>
      _$FlashcardDeckCountDtoFromJson(json);

  /// Number of cards linked to the deck.
  final int cards;
}
