// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flashcard_review_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FlashcardReviewItemDto _$FlashcardReviewItemDtoFromJson(
  Map<String, dynamic> json,
) => FlashcardReviewItemDto(
  id: json['id'] as String,
  cardId: json['cardId'] as String,
  card: FlashcardReviewCardCoreDto.fromJson(
    json['card'] as Map<String, dynamic>,
  ),
);

FlashcardReviewCardCoreDto _$FlashcardReviewCardCoreDtoFromJson(
  Map<String, dynamic> json,
) => FlashcardReviewCardCoreDto(
  id: json['id'] as String,
  frontText: json['frontText'] as String,
  backText: json['backText'] as String,
  reading: json['reading'] as String?,
);
