import { afterEach, describe, expect, it } from "vitest";
import { makeFixture, type Fixture } from "./quality/harness/fixture";
import { loadPolicy } from "./quality/harness/lib/policy.mjs";
import { validateBlockerProtocol } from "./quality/harness/lib/task.mjs";
import { decideToolCall } from "./quality/harness/lib/guard.mjs";

let fx: Fixture | undefined;
afterEach(() => { fx?.cleanup(); fx = undefined; });

describe("autonomy regression", () => {
  it("rejects stopped Docker as an immediate human blocker", () => {
    fx = makeFixture();
    const problems = validateBlockerProtocol(loadPolicy(fx.dir), "suite_go", {
      reproduced: true, error: "Docker is stopped", workaround_attempted: "one failed command",
      why_not_viable: "ask the user to start Docker",
      alternatives: [
        { id: "with-test-db-docker", attempted: true, result: "Docker is stopped" },
        { id: "existing-test-database-url", attempted: false, result: "not configured" }
      ],
      remaining: { kind: "local_service_stopped", capability: "docker" }
    });
    expect(problems.join("; ")).toContain("recoverable local");
  });

  it("asks before deleting unverified persistent Docker data", () => {
    fx = makeFixture();
    const result = decideToolCall(fx.dir, loadPolicy(fx.dir), "Bash", { command: "docker compose down -v" });
    expect(result.decision).toBe("ask");
  });
});
