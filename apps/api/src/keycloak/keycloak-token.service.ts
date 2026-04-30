import { parseServerEnv, type ServerEnv } from "@nihongo-bjt/config";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyOptions } from "jose";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import type { KeycloakJwtPayload } from "./keycloak.types.js";

@Injectable()
export class KeycloakTokenService {
  private readonly env: ServerEnv;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly issuer: string | null;

  constructor() {
    this.env = parseServerEnv(process.env);
    const issuer = this.env.KEYCLOAK_ISSUER_URL?.replace(/\/$/u, "") ?? null;
    this.issuer = issuer;
    const jwksPath =
      this.env.KEYCLOAK_JWKS_URL?.replace(/\/$/u, "") ??
      (issuer ? `${issuer}/protocol/openid-connect/certs` : null);
    this.jwks = jwksPath ? createRemoteJWKSet(new URL(jwksPath)) : null;
  }

  isEnabled(): boolean {
    return Boolean(this.jwks && this.issuer && this.env.KEYCLOAK_CLIENT_ID);
  }

  getIssuer(): string | null {
    return this.issuer;
  }

  private audienceList(): string[] {
    const fromEnv = this.env.KEYCLOAK_EXPECTED_AUDIENCE?.split(",").map((s) => s.trim()).filter(Boolean);
    if (fromEnv && fromEnv.length > 0) {
      return fromEnv;
    }
    if (this.env.KEYCLOAK_CLIENT_ID) {
      return [this.env.KEYCLOAK_CLIENT_ID];
    }
    return [];
  }

  /**
   * Validates access token signature (JWKS), issuer, audience, expiration.
   */
  async verifyAccessToken(token: string): Promise<KeycloakJwtPayload> {
    if (!this.jwks || !this.issuer) {
      throw new UnauthorizedException("Keycloak is not configured");
    }
    const audiences = this.audienceList();
    const opts: JWTVerifyOptions = { issuer: this.issuer };
    if (audiences.length === 1) {
      opts.audience = audiences[0];
    } else if (audiences.length > 1) {
      opts.audience = audiences;
    }
    try {
      const { payload } = await jwtVerify(token, this.jwks, opts);
      return payload as KeycloakJwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
