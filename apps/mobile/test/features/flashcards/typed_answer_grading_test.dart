import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/domain/typed_answer_grading.dart';

void main() {
  group('normalizeTypedAnswer', () {
    test('trims, lower-cases and collapses whitespace', () {
      expect(normalizeTypedAnswer('  Báo   Cáo  '), 'báo cáo');
    });

    test('folds katakana to hiragana', () {
      expect(normalizeTypedAnswer('ホウコク'), 'ほうこく');
    });

    test('converts the full-width space to ASCII', () {
      expect(normalizeTypedAnswer('a\u3000b'), 'a b');
    });
  });

  group('typedEditDistance', () {
    test('is zero for identical strings', () {
      expect(typedEditDistance('abc', 'abc'), 0);
    });

    test('counts single edits', () {
      expect(typedEditDistance('abc', 'abd'), 1);
      expect(typedEditDistance('abc', 'ab'), 1);
    });
  });

  group('gradeTypedAnswer', () {
    test('exact match against the meaning is correct', () {
      expect(
        gradeTypedAnswer(input: 'báo cáo', back: 'báo cáo', reading: 'ほうこく'),
        TypedGrade.correct,
      );
    });

    test('katakana input matching the kana reading is correct', () {
      expect(
        gradeTypedAnswer(input: 'ホウコク', back: 'báo cáo', reading: 'ほうこく'),
        TypedGrade.correct,
      );
    });

    test('a near miss within the edit threshold is almost', () {
      expect(
        gradeTypedAnswer(input: 'bao cáo', back: 'báo cáo', reading: 'ほうこく'),
        TypedGrade.almost,
      );
    });

    test('an unrelated answer is wrong', () {
      expect(
        gradeTypedAnswer(input: 'xin chào', back: 'báo cáo', reading: 'ほうこく'),
        TypedGrade.wrong,
      );
    });

    test('blank input is always wrong', () {
      expect(
        gradeTypedAnswer(input: '   ', back: 'báo cáo', reading: 'ほうこく'),
        TypedGrade.wrong,
      );
    });
  });

  group('typedGradeToRating', () {
    test('maps grades to the web-equivalent SRS ratings', () {
      expect(typedGradeToRating(TypedGrade.correct), SrsRating.good);
      expect(typedGradeToRating(TypedGrade.almost), SrsRating.hard);
      expect(typedGradeToRating(TypedGrade.wrong), SrsRating.again);
    });
  });
}
