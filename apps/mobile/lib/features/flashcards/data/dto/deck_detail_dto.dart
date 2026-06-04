import 'package:json_annotation/json_annotation.dart';

part 'deck_detail_dto.g.dart';

/// Wire model for `GET /api/decks/:id`.
///
/// Only the fields the mobile detail view needs are declared; json_serializable
/// ignores the rest of the (larger) server payload.
@JsonSerializable(createToJson: false)
class DeckDetailDto {
  const DeckDetailDto({
    required this.id,
    required this.titleVi,
    required this.cards,
    this.titleJa,
    this.descriptionVi,
    this.descriptionJa,
    this.visibility,
  });

  factory DeckDetailDto.fromJson(Map<String, dynamic> json) =>
      _$DeckDetailDtoFromJson(json);

  final String id;
  final String titleVi;
  final String? titleJa;
  final String? descriptionVi;
  final String? descriptionJa;

  /// Deck visibility (`private` | `public`); null treated as private.
  final String? visibility;

  /// Ordered `deck_card` rows.
  final List<DeckCardRowDto> cards;
}

/// One `deck_card` row from the detail payload.
@JsonSerializable(createToJson: false)
class DeckCardRowDto {
  const DeckCardRowDto({
    required this.id,
    required this.cardId,
    required this.position,
    required this.card,
    this.primaryImage,
    this.primaryAudio,
  });

  factory DeckCardRowDto.fromJson(Map<String, dynamic> json) =>
      _$DeckCardRowDtoFromJson(json);

  /// `deck_card` link id.
  final String id;

  /// Shared `card` id.
  final String cardId;

  final int position;

  final DeckCardContentDto card;

  final DeckCardMediaDto? primaryImage;
  final DeckCardMediaDto? primaryAudio;
}

/// Card content nested inside a `deck_card` row.
@JsonSerializable(createToJson: false)
class DeckCardContentDto {
  const DeckCardContentDto({
    required this.frontText,
    required this.backText,
    this.reading,
  });

  factory DeckCardContentDto.fromJson(Map<String, dynamic> json) =>
      _$DeckCardContentDtoFromJson(json);

  final String frontText;
  final String backText;
  final String? reading;
}

/// Resolved media reference (image/audio) for a card.
@JsonSerializable(createToJson: false)
class DeckCardMediaDto {
  const DeckCardMediaDto({this.readUrl});

  factory DeckCardMediaDto.fromJson(Map<String, dynamic> json) =>
      _$DeckCardMediaDtoFromJson(json);

  final String? readUrl;
}
