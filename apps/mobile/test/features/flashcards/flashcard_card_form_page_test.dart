import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_card_form_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

const _deckId = 'business-basics';

Future<void> _pump(
  WidgetTester tester,
  Widget page, {
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: page,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

DeckDetail _detail({List<DeckCard> cards = const []}) => DeckDetail(
      id: _deckId,
      titleVi: 'Kinh doanh cơ bản',
      titleJa: 'ビジネス基礎',
      cards: cards,
    );

const _card = DeckCard(
  deckCardId: 'dc-1',
  cardId: 'card-1',
  position: 0,
  frontText: '会議',
  backText: 'cuộc họp',
  reading: 'かいぎ',
);

void main() {
  group('FlashcardCardFormPage — create', () {
    testWidgets('renders three fields and the add CTA', (tester) async {
      await _pump(
        tester,
        const FlashcardCardFormPage(deckId: _deckId),
        overrides: [
          deckDetailProvider(_deckId).overrideWith((ref) async => _detail()),
        ],
      );

      expect(find.byType(TextField), findsNWidgets(3));
      expect(find.text('Thêm thẻ'), findsWidgets);
      expect(find.byType(PrimaryButton), findsOneWidget);
    });

    testWidgets('shows required errors when submitting empty', (tester) async {
      await _pump(
        tester,
        const FlashcardCardFormPage(deckId: _deckId),
        overrides: [
          deckDetailProvider(_deckId).overrideWith((ref) async => _detail()),
        ],
      );

      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text('Vui lòng nhập mặt trước.'), findsOneWidget);
      expect(find.text('Vui lòng nhập mặt sau.'), findsOneWidget);
    });
  });

  group('FlashcardCardFormPage — edit', () {
    testWidgets('prefills the card and shows update + delete actions', (
      tester,
    ) async {
      await _pump(
        tester,
        const FlashcardCardFormPage(deckId: _deckId, cardIndex: 0),
        overrides: [
          deckDetailProvider(_deckId)
              .overrideWith((ref) async => _detail(cards: const [_card])),
        ],
      );

      expect(find.text('会議'), findsOneWidget);
      expect(find.text('かいぎ'), findsOneWidget);
      expect(find.text('cuộc họp'), findsOneWidget);
      expect(find.text('Lưu thay đổi'), findsOneWidget);
      expect(find.text('Xóa thẻ'), findsOneWidget);
    });

    testWidgets('renders not-found when the card index is out of range', (
      tester,
    ) async {
      await _pump(
        tester,
        const FlashcardCardFormPage(deckId: _deckId, cardIndex: 5),
        overrides: [
          deckDetailProvider(_deckId)
              .overrideWith((ref) async => _detail(cards: const [_card])),
        ],
      );

      expect(
        find.text('Không tìm thấy thẻ này. Có thể nó đã bị thay đổi.'),
        findsOneWidget,
      );
    });
  });
}
