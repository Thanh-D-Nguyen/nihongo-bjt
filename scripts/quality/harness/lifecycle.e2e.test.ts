// End-to-end lifecycle cases A–I (docs/engineering/ENGINEERING_POLICY.md §16),
// driving the real harness CLI and real `go test` in a disposable repository.
import { afterEach, describe, expect, it } from "vitest";

import { CALC_GO, CALC_TEST_GO, addGoTest, makeFixture, type Fixture } from "./fixture";

const CALC = "apps/api-go/internal/calc/calc.go";
const CALC_TEST = "apps/api-go/internal/calc/calc_test.go";

const DISCOUNT_TEST = `func TestDiscount(t *testing.T) {
	if got := Discount(200); got != 180 {
		t.Fatalf("discount: got %d want 180", got)
	}
}`;
const DISCOUNT_IMPL = "func Discount(total int) int { if total >= 100 { return total * 9 / 10 }; return total }";

let fx: Fixture;
afterEach(() => fx?.cleanup());

function startTask(id: string, classes: string, kind: string, extra: string[] = []) {
  expect(fx.run("begin", id, `fixture task ${id}`).code).toBe(0);
  expect(fx.run("spec", "--acceptance", "the declared behavior holds").code).toBe(0);
  const r = fx.run("classify", classes, "--kind", kind, ...extra);
  expect(r.code, r.out).toBe(0);
}

describe("Case A — valid behavior change: SPEC → CLASSIFY → VALID_RED → GREEN → VERIFY → CLOSE", () => {
  it("passes locally, in the CI lifecycle check and in the RED/GREEN replay", () => {
    fx = makeFixture();
    startTask("FX-1", "DOMAIN_LOGIC", "modify");

    // The write guard refuses production edits before VALID_RED.
    const before = fx.run("guard", CALC);
    expect(before.code).toBe(1);
    expect(before.out).toContain("VALID_RED required");
    expect(fx.run("guard", CALC_TEST).code).toBe(0);

    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
    const red = fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", "discount: got 200 want 180");
    expect(red.code, red.out).toBe(0);
    expect(red.out).toContain("VALID_RED recorded (in_place)");
    expect(fx.run("guard", CALC).code).toBe(0);

    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    expect(fx.run("green").code).toBe(0);
    const verify = fx.run("verify");
    expect(verify.code, verify.out).toBe(0);
    expect(verify.out).toMatch(/suite_go: PASS/u);
    const close = fx.run("close");
    expect(close.code, close.out).toBe(0);
    expect(close.out).toContain("CLOSED as VERIFIED");

    const task = fx.task("FX-1");
    expect(task.state).toBe("CLOSED");
    expect(task.closed.status).toBe("VERIFIED");
    expect(task.evidence.find((e: any) => e.kind === "suite").accounting).toMatchObject({ executed: 2, passed: 2, unexpected_skips: 0 });
    expect(task.history.map((h: any) => h.state)).toEqual(expect.arrayContaining(["CREATED", "SPECIFIED", "RED_REQUIRED", "VALID_RED", "VERIFYING", "READY_TO_CLOSE", "CLOSED"]));

    const head = fx.commit("discount");
    const check = fx.run("check", "--base", fx.base, "--head", head);
    expect(check.code, check.out).toBe(0);
    const replay = fx.run("replay", "--base", fx.base, "--head", head);
    expect(replay.code, replay.out).toBe(0);
    expect(replay.out).toMatch(/FX-1 red: 1 target\(s\) fail against base production code/u);
    expect(replay.out).toMatch(/FX-1 green: 1 target\(s\) pass/u);
  });
});

describe("Case B — production change without RED", () => {
  it("cannot close, and a hand-closed record is rejected by the CI check", () => {
    fx = makeFixture();
    startTask("FX-2", "DOMAIN_LOGIC", "modify");
    // A shell write bypasses the editor hook; the lifecycle still catches it.
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
    expect(fx.run("verify").code).toBe(0);
    const close = fx.run("close");
    expect(close.code).toBe(1);
    expect(close.out).toMatch(/red\s+MISSING/u);

    // Forge a CLOSED record without RED evidence: CI recomputes the gates.
    const t = fx.task("FX-2");
    t.state = "CLOSED";
    fx.saveTask("FX-2", t);
    fx.commit("forged");
    const check = fx.run("check", "--base", fx.base, "--head", "HEAD");
    expect(check.code).toBe(1);
    expect(check.out).toContain("task is not CLOSED");
  });
});

