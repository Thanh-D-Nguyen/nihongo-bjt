import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LegalConsentController } from "./legal-consent.controller.js";

describe("LegalConsentController", () => {
  it("returns consent status for authenticated user", async () => {
    const legalConsent = {
      getStatus: vi.fn().mockResolvedValue({
        accepted: {
          cookie_policy: null,
          privacy_policy: null,
          terms_of_service: null
        },
        required: {
          cookie_policy: "v1",
          privacy_policy: "v1",
          terms_of_service: "v1"
        }
      })
    };

    const controller = new LegalConsentController(legalConsent as any);
    const result = await controller.status(
      { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
      {}
    );

    expect(result.required.terms_of_service).toBe("v1");
    expect(legalConsent.getStatus).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("accept rejects invalid payload", async () => {
    const legalConsent = { accept: vi.fn() };
    const controller = new LegalConsentController(legalConsent as any);

    expect(() =>
      controller.accept(
        { appUserId: "11111111-1111-4111-8111-111111111111" } as any,
        { consentKey: "invalid" }
      )
    ).toThrow(BadRequestException);
  });
});
