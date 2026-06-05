import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_card_bulk_add_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

const _deckId = 'business-basics';

Future<void> _pump(
  WidgetTester tester, {
  required MockFlashcardRepository repository,
}) async {
  tester.view.physicalSize = const Size(430, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        flashcardRepositoryProvider.overrideWithValue(repository),
      ],
      child: const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: FlashcardCardBulkAddPage(deckId: _deckId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Router harness so the page's `GoRouter.of(context).pop()` works after save.
Future<GoRouter> _pumpWithRouter(
  WidgetTester tester, {
  required MockFlashcardRepository repository,
}) async {
  tester.view.physicalSize = const Size(430, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(
        path: '/home',
        builder: (_, _) => const Scaffold(body: Center(child: Text('home'))),
      ),
      GoRoute(
        path: '/bulk',
        builder: (_, _) => const FlashcardCardBulkAddPage(deckId: _deckId),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        flashcardRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  unawaited(router.push('/bulk'));
  await tester.pumpAndSettle();
  return router;
}

void main() {
  group('FlashcardCardBulkAddPage', () {
    testWidgets('opens with three empty rows and a reading toggle', (
      tester,
    ) async {
      await _pump(tester, repository: MockFlashcardRepository());

      expect(find.text('Thẻ 1'), findsOneWidget);
      expect(find.text('Thẻ 2'), findsOneWidget);
      expect(find.text('Thẻ 3'), findsOneWidget);
      // Reading hidden by default → 2 fields per row.
      expect(find.byType(TextField), findsNWidgets(6));
      expect(find.byType(Switch), findsOneWidget);
    });

    testWidgets('adds a row with the add-row button', (tester) async {
      await _pump(tester, repository: MockFlashcardRepository());

      await tester.tap(find.text('Thêm hàng'));
      await tester.pumpAndSettle();

      expect(find.text('Thẻ 4'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(8));
    });

    testWidgets('reading toggle reveals a reading field per row', (
      tester,
    ) async {
      await _pump(tester, repository: MockFlashcardRepository());

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();

      // 3 rows × 3 fields each.
      expect(find.byType(TextField), findsNWidgets(9));
    });

    testWidgets('warns when saving with every row empty', (tester) async {
      await _pump(tester, repository: MockFlashcardRepository());

      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text('Hãy nhập ít nhất một thẻ.'), findsOneWidget);
    });

    testWidgets('shows the back-required error on a half-filled row', (
      tester,
    ) async {
      await _pump(tester, repository: MockFlashcardRepository());

      // Fill only the front of the first row, leave the back blank.
      await tester.enterText(find.byType(TextField).first, '出張');
      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text('Vui lòng nhập mặt sau.'), findsOneWidget);
    });

    testWidgets('saves filled rows and appends them to the deck', (
      tester,
    ) async {
      final repository = MockFlashcardRepository();
      final before = await repository.fetchDeckDetail(_deckId);

      await _pumpWithRouter(tester, repository: repository);

      final fronts = find.byType(TextField);
      // Row 1 front/back.
      await tester.enterText(fronts.at(0), '出張');
      await tester.enterText(fronts.at(1), 'công tác');
      // Row 2 front/back.
      await tester.enterText(fronts.at(2), '契約');
      await tester.enterText(fronts.at(3), 'hợp đồng');

      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();

      // Returned to home after a successful save.
      expect(find.text('home'), findsOneWidget);

      final after = await repository.fetchDeckDetail(_deckId);
      expect(after.cards.length, before.cards.length + 2);
      expect(after.cards.any((c) => c.frontText == '出張'), isTrue);
      expect(after.cards.any((c) => c.frontText == '契約'), isTrue);
    });
  });
}
