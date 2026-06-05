import 'package:flutter/foundation.dart';

/// The three sections of the learner Rewards hub, mirroring the web
/// `/achievements` experience: daily streaks, achievement progress, and
/// competitive leaderboards. All data is server-authoritative.
enum RewardsTab { streaks, achievements, leaderboards }

/// One streak track from `GET /api/gamification/streaks`. A learner can hold
/// several streaks at once (e.g. one per activity type).
@immutable
class StreakData {
  const StreakData({
    required this.id,
    required this.currentStreak,
    required this.longestStreak,
    required this.freezesUsed,
    required this.freezesAllowed,
    required this.name,
    required this.activityType,
    this.lastActivityDate,
  });

  final String id;
  final int currentStreak;
  final int longestStreak;
  final int freezesUsed;
  final int freezesAllowed;
  final String name;
  final String activityType;
  final DateTime? lastActivityDate;

  /// Remaining streak freezes the learner can still spend this cycle.
  int get freezesLeft =>
      (freezesAllowed - freezesUsed).clamp(0, freezesAllowed);
}

/// One earnable tier of an achievement, with the learner's progress overlay
/// from `GET /api/gamification/achievements/browse`.
@immutable
class AchievementTier {
  const AchievementTier({
    required this.id,
    required this.tier,
    required this.threshold,
    required this.currentProgress,
    this.earnedAt,
  });

  final String id;
  final String tier;
  final int threshold;
  final int currentProgress;
  final DateTime? earnedAt;

  bool get isEarned => earnedAt != null;

  /// Fractional progress toward this tier's threshold, clamped to 0..1.
  double get progressFraction {
    if (threshold <= 0) return isEarned ? 1 : 0;
    return (currentProgress / threshold).clamp(0, 1).toDouble();
  }
}

/// An achievement definition with all its tiers and the learner's progress.
@immutable
class AchievementDef {
  const AchievementDef({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.category,
    required this.tiers,
  });

  final String id;
  final String slug;
  final String name;
  final String description;
  final String category;
  final List<AchievementTier> tiers;

  /// Number of tiers the learner has already earned.
  int get earnedCount => tiers.where((t) => t.isEarned).length;

  bool get isFullyEarned => tiers.isNotEmpty && earnedCount == tiers.length;

  bool get isStarted => tiers.any((t) => t.currentProgress > 0 || t.isEarned);

  /// The next tier the learner is working toward, or the final tier when all
  /// are earned. Null only when the achievement defines no tiers.
  AchievementTier? get activeTier {
    for (final tier in tiers) {
      if (!tier.isEarned) return tier;
    }
    return tiers.isEmpty ? null : tiers.last;
  }
}

/// A leaderboard definition from `GET /api/gamification/leaderboards`.
@immutable
class LeaderboardConfig {
  const LeaderboardConfig({
    required this.id,
    required this.name,
    required this.metricType,
    required this.period,
  });

  final String id;
  final String name;
  final String metricType;
  final String period;
}

/// One ranked row within a leaderboard.
@immutable
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.id,
    required this.userId,
    required this.rank,
    required this.score,
    this.displayName,
  });

  final String id;
  final String userId;
  final int rank;
  final int score;
  final String? displayName;
}

/// A leaderboard with its ranked entries, from
/// `GET /api/gamification/leaderboards/:id`.
@immutable
class LeaderboardView {
  const LeaderboardView({required this.config, required this.entries});

  final LeaderboardConfig config;
  final List<LeaderboardEntry> entries;
}
