// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flashcard_deck_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FlashcardDeckDto _$FlashcardDeckDtoFromJson(Map<String, dynamic> json) =>
    FlashcardDeckDto(
      id: json['id'] as String,
      titleVi: json['titleVi'] as String,
      count: FlashcardDeckCountDto.fromJson(
        json['_count'] as Map<String, dynamic>,
      ),
      titleJa: json['titleJa'] as String?,
      descriptionVi: json['descriptionVi'] as String?,
      descriptionJa: json['descriptionJa'] as String?,
      visibility: json['visibility'] as String?,
    );

FlashcardDeckCountDto _$FlashcardDeckCountDtoFromJson(
  Map<String, dynamic> json,
) => FlashcardDeckCountDto(cards: (json['cards'] as num).toInt());
