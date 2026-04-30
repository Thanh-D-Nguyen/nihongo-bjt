import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { adminUserInviteBodySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { KeycloakRealmAdminService } from "../keycloak/keycloak-realm-admin.service.js";

type PrismaTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type PrismaOrTx = PrismaClient | PrismaTransaction;

/**
 * Admin-driven user **invitation / creation** orchestration.
 *
 * **Identity vs profile:** `user_profile.keycloak_subject` is the OIDC `sub` from Keycloak; the app
 * never stores end-user passwords. When Keycloak Admin API is off or the operator chooses
 * `invite_only`, we still persist `user_profile` + `user_invitation` so the person is
 * *pending* rather than an orphan: `authSyncStatus` reflects linkage state (`pending_invite`, `linked`, `sync_error`).
 *
 * **Post-commit Keycloak work:** user creation, execute-actions email, and sync-by-email run **after**
 * the DB transaction commits, so a failed token/API call does not roll back the profile; the row is
 * updated to `sync_error` and audit records the failure.
 */
@Injectable()
export class AdminUserInviteService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(KeycloakRealmAdminService) private readonly kc: KeycloakRealmAdminService
  ) {}

  /**
   * Validates RBAC (paid plan + quota override require `admin.monetization.write`), enforces email uniqueness,
   * then writes profile, invitation, plan, and audits in one transaction. Keycloak side-effects (create/link/email)
   * run afterward — see class JSDoc.
   */
  async inviteOrCreate(
    actorId: string,
    body: unknown,
    permissions: Set<string>
  ): Promise<{
    user: {
      id: string;
      email: string | null;
      keycloakSubject: string | null;
      authSyncStatus: string;
      accountType: string;
      status: string;
    };
    invitation: { id: string; status: string } | null;
    keycloak: {
      mode: string;
      configured: boolean;
      keycloakUserId: string | null;
      keycloakError: string | null;
      emailActionSent: boolean;
      usedInviteOnlyFallback: boolean;
      missingConfigReasons: string[];
    };
    subscription: { id: string; planSlug: string } | null;
  }> {
    const parsed = adminUserInviteBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const b = parsed.data;
    const email = b.email.toLowerCase().trim();

    if (!["free", "internal"].includes(b.planSlug) && !permissions.has("admin.monetization.write")) {
      throw new BadRequestException(
        "Non-free plan assignment requires admin.monetization.write (or choose free / internal plan)"
      );
    }
    if (b.quotaOverride?.flashcardDayLimit != null) {
      if (!permissions.has("admin.monetization.write")) {
        throw new BadRequestException("Quota override requires admin.monetization.write");
      }
    }

    const existing = await this.prisma.userProfile.findFirst({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: "email_taken",
        userId: existing.id
      });
    }

    if (b.creationMode === "sync_existing_keycloak_user" && !this.kc.isEnabled()) {
      throw new BadRequestException({
        code: "keycloak_admin_not_configured",
        details: this.kc.getDisabledReasons(),
        message: "Cannot sync existing user: Keycloak Admin API is not configured"
      });
    }

    const kcEnabled = this.kc.isEnabled();
    // Operator asked for a Keycloak user but Admin API is not configured: still create an app row + invitation (pending), no KC call.
    const usedFallback = b.creationMode === "create_keycloak_user" && !kcEnabled;

    const initialAuthSync = (): string => {
      if (usedFallback || b.creationMode === "invite_only") {
        return "pending_invite";
      }
      if (b.creationMode === "create_keycloak_user" || b.creationMode === "sync_existing_keycloak_user") {
        return "not_linked";
      }
      return "pending_invite";
    };

    const learner = b.learner;
    const dailyGoalCards =
      b.accountType === "learner" && learner?.dailyStudyMinutes != null
        ? Math.min(200, Math.max(5, Math.round(learner.dailyStudyMinutes / 3)))
        : 20;

    const out = await this.prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.create({
        data: {
          accountType: b.accountType,
          authSyncStatus: initialAuthSync(),
          dailyGoalCards,
          displayName: b.displayName.trim(),
          email,
          explanationLocale: b.explanationLocale,
          keycloakSubject: null,
          learningPersonality: learner?.learningPersonality ?? undefined,
          learningPurpose: learner?.learningPurpose ?? undefined,
          lowPressureMode: learner?.lowPressureMode ?? false,
          dailyStudyMinutes: learner?.dailyStudyMinutes ?? null,
          privacyLevel: "standard",
          status: b.initialStatus,
          targetBjtBand: learner?.targetBjtBand ?? undefined,
          timezone: b.timezone,
          uiLocale: b.uiLocale
        }
      });

      const furigana = learner?.furiganaMode ?? "hover";
      await tx.readingUserPreference.create({
        data: {
          displayMode: furigana,
          userId: user.id
        }
      });

      if (b.accountType === "learner" && learner) {
        if (learner.onboardingRequired) {
          await tx.learnerOnboarding.create({
            data: { currentStep: "not_started", userId: user.id }
          });
        } else {
          await tx.learnerOnboarding.create({
            data: {
              currentStep: "not_started",
              onboardedAt: new Date(),
              userId: user.id
            }
          });
        }
      }

      const meta: Prisma.InputJsonValue = {
        adminAccess: b.adminAccess ?? false,
        creationMode: b.creationMode,
        internalAdminRoleCodes: b.internalAdminRoleCodes ?? [],
        quotaOverride: b.quotaOverride ?? null,
        supportNote: b.supportNote ?? null
      } as Prisma.InputJsonValue;

      const invitation = await tx.userInvitation.create({
        data: {
          accountType: b.accountType,
          creationMode: b.creationMode,
          displayName: b.displayName.trim(),
          email,
          invitedById: actorId,
          keycloakUserId: null,
          metadata: meta,
          status: "pending",
          userProfileId: user.id
        }
      });

      this.auditTx(
        tx,
        actorId,
        "admin.user.invite_created",
        { email, authSyncStatus: user.authSyncStatus, invitationId: invitation.id, userId: user.id },
        null,
        b.creationReason,
        user.id
      );

      this.auditTx(
        tx,
        actorId,
        "admin.user.created",
        { accountType: b.accountType, email, id: user.id, source: "admin_invite" },
        null,
        b.creationReason,
        user.id
      );

      if (b.supportNote?.trim()) {
        this.auditTx(
          tx,
          actorId,
          "admin.user.support_note",
          { body: b.supportNote, kind: "support_note" },
          null,
          b.creationReason,
          user.id
        );
      }

      const plan = await tx.plan.findFirst({ where: { slug: b.planSlug, status: "active" } });
      if (!plan) {
        throw new BadRequestException("Plan not found or inactive");
      }
      const periodEnd =
        b.trialDays && b.trialDays > 0
          ? new Date(Date.now() + b.trialDays * 86_400_000)
          : null;

      await tx.userSubscription.updateMany({
        data: { status: "canceled" },
        where: { userId: user.id, status: { in: ["active", "trialing", "past_due"] } }
      });
      const sub = await tx.userSubscription.create({
        data: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
          currentPeriodStart: new Date(),
          planId: plan.id,
          provider: "admin",
          providerRef: `admin_invite:${actorId}`,
          status: periodEnd ? "trialing" : "active",
          userId: user.id
        }
      });
      this.auditTx(
        tx,
        actorId,
        "admin.user.plan_assigned",
        { planSlug: plan.slug, subscriptionId: sub.id },
        null,
        b.planReason,
        user.id
      );
      await tx.monetizationAuditLog.create({
        data: {
          action: "admin.user.plan_assigned",
          actorKind: "admin",
          payload: { planSlug: plan.slug, reason: b.planReason, userId: user.id } as Prisma.InputJsonValue,
          userId: user.id
        }
      });

      if (b.quotaOverride?.flashcardDayLimit != null) {
        this.auditTx(
          tx,
          actorId,
          "admin.user.quota_override_requested",
          { flashcardDayLimit: b.quotaOverride.flashcardDayLimit, note: "MVP: audit only" },
          null,
          b.planReason,
          user.id
        );
      }

      return { invitation, sub, user };
    });

    const { invitation, sub, user: created } = out;
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
    const planSlug = plan.slug;

    // --- Keycloak (best-effort, outside the transaction): link `sub` ↔ profile; failures → `sync_error` + audit, profile stays.
    let kcId: string | null = null;
    let kcError: string | null = null;
    let emailActionSent = false;

    if (!usedFallback && b.creationMode === "create_keycloak_user" && this.kc.isEnabled()) {
      const actions: string[] = [];
      if (b.requireEmailVerification) {
        actions.push("VERIFY_EMAIL");
      }
      if (b.requirePasswordResetOnFirstLogin) {
        actions.push("UPDATE_PASSWORD");
      }
      try {
        const { id } = await this.kc.createUser({
          displayName: b.displayName,
          email: b.email,
          emailVerified: !b.requireEmailVerification,
          enabled: b.initialStatus !== "disabled",
          requiredActions: actions
        });
        kcId = id;
        await this.prisma.userProfile.update({
          data: { authSyncStatus: "linked", keycloakSubject: id },
          where: { id: created.id }
        });
        await this.prisma.userInvitation.update({
          data: { keycloakUserId: id },
          where: { id: invitation.id }
        });
        this.auditOut(
          actorId,
          "admin.user.keycloak_user_created",
          { keycloakUserId: id, userId: created.id },
          b.creationReason,
          created.id
        );
        if (b.sendInvitationEmail) {
          const toSend = actions.length > 0 ? actions : b.requireEmailVerification ? ["VERIFY_EMAIL"] : [];
          if (toSend.length > 0) {
            emailActionSent = await this.kc.sendExecuteActionsEmail(id, toSend, 43_200);
          }
        }
      } catch (e) {
        kcError = e instanceof Error ? e.message : "keycloak_error";
        await this.prisma.userProfile.update({
          data: { authSyncStatus: "sync_error" },
          where: { id: created.id }
        });
        this.auditOut(
          actorId,
          "admin.user.keycloak_error",
          { error: kcError, userId: created.id },
          b.creationReason,
          created.id
        );
      }
    } else if (b.creationMode === "sync_existing_keycloak_user" && this.kc.isEnabled()) {
      try {
        const id = await this.kc.findUserIdByEmail(b.email);
        if (!id) {
          throw new NotFoundException("No Keycloak user with this email");
        }
        kcId = id;
        await this.prisma.userProfile.update({
          data: { authSyncStatus: "linked", keycloakSubject: id },
          where: { id: created.id }
        });
        await this.prisma.userInvitation.update({
          data: { keycloakUserId: id, status: "accepted" },
          where: { id: invitation.id }
        });
        this.auditOut(
          actorId,
          "admin.user.keycloak_user_linked",
          { keycloakUserId: id, mode: "sync_existing", userId: created.id },
          b.creationReason,
          created.id
        );
        const actions: string[] = [];
        if (b.requireEmailVerification) {
          actions.push("VERIFY_EMAIL");
        }
        if (b.requirePasswordResetOnFirstLogin) {
          actions.push("UPDATE_PASSWORD");
        }
        if (b.sendInvitationEmail && actions.length > 0) {
          emailActionSent = await this.kc.sendExecuteActionsEmail(id, actions, 43_200);
        }
      } catch (e) {
        if (e instanceof NotFoundException) {
          throw e;
        }
        kcError = e instanceof Error ? e.message : "sync_error";
        await this.prisma.userProfile.update({
          data: { authSyncStatus: "sync_error" },
          where: { id: created.id }
        });
      }
    }

    const fresh = await this.prisma.userProfile.findUniqueOrThrow({ where: { id: created.id } });
    return {
      invitation: { id: invitation.id, status: invitation.status },
      keycloak: {
        configured: this.kc.isEnabled(),
        emailActionSent,
        keycloakError: kcError,
        keycloakUserId: kcId,
        missingConfigReasons: this.kc.getDisabledReasons(),
        mode: b.creationMode,
        usedInviteOnlyFallback: usedFallback
      },
      subscription: { id: sub.id, planSlug },
      user: {
        accountType: fresh.accountType,
        authSyncStatus: fresh.authSyncStatus,
        email: fresh.email,
        id: fresh.id,
        keycloakSubject: fresh.keycloakSubject,
        status: fresh.status
      }
    };
  }

  private auditTx(
    tx: PrismaOrTx,
    actorId: string,
    action: string,
    after: unknown,
    before: unknown,
    reason: string,
    userId: string
  ) {
    return tx.adminAuditLog.create({
      data: {
        action,
        actorId,
        after: after as Prisma.InputJsonValue,
        before: before as Prisma.InputJsonValue,
        reason,
        targetId: userId,
        targetType: "user_profile"
      }
    });
  }

  private auditOut(actorId: string, action: string, after: unknown, reason: string, userId: string) {
    return this.auditTx(
      this.prisma,
      actorId,
      action,
      after,
      null,
      reason,
      userId
    );
  }
}
