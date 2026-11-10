import { config as loadDotenv } from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root — Turbopack + tracing; avoids a stray parent `package-lock.json` (e.g. in $HOME) being chosen as workspace root. */
const monorepoRoot = path.resolve(__dirname, "../..");

// Next only auto-loads `apps/web/.env*`. Merge repo root env so shared vars (e.g. `NEXT_PUBLIC_API_URL`, `API_URL`)
// are available to server route handlers. `.env.local` overrides `.env` for keys it defines.
loadDotenv({ path: path.join(monorepoRoot, ".env") });
loadDotenv({ path: path.join(monorepoRoot, ".env.local"), override: true });
loadDotenv({ path: path.join(__dirname, ".env.local"), override: true });

const internalApiTarget = (
  process.env.API_URL ||
  process.env.WEB_API_URL ||
  process.env.INTERNAL_API_URL ||
  "http://127.0.0.1:4001"
).replace(/\/$/u, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { agentUpgrade: "security" },
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${internalApiTarget}/api/:path*`
        }
      ]
    };
  },
  transpilePackages: [
    "@nihongo-bjt/config",
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
