import { keycloakPublicBaseUrlFromIssuer, realmNameFromIssuer } from "./kc-issuer-parse";

export type KcWebConfig = {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  publicBaseUrl: string;
  redirectUri: string;
};

/** Master-realm admin credentials for Keycloak Admin REST (e.g. self‑serve register). Omit in prod or use a least‑privilege service account. */
export type KcAdminBootstrap = {
  baseUrl: string;
  password: string;
  realm: string;
  username: string;
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

export function getKcAdminBootstrap(): KcAdminBootstrap | null {
  const cfg = getKcWebConfig();
  if (!cfg) {
    return null;
  }
  const username = process.env.KEYCLOAK_ADMIN_USERNAME?.trim();
  const password = process.env.KEYCLOAK_ADMIN_PASSWORD?.trim();
  if (!username || !password) {
    return null;
  }
  return {
    baseUrl: keycloakPublicBaseUrlFromIssuer(cfg.issuer),
    password,
    realm: realmNameFromIssuer(cfg.issuer),
    username
  };
}
