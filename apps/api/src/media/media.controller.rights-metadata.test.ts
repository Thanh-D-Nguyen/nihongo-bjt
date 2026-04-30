import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MediaController } from "./media.controller.js";

describe("MediaController rights metadata validation", () => {
  it("rejects sourceUrl when it does not use http(s)", async () => {
    const mediaService = { updateRightsMetadata: vi.fn() };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const controller = new MediaController(mediaService as any, featureGate as any);

    await expect(
      controller.updateRightsMetadata(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        "asset-1",
        {
          license: "CC-BY-4.0",
          sourceUrl: "ftp://example.com/image.jpg",
          userId: "11111111-1111-4111-8111-111111111111"
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaService.updateRightsMetadata).not.toHaveBeenCalled();
  });

  it("accepts license metadata for owned local uploads", async () => {
    const mediaService = {
      updateRightsMetadata: vi.fn().mockResolvedValue({
        accessibility: {
          altText: "Tax terminology chart for reading practice",
          reducedMotionSafe: true
        },
        id: "asset-1",
        license: "CC-BY-4.0",
        provenance: {
          sourceName: "Internal glossary"
        },
        rightsStatus: "cleared",
        sourceUrl: null
      })
    };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const controller = new MediaController(mediaService as any, featureGate as any);

    await expect(
      controller.updateRightsMetadata(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        "asset-1",
        {
          accessibility: {
            altText: "Tax terminology chart for reading practice",
            reducedMotionSafe: true
          },
          license: "CC-BY-4.0",
          provenance: {
            sourceName: "Internal glossary"
          },
          userId: "11111111-1111-4111-8111-111111111111"
        }
      )
    ).resolves.toMatchObject({
      id: "asset-1",
      license: "CC-BY-4.0",
      rightsStatus: "cleared"
    });
    expect(mediaService.updateRightsMetadata).toHaveBeenCalledWith({
      accessibility: {
        altText: "Tax terminology chart for reading practice",
        reducedMotionSafe: true
      },
      assetId: "asset-1",
      license: "CC-BY-4.0",
      provenance: {
        sourceName: "Internal glossary"
      },
      userId: "11111111-1111-4111-8111-111111111111"
    });
  });

  it("rejects accessibility payload without altText", async () => {
    const mediaService = { updateRightsMetadata: vi.fn() };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const controller = new MediaController(mediaService as any, featureGate as any);

    await expect(
      controller.updateRightsMetadata(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        "asset-1",
        {
          accessibility: {
            caption: "Missing alt text"
          },
          license: "CC-BY-4.0",
          userId: "11111111-1111-4111-8111-111111111111"
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaService.updateRightsMetadata).not.toHaveBeenCalled();
  });
});
