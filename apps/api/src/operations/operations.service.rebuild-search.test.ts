import { describe, expect, it, vi } from "vitest";

import { OperationsService } from "./operations.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("OperationsService rebuildSearchProjection", () => {
  it("audits a successful search rebuild operation", async () => {
    const summary = {
      indexed: 42,
      sourceSystem: "PostgreSQL",
      timestamp: "2026-04-29T16:00:00.000Z"
    };
    const service = new OperationsService({
      rebuildProjectionIndex: vi.fn().mockResolvedValue(summary)
    } as any);
    const adminAuditCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      adminAuditLog: { create: adminAuditCreate }
    };

    await expect(
      service.rebuildSearchProjection({ actorId: "admin-1", reason: "rebuild after import" })
    ).resolves.toEqual(summary);

    expect((service as any).searchService.rebuildProjectionIndex).toHaveBeenCalledTimes(1);
    expect(adminAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ops.search.rebuild",
          actorId: "admin-1",
          after: summary,
          reason: "rebuild after import",
          targetId: "content_search",
          targetType: "ops.search_index"
        })
      })
    );
  });
});
