import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_review_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Pumps the flashcard review screen for the in-memory `business-basics` deck.
/// Uses a tall viewport so the reveal CTA is not clipped in the test harness.
Future<void> _pumpReview(
  WidgetTester tester, {
  String deckId = 'business-basics',
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: FlashcardReviewPage(deckId: deckId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Pumps the review screen on the narrowest supported phone (320 dp) so the
/// four-button grading bar with Japanese labels is exercised at its tightest
/// horizontal budget.
Future<void> _pumpReviewNarrow(
  WidgetTester tester, {
  String deckId = 'business-basics',
}) async {
  tester.view.physicalSize = const Size(640, 1600);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: FlashcardReviewPage(deckId: deckId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('FlashcardReviewPage reveal', () {
    testWidgets('hides the answer until the learner reveals it', (
      tester,
    ) async {
      await _pumpReview(tester);

      // Front prompt is visible; reading help and answer stay hidden for
      // active recall.
      expect(find.text('報告'), findsOneWidget);
      expect(find.text('ほうこく'), findsNothing);
      expect(find.text('báo cáo'), findsNothing);
    });

    testWidgets('reveals the answer on the first reveal-button tap', (
      tester,
    ) async {
      await _pumpReview(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      await tester.tap(find.text(l10n.reviewReveal));
      await tester.pumpAndSettle();

      // Answer side is now visible and the rating bar replaces the reveal CTA.
      expect(find.text('báo cáo'), findsOneWidget);
      expect(find.text(l10n.reviewReveal), findsNothing);
      expect(find.text(l10n.ratingGood), findsOneWidget);
    });

    testWidgets('tapping the card face also reveals the answer', (
      tester,
    ) async {
      await _pumpReview(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // Tap the large card target (the front prompt) rather than the button.
      await tester.tap(find.text('報告'));
      await tester.pumpAndSettle();

      expect(find.text('báo cáo'), findsOneWidget);
      expect(find.text(l10n.ratingGood), findsOneWidget);
    });

    testWidgets('repeated reveal taps keep the answer visible', (tester) async {
      await _pumpReview(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      await tester.tap(find.text(l10n.reviewReveal));
      await tester.pumpAndSettle();

      // Further taps on the now-revealed card must not break the state.
      await tester.tap(find.text('報告'));
      await tester.pump();
      await tester.tap(find.text('báo cáo'));
      await tester.pumpAndSettle();

      expect(find.text('báo cáo'), findsOneWidget);
      expect(find.text(l10n.ratingGood), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('FlashcardReviewPage layout', () {
    testWidgets('grading bar fits the narrowest screen without overflow', (
      tester,
    ) async {
      await _pumpReviewNarrow(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // Reveal to surface the four-button grading bar (Again/Hard/Good/Easy)
      // with its Japanese labels + interval captions at 320 dp.
      await tester.tap(find.text(l10n.reviewReveal));
      await tester.pumpAndSettle();

      // All four grade actions are laid out and no RenderFlex overflows.
      expect(find.text(l10n.ratingAgain), findsOneWidget);
      expect(find.text(l10n.ratingHard), findsOneWidget);
      expect(find.text(l10n.ratingGood), findsOneWidget);
      expect(find.text(l10n.ratingEasy), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('FlashcardReviewPage type mode', () {
    testWidgets('grades a typed answer and advances to the next card', (
      tester,
    ) async {
      await _pumpReview(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // Card 0 ('報告') uses flip mode — grade it to reach the type-mode card.
      await tester.tap(find.text(l10n.reviewReveal));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.ratingGood));
      await tester.pumpAndSettle();

      // Card 1 ('取引先') is type mode: a typing field replaces the reveal CTA.
      expect(find.text(l10n.reviewTypePrompt), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text(l10n.reviewReveal), findsNothing);

      // Typing the correct kana reading grades the answer as correct.
      await tester.enterText(find.byType(TextField), 'とりひきさき');
      await tester.tap(find.text(l10n.reviewTypeSubmit));
      await tester.pumpAndSettle();

      expect(find.text(l10n.reviewTypeCorrect), findsOneWidget);
      expect(find.text(l10n.reviewTypeContinue), findsOneWidget);

      // Continuing advances to card 2 ('納期'), back to flip mode.
      await tester.tap(find.text(l10n.reviewTypeContinue));
      await tester.pumpAndSettle();

      expect(find.text('納期'), findsOneWidget);
      expect(find.text(l10n.reviewReveal), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('marks an unrelated typed answer as wrong', (tester) async {
      await _pumpReview(tester);
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      await tester.tap(find.text(l10n.reviewReveal));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.ratingGood));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'sai hoàn toàn');
      await tester.tap(find.text(l10n.reviewTypeSubmit));
      await tester.pumpAndSettle();

      expect(find.text(l10n.reviewTypeWrong), findsOneWidget);
      expect(find.text(l10n.reviewTypeContinue), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
