import { supportedLocales, type SupportedLocale } from "@nihongo-bjt/config";
import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "../lib/site-url";

type PublicRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: "", changeFrequency: "daily", priority: 1.0 },
  { path: "levels", changeFrequency: "weekly", priority: 0.9 },
  { path: "dictionary", changeFrequency: "weekly", priority: 0.8 },
  { path: "kanji", changeFrequency: "weekly", priority: 0.8 },
  { path: "grammar", changeFrequency: "weekly", priority: 0.8 },
  { path: "flashcards", changeFrequency: "weekly", priority: 0.8 },
  { path: "quiz", changeFrequency: "weekly", priority: 0.8 },
  { path: "exercises", changeFrequency: "weekly", priority: 0.8 },
  { path: "news", changeFrequency: "daily", priority: 0.8 },
  { path: "pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "help", changeFrequency: "monthly", priority: 0.6 },
  { path: "feedback", changeFrequency: "monthly", priority: 0.5 },
  { path: "privacy", changeFrequency: "monthly", priority: 0.4 },
  { path: "terms", changeFrequency: "monthly", priority: 0.4 },
];

function buildRouteUrl(baseUrl: string, locale: SupportedLocale, routePath: string): string {
  return routePath ? `${baseUrl}/${locale}/${routePath}` : `${baseUrl}/${locale}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteBaseUrl();

  return PUBLIC_ROUTES.flatMap((route) => {
    const languages = Object.fromEntries(
      supportedLocales.map((loc) => [loc, buildRouteUrl(baseUrl, loc, route.path)]),
    ) as Record<SupportedLocale, string>;

    return supportedLocales.map((locale) => ({
      url: buildRouteUrl(baseUrl, locale, route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages },
    }));
  });
}
