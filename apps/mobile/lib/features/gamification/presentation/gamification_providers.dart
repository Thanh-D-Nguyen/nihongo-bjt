import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/gamification/data/gamification_repository.dart';
import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';

/// Riverpod wiring for the learner Rewards surface (`/api/gamification/*`).

// The family/list providers expose verbose generated types; the explicit
// generic arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Single shared [GamificationRepository] on the auth-aware API client.
final gamificationRepositoryProvider = Provider<GamificationRepository>(
  (ref) => GamificationRepository(ref.watch(apiClientProvider)),
);

/// Every streak track the learner currently holds.
final streaksProvider = FutureProvider.autoDispose<List<StreakData>>((ref) {
  ref.keepAlive();
  return ref.watch(gamificationRepositoryProvider).streaks();
});

/// All achievements with the learner's per-tier progress.
final achievementsProvider =
    FutureProvider.autoDispose<List<AchievementDef>>((ref) {
      ref.keepAlive();
      return ref.watch(gamificationRepositoryProvider).achievements();
    });

/// Every enabled leaderboard the learner can browse.
final leaderboardsProvider =
    FutureProvider.autoDispose<List<LeaderboardConfig>>((ref) {
      ref.keepAlive();
      return ref.watch(gamificationRepositoryProvider).leaderboards();
    });

/// The ranked entries for a single leaderboard, keyed by its id.
final leaderboardProvider = FutureProvider.autoDispose
    .family<LeaderboardView, String>((ref, id) {
      ref.keepAlive();
      return ref.watch(gamificationRepositoryProvider).leaderboard(id);
    });
