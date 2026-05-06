import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root — Turbopack + tracing; avoids a stray parent `package-lock.json` (e.g. in $HOME) being chosen as workspace root. */
const monorepoRoot = path.resolve(__dirname, "../..");

// Next only auto-loads `apps/web/.env*`. Merge repo root env so shared vars (e.g. `NEXT_PUBLIC_API_URL`, `API_URL`)
// are available to server route handlers. `.env.local` overrides `.env` for keys it defines.
loadDotenv({ path: path.join(monorepoRoot, ".env") });
loadDotenv({ path: path.join(monorepoRoot, ".env.local"), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot
  },
  transpilePackages: [
    "@nihongo-bjt/config",
    "@nihongo-bjt/keycloak-oidc",
    "@nihongo-bjt/shared",
    "@nihongo-bjt/ui"
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "www3.nhk.or.jp", pathname: "/**" },
      { protocol: "https", hostname: "imgu.web.nhk", pathname: "/**" },
      { protocol: "https", hostname: "nhkeasier.com", pathname: "/media/jpg/**" }
    ]
  }
};

export default nextConfig;
