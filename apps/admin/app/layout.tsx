import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "KotobaWorks administration shell",
  icons: [{ rel: "icon", type: "image/svg+xml", url: "/pwa-icon.svg" }],
  title: "KotobaWorks Admin"
};

/**
 * Root layout wraps all routes (including `/` → redirect to `/vi`).
 * Locale layout must not nest `<html>` / `<body>` (invalid DOM, dev quirks).
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
