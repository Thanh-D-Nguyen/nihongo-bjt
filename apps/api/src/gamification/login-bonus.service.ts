import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

const DAILY_REWARDS: Array<{ type: string; value: string; label: string }> = [
  { type: "xp", value: "10", label: "+10 XP" },
  { type: "xp", value: "15", label: "+15 XP" },
  { type: "xp", value: "20", label: "+20 XP" },
  { type: "freeze", value: "1", label: "+1 Streak Freeze" },
  { type: "xp", value: "25", label: "+25 XP" },
  { type: "xp", value: "30", label: "+30 XP" },
  { type: "bonus_reviews", value: "10", label: "+10 Extra Reviews" }, // Day 7 big reward
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round(Math.abs(db - da) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class LoginBonusService {
  private readonly logger = new Logger(LoginBonusService.name);
  private readonly prisma = createPrismaClient();

  /** Get current chain status */
  async getChainStatus(userId: string) {
    const today = todayDate();
    let chain = await this.prisma.loginBonusChain.findUnique({
      where: { userId },
    });

    if (chain) {
      // Check if chain is broken (missed a day)
      if (chain.lastClaimDate) {
        const lastClaim = chain.lastClaimDate.toISOString().slice(0, 10);
        const gap = daysBetween(lastClaim, today);
        if (gap > 1) {
          // Chain broken — reset
          chain = await this.prisma.loginBonusChain.update({
            where: { userId },
            data: {
              chainDay: 1,
              lastClaimDate: null,
              chainStartDate: new Date(today),
            },
          });
        }
      }
    }

    const canClaim = chain
      ? !chain.lastClaimDate ||
        chain.lastClaimDate.toISOString().slice(0, 10) !== today
      : true;

    const currentDay = chain?.chainDay ?? 1;

    return {
      chainDay: currentDay,
      canClaim,
      rewards: DAILY_REWARDS.map((r, i) => ({
        day: i + 1,
        ...r,
        claimed: chain ? i + 1 < currentDay : false,
        current: i + 1 === currentDay,
        isBigReward: i === 6,
      })),
    };
  }

  /** Claim today's bonus */
  async claimBonus(userId: string) {
    const today = todayDate();
    let chain = await this.prisma.loginBonusChain.findUnique({
      where: { userId },
    });

    if (!chain) {
      // First time — create chain
      chain = await this.prisma.loginBonusChain.create({
        data: { userId, chainDay: 1, chainStartDate: new Date(today) },
      });
    }

    // Check if already claimed today
    if (chain.lastClaimDate?.toISOString().slice(0, 10) === today) {
      return { alreadyClaimed: true, chainDay: chain.chainDay };
    }

    // Check if chain broken
    if (chain.lastClaimDate) {
      const gap = daysBetween(
        chain.lastClaimDate.toISOString().slice(0, 10),
        today,
      );
      if (gap > 1) {
        chain = await this.prisma.loginBonusChain.update({
          where: { userId },
          data: {
            chainDay: 1,
            lastClaimDate: null,
            chainStartDate: new Date(today),
          },
        });
      }
    }

    const rewardIndex = (chain.chainDay - 1) % 7;
    const reward = DAILY_REWARDS[rewardIndex]!;

    // Record claim
    await this.prisma.loginBonusClaim.create({
      data: {
        userId,
        chainDay: chain.chainDay,
        rewardType: reward.type,
        rewardValue: reward.value,
      },
    });

    // Advance chain (reset to 1 after day 7)
    const nextDay = chain.chainDay >= 7 ? 1 : chain.chainDay + 1;
    const nextStart =
      chain.chainDay >= 7 ? new Date(today) : chain.chainStartDate;

    await this.prisma.loginBonusChain.update({
      where: { userId },
      data: {
        chainDay: nextDay,
        lastClaimDate: new Date(today),
        chainStartDate: nextStart,
      },
    });

    return {
      alreadyClaimed: false,
      claimed: true,
      chainDay: chain.chainDay,
      reward: { type: reward.type, value: reward.value, label: reward.label },
    };
  }
}