describe("Case C — infrastructure failure pretending to be RED", () => {
  it.each([
    ["infra signature", `func TestDiscount(t *testing.T) { t.Fatalf("dial tcp 127.0.0.1:5432: connect: connection refused") }`, "connection refused", "infrastructure/tooling signature"],
    ["compile error", `func TestDiscount(t *testing.T) { if NotYetWritten() != 1 { t.Fatal("x") } }`, "x", "compile/import failure is not a valid RED"],
    ["skipped test", `func TestDiscount(t *testing.T) { t.Skip("TEST_DATABASE_URL not set") }`, "anything", "a skip is neither RED nor GREEN"],
    ["wrong failure reason", `func TestDiscount(t *testing.T) { t.Fatalf("unrelated assertion") }`, "discount: got 200 want 180", "does not contain the expected text"],
    ["runtime crash", `func TestDiscount(t *testing.T) { var m map[string]int; m["x"] = 1 }`, "assignment to entry in nil map", "runtime crash"],
    ["behavior already exists", `func TestDiscount(t *testing.T) { if Add(1, 1) != 2 { t.Fatal("add") } }`, "add", "test passes before the change"]
  ])("rejects %s and keeps the task in RED_REQUIRED", (_name, test, expectText, reason) => {
    fx = makeFixture();
    startTask("FX-3", "DOMAIN_LOGIC", "modify");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, test));
    const red = fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", expectText);
    expect(red.code).toBe(1);
    expect(red.out).toContain("INVALID_RED");
    expect(red.out).toContain(reason);
    const task = fx.task("FX-3");
    expect(task.state).toBe("RED_REQUIRED");
    expect(task.evidence.at(-1)).toMatchObject({ kind: "red", outcome: "INVALID_RED" });
    expect(fx.run("guard", CALC).code).toBe(1);
  });
});

describe("Case D — unexpected skipped test", () => {
  it("fails the suite gate (real check-go-test-report.mjs) and needs acknowledgement", () => {
    fx = makeFixture();
    startTask("FX-4", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, CALC_TEST_GO.replace('if got := Add(2, 3)', 't.Skip("flaky")\n\tif got := Add(2, 3)'));
    const verify = fx.run("verify");
    expect(verify.code).toBe(1);
    expect(verify.out).toMatch(/skipped that are not in go-test-skips-baseline\.json/u);
    const status = fx.run("status");
    expect(status.out).toMatch(/suite_go\s+FAIL/u);
    expect(status.out).toContain("unacknowledged high-risk change test_skip_added:apps/api-go/internal/calc/calc_test.go");
    expect(fx.run("close").code).toBe(1);
  });
});

describe("Case E — known debt replaced with new debt", () => {
  it("is covered by the identity ratchet tests (frontend-debt-lib.test.ts) required in the self-test", async () => {
    const { compareDebt } = await import("../frontend-debt-lib.mjs");
    const baseline = { eslint: { min_linted_files: 1, violations: { "a.ts": { "error:r1": 1 } } }, vitest: { min_test_files: 1, min_tests: 2, known_failures: ["t > old"], known_skipped: [] } };
    const current = { lint: { lintedFiles: 1, violations: { "b.ts": { "error:r1": 1 } } }, tests: { testFiles: 1, tests: 2, failures: ["t > new"], skipped: [] } };
    const verdict = compareDebt(baseline, current);
    expect(verdict.newDebt.map((d: any) => d.id)).toEqual(["b.ts [error:r1]", "t > new"]);
  });
});

describe("Case F — documentation-only change", () => {
  it("needs no task at all, and a DOC_ONLY task closes without RED", () => {
    fx = makeFixture();
    fx.write("docs/README.md", "# Fixture\n\nUpdated docs. The LegacyHandler endpoint is documented here.\n");
    const head = fx.commit("docs");
    expect(fx.run("check", "--base", fx.base, "--head", head).code).toBe(0);

    startTask("FX-6", "DOC_ONLY", "non_behavioral");
    fx.write("docs/guide.md", "# Guide\n");
    const close = fx.run("close");
    expect(close.code, close.out).toBe(0);
    const task = fx.task("FX-6");
    expect(Object.keys(task.closed.gates)).toEqual(["acceptance"]);
    expect(task.evidence.some((e: any) => e.kind === "red")).toBe(false);
  });
});

