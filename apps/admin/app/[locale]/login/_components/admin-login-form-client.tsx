"use client";

import { type FormEvent, type KeyboardEvent, useCallback, useState } from "react";

export type AdminLoginFormCopy = {
  authDisabledHint: string;
  capsLockOn: string;
  errorAuthMethodNotAllowed: string;
  errorClientMisconfigured: string;
  errorInvalidScope: string;
  errorLoginFailed: string;
  errorNotConfigured: string;
  genericFormError: string;
  passwordHide: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordShow: string;
  primaryCta: string;
  signingIn: string;
  submitting: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  validationError: string;
  wrongCredentials: string;
};

const ERROR_REGION_ID = "admin-login-error";

function mapErrorCode(code: string | undefined, copy: AdminLoginFormCopy): string {
  switch (code) {
    case "invalid_credentials":
      return copy.wrongCredentials;
    case "auth_method_not_allowed":
      return copy.errorAuthMethodNotAllowed;
    case "client_misconfigured":
      return copy.errorClientMisconfigured;
    case "not_configured":
      return copy.errorNotConfigured;
    case "invalid_scope":
      return copy.errorInvalidScope;
    case "validation":
    case "bad_request":
      return copy.validationError;
    case "login_failed":
      return copy.errorLoginFailed;
    default:
      return copy.genericFormError;
  }
}

export function AdminLoginFormClient({
  authReady,
  copy,
  defaultUsername = "",
  initialServerError = null,
  locale,
  returnTo
}: {
  authReady: boolean;
  copy: AdminLoginFormCopy;
  defaultUsername?: string;
  initialServerError?: string | null;
  locale: string;
  returnTo: string;
}) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  // initialServerError is rendered above the form by the server; we still keep
  // a local error slot for in-page (XHR) submission failures so the user does
  // not see two banners at once.
  const [clientError, setClientError] = useState<string | null>(null);

  const error = clientError ?? initialServerError;
  const hasError = Boolean(error);

  const handleCapsLock = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    // getModifierState is only meaningful when an actual key event has fired.
    // We update on both keydown and keyup so toggling Caps Lock without typing
    // still flips the indicator.
    setCapsLock(event.getModifierState("CapsLock"));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/keycloak/password-login", {
        body: JSON.stringify({ password, username }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setClientError(mapErrorCode(data.error, copy));
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setClientError(copy.genericFormError);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm text-ink outline-none ring-ink/20 transition focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-ink/30";
  const fieldErrorClass =
    "mt-1 w-full rounded-xl border border-red-300 bg-surface px-3 py-2.5 text-sm text-ink outline-none ring-red-200 transition focus-visible:ring-2 focus-visible:ring-red-300";

  if (!authReady) {
    return (
      <>
        <button
          aria-describedby="admin-login-auth-unavailable"
          className="flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-ink/10 bg-ink/40 px-4 py-3 text-sm font-semibold text-paper/90 opacity-90"
          disabled
          type="button"
        >
          {copy.primaryCta}
        </button>
        <p
          className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm leading-relaxed text-amber-950"
          id="admin-login-auth-unavailable"
          role="status"
        >
          {copy.authDisabledHint}
        </p>
      </>
    );
  }

  return (
    <form
      action="/api/auth/keycloak/password-login"
      className="flex flex-col gap-4"
      method="post"
      noValidate
      onSubmit={onSubmit}
    >
      {/* Hidden inputs preserve the no-JS form-fallback contract that Task A relies on. */}
      <input name="returnTo" type="hidden" value={returnTo} />
      <input name="locale" type="hidden" value={locale} />

      <div>
        <label className="text-sm font-medium text-ink" htmlFor="admin-login-username">
          {copy.usernameLabel}
        </label>
        <input
          aria-describedby={hasError ? ERROR_REGION_ID : undefined}
          aria-invalid={hasError || undefined}
          autoCapitalize="off"
          autoComplete="username"
          autoCorrect="off"
          className={hasError ? fieldErrorClass : fieldClass}
          id="admin-login-username"
          inputMode="email"
          name="username"
          onChange={(ev) => setUsername(ev.target.value)}
          placeholder={copy.usernamePlaceholder}
          required
          spellCheck={false}
          type="text"
          value={username}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink" htmlFor="admin-login-password">
            {copy.passwordLabel}
          </label>
          <button
            aria-controls="admin-login-password"
            aria-label={showPassword ? copy.passwordHide : copy.passwordShow}
            aria-pressed={showPassword}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            <span aria-hidden>{showPassword ? copy.passwordHide : copy.passwordShow}</span>
            <span className="sr-only">{showPassword ? copy.passwordHide : copy.passwordShow}</span>
          </button>
        </div>
        <input
          aria-describedby={hasError ? ERROR_REGION_ID : undefined}
          aria-invalid={hasError || undefined}
          autoComplete="current-password"
          className={hasError ? fieldErrorClass : fieldClass}
          id="admin-login-password"
          name="password"
          onChange={(ev) => setPassword(ev.target.value)}
          onKeyDown={handleCapsLock}
          onKeyUp={handleCapsLock}
          placeholder={copy.passwordPlaceholder}
          required
          spellCheck={false}
          type={showPassword ? "text" : "password"}
          value={password}
        />
        {capsLock ? (
          <p
            aria-live="polite"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700"
            data-testid="admin-login-capslock-hint"
            role="status"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            {copy.capsLockOn}
          </p>
        ) : null}
      </div>

      {clientError ? (
        // Server-rendered errors live in the page; this banner is only for
        // failures from the in-page XHR submit, so we never render two at once.
        <p
          className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800"
          id={ERROR_REGION_ID}
          role="alert"
        >
          {clientError}
        </p>
      ) : null}

      <button
        aria-busy={loading}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? (
          <>
            <svg
              aria-hidden
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-30"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-90"
                d="M22 12a10 10 0 0 1-10 10"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
            <span>{copy.signingIn}</span>
          </>
        ) : (
          <span>{copy.primaryCta}</span>
        )}
      </button>
    </form>
  );
}
