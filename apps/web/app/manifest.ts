import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fafafa",
    description: "BJT and daily Japanese learning",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "512x512",
        src: "/pwa-icon.svg",
        type: "image/svg+xml"
      }
    ],
    name: "KotobaWorks",
    short_name: "KotobaWorks",
    start_url: "/",
    theme_color: "#0f172a"
  };
}
