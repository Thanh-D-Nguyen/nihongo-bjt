import 'package:nihongo_bjt/features/career/data/career_dto.dart';
import 'package:nihongo_bjt/features/career/domain/story_models.dart';

/// Defensive parsers for the `/story/*` API surface.
abstract final class StoryDto {
  static String _str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static int _int(Object? value, [int fallback = 0]) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  static bool _bool(Object? value) => value is bool && value;

  static RiskOutcome outcome(Map<String, dynamic> json) => RiskOutcome(
    npcReactionTag: _str(json['npcReactionTag'], 'nod'),
    consequenceVi: _str(json['consequenceVi']),
    consequenceJa: _str(json['consequenceJa']),
    trustDelta: _int(json['trustDelta']),
    affectedNpcSlug: _str(json['affectedNpcSlug']),
  );

  static BjtQuestionOption questionOption(Map<String, dynamic> json) {
    final outcomeJson = json['outcome'];
    return BjtQuestionOption(
      optionKey: _str(json['optionKey']),
      textJa: _str(json['textJa']),
      isCorrect: _bool(json['isCorrect']),
      outcome: outcomeJson is Map<String, dynamic>
          ? outcome(outcomeJson)
          : null,
    );
  }

  static BjtQuestion question(Map<String, dynamic> json) => BjtQuestion(
    id: _str(json['id']),
    promptJa: _str(json['promptJa']),
    promptVi: _str(json['promptVi']),
    skillTag: _str(json['skillTag']),
    difficulty: _str(json['difficulty'], 'standard'),
    options: CareerDto.asMapList(
      json['options'],
    ).map(questionOption).toList(growable: false),
  );

  static WorkplaceScenario scenario(Map<String, dynamic> json) {
    final questionJson = json['question'];
    return WorkplaceScenario(
      id: _str(json['id']),
      scenarioType: _str(json['scenarioType']),
      titleJa: _str(json['titleJa']),
      titleVi: _str(json['titleVi']),
      contextSummaryVi: _str(json['contextSummaryVi']),
      goalJa: _str(json['goalJa']),
      goalVi: _str(json['goalVi']),
      question: questionJson is Map<String, dynamic>
          ? question(questionJson)
          : null,
    );
  }

  static MissionChapter chapter(Map<String, dynamic> json) => MissionChapter(
    id: _str(json['id']),
    arcSlug: _str(json['arcSlug']),
    slug: _str(json['slug']),
    titleJa: _str(json['titleJa']),
    titleVi: _str(json['titleVi']),
    briefingJa: _str(json['briefingJa']),
    briefingVi: _str(json['briefingVi']),
    yourRoleVi: _str(json['yourRoleVi']),
    isBoss: _bool(json['isBoss']),
    estimatedMinutes: _int(json['estimatedMinutes'], 5),
    displayOrder: _int(json['displayOrder']),
    scenarios: CareerDto.asMapList(
      json['scenarios'],
    ).map(scenario).toList(growable: false),
  );

  static MissionArcRef arcRef(Map<String, dynamic> json) => MissionArcRef(
    slug: _str(json['slug']),
    titleJa: _str(json['titleJa']),
    titleVi: _str(json['titleVi']),
    synopsisVi: _str(json['synopsisVi']),
    locked: _bool(json['locked']),
    status: _str(json['status'], 'locked'),
    totalChapters: _int(json['totalChapters']),
    completedChapters: _int(json['completedChapters']),
  );

  static ArcDetail arcDetail(Map<String, dynamic> json) => ArcDetail(
    arc: arcRef(CareerDto.asMap(json['arc'])),
    chapters: CareerDto.asMapList(
      json['chapters'],
    ).map(chapter).toList(growable: false),
    npcs: CareerDto.asMapList(json['npcs']),
    npcRelations: CareerDto.asMapList(json['npcRelations']),
  );

  static ChapterDetail chapterDetail(Map<String, dynamic> json) =>
      ChapterDetail(chapter: chapter(CareerDto.asMap(json['chapter'])));

  static ChapterResult completion(Map<String, dynamic> json) {
    final result = CareerDto.asMap(json['result']);
    final rankUp = json['rankUp'];
    final skillDeltas = <String, int>{};
    final rawSkills = result['skillDeltas'];
    if (rawSkills is Map) {
      rawSkills.forEach((key, value) {
        if (key is String && value is num) skillDeltas[key] = value.toInt();
      });
    }
    final trustDeltas = <String, int>{};
    for (final gain in CareerDto.asMapList(result['npcTrustDeltas'])) {
      final slug = _str(gain['npcSlug']);
      if (slug.isNotEmpty) trustDeltas[slug] = _int(gain['delta']);
    }
    String? newRankTitle;
    if (rankUp is Map<String, dynamic>) {
      final career = CareerDto.asMap(json['career']);
      newRankTitle = _str(CareerDto.asMap(career['rank'])['titleJa']);
      if (newRankTitle.isEmpty) newRankTitle = null;
    }
    return ChapterResult(
      rankXpDelta: _int(result['rankXpDelta']),
      skillDeltas: skillDeltas,
      npcTrustDeltas: trustDeltas,
      rankedUp: rankUp is Map<String, dynamic>,
      newRankTitleJa: newRankTitle,
    );
  }
}
