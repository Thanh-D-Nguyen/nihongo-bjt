/**
 * Link Keycloak subject to local admin actor.
 * Usage: pnpm tsx database/scripts/link-keycloak-admin.ts
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../packages/database/src/index.js";
import { tryResourceOwnerPasswordGrant } from "../../../packages/keycloak-oidc/src/index.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

function decodeJwtSub(accessToken: string): string {
  const [, payload] = accessToken.split(".");
  if (!payload) {
    throw new Error("Keycloak access token is not a JWT");
  }
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    sub?: unknown;
  };
  if (typeof decoded.sub !== "string" || !decoded.sub) {
    throw new Error("Keycloak access token does not contain sub");
  }
  return decoded.sub;
}

async function resolveKeycloakSubject(): Promise<string> {
  const explicit = process.env.KEYCLOAK_ADMIN_SUBJECT?.trim();
  if (explicit) {
    return explicit;
  }

  const issuer = env.ADMIN_KEYCLOAK_ISSUER_URL ?? env.KEYCLOAK_ISSUER_URL;
  const clientId = env.ADMIN_KEYCLOAK_CLIENT_ID ?? env.KEYCLOAK_CLIENT_ID;
  const clientSecret = env.ADMIN_KEYCLOAK_CLIENT_SECRET ?? env.KEYCLOAK_CLIENT_SECRET;
  const username = process.env.KEYCLOAK_LINK_ADMIN_USERNAME?.trim() || "localadmin";
  const password = process.env.KEYCLOAK_LINK_ADMIN_PASSWORD || "admin";
  if (!issuer || !clientId || !clientSecret) {
    throw new Error(
      "Missing ADMIN_KEYCLOAK_ISSUER_URL / ADMIN_KEYCLOAK_CLIENT_ID / ADMIN_KEYCLOAK_CLIENT_SECRET"
    );
  }

  const grant = await tryResourceOwnerPasswordGrant({
    clientId,
    clientSecret,
    issuer,
    password,
    username
  });
  if (!grant.ok) {
    throw new Error(
      `Could not resolve Keycloak admin subject: ${grant.httpStatus} ${grant.keycloakError ?? ""} ${grant.errorDescription ?? ""}`.trim()
    );
  }
  return decodeJwtSub(grant.tokens.access_token);
}

async function main() {
  const kcSub = await resolveKeycloakSubject();
  const localActorId =
    process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

  // Check if already linked
  const existing = await prisma.adminActor.findFirst({
    where: { id: localActorId }
  });

  if (!existing) {
    console.log("Admin actor not found. Run seed-admin.ts first.");
    await prisma.$disconnect();
    return;
  }

  if (existing.keycloakSubject === kcSub) {
    console.log("Already linked:", existing.keycloakSubject);
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.adminActor.update({
    where: { id: localActorId },
    data: { keycloakSubject: kcSub }
  });

  console.log("✅ Linked admin actor to Keycloak:");
  console.log("  id:", updated.id);
  console.log("  keycloakSubject:", updated.keycloakSubject);
  console.log("  displayName:", updated.displayName);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
