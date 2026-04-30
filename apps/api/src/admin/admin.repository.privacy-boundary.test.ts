import { describe, expect, it } from "vitest";

import { applyUserDetailPrivacyBoundary } from "./admin.repository.js";

describe("applyUserDetailPrivacyBoundary", () => {
  it("redacts sensitive fields when includeSensitive is false", () => {
    const detail = {
      loginEvents: [{ metadata: { ip: "10.0.0.1" } }],
      profile: { email: "user@example.com", timezone: "Asia/Tokyo" },
      providerAccounts: [
        { emailAtLink: "linked@example.com", providerSubject: "provider-subject-123456" }
      ],
      usageCounters: [{ key: "flashcard_reviews_per_day", value: 12 }]
    };

    const redacted = applyUserDetailPrivacyBoundary(detail, false);

    expect(redacted.profile.email).toBeNull();
    expect(redacted.profile.timezone).toBe("redacted");
    expect(redacted.loginEvents[0]?.metadata).toBeNull();
    expect(redacted.providerAccounts[0]?.emailAtLink).toBeNull();
    expect(redacted.providerAccounts[0]?.providerSubject).toContain("…");
    expect(redacted.usageCounters).toEqual([]);
    expect(redacted.privacyBoundary.includeSensitive).toBe(false);
    expect(redacted.privacyBoundary.redactedFields.length).toBeGreaterThan(0);
  });

  it("keeps fields when includeSensitive is true", () => {
    const detail = {
      loginEvents: [{ metadata: { device: "mac" } }],
      profile: { email: "user@example.com", timezone: "Asia/Tokyo" },
      providerAccounts: [
        { emailAtLink: "linked@example.com", providerSubject: "provider-subject-123456" }
      ],
      usageCounters: [{ key: "flashcard_reviews_per_day", value: 12 }]
    };

    const full = applyUserDetailPrivacyBoundary(detail, true);

    expect(full.profile.email).toBe("user@example.com");
    expect(full.profile.timezone).toBe("Asia/Tokyo");
    expect(full.loginEvents[0]?.metadata).toEqual({ device: "mac" });
    expect(full.providerAccounts[0]?.emailAtLink).toBe("linked@example.com");
    expect(full.usageCounters).toHaveLength(1);
    expect(full.privacyBoundary.includeSensitive).toBe(true);
    expect(full.privacyBoundary.redactedFields).toEqual([]);
  });
});
