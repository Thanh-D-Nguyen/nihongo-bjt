import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import dotenv from "dotenv";

dotenv.config({ override: true });
const fixturePath = "tmp/local-audit/audit-138-admin.json";
const resultPath = "tmp/local-audit/audit-138-result.json";

function runFixture(fixture) {
  const result = spawnSync("go", ["run", "./cmd/audit138-fixture"], {
    cwd: "apps/api-go",
    env: process.env,
    input: JSON.stringify(fixture),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || "Admin audit fixture command failed");
  process.stdout.write(result.stdout);
}

const action = process.argv[2];
if (action === "create") {
  mkdirSync("tmp/local-audit", { recursive: true });
  const id = randomUUID();
  const fixture = {
    action,
    actorId: id,
    roleCode: `audit138-${id.slice(0, 8)}`,
    email: `audit-138-${id}@nihongo-bjt.local`,
    password: randomBytes(32).toString("base64url"),
  };
  runFixture(fixture);
  writeFileSync(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
} else if (action === "cleanup") {
  if (existsSync(fixturePath)) {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    runFixture({ ...fixture, action });
    unlinkSync(fixturePath);
  }
  if (existsSync(resultPath)) unlinkSync(resultPath);
} else {
  throw new Error("usage: node e2e/audit/audit138-fixture.mjs create|cleanup");
}
