import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingPreferences {
  /** Self-assessed JLPT level: 1(N1) – 5(N5), 0 = unsure */
  currentLevel: number;
  /** Primary goal */
  goal: LearningGoal;
  /** Topics of interest (max 5) */
  topics: string[];
  /** Daily time commitment in minutes */
  dailyMinutes: number;
  /** Learning style preference */
  style: LearningStyle;
  /** Has completed onboarding */
  completed: boolean;
  /** When preferences were last updated */
  updatedAt: string | null;
}

export type LearningGoal =
  | "pass_bjt"
  | "business_japanese"
  | "daily_conversation"
  | "reading_news"
  | "jlpt_prep"
  | "travel"
  | "general";

export type LearningStyle =
  | "visual"       // prefer reading/images
  | "practice"     // prefer exercises/drills
  | "immersion"    // prefer news/articles
  | "flashcard"    // prefer SRS repetition
  | "mixed";       // no preference

export const AVAILABLE_TOPICS = [
  "business_meeting",
  "business_email",
  "business_phone",
  "business_presentation",
  "daily_greetings",
  "daily_shopping",
  "daily_restaurant",
  "daily_transport",
  "news_politics",
  "news_economy",
  "news_technology",
  "news_culture",
  "grammar_n1",
  "grammar_n2",
  "grammar_n3",
  "grammar_n4",
  "grammar_n5",
  "keigo",
  "kanjii",
  "idioms",
] as const;

export interface SaveOnboardingInput {
  currentLevel: number;
  goal: LearningGoal;
  topics: string[];
  dailyMinutes: number;
  style: LearningStyle;
}

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class OnboardingRepository {
  private readonly logger = new Logger(OnboardingRepository.name);
  private readonly prisma = createPrismaClient();

  async getPreferences(userId: string): Promise<OnboardingPreferences | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        {
          current_level: number;
          goal: string;
          topics: string[];
          daily_minutes: number;
          style: string;
          completed: boolean;
          updated_at: Date;
        }[]
      >(
        `SELECT current_level, goal, topics, daily_minutes, style, completed, updated_at
         FROM recommendation.onboarding_preferences
         WHERE user_id = $1::uuid`,
        userId,
      );

      if (rows.length === 0) return null;

      const r = rows[0];
      return {
        currentLevel: r.current_level,
        goal: r.goal as LearningGoal,
        topics: r.topics,
        dailyMinutes: r.daily_minutes,
        style: r.style as LearningStyle,
        completed: r.completed,
        updatedAt: r.updated_at.toISOString(),
      };
    } catch {
      // Table might not exist yet — graceful degradation
      return null;
    }
  }

  async savePreferences(userId: string, input: SaveOnboardingInput): Promise<OnboardingPreferences> {
    const topics = input.topics.slice(0, 5); // max 5 topics

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO recommendation.onboarding_preferences
         (user_id, current_level, goal, topics, daily_minutes, style, completed, updated_at)
       VALUES ($1::uuid, $2, $3, $4::text[], $5, $6, true, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         current_level = EXCLUDED.current_level,
         goal = EXCLUDED.goal,
         topics = EXCLUDED.topics,
         daily_minutes = EXCLUDED.daily_minutes,
         style = EXCLUDED.style,
         completed = true,
         updated_at = NOW()`,
      userId,
      input.currentLevel,
      input.goal,
      topics,
      input.dailyMinutes,
      input.style,
    );

    return {
      currentLevel: input.currentLevel,
      goal: input.goal,
      topics,
      dailyMinutes: input.dailyMinutes,
      style: input.style,
      completed: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ completed: boolean }[]>(
        `SELECT completed FROM recommendation.onboarding_preferences WHERE user_id = $1::uuid`,
        userId,
      );
      return rows.length > 0 && rows[0].completed;
    } catch {
      return false;
    }
  }
}
