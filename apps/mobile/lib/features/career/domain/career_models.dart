/// Career RPG domain models — the learner's rank, skills, streak, and the NPC
/// relationship graph. Mirrors the `/career/*` API serialization.
library;

class CareerRank {
  const CareerRank({
    required this.rankCode,
    required this.titleJa,
    required this.titleVi,
    required this.bjtBandTarget,
    required this.displayOrder,
    required this.xpToNext,
    this.minSkillFloor = 0,
    this.requiredArcCount = 0,
  });

  final String rankCode;
  final String titleJa;
  final String titleVi;
  final String bjtBandTarget;
  final int displayOrder;
  final int xpToNext;
  final int minSkillFloor;
  final int requiredArcCount;
}

class CareerSkill {
  const CareerSkill({required this.axisCode, required this.value});

  final String axisCode;
  final int value;
}

class CareerState {
  const CareerState({
    required this.userId,
    required this.jpWorkName,
    required this.companyTheme,
    required this.currentRankCode,
    required this.rankXp,
    required this.rankXpToNext,
    required this.streakDays,
    required this.skills,
    this.hireDate,
    this.lastClockInAt,
  });

  final String userId;
  final String jpWorkName;
  final String companyTheme;
  final String currentRankCode;
  final int rankXp;
  final int rankXpToNext;
  final int streakDays;
  final List<CareerSkill> skills;
  final String? hireDate;
  final DateTime? lastClockInAt;

  /// Progress towards the next rank as a 0..1 fraction.
  double get xpProgress {
    if (rankXpToNext <= 0) return 1;
    final ratio = rankXp / rankXpToNext;
    if (ratio.isNaN || ratio < 0) return 0;
    return ratio > 1 ? 1 : ratio;
  }
}

class StoryNpc {
  const StoryNpc({
    required this.slug,
    required this.nameJa,
    required this.roleJa,
    required this.defaultRelation,
    required this.avatarInitial,
    required this.avatarTint,
    this.companyJa,
    this.bioVi = '',
  });

  final String slug;
  final String nameJa;
  final String roleJa;
  final String defaultRelation;
  final String avatarInitial;
  final String avatarTint;
  final String? companyJa;
  final String bioVi;
}

class NpcRelation {
  const NpcRelation({
    required this.npcSlug,
    required this.trustScore,
    this.lastInteractionAt,
  });

  final String npcSlug;
  final int trustScore;
  final DateTime? lastInteractionAt;
}

/// Aggregated `/career/me` response.
class CareerSnapshot {
  const CareerSnapshot({
    required this.state,
    required this.rank,
    required this.npcs,
    required this.npcRelations,
    this.nextRank,
  });

  final CareerState state;
  final CareerRank rank;
  final List<StoryNpc> npcs;
  final List<NpcRelation> npcRelations;
  final CareerRank? nextRank;
}

class MissionArc {
  const MissionArc({
    required this.slug,
    required this.titleJa,
    required this.titleVi,
    required this.rankCodeEntry,
    required this.synopsisVi,
    required this.status,
    required this.locked,
    required this.totalChapters,
    required this.completedChapters,
    required this.displayOrder,
    required this.artAccent,
    this.npcSlugs = const [],
    this.bossChapterId,
  });

  final String slug;
  final String titleJa;
  final String titleVi;
  final String rankCodeEntry;
  final String synopsisVi;
  final String status;
  final bool locked;
  final int totalChapters;
  final int completedChapters;
  final int displayOrder;
  final String artAccent;
  final List<String> npcSlugs;
  final String? bossChapterId;

  double get progress {
    if (totalChapters <= 0) return 0;
    return completedChapters / totalChapters;
  }
}
