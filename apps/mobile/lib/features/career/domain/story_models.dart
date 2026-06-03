/// Career RPG story models — mission chapters, workplace scenarios, BJT-style
/// questions, and the server-authoritative completion result. Mirrors the
/// `/story/*` API serialization.
library;

class BjtQuestionOption {
  const BjtQuestionOption({
    required this.optionKey,
    required this.textJa,
    required this.isCorrect,
    this.outcome,
  });

  final String optionKey;
  final String textJa;
  final bool isCorrect;
  final RiskOutcome? outcome;
}

class RiskOutcome {
  const RiskOutcome({
    required this.npcReactionTag,
    required this.consequenceVi,
    this.consequenceJa = '',
    this.trustDelta = 0,
    this.affectedNpcSlug = '',
  });

  final String npcReactionTag;
  final String consequenceVi;
  final String consequenceJa;
  final int trustDelta;
  final String affectedNpcSlug;
}

class BjtQuestion {
  const BjtQuestion({
    required this.id,
    required this.promptJa,
    required this.promptVi,
    required this.options,
    this.skillTag = '',
    this.difficulty = 'standard',
  });

  final String id;
  final String promptJa;
  final String promptVi;
  final List<BjtQuestionOption> options;
  final String skillTag;
  final String difficulty;
}

class WorkplaceScenario {
  const WorkplaceScenario({
    required this.id,
    required this.scenarioType,
    required this.titleJa,
    required this.titleVi,
    required this.contextSummaryVi,
    required this.goalJa,
    required this.goalVi,
    this.question,
  });

  final String id;
  final String scenarioType;
  final String titleJa;
  final String titleVi;
  final String contextSummaryVi;
  final String goalJa;
  final String goalVi;
  final BjtQuestion? question;
}

class MissionChapter {
  const MissionChapter({
    required this.id,
    required this.arcSlug,
    required this.slug,
    required this.titleJa,
    required this.titleVi,
    required this.briefingJa,
    required this.briefingVi,
    required this.yourRoleVi,
    required this.isBoss,
    required this.estimatedMinutes,
    required this.displayOrder,
    this.scenarios = const [],
  });

  final String id;
  final String arcSlug;
  final String slug;
  final String titleJa;
  final String titleVi;
  final String briefingJa;
  final String briefingVi;
  final String yourRoleVi;
  final bool isBoss;
  final int estimatedMinutes;
  final int displayOrder;
  final List<WorkplaceScenario> scenarios;
}

/// `/story/arcs/:slug` response.
class ArcDetail {
  const ArcDetail({
    required this.arc,
    required this.chapters,
    required this.npcs,
    required this.npcRelations,
  });

  final MissionArcRef arc;
  final List<MissionChapter> chapters;
  final List<dynamic> npcs;
  final List<dynamic> npcRelations;
}

/// Lightweight arc reference used by [ArcDetail] to avoid importing the full
/// career models into the story layer.
class MissionArcRef {
  const MissionArcRef({
    required this.slug,
    required this.titleJa,
    required this.titleVi,
    required this.synopsisVi,
    required this.locked,
    required this.status,
    required this.totalChapters,
    required this.completedChapters,
  });

  final String slug;
  final String titleJa;
  final String titleVi;
  final String synopsisVi;
  final bool locked;
  final String status;
  final int totalChapters;
  final int completedChapters;
}

/// `/story/chapters/:id` response.
class ChapterDetail {
  const ChapterDetail({required this.chapter});

  final MissionChapter chapter;
}

/// Server-authoritative outcome of completing a chapter attempt.
class ChapterResult {
  const ChapterResult({
    required this.rankXpDelta,
    required this.skillDeltas,
    required this.npcTrustDeltas,
    this.rankedUp = false,
    this.newRankTitleJa,
  });

  final int rankXpDelta;
  final Map<String, int> skillDeltas;
  final Map<String, int> npcTrustDeltas;
  final bool rankedUp;
  final String? newRankTitleJa;
}
