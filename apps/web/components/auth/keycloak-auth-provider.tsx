"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { isWebKeycloakEnabled } from "../../lib/public-keycloak";

export type LearnerAuthState = {
  accessToken: string | null;
  /** True when HttpOnly access cookie was present on this request (server); hide login CTA until session is resolved. */
  kcAccessCookiePresent: boolean;
  displayName: string | null;
  email: string | null;
  error: "none" | "session" | "profile";
  loading: boolean;
  logout: () => void;
  reload: () => Promise<void>;
  /** Session endpoint failed while an access cookie existed (stale / misconfig); allow showing sign-in again. */
  sessionFailedWithCookie: boolean;
  userId: string | null;
};

const Ctx = createContext<LearnerAuthState | null>(null);

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

function keycloakUiEnabled() {
  return isWebKeycloakEnabled();
}

export function KeycloakAuthProvider({
  children,
  kcAccessCookiePresent = false,
  locale
}: {
  children: ReactNode;
  kcAccessCookiePresent?: boolean;
  locale: string;
}) {
  const [loading, setLoading] = useState(keycloakUiEnabled());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<LearnerAuthState["error"]>("none");
  const [sessionFailedWithCookie, setSessionFailedWithCookie] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const clearProfile = () => {
      setDisplayName(null);
      setEmail(null);
      setUserId(null);
    };

    if (!keycloakUiEnabled()) {
      setAccessToken(null);
      clearProfile();
      setLoading(false);
      setError("none");
      setSessionFailedWithCookie(true);
      return;
    }
    setLoading(true);
    setError("none");
    try {
      const fetchSession = () =>
        fetch("/api/auth/keycloak/session", {
          cache: "no-store",
          credentials: "same-origin"
        });
      let s = await fetchSession();
      if (!s.ok && s.status === 401) {
        await new Promise((r) => setTimeout(r, 150));
        s = await fetchSession();
      }
      if (!s.ok) {
        setAccessToken(null);
        clearProfile();
        setSessionFailedWithCookie(kcAccessCookiePresent);
        setError(s.status === 401 ? "session" : "session");
        return;
      }
      setSessionFailedWithCookie(false);
      const { accessToken: at } = (await s.json()) as { accessToken: string };
      setAccessToken(at);
      try {
        const me = await fetch(`${apiBase}/api/auth/me`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${at}` }
        });
        if (me.ok) {
          const body = (await me.json()) as {
            profile: { displayName: string | null; email: string | null; id: string };
          };
          setDisplayName(body.profile.displayName);
          setEmail(body.profile.email);
          setUserId(body.profile.id);
          setError("none");
        } else {
          clearProfile();
          setError("profile");
        }
      } catch {
        clearProfile();
        setError("profile");
      }
    } catch {
      setAccessToken(null);
      clearProfile();
      setSessionFailedWithCookie(kcAccessCookiePresent);
      setError("session");
    } finally {
      setLoading(false);
    }
  }, [kcAccessCookiePresent]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(() => {
    window.location.href = `/auth/logout?locale=${encodeURIComponent(locale)}`;
  }, [locale]);

  const value = useMemo(
    () => ({
      accessToken,
      displayName,
      email,
      error,
      kcAccessCookiePresent,
      loading,
      logout,
      reload,
      sessionFailedWithCookie,
      userId
    }),
    [
      accessToken,
      displayName,
      email,
      error,
      kcAccessCookiePresent,
      loading,
      logout,
      reload,
      sessionFailedWithCookie,
      userId
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKeycloakAuth() {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useKeycloakAuth requires KeycloakAuthProvider");
  }
  return v;
}

/** Alias for apps that prefer a generic name. */
export const useAuth = useKeycloakAuth;

export { KeycloakAuthProvider as AuthProvider };
