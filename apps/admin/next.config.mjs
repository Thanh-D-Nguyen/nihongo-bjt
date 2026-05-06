import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Turbopack + tracing; avoids picking a stray parent lockfile as workspace root). */
const monorepoRoot = path.resolve(__dirname, "../..");

// Next only auto-loads `apps/admin/.env*`. Merge repo root so `KEYCLOAK_*` / `ADMIN_KEYCLOAK_*` used by route handlers exist.
loadDotenv({ path: path.join(monorepoRoot, ".env") });
loadDotenv({ path: path.join(monorepoRoot, ".env.local"), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [{ destination: "/pwa-icon.svg", source: "/favicon.ico" }];
  },
  turbopack: {
    root: monorepoRoot
  },
  transpilePackages: [
    "@nihongo-bjt/config",
    "@nihongo-bjt/keycloak-oidc",
    "@nihongo-bjt/shared",
    "@nihongo-bjt/ui"
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "0" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
