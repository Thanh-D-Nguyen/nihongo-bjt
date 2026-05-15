import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MediaController } from "./media.controller.js";

describe("MediaController feature gate", () => {
  const expectedGateArgs = [
    "external_media_uploads",
    { message: "Media uploads are temporarily disabled" }
  ] as const;

  const createDisabledGate = () => ({
    requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
  });
  const imageSearch = { search: vi.fn() };

  it("blocks presign when external media uploads are disabled", async () => {
    const mediaService = { presignUpload: vi.fn() };
    const disabledGate = createDisabledGate();
    const controller = new MediaController(mediaService as any, disabledGate as any, imageSearch as any);

    await expect(controller.presign(undefined, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(disabledGate.requireEnabled).toHaveBeenCalledWith(...expectedGateArgs);
    expect(mediaService.presignUpload).not.toHaveBeenCalled();
  });

  it("blocks complete-upload when external media uploads are disabled", async () => {
    const mediaService = { completeUpload: vi.fn() };
    const disabledGate = createDisabledGate();
    const controller = new MediaController(mediaService as any, disabledGate as any, imageSearch as any);

    await expect(controller.completeUpload(undefined, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(disabledGate.requireEnabled).toHaveBeenCalledWith(...expectedGateArgs);
    expect(mediaService.completeUpload).not.toHaveBeenCalled();
  });

  it("blocks rights-metadata updates when external media uploads are disabled", async () => {
    const mediaService = { updateRightsMetadata: vi.fn() };
    const disabledGate = createDisabledGate();
    const controller = new MediaController(mediaService as any, disabledGate as any, imageSearch as any);

    await expect(controller.updateRightsMetadata(undefined, "asset-1", {})).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(disabledGate.requireEnabled).toHaveBeenCalledWith(...expectedGateArgs);
    expect(mediaService.updateRightsMetadata).not.toHaveBeenCalled();
  });

  it("blocks read-url when external media uploads are disabled", async () => {
    const mediaService = { getReadUrlForAsset: vi.fn() };
    const disabledGate = createDisabledGate();
    const controller = new MediaController(mediaService as any, disabledGate as any, imageSearch as any);

    await expect(controller.readUrl(undefined, "asset-1", {})).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(disabledGate.requireEnabled).toHaveBeenCalledWith(...expectedGateArgs);
    expect(mediaService.getReadUrlForAsset).not.toHaveBeenCalled();
  });
});
