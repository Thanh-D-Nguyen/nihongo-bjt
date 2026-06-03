import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';

/// Defensive parsers for the `/api/gamification/*` surface. Every field is
/// coerced so malformed payloads degrade gracefully instead of throwing.
abstract final class GamificationDto {
  static Map<String, dynamic> asMap(Object? value) =>
      value is Map<String, dynamic> ? value : const {};

  static List<Map<String, dynamic>> asMapList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  static String _str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static int _int(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static DateTime? _dateOrNull(Object? value) {
    if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
    return null;
  }

  /// Humanize an i18n key (e.g. `achievement.vocab_master.name`) into a
  /// readable title when the API returns only the key. Mirrors the web
  /// fallback so titles stay consistent across surfaces.
  static String humanizeKey(String key) {
    if (key.isEmpty) return '';
    final parts = key.split('.');
    var token = parts.isNotEmpty ? parts.last : key;
    if ((token == 'name' || token == 'description') && parts.length >= 2) {
      token = parts[parts.length - 2];
    }
    final words = token
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim()
        .split(RegExp(r'\s+'));
    return words
        .map(
          (w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
        )
        .join(' ');
  }

  static List<StreakData> streaks(Object? json) {
    final rows = json is Map<String, dynamic> ? asMapList(json['items']) : null;
    return (rows ?? asMapList(json)).map(streak).toList(growable: false);
  }

  static StreakData streak(Map<String, dynamic> json) {
    final config = asMap(json['streakConfig']);
    return StreakData(
      id: _str(json['id']),
      currentStreak: _int(json['currentStreak']),
      longestStreak: _int(json['longestStreak']),
      freezesUsed: _int(json['freezesUsed']),
      freezesAllowed: _int(config['freezesAllowed']),
      name: _str(config['name']),
      activityType: _str(config['activityType']),
      lastActivityDate: _dateOrNull(json['lastActivityDate']),
    );
  }

  static List<AchievementDef> achievements(Object? json) =>
      asMapList(json).map(achievement).toList(growable: false);

  static AchievementDef achievement(Map<String, dynamic> json) {
    final tiers = asMapList(json['tiers']).map(achievementTier).toList()
      ..sort((a, b) => a.threshold.compareTo(b.threshold));
    return AchievementDef(
      id: _str(json['id']),
      slug: _str(json['slug']),
      name: humanizeKey(_str(json['nameKey'])),
      description: humanizeKey(_str(json['descriptionKey'])),
      category: _str(json['category']),
      tiers: tiers,
    );
  }

  static AchievementTier achievementTier(Map<String, dynamic> json) {
    final progress = json['userProgress'];
    final progressMap = progress is Map<String, dynamic> ? progress : null;
    return AchievementTier(
      id: _str(json['id']),
      tier: _str(json['tier']),
      threshold: _int(json['threshold']),
      currentProgress: _int(progressMap?['currentProgress']),
      earnedAt: _dateOrNull(progressMap?['earnedAt']),
    );
  }

  static List<LeaderboardConfig> leaderboards(Object? json) =>
      asMapList(json).map(leaderboardConfig).toList(growable: false);

  static LeaderboardConfig leaderboardConfig(Map<String, dynamic> json) =>
      LeaderboardConfig(
        id: _str(json['id']),
        name: _str(json['name']),
        metricType: _str(json['metricType']),
        period: _str(json['period']),
      );

  static LeaderboardView leaderboardView(Object? json) {
    final map = asMap(json);
    return LeaderboardView(
      config: leaderboardConfig(asMap(map['leaderboard'])),
      entries: asMapList(map['entries'])
          .map(leaderboardEntry)
          .toList(growable: false),
    );
  }

  static LeaderboardEntry leaderboardEntry(Map<String, dynamic> json) {
    final user = asMap(json['user']);
    final name = user['displayName'];
    return LeaderboardEntry(
      id: _str(json['id']),
      userId: _str(json['userId']),
      rank: _int(json['rank']),
      score: _int(json['score']),
      displayName: name is String && name.isNotEmpty ? name : null,
    );
  }
}
