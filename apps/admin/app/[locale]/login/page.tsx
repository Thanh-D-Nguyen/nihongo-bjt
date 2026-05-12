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
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">{messages[loc].shell.brand}</p>
            <p className="mt-0.5 text-xs font-medium text-muted">{t.brandTagline}</p>
          </div>

          <nav
            aria-label={t.localeSwitch}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-sm"
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
                      ? "rounded-sm bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper no-underline"
                      : "rounded-sm px-2.5 py-1.5 text-xs font-medium text-muted no-underline transition hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,440px)] lg:gap-12">
          <aside className="hidden lg:block" aria-hidden="true">
            <div className="max-w-xl">
              <div className="mb-8 h-px w-24 bg-accent" />
              <p className="text-xs font-semibold uppercase text-muted">{t.eyebrow}</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-ink">
                {t.title}
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-muted">{t.subtitle}</p>
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[440px] rounded-lg border border-border bg-surface p-6 shadow-md sm:p-7">
            <div className="mb-6 lg:hidden">
              <p className="text-xs font-semibold uppercase text-muted">{t.eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-normal text-ink">
                {t.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">{t.subtitle}</p>
            </div>
            <div className="mb-6 hidden lg:block">
              <h2 className="text-xl font-semibold leading-tight tracking-normal text-ink">
                {t.primaryCta}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t.hint}</p>
            </div>

            {err ? (
              <div
                aria-live="polite"
                className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap break-words"
                id="admin-login-server-error"
                role="alert"
              >
                {err}
              </div>
            ) : null}

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
                  <span className="relative z-10 bg-surface px-2">{t.divider}</span>
                  <span aria-hidden className="absolute inset-x-0 top-1/2 z-0 h-px bg-border" />
                </div>
                {showGoogle ? (
                  <a
                    className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink no-underline transition hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    href={googleHref}
                  >
                    {t.continueGoogle}
                  </a>
                ) : null}
                {showApple ? (
                  <a
                    className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink no-underline transition hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    href={appleHref}
                  >
                    {t.continueApple}
                  </a>
                ) : null}
              </div>
            ) : null}

            {authReady ? (
              <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted lg:hidden">
                {t.hint}
              </p>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
