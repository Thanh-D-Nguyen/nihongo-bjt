const DEFAULT_SITE_URL = "https://kiokoto.com";

/**
 * Canonical public origin for the learner web app (sitemap, robots, canonical URLs).
 * Respects `WEB_PUBLIC_URL` (server env) and `NEXT_PUBLIC_WEB_PUBLIC_URL`,
 * defaulting to the production domain `https://kiokoto.com`.
 */
export function getSiteBaseUrl(): string {
  const raw =
    process.env.WEB_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_PUBLIC_URL?.trim() ||
    DEFAULT_SITE_URL;
  return raw.replace(/\/+$/u, "");
}
