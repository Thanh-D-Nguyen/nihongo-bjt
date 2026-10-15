import { describe, expect, it } from "vitest";

import { allCanonicalAdminPermissions, CANONICAL_ADMIN_ROLE_PERMISSIONS } from "./admin-rbac.js";

describe("canonical assessment permissions", () => {
  it("exposes question-bank permissions and assigns them to exam editors", () => {
    const editorPermissions = CANONICAL_ADMIN_ROLE_PERMISSIONS["editor.exam"];

    expect(allCanonicalAdminPermissions()).toEqual(
      expect.arrayContaining(["assessment.manage", "assessment.review"])
    );
    expect(editorPermissions).toEqual(
      expect.arrayContaining(["assessment.manage", "assessment.review"])
    );
  });
});
