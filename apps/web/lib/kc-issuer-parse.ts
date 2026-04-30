/** Public Keycloak base URL, e.g. `http://localhost:8080`, from an issuer like `.../realms/nihongo-bjt`. */
export function keycloakPublicBaseUrlFromIssuer(issuer: string): string {
  const u = issuer.replace(/\/$/u, "");
  const marker = "/realms/";
  const i = u.indexOf(marker);
  if (i <= 0) {
    throw new Error("Invalid KEYCLOAK_ISSUER_URL: expected path /realms/{realm}");
  }
  return u.slice(0, i);
}

export function realmNameFromIssuer(issuer: string): string {
  const u = issuer.replace(/\/$/u, "");
  const m = u.match(/\/realms\/([^/]+)$/u);
  const name = m?.[1];
  if (!name) {
    throw new Error("Invalid KEYCLOAK_ISSUER_URL: missing realm segment");
  }
  return name;
}
