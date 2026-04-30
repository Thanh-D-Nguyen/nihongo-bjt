"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export type RegisterFormCopy = {
  authDisabledHint: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  genericFormError: string;
  loginCta: string;
  loginLead: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordsMismatch: string;
  primaryCta: string;
  registrationFailed: string;
  registrationUnavailable: string;
  submitting: string;
  userExists: string;
  usernameLabel: string;
  usernamePlaceholder: string;
};

export function RegisterFormClient({
  authReady,
  copy,
  localePrefix,
  returnTo
}: {
  authReady: boolean;
  copy: RegisterFormCopy;
  localePrefix: string;
  returnTo: string;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(copy.passwordsMismatch);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/keycloak/register", {
        body: JSON.stringify({ email, password, username }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (data.error === "user_exists") {
          setError(copy.userExists);
        } else if (data.error === "registration_unavailable") {
          setError(copy.registrationUnavailable);
        } else if (data.error === "validation") {
          setError(copy.genericFormError);
        } else {
          setError(copy.registrationFailed);
        }
        return;
      }
      window.location.assign(returnTo);
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink outline-none ring-ink/20 focus-visible:ring-2";

  if (!authReady) {
    return (
      <p
        className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm leading-relaxed text-amber-950"
        id="register-auth-unavailable"
        role="status"
      >
        {copy.authDisabledHint}
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="register-username">
          {copy.usernameLabel}
        </label>
        <input
          autoComplete="username"
          className={fieldClass}
          id="register-username"
          name="username"
          onChange={(ev) => setUsername(ev.target.value)}
          placeholder={copy.usernamePlaceholder}
          required
          type="text"
          value={username}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="register-email">
          {copy.emailLabel}
        </label>
        <input
          autoComplete="email"
          className={fieldClass}
          id="register-email"
          name="email"
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder={copy.emailPlaceholder}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="register-password">
          {copy.passwordLabel}
        </label>
        <input
          autoComplete="new-password"
          className={fieldClass}
          id="register-password"
          name="password"
          onChange={(ev) => setPassword(ev.target.value)}
          placeholder={copy.passwordPlaceholder}
          required
          type="password"
          value={password}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="register-confirm">
          {copy.confirmPasswordLabel}
        </label>
        <input
          autoComplete="new-password"
          className={fieldClass}
          id="register-confirm"
          name="confirmPassword"
          onChange={(ev) => setConfirm(ev.target.value)}
          placeholder={copy.confirmPasswordPlaceholder}
          required
          type="password"
          value={confirm}
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
      <p className="text-center text-sm text-muted">
        <span>{copy.loginLead} </span>
        <Link
          className="font-semibold text-ink underline-offset-4 hover:underline"
          href={`${localePrefix}/login`}
        >
          {copy.loginCta}
        </Link>
      </p>
    </form>
  );
}
