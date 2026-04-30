import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GoogleOAuthController } from "./google-oauth.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";
process.env.API_PUBLIC_URL ??= "http://localhost:4000";
process.env.WEB_PUBLIC_URL ??= "http://localhost:3000";

describe("GoogleOAuthController feature gate", () => {
  it("blocks oauth start when social growth flag is disabled", async () => {
    const auth = { requireGoogleConfig: vi.fn() };
    const google = { buildAuthorizeUrl: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };
    const controller = new GoogleOAuthController(auth as any, google as any, featureGate as any);

    const res = { redirect: vi.fn() } as any;
    await expect(controller.start(undefined, undefined, res)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(auth.requireGoogleConfig).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
