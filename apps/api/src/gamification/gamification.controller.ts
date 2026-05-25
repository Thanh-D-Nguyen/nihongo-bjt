import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CompanionPetService } from "./companion-pet.service.js";
import { DailyStudyGoalService } from "./daily-study-goal.service.js";
import { GamificationService } from "./gamification.service.js";
import { LoginBonusService } from "./login-bonus.service.js";
import { MysteryBoxService } from "./mystery-box.service.js";
import { StudyTimerService } from "./study-timer.service.js";

@Controller("gamification")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Gamification")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class GamificationController {
  constructor(
    @Inject(GamificationService) private readonly svc: GamificationService,
    @Inject(DailyStudyGoalService)
    private readonly dailyStudyGoalService: DailyStudyGoalService,
    @Inject(LoginBonusService)
    private readonly loginBonusService: LoginBonusService,
    @Inject(StudyTimerService)
    private readonly studyTimerService: StudyTimerService,
    @Inject(MysteryBoxService)
    private readonly mysteryBoxService: MysteryBoxService,
    @Inject(CompanionPetService)
    private readonly companionPetService: CompanionPetService,
  ) {}

  /* ── Streaks ─────────────────────────────────────────────────────────── */

  @Get("streaks")
  @ApiOperation({ summary: "Get all streak data for the current user." })
  async getStreaks(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserStreaks(resolved);
  }

  @Post("streaks/record")
  @ApiOperation({
    summary: "Record an activity for streak tracking.",
    description: "Records the user performed an activity (review, exercise, quiz, battle). Updates all matching streak configs."
  })
  @ApiQuery({ name: "activityType", required: true, schema: { type: "string", enum: ["review", "exercise", "quiz", "battle"] } })
  async recordActivity(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("activityType") activityType: string
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    await this.svc.recordActivity(resolved, activityType);
    return { success: true };
  }

  /* ── Achievements ────────────────────────────────────────────────────── */

  @Get("achievements")
  @ApiOperation({ summary: "Get all achievement definitions with tiers." })
  async getAchievementDefinitions() {
    return this.svc.getAllAchievementDefinitions();
  }
  @Get("achievements/browse")
  @ApiOperation({ summary: "Browse all achievements with user progress overlay." })
  async browseAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.browseAllAchievements(resolved);
  }
  @Get("achievements/me")
  @ApiOperation({ summary: "Get the current user's achievement progress and earned tiers." })
  async getMyAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserAchievements(resolved);
  }

  @Get("achievements/me/earned")
  @ApiOperation({ summary: "Get only the user's earned achievements (for profile/share)." })
  async getMyEarnedAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserEarnedAchievements(resolved);
  }

  @Get("achievements/me/pending")
  @ApiOperation({ summary: "Get newly earned achievements not yet shown to user." })
  async getPendingAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getPendingNotifications(resolved);
  }

  @Post("achievements/me/acknowledge")
  @ApiOperation({ summary: "Mark achievements as acknowledged/shown." })
  async acknowledgeAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Body() body: { ids: string[] }
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.acknowledgeNotifications(resolved, body.ids);
  }

  /* ── Leaderboards ────────────────────────────────────────────────────── */

  @Get("leaderboards")
  @ApiOperation({ summary: "List all enabled leaderboards." })
  async listLeaderboards() {
    return this.svc.getEnabledLeaderboards();
  }

  @Get("leaderboards/:id")
  @ApiOperation({ summary: "Get leaderboard entries (ranked list) for a specific board." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async getLeaderboard(@Param("id") id: string) {
    return this.svc.getLeaderboard(id);
  }

  @Get("leaderboards/:id/me")
  @ApiOperation({ summary: "Get the current user's rank on a specific leaderboard." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async getMyRank(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") leaderboardId: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserRank(leaderboardId, resolved);
  }

  /* ── Daily Study Goal ────────────────────────────────────────────────── */

  @Get("study-goal")
  @ApiOperation({ summary: "Get daily study goal preference." })
  async getStudyGoal(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.dailyStudyGoalService.getGoal(userId);
  }

  @Post("study-goal")
  @ApiOperation({ summary: "Set daily study goal (5, 10, or 20 minutes)." })
  async setStudyGoal(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const targetMinutes = Number(body.targetMinutes);
    if (![5, 10, 20].includes(targetMinutes)) {
      throw new BadRequestException("targetMinutes must be 5, 10, or 20");
    }
    return this.dailyStudyGoalService.setGoal(userId, targetMinutes);
  }

  @Get("study-plan/today")
  @ApiOperation({
    summary: "Get today's study plan (auto-generated if missing).",
  })
  async getTodayPlan(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.dailyStudyGoalService.getTodayPlan(userId);
  }

  @Post("study-plan/progress")
  @ApiOperation({ summary: "Record progress on a study task type." })
  async recordProgress(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const taskType = String(body.taskType ?? "");
    if (
      !["srs_review", "bjt_quiz", "daily_phrase", "battle_bot"].includes(
        taskType,
      )
    ) {
      throw new BadRequestException("Invalid taskType");
    }
    return this.dailyStudyGoalService.recordTaskProgress(userId, taskType);
  }

  /* ── Login Bonus Chain ───────────────────────────────────────────────── */

  @Get("login-bonus")
  @ApiOperation({ summary: "Get login bonus chain status." })
  getLoginBonus(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.loginBonusService.getChainStatus(userId);
  }

  @Post("login-bonus/claim")
  @ApiOperation({ summary: "Claim today's login bonus." })
  claimLoginBonus(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.loginBonusService.claimBonus(userId);
  }

  /* ── Focus / Study Timer ─────────────────────────────────────────────── */

  @Post("focus/start")
  @ApiOperation({ summary: "Start a focus study session." })
  startFocus(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const duration = Number(body.durationMinutes ?? 15);
    const mode = String(body.mode ?? "focus");
    return this.studyTimerService.startSession(userId, duration, mode);
  }

  @Post("focus/end")
  @ApiOperation({ summary: "End a focus study session." })
  endFocus(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const sessionId = String(body.sessionId ?? "");
    const completed = body.completed === true;
    return this.studyTimerService.endSession(userId, sessionId, completed, {
      reviewsDone: Number(body.reviewsDone ?? 0),
      quizzesDone: Number(body.quizzesDone ?? 0),
      xpEarned: Number(body.xpEarned ?? 0),
    });
  }

  @Get("focus/today")
  @ApiOperation({ summary: "Get today's focus session stats." })
  focusToday(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyTimerService.getTodayStats(userId);
  }

  @Get("focus/weekly")
  @ApiOperation({ summary: "Get weekly focus session stats." })
  focusWeekly(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyTimerService.getWeeklyStats(userId);
  }

  /* ── Mystery Box / Gacha ─────────────────────────────────────────────── */

  @Get("mystery-box/status")
  @ApiOperation({ summary: "Get today's mystery box status (can open, already claimed, goal complete)." })
  mysteryBoxStatus(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.mysteryBoxService.getStatus(userId);
  }

  @Post("mystery-box/open")
  @ApiOperation({ summary: "Open today's mystery box (requires daily goal completion)." })
  openMysteryBox(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.mysteryBoxService.openBox(userId);
  }

  @Get("mystery-box/history")
  @ApiOperation({ summary: "Get mystery box claim history (last 14 days)." })
  mysteryBoxHistory(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.mysteryBoxService.getHistory(userId);
  }

  /* ── Companion Pet (Tamagotchi) ──────────────────────────────────────── */

  @Get("pet")
  @ApiOperation({ summary: "Get companion pet status (creates pet if none exists)." })
  getPet(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.companionPetService.getPet(userId);
  }

  @Post("pet/feed")
  @ApiOperation({ summary: "Feed companion pet (triggered by study activity)." })
  feedPet(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const action = String(body.action ?? "review");
    return this.companionPetService.feedPet(userId, action);
  }

  @Post("pet/rename")
  @ApiOperation({ summary: "Rename companion pet." })
  renamePet(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const name = String(body.name ?? "");
    return this.companionPetService.renamePet(userId, name);
  }

  @Get("pet/costumes")
  @ApiOperation({ summary: "List user's owned pet costumes." })
  getPetCostumes(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.companionPetService.getCostumes(userId);
  }
}
