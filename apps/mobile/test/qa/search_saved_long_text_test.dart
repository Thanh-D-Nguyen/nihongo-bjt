// QA hardening — Search / Reference hub + Saved library long-text resilience.
//
// Manual device QA is unavailable, so these tests stand in for "does long
// Japanese / Vietnamese text break the Search hub, results list or Saved
// library?". Each screen is pumped with deliberately oversized JA + VI strings
// on a SMALL phone surface (320 dp) in both light and dark themes; we assert
// the frame renders with no layout exception (overflow / assertion).
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_page.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/features/search/presentation/recent_search_providers.dart';
import 'package:nihongo_bjt/features/search/presentation/search_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

const _longJa =
    'これはとても長い日本語のテキストで、敬語表現やビジネス会話の検索結果に'
    'おいて改行や省略が正しく機能するかどうかを検証するためのものであり、'
    '漢字とひらがなとカタカナが混在していても画面からはみ出さないことを確認します。';

const _longVi =
    'Đây là một đoạn văn bản tiếng Việt rất dài với đầy đủ các dấu thanh điệu '
    'nhằng nhẳng nhũng nhịu để kiểm tra rằng kết quả tìm kiếm và mục đã lưu '
    'không bị tràn, không cắt mất dấu và vẫn xuống dòng đúng trên màn hình nhỏ.';

Future<void> _pump(
  WidgetTester tester,
  Widget home, {
  required List<Override> overrides,
  required Brightness brightness,
}) async {
  // Small phone surface: 320 logical dp wide, dpr 2 → 640 physical.
  tester.view.physicalSize = const Size(640, 1280);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('vi'),
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: brightness == Brightness.dark
            ? ThemeMode.dark
            : ThemeMode.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

List<SearchHit> _longHits() => const [
  SearchHit(
    id: 'lex-1',
    kind: SearchHitKind.lexeme,
    title: _longJa,
    reading: _longJa,
    description: _longVi,
    jlptLevel: 'N1',
  ),
  SearchHit(
    id: 'kan-1',
    kind: SearchHitKind.kanji,
    title: _longJa,
    description: _longVi,
  ),
];

void main() {
  for (final brightness in Brightness.values) {
    final mode = brightness == Brightness.dark ? 'dark' : 'light';

    testWidgets('Search hub survives long recent searches ($mode)', (
      tester,
    ) async {
      await _pump(
        tester,
        const SearchPage(),
        overrides: [
          recentSearchesProvider.overrideWith(
            (ref) => Stream.value(const [_longJa, _longVi]),
          ),
        ],
        brightness: brightness,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('Search results + kind filter survive long text ($mode)', (
      tester,
    ) async {
      await _pump(
        tester,
        const SearchPage(),
        overrides: [
          recentSearchesProvider.overrideWith((ref) => Stream.value(const [])),
          contentSearchProvider.overrideWith((ref, query) async => _longHits()),
        ],
        brightness: brightness,
      );
      await tester.enterText(find.byType(TextField), '会議');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('Saved library survives long titles ($mode)', (tester) async {
      await _pump(
        tester,
        const SavedPage(),
        overrides: [
          savedListProvider.overrideWith(
            (ref, kind) async => kind == BookmarkKind.word
                ? const [
                    BookmarkItem(
                      id: 'bm-1',
                      targetId: 'lex-1',
                      targetType: 'lexeme',
                    ),
                  ]
                : const [],
          ),
          dictionaryWordProvider.overrideWith(
            (ref, id) async =>
                const Lexeme(id: 'lex-1', headword: _longJa, reading: _longVi),
          ),
        ],
        brightness: brightness,
      );
      expect(tester.takeException(), isNull);
    });
  }
}
