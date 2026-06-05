import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/domain/coaching_snapshot.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_page.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pumpProgress(
  WidgetTester tester, {
  required StudySummary summary,
  CoachingSnapshot? coaching,
  Locale locale = const Locale('vi'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        studySummaryProvider.overrideWith((ref) async => summary),
        coachingSnapshotProvider.overrideWith((ref) async => coaching),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ProgressPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows an encouraging empty state before any review', (
    tester,
  ) async {
    await _pumpProgress(tester, summary: StudySummary.empty());

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.progressEmptyTitle), findsOneWidget);
    expect(find.text(l10n.progressEmptyBody), findsOneWidget);
  });

  testWidgets('renders real stats and the grade breakdown', (tester) async {
    final today = DateTime(2026, 3, 15);
    final summary = StudySummary(
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

    await _pumpProgress(tester, summary: summary);

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.progressTodayLabel), findsOneWidget);
    expect(find.text(l10n.progressStreakLabel), findsOneWidget);
    expect(find.text(l10n.progressActivityTitle), findsOneWidget);
    expect(find.text(l10n.progressRatingTitle), findsOneWidget);
    // Streak value (4 days) and today's card count (6) are rendered honestly.
    expect(find.text(l10n.progressStreakValue(4)), findsOneWidget);
    expect(find.text(l10n.progressCardsValue(6)), findsWidgets);
  });

  testWidgets('renders the coaching card from a server snapshot', (
    tester,
  ) async {
    const summary = StudySummary(
      totalReviews: 10,
      reviewedToday: 2,
      last7DayTotal: 6,
      currentStreakDays: 1,
      dailyCounts: [],
      ratingTotals: {SrsRating.good: 4},
    );

    await _pumpProgress(
      tester,
      summary: summary,
      coaching: const CoachingSnapshot(
        dueFlashcards: 5,
        weakCount: 0,
        accuracyPct: 80,
        reviewCount: 4,
        completedSessions: 0,
        streakDays: 1,
        insight: 'Một buổi ôn ngắn là đủ cho hôm nay.',
      ),
    );

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.progressCoachingTitle), findsOneWidget);
    // 5 due cards → flashcards action + due hint/nudge.
    expect(find.text(l10n.progressCoachingCtaFlashcards), findsOneWidget);
    expect(
      find.text(l10n.progressCoachingHintFlashcardsDue(5)),
      findsOneWidget,
    );
    // Server-derived insight line and its eyebrow label are shown.
    expect(
      find.text(l10n.progressCoachingInsightTitle.toUpperCase()),
      findsOneWidget,
    );
    expect(
      find.text('Một buổi ôn ngắn là đủ cho hôm nay.'),
      findsOneWidget,
    );
  });

  testWidgets('hides the coaching card when there is no snapshot', (
    tester,
  ) async {
    const summary = StudySummary(
      totalReviews: 10,
      reviewedToday: 2,
      last7DayTotal: 6,
      currentStreakDays: 1,
      dailyCounts: [],
      ratingTotals: {SrsRating.good: 4},
    );

    await _pumpProgress(tester, summary: summary);

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.progressCoachingTitle), findsNothing);
  });
}
