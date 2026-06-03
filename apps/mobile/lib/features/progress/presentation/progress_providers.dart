import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';

/// Aggregated, device-local study summary for the Progress screen.
///
/// Reads real recorded events from the on-device study log and derives honest
/// counts (today / last 7 days), a per-day activity series, the SRS grade mix
/// and a study-day streak. No metric is fabricated; an empty log yields
/// [StudySummary.empty]. Only the real data source persists a study log, so in
/// mock/dev mode the summary is honestly empty.
final studySummaryProvider = FutureProvider<StudySummary>((ref) async {
  if (!ref.watch(appEnvironmentProvider).useApiFlashcards) {
    return StudySummary.empty();
  }
  final dao = ref.watch(studyLogDaoProvider);
  final total = await dao.totalCount();
  if (total == 0) {
    return StudySummary.empty();
  }
  // 60-day window is enough to render the last week and resolve any active
  // streak without scanning the entire history.
  final now = DateTime.now();
  final since = now.subtract(const Duration(days: 60));
  final rows = await dao.eventsSince(since);
  final events = <StudyEventInput>[
    for (final row in rows)
      StudyEventInput(
        occurredAt: row.occurredAt,
        rating: _parseRating(row.rating),
      ),
  ];
  return StudySummary.fromEvents(events: events, totalReviews: total, now: now);
});

SrsRating? _parseRating(String? name) {
  if (name == null) return null;
  for (final rating in SrsRating.values) {
    if (rating.name == name) return rating;
  }
  return null;
}
