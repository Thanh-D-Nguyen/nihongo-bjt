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
  /** Express proxy preset used to resolve the real client IP without blanket trust. */
  TRUST_PROXY: z.enum(["loopback", "linklocal", "uniquelocal"]).default("loopback"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  MEILI_HOST: z.string().url().default("http://localhost:7700"),
  MEILI_MASTER_KEY: z.string().min(1).default("local_dev_meili_master_key"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  MINIO_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  MINIO_SECRET_KEY: z.string().min(1).default("minioadmin"),
  MINIO_BUCKET: z.string().min(1).default("nihongo-bjt-media"),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Browser-facing MinIO/S3 endpoint used only to sign presigned URLs that the
   * client hits directly. In production the internal MINIO_ENDPOINT is not
   * reachable from the browser, so set these to the public host (e.g. a reverse
   * proxy / CDN domain). When unset, the internal MINIO_* values are reused.
   */
  MINIO_PUBLIC_ENDPOINT: z.string().min(1).optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  MINIO_PUBLIC_USE_SSL: z
    .string()
    .optional()
    .transform((value) => (value == null ? undefined : value === "true")),
  OAUTH_STATE_SECRET: z.string().min(32).optional(),
  /** HMAC secret for short-lived managed-ad decision tokens. Required when ads are enabled in production. */
  ADS_DECISION_SIGNING_SECRET: z.string().min(32).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
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

export const defaultLocale = "vi" as const;
export const supportedLocales = ["vi", "ja", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}
