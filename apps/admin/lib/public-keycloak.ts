"use client";

export function publicKeycloakIssuerUrlFromEnv(): string | undefined {
  const direct = (
    process.env.NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL ??
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL
  )?.trim();
  if (direct) {
    return direct.replace(/\/$/u, "");
  }

  const base = (process.env.NEXT_PUBLIC_ADMIN_KEYCLOAK_URL ?? process.env.NEXT_PUBLIC_KEYCLOAK_URL)
    ?.trim()
    .replace(/\/$/u, "");
  const realm = (
    process.env.NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM ?? process.env.NEXT_PUBLIC_KEYCLOAK_REALM
  )?.trim();
  if (base && realm) {
    return `${base}/realms/${realm}`;
  }

  return undefined;
}

export function isAdminKeycloakEnabled(): boolean {
  return Boolean(publicKeycloakIssuerUrlFromEnv());
}

export function isAdminTestBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ADMIN_TEST_BYPASS === "1";
}
