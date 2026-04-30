import { handleKeycloakOAuthCallback } from "@/lib/kc-oauth-callback";
import { getKcWebConfig } from "@/lib/kc-server-config";

export async function GET(request: Request) {
  return handleKeycloakOAuthCallback(request, {
    defaultFailLocalePrefix: "/vi",
    getIssuerClient: getKcWebConfig
  });
}
