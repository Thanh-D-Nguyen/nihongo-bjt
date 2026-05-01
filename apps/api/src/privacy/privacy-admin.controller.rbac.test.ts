import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PrivacyAdminController } from "./privacy-admin.controller.js";

function createController(opts: { canRead: boolean; canWrite: boolean }) {
  const requireOneOfPermissions = vi.fn().mockImplementation(async (_req, candidates: string[]) => {
    const writePerms = ["iam.manage", "admin.privacy.write", "privacy.manage"];
    const wantsWrite = candidates.every((c) => writePerms.includes(c));
    if (wantsWrite && !opts.canWrite) throw new ForbiddenException("forbidden");
    if (!wantsWrite && !opts.canRead) throw new ForbiddenException("forbidden");
    return {
      actorId: "11111111-1111-4111-8111-111111111111",
      permissions: opts.canWrite ? new Set(["iam.manage"]) : new Set(["viewer.audit"])
    };
  });
  const auth = { requireOneOfPermissions } as never;
  const service = {
    adminListRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    adminGetRequest: vi.fn().mockResolvedValue({
      audit: [],
      completedAt: null,
      createdAt: new Date(),
      id: "00000000-0000-4000-8000-000000000099",
      kind: "export",
      lastError: null,
      resultPayload: null,
      status: "pending",
      userId: "00000000-0000-4000-8000-0000000000aa"
    }),
    adminTransition: vi.fn().mockResolvedValue({ id: "x", status: "processing" }),
    adminFulfill: vi.fn().mockResolvedValue({ id: "x", status: "completed" }),
    adminReject: vi.fn().mockResolvedValue({ id: "x", status: "failed" }),
    adminEraseConfirm: vi.fn().mockResolvedValue({ id: "x", status: "completed" })
  } as never;
  return { auth, controller: new PrivacyAdminController(auth, service), service };
}

const VALID_ID = "00000000-0000-4000-8000-000000000099";
const VALID_REASON = { reason: "verified user request" };

describe("PrivacyAdminController RBAC + validation", () => {
  it("denies list when caller lacks read perms", async () => {
    const { controller, service } = createController({ canRead: false, canWrite: false });
    await expect(controller.listRequests({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect((service as never as { adminListRequests: ReturnType<typeof vi.fn> }).adminListRequests).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: false });
    await controller.listRequests({} as never, { kind: "export", limit: "10" });
    expect((service as never as { adminListRequests: ReturnType<typeof vi.fn> }).adminListRequests).toHaveBeenCalled();
  });
  it("allows detail for read-only viewer", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: false });
    await controller.detail({} as never, VALID_ID);
    expect((service as never as { adminGetRequest: ReturnType<typeof vi.fn> }).adminGetRequest).toHaveBeenCalled();
  });
  it("404s detail when service returns null", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: false });
    (service as never as { adminGetRequest: ReturnType<typeof vi.fn> }).adminGetRequest.mockResolvedValueOnce(null);
    await expect(controller.detail({} as never, VALID_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
  it("denies acknowledge for viewer.audit", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.acknowledge({} as never, VALID_ID, VALID_REASON)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((service as never as { adminTransition: ReturnType<typeof vi.fn> }).adminTransition).not.toHaveBeenCalled();
  });
  it("allows acknowledge with iam.manage", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: true });
    await controller.acknowledge({} as never, VALID_ID, VALID_REASON);
    expect((service as never as { adminTransition: ReturnType<typeof vi.fn> }).adminTransition).toHaveBeenCalled();
  });
  it("rejects acknowledge with too-short reason", async () => {
    const { controller } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.acknowledge({} as never, VALID_ID, { reason: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("denies fulfill for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.fulfill({} as never, VALID_ID, VALID_REASON)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows fulfill with iam.manage and optional downloadUrl", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: true });
    await controller.fulfill({} as never, VALID_ID, {
      ...VALID_REASON,
      downloadUrl: "https://example.com/export.zip"
    });
    expect((service as never as { adminFulfill: ReturnType<typeof vi.fn> }).adminFulfill).toHaveBeenCalled();
  });
  it("rejects fulfill with invalid downloadUrl", async () => {
    const { controller } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.fulfill({} as never, VALID_ID, { ...VALID_REASON, downloadUrl: "not-a-url" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("denies reject for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.reject({} as never, VALID_ID, VALID_REASON)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows reject with iam.manage", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: true });
    await controller.reject({} as never, VALID_ID, VALID_REASON);
    expect((service as never as { adminReject: ReturnType<typeof vi.fn> }).adminReject).toHaveBeenCalled();
  });
  it("denies erasure-confirm without typed-confirmation token", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.erasureConfirm({} as never, VALID_ID, {
        ...VALID_REASON,
        confirmationToken: "wrong-id"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((service as never as { adminEraseConfirm: ReturnType<typeof vi.fn> }).adminEraseConfirm).not.toHaveBeenCalled();
  });
  it("denies erasure-confirm for viewer.audit even with valid token", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.erasureConfirm({} as never, VALID_ID, {
        ...VALID_REASON,
        confirmationToken: VALID_ID
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows erasure-confirm with matching token + iam.manage", async () => {
    const { controller, service } = createController({ canRead: true, canWrite: true });
    await controller.erasureConfirm({} as never, VALID_ID, {
      ...VALID_REASON,
      confirmationToken: VALID_ID
    });
    expect((service as never as { adminEraseConfirm: ReturnType<typeof vi.fn> }).adminEraseConfirm).toHaveBeenCalled();
  });
});
