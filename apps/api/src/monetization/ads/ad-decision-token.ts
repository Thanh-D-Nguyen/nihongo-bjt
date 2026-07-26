import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const AD_DECISION_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface AdDecisionTokenClaims {
  campaignId: string;
  decisionKey: string;
  expiresAt: number;
  issuedAt: number;
  nonce: string;
  placementCode: string;
  subject: string;
  version: 1;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

export function signAdDecisionToken(
  input: Omit<AdDecisionTokenClaims, "expiresAt" | "issuedAt" | "nonce" | "version">,
  secret: string,
  now = Date.now()
): string {
  const claims: AdDecisionTokenClaims = {
    ...input,
    expiresAt: now + AD_DECISION_TOKEN_TTL_MS,
    issuedAt: now,
    nonce: randomUUID(),
    version: 1
  };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyAdDecisionToken(
  token: string,
  secret: string,
  now = Date.now()
): AdDecisionTokenClaims {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra !== undefined) {
    throw new Error("Malformed ad decision token");
  }

  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid ad decision token signature");
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Malformed ad decision token payload");
  }
  const claims = value as Partial<AdDecisionTokenClaims>;
  if (
    claims.version !== 1 ||
    typeof claims.campaignId !== "string" ||
    typeof claims.decisionKey !== "string" ||
    typeof claims.expiresAt !== "number" ||
    typeof claims.issuedAt !== "number" ||
    typeof claims.nonce !== "string" ||
    typeof claims.placementCode !== "string" ||
    typeof claims.subject !== "string"
  ) {
    throw new Error("Invalid ad decision token payload");
  }
  if (claims.expiresAt <= now || claims.issuedAt > now + 30_000) {
    throw new Error("Expired ad decision token");
  }
  return claims as AdDecisionTokenClaims;
}
