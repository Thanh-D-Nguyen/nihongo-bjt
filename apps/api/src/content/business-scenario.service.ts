import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

@Injectable()
export class BusinessScenarioService {
  private readonly prisma = createPrismaClient();

  /** List active scenarios */
  async listScenarios(category?: string) {
    return this.prisma.businessScenario.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        titleVi: true,
        titleJa: true,
        descriptionVi: true,
        difficulty: true,
        category: true,
        iconEmoji: true,
        estimatedMin: true,
        _count: { select: { steps: true, attempts: true } },
      },
    });
  }

  /** Get scenario with steps for playing (hides feedback/optimal until answered) */
  async getScenario(scenarioId: string) {
    const scenario = await this.prisma.businessScenario.findUnique({
      where: { id: scenarioId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          include: {
            choices: {
              select: { id: true, choiceKey: true, textVi: true, textJa: true },
              orderBy: { choiceKey: "asc" },
            },
          },
        },
      },
    });
    if (!scenario) throw new NotFoundException("Scenario not found");
    return scenario;
  }

  /** Submit a choice and get feedback */
  async submitChoice(stepId: string, choiceKey: string) {
    const choice = await this.prisma.scenarioChoice.findFirst({
      where: { stepId, choiceKey },
    });
    if (!choice) throw new NotFoundException("Choice not found");

    return {
      choiceKey: choice.choiceKey,
      isOptimal: choice.isOptimal,
      feedbackVi: choice.feedbackVi,
      pointsAwarded: choice.pointsAwarded,
    };
  }

  /** Complete scenario — save attempt */
  async completeScenario(
    userId: string,
    scenarioId: string,
    choices: { stepOrder: number; choiceKey: string; points: number }[],
  ) {
    const totalPoints = choices.reduce((sum, c) => sum + c.points, 0);

    // Calculate max possible points
    const steps = await this.prisma.scenarioStep.findMany({
      where: { scenarioId },
      include: { choices: true },
    });
    const maxPoints = steps.reduce((sum, s) => {
      const best = Math.max(...s.choices.map((c) => c.pointsAwarded), 0);
      return sum + best;
    }, 0);

    return this.prisma.userScenarioAttempt.create({
      data: {
        userId,
        scenarioId,
        totalPoints,
        maxPoints,
        choices: choices as any,
      },
    });
  }

  /** Get user's attempt history for a scenario */
  async getAttempts(userId: string, scenarioId: string) {
    return this.prisma.userScenarioAttempt.findMany({
      where: { userId, scenarioId },
      orderBy: { completedAt: "desc" },
      take: 5,
    });
  }
}
