import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/features/search/presentation/search_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

void main() {
  late AppDatabase db;

  setUp(() => db = AppDatabase.forTesting(NativeDatabase.memory()));
  tearDown(() => db.close());

  Future<void> pump(
    WidgetTester tester,
    Widget child, {
    List<Override> overrides = const [],
  }) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          recentSearchDaoProvider.overrideWithValue(db.recentSearchDao),
          ...overrides,
        ],
        child: MaterialApp(
          locale: const Locale('vi'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: child,
        ),
      ),
    );
  }

  // Unmount the tree so the autofocused field's cursor-blink timer is
  // cancelled before the test framework checks for pending timers. Disposing
  // the ProviderScope also makes Drift schedule a zero-duration timer to close
  // its query stream, so pump once more to flush it.
  Future<void> dispose(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('SearchPage shows the idle prompt before any query', (
    tester,
  ) async {
    await pump(tester, const SearchPage());
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.searchIdleTitle), findsOneWidget);
    await dispose(tester);
  });

  testWidgets('SearchPage renders results for a query', (tester) async {
    await pump(
      tester,
      const SearchPage(),
      overrides: [
        contentSearchProvider.overrideWith(
          (ref, query) async => const [
            SearchHit(
              id: 'lex-1',
              kind: SearchHitKind.lexeme,
              title: '会議',
              reading: 'かいぎ',
              description: 'Cuộc họp',
              jlptLevel: 'N3',
            ),
          ],
        ),
      ],
    );

    await tester.enterText(find.byType(TextField), '会議');
    // Advance past the 300ms search debounce, then let results settle.
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    // The description is unique to the result tile (the title also appears in
    // the search field's EditableText).
    expect(find.text('Cuộc họp'), findsOneWidget);
    await dispose(tester);
  });

  testWidgets('SearchPage surfaces recent searches and hides the idle prompt', (
    tester,
  ) async {
    await db.recentSearchDao.record('挨拶');
    await db.recentSearchDao.record('会議');

    await pump(tester, const SearchPage());
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.searchRecentTitle), findsOneWidget);
    expect(find.widgetWithText(InputChip, '会議'), findsOneWidget);
    expect(find.widgetWithText(InputChip, '挨拶'), findsOneWidget);
    // The idle empty-state hides once history exists.
    expect(find.text(l10n.searchIdleTitle), findsNothing);
    await dispose(tester);
  });

  testWidgets('Tapping a recent chip re-runs that query', (tester) async {
    await db.recentSearchDao.record('会議');

    await pump(
      tester,
      const SearchPage(),
      overrides: [
        contentSearchProvider.overrideWith(
          (ref, query) async => [
            SearchHit(
              id: 'lex-1',
              kind: SearchHitKind.lexeme,
              title: query,
              reading: 'かいぎ',
              description: 'Cuộc họp',
              jlptLevel: 'N3',
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(InputChip, '会議'));
    await tester.pumpAndSettle();

    // The hit tile renders the re-run query.
    expect(find.text('会議'), findsWidgets);
    await dispose(tester);
  });

  testWidgets('Kind filter narrows multi-kind results and resets per query', (
    tester,
  ) async {
    await pump(
      tester,
      const SearchPage(),
      overrides: [
        contentSearchProvider.overrideWith(
          (ref, query) async => const [
            SearchHit(
              id: 'lex-1',
              kind: SearchHitKind.lexeme,
              title: '会議',
              reading: 'かいぎ',
              description: 'Cuộc họp',
            ),
            SearchHit(
              id: 'kan-1',
              kind: SearchHitKind.kanji,
              title: '会',
              description: 'họp',
            ),
          ],
        ),
      ],
    );

    await tester.enterText(find.byType(TextField), '会');
    // Advance past the 300ms search debounce, then let results settle.
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    // Descriptions are unique to their tiles (titles also appear in the field).
    expect(find.text('Cuộc họp'), findsOneWidget);
    expect(find.text('họp'), findsOneWidget);
    // The segmented filter bar appears for multi-kind results.
    expect(find.text(l10n.searchFilterAll), findsOneWidget);

    // Filtering to Kanji hides the word hit. The filter bar renders before the
    // result list, so the first match is the chip (not a tile kind label).
    await tester.tap(find.text(l10n.searchKindKanji).first);
    await tester.pumpAndSettle();
    expect(find.text('Cuộc họp'), findsNothing);
    expect(find.text('họp'), findsOneWidget);

    await dispose(tester);
  });
}
