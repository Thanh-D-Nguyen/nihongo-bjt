import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_detail_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

const _deckId = 'business-basics';

DeckDetail _detail({
  List<DeckCard> cards = const [],
  DeckVisibility visibility = DeckVisibility.private,
}) {
  return DeckDetail(
    id: _deckId,
    titleVi: 'Kinh doanh cơ bản',
    titleJa: 'ビジネス基礎',
    descriptionVi: 'Từ vựng kinh doanh nền tảng',
    visibility: visibility,
    cards: cards,
  );
}

const _cards = <DeckCard>[
  DeckCard(
    deckCardId: 'dc-1',
    cardId: 'c-1',
    position: 0,
    frontText: '報告',
    backText: 'báo cáo',
    reading: 'ほうこく',
  ),
  DeckCard(
    deckCardId: 'dc-2',
    cardId: 'c-2',
    position: 1,
    frontText: '納期',
    backText: 'thời hạn giao hàng',
    reading: 'のうき',
  ),
];

Future<void> _pumpDetail(
  WidgetTester tester, {
  required DeckDetail detail,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        deckDetailProvider(_deckId).overrideWith((ref) async => detail),
      ],
      child: const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: FlashcardDeckDetailPage(deckId: _deckId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('FlashcardDeckDetailPage', () {
    testWidgets('renders deck title, description and every card', (
      tester,
    ) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      expect(find.text('ビジネス基礎'), findsOneWidget);
      expect(find.text('Từ vựng kinh doanh nền tảng'), findsOneWidget);
      expect(find.text('報告'), findsOneWidget);
      expect(find.text('báo cáo'), findsOneWidget);
      expect(find.text('納期'), findsOneWidget);
      expect(find.text('thời hạn giao hàng'), findsOneWidget);
    });

    testWidgets('enables the study CTA when the deck has cards', (
      tester,
    ) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      final button = tester.widget<PrimaryButton>(find.byType(PrimaryButton));
      expect(button.onPressed, isNotNull);
    });

    testWidgets('disables the study CTA and shows empty state with no cards', (
      tester,
    ) async {
      await _pumpDetail(
        tester,
        detail: _detail(),
      );

      final button = tester.widget<PrimaryButton>(
        find.byType(PrimaryButton).first,
      );
      expect(button.onPressed, isNull);
      expect(find.text('Bộ thẻ này chưa có thẻ nào.'), findsOneWidget);
    });

    testWidgets('shows the public badge for a public deck', (tester) async {
      await _pumpDetail(
        tester,
        detail: _detail(visibility: DeckVisibility.public),
      );

      expect(find.text('Công khai'), findsOneWidget);
    });

    testWidgets('renders the add-card CTA and a search field with cards', (
      tester,
    ) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      expect(find.text('Thêm thẻ'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('filters the card list by the search query', (tester) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      await tester.enterText(find.byType(TextField), '報告');
      await tester.pumpAndSettle();

      // The non-matching card is filtered out; the matching card stays.
      expect(find.text('納期'), findsNothing);
      expect(find.text('báo cáo'), findsOneWidget);
    });

    testWidgets('shows the search empty state when nothing matches', (
      tester,
    ) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      await tester.enterText(find.byType(TextField), 'zzz-no-match');
      await tester.pumpAndSettle();

      expect(find.text('Không có thẻ phù hợp'), findsOneWidget);
    });

    testWidgets('re-sorts cards alphabetically when toggled', (tester) async {
      await _pumpDetail(
        tester,
        detail: _detail(cards: _cards),
      );

      await tester.tap(find.text('A–Z'));
      await tester.pumpAndSettle();

      // Both cards remain rendered after the sort change.
      expect(find.text('報告'), findsOneWidget);
      expect(find.text('納期'), findsOneWidget);
    });

    testWidgets('renders an error state with retry on failure', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            deckDetailProvider(_deckId).overrideWith(
              (ref) async => throw StateError('offline'),
            ),
          ],
          child: const MaterialApp(
            locale: Locale('vi'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: FlashcardDeckDetailPage(deckId: _deckId),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Không tải được bộ thẻ'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
    });
  });
}
