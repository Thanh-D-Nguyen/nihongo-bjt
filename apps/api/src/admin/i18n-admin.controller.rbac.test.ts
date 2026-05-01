import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { I18nAdminController } from "./i18n-admin.controller.js";

function createController(opts: { canWrite: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "admin.content.write" && !opts.canWrite) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["admin.content.write"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    detail: vi.fn().mockResolvedValue({ id: "1", audit: [] }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 }),
    pendingSummary: vi.fn().mockResolvedValue({ complete: 0, namespaces: [], pending: 0, total: 0 }),
    upsertTranslation: vi.fn().mockResolvedValue({ id: "1" })
  };
  return {
    auth,
    controller: new I18nAdminController(auth as never, repo as never),
    repo
  };
}

const validBody = { locale: "ja", reason: "complete missing", value: "新しい" };

describe("I18nAdminController RBAC", () => {
  it("denies listKeys without any read perm", async () => {
    const { controller, repo } = createController({ canRead: false, canWrite: false });
    await expect(controller.listKeys({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows listKeys for viewer.audit", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await controller.listKeys({} as never, {});
    expect(repo.list).toHaveBeenCalled();
  });
  it("denies pending without read perms", async () => {
    const { controller, repo } = createController({ canRead: false, canWrite: false });
    await expect(controller.pending({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.pendingSummary).not.toHaveBeenCalled();
  });
  it("allows pending for viewer.audit", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await controller.pending({} as never);
    expect(repo.pendingSummary).toHaveBeenCalled();
  });
  it("denies updateTranslation without admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.updateTranslation({} as never, "1", validBody)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.upsertTranslation).not.toHaveBeenCalled();
  });
  it("allows updateTranslation with admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await controller.updateTranslation({} as never, "1", validBody);
    expect(repo.upsertTranslation).toHaveBeenCalled();
  });
  it("rejects updateTranslation with non-numeric id", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.updateTranslation({} as never, "not-a-number", validBody)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsertTranslation).not.toHaveBeenCalled();
  });
  it("rejects updateTranslation with invalid locale", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.updateTranslation({} as never, "1", { ...validBody, locale: "fr" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsertTranslation).not.toHaveBeenCalled();
  });
  it("rejects updateTranslation with too-short reason", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.updateTranslation({} as never, "1", { ...validBody, reason: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsertTranslation).not.toHaveBeenCalled();
  });
});
