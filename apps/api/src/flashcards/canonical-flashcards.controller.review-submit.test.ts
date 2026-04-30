import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ReviewController } from "./canonical-flashcards.controller.js";

describe("ReviewController submit canonical flow", () => {
  const userId = "11111111-1111-4111-8111-111111111111";

  it("rejects invalid submit body", async () => {
    const controller = new ReviewController({} as any, { submitReview: vi.fn() } as any);

    expect(() =>
      controller.submit(
        { appUserId: userId } as any,
        {
          rating: "good",
          userFlashcardId: "not-a-uuid"
        }
      )
    ).toThrow(BadRequestException);
  });

  it("rejects mismatched userId override attempts", async () => {
    const controller = new ReviewController({} as any, { submitReview: vi.fn() } as any);

    expect(() =>
      controller.submit(
        { appUserId: userId } as any,
        {
          rating: "good",
          userFlashcardId: "22222222-2222-4222-8222-222222222222",
          userId: "33333333-3333-4333-8333-333333333333"
        }
      )
    ).toThrow(ForbiddenException);
  });

  it("submits and returns persisted remediation linkage fields", async () => {
    const submitReview = vi.fn().mockResolvedValue({
      cardId: "22222222-2222-4222-8222-222222222222",
      dueAt: new Date("2026-04-30T00:00:00.000Z"),
      easeFactor: 2.5,
      intervalDays: 1,
      lapses: 0,
      comebackMode: false,
      nextDueAt: new Date("2026-04-30T00:00:00.000Z"),
      previousDueAt: new Date("2026-04-29T00:00:00.000Z"),
      rating: "good",
      remediation: {
        sourceId: "44444444-4444-4444-8444-444444444444",
        sourceIdKind: "canonical_id",
        sourceType: "lexeme"
      },
      remediationPolicy: {
        availability: "after_answer",
        note: "Remediation metadata is returned only after a review answer is submitted."
      },
      repetitions: 1,
      reviewEventId: "55555555-5555-4555-8555-555555555555",
      reviewedAt: new Date("2026-04-29T00:00:00.000Z"),
      state: "review",
      userFlashcardId: "66666666-6666-4666-8666-666666666666"
    });
    const controller = new ReviewController({} as any, { submitReview } as any);

    await expect(
      controller.submit(
        { appUserId: userId } as any,
        {
          elapsedMs: 5000,
          rating: "good",
          reviewedAt: "2026-04-29T00:00:00.000Z",
          userFlashcardId: "66666666-6666-4666-8666-666666666666"
        }
      )
    ).resolves.toMatchObject({
      remediation: {
        sourceId: "44444444-4444-4444-8444-444444444444",
        sourceIdKind: "canonical_id",
        sourceType: "lexeme"
      },
      remediationPolicy: {
        availability: "after_answer"
      },
      comebackMode: false,
      reviewEventId: "55555555-5555-4555-8555-555555555555",
      userFlashcardId: "66666666-6666-4666-8666-666666666666"
    });

    expect(submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        elapsedMs: 5000,
        rating: "good",
        userFlashcardId: "66666666-6666-4666-8666-666666666666",
        userId
      })
    );
  });

  it("preserves reading_assist remediation semantics in submit response", async () => {
    const submitReview = vi.fn().mockResolvedValue({
      cardId: "22222222-2222-4222-8222-222222222223",
      dueAt: new Date("2026-05-01T00:00:00.000Z"),
      easeFactor: 2.5,
      intervalDays: 1,
      lapses: 0,
      comebackMode: true,
      nextDueAt: new Date("2026-05-01T00:00:00.000Z"),
      previousDueAt: new Date("2026-04-30T00:00:00.000Z"),
      rating: "good",
      remediation: {
        sourceId: "77777777-7777-4777-8777-777777777777",
        sourceIdKind: "opaque_ref",
        sourceType: "reading_assist"
      },
      remediationPolicy: {
        availability: "after_answer",
        note: "Remediation metadata is returned only after a review answer is submitted."
      },
      repetitions: 2,
      reviewEventId: "88888888-8888-4888-8888-888888888888",
      reviewedAt: new Date("2026-04-30T00:00:00.000Z"),
      state: "review",
      userFlashcardId: "99999999-9999-4999-8999-999999999999"
    });
    const controller = new ReviewController({} as any, { submitReview } as any);

    await expect(
      controller.submit(
        { appUserId: userId } as any,
        {
          rating: "good",
          userFlashcardId: "99999999-9999-4999-8999-999999999999"
        }
      )
    ).resolves.toMatchObject({
      remediation: {
        sourceIdKind: "opaque_ref",
        sourceType: "reading_assist"
      },
      remediationPolicy: {
        availability: "after_answer"
      },
      comebackMode: true
    });
  });
});
