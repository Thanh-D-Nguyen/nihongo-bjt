import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuizController } from "./quiz.controller.js";
import { ForbiddenException } from "@nestjs/common";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";

describe("QuizController admin quality endpoint", () => {
  let controller: QuizController;
  let mockRepository: any;
  let mockService: any;

  beforeEach(() => {
    mockRepository = {
      listQualityIssues: vi.fn().mockResolvedValue([
        {
          questionId: "00000000-0000-4000-8000-000000000905",
          skillTag: "listening",
          validation: { isValid: false, issues: ["No correct option found"] },
          qualityFlags: { low_accuracy: true }
        }
      ])
    };

    mockService = {};

    controller = new QuizController(mockRepository, mockService, {} as any);
  });

  it("rejects admin endpoint when user is not authenticated", () => {
    expect(() => {
      controller.admin_listQualityIssues(undefined);
    }).toThrow(ForbiddenException);
  });

  it("rejects admin endpoint when user does not have admin realm role", () => {
    const user: KeycloakAuthenticatedUser = {
      sub: "user-id",
      appUserId: "app-user-id",
      realmRoles: ["learner"]
    };

    expect(() => {
      controller.admin_listQualityIssues(user);
    }).toThrow(ForbiddenException);
  });

  it("rejects admin endpoint when user does not have admin resource role", () => {
    const user: KeycloakAuthenticatedUser = {
      sub: "user-id",
      appUserId: "app-user-id",
      realmRoles: ["learner"]
    };

    expect(() => {
      controller.admin_listQualityIssues(user);
    }).toThrow(ForbiddenException);
  });

  it("allows admin endpoint when user has admin realm role", () => {
    const user: KeycloakAuthenticatedUser = {
      sub: "user-id",
      appUserId: "app-user-id",
      realmRoles: ["admin"]
    };

    const result = controller.admin_listQualityIssues(user);
    expect(result).toBeDefined();
    expect(mockRepository.listQualityIssues).toHaveBeenCalled();
  });

  it("allows admin endpoint when user has admin resource role", () => {
    const user: KeycloakAuthenticatedUser = {
      sub: "user-id",
      appUserId: "app-user-id",
      realmRoles: ["admin"]
    };

    const result = controller.admin_listQualityIssues(user);
    expect(result).toBeDefined();
    expect(mockRepository.listQualityIssues).toHaveBeenCalled();
  });
});
