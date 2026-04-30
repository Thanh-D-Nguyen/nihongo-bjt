import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { userFacingAuthError } from "@/lib/auth-error-message";
import { getKcAdminConfig } from "@/lib/kc-server-config";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminLoginFormClient } from "./_components/admin-login-form-client";

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

export default async function AdminLoginPage({
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
  const shell = messages[loc].shell;
  const cfg = getKcAdminConfig();
  const authReady = Boolean(cfg?.clientSecret);
  const errMapped = userFacingAuthError(sp.authError, messages[loc].auth.errors);
  const err = !authReady && sp.authError === "not_configured" ? null : errMapped;
  const returnTo =
    sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//")
      ? sp.returnTo
      : `/${locale}`;
  const q = new URLSearchParams({ locale, returnTo });
  const baseAuthorize = `/api/auth/keycloak/authorize?${q.toString()}`;
  const googleHref = `${baseAuthorize}&idp=google`;
  const appleHref = `${baseAuthorize}&idp=apple`;
  const showGoogle = Boolean(process.env.NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT?.trim());
  const showApple = Boolean(process.env.NEXT_PUBLIC_AUTH_APPLE_IDP_HINT?.trim());
  const showSocialDivider = showGoogle || showApple;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-ink">{shell.brand}</p>
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

      <div className="mt-8 rounded-2xl border border-ink/10 bg-paper p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <AdminLoginFormClient
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

        {authReady ? (
          <div className="mt-3 flex flex-col gap-3">
            {showSocialDivider ? (
              <>
                <div className="relative py-1 text-center text-xs text-muted">
                  <span className="relative z-10 bg-paper px-2">{t.divider}</span>
                  <span aria-hidden className="absolute inset-x-0 top-1/2 z-0 h-px bg-ink/10" />
                </div>
                {showGoogle ? (
                  <a
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm font-semibold text-ink no-underline transition hover:bg-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    href={googleHref}
                  >
                    {t.continueGoogle}
                  </a>
                ) : null}
                {showApple ? (
                  <a
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm font-semibold text-ink no-underline transition hover:bg-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    href={appleHref}
                  >
                    {t.continueApple}
                  </a>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {authReady ? (
          <p className="mt-6 text-center text-xs leading-snug text-muted">{t.hint}</p>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link
          className="font-medium text-ink underline-offset-4 hover:underline"
          href={`/${locale}`}
        >
          {t.backHome}
        </Link>
      </p>
    </main>
  );
}
