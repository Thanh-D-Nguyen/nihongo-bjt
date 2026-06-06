import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_import.dart';

void main() {
  group('parseDeckCardImport', () {
    test('returns empty for blank input', () {
      expect(parseDeckCardImport('').hasRows, isFalse);
      expect(parseDeckCardImport('   \n  ').hasRows, isFalse);
    });

    test('parses tab-separated newline rows', () {
      final result = parseDeckCardImport('会議\t meeting\n資料\tdocument');
      expect(result.rows, hasLength(2));
      expect(result.validCount, 2);
      expect(result.rows.first.front, '会議');
      expect(result.rows.first.back, 'meeting');
    });

    test('parses pipe and comma separators', () {
      final pipe = parseDeckCardImport('a|b');
      expect(pipe.rows.single.front, 'a');
      expect(pipe.rows.single.back, 'b');

      final comma = parseDeckCardImport('a,b');
      expect(comma.rows.single.back, 'b');
    });

    test('folds extra separators into back for two-column input', () {
      final result = parseDeckCardImport('term,part one, part two');
      expect(result.rows.single.front, 'term');
      expect(result.rows.single.back, 'part one, part two');
    });

    test('splits single-line input on semicolons', () {
      final result = parseDeckCardImport('a\tb; c\td');
      expect(result.rows, hasLength(2));
      expect(result.rows.last.front, 'c');
    });

    test('reads third column as reading when enabled', () {
      final result = parseDeckCardImport(
        '会議\tmeeting\tかいぎ',
        hasReadingColumn: true,
      );
      expect(result.rows.single.reading, 'かいぎ');
      expect(result.rows.single.isValid, isTrue);
    });

    test('does not treat third column as reading when disabled', () {
      final result = parseDeckCardImport('会議\tmeeting\tかいぎ');
      expect(result.rows.single.reading, isNull);
      expect(result.rows.single.back, 'meeting\tかいぎ');
    });

    test('flags missing back', () {
      final result = parseDeckCardImport('lonely');
      expect(result.rows.single.error, ImportRowError.missingBack);
      expect(result.validCount, 0);
      expect(result.errorCount, 1);
    });

    test('flags too-long front', () {
      final longFront = 'x' * 501;
      final result = parseDeckCardImport('$longFront\tback');
      expect(result.rows.single.error, ImportRowError.frontTooLong);
    });

    test('caps at 200 rows and reports overflow', () {
      final lines =
          List.generate(205, (i) => 'front$i\tback$i').join('\n');
      final result = parseDeckCardImport(lines);
      expect(result.rows, hasLength(200));
      expect(result.exceededLimit, isTrue);
    });

    test('toCardInputs returns only valid rows', () {
      final result = parseDeckCardImport('a\tb\nlonely\nc\td');
      final inputs = result.toCardInputs();
      expect(inputs, hasLength(2));
      expect(inputs.first.frontText, 'a');
    });
  });
}
