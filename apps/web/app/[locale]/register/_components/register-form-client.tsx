"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

/* ─── SNS icon SVGs (shared with login) ─── */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" fill="#06C755" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ─── Types ─── */

export type RegisterFormCopy = {
  authDisabledHint: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  continueApple: string;
  continueFacebook: string;
  continueGoogle: string;
  continueLine: string;
  divider: string;
  emailLabel: string;
  emailPlaceholder: string;
  genericFormError: string;
  loginCta: string;
  loginLead: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordsMismatch: string;
  primaryCta: string;
  privacyLink: string;
  registrationFailed: string;
  registrationUnavailable: string;
  submitting: string;
  termsAnd: string;
  termsLink: string;
  termsNotice: string;
  userExists: string;
  usernameLabel: string;
  usernamePlaceholder: string;
};

type SocialProvider = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

/* ─── Component ─── */

export function RegisterFormClient({
  authReady,
  copy,
  locale,
  localePrefix,
  returnTo,
  showApple,
  showFacebook,
  showGoogle,
  showLine,
}: {
  authReady: boolean;
  copy: RegisterFormCopy;
  locale: string;
  localePrefix: string;
  returnTo: string;
  showApple: boolean;
  showFacebook: boolean;
  showGoogle: boolean;
  showLine: boolean;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorizeBase = `/api/auth/keycloak/authorize?${new URLSearchParams({ intent: "register", locale, returnTo }).toString()}`;

  const socialProviders: SocialProvider[] = [];
  if (showGoogle) socialProviders.push({ href: `${authorizeBase}&idp=google`, icon: GoogleIcon, label: copy.continueGoogle });
  if (showFacebook) socialProviders.push({ href: `${authorizeBase}&idp=facebook`, icon: FacebookIcon, label: copy.continueFacebook });
  if (showLine) socialProviders.push({ href: `${authorizeBase}&idp=line`, icon: LineIcon, label: copy.continueLine });
  if (showApple) socialProviders.push({ href: `${authorizeBase}&idp=apple`, icon: AppleIcon, label: copy.continueApple });

  const hasSocial = socialProviders.length > 0;

  const onSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
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
  }, [confirm, copy, email, password, returnTo, username]);

  useEffect(() => {
    const el = document.getElementById("register-username");
    if (el) el.focus();
  }, []);

  const fieldClass =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20";

  if (!authReady) {
    return (
      <div className="space-y-4">
        {hasSocial ? (
          <div className="space-y-2.5">
            {socialProviders.map((p) => (
              <span
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm font-semibold text-ink opacity-50 cursor-not-allowed"
                key={p.label}
                aria-disabled="true"
              >
                <p.icon className="h-5 w-5 shrink-0" />
                {p.label}
              </span>
            ))}
          </div>
        ) : null}
        <p
          className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm leading-relaxed text-amber-950"
          id="register-auth-unavailable"
          role="status"
        >
          {copy.authDisabledHint}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* SNS buttons */}
      {hasSocial ? (
        <>
          <div className="space-y-2.5">
            {socialProviders.map((p) => (
              <a
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm font-semibold text-ink no-underline transition hover:bg-paper hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                href={p.href}
                key={p.label}
              >
                <p.icon className="h-5 w-5 shrink-0" />
                {p.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <span className="flex-1 border-t border-ink/10" aria-hidden />
            <span className="px-3 text-xs font-medium text-muted">{copy.divider}</span>
            <span className="flex-1 border-t border-ink/10" aria-hidden />
          </div>
        </>
      ) : null}

      {/* Registration form */}
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="register-username">
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
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="register-email">
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
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="register-password">
            {copy.passwordLabel}
          </label>
          <div className="relative">
            <input
              autoComplete="new-password"
              className={`${fieldClass} pr-11`}
              id="register-password"
              name="password"
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder={copy.passwordPlaceholder}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted/60 transition hover:text-ink"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="register-confirm">
            {copy.confirmPasswordLabel}
          </label>
          <div className="relative">
            <input
              autoComplete="new-password"
              className={`${fieldClass} pr-11`}
              id="register-confirm"
              name="confirmPassword"
              onChange={(ev) => setConfirm(ev.target.value)}
              placeholder={copy.confirmPasswordPlaceholder}
              required
              type={showConfirm ? "text" : "password"}
              value={confirm}
            />
            <button
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted/60 transition hover:text-ink"
              onClick={() => setShowConfirm((prev) => !prev)}
              type="button"
            >
              {showConfirm ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
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
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? copy.submitting : copy.primaryCta}
        </button>

        {/* Terms notice */}
        <p className="text-center text-[11px] leading-snug text-muted">
          {copy.termsNotice}{" "}
          <a className="font-medium text-ink underline-offset-2 hover:underline" href="#">
            {copy.termsLink}
          </a>{" "}
          {copy.termsAnd}{" "}
          <a className="font-medium text-ink underline-offset-2 hover:underline" href="#">
            {copy.privacyLink}
          </a>
        </p>

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
    </div>
  );
}
