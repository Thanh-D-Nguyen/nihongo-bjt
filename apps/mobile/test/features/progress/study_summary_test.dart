import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';

void main() {
  group('StudySummary.fromEvents', () {
    final now = DateTime(2026, 3, 15, 10);

    StudyEventInput event(DateTime localTime, SrsRating rating) {
      return StudyEventInput(occurredAt: localTime.toUtc(), rating: rating);
    }

    test('empty when there are no recorded events', () {
      final summary = StudySummary.fromEvents(
        events: const [],
        totalReviews: 0,
        now: now,
      );
      expect(summary.isEmpty, isTrue);
      expect(summary.dailyCounts, isEmpty);
    });

    test('counts today, last 7 days and grade mix', () {
      final summary = StudySummary.fromEvents(
        events: [
          event(DateTime(2026, 3, 15, 9), SrsRating.good),
          event(DateTime(2026, 3, 15, 9, 30), SrsRating.again),
          event(DateTime(2026, 3, 14, 20), SrsRating.easy),
          // Outside the 7-day window — counted only in totalReviews.
          event(DateTime(2026, 3, 1, 8), SrsRating.hard),
        ],
        totalReviews: 4,
        now: now,
      );

      expect(summary.isEmpty, isFalse);
      expect(summary.reviewedToday, 2);
      expect(summary.last7DayTotal, 3);
      expect(summary.totalReviews, 4);
      expect(summary.dailyCounts, hasLength(7));
      expect(summary.dailyCounts.last.count, 2); // today
      expect(summary.ratingTotals[SrsRating.good], 1);
      expect(summary.ratingTotals[SrsRating.again], 1);
      expect(summary.ratingTotals[SrsRating.easy], 1);
      expect(summary.ratingTotals.containsKey(SrsRating.hard), isFalse);
      expect(summary.peakDayCount, 2);
    });

    test('streak counts consecutive days ending today', () {
      final summary = StudySummary.fromEvents(
        events: [
          event(DateTime(2026, 3, 15, 9), SrsRating.good),
          event(DateTime(2026, 3, 14, 9), SrsRating.good),
          event(DateTime(2026, 3, 13, 9), SrsRating.good),
          // Gap on the 12th breaks the streak before this.
          event(DateTime(2026, 3, 11, 9), SrsRating.good),
        ],
        totalReviews: 4,
        now: now,
      );
      expect(summary.currentStreakDays, 3);
    });

    test(
      'streak survives when today has no activity yet but yesterday does',
      () {
        final summary = StudySummary.fromEvents(
          events: [
            event(DateTime(2026, 3, 14, 9), SrsRating.good),
            event(DateTime(2026, 3, 13, 9), SrsRating.good),
          ],
          totalReviews: 2,
          now: now,
        );
        expect(summary.currentStreakDays, 2);
        expect(summary.reviewedToday, 0);
      },
    );

    test('streak is zero when the most recent study day is too old', () {
      final summary = StudySummary.fromEvents(
        events: [event(DateTime(2026, 3, 10, 9), SrsRating.good)],
        totalReviews: 1,
        now: now,
      );
      expect(summary.currentStreakDays, 0);
    });
  });
}
