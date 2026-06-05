import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/progress/domain/coaching_snapshot.dart';

void main() {
  group('CoachingSnapshot.fromAnalyticsJson', () {
    test('parses totals, due count and weak-skill length', () {
      final snapshot = CoachingSnapshot.fromAnalyticsJson(<String, Object?>{
        'dueFlashcards': 5,
        'weakSkills': ['listening', 'reading'],
        'insight': 'Ôn đều mỗi ngày để giữ đà.',
        'totals': <String, Object?>{
          'bjtAccuracyPct': 68,
          'reviewCount': 12,
          'completedBjtSessions': 3,
          'streakDays': 4,
        },
      });

      expect(snapshot, isNotNull);
      expect(snapshot!.dueFlashcards, 5);
      expect(snapshot.weakCount, 2);
      expect(snapshot.accuracyPct, 68);
      expect(snapshot.reviewCount, 12);
      expect(snapshot.completedSessions, 3);
      expect(snapshot.streakDays, 4);
      expect(snapshot.insight, 'Ôn đều mỗi ngày để giữ đà.');
      expect(snapshot.hasSignal, isTrue);
    });

    test('returns null when payload is not an analytics object', () {
      expect(CoachingSnapshot.fromAnalyticsJson(null), isNull);
      expect(CoachingSnapshot.fromAnalyticsJson('nope'), isNull);
      expect(
        CoachingSnapshot.fromAnalyticsJson(<String, Object?>{'totals': 1}),
        isNull,
      );
    });

    test('treats missing fields as zero and reports no signal', () {
      final snapshot = CoachingSnapshot.fromAnalyticsJson(<String, Object?>{
        'totals': <String, Object?>{},
      });

      expect(snapshot, isNotNull);
      expect(snapshot!.hasSignal, isFalse);
    });
  });

  group('primaryAction (mirrors web pickPrimaryAction)', () {
    CoachingSnapshot make({
      int due = 0,
      int weak = 0,
      int accuracy = 100,
      int reviews = 0,
      int sessions = 0,
      int streak = 0,
    }) {
      return CoachingSnapshot(
        dueFlashcards: due,
        weakCount: weak,
        accuracyPct: accuracy,
        reviewCount: reviews,
        completedSessions: sessions,
        streakDays: streak,
      );
    }

    test('recommends flashcards when many are due', () {
      expect(make(due: 4).primaryAction, CoachingAction.flashcards);
    });

    test('recommends quiz for weak skills with few due cards', () {
      expect(make(weak: 1, due: 1).primaryAction, CoachingAction.quiz);
    });

    test('recommends quiz on low accuracy with enough activity', () {
      expect(
        make(accuracy: 50, reviews: 4).primaryAction,
        CoachingAction.quiz,
      );
    });

    test('recommends flashcards when at least one is due', () {
      expect(make(due: 1).primaryAction, CoachingAction.flashcards);
    });

    test('falls back to flashcards on low activity', () {
      expect(make().primaryAction, CoachingAction.flashcards);
    });

    test('falls back to quiz once activity is established', () {
      expect(make(reviews: 3).primaryAction, CoachingAction.quiz);
    });
  });

  group('primaryHint and nudge selection', () {
    test('flashcards-due hint and due nudge when cards are due', () {
      const snapshot = CoachingSnapshot(
        dueFlashcards: 3,
        weakCount: 0,
        accuracyPct: 80,
        reviewCount: 0,
        completedSessions: 0,
        streakDays: 0,
      );
      expect(snapshot.primaryHint, CoachingHint.flashcardsDue);
      expect(snapshot.nudge, CoachingNudge.due);
    });

    test('quiz-skills hint and weak nudge for weak skills only', () {
      const snapshot = CoachingSnapshot(
        dueFlashcards: 0,
        weakCount: 2,
        accuracyPct: 90,
        reviewCount: 3,
        completedSessions: 0,
        streakDays: 0,
      );
      expect(snapshot.primaryHint, CoachingHint.quizSkills);
      expect(snapshot.nudge, CoachingNudge.weak);
    });

    test('streak nudge celebrates an active streak with no urgent signal', () {
      const snapshot = CoachingSnapshot(
        dueFlashcards: 0,
        weakCount: 0,
        accuracyPct: 90,
        reviewCount: 3,
        completedSessions: 0,
        streakDays: 5,
      );
      expect(snapshot.nudge, CoachingNudge.streak);
    });

    test('calm nudge when there is nothing pressing', () {
      const snapshot = CoachingSnapshot(
        dueFlashcards: 0,
        weakCount: 0,
        accuracyPct: 90,
        reviewCount: 3,
        completedSessions: 0,
        streakDays: 0,
      );
      expect(snapshot.nudge, CoachingNudge.calm);
    });
  });
}
