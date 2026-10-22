import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root: string;
let bin: string;
let log: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "local-start-test-"));
  bin = path.join(root, "bin");
  log = path.join(root, "commands");
  mkdirSync(bin);
  mkdirSync(path.join(root, "scripts"));
  copyFileSync("scripts/local-start.sh", path.join(root, "scripts/local-start.sh"));
  writeFileSync(log, "");
  for (const tool of ["node", "pnpm", "go", "docker", "caddy"]) {
    writeFileSync(
      path.join(bin, tool),
      `#!/bin/sh
printf '%s %s\\n' "\${0##*/}" "$*" >> "$LOCAL_START_TEST_LOG"
case "\${0##*/}:$1" in
  docker:context) echo "\${FAKE_CONTEXT_ENDPOINT:-unix:///local/docker.sock}" ;;
  docker:info) exit "\${FAKE_DOCKER_STATUS:-0}" ;;
  pnpm:install) exit "\${FAKE_INSTALL_STATUS:-0}" ;;
  node:*) exit "\${FAKE_NODE_STATUS:-0}" ;;
esac
`,
      { mode: 0o755 }
    );
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function run(overrides: Record<string, string> = {}) {
  return spawnSync("/bin/bash", [path.join(root, "scripts/local-start.sh")], {
    cwd: tmpdir(),
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      DOCKER_HOST: "",
      DOCKER_CONTEXT: "",
      LOCAL_START_TEST_LOG: log,
      ...overrides
    }
  });
}

describe("local startup wrapper", () => {
  it("installs frozen dependencies then hands off to the prepared runner from any directory", () => {
    const result = run({ FAKE_NODE_STATUS: "7" });
    expect(result.status).toBe(7);
    expect(readFileSync(log, "utf8")).toContain(
      "pnpm install --frozen-lockfile\nnode scripts/local-audit-up.mjs --prepare\n"
    );
  });

  it("stops on install failure without starting the runner", () => {
    expect(run({ FAKE_INSTALL_STATUS: "9" }).status).toBe(9);
    expect(readFileSync(log, "utf8")).not.toContain("node scripts/");
  });

  it("refuses remote Docker before installation or daemon startup", () => {
    const result = run({ DOCKER_HOST: "ssh://remote.example" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("remote Docker endpoints are refused");
    expect(readFileSync(log, "utf8")).not.toContain("docker info");
    expect(readFileSync(log, "utf8")).not.toContain("pnpm install");
  });

  it("identifies a missing prerequisite before Docker or dependency operations", () => {
    rmSync(path.join(bin, "caddy"));
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing caddy");
    expect(readFileSync(log, "utf8")).toBe("");
  });

  it("checks the effective Docker context when it overrides a local DOCKER_HOST", () => {
    const result = run({
      DOCKER_HOST: "unix:///local/docker.sock",
      DOCKER_CONTEXT: "remote-context",
      FAKE_CONTEXT_ENDPOINT: "ssh://remote.example"
    });
    expect(result.status, "a remote Docker context must be refused").toBe(1);
    expect(result.stderr).toContain("remote Docker endpoints are refused");
    expect(readFileSync(log, "utf8")).not.toContain("pnpm install");
  });
});
