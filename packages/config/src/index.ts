import { z } from "zod";

const csv = z
  .string()
  .default("http://localhost:3000,http://localhost:3001")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  CORS_ORIGINS: csv,
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  MEILI_HOST: z.string().url().default("http://localhost:7700"),
  MEILI_MASTER_KEY: z.string().min(1).default("local_dev_meili_master_key"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  /** When set, learner/admin UIs use OIDC session cookies + Bearer for API calls (public OIDC metadata URL). */
  NEXT_PUBLIC_KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  /** Alternative to NEXT_PUBLIC_KEYCLOAK_ISSUER_URL: Keycloak base URL (no /realms/...). */
  NEXT_PUBLIC_KEYCLOAK_URL: z.string().url().optional(),
  NEXT_PUBLIC_KEYCLOAK_REALM: z.string().optional(),
  NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_WEB_KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEB_KEYCLOAK_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEB_KEYCLOAK_REALM: z.string().optional(),
  NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADMIN_KEYCLOAK_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM: z.string().optional(),
  NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID: z.string().optional(),
  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  MINIO_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  MINIO_SECRET_KEY: z.string().min(1).default("minioadmin"),
  MINIO_BUCKET: z.string().min(1).default("nihongo-bjt-media"),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  OAUTH_STATE_SECRET: z.string().min(32).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  /** Full OIDC issuer, e.g. https://id.example.com/realms/nihongo-bjt */
  KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  /** Optional JWKS override; defaults to ${KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs */
  KEYCLOAK_JWKS_URL: z.string().url().optional(),
  /** Expected JWT `aud` (comma-separated for multiple). Defaults to KEYCLOAK_CLIENT_ID. */
  KEYCLOAK_EXPECTED_AUDIENCE: z.string().optional(),
  /** Confidential client for token exchange (Next.js server) and optional API audience check. */
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  WEB_KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  WEB_KEYCLOAK_CLIENT_ID: z.string().optional(),
  WEB_KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  ADMIN_KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  ADMIN_KEYCLOAK_CLIENT_ID: z.string().optional(),
  ADMIN_KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  /** Comma-separated realm/client role names that may access the admin portal (before internal RBAC). Default: admin */
  KEYCLOAK_ADMIN_REALM_ROLES: z.string().optional(),
  /** Public browser URL of Keycloak (optional; defaults to issuer origin). Used in docs / logout hints. */
  KEYCLOAK_PUBLIC_URL: z.string().url().optional(),
  /**
   * Keycloak public URL (origin only) for Admin REST, e.g. `http://localhost:8080`.
   * If unset, derived from `KEYCLOAK_ISSUER_URL` / `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL`.
   */
  KEYCLOAK_BASE_URL: z.string().url().optional(),
  /**
   * Confidential client in the target realm (or with realm-management) that can call Admin REST
   * (`manage-users`, `query-users`, `view-users`). No password is stored in PostgreSQL; this is server-only.
   */
  KEYCLOAK_USER_ADMIN_CLIENT_ID: z.string().optional(),
  KEYCLOAK_USER_ADMIN_CLIENT_SECRET: z.string().optional(),
  /**
   * Realm where users are created. Defaults to realm parsed from `KEYCLOAK_ISSUER_URL` path, or
   * `KEYCLOAK_USER_ADMIN_REALM` if set.
   */
  KEYCLOAK_USER_ADMIN_TARGET_REALM: z.string().optional(),
  /**
   * When not `false` / `0`, serve Swagger UI and OpenAPI JSON at `/api/docs` (and `/api/docs/openapi.json`).
   * Set to `false` in production if the spec must not be public (use gateway auth instead).
   */
  SWAGGER_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PIXABAY_API_KEY: z.string().optional(),
  GOOGLE_CSE_KEY: z.string().optional(),
  GOOGLE_CSE_CX: z.string().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(env);
}

/**
 * OIDC issuer for Next.js client bundles. Prefer `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL`, or
 * `NEXT_PUBLIC_KEYCLOAK_URL` + `NEXT_PUBLIC_KEYCLOAK_REALM`.
 */
export function publicKeycloakIssuerUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct = env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL?.trim();
  if (direct) {
    return direct.replace(/\/$/u, "");
  }
  const base = env.NEXT_PUBLIC_KEYCLOAK_URL?.trim().replace(/\/$/u, "");
  const realm = env.NEXT_PUBLIC_KEYCLOAK_REALM?.trim();
  if (base && realm) {
    return `${base}/realms/${realm}`;
  }
  return undefined;
}

export function isPublicKeycloakEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(publicKeycloakIssuerUrl(env));
}

export const defaultLocale = "vi" as const;
export const supportedLocales = ["vi", "ja"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}
