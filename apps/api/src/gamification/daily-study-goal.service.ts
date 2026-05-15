import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger } from "@nestjs/common";

const TASK_PRESETS: Record<
  number,
  Array<{ taskType: string; targetCount: number; sortOrder: number }>
> = {
  5: [
    { taskType: "srs_review", targetCount: 5, sortOrder: 0 },
    { taskType: "daily_phrase", targetCount: 1, sortOrder: 1 },
  ],
  10: [
    { taskType: "srs_review", targetCount: 10, sortOrder: 0 },
    { taskType: "daily_phrase", targetCount: 2, sortOrder: 1 },
    { taskType: "bjt_quiz", targetCount: 1, sortOrder: 2 },
  ],
  20: [
    { taskType: "srs_review", targetCount: 15, sortOrder: 0 },
    { taskType: "bjt_quiz", targetCount: 1, sortOrder: 1 },
    { taskType: "daily_phrase", targetCount: 3, sortOrder: 2 },
    { taskType: "battle_bot", targetCount: 1, sortOrder: 3 },
  ],
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class DailyStudyGoalService {
  private readonly logger = new Logger(DailyStudyGoalService.name);
  private readonly prisma = createPrismaClient();

  /** Get daily goal preference */
  async getGoal(userId: string) {
    return this.prisma.dailyStudyGoal.findUnique({
      where: { userId },
    });
  }

  /** Set or update daily goal preference */
  async setGoal(userId: string, targetMinutes: number) {
    return this.prisma.dailyStudyGoal.upsert({
      where: { userId },
      create: { userId, targetMinutes },
      update: { targetMinutes },
    });
  }

  /** Get today's plan, auto-generate if missing */
  async getTodayPlan(userId: string) {
    const today = todayDate();
    let plan = await this.prisma.dailyStudyPlan.findUnique({
      where: {
        userId_planDate: { userId, planDate: new Date(today) },
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });

    if (!plan) {
      const goal = await this.prisma.dailyStudyGoal.findUnique({
        where: { userId },
      });
      const minutes = goal?.targetMinutes ?? 10;
      plan = await this.generatePlan(userId, minutes, today);
    }

    const totalTasks = plan.tasks.length;
    const doneTasks = plan.tasks.filter((t) => t.completedAt !== null).length;
    const progressPct =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return {
      ...plan,
      progressPct,
      isComplete: plan.completedAt !== null,
    };
  }

  private async generatePlan(
    userId: string,
    targetMinutes: number,
    dateStr: string,
  ) {
    const preset = TASK_PRESETS[targetMinutes] ?? TASK_PRESETS[10]!;
    return this.prisma.dailyStudyPlan.create({
      data: {
        userId,
        planDate: new Date(dateStr),
        targetMinutes,
        tasks: { create: preset },
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
  }

  /** Record completion of a task item */
  async recordTaskProgress(userId: string, taskType: string) {
    const today = todayDate();
    const plan = await this.prisma.dailyStudyPlan.findUnique({
      where: {
        userId_planDate: { userId, planDate: new Date(today) },
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!plan) return null;

    // Find the first incomplete task of this type
    const task = plan.tasks.find(
      (t) => t.taskType === taskType && !t.completedAt,
    );
    if (!task) return null;

    const newDone = task.doneCount + 1;
    const isTaskComplete = newDone >= task.targetCount;

    await this.prisma.dailyStudyTask.update({
      where: { id: task.id },
      data: {
        doneCount: newDone,
        completedAt: isTaskComplete ? new Date() : null,
      },
    });

    // Check if all tasks complete → mark plan complete
    if (isTaskComplete) {
      const remaining = plan.tasks.filter(
        (t) => t.id !== task.id && !t.completedAt,
      );
      if (remaining.length === 0) {
        await this.prisma.dailyStudyPlan.update({
          where: { id: plan.id },
          data: { completedAt: new Date() },
        });
      }
    }

    return this.getTodayPlan(userId);
  }
}
