import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getKcAdminBootstrap, getKcWebConfig } from "@/lib/kc-server-config";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AuthHeroLayout } from "../_components/auth-hero-layout";
import { RegisterFormClient } from "./_components/register-form-client";

const messages = { ja, vi };

const LOCALE_LABELS: Record<string, string> = { vi: "Tiếng Việt", ja: "日本語" };

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
  const loginT = messages[loc].auth.login;
  const cfg = getKcWebConfig();
  const authReady = Boolean(cfg?.clientSecret && getKcAdminBootstrap());
  const returnTo =
    sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//")
      ? sp.returnTo
      : `/${locale}`;
  const localePrefix = `/${locale}`;

  // Social login feature flags
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
        <Link href={localePrefix} className="no-underline">
          <p className="text-xl font-bold tracking-tight text-ink">
            {messages[loc].nav.brand}
          </p>
        </Link>
        <p className="mt-1 text-xs font-medium text-muted">{t.brandTagline}</p>
      </div>

      {/* Tab switcher: Log in / Sign up */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-full border border-ink/10 bg-paper p-1">
        <Link
          className="rounded-full px-5 py-2 text-sm font-medium text-muted no-underline transition hover:text-ink"
          href={`${localePrefix}/login`}
        >
          {loginT.primaryCta}
        </Link>
        <span className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          {t.primaryCta}
        </span>
      </div>

      {/* Locale switcher */}
      <nav aria-label="Language" className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface/70 p-1">
          {(["vi", "ja"] as const).map((code) => {
            const isActive = code === loc;
            const href = `/${code}/register${localeQs ? `?${localeQs}` : ""}`;
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

      {/* Register form */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <RegisterFormClient
          authReady={authReady}
          copy={{
            authDisabledHint: t.authDisabledHint,
            confirmPasswordLabel: t.confirmPasswordLabel,
            confirmPasswordPlaceholder: t.confirmPasswordPlaceholder,
            continueApple: loginT.continueApple,
            continueFacebook: loginT.continueFacebook,
            continueGoogle: loginT.continueGoogle,
            continueLine: loginT.continueLine,
            divider: loginT.divider,
            emailLabel: t.emailLabel,
            emailPlaceholder: t.emailPlaceholder,
            genericFormError: messages[loc].auth.errors.generic,
            invalidEmail: t.invalidEmail,
            invalidUsername: t.invalidUsername,
            loginCta: t.loginCta,
            loginLead: t.loginLead,
            passwordLabel: t.passwordLabel,
            passwordPlaceholder: t.passwordPlaceholder,
            passwordsMismatch: t.passwordsMismatch,
            passwordTooShort: t.passwordTooShort,
            primaryCta: t.primaryCta,
            privacyLink: loginT.privacyLink,
            registrationFailed: t.registrationFailed,
            registrationUnavailable: t.registrationUnavailable,
            submitting: t.submitting,
            termsAnd: loginT.termsAnd,
            termsLink: loginT.termsLink,
            termsNotice: loginT.termsNotice,
            userExists: t.userExists,
            usernameLabel: t.usernameLabel,
            usernamePlaceholder: t.usernamePlaceholder
          }}
          locale={locale}
          localePrefix={localePrefix}
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
