import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { userFacingAuthError } from "@/lib/auth-error-message";
import { getKcWebConfig } from "@/lib/kc-server-config";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { LoginFormClient } from "./_components/login-form-client";

const messages = { ja, vi };

export async function generateMetadata({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? (locale as "ja" | "vi") : "vi";
  const t = messages[loc].auth.login;
  return {
    robots: { index: false },
    title: t.metaTitle
  };
}

export default async function LoginPage({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ authError?: string; returnTo?: string }>;
}>) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const loc = locale as "ja" | "vi";
  const t = messages[loc].auth.login;
  const nav = messages[loc].nav;
  const cfg = getKcWebConfig();
  const authReady = Boolean(cfg?.clientSecret);
  const errMapped = userFacingAuthError(sp.authError, messages[loc].auth.errors);
  const err =
    !authReady && sp.authError === "not_configured" ? null : errMapped;
  const returnTo =
    sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//")
      ? sp.returnTo
      : `/${locale}`;
  const localePrefix = `/${locale}`;
  const showRegister = process.env.NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED !== "false";

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
        {err ? (
          <p
            className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {err}
          </p>
        ) : null}
      </div>

      <div className="mt-8 rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <LoginFormClient
          authReady={authReady}
          copy={{
            authDisabledHint: t.authDisabledHint,
            errorAuthMethodNotAllowed: t.errorAuthMethodNotAllowed,
            errorClientMisconfigured: t.errorClientMisconfigured,
            errorInvalidScope: t.errorInvalidScope,
            errorLoginFailed: t.errorLoginFailed,
            errorNotConfigured: messages[loc].auth.errors.configuration,
            genericFormError: messages[loc].auth.errors.generic,
            passwordLabel: t.passwordLabel,
            passwordPlaceholder: t.passwordPlaceholder,
            primaryCta: t.primaryCta,
            submitting: t.submitting,
            usernameLabel: t.usernameLabel,
            usernamePlaceholder: t.usernamePlaceholder,
            validationError: t.validationError,
            wrongCredentials: t.wrongCredentials
          }}
          returnTo={returnTo}
        />

        {showRegister ? (
          <p className="mt-6 text-center text-sm text-muted">
            <span>{t.registerLead} </span>
            <Link
              className="font-semibold text-ink underline-offset-4 hover:underline"
              href={`${localePrefix}/register`}
            >
              {t.registerCta}
            </Link>
          </p>
        ) : null}

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
