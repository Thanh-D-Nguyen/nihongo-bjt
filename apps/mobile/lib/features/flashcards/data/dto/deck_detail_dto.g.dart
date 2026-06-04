// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'deck_detail_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeckDetailDto _$DeckDetailDtoFromJson(Map<String, dynamic> json) =>
    DeckDetailDto(
      id: json['id'] as String,
      titleVi: json['titleVi'] as String,
      cards: (json['cards'] as List<dynamic>)
          .map((e) => DeckCardRowDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      titleJa: json['titleJa'] as String?,
      descriptionVi: json['descriptionVi'] as String?,
      descriptionJa: json['descriptionJa'] as String?,
      visibility: json['visibility'] as String?,
    );

DeckCardRowDto _$DeckCardRowDtoFromJson(
  Map<String, dynamic> json,
) => DeckCardRowDto(
  id: json['id'] as String,
  cardId: json['cardId'] as String,
  position: (json['position'] as num).toInt(),
  card: DeckCardContentDto.fromJson(json['card'] as Map<String, dynamic>),
  primaryImage: json['primaryImage'] == null
      ? null
      : DeckCardMediaDto.fromJson(json['primaryImage'] as Map<String, dynamic>),
  primaryAudio: json['primaryAudio'] == null
      ? null
      : DeckCardMediaDto.fromJson(json['primaryAudio'] as Map<String, dynamic>),
);

DeckCardContentDto _$DeckCardContentDtoFromJson(Map<String, dynamic> json) =>
    DeckCardContentDto(
      frontText: json['frontText'] as String,
      backText: json['backText'] as String,
      reading: json['reading'] as String?,
    );

DeckCardMediaDto _$DeckCardMediaDtoFromJson(Map<String, dynamic> json) =>
    DeckCardMediaDto(readUrl: json['readUrl'] as String?);
