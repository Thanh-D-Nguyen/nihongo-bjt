import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import {
  adminCreateContentSchema,
  adminPatchContentBodySchema,
  aggregateByCategoryGroup,
  getGrammarCategoryGroupFilterClauses,
  type AdminContentListResponse,
  type AdminContentSummaryResponse,
  type GrammarCategoryGroupId
} from "@nihongo-bjt/shared";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { z } from "zod";

type ContentKind = "lexeme" | "kanji" | "grammar" | "example";

type SenseWithLinks = {
  id: string;
  position: number;
  exampleLinks: {
    id: string;
    exampleSentence: {
      id: string;
      japaneseText: string;
      reading: string | null;
      status: string;
      translationVi: string | null;
    } | null;
  }[];
}[];

function mapLexemeExamplesForAdmin(senses: SenseWithLinks) {
  const out: {
    exampleSentenceId: string;
    japaneseText: string;
    linkId: string;
    reading: string | null;
    senseId: string;
    sensePosition: number;
    status: string;
    translationVi: string | null;
  }[] = [];
  for (const s of senses) {
    for (const l of s.exampleLinks) {
      if (l.exampleSentence) {
        const ex = l.exampleSentence;
        out.push({
          exampleSentenceId: ex.id,
          japaneseText: ex.japaneseText,
          linkId: l.id,
          reading: ex.reading,
          senseId: s.id,
          sensePosition: s.position,
          status: ex.status,
          translationVi: ex.translationVi
        });
      }
    }
  }
  return out;
}

type AdminCreateContent = z.infer<typeof adminCreateContentSchema>;
type AdminPatchContentBody = z.infer<typeof adminPatchContentBodySchema>;
type PatchFields = Omit<AdminPatchContentBody, "reason">;

type UserDetailPrivacyShape = {
  loginEvents: Array<{ metadata: unknown }>;
  profile: { email: string | null; timezone: string };
  providerAccounts: Array<{ emailAtLink: string | null; providerSubject: string }>;
  usageCounters: unknown[];
};

