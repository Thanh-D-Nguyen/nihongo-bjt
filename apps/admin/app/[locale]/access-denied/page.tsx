import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { ja, vi };

export const metadata: Metadata = {
  robots: { index: false },
  title: "Access denied — NihonGo BJT Admin"
};

export default async function AdminAccessDeniedPage({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const loc = locale as "ja" | "vi";
  const t = messages[loc].auth.accessDenied;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="text-sm leading-relaxed text-muted">{t.body}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-paper p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <a
          className="flex w-full items-center justify-center rounded-xl border border-ink/15 bg-transparent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-ink/5"
          href="/auth/logout"
        >
          {t.signOut}
        </a>
        <p className="text-center text-xs text-muted">
          <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/${locale}`}>
            {t.backHome}
          </Link>
        </p>
      </div>
    </div>
  );
}
