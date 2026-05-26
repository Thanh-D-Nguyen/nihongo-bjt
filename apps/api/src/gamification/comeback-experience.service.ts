import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

/**
 * Comeback Experience Service — detects users who have been inactive for
 * N+ days and generates personalized "catch-up" plans to smoothly
 * re-engage them without overwhelming.
 *
 * Strategies:
 * 1. **Reduced daily goals** — halve the target minutes for the first 3 days back
 * 2. **Easier content** — temporarily lower adaptive difficulty by one level
 * 3. **Mystery box incentive** — grant a free mystery box claim on return
 * 4. **Streak amnesty** — offer a discounted streak-restore if streak was <7
 * 5. **Welcome-back summary** — show what they missed (new content, friend activity)
 *
 * Detection criteria:
 * - "Absent" = no activity event for N days (default: 3 days for mild, 7+ for serious)
 * - "Churned" = 14+ days absent, requires stronger re-engagement
 */

export interface ComebackPlan {
  userId: string;
  absentDays: number;
  tier: "mild" | "serious" | "churned";
  actions: ComebackAction[];
  /** Reduced daily goal (minutes) for the comeback period */
  reducedGoalMinutes: number;
  /** How many days the reduced plan lasts */
  comebackDurationDays: number;
  /** Suggested difficulty override */
  suggestedDifficulty: string;
}

