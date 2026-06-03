import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';

void main() {
  group('buildQuery', () {
    test('drops null and empty values', () {
      expect(
        buildQuery({'q': 'x', 'level': null, 'tag': ''}),
        '?q=x',
      );
    });

    test('returns an empty string when nothing survives', () {
      expect(buildQuery({'a': null, 'b': ''}), '');
    });

    test('percent-encodes keys and values', () {
      final query = buildQuery({'q': '会議 & 本'});
      expect(query, startsWith('?q='));
      expect(query.contains(' '), isFalse);
      expect(query.contains('&q'), isFalse, reason: 'no unescaped separator');
    });
  });

  group('PageCursor', () {
    test('advances offset by limit on next()', () {
      const first = PageCursor(limit: 30);
      final second = first.next();
      expect(second.offset, 30);
      expect(second.limit, 30);
      expect(first.next().next().offset, 60);
    });

    test('toQuery merges extra params with limit/offset', () {
      const cursor = PageCursor(limit: 25, offset: 50);
      expect(cursor.toQuery({'q': 'N3'}), {
        'q': 'N3',
        'limit': 25,
        'offset': 50,
      });
    });
  });
}
