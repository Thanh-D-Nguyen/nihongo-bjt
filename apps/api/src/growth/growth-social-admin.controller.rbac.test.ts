import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GrowthSocialAdminController } from "./growth-social-admin.controller.js";

function createController(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "growth.manage" && !opts.canManage) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["growth.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    archiveTemplate: vi.fn().mockResolvedValue({ id: "x", active: false }),
    createTemplate: vi.fn().mockResolvedValue({ id: "x" }),
    detailTemplate: vi.fn().mockResolvedValue({ audit: [], id: "x" }),
    listEvents: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listTemplates: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    moderateEvent: vi.fn().mockResolvedValue({ action: "dismiss", id: "x", ok: true }),
    patchTemplate: vi.fn().mockResolvedValue({ id: "x" }),
    publishTemplate: vi.fn().mockResolvedValue({ id: "x", active: true })
  };
  return {
    auth,
    controller: new GrowthSocialAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  config: {
    bodyTemplate: "Check this out!",
    name: "Social link card",
    privacyClass: "anonymized",
    surface: "social"
  },
  kind: "social_link",
  reason: "T1 add",
  slug: "social-link-v1"
};
const validReason = { reason: "rotate" };

describe("GrowthSocialAdminController RBAC", () => {
  it("denies listTemplates without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.listTemplates({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.listTemplates).not.toHaveBeenCalled();
  });
  it("denies listEvents without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.listEvents({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.listEvents).not.toHaveBeenCalled();
  });
  it("allows listEvents for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.listEvents({} as never, { hidden: "active" });
    expect(repo.listEvents).toHaveBeenCalled();
  });
  it("denies createTemplate without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.createTemplate({} as never, validCreate)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.createTemplate).not.toHaveBeenCalled();
  });
  it("rejects createTemplate with config.surface != social", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.createTemplate({} as never, {
        ...validCreate,
        config: { ...validCreate.config, surface: "postcard" }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createTemplate).not.toHaveBeenCalled();
  });
  it("denies publishTemplate without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.publishTemplate({} as never, targetId, validReason)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.publishTemplate).not.toHaveBeenCalled();
  });
  it("denies archiveTemplate without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.archiveTemplate({} as never, targetId, validReason)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.archiveTemplate).not.toHaveBeenCalled();
  });
  it("denies moderate without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.moderate({} as never, targetId, { action: "dismiss", reason: "spam" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.moderateEvent).not.toHaveBeenCalled();
  });
  it("rejects moderate with bad action", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.moderate({} as never, targetId, { action: "delete", reason: "spam content" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.moderateEvent).not.toHaveBeenCalled();
  });
  it("calls moderate with hide_from_public when allowed", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.moderate({} as never, targetId, {
      action: "hide_from_public",
      reason: "violates policy"
    });
    expect(repo.moderateEvent).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "hide_from_public",
      "violates policy"
    );
  });
});
