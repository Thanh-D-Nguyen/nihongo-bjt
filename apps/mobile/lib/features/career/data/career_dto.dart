import 'package:nihongo_bjt/features/career/domain/career_models.dart';

/// Defensive parsers for the `/career/*` API surface. Every field is coerced
/// so malformed payloads degrade gracefully instead of throwing.
abstract final class CareerDto {
  static Map<String, dynamic> asMap(Object? value) =>
      value is Map<String, dynamic> ? value : const {};

  static List<Map<String, dynamic>> asMapList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  static String _str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static String? _strOrNull(Object? value) => value is String ? value : null;

  static int _int(Object? value, [int fallback = 0]) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  static DateTime? _dateOrNull(Object? value) {
    if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
    return null;
  }

  static CareerRank rank(Map<String, dynamic> json) => CareerRank(
    rankCode: _str(json['rankCode']),
    titleJa: _str(json['titleJa']),
    titleVi: _str(json['titleVi']),
    bjtBandTarget: _str(json['bjtBandTarget']),
    displayOrder: _int(json['displayOrder']),
    xpToNext: _int(json['xpToNext']),
    minSkillFloor: _int(json['minSkillFloor']),
    requiredArcCount: _int(json['requiredArcCount']),
  );

  static CareerSkill skill(Map<String, dynamic> json) => CareerSkill(
    axisCode: _str(json['axisCode']),
    value: _int(json['value']),
  );

  static StoryNpc npc(Map<String, dynamic> json) => StoryNpc(
    slug: _str(json['slug']),
    nameJa: _str(json['nameJa']),
    roleJa: _str(json['roleJa']),
    defaultRelation: _str(json['defaultRelation'], 'uchi'),
    avatarInitial: _str(json['avatarInitial']),
    avatarTint: _str(json['avatarTint'], '#1B2A4A'),
    companyJa: _strOrNull(json['companyJa']),
    bioVi: _str(json['bioVi']),
  );

  static NpcRelation relation(Map<String, dynamic> json) => NpcRelation(
    npcSlug: _str(json['npcSlug']),
    trustScore: _int(json['trustScore']),
    lastInteractionAt: _dateOrNull(json['lastInteractionAt']),
  );

  static CareerState state(Map<String, dynamic> json) => CareerState(
    userId: _str(json['userId']),
    jpWorkName: _str(json['jpWorkName']),
    companyTheme: _str(json['companyTheme']),
    currentRankCode: _str(json['currentRankCode']),
    rankXp: _int(json['rankXp']),
    rankXpToNext: _int(json['rankXpToNext']),
    streakDays: _int(json['streakDays']),
    hireDate: _strOrNull(json['hireDate']),
    lastClockInAt: _dateOrNull(json['lastClockInAt']),
    skills: asMapList(json['skills']).map(skill).toList(growable: false),
  );

  static CareerSnapshot snapshot(Map<String, dynamic> json) {
    final nextRankJson = json['nextRank'];
    return CareerSnapshot(
      state: state(asMap(json['state'])),
      rank: rank(asMap(json['rank'])),
      nextRank: nextRankJson is Map<String, dynamic>
          ? rank(nextRankJson)
          : null,
      npcs: asMapList(json['npcs']).map(npc).toList(growable: false),
      npcRelations: asMapList(
        json['npcRelations'],
      ).map(relation).toList(growable: false),
    );
  }

  static MissionArc arc(Map<String, dynamic> json) => MissionArc(
    slug: _str(json['slug']),
    titleJa: _str(json['titleJa']),
    titleVi: _str(json['titleVi']),
    rankCodeEntry: _str(json['rankCodeEntry']),
    synopsisVi: _str(json['synopsisVi']),
    status: _str(json['status'], 'locked'),
    locked: json['locked'] is bool && json['locked'] == true,
    totalChapters: _int(json['totalChapters']),
    completedChapters: _int(json['completedChapters']),
    displayOrder: _int(json['displayOrder']),
    artAccent: _str(json['artAccent'], '#1B2A4A'),
    bossChapterId: _strOrNull(json['bossChapterId']),
    npcSlugs: (json['npcSlugs'] is List)
        ? (json['npcSlugs'] as List)
              .whereType<String>()
              .toList(growable: false)
        : const [],
  );
}
