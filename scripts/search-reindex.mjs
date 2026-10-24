import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
dotenv.config({ path: `${root}.env`, quiet: true });
const env = { ...process.env };
for (const name of ["DATABASE_URL", "MEILISEARCH_URL"]) {
  let url;
  try {
    url = new URL(env[name] ?? "");
  } catch {
    throw new Error(`${name} must contain a valid local URL`);
  }
  const protocols = name === "DATABASE_URL" ? ["postgres:", "postgresql:"] : ["http:", "https:"];
  if (
    !protocols.includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    ["host", "hostaddr", "service", "servicefile"].some((key) => url.searchParams.has(key))
  ) {
    throw new Error(`${name} must point to a local service for this command`);
  }
  if (name === "DATABASE_URL") url.searchParams.delete("schema");
  env[name] = url.toString();
}
const result = spawnSync("go", ["run", "./cmd/search-reindex"], {
  cwd: `${root}apps/api-go`,
  env,
  stdio: "inherit"
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
