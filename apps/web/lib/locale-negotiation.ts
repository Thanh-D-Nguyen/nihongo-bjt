import { defaultLocale, isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";

/**
 * Chooses the learner locale from an Accept-Language header.
 * Languages are ranked by quality value, then by their position in the header.
 * Falls back to the default locale when no requested language is supported.
 */
export function negotiateLocale(acceptLanguage: string | null): SupportedLocale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const ranked = acceptLanguage.split(",").flatMap((entry, position) => {
    const [tag = "", ...params] = entry.trim().split(";");
    const language = tag.trim().toLowerCase().split("-")[0] ?? "";
    const quality = parseQuality(params);
    if (!isSupportedLocale(language) || quality <= 0) {
      return [];
    }
    return [{ locale: language, quality, position }];
  });

  ranked.sort((a, b) => b.quality - a.quality || a.position - b.position);

  return ranked[0]?.locale ?? defaultLocale;
}

/** RFC 9110 qvalue: 0 to 1 with at most three decimal places. */
const QUALITY_VALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

function parseQuality(params: string[]): number {
  const qualityParam = params.map((param) => param.trim()).find((param) => /^q\b/i.test(param));
  if (!qualityParam) {
    return 1;
  }
  const match = /^q=(.+)$/i.exec(qualityParam);
  return match && QUALITY_VALUE.test(match[1]) ? Number(match[1]) : 0;
}
