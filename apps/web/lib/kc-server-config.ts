import { keycloakPublicBaseUrlFromIssuer, realmNameFromIssuer } from "./kc-issuer-parse";

export type KcWebConfig = {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  publicBaseUrl: string;
  redirectUri: string;
};

/** Least-privilege service account for Keycloak Admin REST user lifecycle operations. */
export type KcUserAdminConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  realm: string;
};

export function getKcWebConfig(): KcWebConfig | null {
  const issuer = (process.env.WEB_KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER_URL)
    ?.trim()
    .replace(/\/$/u, "");
  const clientId = (process.env.WEB_KEYCLOAK_CLIENT_ID ?? process.env.KEYCLOAK_CLIENT_ID)?.trim();
  if (!issuer || !clientId) {
    return null;
  }
  const publicBaseUrl = (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");
  return {
    clientId,
    clientSecret:
      (process.env.WEB_KEYCLOAK_CLIENT_SECRET ?? process.env.KEYCLOAK_CLIENT_SECRET)?.trim() ||
      undefined,
    issuer,
    publicBaseUrl,
    redirectUri: `${publicBaseUrl}/auth/callback`
  };
}

export function getKcUserAdminConfig(): KcUserAdminConfig | null {
  const cfg = getKcWebConfig();
  if (!cfg) {
    return null;
  }
  const clientId = process.env.KEYCLOAK_USER_ADMIN_CLIENT_ID?.trim();
  const clientSecret = process.env.KEYCLOAK_USER_ADMIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return {
    baseUrl: keycloakPublicBaseUrlFromIssuer(cfg.issuer),
    clientId,
    clientSecret,
    realm: realmNameFromIssuer(cfg.issuer),
  };
}
