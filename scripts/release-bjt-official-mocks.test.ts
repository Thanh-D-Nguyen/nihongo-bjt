import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const releaseScriptPath = fileURLToPath(
  new URL("../deploy/gcp/deploy-release.sh", import.meta.url)
);

describe("production BJT official-mock release contract", () => {
  it("persists canonical official forms after migrations and before the production build", () => {
    const script = readFileSync(releaseScriptPath, "utf8");
    const migrationIndex = script.indexOf("prisma migrate deploy");
    const officialMockSeedIndex = script.indexOf("pnpm seed:bjt:official-mocks");
    const buildIndex = script.indexOf("pnpm build");

    expect(migrationIndex).toBeGreaterThan(-1);
    expect(officialMockSeedIndex).toBeGreaterThan(migrationIndex);
    expect(buildIndex).toBeGreaterThan(officialMockSeedIndex);
  });
});
