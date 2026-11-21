import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/onboarding"],
      },
    ],
    sitemap: `${getSiteBaseUrl()}/sitemap.xml`,
  };
}
