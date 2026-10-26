"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";

export function NotFoundClient() {
  const segment = usePathname()?.split("/")[1];
  const locale = segment === "ja" || segment === "en" ? segment : "vi";
  const messages = { vi, ja, en }[locale];
  const t = messages.systemPages;
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-border px-4 py-4">
        <Link className="inline-flex min-h-12 items-center font-bold" href={`/${locale}`}>{messages.nav.brand}</Link>
      </header>
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-5xl font-bold">404</p>
        <h1 className="mt-4 text-2xl font-bold">{t.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.notFoundDescription}</p>
        <Link className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-action px-5 py-2.5 text-sm font-medium text-white hover:bg-action-hover" href={`/${locale}`}>{t.home}</Link>
      </main>
      <footer className="flex justify-center gap-6 border-t border-border px-4 py-4 text-sm text-muted">
        <Link className="inline-flex min-h-12 items-center" href={`/${locale}/help`}>{messages.nav.footerHelp}</Link>
        <Link className="inline-flex min-h-12 items-center" href={`/${locale}/privacy`}>{messages.nav.footerPrivacy}</Link>
      </footer>
    </div>
  );
}
