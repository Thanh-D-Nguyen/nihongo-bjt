import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { userFacingAuthError } from "@/lib/auth-error-message";
import { getKcWebConfig } from "@/lib/kc-server-config";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { BrandFull } from "../../_components/brand-logo";
import { AuthHeroLayout } from "../_components/auth-hero-layout";
import { LoginFormClient } from "./_components/login-form-client";

const messages = { ja, vi, en };

const LOCALE_LABELS: Record<string, string> = { vi: "Tiếng Việt", ja: "日本語", en: "English" };

export async function generateMetadata({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
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
  const loc = locale as keyof typeof messages;
  const t = messages[loc].auth.login;
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

  // Social login feature flags — server-side gated
  const showGoogle = Boolean(process.env.NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT?.trim());
  const showFacebook = Boolean(process.env.NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT?.trim());
  const showApple = Boolean(process.env.NEXT_PUBLIC_AUTH_APPLE_IDP_HINT?.trim());
  const showLine = Boolean(process.env.NEXT_PUBLIC_AUTH_LINE_IDP_HINT?.trim());

  // Locale switcher query
  const localeQuery = new URLSearchParams();
  if (sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//")) {
    localeQuery.set("returnTo", sp.returnTo);
  }
  const localeQs = localeQuery.toString();

  return (
    <AuthHeroLayout locale={locale}>
      {/* Brand — mobile only */}
      <div className="mb-8 text-center lg:hidden">
        <Link href={localePrefix} className="inline-flex justify-center no-underline">
          <BrandFull markSize={36} />
        </Link>
        <p className="mt-1 text-xs font-medium text-muted">{t.brandTagline}</p>
      </div>

      {/* Tab switcher: Log in / Sign up */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-full border border-ink/10 bg-paper p-1">
        <span className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          {t.primaryCta}
        </span>
        {showRegister ? (
          <Link
            className="rounded-full px-5 py-2 text-sm font-medium text-muted no-underline transition hover:text-ink"
            href={`${localePrefix}/register`}
          >
            {messages[loc].auth.register.primaryCta}
          </Link>
        ) : null}
      </div>

      {/* Locale switcher */}
      <nav
        aria-label="Language"
        className="mb-6 flex justify-center"
      >
        <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface/70 p-1">
          {(["vi", "ja"] as const).map((code) => {
            const isActive = code === loc;
            const href = `/${code}/login${localeQs ? `?${localeQs}` : ""}`;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper no-underline"
                    : "rounded-full px-3 py-1 text-xs font-medium text-muted no-underline transition hover:text-ink"
                }
                href={href}
                key={code}
                lang={code}
              >
                {LOCALE_LABELS[code]}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Heading */}
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t.subtitle}</p>
      </div>

      {err ? (
        <div
          aria-live="polite"
          className="mb-4 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-sm text-red-800"
          role="alert"
        >
          {err}
        </div>
      ) : null}

      {/* Login form */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <LoginFormClient
          authReady={authReady}
          copy={{
            authDisabledHint: t.authDisabledHint,
            continueApple: t.continueApple,
            continueFacebook: t.continueFacebook,
            continueGoogle: t.continueGoogle,
            continueLine: t.continueLine,
            divider: t.divider,
            errorAuthMethodNotAllowed: t.errorAuthMethodNotAllowed,
            errorClientMisconfigured: t.errorClientMisconfigured,
            errorInvalidScope: t.errorInvalidScope,
            errorLoginFailed: t.errorLoginFailed,
            errorNotConfigured: messages[loc].auth.errors.configuration,
            forgotPassword: t.forgotPassword,
            genericFormError: messages[loc].auth.errors.generic,
            passwordLabel: t.passwordLabel,
            passwordPlaceholder: t.passwordPlaceholder,
            primaryCta: t.primaryCta,
            privacyLink: t.privacyLink,
            submitting: t.submitting,
            termsAnd: t.termsAnd,
            termsLink: t.termsLink,
            termsNotice: t.termsNotice,
            usernameLabel: t.usernameLabel,
            usernamePlaceholder: t.usernamePlaceholder,
            validationError: t.validationError,
            wrongCredentials: t.wrongCredentials
          }}
          locale={locale}
          returnTo={returnTo}
          showApple={showApple}
          showFacebook={showFacebook}
          showGoogle={showGoogle}
          showLine={showLine}
        />
      </div>

      {/* Footer links */}
      <div className="mt-6 text-center text-sm text-muted">
        <Link
          className="font-medium text-ink underline-offset-4 hover:underline"
          href={localePrefix}
        >
          {t.backHome}
        </Link>
      </div>
    </AuthHeroLayout>
  );
}
