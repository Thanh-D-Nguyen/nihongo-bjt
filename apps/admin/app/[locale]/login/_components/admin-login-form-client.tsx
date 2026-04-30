"use client";

import { type FormEvent, useState } from "react";

export type AdminLoginFormCopy = {
  authDisabledHint: string;
  errorAuthMethodNotAllowed: string;
  errorClientMisconfigured: string;
  errorInvalidScope: string;
  errorLoginFailed: string;
  errorNotConfigured: string;
  genericFormError: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  primaryCta: string;
  submitting: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  validationError: string;
  wrongCredentials: string;
};

export function AdminLoginFormClient({
  authReady,
  copy,
  returnTo
}: {
  authReady: boolean;
  copy: AdminLoginFormCopy;
  returnTo: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
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
        const code = data.error;
        if (code === "invalid_credentials") {
          setError(copy.wrongCredentials);
        } else if (code === "auth_method_not_allowed") {
          setError(copy.errorAuthMethodNotAllowed);
        } else if (code === "client_misconfigured") {
          setError(copy.errorClientMisconfigured);
        } else if (code === "not_configured") {
          setError(copy.errorNotConfigured);
        } else if (code === "invalid_scope") {
          setError(copy.errorInvalidScope);
        } else if (code === "validation" || code === "bad_request") {
          setError(copy.validationError);
        } else if (code === "login_failed") {
          setError(copy.errorLoginFailed);
        } else {
          setError(copy.genericFormError);
        }
        return;
      }
      window.location.assign(returnTo);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm text-ink outline-none ring-ink/20 focus-visible:ring-2";

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
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="admin-login-username">
          {copy.usernameLabel}
        </label>
        <input
          autoComplete="username"
          className={fieldClass}
          id="admin-login-username"
          name="username"
          onChange={(ev) => setUsername(ev.target.value)}
          placeholder={copy.usernamePlaceholder}
          required
          type="text"
          value={username}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="admin-login-password">
          {copy.passwordLabel}
        </label>
        <input
          autoComplete="current-password"
          className={fieldClass}
          id="admin-login-password"
          name="password"
          onChange={(ev) => setPassword(ev.target.value)}
          placeholder={copy.passwordPlaceholder}
          required
          type="password"
          value={password}
        />
      </div>
      {error ? (
        <p
          className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        aria-busy={loading}
        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? copy.submitting : copy.primaryCta}
      </button>
    </form>
  );
}
