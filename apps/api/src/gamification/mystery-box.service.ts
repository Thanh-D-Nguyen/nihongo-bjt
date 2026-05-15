import { Injectable, BadRequestException } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

@Injectable()
export class MysteryBoxService {
  private readonly prisma = createPrismaClient();

  /** Get today's mystery box status for the user. */
  async getStatus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayClaim = await this.prisma.mysteryBoxClaim.findUnique({
      where: { userId_claimDate: { userId, claimDate: today } },
      include: { reward: true },
    });

    // Check daily study plan completion
    const plan = await this.prisma.dailyStudyPlan.findFirst({
      where: { userId, planDate: today },
      include: { tasks: true },
    });
    const goalComplete = plan
      ? plan.tasks.length > 0 && plan.tasks.every((t) => t.doneCount >= t.targetCount)
      : false;

    return {
      canOpen: goalComplete && !todayClaim,
      alreadyClaimed: !!todayClaim,
      todayReward: todayClaim
        ? {
            slug: todayClaim.reward.slug,
            nameVi: todayClaim.reward.nameVi,
            rewardType: todayClaim.reward.rewardType,
            rewardValue: todayClaim.reward.rewardValue,
            rarity: todayClaim.reward.rarity,
            iconEmoji: todayClaim.reward.iconEmoji,
          }
        : null,
      goalComplete,
    };
  }

  /** Open the mystery box — weighted random selection. One per day. */
  async openBox(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check already claimed
    const existing = await this.prisma.mysteryBoxClaim.findUnique({
      where: { userId_claimDate: { userId, claimDate: today } },
    });
    if (existing) throw new BadRequestException("Already claimed today");

    // Check goal completion
    const plan = await this.prisma.dailyStudyPlan.findFirst({
      where: { userId, planDate: today },
      include: { tasks: true },
    });
    const goalComplete = plan
      ? plan.tasks.length > 0 && plan.tasks.every((t) => t.doneCount >= t.targetCount)
      : false;
    if (!goalComplete) throw new BadRequestException("Complete daily goal first");

    // Get active rewards
    const rewards = await this.prisma.mysteryBoxReward.findMany({
      where: { active: true },
    });
    if (rewards.length === 0) throw new BadRequestException("No rewards available");

    // Weighted random selection
    const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = rewards[0];
    for (const reward of rewards) {
      roll -= reward.weight;
      if (roll <= 0) {
        selected = reward;
        break;
      }
    }

    // Create claim
    const claim = await this.prisma.mysteryBoxClaim.create({
      data: { userId, rewardId: selected.id, claimDate: today },
    });

    return {
      claimId: claim.id,
      reward: {
        slug: selected.slug,
        nameVi: selected.nameVi,
        nameJa: selected.nameJa,
        rewardType: selected.rewardType,
        rewardValue: selected.rewardValue,
        rarity: selected.rarity,
        iconEmoji: selected.iconEmoji,
        description: selected.description,
      },
    };
  }

  /** Get claim history for the user. */
  async getHistory(userId: string, limit = 14) {
    const claims = await this.prisma.mysteryBoxClaim.findMany({
      where: { userId },
      include: { reward: true },
      orderBy: { claimedAt: "desc" },
      take: limit,
    });

    return claims.map((c) => ({
      date: c.claimDate,
      reward: {
        slug: c.reward.slug,
        nameVi: c.reward.nameVi,
        rarity: c.reward.rarity,
        iconEmoji: c.reward.iconEmoji,
        rewardType: c.reward.rewardType,
      },
    }));
  }
}