function maskSupportSubject(value: string): string {
  if (value.length < 8) {
    return "redacted";
  }
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function applyUserDetailPrivacyBoundary<T extends UserDetailPrivacyShape>(
  detail: T,
  includeSensitive: boolean
): T & { privacyBoundary: { includeSensitive: boolean; redactedFields: string[] } } {
  if (includeSensitive) {
    return {
      ...detail,
      privacyBoundary: {
        includeSensitive: true,
        redactedFields: []
      }
    };
  }

  return {
    ...detail,
    loginEvents: detail.loginEvents.map((event) => ({ ...event, metadata: null })),
    profile: {
      ...detail.profile,
      email: null,
      timezone: "redacted"
    },
    providerAccounts: detail.providerAccounts.map((account) => ({
      ...account,
      emailAtLink: null,
      providerSubject: maskSupportSubject(account.providerSubject)
    })),
    usageCounters: [],
    privacyBoundary: {
      includeSensitive: false,
      redactedFields: [
        "profile.email",
        "profile.timezone",
        "providerAccounts.emailAtLink",
        "providerAccounts.providerSubject",
        "loginEvents.metadata",
        "usageCounters"
      ]
    }
  };
}

export type ContentListFilters = {
  category?: string;
  /** Grammar: lọc theo cả nhóm (taxonomy) */
  categoryGroup?: string;
  jlptLevel?: string;
  level?: number;
  reading?: string;
  strokeCountMax?: number;
  strokeCountMin?: number;
};

@Injectable()
export class AdminRepository {
  private readonly log = new Logger(AdminRepository.name);
  private readonly prisma = createPrismaClient();

  async me(actorId: string) {
    return this.prisma.adminActor.findUnique({
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } }
            }
          }
        }
      },
      where: { id: actorId }
    });
  }

  async iamRoles() {
    const roles = await this.prisma.adminRole.findMany({
      include: {
        permissions: {
          include: { permission: true }
        }
      },
      orderBy: { code: "asc" }
    });

    const adminCounts = await this.prisma.adminActorRole.groupBy({
      by: ["roleId"],
      _count: { roleId: true }
    });
    const adminCountByRoleId = new Map<string, number>(
      adminCounts.map((row) => [row.roleId, row._count.roleId])
    );

    return roles.map((role) => ({
      code: role.code,
      createdAt: role.createdAt,
      description: role.description,
      id: role.id,
      name: role.name,
      permissionCount: role.permissions.length,
      adminCount: adminCountByRoleId.get(role.id) ?? 0,
      status: role.status
    }));
  }

  async iamRoleDetail(code: string) {
    const role = await this.prisma.adminRole.findUnique({
      where: { code },
      include: {
        permissions: { include: { permission: true } },
        actors: {
          include: {
            actor: {
              select: {
                id: true,
                displayName: true,
                email: true,
                status: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });
    if (!role) {
      return null;
    }
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: role.status,
      createdAt: role.createdAt,
      permissions: role.permissions.map((link) => ({
        code: link.permission.code,
        description: link.permission.description
      })),
      admins: role.actors.map((link) => ({
        id: link.actor.id,
        displayName: link.actor.displayName,
        email: link.actor.email,
        status: link.actor.status,
        updatedAt: link.actor.updatedAt
      }))
    };
  }

  async iamPermissions() {
    const permissions = await this.prisma.adminPermission.findMany({
      include: {
        roles: {
          include: {
            role: {
              include: {
                actors: { select: { actorId: true } }
              }
            }
          }
        }
      },
      orderBy: { code: "asc" }
    });

    return permissions.map((permission) => {
      const roleCodes: string[] = [];
      const adminIds = new Set<string>();
      for (const link of permission.roles) {
        roleCodes.push(link.role.code);
        for (const ar of link.role.actors) {
          adminIds.add(ar.actorId);
        }
      }
      const idx = permission.code.indexOf(".");
      const group = idx === -1 ? "(misc)" : permission.code.slice(0, idx);
      return {
        adminCount: adminIds.size,
        code: permission.code,
        createdAt: permission.createdAt,
        description: permission.description,
        group,
        id: permission.id,
        roleCodes: roleCodes.sort(),
        roleCount: roleCodes.length
      };
    });
  }

  async iamPermissionDetail(code: string) {
    const permission = await this.prisma.adminPermission.findUnique({
      include: {
        roles: {
          include: {
            role: {
              include: {
                actors: {
                  include: {
                    actor: {
                      select: { displayName: true, email: true, id: true, status: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      where: { code }
    });
    if (!permission) {
      return null;
    }
    const roles = permission.roles.map((link) => ({
      code: link.role.code,
      description: link.role.description,
      id: link.role.id,
      name: link.role.name,
      status: link.role.status
    }));

    // Aggregate admins via role; one admin may inherit through multiple roles → keep first/highest viaRole
    const ADMIN_LIMIT = 100;
    const adminsMap = new Map<
      string,
      { displayName: string; email: string; id: string; status: string; viaRoleCodes: string[] }
    >();
    for (const link of permission.roles) {
      for (const ar of link.role.actors) {
        const existing = adminsMap.get(ar.actor.id);
        if (existing) {
          if (!existing.viaRoleCodes.includes(link.role.code)) {
            existing.viaRoleCodes.push(link.role.code);
          }
          continue;
        }
        adminsMap.set(ar.actor.id, {
          displayName: ar.actor.displayName,
          email: ar.actor.email,
          id: ar.actor.id,
          status: ar.actor.status,
          viaRoleCodes: [link.role.code]
        });
      }
    }
    const adminsAll = [...adminsMap.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    const truncated = adminsAll.length > ADMIN_LIMIT;
    const admins = truncated ? adminsAll.slice(0, ADMIN_LIMIT) : adminsAll;

    const idx = permission.code.indexOf(".");
    const group = idx === -1 ? "(misc)" : permission.code.slice(0, idx);

    return {
      adminCount: adminsAll.length,
      admins,
      adminsTruncated: truncated,
      code: permission.code,
      createdAt: permission.createdAt,
      description: permission.description,
      group,
      id: permission.id,
      roleCount: roles.length,
      roles
    };
  }

  async iamAdmins(params: {
    q?: string;
    role?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const where: Prisma.AdminActorWhereInput = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.q) {
      where.OR = [
        { displayName: { contains: params.q, mode: "insensitive" } },
        { email: { contains: params.q, mode: "insensitive" } }
      ];
    }
    if (params.role) {
      where.roles = { some: { role: { code: params.role } } };
    }

    const [total, admins] = await Promise.all([
      this.prisma.adminActor.count({ where }),
      this.prisma.adminActor.findMany({
        include: {
          roles: { include: { role: true } }
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        where
      })
    ]);

    const items = admins.map((admin) => ({
      createdAt: admin.createdAt,
      displayName: admin.displayName,
      email: admin.email,
      id: admin.id,
      keycloakSubject: admin.keycloakSubject,
      roleCodes: admin.roles.map((link) => link.role.code),
      status: admin.status,
      updatedAt: admin.updatedAt
    }));

    return { items, page, pageSize, total };
  }

  async iamAdminDetail(id: string) {
    const actor = await this.prisma.adminActor.findUnique({
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } }
          }
        }
      },
      where: { id }
    });
    if (!actor) {
      return null;
    }
    const audit = await this.prisma.adminAuditLog.findMany({
      include: {
        actor: { select: { displayName: true, email: true, id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { targetId: id }
    });
    return {
      audit,
      createdAt: actor.createdAt,
      displayName: actor.displayName,
      email: actor.email,
      id: actor.id,
      keycloakSubject: actor.keycloakSubject,
      roles: actor.roles.map((link) => ({
        code: link.role.code,
        description: link.role.description,
        grantedAt: link.grantedAt,
        id: link.role.id,
        name: link.role.name,
        permissionCount: link.role.permissions.length,
        status: link.role.status
      })),
      status: actor.status,
      updatedAt: actor.updatedAt
    };
  }

  async iamAdminAssignRole(actorId: string, targetId: string, roleCode: string, reason: string) {
    const target = await this.prisma.adminActor.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException("Admin actor not found");
    }
    const role = await this.prisma.adminRole.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }
    const existing = await this.prisma.adminActorRole.findUnique({
      where: { actorId_roleId: { actorId: targetId, roleId: role.id } }
    });
    if (existing) {
      throw new ConflictException({ code: "role_already_assigned", roleCode });
    }
    const link = await this.prisma.adminActorRole.create({
      data: { actorId: targetId, roleId: role.id }
    });
    await this.writeAudit({
      action: "admin.iam.role_assigned",
      actorId,
      after: { actorId: targetId, grantedAt: link.grantedAt, roleCode, roleId: role.id },
      before: null,
      reason,
      targetId,
      targetType: "authz.admin_actor_role"
    });
    return this.iamAdminDetail(targetId);
  }

  async iamAdminRevokeRole(actorId: string, targetId: string, roleCode: string, reason: string) {
    const target = await this.prisma.adminActor.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException("Admin actor not found");
    }
    const role = await this.prisma.adminRole.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }
    const existing = await this.prisma.adminActorRole.findUnique({
      where: { actorId_roleId: { actorId: targetId, roleId: role.id } }
    });
    if (!existing) {
      throw new NotFoundException("Role is not assigned to this admin");
    }
    await this.prisma.adminActorRole.delete({ where: { id: existing.id } });
    await this.writeAudit({
      action: "admin.iam.role_revoked",
      actorId,
      after: null,
      before: { actorId: targetId, grantedAt: existing.grantedAt, roleCode, roleId: role.id },
      reason,
      targetId,
      targetType: "authz.admin_actor_role"
    });
    return this.iamAdminDetail(targetId);
  }

  async iamAdminPatchStatus(actorId: string, targetId: string, status: "active" | "disabled", reason: string) {
    const target = await this.prisma.adminActor.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException("Admin actor not found");
    }
    if (target.status === status) {
      return this.iamAdminDetail(targetId);
    }
    const before = { status: target.status };
    const updated = await this.prisma.adminActor.update({
      data: { status },
      where: { id: targetId }
    });
    await this.writeAudit({
      action: "admin.iam.actor_status_changed",
      actorId,
      after: { status: updated.status },
      before,
      reason,
      targetId,
      targetType: "authz.admin_actor"
    });
    return this.iamAdminDetail(targetId);
  }

  /**
   * Filterable IAM/admin-actor audit timeline. Replaces the older simple `limit`-only signature.
   * Returns `{ items, total, page, pageSize }`. Item shape preserved for legacy consumers (still
   * exposes `actor`, `targetType`, `action`, etc.) so the existing roles client keeps working when
   * it reads `data.items ?? data`.
   */
  async iamRoleAudit(params: {
    actorId?: string;
    targetActorId?: string;
    action?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

    // Scope: IAM / admin-actor mutations. Same semantic envelope as before.
    const scopeOR: Prisma.AdminAuditLogWhereInput[] = [
      { action: { contains: "role" } },
      { targetType: { contains: "authz" } },
      { targetType: { contains: "admin.role" } },
      { targetType: { contains: "admin.permission" } }
    ];

    const where: Prisma.AdminAuditLogWhereInput = { OR: scopeOR };
    const ANDs: Prisma.AdminAuditLogWhereInput[] = [];
    if (params.actorId) ANDs.push({ actorId: params.actorId });
    if (params.targetActorId) ANDs.push({ targetId: params.targetActorId });
    if (params.action) ANDs.push({ action: { contains: params.action, mode: "insensitive" } });
    if (params.from) ANDs.push({ createdAt: { gte: new Date(params.from) } });
    if (params.to) ANDs.push({ createdAt: { lte: new Date(params.to) } });
    if (params.q) {
      ANDs.push({
        OR: [
          { reason: { contains: params.q, mode: "insensitive" } },
          { action: { contains: params.q, mode: "insensitive" } },
          { targetType: { contains: params.q, mode: "insensitive" } }
        ]
      });
    }
    if (ANDs.length > 0) where.AND = ANDs;

    const [total, items] = await Promise.all([
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.findMany({
        include: {
          actor: { select: { displayName: true, email: true, id: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        where
      })
    ]);

    return { items, page, pageSize, total };
  }

  async content(
    type: ContentKind,
    q: string | undefined,
    status: string | undefined,
    page: number,
    pageSize: number,
    filters: ContentListFilters = {}
  ): Promise<AdminContentListResponse> {
    const skip = (page - 1) * pageSize;
    switch (type) {
      case "example": {
        const where = this.exampleWhere(q, status);
        const [total, items] = await Promise.all([
          this.prisma.exampleSentence.count({ where }),
          this.prisma.exampleSentence.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            where
          })
        ]);
        return { items, page, pageSize, total };
      }
      case "grammar": {
        const where = this.grammarWhere(q, status, filters);
        const [total, items] = await Promise.all([
          this.prisma.grammarPoint.count({ where }),
          this.prisma.grammarPoint.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            where
          })
        ]);
        return { items, page, pageSize, total };
      }
      case "kanji": {
        const where = this.kanjiWhere(q, status, filters);
        const [total, items] = await Promise.all([
          this.prisma.kanji.count({ where }),
          this.prisma.kanji.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            where
          })
        ]);
        return { items, page, pageSize, total };
      }
      case "lexeme": {
        const where = this.lexemeWhere(q, status, filters);
        const [total, rawItems] = await Promise.all([
          this.prisma.lexeme.count({ where }),
          this.prisma.lexeme.findMany({
            include: {
              senses: {
                include: {
                  exampleLinks: {
                    include: { exampleSentence: true }
                  }
                },
                orderBy: { position: "asc" }
              }
            },
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            where
          })
        ]);
        const items = rawItems.map((row) => {
          const { senses, ...lex } = row;
          return {
            ...lex,
            lexemeExamples: mapLexemeExamplesForAdmin(senses)
          };
        });
        return { items, page, pageSize, total };
      }
    }
  }

  /**
   * Create `example_sentence` and link to lexeme (first `lexeme_sense` or a new sense at position 0).
   */
  async createLexemeExample(
    actorId: string,
    lexemeId: string,
    input: {
      japaneseText: string;
      reason: string;
      reading?: string | null;
      translationVi?: string | null;
    }
  ) {
    const lexeme = await this.prisma.lexeme.findUnique({ where: { id: lexemeId } });
    if (!lexeme) {
      throw new NotFoundException("Lexeme not found");
    }
    const sense = await this.ensureDefaultLexemeSense(lexeme);

    const sentence = await this.prisma.exampleSentence.create({
      data: {
        japaneseText: input.japaneseText,
        reading: input.reading ?? null,
        status: "active",
        translationVi: input.translationVi ?? null
      }
    });
    const link = await this.prisma.lexemeSenseExample.create({
      data: {
        exampleSentenceId: sentence.id,
        senseId: sense.id,
        sourceExampleKey: `admin:${randomUUID()}`
      }
    });
    const after = { exampleSentence: sentence, link };
    await this.writeAudit({
      action: "admin.lexeme.example_created",
      actorId,
      after,
      before: null,
      reason: input.reason,
      targetId: link.id,
      targetType: "lexeme_sense_example"
    });
    return { exampleSentence: sentence, linkId: link.id, senseId: sense.id };
  }

  async updateLexemeExample(
    actorId: string,
    lexemeId: string,
    linkId: string,
    input: {
      reason: string;
      japaneseText?: string;
      reading?: string | null;
      translationVi?: string | null;
      status?: "active" | "archived" | "needs_review";
    }
  ) {
    const link = await this.prisma.lexemeSenseExample.findFirst({
      include: { exampleSentence: true, sense: true },
      where: { id: linkId, sense: { lexemeId } }
    });
    if (!link || !link.exampleSentence) {
      throw new NotFoundException("Example link not found for this lexeme");
    }
    const before = { exampleSentence: link.exampleSentence, link: { id: link.id, senseId: link.senseId } };
    const data: Prisma.ExampleSentenceUpdateInput = {};
    if (input.japaneseText !== undefined) {
      data.japaneseText = input.japaneseText;
    }
    if (input.reading !== undefined) {
      data.reading = input.reading;
    }
    if (input.translationVi !== undefined) {
      data.translationVi = input.translationVi;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    const afterSentence = await this.prisma.exampleSentence.update({
      data,
      where: { id: link.exampleSentence.id }
    });
    const after = { exampleSentence: afterSentence, link: { id: link.id, senseId: link.senseId } };
    await this.writeAudit({
      action: "admin.lexeme.example_updated",
      actorId,
      after,
      before,
      reason: input.reason,
      targetId: linkId,
      targetType: "lexeme_sense_example"
    });
    return afterSentence;
  }

  async deleteLexemeExample(actorId: string, lexemeId: string, linkId: string, reason: string) {
    const link = await this.prisma.lexemeSenseExample.findFirst({
      include: { exampleSentence: true, sense: true },
      where: { id: linkId, sense: { lexemeId } }
    });
    if (!link) {
      throw new NotFoundException("Example link not found for this lexeme");
    }
    const before = { exampleSentence: link.exampleSentence, link: { id: link.id, senseId: link.senseId } };
    const exId = link.exampleSentenceId;
    await this.prisma.$transaction(async (tx) => {
      await tx.lexemeSenseExample.delete({ where: { id: linkId } });
      if (exId) {
        const n = await tx.lexemeSenseExample.count({ where: { exampleSentenceId: exId } });
        if (n === 0) {
          await tx.exampleSentence.delete({ where: { id: exId } });
        }
      }
    });
    await this.writeAudit({
      action: "admin.lexeme.example_deleted",
      actorId,
      after: { deleted: true, linkId },
      before,
      reason,
      targetId: linkId,
      targetType: "lexeme_sense_example"
    });
    return { ok: true as const };
  }

  private async ensureDefaultLexemeSense(lexeme: { id: string; headword: string; shortMeaningVi: string | null }) {
    const first = await this.prisma.lexemeSense.findFirst({
      orderBy: { position: "asc" },
      where: { lexemeId: lexeme.id }
    });
    if (first) {
      return first;
    }
    return this.prisma.lexemeSense.create({
      data: {
        lexemeId: lexeme.id,
        meaningVi: (lexeme.shortMeaningVi?.trim() && lexeme.shortMeaningVi) || `（${lexeme.headword}）`,
        position: 0
      }
    });
  }

  async contentSummary(
    type: ContentKind,
    q: string | undefined,
    status: string | undefined,
    filters: ContentListFilters = {}
  ): Promise<AdminContentSummaryResponse> {
    const base = {
      distinctLevelCount: 0,
      lastUpdatedAt: null as string | null,
      total: 0,
      type
    };

    switch (type) {
      case "example": {
        const where = this.exampleWhere(q, status);
        const [total, maxRes, statusGroups] = await Promise.all([
          this.prisma.exampleSentence.count({ where }),
          this.prisma.exampleSentence.aggregate({ _max: { updatedAt: true }, where }),
          this.prisma.exampleSentence.groupBy({
            by: ["status"],
            _count: { _all: true },
            where
          })
        ]);
        return {
          ...base,
          byLevel: {},
          byStatus: this.groupStatusToMap(statusGroups),
          distinctLevelCount: 0,
          lastUpdatedAt: maxRes._max.updatedAt?.toISOString() ?? null,
          total
        };
      }
      case "grammar": {
        const where = this.grammarWhere(q, status, filters);
        const [total, maxRes, statusGroups, levelGroups, categoryGroups] = await Promise.all([
          this.prisma.grammarPoint.count({ where }),
          this.prisma.grammarPoint.aggregate({ _max: { updatedAt: true }, where }),
          this.prisma.grammarPoint.groupBy({
            by: ["status"],
            _count: { _all: true },
            where
          }),
          this.prisma.grammarPoint.groupBy({
            by: ["jlptLevel"],
            _count: { _all: true },
            where
          }),
          this.prisma.grammarPoint.groupBy({
            by: ["category"],
            _count: { _all: true },
            where
          })
        ]);
        const byLevel = this.groupLevelStringToMap(
          levelGroups.map((g) => ({ key: g.jlptLevel, count: g._count._all }))
        );
        const byCategory = Object.fromEntries(
          categoryGroups.map((g) => [
            g.category === null || g.category === "" ? "—" : g.category,
            g._count._all
          ])
        );
        const byCategoryGroup = aggregateByCategoryGroup(byCategory);
        return {
          ...base,
          byCategory,
          byCategoryGroup,
          byLevel,
          byStatus: this.groupStatusToMap(statusGroups),
          distinctLevelCount: levelGroups.length,
          lastUpdatedAt: maxRes._max.updatedAt?.toISOString() ?? null,
          total
        };
      }
      case "kanji": {
        const where = this.kanjiWhere(q, status, filters);
        const [total, maxRes, statusGroups, levelGroups] = await Promise.all([
          this.prisma.kanji.count({ where }),
          this.prisma.kanji.aggregate({ _max: { updatedAt: true }, where }),
          this.prisma.kanji.groupBy({
            by: ["status"],
            _count: { _all: true },
            where
          }),
          this.prisma.kanji.groupBy({
            by: ["level"],
            _count: { _all: true },
            where
          })
        ]);
        const byLevel = Object.fromEntries(
          levelGroups.map((g) => [g.level === null || g.level === undefined ? "—" : String(g.level), g._count._all])
        );
        return {
          ...base,
          byLevel,
          byStatus: this.groupStatusToMap(statusGroups),
          distinctLevelCount: levelGroups.length,
          lastUpdatedAt: maxRes._max.updatedAt?.toISOString() ?? null,
          total
        };
      }
      case "lexeme": {
        const where = this.lexemeWhere(q, status, filters);
        const [total, maxRes, statusGroups, levelGroups] = await Promise.all([
          this.prisma.lexeme.count({ where }),
          this.prisma.lexeme.aggregate({ _max: { updatedAt: true }, where }),
          this.prisma.lexeme.groupBy({
            by: ["status"],
            _count: { _all: true },
            where
          }),
          this.prisma.lexeme.groupBy({
            by: ["jlptLevel"],
            _count: { _all: true },
            where
          })
        ]);
        const byLevel = this.groupLevelStringToMap(
          levelGroups.map((g) => ({ key: g.jlptLevel, count: g._count._all }))
        );
        return {
          ...base,
          byLevel,
          byStatus: this.groupStatusToMap(statusGroups),
          distinctLevelCount: levelGroups.length,
          lastUpdatedAt: maxRes._max.updatedAt?.toISOString() ?? null,
          total
        };
      }
    }
  }

  async createContent(actorId: string, input: AdminCreateContent) {
    const created = await (async () => {
      if (input.type === "lexeme") {
        return this.prisma.lexeme.create({
          data: {
            headword: input.headword,
            jlptLevel: input.jlptLevel,
            kanjiMeaningVi: input.kanjiMeaningVi,
            reading: input.reading,
            shortMeaningVi: input.shortMeaningVi,
            status: input.status
          }
        });
      }
      if (input.type === "kanji") {
        try {
          return await this.prisma.kanji.create({
            data: {
              character: input.character,
              kunyomi: input.kunyomi,
              level: input.level,
              meaningVi: input.meaningVi,
              onyomi: input.onyomi,
              status: input.status,
              strokeCount: input.strokeCount
            }
          });
        } catch (e: unknown) {
          if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
            throw new ConflictException("Kanji character already exists");
          }
          throw e;
        }
      }
      return this.prisma.grammarPoint.create({
        data: {
          category: input.category,
          jlptLevel: input.jlptLevel,
          meaningVi: input.meaningVi,
          pattern: input.pattern,
          status: input.status
        }
      });
    })();

    await this.writeAudit({
      action: "admin.content.item_created",
      actorId,
      after: created,
      before: null,
      reason: "Created from admin content CMS",
      targetId: created.id,
      targetType: input.type
    });
    return created;
  }

  async patchContent(actorId: string, type: ContentKind, id: string, body: AdminPatchContentBody) {
    if (type === "example") {
      throw new BadRequestException("This content type does not support field updates from admin");
    }
    const { reason, ...fields } = body;
    const before = await this.findContentById(type, id);
    if (!before) {
      throw new NotFoundException("Content item not found");
    }

    const data = this.pickContentPatchData(type, fields);
    if (Object.keys(data).length === 0) {
      return before;
    }

    const after = await this.updateContentFields(type, id, data);
    await this.writeAudit({
      action: "admin.content.item_updated",
      actorId,
      after,
      before,
      reason,
      targetId: id,
      targetType: type
    });
    return after;
  }

  async updateContentStatus(input: {
    actorId: string;
    id: string;
    reason: string;
    status: "active" | "archived" | "needs_review";
    type: ContentKind;
  }) {
    const before = await this.findContentById(input.type, input.id);
    if (!before) {
      throw new NotFoundException("Content item not found");
    }

    const after = await this.updateContentById(input.type, input.id, { status: input.status });
    await this.writeAudit({
      action: "admin.content.status_updated",
      actorId: input.actorId,
      after,
      before,
      reason: input.reason,
      targetId: input.id,
      targetType: input.type
    });

    return after;
  }

  /**
   * Legacy list (small); prefer `usersConsoleList`.
   * @deprecated Use GET /admin/users with query (console).
   */
  users(limit: number) {
    return this.prisma.userProfile.findMany({
      include: { avatar: true },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async usersConsoleKpis() {
    const [
      total,
      activeLearners,
      paidLike,
      suspendedOrDisabled,
      onboardingOpen
    ] = await Promise.all([
      this.prisma.userProfile.count(),
      this.prisma.userProfile.count({ where: { status: "active" } }),
      this.prisma.userProfile.count({
        where: {
          userSubscriptions: {
            some: {
              status: { in: ["active", "trialing"] },
              plan: { slug: { not: "free" } }
            }
          }
        }
      }),
      this.prisma.userProfile.count({
        where: { status: { in: ["suspended", "disabled", "deleted"] } }
      }),
      this.prisma.learnerOnboarding.count({
        where: { onboardedAt: null }
      })
    ]);
    return {
      activeLearners,
      onboardingIncomplete: onboardingOpen,
      paidUsers: paidLike,
      suspendedOrDisabled: suspendedOrDisabled,
      totalUsers: total
    };
  }

  async usersConsoleList(input: {
    lastActiveAfter?: string;
    lastActiveBefore?: string;
    page: number;
    pageSize: number;
    plan?: string;
    q?: string;
    status?: string;
    uiLocale?: string;
  }) {
    const skip = (input.page - 1) * input.pageSize;
    const and: Prisma.UserProfileWhereInput[] = [];
    if (input.q) {
      and.push({
        OR: [
          { displayName: { contains: input.q, mode: "insensitive" } },
          { email: { contains: input.q, mode: "insensitive" } }
        ]
      });
    }
    if (input.status) {
      and.push({ status: input.status });
    }
    if (input.uiLocale) {
      and.push({ uiLocale: input.uiLocale });
    }
    if (input.plan === "free") {
      and.push({
        NOT: {
          userSubscriptions: {
            some: { status: { in: ["active", "trialing"] } }
          }
        }
      });
    } else if (input.plan) {
      and.push({
        userSubscriptions: {
          some: {
            plan: { slug: input.plan },
            status: { in: ["active", "trialing"] }
          }
        }
      });
    }
    if (input.lastActiveAfter) {
      and.push({ updatedAt: { gte: new Date(input.lastActiveAfter) } });
    }
    if (input.lastActiveBefore) {
      and.push({ updatedAt: { lte: new Date(input.lastActiveBefore) } });
    }
    const where: Prisma.UserProfileWhereInput = and.length > 0 ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      this.prisma.userProfile.count({ where }),
      this.prisma.userProfile.findMany({
        include: {
          identityProviderAccounts: { select: { id: true, provider: true } },
          userSubscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { status: { in: ["active", "trialing"] } },
            include: { plan: { select: { id: true, slug: true, nameKey: true } } }
          }
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: input.pageSize,
        where
      })
    ]);
    const items = await Promise.all(
      rows.map(async (r) => {
        const resolved = await this.resolvePlanForUser(r.id);
        const dueN = await this.prisma.userFlashcard.count({
          where: { dueAt: { lte: new Date() }, userId: r.id }
        });
        const planSlug = resolved.subscription ? resolved.plan.slug : "free";
        const limit = await this.getFlashcardDayLimitForUser(r.id);
        const windowKey = this.utcDateKey();
        const used = await this.prisma.usageCounter
          .findUnique({
            where: {
              userId_quotaKey_windowKey: {
                quotaKey: "flashcard_reviews_per_day",
                userId: r.id,
                windowKey
              }
            }
          })
          .then((c) => c?.value ?? 0);
        const quotaWarning = limit > 0 && used / limit >= 0.9;
        const idp = r.identityProviderAccounts.map((a) => a.provider).join(", ");
        return {
          accountStatus: r.status,
          accountType: r.accountType,
          authSyncStatus: r.authSyncStatus,
          createdAt: r.createdAt,
          displayName: r.displayName,
          email: r.email,
          id: r.id,
          lastActivityAt: r.updatedAt,
          learningSummary:
            dueN > 0
              ? { dueFlashcards: dueN, hasDue: true as const }
              : { dueFlashcards: 0, hasDue: false as const },
          planSlug,
          planSource: resolved.source,
          providerSummary: idp || "—",
          quota: { limit, used, warning: quotaWarning },
          uiLocale: r.uiLocale
        };
      })
    );
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async userConsoleDetail(userId: string, options?: { includeSensitive?: boolean }) {
    const user = await this.prisma.userProfile.findUnique({
      include: { avatar: true, identityProviderAccounts: true, readingUserPreference: true },
      where: { id: userId }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const [resolved, onboarding, dueN, review7d, placement, loginEvents, counters] = await Promise.all([
      this.resolvePlanForUser(userId),
      this.prisma.learnerOnboarding.findUnique({ where: { userId } }),
      this.prisma.userFlashcard.count({
        where: { dueAt: { lte: new Date() }, userId }
      }),
      this.prisma.reviewEvent.count({
        where: {
          reviewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          userId
        }
      }),
      this.prisma.placementTestSession.findFirst({
        orderBy: { createdAt: "desc" },
        where: { userId }
      }),
      this.prisma.loginEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        where: { userId }
      }),
      this.prisma.usageCounter.findMany({ where: { userId } })
    ]);
    const windowKey = this.utcDateKey();
    const detail = {
      learning: {
        bjtBandEstimate: placement?.estimatedBjtBand ?? null,
        dueFlashcards: dueN,
        onboarding: onboarding
          ? {
              currentStep: onboarding.currentStep,
              onboardedAt: onboarding.onboardedAt
            }
          : null,
        reviewEvents7d: review7d,
        streak: null
      },
      loginEvents,
      profile: {
        accountType: user.accountType,
        authSyncStatus: user.authSyncStatus,
        createdAt: user.createdAt,
        displayName: user.displayName,
        email: user.email,
        explanationLocale: user.explanationLocale,
        id: user.id,
        keycloakSubjectMasked: user.keycloakSubject
          ? `${user.keycloakSubject.slice(0, 6)}…${user.keycloakSubject.slice(-4)}`
          : null,
        privacyLevel: user.privacyLevel,
        status: user.status,
        targetBjtBand: user.targetBjtBand,
        timezone: user.timezone,
        uiLocale: user.uiLocale,
        updatedAt: user.updatedAt
      },
      plan: {
        entitlements: resolved.plan.entitlements.map((e) => e.entitlement.key),
        periodEnd: resolved.subscription?.currentPeriodEnd ?? null,
        planNameKey: resolved.plan.nameKey,
        planSlug: resolved.plan.slug,
        quotas: await Promise.all(
          resolved.plan.planQuotas.map(async (pq) => {
            const used = await this.prisma.usageCounter
              .findUnique({
                where: {
                  userId_quotaKey_windowKey: {
                    quotaKey: pq.quotaPolicy.key,
                    userId,
                    windowKey
                  }
                }
              })
              .then((c) => c?.value ?? 0);
            return {
              key: pq.quotaPolicy.key,
              limit: pq.limitValue,
              used,
              window: pq.quotaPolicy.windowCode
            };
          })
        ),
        source: resolved.source,
        status: resolved.subscription?.status ?? "inferred"
      },
      providerAccounts: user.identityProviderAccounts,
      supportNotesCapability: { appendViaAudit: true as const },
      usageCounters: counters
    };

    return applyUserDetailPrivacyBoundary(detail, options?.includeSensitive === true);
  }

  async recordUserDetailAccess(
    actorId: string,
    userId: string,
    includeSensitive: boolean,
    access?: { category?: string; reason?: string }
  ) {
    const reasonText =
      access && access.reason && access.reason.trim().length > 0
        ? access.reason.trim()
        : includeSensitive
          ? "support_user_detail_read_sensitive"
          : "support_user_detail_read_redacted";
    await this.writeAudit({
      action: "admin.user.detail_viewed",
      actorId,
      after: {
        accessReasonCategory: access?.category ?? null,
        accessReasonText: access?.reason?.trim() ?? null,
        includeSensitive,
        viewedAt: new Date().toISOString()
      },
      before: null,
      reason: reasonText,
      targetId: userId,
      targetType: "user_profile"
    });
  }

  /**
   * Mutates `user_profile.status` for lifecycle (e.g. **suspended** vs **disabled**). The **reason** string is
   * required for audit: operational actions must be explainable without PII in the `admin_audit_log` payload
   * beyond what the product allows.
   */
  async patchUserAccountStatus(
    actorId: string,
    userId: string,
    input: { reason: string; status: "active" | "pending" | "disabled" | "suspended" | "deleted" }
  ) {
    const before = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!before) {
      throw new NotFoundException("User not found");
    }
    const after = await this.prisma.userProfile.update({
      data: { status: input.status },
      where: { id: userId }
    });
    await this.writeAudit({
      action: "admin.user.status_updated",
      actorId,
      after,
      before,
      reason: input.reason,
      targetId: userId,
      targetType: "user_profile"
    });
    return after;
  }

  async assignUserPlan(actorId: string, userId: string, input: { planSlug: string; reason: string }) {
    const user = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const plan = await this.prisma.plan.findFirst({
      where: { slug: input.planSlug, status: "active" }
    });
    if (!plan) {
      throw new BadRequestException("Plan not found or inactive");
    }
    const before = await this.prisma.userSubscription.findFirst({
      where: { userId, status: { in: ["active", "trialing"] } }
    });
    await this.prisma.userSubscription.updateMany({
      data: { status: "canceled" },
      where: { userId, status: { in: ["active", "trialing", "past_due"] } }
    });
    const after = await this.prisma.userSubscription.create({
      data: {
        cancelAtPeriodEnd: false,
        planId: plan.id,
        provider: "admin",
        providerRef: `admin:${actorId}:${Date.now()}`,
        status: "active",
        userId
      },
      include: { plan: true }
    });
    await this.writeAudit({
      action: "admin.user.plan_assigned",
      actorId,
      after: { planSlug: plan.slug, subscriptionId: after.id },
      before: before ? { planId: before.planId, subscriptionId: before.id } : null,
      reason: input.reason,
      targetId: userId,
      targetType: "user_profile"
    });
    await this.prisma.monetizationAuditLog.create({
      data: {
        action: "admin.user.plan_assigned",
        actorKind: "admin",
        payload: { planSlug: plan.slug, reason: input.reason, userId } as Prisma.InputJsonValue,
        userId
      }
    });
    return after;
  }

  async addUserSupportNote(
    actorId: string,
    userId: string,
    input: { body: string; reason: string; visibility?: "private" | "team" | "audit_only" }
  ) {
    const user = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const visibility = input.visibility ?? "team";
    const payload = { body: input.body, kind: "support_note" as const, visibility };
    await this.writeAudit({
      action: "admin.user.support_note",
      actorId,
      after: payload,
      // The visibility metadata is duplicated into `before` to make it server-filterable
      // without parsing JSON every read (Prisma JSON path filters are limited).
      before: { visibility },
      reason: input.reason,
      targetId: userId,
      targetType: "user_profile"
    });
    return { ok: true as const, visibility };
  }

  userAuditForTarget(userId: string, limit: number) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      where: { targetId: userId, targetType: "user_profile" }
    });
  }

  private utcDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private async getFlashcardDayLimitForUser(userId: string) {
    const resolved = await this.resolvePlanForUser(userId);
    const policyKey = "flashcard_reviews_per_day";
    const q = resolved.plan.planQuotas.find((pq) => pq.quotaPolicy.key === policyKey);
    return q?.limitValue ?? 20;
  }

  private async resolvePlanForUser(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      include: {
        plan: {
          include: {
            entitlements: { include: { entitlement: true } },
            planQuotas: { include: { quotaPolicy: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      where: {
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
        status: { in: ["active", "trialing"] },
        userId
      }
    });
    if (sub) {
      return { plan: sub.plan, source: "subscription" as const, subscription: sub };
    }
    const free = await this.prisma.plan.findFirst({
      include: {
        entitlements: { include: { entitlement: true } },
        planQuotas: { include: { quotaPolicy: true } }
      },
      where: { slug: "free", status: "active" }
    });
    if (free) {
      return { plan: free, source: "default" as const, subscription: null };
    }
    this.log.warn(
      'No active plan with slug "free". Run monetization seed (e.g. apps/api/scripts/seed-monetization). Using in-memory defaults for admin user list/detail.'
    );
    type PlanForResolve = Prisma.PlanGetPayload<{
      include: {
        entitlements: { include: { entitlement: true } };
        planQuotas: { include: { quotaPolicy: true } };
      };
    }>;
    const syntheticPlan: PlanForResolve = {
      config: {},
      createdAt: new Date(0),
      entitlements: [],
      id: "00000000-0000-4000-8000-0000000000ff",
      nameKey: "plan.free.name",
      planQuotas: [],
      slug: "free",
      sortOrder: 0,
      status: "active",
      updatedAt: new Date(0)
    };
    return { plan: syntheticPlan, source: "default" as const, subscription: null };
  }

  async createUser(
    actorId: string,
    input: {
      dailyGoalCards: number;
      displayName: string;
      email?: string;
      explanationLocale: string;
      targetBjtBand?: string;
      timezone: string;
      uiLocale: string;
    }
  ) {
    const user = await this.prisma.userProfile.create({ data: input });
    await this.writeAudit({
      action: "admin.user.created",
      actorId,
      after: user,
      before: null,
      reason: "Created from admin user management",
      targetId: user.id,
      targetType: "user_profile"
    });
    return user;
  }

  async audit(params: {
    limit: number;
    offset: number;
    action?: string;
    actorId?: string;
    targetType?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" as const } } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.q
        ? {
            OR: [
              { action: { contains: params.q, mode: "insensitive" as const } },
              { targetId: { contains: params.q, mode: "insensitive" as const } },
              { reason: { contains: params.q, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
              ...(params.dateTo ? { lte: new Date(params.dateTo) } : {})
            }
          }
        : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip: params.offset,
        take: params.limit
      }),
      this.prisma.adminAuditLog.count({ where })
    ]);
    return { items, total, page: Math.floor(params.offset / params.limit) + 1, pageSize: params.limit };
  }

  /**
   * Lists support notes from admin_audit_log. Privacy-hardened:
   *  - actorScope === "self": include team/audit_only + own-private only.
   *  - actorScope === "audit_only": include all visibilities (compliance read).
   *  - actorScope === "team_only" (default): include team + audit_only + viewer's own-private.
   */
  async supportNotes(input: {
    limit: number;
    offset: number;
    userId?: string;
    createdBy?: string;
    q?: string;
    visibility?: "private" | "team" | "audit_only";
    dateFrom?: string;
    dateTo?: string;
    viewerActorId?: string;
    actorScope?: "self" | "team_only" | "audit_only";
  }) {
    const scope = input.actorScope ?? "team_only";
    const where: Prisma.AdminAuditLogWhereInput = {
      action: "admin.user.support_note",
      ...(input.userId ? { targetId: input.userId } : {}),
      ...(input.createdBy ? { actorId: input.createdBy } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: new Date(input.dateTo) } : {})
            }
          }
        : {})
    };
    const extraClauses: Prisma.AdminAuditLogWhereInput[] = [];
    if (input.visibility) {
      extraClauses.push({ before: { path: ["visibility"], equals: input.visibility } });
    } else if (scope === "team_only" || scope === "self") {
      const allowed: Prisma.AdminAuditLogWhereInput[] = [
        { before: { path: ["visibility"], equals: "team" } },
        { before: { path: ["visibility"], equals: "audit_only" } },
        // legacy notes (no visibility key) treated as team
        { before: { equals: Prisma.JsonNull } }
      ];
      if (input.viewerActorId) {
        allowed.push({
          AND: [
            { before: { path: ["visibility"], equals: "private" } },
            { actorId: input.viewerActorId }
          ]
        });
      }
      extraClauses.push({ OR: allowed });
    }
    if (input.q) {
      extraClauses.push({
        OR: [
          { reason: { contains: input.q, mode: "insensitive" } },
          { targetId: { contains: input.q } }
        ]
      });
    }
    const finalWhere: Prisma.AdminAuditLogWhereInput =
      extraClauses.length > 0 ? { AND: [where, ...extraClauses] } : where;
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { displayName: true, email: true, id: true } } },
        orderBy: { createdAt: "desc" },
        skip: input.offset,
        take: input.limit,
        where: finalWhere
      }),
      this.prisma.adminAuditLog.count({ where: finalWhere })
    ]);
    return { items, total };
  }

  readingAssistReports(input: { kind: string | undefined; limit: number }) {
    return this.prisma.readingAssistReport.findMany({
      include: { user: { select: { displayName: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      where: {
        ...(input.kind ? { kind: input.kind } : {})
      }
    });
  }

  private exampleWhere(q: string | undefined, status: string | undefined): Prisma.ExampleSentenceWhereInput {
    return {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { japaneseText: { contains: q, mode: "insensitive" } },
              { translationVi: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private lexemeWhere(
    q: string | undefined,
    status: string | undefined,
    F: ContentListFilters
  ): Prisma.LexemeWhereInput {
    return {
      ...(status ? { status } : {}),
      ...(F.jlptLevel
        ? { jlptLevel: { contains: F.jlptLevel, mode: "insensitive" } }
        : {}),
      ...(F.reading
        ? { reading: { contains: F.reading, mode: "insensitive" } }
        : {}),
      ...(q
        ? {
            OR: [
              { headword: { contains: q, mode: "insensitive" } },
              { shortMeaningVi: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private kanjiWhere(
    q: string | undefined,
    status: string | undefined,
    F: ContentListFilters
  ): Prisma.KanjiWhereInput {
    const strokeWhere: Prisma.IntNullableFilter | undefined = (() => {
      if (F.strokeCountMin != null && F.strokeCountMax != null) {
        return { gte: F.strokeCountMin, lte: F.strokeCountMax };
      }
      if (F.strokeCountMin != null) {
        return { gte: F.strokeCountMin };
      }
      if (F.strokeCountMax != null) {
        return { lte: F.strokeCountMax };
      }
      return undefined;
    })();
    return {
      ...(status ? { status } : {}),
      ...(F.level != null ? { level: F.level } : {}),
      ...(strokeWhere ? { strokeCount: strokeWhere } : {}),
      ...(q
        ? {
            OR: [
              { character: { contains: q, mode: "insensitive" } },
              { meaningVi: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private grammarWhere(
    q: string | undefined,
    status: string | undefined,
    F: ContentListFilters
  ): Prisma.GrammarPointWhereInput {
    const and: Prisma.GrammarPointWhereInput[] = [];
    if (status) {
      and.push({ status });
    }
    if (F.jlptLevel) {
      and.push({ jlptLevel: { contains: F.jlptLevel, mode: "insensitive" } });
    }
    if (q) {
      and.push({
        OR: [
          { pattern: { contains: q, mode: "insensitive" } },
          { meaningVi: { contains: q, mode: "insensitive" } }
        ]
      });
    }
    const cat = F.category?.trim();
    if (cat) {
      and.push({ category: cat });
    } else {
      const g = F.categoryGroup?.trim() as GrammarCategoryGroupId | undefined;
      if (g) {
        const clauses = getGrammarCategoryGroupFilterClauses(g);
        const ors: Prisma.GrammarPointWhereInput[] = [];
        for (const c of clauses) {
          if (c.kind === "categoryEquals") {
            ors.push({ category: c.value });
          } else if (c.kind === "categoryContains") {
            ors.push({ category: { contains: c.value, mode: "insensitive" } });
          } else if (c.kind === "categoryIsNull") {
            ors.push({ category: null });
          } else if (c.kind === "categoryEmpty") {
            ors.push({ category: "" });
          }
        }
        if (ors.length) {
          and.push({ OR: ors });
        }
      }
    }
    if (and.length === 0) {
      return {};
    }
    if (and.length === 1) {
      return and[0]!;
    }
    return { AND: and };
  }

  private groupStatusToMap(
    statusGroups: { status: string; _count: { _all: number } }[]
  ): Record<string, number> {
    return Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
  }

  private groupLevelStringToMap(rows: { key: string | null; count: number }[]): Record<string, number> {
    return Object.fromEntries(
      rows.map((r) => [
        r.key === null || r.key === "" || r.key === undefined ? "—" : r.key,
        r.count
      ])
    );
  }

  private pickContentPatchData(type: ContentKind, fields: PatchFields) {
    if (type === "lexeme") {
      const d: Prisma.LexemeUpdateInput = {};
      if (fields.headword !== undefined) d.headword = fields.headword;
      if (fields.reading !== undefined) d.reading = fields.reading;
      if (fields.shortMeaningVi !== undefined) d.shortMeaningVi = fields.shortMeaningVi;
      if (fields.kanjiMeaningVi !== undefined) d.kanjiMeaningVi = fields.kanjiMeaningVi;
      if (fields.jlptLevel !== undefined) d.jlptLevel = fields.jlptLevel;
      if (fields.status !== undefined) d.status = fields.status;
      return d;
    }
    if (type === "kanji") {
      const d: Prisma.KanjiUpdateInput = {};
      if (fields.character !== undefined) d.character = fields.character;
      if (fields.meaningVi !== undefined) d.meaningVi = fields.meaningVi;
      if (fields.onyomi !== undefined) d.onyomi = fields.onyomi;
      if (fields.kunyomi !== undefined) d.kunyomi = fields.kunyomi;
      if (fields.strokeCount !== undefined) d.strokeCount = fields.strokeCount;
      if (fields.level !== undefined) d.level = fields.level;
      if (fields.status !== undefined) d.status = fields.status;
      return d;
    }
    if (type === "grammar") {
      const d: Prisma.GrammarPointUpdateInput = {};
      if (fields.pattern !== undefined) d.pattern = fields.pattern;
      if (fields.meaningVi !== undefined) d.meaningVi = fields.meaningVi;
      if (fields.jlptLevel !== undefined) d.jlptLevel = fields.jlptLevel;
      if (fields.category !== undefined) d.category = fields.category;
      if (fields.status !== undefined) d.status = fields.status;
      return d;
    }
    if (type === "example") {
      return {};
    }
    return {};
  }

  private updateContentFields(
    type: ContentKind,
    id: string,
    data: Prisma.LexemeUpdateInput | Prisma.KanjiUpdateInput | Prisma.GrammarPointUpdateInput
  ) {
    if (type === "lexeme") {
      return this.prisma.lexeme.update({ data: data as Prisma.LexemeUpdateInput, where: { id } });
    }
    if (type === "kanji") {
      try {
        return this.prisma.kanji.update({ data: data as Prisma.KanjiUpdateInput, where: { id } });
      } catch (e: unknown) {
        if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
          throw new ConflictException("Kanji character already exists");
        }
        throw e;
      }
    }
    if (type === "grammar") {
      return this.prisma.grammarPoint.update({
        data: data as Prisma.GrammarPointUpdateInput,
        where: { id }
      });
    }
    throw new NotFoundException("Content item not found");
  }

  private findContentById(type: ContentKind, id: string) {
    switch (type) {
      case "example":
        return this.prisma.exampleSentence.findUnique({ where: { id } });
      case "grammar":
        return this.prisma.grammarPoint.findUnique({ where: { id } });
      case "kanji":
        return this.prisma.kanji.findUnique({ where: { id } });
      case "lexeme":
        return this.prisma.lexeme.findUnique({ where: { id } });
    }
  }

  private updateContentById(type: ContentKind, id: string, data: { status: string }) {
    switch (type) {
      case "example":
        return this.prisma.exampleSentence.update({ data, where: { id } });
      case "grammar":
        return this.prisma.grammarPoint.update({ data, where: { id } });
      case "kanji":
        return this.prisma.kanji.update({ data, where: { id } });
      case "lexeme":
        return this.prisma.lexeme.update({ data, where: { id } });
    }
  }

  private writeAudit(input: {
    action: string;
    actorId: string;
    after: unknown;
    before: unknown;
    reason: string;
    targetId: string;
    targetType: string;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        after: input.after as Prisma.InputJsonValue,
        before: input.before as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.targetId,
        targetType: input.targetType
      }
    });
  }
}
