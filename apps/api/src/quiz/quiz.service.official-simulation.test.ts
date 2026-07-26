import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { EntitlementKey, FeatureFlagKey } from "../monetization/monetization.constants.js";
import { QuizService } from "./quiz.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

function makeService(input?: {
  enforcementEnabled?: boolean;
  entitlements?: string[];
  officialEnabled?: boolean;
}) {
  const quizRepository = {
    startSession: vi.fn().mockResolvedValue({ id: "session-1" }),
    templateAccessMeta: vi.fn().mockResolvedValue({ id: "test-1", type: "official" })
  };
  const quotaService = {
    consumeQuizStartInTransaction: vi.fn().mockResolvedValue(undefined)
  };
  const entitlementService = {
    listEntitlementKeysForUser: vi.fn().mockResolvedValue({
      entitlements: input?.entitlements ?? [],
      planSlug: "free"
    })
  };
  const featureGate = {
    requireEnabled: vi.fn().mockImplementation(async (key: string) => {
      if (key === FeatureFlagKey.quiz_official_simulation && input?.officialEnabled === false) {
        throw new Error("disabled");
      }
    }),
    status: vi.fn().mockImplementation(async (key: string) => {
      if (key === FeatureFlagKey.quiz_official_simulation) {
        return { enabled: input?.officialEnabled ?? true };
      }
      return { enabled: input?.enforcementEnabled ?? false };
    })
  };
  const service = new QuizService(
    quizRepository as never,
    quotaService as never,
    entitlementService as never,
    featureGate as never
  );
  const transaction = {};
  (service as unknown as { prisma: unknown }).prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(transaction)),
    bjtMockTest: { count: vi.fn().mockResolvedValue(3) }
  };

  return { entitlementService, featureGate, quizRepository, quotaService, service, transaction };
}

describe("QuizService official simulation availability", () => {
  it("exposes published forms to free learners while monetization enforcement is disabled", async () => {
    const { service } = makeService();

    await expect(service.officialSimulationStatus("user-1")).resolves.toMatchObject({
      availableTemplates: 3,
      enabled: true,
      enforcementEnabled: false,
      entitled: true,
      planSlug: "free"
    });
  });

  it("keeps entitlement enforcement server-side when monetization enforcement is enabled", async () => {
    const { service } = makeService({ enforcementEnabled: true });

    await expect(service.officialSimulationStatus("user-1")).resolves.toMatchObject({
      availableTemplates: 3,
      enabled: true,
      enforcementEnabled: true,
      entitled: false
    });
  });

  it("starts an official form in free mode without requiring a paid entitlement", async () => {
    const { entitlementService, quizRepository, quotaService, service, transaction } =
      makeService();

    await expect(service.startSessionWithQuota("test-1", "user-1")).resolves.toEqual({
      id: "session-1"
    });
    expect(entitlementService.listEntitlementKeysForUser).not.toHaveBeenCalled();
    expect(quizRepository.startSession).toHaveBeenCalledWith("test-1", "user-1", transaction);
    expect(quotaService.consumeQuizStartInTransaction).toHaveBeenCalledWith(transaction, "user-1");
  });

  it("denies an official form without entitlement when monetization enforcement is enabled", async () => {
    const { service } = makeService({ enforcementEnabled: true });

    await expect(service.startSessionWithQuota("test-1", "user-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("accepts the official entitlement when monetization enforcement is enabled", async () => {
    const { service } = makeService({
      enforcementEnabled: true,
      entitlements: [EntitlementKey.quiz_official_simulation]
    });

    await expect(service.startSessionWithQuota("test-1", "user-1")).resolves.toEqual({
      id: "session-1"
    });
  });
});
