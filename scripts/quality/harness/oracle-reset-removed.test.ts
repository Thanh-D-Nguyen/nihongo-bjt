// The one-time Oracle database reset was used for the first deployment. A
// destructive manual workflow must not stay dispatchable afterwards.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./fixture";

describe("spent Oracle database reset", () => {
  it("is removed from the workflows and recorded in the runbook", () => {
    expect(existsSync(path.join(REPO_ROOT, ".github/workflows/oracle-reset-database.yml")), "reset workflow still present").toBe(false);
    const runbook = readFileSync(path.join(REPO_ROOT, "docs/deployment/oci.md"), "utf8");
    expect(runbook).toContain("was used for the first deployment and has been removed");
  });
});
