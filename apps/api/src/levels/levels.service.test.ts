import { describe, expect, it, vi } from "vitest";

import { LevelsService } from "./levels.module.js";

describe("LevelsService production curriculum queries", () => {
  it("requests active lessons in curriculum order and exposes week/type metadata", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "j3-w01-checkpoint",
        sortOrder: 7,
        titleVi: "Checkpoint",
        titleJa: "チェックポイント",
        descriptionVi: "Mô tả",
        descriptionJa: "説明",
        weekNumber: 1,
        unitType: "checkpoint",
        unitOrder: 7,
        estimatedDurationMin: 35,
        difficulty: "intermediate",
        skillTags: ["judgment"],
        businessTopics: ["workplace-relations"],
        contentVersion: "2026.07.1",
        lessonContent: { activities: [{ id: "a" }, { id: "b" }] },
        items: []
      }
    ]);
    const service = new LevelsService();
    Object.assign(service, { prisma: { bjtLesson: { findMany } } });
    const result = await service.lessons("J3");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: "asc" },
        where: { levelCode: "J3", status: "active" }
      })
    );
    expect(result[0]).toMatchObject({
      weekNumber: 1,
      unitType: "checkpoint",
      unitOrder: 7,
      activityCount: 2,
      contentVersion: "2026.07.1"
    });
  });
});
