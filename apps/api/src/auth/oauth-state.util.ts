import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const enc = new TextEncoder();

export interface GoogleOAuthStatePayload {
  exp: number;
  n: string;
  ref?: string;
  /** UI locale for post-login redirect (default vi). */
  locale?: "ja" | "vi";
}

export function signOAuthState(payload: GoogleOAuthStatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const bodyB64 = body.toString("base64url");
  const sig = createHmac("sha256", enc.encode(secret)).update(bodyB64).digest("base64url");
  return `${bodyB64}.${sig}`;
}

export function verifyOAuthState(
  token: string,
  secret: string
): { ok: true; payload: GoogleOAuthStatePayload } | { ok: false } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [bodyB64, sig] = parts;
  if (!bodyB64 || !sig) {
    return { ok: false };
  }
  const expected = createHmac("sha256", enc.encode(secret)).update(bodyB64).digest();
  const got = Buffer.from(sig, "base64url");
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false };
  }
  try {
    const payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf8")
    ) as GoogleOAuthStatePayload;
    if (typeof payload.exp !== "number" || typeof payload.n !== "string") {
      return { ok: false };
    }
    if (Date.now() > payload.exp) {
      return { ok: false };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

export function randomNonce(): string {
  return randomBytes(16).toString("base64url");
}
