import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MediaController } from "./media.controller.js";

describe("MediaController upload validation", () => {
  const imageSearch = { search: vi.fn() };

  it("rejects presign when file extension does not match mime type", async () => {
    const mediaService = { presignUpload: vi.fn() };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const controller = new MediaController(mediaService as any, featureGate as any, imageSearch as any);

    await expect(
      controller.presign(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        {
          fileName: "avatar.png",
          mimeType: "image/jpeg",
          userId: "11111111-1111-4111-8111-111111111111"
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaService.presignUpload).not.toHaveBeenCalled();
  });

  it("allows presign when extension matches mime type", async () => {
    const mediaService = {
      presignUpload: vi.fn().mockResolvedValue({
        assetId: "asset-1",
        objectKey: "obj-1",
        uploadUrl: "https://storage.local/upload"
      })
    };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const controller = new MediaController(mediaService as any, featureGate as any, imageSearch as any);

    await expect(
      controller.presign(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        {
          fileName: "avatar.jpeg",
          mimeType: "image/jpeg",
          userId: "11111111-1111-4111-8111-111111111111"
        }
      )
    ).resolves.toEqual({
      assetId: "asset-1",
      objectKey: "obj-1",
      uploadUrl: "https://storage.local/upload"
    });
    expect(mediaService.presignUpload).toHaveBeenCalledTimes(1);
  });
});
