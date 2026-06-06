import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_form_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

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

DeckDetail _detail() => const DeckDetail(
  id: _deckId,
  titleVi: 'Kinh doanh cơ bản',
  titleJa: 'ビジネス基礎',
  descriptionVi: 'Từ vựng kinh doanh nền tảng',
  cards: [],
);

void main() {
  group('FlashcardDeckFormPage — edit only', () {
    testWidgets('prefills fields from the loaded deck and shows the update '
        'CTA', (tester) async {
      await _pump(
        tester,
        const FlashcardDeckFormPage(deckId: _deckId),
        overrides: [
          deckDetailProvider(_deckId).overrideWith((ref) async => _detail()),
        ],
      );

      expect(find.text('Lưu thay đổi'), findsOneWidget);
      expect(find.text('Kinh doanh cơ bản'), findsOneWidget);
      expect(find.text('ビジネス基礎'), findsOneWidget);
      expect(find.text('Từ vựng kinh doanh nền tảng'), findsOneWidget);
    });

    testWidgets('renders the error state when the deck fails to load', (
      tester,
    ) async {
      await _pump(
        tester,
        const FlashcardDeckFormPage(deckId: _deckId),
        overrides: [
          deckDetailProvider(_deckId)
              .overrideWith((ref) async => throw StateError('offline')),
        ],
      );

      expect(find.text('Không tải được bộ thẻ'), findsOneWidget);
    });
  });
}
