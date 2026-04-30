import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "BJT and daily Japanese learning platform",
  title: "NihonGo BJT"
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
