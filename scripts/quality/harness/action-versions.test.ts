// CI-405: GitHub deprecated the Node 20 runtime for JavaScript actions.
// All workflows must pin majors that run natively on Node 24, and the bump
// must not add or drop any action usage.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./fixture";

const WORKFLOWS_DIR = path.join(REPO_ROOT, ".github/workflows");

function workflowTexts(): { file: string; text: string }[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => ({ file: name, text: readFileSync(path.join(WORKFLOWS_DIR, name), "utf8") }));
}

function countAll(texts: { text: string }[], needle: string): number {
  return texts.reduce((sum, { text }) => sum + text.split(needle).length - 1, 0);
}

describe("GitHub Action versions", () => {
  it("pins Node 24 majors for checkout, setup-node and setup-go in every workflow", () => {
    const texts = workflowTexts();
    for (const { file, text } of texts) {
      for (const match of text.matchAll(/uses:\s*(actions\/(?:checkout|setup-node|setup-go))@v(\d+)/g)) {
        const [, action, major] = match;
        const expected = action === "actions/setup-go" ? "6" : "5";
        expect(
          major,
          `${file} must use ${action}@v${expected} (Node 24) instead of @v${major}`
        ).toBe(expected);
      }
    }
    expect(countAll(texts, "actions/checkout@v5"), "checkout usage count must stay 5").toBe(5);
    expect(countAll(texts, "actions/setup-node@v5"), "setup-node usage count must stay 3").toBe(3);
    expect(countAll(texts, "actions/setup-go@v6"), "setup-go usage count must stay 2").toBe(2);
  });
});
