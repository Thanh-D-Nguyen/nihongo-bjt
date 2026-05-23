import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import type { KeycloakJwtPayload } from "./keycloak.types.js";

@Injectable()
export class KeycloakUserService {
  private readonly prisma: PrismaClient = createPrismaClient();

  /**
   * Upsert learner profile from Keycloak `sub` / email (no password fields).
   */
  async provisionLearner(claims: KeycloakJwtPayload): Promise<{ appUserId: string }> {
    const sub = claims.sub;
    if (!sub) {
      throw new Error("Token missing sub");
    }
    const email =
      typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null;
    const displayName =
      (typeof claims.name === "string" && claims.name.trim()) ||
      (typeof claims.preferred_username === "string" && claims.preferred_username.trim()) ||
      email ||
      "Learner";

    const bySub = await this.prisma.userProfile.findFirst({
      where: { keycloakSubject: sub }
    });
    if (bySub) {
      await this.prisma.userProfile.update({
        data: {
          displayName,
          ...(email ? { email } : {})
        },
        where: { id: bySub.id }
      });
      await this.ensureReadingPreference(bySub.id);
      return { appUserId: bySub.id };
    }

    if (email) {
      const byEmail = await this.prisma.userProfile.findFirst({
        where: { email }
      });
      if (byEmail) {
        await this.prisma.userProfile.update({
          data: { displayName, email, keycloakSubject: sub },
          where: { id: byEmail.id }
        });
        await this.ensureReadingPreference(byEmail.id);
        return { appUserId: byEmail.id };
      }
    }

    const created = await this.prisma.userProfile.create({
      data: {
        displayName,
        email,
        keycloakSubject: sub,
        readingUserPreference: { create: {} }
      }
    });
    return { appUserId: created.id };
  }

  private async ensureReadingPreference(userId: string) {
    await this.prisma.readingUserPreference.upsert({
      create: { userId },
      update: {},
      where: { userId }
    });
  }

  getLearnerPublicProfile(appUserId: string) {
    return this.prisma.userProfile.findUnique({
      select: {
        avatarAssetId: true,
        coverAssetId: true,
        densityPreference: true,
        displayName: true,
        email: true,
        explanationLocale: true,
        fontSizePreference: true,
        id: true,
        keycloakSubject: true,
        sharePostcardOptIn: true,
        status: true,
        themeMode: true,
        uiLocale: true
      },
      where: { id: appUserId }
    });
  }

  async updateLearnerProfile(
    appUserId: string,
    input: {
      avatarAssetId?: string | null;
      coverAssetId?: string | null;
      dailyGoalCards?: number;
      densityPreference?: string;
      displayName?: string;
      explanationLocale?: string;
      fontSizePreference?: string;
      learningPersonality?: string | null;
      privacyLevel?: string;
      sharePostcardOptIn?: boolean;
      targetBjtBand?: string | null;
      themeMode?: string;
      timezone?: string;
      uiLocale?: string;
    }
  ) {
    return this.prisma.userProfile.update({
      data: {
        avatarAssetId: input.avatarAssetId,
        coverAssetId: input.coverAssetId,
        dailyGoalCards: input.dailyGoalCards,
        densityPreference: input.densityPreference,
        displayName: input.displayName,
        explanationLocale: input.explanationLocale,
        fontSizePreference: input.fontSizePreference,
        learningPersonality: input.learningPersonality,
        privacyLevel: input.privacyLevel,
        sharePostcardOptIn: input.sharePostcardOptIn,
        targetBjtBand: input.targetBjtBand,
        themeMode: input.themeMode,
        timezone: input.timezone,
        uiLocale: input.uiLocale
      },
      select: {
        avatarAssetId: true,
        coverAssetId: true,
        dailyGoalCards: true,
        densityPreference: true,
        displayName: true,
        email: true,
        explanationLocale: true,
        fontSizePreference: true,
        id: true,
        keycloakSubject: true,
        learningPersonality: true,
        privacyLevel: true,
        sharePostcardOptIn: true,
        status: true,
        targetBjtBand: true,
        themeMode: true,
        timezone: true,
        uiLocale: true
      },
      where: { id: appUserId }
    });
  }

  /**
   * Grant matching `authz.admin_role` rows for realm roles present in the token (additive only).
   */
  async syncAdminRealmRoles(params: { actorId: string; realmRoles: string[] }): Promise<void> {
    if (params.realmRoles.length === 0) {
      return;
    }
    const roles = await this.prisma.adminRole.findMany({
      where: { code: { in: params.realmRoles }, status: "active" }
    });
    for (const role of roles) {
      await this.prisma.adminActorRole.upsert({
        create: { actorId: params.actorId, roleId: role.id },
        update: {},
        where: { actorId_roleId: { actorId: params.actorId, roleId: role.id } }
      });
    }
  }
}
