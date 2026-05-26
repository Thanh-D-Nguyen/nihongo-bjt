import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Prisma } from "@nihongo-bjt/database";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { StudyGroupService } from "./study-group.service.js";

class CreateStudyGroupDto {
  @ApiProperty({ type: String, example: "BJT Lunch Break Club", maxLength: 60 })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: String, example: "15-minute reviews on weekdays.", maxLength: 1000 })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: String, enum: ["open", "invite", "closed"], example: "open" })
  @IsOptional()
  @IsIn(["open", "invite", "closed"])
  joinPolicy?: "open" | "invite" | "closed";

  @ApiPropertyOptional({ type: Number, example: 2500, minimum: 0, maximum: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  weeklyXpGoal?: number;

  @ApiPropertyOptional({ type: Number, example: 20, minimum: 2, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  memberLimit?: number;
}

class UpdateStudyGroupDto {
  @ApiPropertyOptional({ type: String, maxLength: 60 })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: String, enum: ["open", "invite", "closed"] })
  @IsOptional()
  @IsIn(["open", "invite", "closed"])
  joinPolicy?: "open" | "invite" | "closed";

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 1000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  weeklyXpGoal?: number | null;

  @ApiPropertyOptional({ type: Number, minimum: 2, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  memberLimit?: number;
}

class TargetUserDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000002" })
  @IsUUID()
  targetUserId!: string;
}

class CreateChallengeDto {
  @ApiProperty({ type: String, example: "Finish 500 XP before Sunday", maxLength: 80 })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ type: String, maxLength: 1000 })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: String, enum: ["xp", "reviews", "quizzes", "focus_minutes", "battle_wins"], example: "xp" })
  @IsOptional()
  @IsIn(["xp", "reviews", "quizzes", "focus_minutes", "battle_wins"])
  metricType?: "xp" | "reviews" | "quizzes" | "focus_minutes" | "battle_wins";

  @ApiProperty({ type: Number, example: 500, minimum: 1 })
  @IsInt()
  @Min(1)
  targetValue!: number;

  @ApiProperty({ type: String, example: "2026-05-25" })
  @IsISO8601()
  periodStart!: string;

  @ApiProperty({ type: String, example: "2026-06-01" })
  @IsISO8601()
  periodEnd!: string;

  @ApiPropertyOptional({ type: Object, example: { xp: 25, badge: "weekly-club" } })
  rewardPayload?: Record<string, unknown>;
}

class FriendRequestDto {
  @ApiProperty({ type: String, example: "00000000-0000-4000-8000-000000000002" })
  @IsUUID()
  addresseeUserId!: string;
}

class FriendResponseDto {
  @ApiProperty({ type: String, enum: ["accept", "decline"], example: "accept" })
  @IsIn(["accept", "decline"])
  response!: "accept" | "decline";
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Request body must be an object");
  }
  return body as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return optionalString(value);
}

function optionalInt(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new BadRequestException("Expected an integer value");
  return n;
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") throw new BadRequestException(`${key} is required`);
  return value;
}

function assertUuid(value: string, key: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new BadRequestException(`${key} must be a UUID`);
  }
  return value;
}

function requiredUuid(body: Record<string, unknown>, key: string): string {
  return assertUuid(requiredString(body, key), key);
}

function parseDate(value: unknown, key: string): Date {
  if (typeof value !== "string") throw new BadRequestException(`${key} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${key} must be a valid date`);
  return date;
}

