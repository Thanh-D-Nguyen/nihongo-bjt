// Gate derivation: classification + change kind + changed paths -> required
// gates. The agent can add classes; paths force them; it can never remove gates.
import { describe, expect, it } from "vitest";

import { loadPolicy, pathRule, requiredGates, suitesFor, needsTask } from "./lib/policy.mjs";
import { REPO_ROOT } from "./fixture";

const policy = loadPolicy(REPO_ROOT);
const gatesFor = (classes: string[], kind: string, paths: string[] = [], extra: Record<string, unknown> = {}) => {
  const r = requiredGates(policy, { classification: { classes, change_kind: kind }, ...extra }, paths);
  return { gates: [...r.gates.keys()].sort(), errors: r.errors };
};

describe("path rules", () => {
  it.each([
    ["apps/api-go/internal/realtime/hub.go", "realtime"],
    ["apps/api-go/internal/realtime/websocket_test.go", "test"],
    ["apps/api-go/internal/authn/handler.go", "auth"],
    ["apps/api-go/internal/career/store.go", "backend"],
    ["apps/api-go/internal/postgres/migrations/001.sql", "database"],
    ["apps/api-go/internal/postgres/sql_conformance_test.go", "quality_system"],
    ["apps/web/app/page.tsx", "frontend"],
    ["apps/web/app/page.test.tsx", "test"],
    ["packages/database/prisma/schema.prisma", "database"],
    [".github/workflows/ci.yml", "quality_system"],
    ["scripts/quality/verify-go.sh", "quality_system"],
    ["docs/engineering/ENGINEERING_POLICY.md", "quality_system"],
    ["CLAUDE.md", "quality_system"],
    ["docs/spec/index.md", "doc"],
    ["README.md", "doc"],
    ["deploy/gcp/deploy-release.sh", "infrastructure"],
    ["apps/web/Dockerfile.staging", "infrastructure"],
    ["pnpm-lock.yaml", "dependency"],
    ["tasks/HARNESS-001.json", "task_record"],
    ["scripts/sync-bjt-images-to-prod.ts", "other"]
  ])("%s -> %s", (p, kind) => {
    expect(pathRule(policy, p).kind).toBe(kind);
  });

  it("volatile build artifacts rewritten by the gates never need a task", () => {
    expect(needsTask(policy, "apps/web/tsconfig.tsbuildinfo")).toBe(false);
    expect(needsTask(policy, "apps/admin/next-env.d.ts")).toBe(false);
    expect(needsTask(policy, "apps/web/tsconfig.json")).toBe(true);
  });

  it("only pure docs and task records are exempt from needing a task", () => {
    expect(needsTask(policy, "docs/spec/index.md")).toBe(false);
    expect(needsTask(policy, "tasks/X-1.json")).toBe(false);
    expect(needsTask(policy, "CLAUDE.md")).toBe(true);
    expect(needsTask(policy, "apps/web/app/page.tsx")).toBe(true);
  });

  it("suites follow the changed areas", () => {
    expect([...suitesFor(policy, ["apps/api-go/internal/career/store.go"])]).toEqual(["suite_go"]);
    expect([...suitesFor(policy, ["apps/web/app/page.tsx"])]).toEqual(["suite_frontend"]);
    expect([...suitesFor(policy, ["scripts/quality/check-go-test-report.mjs"])].sort()).toEqual(["suite_go", "suite_harness"]);
    expect([...suitesFor(policy, ["docs/spec/index.md"])]).toEqual([]);
  });
});

