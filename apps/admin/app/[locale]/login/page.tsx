import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { userFacingAuthError } from "@/lib/auth-error-message";
import { safeReturnToPath } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminLoginFormClient } from "./_components/admin-login-form-client";

const messages = { en, ja, vi } as const;
type LoginLocale = keyof typeof messages;

const LOGIN_LOCALES = ["vi", "ja", "en"] as const;
function isLoginLocale(value: string): value is LoginLocale {
  return (LOGIN_LOCALES as readonly string[]).includes(value);
}

export async function generateMetadata({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): Promise<Metadata> {
  const { locale } = await params;
  const loc: LoginLocale = isLoginLocale(locale) ? locale : "vi";
  const t = messages[loc].auth.login;
  return {
    robots: { index: false },
    title: t.metaTitle
  };
}

const LOCALE_LABEL_KEYS: Record<LoginLocale, "localeSwitchVi" | "localeSwitchJa" | "localeSwitchEn"> = {
  vi: "localeSwitchVi",
  ja: "localeSwitchJa",
  en: "localeSwitchEn"
};

export default async function AdminLoginPage({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ authError?: string; returnTo?: string; u?: string }>;
}>) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLoginLocale(locale)) {
    notFound();
  }
  const loc: LoginLocale = locale;
  const t = messages[loc].auth.login;
  const errorsCopy = messages[loc].auth.errors;

  const cfg = getKcAdminConfig();
  const authReady = Boolean(cfg?.clientSecret);

  const errMapped = userFacingAuthError(sp.authError, errorsCopy);
  // When auth is not configured we surface a separate "authDisabledHint" inside
  // the form instead of a redundant top-banner not_configured message.
  const err = !authReady && sp.authError === "not_configured" ? null : errMapped;

  // Validate returnTo using the same helper that the OAuth/password-login routes
  // rely on, so the login screen and post-login redirect agree on what is safe.
  const returnTo = safeReturnToPath(sp.returnTo ?? null, `/${locale}`);

  // Username preserved across the no-JS form-fallback round trip. Only render
  // it back when the request itself reported an error, so a successful login
  // never echoes the value into the URL on subsequent visits.
  const defaultUsername =
    typeof sp.u === "string" && sp.u.length > 0 && sp.u.length <= 256 ? sp.u : "";

  // Server-side-gated social providers: only render when the deployment has
  // explicitly configured an IdP hint. We never expose buttons for providers
  // that Keycloak cannot route.
  const showGoogle = Boolean(process.env.NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT?.trim());
  const showApple = Boolean(process.env.NEXT_PUBLIC_AUTH_APPLE_IDP_HINT?.trim());
  const showSocialDivider = authReady && (showGoogle || showApple);

  const authorizeQuery = new URLSearchParams({ locale, returnTo });
  const baseAuthorize = `/api/auth/keycloak/authorize?${authorizeQuery.toString()}`;
  const googleHref = `${baseAuthorize}&idp=google`;
  const appleHref = `${baseAuthorize}&idp=apple`;

  // Locale switcher preserves returnTo so a deep link survives a language change.
  const localeQuery = new URLSearchParams();
  if (sp.returnTo && safeReturnToPath(sp.returnTo, "") === sp.returnTo) {
    localeQuery.set("returnTo", sp.returnTo);
  }
  const localeQs = localeQuery.toString();

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 py-10 sm:py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold tracking-tight text-ink">{messages[loc].shell.brand}</p>
        <p className="text-xs font-medium text-muted">{t.brandTagline}</p>

        <nav
          aria-label={t.localeSwitch}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface/70 p-1"
        >
          {LOGIN_LOCALES.map((code) => {
            const isActive = code === loc;
            const labelKey = LOCALE_LABEL_KEYS[code];
            const label = t[labelKey];
            const href = `/${code}/login${localeQs ? `?${localeQs}` : ""}`;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper no-underline"
                    : "rounded-full px-3 py-1 text-xs font-medium text-muted no-underline transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                }
                href={href}
                key={code}
                lang={code}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="mt-10 flex flex-1 flex-col justify-center">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.6875rem]">
            {t.title}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{t.subtitle}</p>
        </div>

        {err ? (
          <div
            aria-live="polite"
            className="mt-6 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap break-words"
            id="admin-login-server-error"
            role="alert"
          >
            {err}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-ink/10 bg-paper p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
          <AdminLoginFormClient
            authReady={authReady}
            copy={{
              authDisabledHint: t.authDisabledHint,
              capsLockOn: t.capsLockOn,
              errorAuthMethodNotAllowed: t.errorAuthMethodNotAllowed,
              errorClientMisconfigured: t.errorClientMisconfigured,
              errorInvalidScope: t.errorInvalidScope,
              errorLoginFailed: t.errorLoginFailed,
              errorNotConfigured: errorsCopy.configuration,
              genericFormError: errorsCopy.generic,
              passwordHide: t.passwordHide,
              passwordLabel: t.passwordLabel,
              passwordPlaceholder: t.passwordPlaceholder,
              passwordShow: t.passwordShow,
              primaryCta: t.primaryCta,
              signingIn: t.signingIn,
              submitting: t.submitting,
              usernameLabel: t.usernameLabel,
              usernamePlaceholder: t.usernamePlaceholder,
              validationError: t.validationError,
              wrongCredentials: t.wrongCredentials
            }}
            defaultUsername={defaultUsername}
            // The server already rendered the mapped error above; passing it
            // here lets the client wire aria-invalid/aria-describedby on the
            // first paint without an extra client round trip.
            initialServerError={err}
            locale={locale}
            returnTo={returnTo}
          />

          {showSocialDivider ? (
            <div className="mt-5 flex flex-col gap-3">
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
            </div>
          ) : null}

          {authReady ? (
            <p className="mt-6 text-center text-xs leading-snug text-muted">{t.hint}</p>
          ) : null}
        </div>
      </section>

      <footer className="mt-10 text-center text-sm text-muted">
        <Link
          className="font-medium text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          href={`/${isLoginLocale(locale) && locale !== "en" ? locale : "vi"}`}
        >
          {t.backHome}
        </Link>
      </footer>
    </main>
  );
}
