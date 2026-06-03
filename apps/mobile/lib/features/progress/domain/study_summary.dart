import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// One recorded study event in the form the summary aggregator consumes.
class StudyEventInput {
  const StudyEventInput({required this.occurredAt, required this.rating});

  /// When the event happened (UTC).
  final DateTime occurredAt;

  /// SRS grade, or null for non-graded kinds.
  final SrsRating? rating;
}

/// Activity count for a single calendar day (local time).
class StudyDayCount {
  const StudyDayCount({required this.date, required this.count});

  /// Local calendar day (time component is midnight).
  final DateTime date;

  /// Number of study events recorded on [date].
  final int count;
}

/// Honest, device-local summary of study activity for the Progress screen.
///
/// no fabricated streaks or inflated metrics. When nothing has been studied the
/// summary is [isEmpty] and the UI shows an encouraging empty state rather than
/// zeroes dressed up as progress.
class StudySummary {
  const StudySummary({
    required this.totalReviews,
    required this.reviewedToday,
    required this.last7DayTotal,
    required this.currentStreakDays,
    required this.dailyCounts,
    required this.ratingTotals,
  });

  /// Empty summary used before any review is recorded.
  factory StudySummary.empty() => const StudySummary(
    totalReviews: 0,
    reviewedToday: 0,
    last7DayTotal: 0,
    currentStreakDays: 0,
    dailyCounts: <StudyDayCount>[],
    ratingTotals: <SrsRating, int>{},
  );

  /// Derives a summary from recorded review [events] (UTC timestamps + grade),
  /// the all-time [totalReviews] and the current local time [now].
  ///
  /// Pure and deterministic so it can be unit-tested without a database.
  factory StudySummary.fromEvents({
    required List<StudyEventInput> events,
    required int totalReviews,
    required DateTime now,
  }) {
    if (totalReviews == 0 || events.isEmpty) {
      return StudySummary.empty();
    }
    final today = DateTime(now.year, now.month, now.day);

    // Bucket events by local calendar day.
    final perDay = <DateTime, int>{};
    final ratingsLast7 = <SrsRating, int>{};
    final studyDays = <DateTime>{};
    final weekStart = today.subtract(const Duration(days: 6));
    for (final event in events) {
      final local = event.occurredAt.toLocal();
      final day = DateTime(local.year, local.month, local.day);
      studyDays.add(day);
      if (!day.isBefore(weekStart)) {
        perDay[day] = (perDay[day] ?? 0) + 1;
        final rating = event.rating;
        if (rating != null) {
          ratingsLast7[rating] = (ratingsLast7[rating] ?? 0) + 1;
        }
      }
    }

    final dailyCounts = <StudyDayCount>[];
    var last7Total = 0;
    for (var i = 6; i >= 0; i--) {
      final day = today.subtract(Duration(days: i));
      final count = perDay[day] ?? 0;
      last7Total += count;
      dailyCounts.add(StudyDayCount(date: day, count: count));
    }

    return StudySummary(
      totalReviews: totalReviews,
      reviewedToday: perDay[today] ?? 0,
      last7DayTotal: last7Total,
      currentStreakDays: _streakFrom(studyDays, today),
      dailyCounts: dailyCounts,
      ratingTotals: ratingsLast7,
    );
  }

  /// Counts consecutive study days ending today (or yesterday if today has no
  /// activity yet, so an in-progress streak is not prematurely reset).
  static int _streakFrom(Set<DateTime> studyDays, DateTime today) {
    final yesterday = today.subtract(const Duration(days: 1));
    DateTime cursor;
    if (studyDays.contains(today)) {
      cursor = today;
    } else if (studyDays.contains(yesterday)) {
      cursor = yesterday;
    } else {
      return 0;
    }
    var streak = 0;
    while (studyDays.contains(cursor)) {
      streak++;
      cursor = cursor.subtract(const Duration(days: 1));
    }
    return streak;
  }

  /// All-time number of recorded reviews.
  final int totalReviews;

  /// Reviews recorded today (local time).
  final int reviewedToday;

  /// Reviews recorded across the last 7 days, today inclusive.
  final int last7DayTotal;

  /// Consecutive study days ending today (or yesterday); 0 when the streak is
  /// broken.
  final int currentStreakDays;

  /// Per-day counts for the last 7 days, oldest first (always 7 entries).
  final List<StudyDayCount> dailyCounts;

  /// Reviews grouped by SRS grade across the last 7 days.
  final Map<SrsRating, int> ratingTotals;

  /// True when no study activity has ever been recorded.
  bool get isEmpty => totalReviews == 0;

  /// Highest single-day count in [dailyCounts]; 0 when there is no activity.
  int get peakDayCount =>
      dailyCounts.fold(0, (max, d) => d.count > max ? d.count : max);
}
