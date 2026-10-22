#!/usr/bin/env node
// Run in a persistent terminal: node scripts/local-audit-up.mjs. Ctrl-C stops apps.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import net from "node:net";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const prepare = process.argv.includes("--prepare");
if (prepare && !existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  chmodSync(".env", 0o600);
  console.log("Created .env from .env.example for local development.");
}
dotenv.config({ path: ".env", quiet: true, override: true });
const runtime = path.join(root, "tmp/local-audit");
mkdirSync(path.join(runtime, "media"), { recursive: true });
let database;
try {
  database = new URL(process.env.DATABASE_URL ?? "");
} catch {
  throw new Error("Set a valid local DATABASE_URL in .env before starting.");
}
if (!["postgres:", "postgresql:"].includes(database.protocol)
  || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  || ["host", "hostaddr", "service", "servicefile"].some((key) => database.searchParams.has(key))) {
  throw new Error("Local audit requires a loopback DATABASE_URL");
}
const env = {
  ...process.env,
  NODE_ENV: "development",
  API_GO_PORT: "4001",
  COOKIE_SECURE: "false",
  ADMIN_TEST_BYPASS: "0",
  NEXT_PUBLIC_ADMIN_TEST_BYPASS: "0",
  NEXT_PUBLIC_API_URL: "",
  API_URL: "http://[::1]:4001",
  WEB_PUBLIC_URL: "http://localhost:18081",
  SMTP_ADDRESS: "127.0.0.1:1025",
  SMTP_FROM: "no-reply@kotobawork.local",
  SMTP_REQUIRE_STARTTLS: "false",
  ADMIN_PUBLIC_URL: "http://localhost:18081/admin",
  CORS_ORIGINS: "http://localhost:18081,http://127.0.0.1:18081,http://localhost:3001",
  MEDIA_BASE_PATH: path.join(runtime, "media"),
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env: command === "docker" ? dockerEnv : env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
for (const port of [3000, 3001, 4001, 18081]) {
  for (const host of ["127.0.0.1", "::1"]) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", () => reject(new Error(`Local audit port ${port} is occupied or unavailable on ${host}; inspect its owner before restarting`)));
      server.listen({ host, port, ipv6Only: host === "::1" }, () => server.close(resolve));
    });
  }
}
let dockerEndpoint = env.DOCKER_HOST;
if (env.DOCKER_CONTEXT || !dockerEndpoint) {
  const context = spawnSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { cwd: root, env, encoding: "utf8" });
  if (context.error || context.status !== 0) throw new Error("Cannot inspect the local Docker context.");
  dockerEndpoint = context.stdout.trim();
}
if (!/^(unix:\/\/|npipe:\/\/|tcp:\/\/(localhost|127\.0\.0\.1):)/.test(dockerEndpoint)) {
  throw new Error("Local startup requires a local Docker endpoint; check Docker settings in .env and the shell.");
}
const dockerEnv = { ...env, DOCKER_HOST: dockerEndpoint, DOCKER_CONTEXT: "" };
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120", "postgres", "redis", "meilisearch", "mailpit"]);
if (prepare) {
  run("pnpm", ["prisma:generate"]);
  run("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema", "packages/database/prisma/schema.prisma"]);
}
run("go", ["build", "-o", path.join(runtime, "api"), "./cmd/api"], path.join(root, "apps/api-go"));
closeSync(openSync(path.join(runtime, "requests.log"), "a", 0o600));
const caddyfile = path.join(runtime, "Caddyfile");
writeFileSync(caddyfile, `{
  admin off
  auto_https off
}
:18081 {
  bind localhost
  log {
    output file ${JSON.stringify(path.join(runtime, "requests.log"))}
    format filter {
      wrap json
      fields {
        request>headers delete
        resp_headers delete
        request>uri delete
      }
    }
  }
  handle /health {
    respond "OK" 200
  }
  handle /health/* {
    reverse_proxy [::1]:4001
  }
  @learnerRecovery path /api/auth/forgot-password /api/auth/reset-password
  handle @learnerRecovery {
    reverse_proxy [::1]:3000
  }
  handle /api/* {
    reverse_proxy [::1]:4001
  }
  handle /ws/* {
    reverse_proxy [::1]:4001
  }
  handle /admin/* {
    reverse_proxy [::1]:3001
  }
  handle {
    reverse_proxy [::1]:3000
  }
}
`);
run("caddy", ["validate", "--config", caddyfile, "--adapter", "caddyfile"]);
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 10000);
  timer.unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
function start(name, command, args, cwd = root) {
  const log = openSync(path.join(runtime, `${name}.log`), "a", 0o600);
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", log, log] });
  closeSync(log);
  children.push(child);
  child.on("error", (error) => { console.error(`${name}: ${error.message}`); stop(1); });
  child.on("exit", (code, signal) => {
    console.log(`${name} exited: code=${code} signal=${signal}`);
    if (!stopping) stop(code || 1);
  });
  console.log(`${name}: pid=${child.pid}, log=${runtime}/${name}.log`);
}
start("api", path.join(runtime, "api"), []);
for (const name of ["web", "admin"]) {
  start(name, process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "::1", "--port", name === "web" ? "3000" : "3001"], path.join(root, `apps/${name}`));
}
start("caddy", "caddy", ["run", "--config", caddyfile, "--adapter", "caddyfile"]);
console.log("Waiting for API, learner and admin. Logs: tmp/local-audit/*.log");
const endpoints = ["/health/ready", "/vi", "/admin/vi/login"];
const deadline = Date.now() + 180000;
let pending = endpoints;
while (!stopping && Date.now() < deadline && pending.length) {
  const checks = await Promise.all(pending.map(async (endpoint) => {
    try {
      const response = await fetch(`http://localhost:18081${endpoint}`, { signal: AbortSignal.timeout(10000) });
      if (endpoint === "/health/ready" && response.ok) {
        const body = await response.json();
        return body.checks?.postgres === "ok" && body.checks?.redis === "ok";
      }
      await response.body?.cancel();
      return response.ok;
    } catch {
      // Connections can fail while the servers start; the deadline reports failure.
      return false;
    }
  }));
  pending = pending.filter((_, index) => !checks[index]);
  if (pending.length && !stopping) await delay(1000);
}
if (!stopping && pending.length) {
  console.error(`Startup timed out waiting for ${pending.join(", ")}. Inspect tmp/local-audit/*.log`);
  stop(1);
} else if (!stopping) {
  console.log("Ready! Learner: http://localhost:18081/vi | Admin: http://localhost:18081/admin/vi/login");
  console.log("API: http://localhost:18081/health/ready | Mail: http://localhost:8025 | Ctrl-C stops apps; Docker data is preserved.");
}
