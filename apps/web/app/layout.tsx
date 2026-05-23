import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Inline blocking script to apply theme class BEFORE first paint.
 * Prevents Flash of Unstyled Content (FOUC) on dark mode.
 * Reads from localStorage (fast cache) and applies immediately.
 */
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('nihongo-appearance');
    var t = s ? JSON.parse(s).theme : 'system';
    var d = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (d) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
  } catch(e) {}
})();
`;

export const metadata: Metadata = {
  description: "BJT and daily Japanese learning platform",
  icons: [{ rel: "icon", type: "image/svg+xml", url: "/pwa-icon.svg" }],
  title: "NihonGo BJT"
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: [
    { color: "#F8FAFC", media: "(prefers-color-scheme: light)" },
    { color: "#0f172a", media: "(prefers-color-scheme: dark)" }
  ],
  width: "device-width"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
