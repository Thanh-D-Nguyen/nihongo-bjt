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

import { getServerApiBaseUrl } from "./server-api-url";

/**
 * Go-native learner auth state.
 * Replaces KeycloakAuthProvider with cookie-based session authentication
 * against the Go API (POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout).
 *
 * No tokens are stored in localStorage/sessionStorage — the HttpOnly session
 * cookie (bjt_web_session) is managed entirely by the browser.
 */
export type GoAuthState = {
  /** Always null for Go-native auth; retained for interface compatibility. */
  accessToken: string | null;
  displayName: string | null;
  email: string | null;
  error: "none" | "session" | "profile";
  /** True when authenticated (session valid). */
  isAuthenticated: boolean;
  /** True while the initial session check is in flight. */
  isLoading: boolean;
  /** Alias for isLoading — matches legacy KeycloakAuthProvider interface. */
  loading: boolean;
  logout: () => void;
  reload: () => Promise<void>;
  userId: string | null;
};

const Ctx = createContext<GoAuthState | null>(null);

/** Shape returned by GET /api/auth/me from the Go API. */
type GoMeResponse = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  themeMode: string;
  fontSizePreference: string;
  densityPreference: string;
  flashcardStyleSlug: string | null;
  coverAssetId: string | null;
  adsPersonalizationOptIn: boolean;
  sharePostcardOptIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export function GoAuthProvider({
  children,
  locale
}: {
  children: ReactNode;
  locale: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<GoAuthState["error"]>("none");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("none");

    try {
      // Call the BFF route which proxies to Go API with server-side cookies.
      // In browser context, this hits /api/auth/me which forwards cookies.
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!res.ok) {
        setUserId(null);
        setDisplayName(null);
        setEmail(null);
        setError(res.status === 401 ? "session" : "session");
        return;
      }

      const profile = (await res.json()) as GoMeResponse;
      setUserId(profile.id);
      setDisplayName(profile.displayName);
      setEmail(profile.email);
      setError("none");
    } catch {
      setUserId(null);
      setDisplayName(null);
      setEmail(null);
      setError("session");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });
    } catch {
      /* best-effort; redirect regardless */
    }
    // Clear local state immediately.
    setUserId(null);
    setDisplayName(null);
    setEmail(null);
    setError("none");
    // Redirect to login page.
    window.location.href = `/${locale}/login`;
  }, [locale]);

  const isAuthenticated = Boolean(userId);

  const value = useMemo<GoAuthState>(
    () => ({
      accessToken: null,
      displayName,
      email,
      error,
      isAuthenticated,
      isLoading,
      loading: isLoading,
      logout,
      reload,
      userId
    }),
    [displayName, email, error, isAuthenticated, isLoading, logout, reload, userId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Hook to access Go-native learner auth state.
 * Drop-in replacement for useGoAuth() — same field names.
 */
export function useGoAuth(): GoAuthState {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useGoAuth requires GoAuthProvider");
  }
  return v;
}

/**
 * Backward-compatible alias so existing code importing useKeycloakAuth
 * from this module continues to work during migration.
 */
export const useKeycloakAuth = useGoAuth;

/** Alias for apps that prefer a generic name. */
export const useAuth = useGoAuth;

export { GoAuthProvider as AuthProvider };