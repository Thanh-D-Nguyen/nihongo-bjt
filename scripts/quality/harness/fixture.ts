// Disposable git repository that mirrors the real repo's layout, policy and
// quality-system files, with a tiny Go module. Lifecycle e2e and adversarial
// tests drive the real harness CLI against it; the real working tree is never
// touched.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI = path.join(REPO_ROOT, "scripts/quality/harness/cli.mjs");

export interface RunResult {
  code: number;
  out: string;
}

export interface Fixture {
  dir: string;
  base: string;
  run: (...args: string[]) => RunResult;
  runWith: (extraEnv: Record<string, string>, ...args: string[]) => RunResult;
  git: (...args: string[]) => string;
  write: (rel: string, content: string) => void;
  read: (rel: string) => string;
  remove: (rel: string) => void;
  commit: (message: string) => string;
  /** Parsed task record (untyped JSON, as the CI check sees it). */
  task: (id: string) => ReturnType<typeof JSON.parse>;
  saveTask: (id: string, task: unknown) => void;
  cleanup: () => void;
}

export const CALC_GO = `package calc

// Add returns a+b.
func Add(a, b int) int { return a + b }

// Discount applies the order discount.
func Discount(total int) int { return total }

var registry = map[string]int{"current": 1, "legacy": 2}

// LegacyHandler serves the old endpoint.
func LegacyHandler() int { return registry["legacy"] }

// Lookup reports whether a route is registered.
func Lookup(name string) (int, bool) { v, ok := registry[name]; return v, ok }
`;

export const CALC_TEST_GO = `package calc

import "testing"

func TestAdd(t *testing.T) {
	if got := Add(2, 3); got != 5 {
		t.Fatalf("add: got %d want 5", got)
	}
}
`;

// Fixture suite_go: the REAL check-go-test-report.mjs audits real `go test -json` output.
const FIXTURE_SUITE_GO = `import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "fx-go-"));
const report = path.join(dir, "report.json");
const r = spawnSync("go", ["test", "-json", "-count=1", "./..."], { cwd: "apps/api-go", encoding: "utf8" });
writeFileSync(report, r.stdout);
const c = spawnSync("node", [process.env.FX_GO_CHECKER, report, String(r.status), "--baseline", "scripts/quality/go-test-skips-baseline.json"], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
process.exit(c.status ?? 2);
`;

// Fixture suite_harness: stands in for the adversarial suite (writes accounting).
const FIXTURE_SUITE_HARNESS = `import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const result = process.env.FX_HARNESS_RESULT ?? "PASS";
const dir = process.env.QUALITY_SUMMARY_DIR;
if (dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "harness.json"), JSON.stringify({ schema: "quality-suite-summary/1", suite: "harness", result, accounting: { discovered: 3, executed: 3, passed: result === "PASS" ? 3 : 2, failed: result === "PASS" ? 0 : 1, skipped: 0, expected_skips: 0, unexpected_skips: 0 } }));
}
process.exit(result === "PASS" ? 0 : 1);
`;

const COPY_FROM_REPO = [".github/workflows/ci.yml", ".github/workflows/deploy-gcp.yml", ".claude/settings.json"];

function sh(cwd: string, cmd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
}

export function makeFixture(): Fixture {
  const dir = mkdtempSync(path.join(os.tmpdir(), "quality-fixture-"));
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  };
  const git = (...args: string[]) => {
    const r = sh(dir, "git", args);
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };

  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.com");
  git("config", "user.name", "fixture");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");

  const policy = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/engineering/engineering-policy.json"), "utf8"));
  policy.gates.suite_go.command = ["node", "scripts/fixture-suite-go.mjs"];
  policy.gates.suite_go.needs_db = false;
  policy.gates.suite_harness.command = ["node", "scripts/fixture-suite-harness.mjs"];
  write("docs/engineering/engineering-policy.json", `${JSON.stringify(policy, null, 2)}\n`);

  for (const rel of COPY_FROM_REPO) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, rel), path.join(dir, rel));
  }
  for (const f of readdirSync(path.join(REPO_ROOT, "scripts/quality")).filter((x) => x.endsWith(".sh"))) {
    mkdirSync(path.join(dir, "scripts/quality"), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, "scripts/quality", f), path.join(dir, "scripts/quality", f));
  }
  write("scripts/quality/go-test-skips-baseline.json", `${JSON.stringify({ note: "fixture", min_passed_tests: 1, allowed_skips: {} }, null, 2)}\n`);
  write("scripts/fixture-suite-go.mjs", FIXTURE_SUITE_GO);
  write("scripts/fixture-suite-harness.mjs", FIXTURE_SUITE_HARNESS);
  write("apps/api-go/go.mod", "module github.com/kotobawork/nihongo-bjt/api-go\n\ngo 1.21\n");
  write("apps/api-go/internal/calc/calc.go", CALC_GO);
  write("apps/api-go/internal/calc/calc_test.go", CALC_TEST_GO);
  write("docs/README.md", "# Fixture\n\nThe LegacyHandler endpoint is documented here.\n");
  write(".gitignore", "tasks/.active\ntasks/.logs/\ntasks/.review/\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");

  const env = { FX_GO_CHECKER: path.join(REPO_ROOT, "scripts/quality/check-go-test-report.mjs"), GITHUB_ACTIONS: "", GITHUB_STEP_SUMMARY: "", TEST_DATABASE_URL: "" };
  return {
    dir,
    base,
    run: (...args: string[]) => {
      const r = sh(dir, "node", [CLI, ...args], env);
      return { code: r.status ?? -1, out: `${r.stdout}\n${r.stderr}` };
    },
    runWith: (extraEnv: Record<string, string>, ...args: string[]) => {
      const r = sh(dir, "node", [CLI, ...args], { ...env, ...extraEnv });
      return { code: r.status ?? -1, out: `${r.stdout}\n${r.stderr}` };
    },
    git,
    write,
    read: (rel: string) => readFileSync(path.join(dir, rel), "utf8"),
    remove: (rel: string) => rmSync(path.join(dir, rel), { force: true }),
    commit: (message: string) => {
      git("add", "-A");
      git("commit", "-q", "-m", message);
      return git("rev-parse", "HEAD");
    },
    task: (id: string) => JSON.parse(readFileSync(path.join(dir, "tasks", `${id}.json`), "utf8")),
    saveTask: (id: string, task: unknown) => writeFileSync(path.join(dir, "tasks", `${id}.json`), `${JSON.stringify(task, null, 2)}\n`),
    cleanup: () => {
      sh(dir, "git", ["worktree", "prune"]);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** Insert `code` before the final line of a Go test file (keeps the fixture readable). */
export function addGoTest(source: string, code: string): string {
  return `${source.trimEnd()}\n\n${code.trim()}\n`;
}

/** Strings assembled at runtime so this file never contains the patterns the diff scanner forbids. */
export const PATTERNS = {
  only: ["it", "only("].join("."),
  skip: ["it", "skip("].join("."),
  goSkip: ["t", "Skip("].join("."),
  orTrue: ["|", "| true"].join(""),
  continueOnError: ["continue", "on", "error: true"].join("-")
};
