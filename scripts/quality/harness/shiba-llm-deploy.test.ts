// SHIBA-402: the Oracle deploy must carry the Shiba LLM settings from the
// GitHub "oracle-production" environment (vars + secrets) into the live
// .env.production on the host, so nobody has to edit that file by hand.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./fixture";

const SCRIPT = path.join(REPO_ROOT, "deploy/oci/sync-shiba-llm-env.sh");
const WORKFLOW = path.join(REPO_ROOT, ".github/workflows/deploy-oci.yml");

function runSync(envFile: string, env: Record<string, string>) {
  return spawnSync("bash", [SCRIPT, envFile], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 30_000,
    env: { PATH: process.env.PATH ?? "", ...env },
  });
}

function tempEnvFile(initial: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "shiba-llm-env-"));
  const file = path.join(dir, ".env.production");
  writeFileSync(file, initial);
  return file;
}

describe("Shiba LLM production env sync", () => {
  it("wires the sync step into the Oracle deploy before the release step", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    const syncStepAt = workflow.indexOf("- name: Sync Shiba LLM settings");
    const releaseStepAt = workflow.indexOf("- name: Release validated source to Oracle");
    expect(syncStepAt, "deploy-oci.yml must have a Shiba LLM sync step").toBeGreaterThanOrEqual(0);
    expect(releaseStepAt, "the sync step must run before the release step").toBeGreaterThan(syncStepAt);
    const syncStep = workflow.slice(syncStepAt, releaseStepAt);
    for (const ref of [
      "${{ vars.SHIBA_LLM_BASE_URL }}",
      "${{ vars.SHIBA_LLM_MODEL }}",
      "${{ secrets.SHIBA_LLM_CF_ACCESS_CLIENT_ID }}",
      "${{ secrets.SHIBA_LLM_CF_ACCESS_CLIENT_SECRET }}",
    ]) {
      expect(syncStep.includes(ref), `the sync step env must pass ${ref}`).toBe(true);
    }
    expect(syncStep).toContain('sync-shiba-llm-env.sh "/srv/kotobawork/deploy/oci/.env.production"');
    const release = readFileSync(path.join(REPO_ROOT, "deploy/oci/deploy-release.sh"), "utf8");
    expect(release).toContain("base=/srv/kotobawork");
    expect(release).toContain('OCI_ENV_FILE="$base/deploy/oci/.env.production"');
  });

  it("updates an existing key in place and preserves every other line", () => {
    const file = tempEnvFile(
      "# production\nPOSTGRES_PASSWORD=keep-me\nSHIBA_LLM_MODEL=old-model\nOTHER=untouched\n"
    );
    const result = runSync(file, { SHIBA_LLM_MODEL: "qwen3-1.7b" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(
      "# production\nPOSTGRES_PASSWORD=keep-me\nSHIBA_LLM_MODEL=qwen3-1.7b\nOTHER=untouched\n"
    );
  });

  it("appends keys that are missing from the env file", () => {
    const file = tempEnvFile("POSTGRES_PASSWORD=keep-me\n");
    const result = runSync(file, {
      SHIBA_LLM_BASE_URL: "https://llm.kiokoto.com/v1",
      SHIBA_LLM_MODEL: "qwen3-1.7b",
    });
    expect(result.status, result.stderr).toBe(0);
    const content = readFileSync(file, "utf8");
    expect(content.startsWith("POSTGRES_PASSWORD=keep-me\n")).toBe(true);
    expect(content).toContain("SHIBA_LLM_BASE_URL=https://llm.kiokoto.com/v1\n");
    expect(content).toContain("SHIBA_LLM_MODEL=qwen3-1.7b\n");
  });

  it("skips empty values without blanking existing settings", () => {
    const file = tempEnvFile("SHIBA_LLM_MODEL=old-model\n");
    const result = runSync(file, { SHIBA_LLM_MODEL: "", SHIBA_LLM_BASE_URL: "" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, "utf8"), "an empty incoming value must never blank an existing setting").toBe(
      "SHIBA_LLM_MODEL=old-model\n"
    );
  });

  it("is idempotent: a second run leaves the file byte-identical", () => {
    const file = tempEnvFile("SHIBA_LLM_MODEL=old-model\n");
    const env = { SHIBA_LLM_MODEL: "qwen3-1.7b", SHIBA_LLM_BASE_URL: "https://llm.kiokoto.com/v1" };
    expect(runSync(file, env).status).toBe(0);
    const afterFirst = readFileSync(file, "utf8");
    const second = runSync(file, env);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("no changes");
    expect(readFileSync(file, "utf8")).toBe(afterFirst);
  });

  it("appends on its own line when the file lacks a trailing newline", () => {
    const file = tempEnvFile("OTHER=important");
    const result = runSync(file, { SHIBA_LLM_MODEL: "qwen3-1.7b" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe("OTHER=important\nSHIBA_LLM_MODEL=qwen3-1.7b\n");
  });

  it("copies values with backslashes and equals signs byte-for-byte", () => {
    const tricky = String.raw`ab\ncd\tef\\gh=x=y`;
    const file = tempEnvFile("SHIBA_LLM_CF_ACCESS_CLIENT_SECRET=old\n");
    const updated = runSync(file, { SHIBA_LLM_CF_ACCESS_CLIENT_SECRET: tricky });
    expect(updated.status, updated.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(`SHIBA_LLM_CF_ACCESS_CLIENT_SECRET=${tricky}\n`);

    const appended = tempEnvFile("KEEP=1\n");
    const result = runSync(appended, { SHIBA_LLM_CF_ACCESS_CLIENT_SECRET: tricky });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(appended, "utf8")).toBe(`KEEP=1\nSHIBA_LLM_CF_ACCESS_CLIENT_SECRET=${tricky}\n`);
  });

  it("skips a value that contains a newline and reports why", () => {
    const file = tempEnvFile("SHIBA_LLM_MODEL=old-model\n");
    const result = runSync(file, { SHIBA_LLM_MODEL: "two\nlines" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("newline");
    expect(readFileSync(file, "utf8")).toBe("SHIBA_LLM_MODEL=old-model\n");
  });

  it("does not touch keys that merely share a prefix", () => {
    const file = tempEnvFile("SHIBA_LLM_MODEL_X=keep-me\nSHIBA_LLM_MODEL=old-model\n");
    const result = runSync(file, { SHIBA_LLM_MODEL: "qwen3-1.7b" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe("SHIBA_LLM_MODEL_X=keep-me\nSHIBA_LLM_MODEL=qwen3-1.7b\n");
  });

  it("rewrites stale duplicates instead of trusting an exact match elsewhere", () => {
    const file = tempEnvFile("SHIBA_LLM_MODEL=qwen3-1.7b\nSHIBA_LLM_MODEL=stale\n");
    const result = runSync(file, { SHIBA_LLM_MODEL: "qwen3-1.7b" });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe("SHIBA_LLM_MODEL=qwen3-1.7b\nSHIBA_LLM_MODEL=qwen3-1.7b\n");
  });

  it("never prints secret values and keeps a rolling backup on change", () => {
    const file = tempEnvFile("SHIBA_LLM_CF_ACCESS_CLIENT_SECRET=previous-secret\n");
    const result = runSync(file, { SHIBA_LLM_CF_ACCESS_CLIENT_SECRET: "brand-new-secret-value" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("brand-new-secret-value");
    expect(result.stderr).not.toContain("brand-new-secret-value");
    const backup = `${file}.bak-shiba-llm`;
    expect(existsSync(backup), "a change must keep the previous file as a backup").toBe(true);
    expect(readFileSync(backup, "utf8")).toBe("SHIBA_LLM_CF_ACCESS_CLIENT_SECRET=previous-secret\n");
    expect(readFileSync(file, "utf8")).toBe("SHIBA_LLM_CF_ACCESS_CLIENT_SECRET=brand-new-secret-value\n");
  });
});
