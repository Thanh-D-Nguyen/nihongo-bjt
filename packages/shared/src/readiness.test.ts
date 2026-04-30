import { describe, expect, it } from "vitest";

import { reviewBatchSchema, placementStartSchema, privacyRequestCreateSchema } from "./index.js";

describe("phase 09 readiness schemas", () => {
  it("validates review batch", () => {
    const p = reviewBatchSchema.safeParse({
      items: [
        {
          clientMutationId: "a1",
          rating: "good",
          userFlashcardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        }
      ],
      userId: "a2d8e7f6-5b3c-4a1d-8e0f-123456789abc"
    });
    expect(p.success).toBe(true);
  });

  it("rejects bad uuid in placement start", () => {
    const p = placementStartSchema.safeParse({ userId: "x" });
    expect(p.success).toBe(false);
  });

  it("validates privacy request kind", () => {
    const p = privacyRequestCreateSchema.safeParse({
      kind: "data_export",
      userId: "a2d8e7f6-5b3c-4a1d-8e0f-123456789abc"
    });
    expect(p.success).toBe(true);
  });
});
