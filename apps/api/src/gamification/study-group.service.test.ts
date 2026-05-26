import { describe, expect, it } from "vitest";

import { buildSocialPairKey } from "./study-group.service.js";

describe("buildSocialPairKey", () => {
  it("normalizes a learner pair so reverse friend requests cannot duplicate the edge", () => {
    const first = "00000000-0000-4000-8000-000000000002";
    const second = "00000000-0000-4000-8000-000000000001";

    expect(buildSocialPairKey(first, second)).toBe(buildSocialPairKey(second, first));
    expect(buildSocialPairKey(first, second)).toBe(
      "00000000-0000-4000-8000-000000000001:00000000-0000-4000-8000-000000000002",
    );
  });
});
