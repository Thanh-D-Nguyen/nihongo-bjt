/**
 * Canonical magazine filter kinds accepted by `GET /api/magazine?kind=...`.
 *
 * Source of truth: `listMagazineHandler` in
 * `apps/api-go/internal/httpserver/handler_career_content_gamification_misc.go`
 * (cases: "", "all", "vocab", "weather", "horoscope", "loto", "bjt_phrase").
 */
export const MAGAZINE_API_KINDS = [
  "vocab",
  "weather",
  "horoscope",
  "loto",
  "bjt_phrase",
] as const;

export type MagazineApiKind = (typeof MAGAZINE_API_KINDS)[number];
export type MagazineFilterKind = "all" | MagazineApiKind;

const CANONICAL_KIND_SET: ReadonlySet<string> = new Set<string>([
  "all",
  ...MAGAZINE_API_KINDS,
]);

/**
 * Legacy URL params and stored `widgetKind` values normalized to the canonical
 * query kind accepted by `GET /api/magazine?kind=...`.
 */
export const MAGAZINE_KIND_ALIASES: Readonly<Record<string, MagazineApiKind>> = {
  bjt: "bjt_phrase",
  magazine_bjt_phrase: "bjt_phrase",
  magazine_vocab: "vocab",
  magazine_weather: "weather",
  magazine_horoscope: "horoscope",
  magazine_loto: "loto",
  magazine_loto6: "loto",
  magazine_loto7: "loto",
};

export function normalizeMagazineKind(raw?: string | null): string {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  if (!trimmed || trimmed === "all") return "all";
  if (CANONICAL_KIND_SET.has(trimmed)) return trimmed;
  return MAGAZINE_KIND_ALIASES[trimmed] ?? trimmed;
}

export function buildMagazineHref(locale: string, kind: string, page?: number): string {
  const normalizedKind = normalizeMagazineKind(kind);
  const params = new URLSearchParams();
  if (normalizedKind !== "all") params.set("kind", normalizedKind);
  if (page !== undefined && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/${locale}/magazine?${qs}` : `/${locale}/magazine`;
}