describe("Case G — characterization test for existing behavior", () => {
  it("is labeled characterization, proves sensitivity, and records no RED", () => {
    fx = makeFixture();
    startTask("FX-7", "DOMAIN_LOGIC", "characterization");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestAddNegative(t *testing.T) { if got := Add(-2, -3); got != -5 { t.Fatalf("add negative: got %d", got) } }`));
    const red = fx.run("red", "--go", "./internal/calc:TestAddNegative", "--expect", "x");
    expect(red.code).toBe(1);
    expect(red.out).toContain("RED is not part of this task's lifecycle");
    const s = fx.run("sensitivity", "--file", CALC, "--find", "return a + b", "--replace", "return a - b", "--go", "./internal/calc:TestAddNegative", "--expect", "add negative: got");
    expect(s.code, s.out).toBe(0);
    expect(fx.read(CALC)).toBe(CALC_GO); // mutation happened in a scratch worktree only
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    const close = fx.run("close");
    expect(close.code, close.out).toBe(0);
    const task = fx.task("FX-7");
    expect(task.classification.change_kind).toBe("characterization");
    expect(task.evidence.some((e: any) => e.kind === "red")).toBe(false);
    expect(task.evidence.find((e: any) => e.kind === "sensitivity").outcome).toBe("SENSITIVE");

    const head = fx.commit("characterize Add");
    const replay = fx.run("replay", "--base", fx.base, "--head", head);
    expect(replay.code, replay.out).toBe(0);
    expect(replay.out).toContain("FX-7 sensitivity: 1 target(s) fail under the mutation");
  });

  it("rejects an insensitive characterization test", () => {
    fx = makeFixture();
    startTask("FX-8", "DOMAIN_LOGIC", "characterization");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestAddVacuous(t *testing.T) { _ = Add(1, 2) }`));
    const s = fx.run("sensitivity", "--file", CALC, "--find", "return a + b", "--replace", "return a - b", "--go", "./internal/calc:TestAddVacuous", "--expect", "add");
    expect(s.code).toBe(1);
    expect(s.out).toContain("INSENSITIVE");
  });
});

