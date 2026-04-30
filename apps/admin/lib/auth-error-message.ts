export type AuthErrorCopy = {
  cancelled: string;
  configuration: string;
  generic: string;
  unavailable: string;
};

/** Map internal auth error codes to user-safe copy (never surface provider errors verbatim). */
export function userFacingAuthError(code: string | null | undefined, t: AuthErrorCopy): string | null {
  if (!code?.trim()) {
    return null;
  }
  const c = code.trim();
  if (c === "access_denied") {
    return t.cancelled;
  }
  if (c === "not_configured") {
    return t.configuration;
  }
  if (c === "unavailable") {
    return t.unavailable;
  }
  return t.generic;
}
