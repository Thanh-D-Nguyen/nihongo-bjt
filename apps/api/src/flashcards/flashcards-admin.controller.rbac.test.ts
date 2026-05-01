import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { FlashcardsAdminController } from "./flashcards-admin.controller.js";

function createController(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "admin.content.write" && !opts.canManage) {
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
    deckDetail: vi.fn().mockResolvedValue({ id: "d", audit: [] }),
    listDecks: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 }),
    listVariants: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 }),
    patchVariant: vi.fn().mockResolvedValue({ id: "v" }),
    transitionDeck: vi.fn().mockResolvedValue({ id: "d" }),
    transitionVariant: vi.fn().mockResolvedValue({ id: "v" }),
    variantDetail: vi.fn().mockResolvedValue({ id: "v", audit: [] })
  };
  return {
    auth,
    controller: new FlashcardsAdminController(auth as never, repo as never),
    repo
  };
}

const TARGET = "22222222-2222-4222-8222-222222222222";
const REASON = { reason: "moderation review" };

describe("FlashcardsAdminController RBAC", () => {
  it("denies listDecks without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.listDecks({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.listDecks).not.toHaveBeenCalled();
  });
  it("allows listDecks for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.listDecks({} as never, {});
    expect(repo.listDecks).toHaveBeenCalled();
  });
  it("denies transitionDeck without admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.transitionDeck({} as never, TARGET, { next: "archived", ...REASON })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.transitionDeck).not.toHaveBeenCalled();
  });
  it("allows transitionDeck with admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.transitionDeck({} as never, TARGET, { next: "active", ...REASON });
    expect(repo.transitionDeck).toHaveBeenCalled();
  });
  it("rejects transitionDeck with too-short reason", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.transitionDeck({} as never, TARGET, { next: "active", reason: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.transitionDeck).not.toHaveBeenCalled();
  });
  it("rejects transitionDeck with invalid status enum", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.transitionDeck({} as never, TARGET, { next: "bogus", ...REASON })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.transitionDeck).not.toHaveBeenCalled();
  });
  it("denies listVariants without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.listVariants({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.listVariants).not.toHaveBeenCalled();
  });
  it("denies patchVariant without admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.patchVariant({} as never, TARGET, { frontText: "新", ...REASON })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.patchVariant).not.toHaveBeenCalled();
  });
  it("allows patchVariant with admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.patchVariant({} as never, TARGET, { frontText: "新しい", ...REASON });
    expect(repo.patchVariant).toHaveBeenCalled();
  });
  it("denies transitionVariant without admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.transitionVariant({} as never, TARGET, { next: "archived", ...REASON })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.transitionVariant).not.toHaveBeenCalled();
  });
  it("allows transitionVariant with admin.content.write", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.transitionVariant({} as never, TARGET, { next: "active", ...REASON });
    expect(repo.transitionVariant).toHaveBeenCalled();
  });
});
