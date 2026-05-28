import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

async function main() {
  await prisma.shareTemplate.upsert({
    create: {
      config: {
        badgeKey: "NihonGo BJT",
        brandAccent: "#38bdf8",
        brandBg: "#0f172a",
        brandFg: "#e2e8f0"
      },
      kind: "streak",
      slug: "default_streak_v1"
    },
    update: { active: true },
    where: { slug: "default_streak_v1" }
  });
  await prisma.shareTemplate.upsert({
    create: {
      config: {
        badgeKey: "NihonGo BJT",
        brandAccent: "#a78bfa",
        brandBg: "#0f172a",
        brandFg: "#e2e8f0"
      },
      kind: "bjt_result",
      slug: "default_bjt_v1"
    },
    update: { active: true },
    where: { slug: "default_bjt_v1" }
  });
  await prisma.shareTemplate.upsert({
    create: {
      config: {
        badgeKey: "NihonGo BJT",
        brandAccent: "#34d399",
        brandBg: "#0f172a",
        brandFg: "#e2e8f0"
      },
      kind: "daily_phrase",
      slug: "default_daily_v1"
    },
    update: { active: true },
    where: { slug: "default_daily_v1" }
  });
  console.log("Growth seed: share templates OK.");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
