import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import { allCanonicalAdminPermissions, CANONICAL_ADMIN_ROLE_PERMISSIONS } from "@nihongo-bjt/shared";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const localActorId =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

const permissions = [
  ...allCanonicalAdminPermissions(),
  "admin.content.read",
  "admin.content.write",
  "admin.growth.read",
  "admin.growth.write",
  "admin.monetization.read",
  "admin.monetization.write",
  "billing.overview.view",
  "billing.plan.view",
  "billing.plan.manage",
  "billing.entitlement.manage",
  "billing.quota.view",
  "billing.quota.manage",
  "billing.quota.override",
  "billing.subscription.view",
  "billing.subscription.manage",
  "billing.coupon.manage",
  "ads.placement.view",
  "ads.placement.manage",
  "ads.campaign.view",
  "ads.campaign.manage",
  "ads.provider.view",
  "ads.provider.manage",
  "ads.rules.manage",
  "ads.audit.view",
  "ads.performance.view",
  "revenue.analytics.view",
  "monetization.audit.view",
  "admin.users.create",
  "support.user.read",
  "support.user.write",
  /** @deprecated Use support.user.read / support.user.write; kept for existing role grants. */
  "support.user",
  "user.create",
  "admin.analytics.view",
  "analytics.view",
  "viewer.analytics",
  "viewer.audit",
  "iam.manage"
] as const;

async function main() {
  const actor = await prisma.adminActor.upsert({
    create: {
      displayName: "Local Admin",
      email: "local-admin@nihongo-bjt.local",
      id: localActorId
    },
    update: { status: "active" },
    where: { id: localActorId }
  });

  const role = await prisma.adminRole.upsert({
    create: {
      code: "admin.super",
      description: "Local development super administrator",
      name: "Super Admin"
    },
    update: { status: "active" },
    where: { code: "admin.super" }
  });

  for (const code of new Set(permissions)) {
    const permission = await prisma.adminPermission.upsert({
      create: { code, description: `Allows ${code}` },
      update: {},
      where: { code }
    });

    await prisma.adminRolePermission.upsert({
      create: { permissionId: permission.id, roleId: role.id },
      update: {},
      where: { roleId_permissionId: { permissionId: permission.id, roleId: role.id } }
    });
  }

  for (const [roleCode, rolePermissions] of Object.entries(CANONICAL_ADMIN_ROLE_PERMISSIONS)) {
    const canonicalRole = await prisma.adminRole.upsert({
      create: {
        code: roleCode,
        description: `Canonical v15 role: ${roleCode}`,
        name: roleCode
      },
      update: { status: "active" },
      where: { code: roleCode }
    });
    for (const code of rolePermissions) {
      const permission = await prisma.adminPermission.upsert({
        create: { code, description: `Allows ${code}` },
        update: {},
        where: { code }
      });
      await prisma.adminRolePermission.upsert({
        create: { permissionId: permission.id, roleId: canonicalRole.id },
        update: {},
        where: { roleId_permissionId: { permissionId: permission.id, roleId: canonicalRole.id } }
      });
    }
  }

  await prisma.adminActorRole.upsert({
    create: { actorId: actor.id, roleId: role.id },
    update: {},
    where: { actorId_roleId: { actorId: actor.id, roleId: role.id } }
  });

  console.log(`Seeded local admin actor ${actor.id}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
