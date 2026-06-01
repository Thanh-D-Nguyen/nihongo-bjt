import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_deck_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_review_item_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_dto_mapper.dart';

void main() {
  group('FlashcardDeckDto.toDomain', () {
    test('prefers the Japanese title and maps the card count', () {
      final dto = FlashcardDeckDto.fromJson(const {
        'id': 'deck-1',
        'titleVi': 'Từ vựng BJT J2',
        'titleJa': 'BJT 語彙 J2',
        'descriptionVi': 'Bộ thẻ luyện BJT band J2.',
        '_count': {'cards': 24},
      });

      final deck = dto.toDomain();

      expect(deck.id, 'deck-1');
      expect(deck.title, 'BJT 語彙 J2');
      expect(deck.description, 'Bộ thẻ luyện BJT band J2.');
      expect(deck.cardCount, 24);
    });

    test('falls back to the Vietnamese title when titleJa is null/blank', () {
      final dto = FlashcardDeckDto.fromJson(const {
        'id': 'deck-2',
        'titleVi': 'Từ vựng cơ bản',
        'titleJa': '   ',
        '_count': {'cards': 5},
      });

      final deck = dto.toDomain();

      expect(deck.title, 'Từ vựng cơ bản');
      // descriptionVi absent → empty string, never null.
      expect(deck.description, '');
    });
  });

  group('FlashcardReviewItemDto.toDomain', () {
    test('maps card content and uses the stable card id', () {
      final dto = FlashcardReviewItemDto.fromJson(const {
        'id': 'user-flashcard-100',
        'cardId': 'card-10',
        'card': {
          'id': 'card-10',
          'frontText': '出張',
          'backText': 'chuyến công tác',
          'reading': 'しゅっちょう',
        },
        'state': 'review',
        'comebackMode': false,
        'leeched': false,
        'examples': <Object?>[],
      });

      final card = dto.toDomain();

      expect(card.id, 'card-10');
      // The per-learner review row id is carried for SRS grade submission.
      expect(card.userFlashcardId, 'user-flashcard-100');
      expect(card.front, '出張');
      expect(card.reading, 'しゅっちょう');
      expect(card.back, 'chuyến công tác');
    });

    test('uses an empty reading when the card has none', () {
      final dto = FlashcardReviewItemDto.fromJson(const {
        'id': 'user-flashcard-101',
        'cardId': 'card-11',
        'card': {
          'id': 'card-11',
          'frontText': '会議',
          'backText': 'cuộc họp',
        },
        'state': 'new',
        'comebackMode': false,
        'leeched': false,
        'examples': <Object?>[],
      });

      expect(dto.toDomain().reading, '');
    });
  });
}