describe("gate matrix", () => {
  it("DOC_ONLY needs acceptance only (no fake RED)", () => {
    expect(gatesFor(["DOC_ONLY"], "non_behavioral", ["docs/a.md"])).toEqual({ gates: ["acceptance"], errors: [] });
  });

  it("DOMAIN_LOGIC modify needs RED + GREEN + the Go suite", () => {
    expect(gatesFor(["DOMAIN_LOGIC"], "modify", ["apps/api-go/internal/career/store.go"]).gates).toEqual(["acceptance", "green", "red", "suite_go"]);
  });

  it("bugfix needs the regression RED and observed/expected behavior", () => {
    expect(gatesFor(["DOMAIN_LOGIC"], "bugfix").gates).toEqual(["acceptance", "green", "red"]);
    expect(policy.raw.change_kinds.bugfix.requires_spec).toEqual(["observed_behavior", "expected_behavior"]);
  });

  it("high-risk classes add independent review", () => {
    for (const c of ["AUTH_SECURITY", "DATABASE", "REALTIME", "INFRASTRUCTURE", "CI_QUALITY_SYSTEM", "CROSS_CUTTING"]) {
      expect(gatesFor([c], "modify").gates).toContain("review");
    }
    expect(gatesFor(["AUTH_SECURITY"], "modify").gates).toContain("browser_e2e");
    expect(gatesFor(["DATABASE"], "modify").gates).toContain("rollback_analysis");
    expect(gatesFor(["CI_QUALITY_SYSTEM"], "modify").gates).toContain("suite_harness");
  });

  it("characterization requires sensitivity + green, never RED", () => {
    const g = gatesFor(["DOMAIN_LOGIC"], "characterization").gates;
    expect(g).toContain("sensitivity");
    expect(g).not.toContain("red");
  });

  it("deletion requires FUNCTION_DELETION, RED and the deletion audit", () => {
    expect(gatesFor(["FUNCTION_DELETION"], "delete").gates).toEqual(["acceptance", "deletion_audit", "green", "red"]);
    expect(gatesFor(["DOMAIN_LOGIC"], "delete").errors).toContain("change_kind delete requires class FUNCTION_DELETION");
  });

  it("a red exception replaces RED with its replacement gates and forces review", () => {
    const g = gatesFor(["DOMAIN_LOGIC"], "add", [], { red_exception: { category: "new_component", reason: "new module" } }).gates;
    expect(g).toEqual(["acceptance", "green", "review", "sensitivity"]);
    expect(gatesFor(["DOMAIN_LOGIC"], "add", [], { red_exception: { category: "config_only", reason: "x" } }).errors[0]).toContain("not allowed for DOMAIN_LOGIC");
    expect(gatesFor(["DOMAIN_LOGIC"], "add", [], { red_exception: { category: "new_component", reason: "" } }).errors).toContain("red_exception.reason is required");
  });

  it("refactor of behavior code needs independent review", () => {
    expect(gatesFor(["DOMAIN_LOGIC"], "refactor").gates).toContain("review");
  });

  it("paths force classes; non_behavioral cannot carry behavior classes", () => {
    expect(gatesFor(["DOMAIN_LOGIC"], "modify", ["apps/api-go/internal/realtime/hub.go"]).errors[0]).toContain("requires one of [REALTIME]");
    expect(gatesFor(["TEST_ONLY"], "non_behavioral", ["apps/api-go/internal/career/store.go"]).errors[0]).toContain("misclassified");
    expect(gatesFor(["DOMAIN_LOGIC"], "non_behavioral").errors[0]).toContain("cannot be used with DOMAIN_LOGIC");
    expect(gatesFor(["DOC_ONLY"], "add").errors[0]).toContain("requires a behavior class");
    expect(gatesFor(["DOC_ONLY"], "non_behavioral", [".github/workflows/ci.yml"]).errors[0]).toContain("requires one of [CI_QUALITY_SYSTEM]");
  });

  it("high-risk diff findings force review", () => {
    const r = requiredGates(policy, { classification: { classes: ["TEST_ONLY"], change_kind: "non_behavioral" } }, [], [{ id: "x", severity: "high" }]);
    expect([...r.gates.keys()]).toContain("review");
  });

  it("every class, kind and exception is covered by the policy and maps to known gates", () => {
    for (const c of Object.keys(policy.raw.classes)) expect(gatesFor([c], policy.raw.classes[c].behavior ? "modify" : "non_behavioral").gates).toContain("acceptance");
    expect(Object.keys(policy.raw.classes).sort()).toEqual(
      ["API_CONTRACT", "AUTH_SECURITY", "CACHE", "CI_QUALITY_SYSTEM", "CROSS_CUTTING", "DATABASE", "DEPENDENCY_METADATA", "DOC_ONLY", "DOMAIN_LOGIC", "FORMAT_ONLY", "FUNCTION_DELETION", "GENERATED", "INFRASTRUCTURE", "REALTIME", "SEARCH", "TEST_ONLY", "UI_ONLY"].sort()
    );
  });
});
