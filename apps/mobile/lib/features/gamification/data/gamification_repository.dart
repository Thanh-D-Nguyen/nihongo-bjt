import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/gamification/data/gamification_dto.dart';
import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';

/// Read access to the learner Rewards surface (`/api/gamification/*`).
///
/// These endpoints require an authenticated session: the shared [ApiClient]
/// attaches the bearer token, so no `userId` is ever sent from the client.
/// Failures are normalized to [RepositoryException]; the repository never
/// fabricates streaks, achievements, or rankings.
class GamificationRepository {
  const GamificationRepository(this._client);

  final ApiClient _client;

  /// Every streak track held by the learner.
  Future<List<StreakData>> streaks() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/gamification/streaks'),
    );
    return GamificationDto.streaks(json);
  }

  /// All achievements with the learner's progress overlaid per tier.
  Future<List<AchievementDef>> achievements() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/gamification/achievements/browse'),
    );
    return GamificationDto.achievements(json);
  }

  /// Every enabled leaderboard the learner can browse.
  Future<List<LeaderboardConfig>> leaderboards() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/gamification/leaderboards'),
    );
    return GamificationDto.leaderboards(json);
  }

  /// The ranked entries for a single leaderboard.
  Future<LeaderboardView> leaderboard(String id) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/gamification/leaderboards/$id'),
    );
    return GamificationDto.leaderboardView(json);
  }
}
