import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

type JoinPolicy = "open" | "invite" | "closed";
type ChallengeMetric = "xp" | "reviews" | "quizzes" | "focus_minutes" | "battle_wins";
type FriendResponse = "accept" | "decline";

const GROUP_MEMBER_LIMIT = 50;
const GROUP_MEMBER_SELECT = {
  id: true,
  joinedAt: true,
  role: true,
  status: true,
  user: {
    select: {
      avatarAssetId: true,
      displayName: true,
      id: true,
    },
  },
  userId: true,
} satisfies Prisma.StudyGroupMemberSelect;

const SOCIAL_PROFILE_SELECT = {
  avatarAssetId: true,
  displayName: true,
  id: true,
} satisfies Prisma.UserProfileSelect;

export function buildSocialPairKey(aUserId: string, bUserId: string): string {
  const [first, second] = [aUserId, bUserId].sort();
  return `${first}:${second}`;
}

function isJoinPolicy(value: unknown): value is JoinPolicy {
  return value === "open" || value === "invite" || value === "closed";
}

function isChallengeMetric(value: unknown): value is ChallengeMetric {
  return (
    value === "xp" ||
    value === "reviews" ||
    value === "quizzes" ||
    value === "focus_minutes" ||
    value === "battle_wins"
  );
}

function normalizeText(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function assertModerator(member: { role: string; status: string } | null): asserts member is {
  role: "owner" | "admin";
  status: "active";
} {
  if (!member || member.status !== "active" || (member.role !== "owner" && member.role !== "admin")) {
    throw new ForbiddenException("Only active owner/admin members can manage this group");
  }
}

function assertOwner(member: { role: string; status: string } | null): asserts member is {
  role: "owner";
  status: "active";
} {
  if (!member || member.status !== "active" || member.role !== "owner") {
    throw new ForbiddenException("Only the group owner can perform this action");
  }
}

@Injectable()
export class StudyGroupService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async createGroup(input: {
    ownerUserId: string;
    name: string;
    description?: string;
    joinPolicy?: JoinPolicy;
    weeklyXpGoal?: number;
    memberLimit?: number;
  }) {
    const name = normalizeText(input.name, 60);
    if (!name) throw new BadRequestException("name is required");
    const joinPolicy = input.joinPolicy ?? "open";
    if (!isJoinPolicy(joinPolicy)) throw new BadRequestException("Invalid joinPolicy");
    const memberLimit = Math.min(Math.max(input.memberLimit ?? GROUP_MEMBER_LIMIT, 2), GROUP_MEMBER_LIMIT);
    const weeklyXpGoal = input.weeklyXpGoal;
    if (weeklyXpGoal != null && (!Number.isInteger(weeklyXpGoal) || weeklyXpGoal < 0 || weeklyXpGoal > 1_000_000)) {
      throw new BadRequestException("weeklyXpGoal must be an integer between 0 and 1000000");
    }

    const groupId = await this.prisma.$transaction(async (tx) => {
      await this.ensureActiveUser(input.ownerUserId, tx);
      const group = await tx.studyGroup.create({
        data: {
          description: normalizeText(input.description, 1000),
          joinPolicy,
          memberLimit,
          name,
          ownerUserId: input.ownerUserId,
          weeklyXpGoal,
        },
      });
      await tx.studyGroupMember.create({
        data: {
          groupId: group.id,
          role: "owner",
          status: "active",
          userId: input.ownerUserId,
        },
      });
      return group.id;
    });
    return this.getGroupDetail({ groupId, viewerUserId: input.ownerUserId });
  }

  async updateGroup(input: {
    actorUserId: string;
    groupId: string;
    name?: string;
    description?: string | null;
    joinPolicy?: JoinPolicy;
    weeklyXpGoal?: number | null;
    memberLimit?: number;
  }) {
    const actor = await this.getActiveMember(input.groupId, input.actorUserId);
    assertModerator(actor);
    const data: Prisma.StudyGroupUpdateInput = {};
    if (input.name !== undefined) {
      const name = normalizeText(input.name, 60);
      if (!name) throw new BadRequestException("name is required");
      data.name = name;
    }
    if (input.description !== undefined) data.description = normalizeText(input.description ?? undefined, 1000) ?? null;
    if (input.joinPolicy !== undefined) {
      if (!isJoinPolicy(input.joinPolicy)) throw new BadRequestException("Invalid joinPolicy");
      data.joinPolicy = input.joinPolicy;
    }
    if (input.weeklyXpGoal !== undefined) {
      if (
        input.weeklyXpGoal !== null &&
        (!Number.isInteger(input.weeklyXpGoal) || input.weeklyXpGoal < 0 || input.weeklyXpGoal > 1_000_000)
      ) {
        throw new BadRequestException("weeklyXpGoal must be an integer between 0 and 1000000");
      }
      data.weeklyXpGoal = input.weeklyXpGoal;
    }
    if (input.memberLimit !== undefined) {
      if (!Number.isInteger(input.memberLimit) || input.memberLimit < 2 || input.memberLimit > GROUP_MEMBER_LIMIT) {
        throw new BadRequestException("memberLimit must be between 2 and 50");
      }
      const activeCount = await this.prisma.studyGroupMember.count({
        where: { groupId: input.groupId, status: "active" },
      });
      if (input.memberLimit < activeCount) {
        throw new BadRequestException("memberLimit cannot be lower than the active member count");
      }
      data.memberLimit = input.memberLimit;
    }
    await this.prisma.studyGroup.update({ data, where: { id: input.groupId } });
    return this.getGroupDetail({ groupId: input.groupId, viewerUserId: input.actorUserId });
  }

  async joinGroup(input: { groupId: string; userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureActiveUser(input.userId, tx);
      const group = await tx.studyGroup.findUnique({ where: { id: input.groupId } });
      if (!group || group.status !== "active") throw new NotFoundException("Group not found");
      if (group.joinPolicy === "closed") throw new ForbiddenException("Group is closed to new members");

      const existing = await tx.studyGroupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      });
      if (existing?.status === "banned") throw new ForbiddenException("You are banned from this group");
      if (existing?.status === "active") return existing;
      if (group.joinPolicy === "invite" && existing?.status !== "pending") {
        throw new ForbiddenException("This group is invite-only");
      }

      await this.assertGroupHasRoom(input.groupId, group.memberLimit, tx);
      if (existing) {
        return tx.studyGroupMember.update({
          data: { status: "active" },
          where: { id: existing.id },
        });
      }
      return tx.studyGroupMember.create({
        data: { groupId: input.groupId, role: "member", status: "active", userId: input.userId },
      });
    });
  }

  async inviteMember(input: { actorUserId: string; groupId: string; targetUserId: string }) {
    if (input.actorUserId === input.targetUserId) {
      throw new BadRequestException("Cannot invite yourself");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureActiveUser(input.targetUserId, tx);
      const actor = await tx.studyGroupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId: input.actorUserId } },
      });
      assertModerator(actor);
      const group = await tx.studyGroup.findUnique({ where: { id: input.groupId } });
      if (!group || group.status !== "active") throw new NotFoundException("Group not found");
      await this.assertGroupHasRoom(input.groupId, group.memberLimit, tx);
      const existing = await tx.studyGroupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId: input.targetUserId } },
      });
      if (existing?.status === "banned") throw new ForbiddenException("This user is banned from the group");
      if (existing?.status === "active" || existing?.status === "pending") return existing;
      if (existing) {
        return tx.studyGroupMember.update({
          data: { role: "member", status: "pending" },
          where: { id: existing.id },
        });
      }
      return tx.studyGroupMember.create({
        data: { groupId: input.groupId, role: "member", status: "pending", userId: input.targetUserId },
      });
    });
  }

  async leaveGroup(input: { groupId: string; userId: string }) {
    const member = await this.getActiveMember(input.groupId, input.userId);
    if (!member) throw new NotFoundException("You are not a member of this group");
    if (member.role === "owner") {
      throw new BadRequestException("Owner cannot leave; transfer ownership or archive the group first");
    }
    return this.prisma.studyGroupMember.update({
      data: { status: "left" },
      where: { id: member.id },
    });
  }

  async listMyGroups(userId: string) {
    return this.prisma.studyGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      where: { members: { some: { status: "active", userId } }, status: "active" },
    });
  }

  async discoverOpenGroups(input: { excludeUserId?: string; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    return this.prisma.studyGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      where: {
        joinPolicy: "open",
        status: "active",
        ...(input.excludeUserId ? { members: { none: { status: "active", userId: input.excludeUserId } } } : {}),
      },
    });
  }

  async getGroupDetail(input: { groupId: string; viewerUserId: string }) {
    const group = await this.prisma.studyGroup.findUnique({
      include: {
        challenges: {
          orderBy: { periodStart: "desc" },
          take: 10,
          where: { status: "active" },
        },
        members: {
          orderBy: { joinedAt: "asc" },
          select: GROUP_MEMBER_SELECT,
          take: GROUP_MEMBER_LIMIT,
          where: { status: "active" },
        },
        owner: { select: SOCIAL_PROFILE_SELECT },
      },
      where: { id: input.groupId },
    });
    if (!group || group.status !== "active") throw new NotFoundException("Group not found");
    const viewerMember = group.members.find((member) => member.userId === input.viewerUserId);
    return { ...group, memberCount: group.members.length, viewerRole: viewerMember?.role ?? null };
  }

  async kickMember(input: { actorUserId: string; groupId: string; targetUserId: string }) {
    if (input.actorUserId === input.targetUserId) throw new BadRequestException("Use leaveGroup to remove yourself");
    const actor = await this.getActiveMember(input.groupId, input.actorUserId);
    assertModerator(actor);
    const target = await this.getActiveMember(input.groupId, input.targetUserId);
    if (!target) throw new NotFoundException("Member not found");
    if (target.role === "owner") throw new ForbiddenException("Cannot kick the group owner");
    if (actor.role !== "owner" && target.role === "admin") {
      throw new ForbiddenException("Only the owner can kick admins");
    }
    return this.prisma.studyGroupMember.update({
      data: { status: "banned" },
      where: { id: target.id },
    });
  }

  async transferOwnership(input: { actorUserId: string; groupId: string; targetUserId: string }) {
    const actor = await this.getActiveMember(input.groupId, input.actorUserId);
    assertOwner(actor);
    const target = await this.getActiveMember(input.groupId, input.targetUserId);
    if (!target) throw new NotFoundException("Target member not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.studyGroup.update({
        data: { ownerUserId: input.targetUserId },
        where: { id: input.groupId },
      });
      await tx.studyGroupMember.update({ data: { role: "admin" }, where: { id: actor.id } });
      await tx.studyGroupMember.update({ data: { role: "owner" }, where: { id: target.id } });
    });
    return this.getGroupDetail({ groupId: input.groupId, viewerUserId: input.actorUserId });
  }

  async archiveGroup(input: { actorUserId: string; groupId: string }) {
    const actor = await this.getActiveMember(input.groupId, input.actorUserId);
    assertOwner(actor);
    return this.prisma.studyGroup.update({
      data: { status: "archived" },
      where: { id: input.groupId },
    });
  }

  async createChallenge(input: {
    actorUserId: string;
    groupId: string;
    title: string;
    description?: string;
    metricType?: ChallengeMetric;
    targetValue: number;
    periodStart: Date;
    periodEnd: Date;
    rewardPayload?: Prisma.InputJsonValue;
  }) {
    const actor = await this.getActiveMember(input.groupId, input.actorUserId);
    assertModerator(actor);
    const title = normalizeText(input.title, 80);
    if (!title) throw new BadRequestException("title is required");
    const metricType = input.metricType ?? "xp";
    if (!isChallengeMetric(metricType)) throw new BadRequestException("Invalid metricType");
    if (!Number.isInteger(input.targetValue) || input.targetValue <= 0) {
      throw new BadRequestException("targetValue must be a positive integer");
    }
    if (!(input.periodStart instanceof Date) || Number.isNaN(input.periodStart.getTime())) {
      throw new BadRequestException("periodStart must be a valid date");
    }
    if (!(input.periodEnd instanceof Date) || Number.isNaN(input.periodEnd.getTime()) || input.periodEnd <= input.periodStart) {
      throw new BadRequestException("periodEnd must be after periodStart");
    }
    return this.prisma.studyGroupChallenge.create({
      data: {
        createdByUserId: input.actorUserId,
        description: normalizeText(input.description, 1000),
        groupId: input.groupId,
        metricType,
        periodEnd: input.periodEnd,
        periodStart: input.periodStart,
        rewardPayload: input.rewardPayload ?? {},
        targetValue: input.targetValue,
        title,
      },
    });
  }

  async listChallenges(input: { groupId: string; viewerUserId: string }) {
    const member = await this.getActiveMember(input.groupId, input.viewerUserId);
    if (!member) throw new ForbiddenException("Only group members can view challenges");
    return this.prisma.studyGroupChallenge.findMany({
      orderBy: { periodStart: "desc" },
      take: 50,
      where: { groupId: input.groupId, status: "active" },
    });
  }

  async sendFriendRequest(input: { requesterUserId: string; addresseeUserId: string }) {
    if (input.requesterUserId === input.addresseeUserId) {
      throw new BadRequestException("Cannot send a friend request to yourself");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureActiveUser(input.requesterUserId, tx);
      await this.ensureActiveUser(input.addresseeUserId, tx);
      const pairKey = buildSocialPairKey(input.requesterUserId, input.addresseeUserId);
      const existing = await tx.userSocialConnection.findUnique({ where: { pairKey } });
      if (!existing) {
        return tx.userSocialConnection.create({
          data: {
            addresseeUserId: input.addresseeUserId,
            pairKey,
            requesterUserId: input.requesterUserId,
            status: "pending",
          },
        });
      }
      if (existing.status === "blocked") throw new ForbiddenException("This social connection is blocked");
      if (existing.status === "accepted") return existing;
      if (existing.status === "pending") {
        if (existing.addresseeUserId === input.requesterUserId) {
          return tx.userSocialConnection.update({
            data: { respondedAt: new Date(), status: "accepted" },
            where: { id: existing.id },
          });
        }
        return existing;
      }
      return tx.userSocialConnection.update({
        data: {
          addresseeUserId: input.addresseeUserId,
          blockedByUserId: null,
          requestedAt: new Date(),
          requesterUserId: input.requesterUserId,
          respondedAt: null,
          status: "pending",
        },
        where: { id: existing.id },
      });
    });
  }

  async respondToFriendRequest(input: { actorUserId: string; connectionId: string; response: FriendResponse }) {
    const connection = await this.prisma.userSocialConnection.findUnique({ where: { id: input.connectionId } });
    if (!connection || connection.status !== "pending") throw new NotFoundException("Friend request not found");
    if (connection.addresseeUserId !== input.actorUserId) {
      throw new ForbiddenException("Only the request recipient can respond");
    }
    return this.prisma.userSocialConnection.update({
      data: { respondedAt: new Date(), status: input.response === "accept" ? "accepted" : "declined" },
      where: { id: connection.id },
    });
  }

  async removeFriend(input: { actorUserId: string; peerUserId: string }) {
    const connection = await this.prisma.userSocialConnection.findUnique({
      where: { pairKey: buildSocialPairKey(input.actorUserId, input.peerUserId) },
    });
    if (!connection || connection.status !== "accepted") throw new NotFoundException("Friend connection not found");
    return this.prisma.userSocialConnection.update({
      data: { respondedAt: new Date(), status: "cancelled" },
      where: { id: connection.id },
    });
  }

  async blockUser(input: { actorUserId: string; targetUserId: string }) {
    if (input.actorUserId === input.targetUserId) throw new BadRequestException("Cannot block yourself");
    const pairKey = buildSocialPairKey(input.actorUserId, input.targetUserId);
    return this.prisma.$transaction(async (tx) => {
      await this.ensureActiveUser(input.actorUserId, tx);
      await this.ensureActiveUser(input.targetUserId, tx);
      return tx.userSocialConnection.upsert({
        create: {
          addresseeUserId: input.targetUserId,
          blockedByUserId: input.actorUserId,
          pairKey,
          requesterUserId: input.actorUserId,
          respondedAt: new Date(),
          status: "blocked",
        },
        update: {
          blockedByUserId: input.actorUserId,
          respondedAt: new Date(),
          status: "blocked",
        },
        where: { pairKey },
      });
    });
  }

  async listSocialConnections(userId: string) {
    const rows = await this.prisma.userSocialConnection.findMany({
      include: {
        addressee: { select: SOCIAL_PROFILE_SELECT },
        requester: { select: SOCIAL_PROFILE_SELECT },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      where: {
        OR: [{ requesterUserId: userId }, { addresseeUserId: userId }],
        status: { in: ["accepted", "pending", "blocked"] },
      },
    });
    return rows.map((row) => {
      const peer = row.requesterUserId === userId ? row.addressee : row.requester;
      return {
        blockedByMe: row.status === "blocked" && row.blockedByUserId === userId,
        direction:
          row.status !== "pending"
            ? "none"
            : row.requesterUserId === userId
              ? "outgoing"
              : "incoming",
        id: row.id,
        peer,
        requestedAt: row.requestedAt,
        respondedAt: row.respondedAt,
        status: row.status,
      };
    });
  }

  private async ensureActiveUser(userId: string, tx: Prisma.TransactionClient | PrismaClient = this.prisma) {
    const user = await tx.userProfile.findUnique({
      select: { id: true, status: true },
      where: { id: userId },
    });
    if (!user || user.status !== "active") throw new NotFoundException("User not found");
  }

  private async assertGroupHasRoom(groupId: string, memberLimit: number, tx: Prisma.TransactionClient | PrismaClient) {
    const activeCount = await tx.studyGroupMember.count({ where: { groupId, status: "active" } });
    if (activeCount >= memberLimit) throw new ForbiddenException("Group is full");
  }

  private getActiveMember(groupId: string, userId: string) {
    return this.prisma.studyGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
  }
}
