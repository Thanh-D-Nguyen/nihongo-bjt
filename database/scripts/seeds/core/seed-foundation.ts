import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const locales = [
  { code: "vi", englishName: "Vietnamese", fallbackOrder: 0, nativeName: "Tiếng Việt" },
  { code: "ja", englishName: "Japanese", fallbackOrder: 1, nativeName: "日本語" },
  { code: "en", englishName: "English", fallbackOrder: 2, nativeName: "English" }
];

const namespaces = [
  "common",
  "auth",
  "dashboard",
  "dictionary",
  "flashcard",
  "quiz",
  "battle",
  "admin",
  "achievement",
  "error"
];

const featureFlags = [
  ["ads.enabled", "Enable ad serving for learner app.", false],
  ["billing.stripe.enabled", "Enable Stripe checkout and subscription management.", false],
  ["learning_path_engine", "Enable learner/admin learning path contracts and UI.", false],
  ["monetization.enforcement", "When enabled, quota limits and billing are enforced. Disable for free-for-all mode.", false],
  ["reading_assist", "Enable reusable Japanese reading assist APIs and UI affordances.", true],
  ["quiz.official_simulation.enabled", "Enable paid official-format BJT simulation.", false],
  ["social_growth", "Enable social login, referrals, share pages, and postcards.", false],
  ["legal_consent", "Enable policy/consent recording and privacy workflows.", false],
  ["notification_delivery", "Enable email/in-app notification delivery workers.", false],
  [
    "external_media_uploads",
    "Enable risky external/user media flows after scan provider is configured.",
    false
  ]
] as const;

async function main() {
  for (const locale of locales) {
    await prisma.locale.upsert({
      create: { ...locale, isEnabled: true },
      update: { ...locale, isEnabled: true },
      where: { code: locale.code }
    });
  }

  for (const namespace of namespaces) {
    await prisma.translationKey.upsert({
      create: {
        description: `Namespace marker for ${namespace}`,
        key: "__namespace__",
        namespace
      },
      update: {},
      where: { namespace_key: { key: "__namespace__", namespace } }
    });
  }

  for (const [key, description, enabled] of featureFlags) {
    await prisma.featureFlag.upsert({
      create: { description, enabled, key, killSwitch: key === "external_media_uploads" },
      update: { description, enabled, killSwitch: key === "external_media_uploads" },
      where: { key }
    });
  }

  console.log("Seeded v15 foundation locales, translation namespaces, and feature flags.");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
