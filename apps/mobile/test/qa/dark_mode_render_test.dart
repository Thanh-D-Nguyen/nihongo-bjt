// QA hardening — dark-mode rendering.
//
// Manual device QA is unavailable, so these tests stand in for "does the screen
// render correctly in dark mode?". Each data screen is pumped with the real
// app dark theme (so `context.palette` resolves to the dark palette) across its
// meaningful states (empty + populated) and we assert the frame renders with no
// layout / theming exception. Learn, Lesson detail and Practice already get
// light+dark coverage in long_text_overflow_test.dart.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_page.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pumpDark(
  WidgetTester tester,
  Widget home, {
  required List<Override> overrides,
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
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

StudySummary _populatedSummary() {
  final today = DateTime(2026, 3, 15);
  return StudySummary(
    totalReviews: 42,
    reviewedToday: 6,
    last7DayTotal: 18,
    currentStreakDays: 4,
    dailyCounts: [
      for (var i = 6; i >= 0; i--)
        StudyDayCount(
          date: today.subtract(Duration(days: i)),
          count: i == 0 ? 6 : 2,
        ),
    ],
    ratingTotals: const {
      SrsRating.good: 10,
      SrsRating.again: 3,
      SrsRating.easy: 5,
    },
  );
}

void main() {
  group('Progress (dark)', () {
    testWidgets('renders the populated analytics in dark mode', (tester) async {
      await _pumpDark(
        tester,
        const ProgressPage(),
        overrides: [
          studySummaryProvider.overrideWith((ref) async => _populatedSummary()),
        ],
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.progressActivityTitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders the empty state in dark mode', (tester) async {
      await _pumpDark(
        tester,
        const ProgressPage(),
        overrides: [
          studySummaryProvider.overrideWith((ref) async => StudySummary.empty()),
        ],
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.progressEmptyTitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('Review hub (dark)', () {
    testWidgets('renders populated sections in dark mode', (tester) async {
      await _pumpDark(
        tester,
        const ReviewHubPage(),
        overrides: [
          deckListProvider.overrideWith(
            (ref) async => const [
              FlashcardDeck(
                id: 'd1',
                title: 'ビジネス基礎',
                description: 'Cụm từ kinh doanh cơ bản',
                cardCount: 24,
              ),
            ],
          ),
          lessonsProvider.overrideWith(
            (ref) async => const [
              Lesson(
                id: 'l1',
                categoryId: 'c1',
                titleJa: '敬語の基本',
                titleReading: 'けいごのきほん',
                summaryVi: 'Kính ngữ cơ bản',
                level: LessonLevel.foundational,
                estimatedMinutes: 5,
                sections: [
                  LessonSection(
                    headingVi: 'Mở đầu',
                    bodyJa: 'よろしくお願いします。',
                    translationVi: 'Rất mong được giúp đỡ.',
                  ),
                ],
                questionCount: 3,
              ),
            ],
          ),
        ],
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      expect(find.text(l10n.reviewHubTitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders honest empty sections in dark mode', (tester) async {
      await _pumpDark(
        tester,
        const ReviewHubPage(),
        overrides: [
          deckListProvider.overrideWith((ref) async => const <FlashcardDeck>[]),
          lessonsProvider.overrideWith((ref) async => const <Lesson>[]),
        ],
      );
      expect(find.byType(ReviewHubPage), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