@Controller("gamification")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Study Groups")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class StudyGroupController {
  constructor(@Inject(StudyGroupService) private readonly studyGroups: StudyGroupService) {}

  @Get("study-groups")
  @ApiOperation({ summary: "List study groups joined by the authenticated learner." })
  listMyGroups(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.listMyGroups(userId);
  }

  @Get("study-groups/discover")
  @ApiOperation({ summary: "Discover open study groups the learner has not joined." })
  @ApiQuery({ name: "limit", required: false, schema: { maximum: 50, minimum: 1, type: "integer" } })
  discoverGroups(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limit?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.discoverOpenGroups({ excludeUserId: userId, limit: limit ? optionalInt(limit) : undefined });
  }

  @Post("study-groups")
  @ApiOperation({ summary: "Create a study group and enroll the creator as owner." })
  @ApiBody({ type: CreateStudyGroupDto })
  createGroup(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() rawBody: unknown,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const body = asObject(rawBody);
    const joinPolicy = body.joinPolicy;
    if (joinPolicy !== undefined && joinPolicy !== "open" && joinPolicy !== "invite" && joinPolicy !== "closed") {
      throw new BadRequestException("Invalid joinPolicy");
    }
    return this.studyGroups.createGroup({
      description: optionalString(body.description),
      joinPolicy,
      memberLimit: optionalInt(body.memberLimit),
      name: requiredString(body, "name"),
      ownerUserId: userId,
      weeklyXpGoal: optionalInt(body.weeklyXpGoal),
    });
  }

  @Get("study-groups/:groupId")
  @ApiOperation({ summary: "Get study group detail, active members, and active challenges." })
  @ApiParam({ name: "groupId", type: String })
  getGroup(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.getGroupDetail({ groupId: assertUuid(groupId, "groupId"), viewerUserId: userId });
  }

  @Patch("study-groups/:groupId")
  @ApiOperation({ summary: "Update study group metadata. Requires owner/admin role." })
  @ApiBody({ type: UpdateStudyGroupDto })
  updateGroup(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
    @Body() rawBody: unknown,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const body = asObject(rawBody);
    const joinPolicy = body.joinPolicy;
    if (joinPolicy !== undefined && joinPolicy !== "open" && joinPolicy !== "invite" && joinPolicy !== "closed") {
      throw new BadRequestException("Invalid joinPolicy");
    }
    return this.studyGroups.updateGroup({
      actorUserId: userId,
      description: optionalNullableString(body.description),
      groupId: assertUuid(groupId, "groupId"),
      joinPolicy,
      memberLimit: optionalInt(body.memberLimit),
      name: optionalString(body.name),
      weeklyXpGoal: body.weeklyXpGoal === null ? null : optionalInt(body.weeklyXpGoal),
    });
  }

  @Post("study-groups/:groupId/join")
  @ApiOperation({ summary: "Join an open group or accept a pending invite." })
  joinGroup(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("groupId") groupId: string) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.joinGroup({ groupId: assertUuid(groupId, "groupId"), userId });
  }

  @Post("study-groups/:groupId/leave")
  @ApiOperation({ summary: "Leave a group. Owners must transfer ownership or archive first." })
  leaveGroup(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("groupId") groupId: string) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.leaveGroup({ groupId: assertUuid(groupId, "groupId"), userId });
  }

  @Post("study-groups/:groupId/invites")
  @ApiOperation({ summary: "Invite a learner to a study group. Requires owner/admin role." })
  @ApiBody({ type: TargetUserDto })
  inviteMember(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
    @Body() rawBody: unknown,
  ) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.inviteMember({
      actorUserId,
      groupId: assertUuid(groupId, "groupId"),
      targetUserId: requiredUuid(asObject(rawBody), "targetUserId"),
    });
  }

  @Post("study-groups/:groupId/kick")
  @ApiOperation({ summary: "Kick/ban a member from a group. Requires owner/admin role." })
  @ApiBody({ type: TargetUserDto })
  kickMember(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
    @Body() rawBody: unknown,
  ) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.kickMember({
      actorUserId,
      groupId: assertUuid(groupId, "groupId"),
      targetUserId: requiredUuid(asObject(rawBody), "targetUserId"),
    });
  }

  @Post("study-groups/:groupId/transfer-ownership")
  @ApiOperation({ summary: "Transfer group ownership to an active member." })
  @ApiBody({ type: TargetUserDto })
  transferOwnership(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
    @Body() rawBody: unknown,
  ) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.transferOwnership({
      actorUserId,
      groupId: assertUuid(groupId, "groupId"),
      targetUserId: requiredUuid(asObject(rawBody), "targetUserId"),
    });
  }

  @Post("study-groups/:groupId/archive")
  @ApiOperation({ summary: "Archive a group. Requires owner role." })
  archiveGroup(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("groupId") groupId: string) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.archiveGroup({ actorUserId, groupId: assertUuid(groupId, "groupId") });
  }

  @Get("study-groups/:groupId/challenges")
  @ApiOperation({ summary: "List active challenges for a group. Requires active membership." })
  listChallenges(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("groupId") groupId: string) {
    const viewerUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.listChallenges({ groupId: assertUuid(groupId, "groupId"), viewerUserId });
  }

  @Post("study-groups/:groupId/challenges")
  @ApiOperation({ summary: "Create a group challenge. Requires owner/admin role." })
  @ApiBody({ type: CreateChallengeDto })
  createChallenge(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("groupId") groupId: string,
    @Body() rawBody: unknown,
  ) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    const body = asObject(rawBody);
    const metricType = body.metricType;
    if (
      metricType !== undefined &&
      metricType !== "xp" &&
      metricType !== "reviews" &&
      metricType !== "quizzes" &&
      metricType !== "focus_minutes" &&
      metricType !== "battle_wins"
    ) {
      throw new BadRequestException("Invalid metricType");
    }
    return this.studyGroups.createChallenge({
      actorUserId,
      description: optionalString(body.description),
      groupId: assertUuid(groupId, "groupId"),
      metricType,
      periodEnd: parseDate(body.periodEnd, "periodEnd"),
      periodStart: parseDate(body.periodStart, "periodStart"),
      rewardPayload: asRewardPayload(body.rewardPayload),
      targetValue: optionalInt(body.targetValue) ?? 0,
      title: requiredString(body, "title"),
    });
  }

  @Get("social/friends")
  @ApiOperation({ summary: "List accepted friends plus pending incoming/outgoing friend requests." })
  listFriends(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.listSocialConnections(userId);
  }

  @Post("social/friends/request")
  @ApiOperation({ summary: "Send a friend request. If the reverse request exists, it accepts it." })
  @ApiBody({ type: FriendRequestDto })
  sendFriendRequest(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() rawBody: unknown) {
    const requesterUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.sendFriendRequest({
      addresseeUserId: requiredUuid(asObject(rawBody), "addresseeUserId"),
      requesterUserId,
    });
  }

  @Post("social/friends/requests/:connectionId/respond")
  @ApiOperation({ summary: "Accept or decline an incoming friend request." })
  @ApiBody({ type: FriendResponseDto })
  respondToFriendRequest(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("connectionId") connectionId: string,
    @Body() rawBody: unknown,
  ) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    const response = asObject(rawBody).response;
    if (response !== "accept" && response !== "decline") throw new BadRequestException("Invalid response");
    return this.studyGroups.respondToFriendRequest({ actorUserId, connectionId: assertUuid(connectionId, "connectionId"), response });
  }

  @Delete("social/friends/:peerUserId")
  @ApiOperation({ summary: "Remove an accepted friend connection." })
  removeFriend(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("peerUserId") peerUserId: string) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.removeFriend({ actorUserId, peerUserId: assertUuid(peerUserId, "peerUserId") });
  }

  @Post("social/blocks")
  @ApiOperation({ summary: "Block another learner and hide any friend connection." })
  @ApiBody({ type: TargetUserDto })
  blockUser(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() rawBody: unknown) {
    const actorUserId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.studyGroups.blockUser({
      actorUserId,
      targetUserId: requiredUuid(asObject(rawBody), "targetUserId"),
    });
  }
}

function asRewardPayload(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("rewardPayload must be an object");
  }
  return value as Prisma.InputJsonValue;
}
