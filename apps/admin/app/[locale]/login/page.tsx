import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { userFacingAuthError } from "@/lib/auth-error-message";

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

/**
 * Validates that a returnTo path is safe (same-origin relative path).
 * Mirrors the previous safeReturnToPath from kc-cookies but without the
 * Keycloak dependency.
 */
function safeReturnToPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  // Only allow relative paths starting with /
  if (!raw.startsWith("/")) return fallback;
  // Reject protocol-relative URLs (//evil.com)
  if (raw.startsWith("//")) return fallback;
  // Reject paths with encoded slashes or traversal
  if (raw.includes("..")) return fallback;
  return raw;
}

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

  // Go-native auth is always ready (no external IdP config needed).
  const authReady = true;

  const errMapped = userFacingAuthError(sp.authError, errorsCopy);
  const err = errMapped;

  // Validate returnTo for safe redirect after login.
  const returnTo = safeReturnToPath(sp.returnTo ?? null, `/${locale}`);

  // Username preserved across the no-JS form-fallback round trip.
  const defaultUsername =
    typeof sp.u === "string" && sp.u.length > 0 && sp.u.length <= 256 ? sp.u : "";

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
                      : "rounded-sm px-2.5 py-1.5 text-xs font-medium text-muted no-underline transition hover:text-ink"
                  }
                  href={href}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <section className="mt-auto flex w-full flex-col items-center justify-center pb-8">
          <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <h1 className="text-lg font-semibold tracking-tight text-ink">{t.title}</h1>
            <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

            {err ? (
              <div
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap break-words"
                role="alert"
              >
                {err}
              </div>
            ) : null}

            <div className="mt-5">
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
                initialServerError={err}
                locale={locale}
                returnTo={returnTo}
              />
            </div>

            <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted lg:hidden">
              {t.hint}
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}