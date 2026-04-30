import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

export type AdminAuditWriteInput = {
  action: string;
  adminUserId: string;
  resourceType: string;
  resourceId?: string | null;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
  timestamp?: Date;
};

@Injectable()
export class AdminAuditService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async createAuditLog(input: AdminAuditWriteInput) {
    const createdAt = input.timestamp ?? new Date();
    const beforeState = input.beforeState ? JSON.stringify(input.beforeState) : null;
    const afterState = input.afterState ? JSON.stringify(input.afterState) : null;
    return this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO admin.audit_log (
          action,
          admin_user_id,
          resource_type,
          resource_id,
          before_state,
          after_state,
          created_at
        ) VALUES (
          ${input.action},
          ${input.adminUserId}::uuid,
          ${input.resourceType},
          ${input.resourceId ?? null},
          ${beforeState}::jsonb,
          ${afterState}::jsonb,
          ${createdAt}
        )
      `
    );
  }

  async queryRecentAnalytics(days = 30) {
    const windowDays = Math.min(Math.max(days, 1), 365);
    const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const totalRows = (await this.prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS total FROM admin.audit_log WHERE created_at >= ${from}`
    )) as Array<{ total: bigint }>;
    const byAction = (await this.prisma.$queryRaw<{ action: string; total: bigint }[]>(
      Prisma.sql`
        SELECT action, COUNT(*)::bigint AS total
        FROM admin.audit_log
        WHERE created_at >= ${from}
        GROUP BY action
        ORDER BY COUNT(*) DESC
      `
    )) as Array<{ action: string; total: bigint }>;
    const byResourceType = (await this.prisma.$queryRaw<{ resource_type: string; total: bigint }[]>(
      Prisma.sql`
        SELECT resource_type, COUNT(*)::bigint AS total
        FROM admin.audit_log
        WHERE created_at >= ${from}
        GROUP BY resource_type
        ORDER BY COUNT(*) DESC
      `
    )) as Array<{ resource_type: string; total: bigint }>;

    return {
      byAction,
      byResourceType,
      from,
      total: Number(totalRows[0]?.total ?? 0n),
      windowDays
    };
  }
}
