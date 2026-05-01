import { describe, expect, it } from "vitest";

import { safeReturnToPath } from "./kc-cookies";

// Regression coverage for admin.auth.login_redirect_loop. The login screen
// reads `returnTo` from the URL and uses safeReturnToPath to gate where we
// redirect after a successful Keycloak password grant. Open redirects via
// protocol-relative URLs, absolute URLs, and CRLF injection attempts must be
// rejected, while a plain in-app path must round-trip unchanged.
describe("safeReturnToPath", () => {
  const fallback = "/vi";

  it("returns the fallback for null/empty inputs", () => {
    expect(safeReturnToPath(null, fallback)).toBe(fallback);
    expect(safeReturnToPath("", fallback)).toBe(fallback);
  });

  it("rejects protocol-relative URLs (//evil.example)", () => {
    expect(safeReturnToPath("//evil.example/admin", fallback)).toBe(fallback);
  });

  it("rejects absolute URLs", () => {
    expect(safeReturnToPath("https://evil.example/admin", fallback)).toBe(fallback);
    expect(safeReturnToPath("http://localhost:4000/admin", fallback)).toBe(fallback);
  });

  it("rejects values that do not start with /", () => {
    expect(safeReturnToPath("vi/users", fallback)).toBe(fallback);
    expect(safeReturnToPath("./vi", fallback)).toBe(fallback);
  });

  it("rejects oversized inputs", () => {
    const long = "/" + "a".repeat(2050);
    expect(safeReturnToPath(long, fallback)).toBe(fallback);
  });

  it("accepts in-app absolute paths", () => {
    expect(safeReturnToPath("/vi", fallback)).toBe("/vi");
    expect(safeReturnToPath("/vi/users", fallback)).toBe("/vi/users");
    expect(safeReturnToPath("/ja/iam/roles?tab=editor", fallback)).toBe(
      "/ja/iam/roles?tab=editor"
    );
  });
});
