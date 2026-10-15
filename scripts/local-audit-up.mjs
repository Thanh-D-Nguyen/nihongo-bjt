#!/usr/bin/env node
// Run in a persistent terminal: node scripts/local-audit-up.mjs. Ctrl-C stops apps.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
dotenv.config({ path: ".env", quiet: true, override: true });
const runtime = path.join(root, "tmp/local-audit");
mkdirSync(path.join(runtime, "media"), { recursive: true });
const database = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) {
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
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
run("docker", ["compose", "up", "-d", "--wait", "postgres", "redis", "meilisearch", "mailpit"]);
run("go", ["build", "-o", path.join(runtime, "api"), "./cmd/api"], path.join(root, "apps/api-go"));
for (const port of [3000, 3001, 4001, 18081]) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`Local audit port ${port} is occupied; inspect its owner before restarting`)));
    server.listen({ host: "::1", port, ipv6Only: true }, () => server.close(resolve));
  });
}
openSync(path.join(runtime, "requests.log"), "a", 0o600);
const caddyfile = path.join(runtime, "Caddyfile");
writeFileSync(caddyfile, `{
  admin off
  auto_https off
}
:18081 {
  bind localhost
  log {
    output file ${runtime}/requests.log
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
console.log("Learner: http://localhost:18081/vi | Admin: http://localhost:18081/admin/vi");
