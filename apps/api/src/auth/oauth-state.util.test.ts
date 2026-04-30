import { describe, expect, it } from "vitest";

import { signOAuthState, verifyOAuthState } from "./oauth-state.util.js";

describe("oauth state", () => {
  it("round-trips a signed state", () => {
    const secret = "a".repeat(32);
    const t = signOAuthState({ exp: Date.now() + 60_000, n: "x", ref: "abc123" }, secret);
    const v = verifyOAuthState(t, secret);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.ref).toBe("abc123");
    }
  });

  it("rejects tampered state", () => {
    const secret = "b".repeat(32);
    const t = signOAuthState({ exp: Date.now() + 60_000, n: "y" }, secret);
    const v = verifyOAuthState(t + "x", secret);
    expect(v.ok).toBe(false);
  });
});
