import { describe, expect, it } from "vitest";

import {
  classifyPasswordGrantFailure,
  readPasswordCredentials,
  safeReturnToPath
} from "./index.js";

describe("Keycloak OIDC login helpers", () => {
  it("validates password-login payloads", () => {
    expect(
      readPasswordCredentials({ username: "  user@example.com ", password: "secret" })
    ).toEqual({
      password: "secret",
      username: "user@example.com"
    });
    expect(readPasswordCredentials({ username: "", password: "secret" })).toBeNull();
    expect(readPasswordCredentials({ username: "user@example.com", password: "" })).toBeNull();
  });

  it("keeps returnTo redirects local to the app", () => {
    expect(safeReturnToPath("/vi/quiz", "/vi")).toBe("/vi/quiz");
    expect(safeReturnToPath("//evil.example", "/vi")).toBe("/vi");
    expect(safeReturnToPath("https://evil.example", "/vi")).toBe("/vi");
  });

  it("maps Keycloak grant failures to stable app error codes", () => {
    expect(
      classifyPasswordGrantFailure({ httpStatus: 401, keycloakError: "invalid_grant", ok: false })
    ).toEqual({ code: "invalid_credentials", status: 401 });
    expect(
      classifyPasswordGrantFailure({
        errorDescription: "Invalid client credentials",
        httpStatus: 401,
        keycloakError: "unauthorized_client",
        ok: false
      })
    ).toEqual({ code: "client_misconfigured", status: 502 });
    expect(
      classifyPasswordGrantFailure({
        httpStatus: 400,
        keycloakError: "unsupported_grant_type",
        ok: false
      })
    ).toEqual({ code: "auth_method_not_allowed", status: 403 });
  });
});
