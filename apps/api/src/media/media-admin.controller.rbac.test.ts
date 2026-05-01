import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MediaAdminController } from "./media-admin.controller.js";

function build(opts: { canWrite: boolean; canRead: boolean }) {
  const adminAuth = {
    requireOneOfPermissions: vi.fn().mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isWrite = candidates.some(
        (c) => c === "media.manage" || c === "content.manage" || c === "iam.manage"
      ) && !candidates.includes("viewer.audit");
      if (isWrite && !opts.canWrite) throw new ForbiddenException("forbidden");
      if (!isWrite && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
    })
  };
  const mediaService = { adminListAssets: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
  const ctrl = new MediaAdminController(adminAuth as never, mediaService as never);
  return { adminAuth, ctrl, mediaService };
}

describe("MediaAdminController RBAC (Sweep C)", () => {
  it("denies list when no perm", async () => {
    const { ctrl } = build({ canRead: false, canWrite: false });
    await expect(ctrl.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies updateMetadata without write perm", async () => {
    const { ctrl } = build({ canRead: true, canWrite: false });
    await expect(
      ctrl.updateMetadata({} as never, "11111111-1111-4111-8111-111111111111", {
        license: "CC-BY-4.0",
        reason: "license correction"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects updateMetadata without reason", async () => {
    const { ctrl } = build({ canRead: true, canWrite: true });
    await expect(
      ctrl.updateMetadata({} as never, "11111111-1111-4111-8111-111111111111", { license: "CC-BY-4.0" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies softDelete without write perm", async () => {
    const { ctrl } = build({ canRead: true, canWrite: false });
    await expect(
      ctrl.softDelete({} as never, "11111111-1111-4111-8111-111111111111", { reason: "deprecated" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects softDelete without reason", async () => {
    const { ctrl } = build({ canRead: true, canWrite: true });
    await expect(
      ctrl.softDelete({} as never, "11111111-1111-4111-8111-111111111111", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
