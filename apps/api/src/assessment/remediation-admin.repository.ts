import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type {
  adminRemediationRuleCreateSchema,
  adminRemediationRuleListQuerySchema,
  adminRemediationRulePatchSchema,
  adminRemediationTriggerListQuerySchema
} from "@nihongo-bjt/shared";
import type { z } from "zod";

type CreateInput = z.infer<typeof adminRemediationRuleCreateSchema>;
type PatchInput = z.infer<typeof adminRemediationRulePatchSchema>;
type ListInput = z.infer<typeof adminRemediationRuleListQuerySchema>;
type TriggerListInput = z.infer<typeof adminRemediationTriggerListQuerySchema>;

const RULE_SELECT = {
  id: true,
  name: true,
  description: true,
  topicSkillTag: true,
  level: true,
  thresholdFailedCount: true,
  thresholdWindowQuestions: true,
  recommendedContentType: true,
  recommendedContentId: true,
  active: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AssessmentRemediationRuleSelect;

@Injectable()
export class RemediationAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listRules(input: ListInput) {
    const where: Prisma.AssessmentRemediationRuleWhereInput = {};
    if (input.topicSkillTag) where.topicSkillTag = input.topicSkillTag;
    if (input.level) where.level = input.level;
    if (typeof input.active === "boolean") where.active = input.active;
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.assessmentRemediationRule.findMany({
        orderBy: { updatedAt: "desc" },
        select: RULE_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.assessmentRemediationRule.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async ruleDetail(id: string) {
    const row = await this.prisma.assessmentRemediationRule.findUnique({ where: { id } });
    if (!row) return null;
    const [audit, recentTriggers] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
        where: { targetId: id, targetType: "assessment.remediation_rule" }
      }),
      this.prisma.assessmentRemediationTrigger.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        where: { ruleId: id }
      })
    ]);
    return { ...row, audit, recentTriggers };
  }

  async createRule(actorId: string, data: CreateInput) {
    const created = await this.prisma.assessmentRemediationRule.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        topicSkillTag: data.topicSkillTag,
        level: data.level,
        thresholdFailedCount: data.thresholdFailedCount,
        thresholdWindowQuestions: data.thresholdWindowQuestions,
        recommendedContentType: data.recommendedContentType,
        recommendedContentId: data.recommendedContentId,
        active: true,
        createdById: actorId,
        updatedById: actorId
      }
    });
    await this.writeAudit({
      action: "admin.assessment.remediation_rule.created",
      actorId,
      after: this.serializeForAudit(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.ruleDetail(created.id);
  }

  async patchRule(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.assessmentRemediationRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Remediation rule not found");
    const update: Prisma.AssessmentRemediationRuleUpdateInput = { updatedById: actorId };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.topicSkillTag !== undefined) update.topicSkillTag = data.topicSkillTag;
    if (data.level !== undefined) update.level = data.level;
    if (data.thresholdFailedCount !== undefined) update.thresholdFailedCount = data.thresholdFailedCount;
    if (data.thresholdWindowQuestions !== undefined) update.thresholdWindowQuestions = data.thresholdWindowQuestions;
    if (data.recommendedContentType !== undefined) update.recommendedContentType = data.recommendedContentType;
    if (data.recommendedContentId !== undefined) update.recommendedContentId = data.recommendedContentId;
    const updated = await this.prisma.assessmentRemediationRule.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.assessment.remediation_rule.updated",
      actorId,
      after: this.serializeForAudit(updated),
      before: this.serializeForAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.ruleDetail(id);
  }

  async toggleRule(actorId: string, id: string, active: boolean, reason: string) {
    const before = await this.prisma.assessmentRemediationRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Remediation rule not found");
    if (before.active === active) {
      await this.writeAudit({
        action: active
          ? "admin.assessment.remediation_rule.enable_noop"
          : "admin.assessment.remediation_rule.disable_noop",
        actorId,
        after: { active, noop: true },
        before: { active: before.active },
        reason,
        targetId: id
      });
      return this.ruleDetail(id);
    }
    const updated = await this.prisma.assessmentRemediationRule.update({
      data: { active, updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: active
        ? "admin.assessment.remediation_rule.enabled"
        : "admin.assessment.remediation_rule.disabled",
      actorId,
      after: { active: updated.active },
      before: { active: before.active },
      reason,
      targetId: id
    });
    return this.ruleDetail(id);
  }

  async removeRule(actorId: string, id: string, reason: string) {
    const before = await this.prisma.assessmentRemediationRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Remediation rule not found");
    const triggers = await this.prisma.assessmentRemediationTrigger.count({ where: { ruleId: id } });
    if (triggers > 0) {
      throw new BadRequestException({ code: "rule_has_triggers", triggers });
    }
    await this.prisma.assessmentRemediationRule.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.assessment.remediation_rule.deleted",
      actorId,
      after: null,
      before: this.serializeForAudit(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  async listTriggers(input: TriggerListInput) {
    const where: Prisma.AssessmentRemediationTriggerWhereInput = {};
    if (input.ruleId) where.ruleId = input.ruleId;
    if (input.userId) where.userId = input.userId;
    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) (where.createdAt as Record<string, Date>).gte = new Date(input.from);
      if (input.to) (where.createdAt as Record<string, Date>).lte = new Date(input.to);
    }
    const [items, total] = await Promise.all([
      this.prisma.assessmentRemediationTrigger.findMany({
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              topicSkillTag: true,
              level: true,
              recommendedContentType: true,
              recommendedContentId: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.assessmentRemediationTrigger.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  private serializeForAudit(row: {
    name: string;
    description: string | null;
    topicSkillTag: string;
    level: string;
    thresholdFailedCount: number;
    thresholdWindowQuestions: number;
    recommendedContentType: string;
    recommendedContentId: string;
    active: boolean;
  }) {
    return { ...row };
  }

  private writeAudit(input: {
    action: string;
    actorId: string;
    after: unknown;
    before: unknown;
    reason: string;
    targetId: string;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        after: input.after as Prisma.InputJsonValue,
        before: input.before as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.targetId,
        targetType: "assessment.remediation_rule"
      }
    });
  }
}
