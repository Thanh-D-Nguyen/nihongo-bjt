import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LegalCookieCategoryAdminController } from "./legal-cookie-category-admin.controller.js";
import { LegalRetentionAdminController } from "./legal-retention-admin.controller.js";

function makeAuth(canRead: boolean) {
  return {
    requireOneOfPermissions: vi.fn().mockImplementation(async () => {
      if (!canRead) throw new ForbiddenException("forbidden");
      return { actorId: "11111111-1111-4111-8111-111111111111", permissions: new Set(["viewer.audit"]) };
    })
  } as never;
}

describe("LegalRetentionAdminController", () => {
  it("denies list when caller lacks read perms", async () => {
    const c = new LegalRetentionAdminController(makeAuth(false));
    await expect(c.list({} as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("returns curated retention domains for viewer.audit", async () => {
    const c = new LegalRetentionAdminController(makeAuth(true));
    const out = await c.list({} as never);
    expect(out.partialSchemaPending).toBe(true);
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.items.every((i) => typeof i.domain === "string")).toBe(true);
  });
});

describe("LegalCookieCategoryAdminController", () => {
  it("denies list when caller lacks read perms", async () => {
    const c = new LegalCookieCategoryAdminController(makeAuth(false));
    await expect(c.list({} as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("returns curated cookie categories for viewer.audit", async () => {
    const c = new LegalCookieCategoryAdminController(makeAuth(true));
    const out = await c.list({} as never);
    expect(out.partialSchemaPending).toBe(true);
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.items.every((i) => typeof i.key === "string")).toBe(true);
  });
});