describe("Case H — function deletion", () => {
  it("requires a removal RED, a consumer audit and a clean stale-reference scan", () => {
    fx = makeFixture();
    startTask("FX-9", "FUNCTION_DELETION", "delete");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestLegacyRemoved(t *testing.T) { if _, ok := Lookup("legacy"); ok { t.Fatalf("legacy route still registered") } }`));
    expect(fx.run("red", "--go", "./internal/calc:TestLegacyRemoved", "--expect", "legacy route still registered").code).toBe(0);
    fx.write(
      CALC,
      CALC_GO.replace(`, "legacy": 2`, "").replace("// LegacyHandler serves the old endpoint.\nfunc LegacyHandler() int { return registry[\"legacy\"] }\n\n", "")
    );
    const scan = fx.run("deletion", "--symbol", "LegacyHandler", "--audit", "callers: none in apps; docs mention removed");
    expect(scan.code).toBe(1);
    expect(scan.out).toContain("stale reference: docs/README.md");
    fx.write("docs/README.md", "# Fixture\n");
    expect(fx.run("deletion").code).toBe(0);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    const close = fx.run("close");
    expect(close.code, close.out).toBe(0);
    expect(fx.task("FX-9").closed.gates).toMatchObject({ red: "PASS", green: "PASS", deletion_audit: "PASS", suite_go: "PASS" });
  });

  it("rejects FUNCTION_DELETION under a non-delete kind", () => {
    fx = makeFixture();
    expect(fx.run("begin", "FX-10", "x").code).toBe(0);
    expect(fx.run("spec", "--acceptance", "a").code).toBe(0);
    const r = fx.run("classify", "FUNCTION_DELETION", "--kind", "modify");
    expect(r.code).toBe(1);
    expect(r.out).toContain("FUNCTION_DELETION requires change_kind delete");
  });
});

describe("Case I — quality-system modification", () => {
  it("requires the harness/adversarial suite and an independent review", () => {
    fx = makeFixture();
    startTask("FX-11", "CI_QUALITY_SYSTEM", "add", ["--red-exception", "config_only", "--reason", "workflow-only check"]);
    fx.write("scripts/quality/new-check.sh", "#!/usr/bin/env bash\nset -euo pipefail\necho ok\n");
    const close = fx.run("close");
    expect(close.code).toBe(1);
    expect(close.out).toMatch(/suite_harness\s+MISSING/u);
    expect(close.out).toMatch(/review\s+MISSING/u);

    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("review", "record", "--reviewer", "a human reviewer", "--mode", "human", "--verdict", "APPROVE").code).toBe(0);
    const ok = fx.run("close");
    expect(ok.code, ok.out).toBe(0);
    expect(fx.task("FX-11").closed.gates).toMatchObject({ suite_harness: "PASS", review: "PASS" });
  });

  it("a failing adversarial suite blocks closure", () => {
    fx = makeFixture();
    startTask("FX-12", "CI_QUALITY_SYSTEM", "add", ["--red-exception", "config_only", "--reason", "x"]);
    fx.write("scripts/quality/new-check.sh", "#!/usr/bin/env bash\nset -euo pipefail\necho ok\n");
    const r = fx.runWith({ FX_HARNESS_RESULT: "VIOLATION" }, "verify");
    expect(r.code).toBe(1);
    expect(fx.task("FX-12").evidence.find((e: any) => e.gate === "suite_harness").result).toBe("VIOLATION");
    expect(fx.run("review", "record", "--reviewer", "r", "--mode", "human", "--verdict", "APPROVE").code).toBe(0);
    const close = fx.run("close");
    expect(close.code).toBe(1);
    expect(close.out).toMatch(/suite_harness\s+FAIL/u);
  });
});

describe("multi-task range", () => {
  it("sequential tasks touching the same file pass when the later task verified the merged content", () => {
    fx = makeFixture();
    startTask("FX-20", "DOMAIN_LOGIC", "modify");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
    expect(fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", "discount: got 200 want 180").code).toBe(0);
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("FX-20");

    startTask("FX-21", "DOMAIN_LOGIC", "modify");
    const withSmall = addGoTest(fx.read(CALC_TEST), `func TestDiscountSmall(t *testing.T) { if got := Discount(50); got != 45 { t.Fatalf("small discount: got %d want 45", got) } }`);
    fx.write(CALC_TEST, withSmall);
    expect(fx.run("red", "--go", "./internal/calc:TestDiscountSmall", "--expect", "small discount: got 50 want 45").code).toBe(0);
    fx.write(CALC, fx.read(CALC).replace(DISCOUNT_IMPL, "func Discount(total int) int { return total * 9 / 10 }"));
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code, "FX-21 close").toBe(0);
    const head = fx.commit("FX-21");

    const check = fx.run("check", "--base", fx.base, "--head", head);
    expect(check.code, check.out).toBe(0);
    const replay = fx.run("replay", "--base", fx.base, "--head", head);
    expect(replay.code, replay.out).toBe(0);
  });
});

describe("volatile build artifacts", () => {
  it("files rewritten by the gate tools are not owned and do not change the fingerprint", () => {
    fx = makeFixture();
    fx.write("apps/web/tsconfig.tsbuildinfo", "{}\n");
    fx.commit("tracked build artifact");
    startTask("FX-30", "DOC_ONLY", "non_behavioral");
    fx.write("docs/guide.md", "# Guide\n");
    const before = fx.run("status").out.match(/fingerprint: (\w+)/u)?.[1];
    fx.write("apps/web/tsconfig.tsbuildinfo", '{"version":"rewritten by tsc"}\n');
    const status = fx.run("status").out;
    expect(status.match(/fingerprint: (\w+)/u)?.[1]).toBe(before);
    expect(status).toContain("owned files: 1");
  });
});

describe("scope control", () => {
  it("pre-existing changes stay unowned even when they change again, until claimed; committing them unclaimed is UNOWNED", () => {
    fx = makeFixture();
    fx.write("scripts/local-notes.mjs", "export const a = 1;\n");
    startTask("FX-40", "DOC_ONLY", "non_behavioral");
    fx.write("docs/guide.md", "# Guide\n");
    fx.write("scripts/local-notes.mjs", "export const a = 2;\n");
    const status = fx.run("status").out;
    expect(status).toContain("owned files: 1");
    expect(status).toContain("modified since begin, NOT owned");
    expect(fx.run("close").code).toBe(0);
    fx.commit("docs + someone else's file");
    const check = fx.run("check", "--base", fx.base, "--head", "HEAD");
    expect(check.code).toBe(1);
    expect(check.out).toContain("UNOWNED: 1 changed file(s) are not covered by any closed task in this range: scripts/local-notes.mjs");
  });

  it("claim makes a pre-existing change part of the task", () => {
    fx = makeFixture();
    fx.write("scripts/local-notes.mjs", "export const a = 1;\n");
    startTask("FX-41", "DOC_ONLY", "non_behavioral");
    expect(fx.run("claim", "scripts/local-notes.mjs").code).toBe(0);
    expect(fx.run("status").out).toContain("owned files: 1");
    expect(fx.run("claim", "docs/README.md").code).toBe(1);
  });
});