export interface ComebackAction {
  type: "mystery_box" | "reduced_goal" | "difficulty_ease" | "streak_amnesty" | "welcome_summary";
  label: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class ComebackExperienceService {
  private readonly logger = new Logger(ComebackExperienceService.name);
  private readonly prisma = createPrismaClient();

  /** Absence thresholds */
  private static readonly MILD_DAYS = 3;
  private static readonly SERIOUS_DAYS = 7;
  private static readonly CHURNED_DAYS = 14;

  /**
   * Check if a user qualifies for a comeback experience.
   * Returns null if user is active (no comeback needed).
   */
  async checkComebackEligibility(userId: string): Promise<ComebackPlan | null> {
    const streak = await this.prisma.userStreak.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    if (!streak?.lastActivityDate) {
      // Never had activity — this is onboarding, not comeback
      return null;
    }

    const now = new Date();
    const lastActive = new Date(streak.lastActivityDate);
    const absentDays = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (absentDays < ComebackExperienceService.MILD_DAYS) return null;

    const tier = this.classifyAbsence(absentDays);
    const plan = await this.buildComebackPlan(userId, absentDays, tier, streak);
    return plan;
  }

  /**
   * Activate the comeback plan for a user — applies the temporary adjustments.
   * Idempotent: safe to call multiple times (uses upsert patterns).
   */
  async activateComebackPlan(userId: string, plan: ComebackPlan): Promise<void> {
    const actions: Promise<unknown>[] = [];

    for (const action of plan.actions) {
      switch (action.type) {
        case "reduced_goal":
          actions.push(this.applyReducedGoal(userId, plan.reducedGoalMinutes));
          break;
        case "mystery_box":
          actions.push(this.grantComebackMysteryBox(userId));
          break;
        case "streak_amnesty":
          // Just log — actual streak restore requires user confirmation
          this.logger.log(`Streak amnesty available for user ${userId}`);
          break;
        default:
          break;
      }
    }

    await Promise.allSettled(actions);
    this.logger.log(
      `Comeback plan activated for user ${userId} (tier=${plan.tier}, absent=${plan.absentDays}d)`,
    );
  }

  /**
   * Generate a "what you missed" summary for the welcome-back screen.
   */
  async getWelcomeBackSummary(userId: string): Promise<{
    absentDays: number;
    newContentCount: number;
    friendActivity: number;
    petHappiness: number | null;
    streakLost: number;
  }> {
    const streak = await this.prisma.userStreak.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    const lastActive = streak?.lastActivityDate
      ? new Date(streak.lastActivityDate)
      : new Date();
    const absentDays = Math.floor(
      (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Count new content added since last activity
    const newContentCount = await this.prisma.dailyContentItem.count({
      where: { createdAt: { gte: lastActive } },
    });

    // Count friend activity (social connections with activity)
    const friendActivity = await this.prisma.userSocialConnection.count({
      where: {
        OR: [
          { requesterUserId: userId, status: "accepted" },
          { addresseeUserId: userId, status: "accepted" },
        ],
        updatedAt: { gte: lastActive },
      },
    });

    // Pet happiness
    const pet = await this.prisma.companionPet.findUnique({
      where: { userId },
      select: { happiness: true },
    });

    return {
      absentDays,
      newContentCount,
      friendActivity,
      petHappiness: pet?.happiness ?? null,
      streakLost: streak?.currentStreak === 0 ? (streak.longestStreak ?? 0) : 0,
    };
  }

  /**
   * Cron-friendly: find all users eligible for comeback and return their plans.
   * Used by smart-notification to send "welcome back" pushes.
   */
  async findEligibleUsers(limit = 100): Promise<ComebackPlan[]> {
    const cutoffMild = new Date();
    cutoffMild.setDate(cutoffMild.getDate() - ComebackExperienceService.MILD_DAYS);

    const inactiveStreaks = await this.prisma.userStreak.findMany({
      where: {
        lastActivityDate: { lt: cutoffMild },
      },
      select: {
        userId: true,
        lastActivityDate: true,
        currentStreak: true,
        longestStreak: true,
      },
      take: limit,
      orderBy: { lastActivityDate: "asc" },
    });

    const plans: ComebackPlan[] = [];
    for (const streak of inactiveStreaks) {
      if (!streak.lastActivityDate) continue;
      const absentDays = Math.floor(
        (Date.now() - new Date(streak.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      const tier = this.classifyAbsence(absentDays);
      const plan = await this.buildComebackPlan(streak.userId, absentDays, tier, streak);
      plans.push(plan);
    }

    return plans;
  }

  // ─── Private helpers ───────────────────────────────────────────────────

  private classifyAbsence(days: number): "mild" | "serious" | "churned" {
    if (days >= ComebackExperienceService.CHURNED_DAYS) return "churned";
    if (days >= ComebackExperienceService.SERIOUS_DAYS) return "serious";
    return "mild";
  }

  private async buildComebackPlan(
    userId: string,
    absentDays: number,
    tier: "mild" | "serious" | "churned",
    streak: { currentStreak: number; longestStreak: number },
  ): Promise<ComebackPlan> {
    // Get user's normal daily goal
    const goal = await this.prisma.dailyStudyGoal.findUnique({
      where: { userId },
    });
    const normalMinutes = goal?.targetMinutes ?? 15;

    const actions: ComebackAction[] = [];

    // Always: reduced goal
    const reductionFactor = tier === "churned" ? 0.33 : tier === "serious" ? 0.5 : 0.75;
    const reducedGoalMinutes = Math.max(5, Math.round(normalMinutes * reductionFactor));
    actions.push({
      type: "reduced_goal",
      label: `Mục tiêu giảm xuống ${reducedGoalMinutes} phút/ngày`,
      payload: { normalMinutes, reducedGoalMinutes },
    });

    // Difficulty ease
    actions.push({
      type: "difficulty_ease",
      label: "Độ khó giảm nhẹ để lấy lại phong độ",
    });

    // Mystery box for serious/churned
    if (tier !== "mild") {
      actions.push({
        type: "mystery_box",
        label: "Quà chào mừng quay lại! 🎁",
        payload: { reason: "comeback" },
      });
    }

    // Streak amnesty if streak was meaningful
    if (streak.currentStreak === 0 && streak.longestStreak >= 3) {
      actions.push({
        type: "streak_amnesty",
        label: `Khôi phục streak ${Math.min(streak.longestStreak, 7)} ngày (giá ưu đãi)`,
        payload: { maxRestore: Math.min(streak.longestStreak, 7) },
      });
    }

    // Welcome summary
    actions.push({
      type: "welcome_summary",
      label: "Xem bạn đã bỏ lỡ gì",
    });

    const comebackDurationDays = tier === "churned" ? 5 : tier === "serious" ? 3 : 2;
    const suggestedDifficulty = tier === "churned" ? "easy" : "medium";

    return {
      userId,
      absentDays,
      tier,
      actions,
      reducedGoalMinutes,
      comebackDurationDays,
      suggestedDifficulty,
    };
  }

  private async applyReducedGoal(userId: string, minutes: number): Promise<void> {
    await this.prisma.dailyStudyGoal.upsert({
      where: { userId },
      create: { userId, targetMinutes: minutes },
      update: { targetMinutes: minutes },
    });
  }

  private async grantComebackMysteryBox(userId: string): Promise<void> {
    // Find an active reward to grant
    const reward = await this.prisma.mysteryBoxReward.findFirst({
      where: { active: true },
      orderBy: { weight: "desc" },
    });
    if (!reward) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Idempotent — skip if already claimed today
    const existing = await this.prisma.mysteryBoxClaim.findUnique({
      where: { userId_claimDate: { userId, claimDate: today } },
    });
    if (existing) return;

    await this.prisma.mysteryBoxClaim.create({
      data: {
        userId,
        rewardId: reward.id,
        claimDate: today,
      },
    });
  }
}
