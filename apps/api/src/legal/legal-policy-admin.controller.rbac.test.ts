import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LegalPolicyAdminController } from "./legal-policy-admin.controller.js";

function createController(opts: { canRead: boolean; canWrite: boolean }) {
  const requireOneOfPermissions = vi.fn().mockImplementation(async (_req, candidates: string[]) => {
    const writeOnly = ["admin.legal.write", "legal.admin"];
    const wantsWrite = candidates.length === writeOnly.length && candidates.every((c) => writeOnly.includes(c));
    if (wantsWrite && !opts.canWrite) throw new ForbiddenException("forbidden");
    if (!wantsWrite && !opts.canRead) throw new ForbiddenException("forbidden");
    return {
      actorId: "11111111-1111-4111-8111-111111111111",
      permissions: opts.canWrite ? new Set(["admin.legal.write"]) : new Set(["viewer.audit"])
    };
  });
  const auth = { requireOneOfPermissions } as never;
  const svc = {
    listPolicies: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getPolicy: vi.fn().mockResolvedValue({ id: "x", audit: [] }),
    diffPolicies: vi.fn().mockResolvedValue({ a: {}, b: {}, sameKey: true }),
    createPolicy: vi.fn().mockResolvedValue({ id: "x" }),
    updatePolicy: vi.fn().mockResolvedValue({ id: "x" }),
    publishPolicy: vi.fn().mockResolvedValue({ id: "x" }),
    archivePolicy: vi.fn().mockResolvedValue({ id: "x" }),
    duplicatePolicy: vi.fn().mockResolvedValue({ id: "x" }),
    deletePolicy: vi.fn().mockResolvedValue({ id: "x", deleted: true })
  } as never;
  return { auth, controller: new LegalPolicyAdminController(auth, svc), svc };
}

const VALID_ID = "00000000-0000-4000-8000-000000000099";
const OTHER_ID = "00000000-0000-4000-8000-0000000000aa";

describe("LegalPolicyAdminController RBAC + validation", () => {
  it("denies list when caller lacks any read perm", async () => {
    const { controller } = createController({ canRead: false, canWrite: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows list for viewer.audit", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: false });
    await controller.list({} as never, { policyKey: "terms_of_service" });
    expect((svc as never as { listPolicies: ReturnType<typeof vi.fn> }).listPolicies).toHaveBeenCalled();
  });
  it("rejects list with invalid policyKey", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.list({} as never, { policyKey: "not-real" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("allows detail for read-only viewer", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: false });
    await controller.detail({} as never, VALID_ID);
    expect((svc as never as { getPolicy: ReturnType<typeof vi.fn> }).getPolicy).toHaveBeenCalledWith(VALID_ID);
  });
  it("allows diff for read-only viewer", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: false });
    await controller.diff({} as never, VALID_ID, OTHER_ID);
    expect((svc as never as { diffPolicies: ReturnType<typeof vi.fn> }).diffPolicies).toHaveBeenCalled();
  });
  it("denies create for viewer.audit", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: false });
    await expect(controller.create({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect((svc as never as { createPolicy: ReturnType<typeof vi.fn> }).createPolicy).not.toHaveBeenCalled();
  });
  it("allows create for legal.admin", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: true });
    await controller.create({} as never, {
      contentMd: "# new",
      effectiveAt: new Date().toISOString(),
      policyKey: "terms_of_service",
      version: "v2"
    });
    expect((svc as never as { createPolicy: ReturnType<typeof vi.fn> }).createPolicy).toHaveBeenCalled();
  });
  it("denies update for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(controller.update({} as never, VALID_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("denies publish for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(controller.publish({} as never, VALID_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows publish for legal.admin", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: true });
    await controller.publish({} as never, VALID_ID);
    expect((svc as never as { publishPolicy: ReturnType<typeof vi.fn> }).publishPolicy).toHaveBeenCalled();
  });
  it("denies archive for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(controller.archive({} as never, VALID_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("denies duplicate for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(controller.duplicate({} as never, VALID_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("denies delete for viewer.audit", async () => {
    const { controller } = createController({ canRead: true, canWrite: false });
    await expect(controller.remove({} as never, VALID_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows delete for legal.admin", async () => {
    const { controller, svc } = createController({ canRead: true, canWrite: true });
    await controller.remove({} as never, VALID_ID);
    expect((svc as never as { deletePolicy: ReturnType<typeof vi.fn> }).deletePolicy).toHaveBeenCalled();
  });
});
