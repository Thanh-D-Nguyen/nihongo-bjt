export type KcAdminConfig = {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  publicBaseUrl: string;
  redirectUri: string;
};

export function getKcAdminConfig(): KcAdminConfig | null {
  const issuer = (process.env.ADMIN_KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER_URL)
    ?.trim()
    .replace(/\/$/u, "");
  const clientId = (process.env.ADMIN_KEYCLOAK_CLIENT_ID ?? process.env.KEYCLOAK_CLIENT_ID)?.trim();
  if (!issuer || !clientId) {
    return null;
  }
  const publicBaseUrl = (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");
  return {
    clientId,
    clientSecret:
      (process.env.ADMIN_KEYCLOAK_CLIENT_SECRET ?? process.env.KEYCLOAK_CLIENT_SECRET)?.trim() ||
      undefined,
    issuer,
    publicBaseUrl,
    redirectUri: `${publicBaseUrl}/auth/callback`
  };
}
