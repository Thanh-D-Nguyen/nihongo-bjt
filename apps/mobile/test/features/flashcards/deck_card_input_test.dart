import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';

void main() {
  group('DeckCardFormValidator', () {
    test('accepts valid required fields and blank reading', () {
      final errors = DeckCardFormValidator.validate(
        frontText: '会議',
        backText: 'cuộc họp',
        reading: '',
      );
      expect(errors.isValid, isTrue);
      expect(errors.frontText, isNull);
      expect(errors.backText, isNull);
      expect(errors.reading, isNull);
    });

    test('flags empty front and back as required', () {
      final errors = DeckCardFormValidator.validate(
        frontText: '   ',
        backText: '',
        reading: '',
      );
      expect(errors.frontText, DeckFieldError.required);
      expect(errors.backText, DeckFieldError.required);
      expect(errors.isValid, isFalse);
    });

    test('flags fields that exceed their limits', () {
      final errors = DeckCardFormValidator.validate(
        frontText: 'あ' * (DeckCardLimits.frontMaxLength + 1),
        backText: 'a' * (DeckCardLimits.backMaxLength + 1),
        reading: 'か' * (DeckCardLimits.readingMaxLength + 1),
      );
      expect(errors.frontText, DeckFieldError.tooLong);
      expect(errors.backText, DeckFieldError.tooLong);
      expect(errors.reading, DeckFieldError.tooLong);
    });
  });

  group('DeckCardInput.fromRaw', () {
    test('trims fields and collapses blank optionals to null', () {
      final input = DeckCardInput.fromRaw(
        frontText: '  会議  ',
        backText: '  cuộc họp  ',
        reading: '   ',
        imageUrl: '   ',
      );
      expect(input.frontText, '会議');
      expect(input.backText, 'cuộc họp');
      expect(input.reading, isNull);
      expect(input.imageUrl, isNull);
      expect(input.cardId, isNull);
      expect(input.deckCardId, isNull);
    });

    test('keeps identifiers and trims reading when present', () {
      final input = DeckCardInput.fromRaw(
        frontText: '会議',
        backText: 'cuộc họp',
        reading: ' かいぎ ',
        cardId: 'card-1',
        deckCardId: 'dc-1',
      );
      expect(input.reading, 'かいぎ');
      expect(input.cardId, 'card-1');
      expect(input.deckCardId, 'dc-1');
    });
  });

  group('DeckCardInput.fromDeckCard', () {
    test('carries identifiers and normalizes blank reading', () {
      const card = DeckCard(
        deckCardId: 'dc-9',
        cardId: 'card-9',
        position: 2,
        frontText: '会議',
        backText: 'cuộc họp',
      );
      final input = DeckCardInput.fromDeckCard(card);
      expect(input.cardId, 'card-9');
      expect(input.deckCardId, 'dc-9');
      expect(input.reading, isNull);
    });
  });

  group('DeckCardInput.toRequestBody', () {
    test('emits only required fields for a brand-new card', () {
      final body = DeckCardInput.fromRaw(
        frontText: '会議',
        backText: 'cuộc họp',
        reading: '',
      ).toRequestBody();
      expect(body, {'frontText': '会議', 'backText': 'cuộc họp'});
      expect(body.containsKey('cardId'), isFalse);
    });

    test('includes optionals and identifiers when present', () {
      final body = DeckCardInput.fromRaw(
        frontText: '会議',
        backText: 'cuộc họp',
        reading: 'かいぎ',
        imageUrl: 'https://example.com/a.png',
        cardId: 'card-1',
        deckCardId: 'dc-1',
      ).toRequestBody();
      expect(body['reading'], 'かいぎ');
      expect(body['imageUrl'], 'https://example.com/a.png');
      expect(body['cardId'], 'card-1');
      expect(body['deckCardId'], 'dc-1');
    });
  });
}
