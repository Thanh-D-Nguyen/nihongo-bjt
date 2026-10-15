#!/usr/bin/env node
// --stable verifies the same application listeners at 0, 10, 30, and 60 seconds.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
mkdirSync("tmp/local-audit", { recursive: true });
const start = Date.now();
const results = [];
for (const seconds of process.argv.includes("--stable") ? [0, 10, 30, 60] : [0]) {
  await setTimeout(Math.max(0, start + seconds * 1000 - Date.now()));
  const checks = {};
  for (const [name, url] of Object.entries({
    api: "http://localhost:18081/health/ready",
    learner: "http://localhost:18081/vi",
    admin: "http://localhost:18081/admin/vi/login",
    proxy: "http://localhost:18081/health",
    search: "http://localhost:7700/health",
    mailpit: "http://localhost:8025/api/v1/info",
  })) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      checks[name] = { status: response.status, pass: response.ok };
      if (name === "api" && response.ok) {
        const body = await response.json();
        checks[name].pass = body.checks?.postgres === "ok" && body.checks?.redis === "ok";
      } else {
        await response.body?.cancel();
      }
    } catch (error) {
      checks[name] = { pass: false, error: error.message };
    }
  }
  for (const [name, args] of Object.entries({
    postgres: ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "postgres", "-d", "nihongo_bjt"],
    redis: ["compose", "exec", "-T", "redis", "redis-cli", "ping"],
  })) {
    const command = spawnSync("docker", args, { encoding: "utf8", timeout: 10000 });
    checks[name] = { pass: command.status === 0, output: command.stdout?.trim() };
  }
  const listeners = spawnSync("lsof", ["-nP", "-iTCP:18081", "-iTCP:4001", "-iTCP:3000", "-iTCP:3001", "-sTCP:LISTEN"], { encoding: "utf8" });
  const pids = (listeners.stdout ?? "").split("\n").filter((line) => /\[::1\]:300[01]|\*:4001|:18081/.test(line)).map((line) => line.trim().split(/\s+/)[1]).sort();
  checks.listeners = { pass: pids.length === 4 && (!results.length || JSON.stringify(pids) === JSON.stringify(results[0].pids)), output: listeners.stdout };
  const result = { seconds, elapsed: (Date.now() - start) / 1000, timestamp: new Date().toISOString(), pids, checks, pass: Object.values(checks).every((check) => check.pass) };
  results.push(result);
  writeFileSync("tmp/local-audit/stability.json", JSON.stringify(results, null, 2) + "\n");
  console.log(`${seconds}s ${result.pass ? "PASS" : "FAIL"}: ${Object.entries(checks).map(([name, check]) => `${name}=${check.pass ? "ok" : "failed"}`).join(" ")}`);
}
process.exitCode = results.every((result) => result.pass) ? 0 : 1;
