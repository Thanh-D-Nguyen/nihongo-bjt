import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "BJT and daily Japanese learning platform",
  icons: [{ rel: "icon", type: "image/svg+xml", url: "/pwa-icon.svg" }],
  title: "NihonGo BJT"
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#0f172a",
  width: "device-width"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
