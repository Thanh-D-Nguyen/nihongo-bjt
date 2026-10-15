import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.describe("Admin audit mobile browser journeys", () => {
  test.describe.configure({ mode: "serial" });
  for (const [title, script] of [
    ["keeps wide i18n and IAM tables inside the page viewport", "audit155-admin-mobile-tables.mjs"],
    ["keeps the event hide action reachable at 390px", "audit156-share-moderation.mjs"]
  ]) {
    test(title, () => {
      test.setTimeout(120_000);
      const result = spawnSync(process.execPath, [`e2e/audit/${script}`], {
        cwd: process.cwd(), encoding: "utf8", timeout: 90_000
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    });
  }
});
