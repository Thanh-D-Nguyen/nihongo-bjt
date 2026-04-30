import { describe, it, expect } from "vitest";
import { createPrismaClient } from "@nihongo-bjt/database";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { FlashcardsRepository } from "./flashcards.repository.js";
import { LEECH_THRESHOLD_LAPSES } from "@nihongo-bjt/shared";

loadEnv({ path: resolve(process.cwd(), ".env") });

const db = createPrismaClient();

describe("FlashcardsRepository - Leech Detection and Comeback Mode", () => {
  /**
   * **Integration Test Strategy**
   * - Unit tests for `scheduleSrsReview` already cover pure function logic
   * - Integration tests verify persistence layer and end-to-end flows
   * - These tests validate leech detection, persistence, and comeback mode behavior
   */

  it("should detect leech and persist state when lapses reach threshold", async () => {
    const userId = randomUUID();

    try {
      // Create minimal test card
      const card = await db.flashcardVariant.create({
        data: {
          frontText: "Test",
          backText: "Back",
          sourceType: "lexeme",
          sourceId: randomUUID()
        }
      });

      // Create user flashcard
      const userFlashcard = await db.userFlashcard.create({
        data: {
          userId,
          cardId: card.id,
          state: "new",
          dueAt: new Date(),
          intervalDays: 0,
          easeFactor: 2.5,
          repetitions: 0,
          lapses: 0,
          leeched: false
        }
      });

      const repo = new FlashcardsRepository();

      // Submit multiple "again" reviews to reach leech threshold
      for (let i = 0; i < LEECH_THRESHOLD_LAPSES; i++) {
        const result = await db.$transaction(async (tx) => {
          return repo.applySubmitReview(tx, {
            rating: "again",
            reviewedAt: new Date(),
            userFlashcardId: userFlashcard.id,
            userId,
            elapsedMs: 1000
          });
        });

        if (i === LEECH_THRESHOLD_LAPSES - 1) {
          // At threshold, should be detected
          expect(result.leeched).toBe(true);
          expect(result.leechDetected).toBe(true);
          expect(result.lapses).toBe(LEECH_THRESHOLD_LAPSES);
        }
      }

      // Verify persistence
      const updated = await db.userFlashcard.findFirstOrThrow({
        where: { id: userFlashcard.id }
      });
      expect(updated.leeched).toBe(true);
      expect(updated.lapses).toBe(LEECH_THRESHOLD_LAPSES);
    } finally {
      // Cleanup
      await db.userFlashcard.deleteMany({ where: { userId } });
      await db.flashcardVariant.deleteMany({
        where: {
          frontText: "Test"
        }
      });
    }
  });

  it("should include leech status in due queue responses", async () => {
    const userId = randomUUID();

    try {
      // Create test card
      const card = await db.flashcardVariant.create({
        data: {
          frontText: "LeechTest",
          backText: "Back",
          sourceType: "lexeme",
          sourceId: randomUUID()
        }
      });

      // Create pre-leeched card
      const leeched = await db.userFlashcard.create({
        data: {
          userId,
          cardId: card.id,
          state: "lapsed",
          dueAt: new Date(),
          intervalDays: 0,
          easeFactor: 1.3,
          repetitions: 0,
          lapses: LEECH_THRESHOLD_LAPSES,
          leeched: true
        }
      });

      const repo = new FlashcardsRepository();
      const dueReviews = await repo.dueReviews(userId, 10);

      const found = dueReviews.find((r: any) => r.id === leeched.id);
      expect(found).toBeDefined();
      expect(found?.leeched).toBe(true);
    } finally {
      // Cleanup
      await db.userFlashcard.deleteMany({ where: { userId } });
      await db.flashcardVariant.deleteMany({
        where: {
          frontText: "LeechTest"
        }
      });
    }
  });

  it("should preserve leech flag across reviews", async () => {
    const userId = randomUUID();

    try {
      const card = await db.flashcardVariant.create({
        data: {
          frontText: "Persist",
          backText: "Back",
          sourceType: "lexeme",
          sourceId: randomUUID()
        }
      });

      const userFlashcard = await db.userFlashcard.create({
        data: {
          userId,
          cardId: card.id,
          state: "new",
          dueAt: new Date(),
          intervalDays: 0,
          easeFactor: 2.5,
          repetitions: 0,
          lapses: 0,
          leeched: false
        }
      });

      const repo = new FlashcardsRepository();

      // Reach leech state
      for (let i = 0; i < LEECH_THRESHOLD_LAPSES + 1; i++) {
        await db.$transaction(async (tx) => {
          return repo.applySubmitReview(tx, {
            rating: "again",
            reviewedAt: new Date(),
            userFlashcardId: userFlashcard.id,
            userId,
            elapsedMs: 1000
          });
        });
      }

      // Review with good - should stay leeched
      const result = await db.$transaction(async (tx) => {
        return repo.applySubmitReview(tx, {
          rating: "good",
          reviewedAt: new Date(),
          userFlashcardId: userFlashcard.id,
          userId,
          elapsedMs: 1000
        });
      });

      expect(result.leeched).toBe(true);

      const updated = await db.userFlashcard.findFirstOrThrow({
        where: { id: userFlashcard.id }
      });
      expect(updated.leeched).toBe(true);
    } finally {
      // Cleanup
      await db.userFlashcard.deleteMany({ where: { userId } });
      await db.flashcardVariant.deleteMany({
        where: {
          frontText: "Persist"
        }
      });
    }
  });

  it("should append review events for audit trail", async () => {
    const userId = randomUUID();

    try {
      const card = await db.flashcardVariant.create({
        data: {
          frontText: "Audit",
          backText: "Back",
          sourceType: "lexeme",
          sourceId: randomUUID()
        }
      });

      const userFlashcard = await db.userFlashcard.create({
        data: {
          userId,
          cardId: card.id,
          state: "new",
          dueAt: new Date(),
          intervalDays: 0,
          easeFactor: 2.5,
          repetitions: 0,
          lapses: 0,
          leeched: false
        }
      });

      const repo = new FlashcardsRepository();

      // Submit reviews
      for (let i = 0; i < 3; i++) {
        await db.$transaction(async (tx) => {
          return repo.applySubmitReview(tx, {
            rating: "again",
            reviewedAt: new Date(),
            userFlashcardId: userFlashcard.id,
            userId,
            elapsedMs: 1000
          });
        });
      }

      // Verify all events recorded
      const events = await db.reviewEvent.findMany({
        where: { userFlashcardId: userFlashcard.id },
        orderBy: { reviewedAt: "asc" }
      });

      expect(events.length).toBe(3);
      events.forEach((e) => {
        expect(e.rating).toBe("again");
      });
    } finally {
      // Cleanup
      await db.userFlashcard.deleteMany({ where: { userId } });
      await db.flashcardVariant.deleteMany({
        where: {
          frontText: "Audit"
        }
      });
    }
  });
});
