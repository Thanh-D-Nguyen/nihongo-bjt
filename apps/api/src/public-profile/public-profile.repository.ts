import { parseServerEnv } from "@nihongo-bjt/config";
import { Injectable } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

type PrivacyLevel = "public" | "standard" | "private";

export interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  targetBjtBand: string | null;
  learningPurpose: string | null;
  privacyLevel: PrivacyLevel;
  memberSince: string;
  /** Populated based on privacy + viewer relationship */
  stats: {
    currentStreak: number | null;
    longestStreak: number | null;
    totalStudyDays: number | null;
    achievementCount: number | null;
    battleWins: number | null;
    battleTotal: number | null;
    battleWinRate: number | null;
  } | null;
  achievements: Array<{
    id: string;
    slug: string;
    name: string;
    iconUrl: string | null;
    unlockedAt: string;
  }> | null;
  /** Relationship to the viewer */
  relationship: "self" | "friend" | "stranger" | "blocked" | null;
  /** Is this user currently online? (injected by controller) */
  online?: boolean;
  lastSeenAt?: string | null;
}

@Injectable()
export class PublicProfileRepository {
  private readonly prisma = createPrismaClient();
  private readonly env = parseServerEnv(process.env);

  /** Find basic profile by user ID (for existence check). */
  async findById(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarAssetId: true,
        coverAssetId: true,
        targetBjtBand: true,
        learningPurpose: true,
        privacyLevel: true,
        createdAt: true,
        status: true,
      },
    });
  }

  /** Get the social relationship between two users. */
  async getRelationship(
    viewerUserId: string,
    targetUserId: string
  ): Promise<"self" | "friend" | "stranger" | "blocked"> {
    if (viewerUserId === targetUserId) return "self";

    const connection = await this.prisma.userSocialConnection.findFirst({
      where: {
        OR: [
          { requesterUserId: viewerUserId, addresseeUserId: targetUserId },
          { requesterUserId: targetUserId, addresseeUserId: viewerUserId },
        ],
      },
      select: { status: true, blockedByUserId: true },
    });

    if (!connection) return "stranger";
    if (connection.status === "accepted") return "friend";
    if (connection.status === "blocked") return "blocked";
    return "stranger";
  }

  /** Get streak data for a user. */
  async getStreakStats(userId: string) {
    const [streak, studyDays] = await Promise.all([
      this.prisma.userStreak.findFirst({
        where: { userId },
        orderBy: { currentStreak: "desc" },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT reviewed_at::date) as count
        FROM learning.review_event
        WHERE user_id = ${userId}::uuid
      `,
    ]);

    return streak
      ? {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          totalStudyDays: Number(studyDays[0]?.count ?? 0),
        }
      : { currentStreak: 0, longestStreak: 0, totalStudyDays: Number(studyDays[0]?.count ?? 0) };
  }

  /** Get achievement count and recent achievements. */
  async getAchievements(userId: string, limit = 5) {
    const [count, recent] = await Promise.all([
      this.prisma.userAchievement.count({ where: { userId, earnedAt: { not: null } } }),
      this.prisma.userAchievement.findMany({
        where: { userId, earnedAt: { not: null } },
        orderBy: { earnedAt: "desc" },
        take: limit,
        select: {
          id: true,
          earnedAt: true,
          tier: {
            select: {
              id: true,
              tier: true,
              iconUrl: true,
              nameKey: true,
              achievement: {
                select: {
                  id: true,
                  slug: true,
                  nameKey: true,
                  iconUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      count,
      recent: recent.map((ua) => ({
        id: ua.tier.achievement.id,
        slug: ua.tier.achievement.slug,
        name: ua.tier.nameKey ?? ua.tier.achievement.nameKey,
        iconUrl: ua.tier.iconUrl ?? ua.tier.achievement.iconUrl,
        unlockedAt: ua.earnedAt!.toISOString(),
      })),
    };
  }

  /** Get battle stats from completed sessions. */
  async getBattleStats(userId: string) {
    const result = await this.prisma.$queryRaw<Array<{ total: bigint; wins: bigint }>>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE
          (user_id = ${userId}::uuid AND user_score > opponent_score) OR
          (opponent_user_id = ${userId}::uuid AND opponent_score > user_score)
        ) as wins
      FROM learning.battle_session
      WHERE status = 'completed'
        AND (user_id = ${userId}::uuid OR opponent_user_id = ${userId}::uuid)
    `;

    const total = Number(result[0]?.total ?? 0);
    const wins = Number(result[0]?.wins ?? 0);

    return {
      battleWins: wins,
      battleTotal: total,
      battleWinRate: total > 0 ? Math.round((wins / total) * 100) : null,
    };
  }

  /** Assemble public profile based on privacy + relationship. */
  async assemblePublicProfile(
    targetUserId: string,
    viewerUserId: string | null
  ): Promise<PublicProfileData | null> {
    const profile = await this.findById(targetUserId);
    if (!profile || profile.status !== "active") return null;

    const privacyLevel = (profile.privacyLevel || "standard") as PrivacyLevel;

    // Determine relationship
    let relationship: "self" | "friend" | "stranger" | "blocked" | null = null;
    if (viewerUserId) {
      relationship = await this.getRelationship(viewerUserId, targetUserId);
    }

    // Build media URLs
    const mediaBase = `${this.env.API_PUBLIC_URL}/media`;
    const avatarUrl = profile.avatarAssetId
      ? `${mediaBase}/${profile.avatarAssetId}`
      : null;
    const coverUrl = profile.coverAssetId
      ? `${mediaBase}/${profile.coverAssetId}`
      : null;

    // Apply privacy filters
    const canSeeStats = this.canViewStats(privacyLevel, relationship);
    const canSeeAchievements = this.canViewAchievements(privacyLevel, relationship);

    let stats: PublicProfileData["stats"] = null;
    let achievements: PublicProfileData["achievements"] = null;

    if (canSeeStats) {
      const [streakStats, battleStats, achievementData] = await Promise.all([
        this.getStreakStats(targetUserId),
        this.getBattleStats(targetUserId),
        this.getAchievements(targetUserId),
      ]);

      stats = {
        ...streakStats,
        ...battleStats,
        achievementCount: achievementData.count,
      };

      if (canSeeAchievements) {
        achievements = achievementData.recent;
      }
    }

    return {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl,
      coverUrl,
      targetBjtBand: canSeeStats ? profile.targetBjtBand : null,
      learningPurpose: canSeeStats ? profile.learningPurpose : null,
      privacyLevel,
      memberSince: profile.createdAt.toISOString(),
      stats,
      achievements,
      relationship,
    };
  }

  private canViewStats(
    privacy: PrivacyLevel,
    relationship: "self" | "friend" | "stranger" | "blocked" | null
  ): boolean {
    if (relationship === "self") return true;
    if (relationship === "blocked") return false;
    if (privacy === "public") return true;
    // "standard" = visible to anyone (including anonymous visitors via shared URL)
    if (privacy === "standard") return true;
    if (privacy === "private" && relationship === "friend") return true;
    return false;
  }

  private canViewAchievements(
    privacy: PrivacyLevel,
    relationship: "self" | "friend" | "stranger" | "blocked" | null
  ): boolean {
    if (relationship === "self") return true;
    if (relationship === "blocked") return false;
    if (privacy === "public") return true;
    // "standard" = achievements visible to anyone
    if (privacy === "standard") return true;
    if (privacy === "private" && relationship === "friend") return true;
    return false;
  }
}
