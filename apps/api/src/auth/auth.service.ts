import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { ReferralService } from "../growth/referral.service.js";

@Injectable()
export class AuthService {
  private readonly prisma: PrismaClient = createPrismaClient();
  private readonly env = parseServerEnv(process.env);

  constructor(private readonly referral: ReferralService) {}

  isGoogleConfigured(): boolean {
    return Boolean(
      this.env.GOOGLE_OAUTH_CLIENT_ID &&
      this.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      this.env.GOOGLE_OAUTH_REDIRECT_URI &&
      this.env.OAUTH_STATE_SECRET
    );
  }

  requireGoogleConfig() {
    if (this.env.KEYCLOAK_ISSUER_URL) {
      throw new GoneException("Google OAuth is disabled when Keycloak is the sole auth provider");
    }
    if (!this.isGoogleConfigured()) {
      throw new ServiceUnavailableException("Google OAuth is not configured on this server");
    }
  }

  async listIdentities(userId: string) {
    return this.prisma.identityProviderAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        emailAtLink: true,
        id: true,
        provider: true
      },
      where: { userId }
    });
  }

  async exchangeLinkCode(rawCode: string) {
    const hash = createHash("sha256").update(rawCode).digest("hex");
    const row = await this.prisma.authLinkCode.findFirst({
      where: { codeHash: hash, expiresAt: { gt: new Date() }, usedAt: null }
    });
    if (!row) {
      throw new BadRequestException("Invalid or expired link code");
    }
    const user = await this.prisma.userProfile.findFirstOrThrow({ where: { id: row.userId } });
    await this.prisma.authLinkCode.update({ data: { usedAt: new Date() }, where: { id: row.id } });
    return {
      displayName: user.displayName,
      emailMasked: user.email ? maskEmail(user.email) : null,
      userId: user.id
    };
  }

  async unlinkIdentity(params: { accountId: string; userId: string }) {
    const account = await this.prisma.identityProviderAccount.findFirst({
      where: { id: params.accountId, userId: params.userId }
    });
    if (!account) {
      throw new NotFoundException("Identity link not found");
    }
    const count = await this.prisma.identityProviderAccount.count({
      where: { userId: params.userId }
    });
    const hasKeycloak = await this.prisma.userProfile.findFirst({
      select: { keycloakSubject: true },
      where: { id: params.userId }
    });
    const otherLogins = count + (hasKeycloak?.keycloakSubject ? 1 : 0);
    if (otherLogins <= 1) {
      throw new ForbiddenException("Cannot unlink the last login method");
    }
    await this.prisma.identityProviderAccount.delete({ where: { id: account.id } });
    await this.prisma.loginEvent.create({
      data: {
        eventType: "identity_unlinked",
        metadata: { provider: account.provider },
        provider: account.provider,
        userId: params.userId
      }
    });
    return { ok: true };
  }

  async upsertUserFromGoogle(input: {
    email: string;
    name: string;
    refCode?: string;
    subject: string;
  }) {
    const existingIdp = await this.prisma.identityProviderAccount.findUnique({
      include: { user: true },
      where: { provider_providerSubject: { provider: "google", providerSubject: input.subject } }
    });
    if (existingIdp) {
      await this.prisma.loginEvent.create({
        data: {
          eventType: "oauth_callback_success",
          metadata: {},
          provider: "google",
          userId: existingIdp.userId
        }
      });
      await this.referral.ensureReferralCode(existingIdp.userId);
      return { created: false, user: existingIdp.user };
    }
    const byEmail = await this.prisma.userProfile.findFirst({
      where: { email: input.email.toLowerCase() }
    });
    const created = !byEmail;
    const user =
      byEmail ??
      (await this.prisma.userProfile.create({
        data: {
          displayName: input.name.slice(0, 120) || "Learner",
          email: input.email.toLowerCase()
        }
      }));
    if (created && input.refCode) {
      await this.referral.onReferredSignup({ refCode: input.refCode, referredUserId: user.id });
    }
    await this.prisma.identityProviderAccount.create({
      data: {
        emailAtLink: input.email.toLowerCase(),
        provider: "google",
        providerSubject: input.subject,
        userId: user.id
      }
    });
    await this.prisma.loginEvent.create({
      data: {
        eventType: created ? "oauth_signup" : "oauth_link",
        metadata: { linkedEmail: created },
        provider: "google",
        userId: user.id
      }
    });
    await this.referral.ensureReferralCode(user.id);
    return { created, user };
  }

  async createLinkCode(userId: string) {
    const raw = randomBytes(24).toString("base64url");
    const codeHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.prisma.authLinkCode.create({
      data: { codeHash, expiresAt, userId }
    });
    return { code: raw, expiresAt };
  }
}

function maskEmail(email: string) {
  const [a, b] = email.split("@");
  if (!a || !b) {
    return "***";
  }
  const head = a.slice(0, 2);
  return `${head}***@${b}`;
}
