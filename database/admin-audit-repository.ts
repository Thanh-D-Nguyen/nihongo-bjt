import { Prisma, type PrismaClient } from "@nihongo-bjt/database";

export type AdminAuditDashboardQuery = {
  days?: number;
};

export class AdminAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listRecent(params: AdminAuditDashboardQuery = {}) {
    const days = Math.min(Math.max(params.days ?? 30, 1), 365);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT id, action, admin_user_id, resource_type, resource_id, before_state, after_state, created_at
        FROM admin.audit_log
        WHERE created_at >= ${from}
        ORDER BY created_at DESC
        LIMIT 500
      `
    );
  }

  async aggregateRecent(params: AdminAuditDashboardQuery = {}) {
    const days = Math.min(Math.max(params.days ?? 30, 1), 365);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalRows, byAction] = await Promise.all([
      this.prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM admin.audit_log WHERE created_at >= ${from}`
      ),
      this.prisma.$queryRaw<{ action: string; total: bigint }[]>(
        Prisma.sql`
          SELECT action, COUNT(*)::bigint AS total
          FROM admin.audit_log
          WHERE created_at >= ${from}
          GROUP BY action
          ORDER BY COUNT(*) DESC
        `
      )
    ]);

    return {
      byAction,
      from,
      total: Number(totalRows[0]?.total ?? 0n),
      windowDays: days
    };
  }
}
