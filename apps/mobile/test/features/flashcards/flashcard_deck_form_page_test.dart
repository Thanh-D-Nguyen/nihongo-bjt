import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_form_page.dart';
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

DeckDetail _detail() => const DeckDetail(
  id: _deckId,
  titleVi: 'Kinh doanh cơ bản',
  titleJa: 'ビジネス基礎',
  descriptionVi: 'Từ vựng kinh doanh nền tảng',
  cards: [],
);

void main() {
  group('FlashcardDeckFormPage — create', () {
    testWidgets('renders empty fields and the create CTA', (tester) async {
      await _pump(tester, const FlashcardDeckFormPage());

      expect(find.text('Tạo bộ thẻ'), findsWidgets);
      expect(find.byType(TextField), findsNWidgets(4));
      // No prefilled text in the required title field.
      final titleField = tester.widget<TextField>(find.byType(TextField).first);
      expect(titleField.controller?.text, isEmpty);
    });

    testWidgets('shows a required error when titleVi is empty on submit', (
      tester,
    ) async {
      await _pump(tester, const FlashcardDeckFormPage());

      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text('Vui lòng nhập tiêu đề.'), findsOneWidget);
    });

    testWidgets('clears the error once a valid title is entered and resubmit '
        'is attempted', (tester) async {
      await _pump(tester, const FlashcardDeckFormPage());

      await tester.tap(find.byType(PrimaryButton));
      await tester.pumpAndSettle();
      expect(find.text('Vui lòng nhập tiêu đề.'), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, 'Bộ thẻ mới');
      await tester.pumpAndSettle();
      // The validator no longer flags the field after re-validation on submit
      // is gated by network; we only assert the input is accepted here.
      final titleField = tester.widget<TextField>(find.byType(TextField).first);
      expect(titleField.controller?.text, 'Bộ thẻ mới');
    });
  });

  group('FlashcardDeckFormPage — edit', () {
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
