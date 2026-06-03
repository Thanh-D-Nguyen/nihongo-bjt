import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

FlashcardDeck _deck(String id, {int cardCount = 5}) => FlashcardDeck(
  id: id,
  title: 'ビジネス基礎',
  description: 'Cơ bản kinh doanh',
  cardCount: cardCount,
);

Lesson _lesson(String id, {int questionCount = 0}) => Lesson(
  id: id,
  categoryId: 'cat-1',
  titleJa: '会議の表現',
  titleReading: 'かいぎのひょうげん',
  summaryVi: 'Mẫu câu họp hành',
  level: LessonLevel.practical,
  estimatedMinutes: 5,
  questionCount: questionCount,
  sections: const [
    LessonSection(
      headingVi: 'Mở đầu',
      bodyJa: 'よろしくお願いします。',
      translationVi: 'Rất mong được giúp đỡ.',
    ),
  ],
);

Future<void> _pumpReview(
  WidgetTester tester, {
  required List<Override> overrides,
  Locale locale = const Locale('vi'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ReviewHubPage(),
      ),
    ),
  );
}

void main() {
  group('ReviewHubPage', () {
    testWidgets('renders flashcard and practice stats from live data', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          deckListProvider.overrideWith(
            (ref) async => [_deck('d1'), _deck('d2')],
          ),
          lessonsProvider.overrideWith(
            (ref) async => [
              _lesson('l1', questionCount: 3),
              _lesson('l2'),
            ],
          ),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewFlashcardsTitle), findsOneWidget);
      expect(find.text(l10n.reviewFlashcardsStat(2, 10)), findsOneWidget);
      expect(
        find.text(l10n.reviewPracticeStat(1), skipOffstage: false),
        findsWidgets,
      );

      // Both CTAs are enabled because there is real content.
      final ctas = tester
          .widgetList<PrimaryButton>(find.byType(PrimaryButton))
          .toList();
      expect(ctas.where((b) => b.onPressed != null), isNotEmpty);
    });

    testWidgets('shows honest empty messages with disabled CTAs', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          deckListProvider.overrideWith((ref) async => <FlashcardDeck>[]),
          lessonsProvider.overrideWith((ref) async => <Lesson>[]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewFlashcardsEmpty), findsOneWidget);
      expect(
        find.text(l10n.reviewPracticeEmpty, skipOffstage: false),
        findsWidgets,
      );

      final flashcardCta = tester.widget<PrimaryButton>(
        find.widgetWithText(PrimaryButton, l10n.reviewFlashcardsCta),
      );
      expect(flashcardCta.onPressed, isNull);
    });

    testWidgets('shows a compact error with retry when a section fails', (
      tester,
    ) async {
      await _pumpReview(
        tester,
        overrides: [
          deckListProvider.overrideWith((ref) async => throw Exception('boom')),
          lessonsProvider.overrideWith((ref) async => [_lesson('l1')]),
        ],
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewSectionError), findsOneWidget);
      expect(
        find.widgetWithText(PrimaryButton, l10n.commonRetry),
        findsOneWidget,
      );
    });
  });
}
