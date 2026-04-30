import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getKcAdminBootstrap, getKcWebConfig } from "@/lib/kc-server-config";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RegisterFormClient } from "./_components/register-form-client";

const messages = { ja, vi };

export async function generateMetadata({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? (locale as "ja" | "vi") : "vi";
  const t = messages[loc].auth.register;
  return {
    robots: { index: false },
    title: t.metaTitle
  };
}

export default async function RegisterPage({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}>) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const loc = locale as "ja" | "vi";
  const t = messages[loc].auth.register;
  const nav = messages[loc].nav;
  const cfg = getKcWebConfig();
  const authReady = Boolean(cfg?.clientSecret && getKcAdminBootstrap());
  const returnTo =
    sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//")
      ? sp.returnTo
      : `/${locale}`;
  const localePrefix = `/${locale}`;

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[420px] flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-ink">{nav.brand}</p>
        <p className="mt-1 text-xs font-medium text-muted">{t.brandTagline}</p>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="text-sm leading-relaxed text-muted">{t.subtitle}</p>
      </div>

      <div className="mt-8 rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <RegisterFormClient
          authReady={authReady}
          copy={{
            authDisabledHint: t.authDisabledHint,
            confirmPasswordLabel: t.confirmPasswordLabel,
            confirmPasswordPlaceholder: t.confirmPasswordPlaceholder,
            emailLabel: t.emailLabel,
            emailPlaceholder: t.emailPlaceholder,
            genericFormError: messages[loc].auth.errors.generic,
            loginCta: t.loginCta,
            loginLead: t.loginLead,
            passwordLabel: t.passwordLabel,
            passwordPlaceholder: t.passwordPlaceholder,
            passwordsMismatch: t.passwordsMismatch,
            primaryCta: t.primaryCta,
            registrationFailed: t.registrationFailed,
            registrationUnavailable: t.registrationUnavailable,
            submitting: t.submitting,
            userExists: t.userExists,
            usernameLabel: t.usernameLabel,
            usernamePlaceholder: t.usernamePlaceholder
          }}
          localePrefix={localePrefix}
          returnTo={returnTo}
        />
        {authReady ? (
          <p className="mt-4 text-center text-xs leading-snug text-muted">{t.hint}</p>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link className="font-medium text-ink underline-offset-4 hover:underline" href={localePrefix}>
          {t.backHome}
        </Link>
      </p>
    </main>
  );
}
