import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  mediaAsset: {
    findFirst: vi.fn()
  },
  userFlashcard: {
    findFirst: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardsRepository } from "./flashcards.repository.js";

describe("FlashcardsRepository media rights integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks linking media until provenance/license metadata is complete", async () => {
    prismaMock.userFlashcard.findFirst.mockResolvedValue({ id: "uf-1" });
    prismaMock.mediaAsset.findFirst.mockResolvedValue({
      accessibility: null,
      byteSize: 1024,
      id: "asset-1",
      license: null,
      mimeType: "image/png",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      provider: "local",
      rightsStatus: "pending_review",
      sourceUrl: null,
      status: "active"
    });

    const repository = new FlashcardsRepository();

    await expect(
      repository.linkCardToMedia({
        assetId: "asset-1",
        cardId: "card-1",
        role: "primary_image",
        userId: "11111111-1111-4111-8111-111111111111"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("allows linking once rights are cleared and metadata is present", async () => {
    prismaMock.userFlashcard.findFirst.mockResolvedValue({ id: "uf-1" });
    prismaMock.mediaAsset.findFirst.mockResolvedValue({
      accessibility: {
        altText: "A business phrase illustration",
        reducedMotionSafe: true
      },
      byteSize: 1024,
      id: "asset-1",
      license: "CC-BY-4.0",
      mimeType: "image/png",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      provider: "local",
      rightsStatus: "cleared",
      sourceUrl: null,
      status: "active"
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        cardMediaLink: {
          create: vi.fn().mockResolvedValue({ id: "link-1", asset: { id: "asset-1" } }),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findFirstOrThrow: vi.fn()
        }
      };
      return callback(tx);
    });

    const repository = new FlashcardsRepository();

    await expect(
      repository.linkCardToMedia({
        assetId: "asset-1",
        cardId: "card-1",
        role: "primary_image",
        userId: "11111111-1111-4111-8111-111111111111"
      })
    ).resolves.toMatchObject({ id: "link-1" });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("blocks linking when accessibility alt text is missing", async () => {
    prismaMock.userFlashcard.findFirst.mockResolvedValue({ id: "uf-1" });
    prismaMock.mediaAsset.findFirst.mockResolvedValue({
      accessibility: {
        reducedMotionSafe: true
      },
      byteSize: 1024,
      id: "asset-1",
      license: "CC-BY-4.0",
      mimeType: "image/png",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      provider: "local",
      rightsStatus: "cleared",
      sourceUrl: null,
      status: "active"
    });

    const repository = new FlashcardsRepository();

    await expect(
      repository.linkCardToMedia({
        assetId: "asset-1",
        cardId: "card-1",
        role: "primary_image",
        userId: "11111111-1111-4111-8111-111111111111"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
