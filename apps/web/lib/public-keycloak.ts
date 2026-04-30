"use client";

export function publicKeycloakIssuerUrlFromEnv(): string | undefined {
  const direct = (
    process.env.NEXT_PUBLIC_WEB_KEYCLOAK_ISSUER_URL ??
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL
  )?.trim();
  if (direct) {
    return direct.replace(/\/$/u, "");
  }

  const base = (process.env.NEXT_PUBLIC_WEB_KEYCLOAK_URL ?? process.env.NEXT_PUBLIC_KEYCLOAK_URL)
    ?.trim()
    .replace(/\/$/u, "");
  const realm = (
    process.env.NEXT_PUBLIC_WEB_KEYCLOAK_REALM ?? process.env.NEXT_PUBLIC_KEYCLOAK_REALM
  )?.trim();
  if (base && realm) {
    return `${base}/realms/${realm}`;
  }

  return undefined;
}

export function isWebKeycloakEnabled(): boolean {
  return Boolean(publicKeycloakIssuerUrlFromEnv());
}
