import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

void main() {
  group('DeckFormValidator', () {
    DeckFormErrors validate({
      String titleVi = 'Bộ thẻ',
      String titleJa = '',
      String descriptionVi = '',
      String descriptionJa = '',
    }) {
      return DeckFormValidator.validate(
        titleVi: titleVi,
        titleJa: titleJa,
        descriptionVi: descriptionVi,
        descriptionJa: descriptionJa,
      );
    }

    test('accepts a minimal valid deck (titleVi only)', () {
      final errors = validate();
      expect(errors.isValid, isTrue);
    });

    test('rejects an empty (or whitespace-only) required titleVi', () {
      expect(validate(titleVi: '').titleVi, DeckFieldError.required);
      expect(validate(titleVi: '   ').titleVi, DeckFieldError.required);
    });

    test('rejects a titleVi longer than the max length', () {
      final long = 'あ' * (DeckFormLimits.titleMaxLength + 1);
      expect(validate(titleVi: long).titleVi, DeckFieldError.tooLong);
    });

    test('accepts a titleVi exactly at the max length', () {
      final atLimit = 'a' * DeckFormLimits.titleMaxLength;
      expect(validate(titleVi: atLimit).titleVi, isNull);
    });

    test('treats a blank optional titleJa as valid (omitted)', () {
      expect(validate(titleJa: '   ').titleJa, isNull);
    });

    test('rejects an over-long optional titleJa', () {
      final long = 'b' * (DeckFormLimits.titleMaxLength + 1);
      expect(validate(titleJa: long).titleJa, DeckFieldError.tooLong);
    });

    test('rejects an over-long description', () {
      final long = 'c' * (DeckFormLimits.descriptionMaxLength + 1);
      expect(
        validate(descriptionVi: long).descriptionVi,
        DeckFieldError.tooLong,
      );
      expect(
        validate(descriptionJa: long).descriptionJa,
        DeckFieldError.tooLong,
      );
    });
  });

  group('DeckFormInput.fromRaw', () {
    test('trims titleVi and collapses blank optionals to null', () {
      final input = DeckFormInput.fromRaw(
        titleVi: '  Bộ thẻ  ',
        titleJa: '   ',
        descriptionVi: '',
        descriptionJa: '  説明  ',
        visibility: DeckVisibility.public,
      );

      expect(input.titleVi, 'Bộ thẻ');
      expect(input.titleJa, isNull);
      expect(input.descriptionVi, isNull);
      expect(input.descriptionJa, '説明');
      expect(input.visibility, DeckVisibility.public);
    });

    test('request body omits blank optionals and carries no userId', () {
      final body = DeckFormInput.fromRaw(
        titleVi: 'Kinh doanh',
        titleJa: '',
        descriptionVi: '',
        descriptionJa: '',
        visibility: DeckVisibility.private,
      ).toRequestBody();

      expect(body['titleVi'], 'Kinh doanh');
      expect(body.containsKey('titleJa'), isFalse);
      expect(body.containsKey('descriptionVi'), isFalse);
      expect(body.containsKey('descriptionJa'), isFalse);
      expect(body.containsKey('userId'), isFalse);
      expect(body.containsKey('cards'), isFalse);
      expect(body['visibility'], DeckVisibility.private.wire);
    });
  });
}
