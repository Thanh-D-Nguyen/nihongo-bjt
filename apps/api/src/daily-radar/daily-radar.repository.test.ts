import { beforeEach, describe, expect, it, vi } from "vitest";

const modulePublished = {
  category: "work",
  defaultPriority: 10,
  disclaimerJa: null,
  disclaimerVi: null,
  id: "module-work",
  isEnabled: true,
  moduleKey: "workplace_mission",
  status: "published",
  titleJa: "今日の仕事シーン",
  titleVi: "Tình huống công việc",
  updatedAt: new Date(),
  visualTheme: "blue_corporate"
};

const prismaMock = {
  dailyRadarCard: {
    findMany: vi.fn()
  },
  dailyRadarModuleConfig: {
    findMany: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock,
  Prisma: { JsonNull: null }
}));

import { DailyRadarRepository } from "./daily-radar.repository.js";

describe("DailyRadarRepository public home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyRadarModuleConfig.findMany.mockResolvedValue([modulePublished]);
  });

  it("returns spotlight and ordered cards from enabled published modules", async () => {
    prismaMock.dailyRadarCard.findMany.mockResolvedValue([
      {
        category: "work",
        id: "card-spotlight",
        isPinned: true,
        isSpotlight: true,
        moduleConfig: { ...modulePublished, isSpotlightEligible: true },
        priority: 100,
        status: "published",
        titleVi: "取引先から催促メールが来た",
        updatedAt: new Date()
      },
      {
        category: "life",
        id: "card-life",
        isPinned: false,
        isSpotlight: false,
        moduleConfig: { ...modulePublished, category: "life", moduleKey: "life_hack" },
        priority: 80,
        status: "published",
        titleVi: "不在票が入っていたら？",
        updatedAt: new Date()
      }
    ]);

    const repo = new DailyRadarRepository();
    const result = await repo.home();

    expect(result.spotlight?.id).toBe("card-spotlight");
    expect(result.cards).toHaveLength(2);
    expect(result.categories).toEqual(expect.arrayContaining(["work", "life"]));
    expect(prismaMock.dailyRadarCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          moduleConfig: { isEnabled: true, status: "published" },
          status: "published"
        })
      })
    );
  });

  it("falls back to pinned/highest priority when no spotlight card is eligible", async () => {
    prismaMock.dailyRadarCard.findMany.mockResolvedValue([
      {
        category: "news",
        id: "card-pinned",
        isPinned: true,
        isSpotlight: false,
        moduleConfig: { ...modulePublished, isSpotlightEligible: false },
        priority: 80,
        status: "published",
        titleVi: "NHK News → BJT",
        updatedAt: new Date()
      }
    ]);

    const repo = new DailyRadarRepository();
    const result = await repo.home();

    expect(result.spotlight?.id).toBe("card-pinned");
  });
});
