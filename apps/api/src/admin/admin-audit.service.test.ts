import { createPrismaClient } from "@nihongo-bjt/database";
import { describe, expect, it, vi } from "vitest";

import { AdminAuditService } from "./admin-audit.service.js";

vi.mock("@nihongo-bjt/database", () => ({
  Prisma: {
    JsonNull: null,
    sql: (chunks: TemplateStringsArray, ...values: unknown[]) => ({ chunks, values })
  },
  createPrismaClient: vi.fn()
}));

describe("AdminAuditService", () => {
  it("writes admin audit row with normalized defaults", async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    (createPrismaClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      $executeRaw: executeRaw,
      $queryRaw: vi.fn()
    });

    const service = new AdminAuditService();
    await service.createAuditLog({
      action: "content.update",
      adminUserId: "actor-1",
      resourceId: "res-1",
      resourceType: "content"
    });

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("returns last-30-days analytics aggregates", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ total: 8n }])
      .mockResolvedValueOnce([{ action: "content.update", total: 5n }])
      .mockResolvedValueOnce([{ resource_type: "content", total: 6n }]);

    (createPrismaClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      $executeRaw: vi.fn(),
      $queryRaw: queryRaw
    });

    const service = new AdminAuditService();
    const result = await service.queryRecentAnalytics();

    expect(result.total).toBe(8);
    expect(result.byAction[0]?.action).toBe("content.update");
    expect(result.byResourceType[0]?.resource_type).toBe("content");
    expect(result.windowDays).toBe(30);
  });
});
