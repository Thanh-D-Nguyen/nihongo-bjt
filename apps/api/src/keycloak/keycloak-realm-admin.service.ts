import { parseServerEnv } from "@nihongo-bjt/config";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

function issuerBaseAndRealm(issuer: string | undefined): { baseUrl: string; realm: string } | null {
  if (!issuer) {
    return null;
  }
  try {
    const u = new URL(issuer.replace(/\/$/u, ""));
    const m = u.pathname.match(/\/realms\/([^/]+)\/?/u);
    if (!m) {
      return null;
    }
    return { baseUrl: u.origin, realm: m[1]! };
  } catch {
    return null;
  }
}

/**
 * Keycloak **Admin REST** (client credentials) for server-side user lifecycle: create user, find by email,
 * `execute-actions-email` (e.g. `VERIFY_EMAIL`, `UPDATE_PASSWORD`).
 *
 * - **Not** the browser authorization-code flow; tokens here are for machine-to-machine calls only.
 * - **Never** persist `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` or access tokens in PostgreSQL; env is process-only.
 * - Return values (`id` = realm user id) are stored on `user_profile.keycloak_subject` to match OIDC `sub` at login.
 */
@Injectable()
export class KeycloakRealmAdminService implements OnModuleInit {
  private readonly log = new Logger(KeycloakRealmAdminService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  onModuleInit() {
    if (this.isEnabled()) {
      this.log.log(
        `Keycloak realm admin API: enabled (baseUrl=${this.getBaseUrl() ?? "?"} realm=${this.getTargetRealm() ?? "?"})`
      );
    } else {
      this.log.log(`Keycloak realm admin API: disabled — ${this.getDisabledReasons().join("; ")}`);
    }
  }

  private getEnv() {
    return parseServerEnv(process.env);
  }

  /** Public origin for Admin API (e.g. `http://localhost:8080`). */
  getBaseUrl(): string | null {
    const e = this.getEnv();
    const direct = e.KEYCLOAK_BASE_URL?.replace(/\/$/u, "");
    if (direct) {
      return direct;
    }
    const iss = e.KEYCLOAK_ISSUER_URL;
    return issuerBaseAndRealm(iss)?.baseUrl ?? null;
  }

  getTargetRealm(): string | null {
    const e = this.getEnv();
    if (e.KEYCLOAK_USER_ADMIN_TARGET_REALM?.trim()) {
      return e.KEYCLOAK_USER_ADMIN_TARGET_REALM.trim();
    }
    const iss = e.KEYCLOAK_ISSUER_URL;
    return issuerBaseAndRealm(iss)?.realm ?? null;
  }

  isEnabled(): boolean {
    const e = this.getEnv();
    return Boolean(
      this.getBaseUrl() &&
        this.getTargetRealm() &&
        e.KEYCLOAK_USER_ADMIN_CLIENT_ID?.trim() &&
        e.KEYCLOAK_USER_ADMIN_CLIENT_SECRET?.trim()
    );
  }

  /** What is missing to enable admin API (for API responses, not end-user copy). */
  getDisabledReasons(): string[] {
    const e = this.getEnv();
    const out: string[] = [];
    if (!this.getBaseUrl()) {
      out.push("KEYCLOAK_BASE_URL or KEYCLOAK_ISSUER_URL (to derive base URL) is not set");
    }
    if (!this.getTargetRealm()) {
      out.push("KEYCLOAK_USER_ADMIN_TARGET_REALM or parseable KEYCLOAK_ISSUER_URL realm is not set");
    }
    if (!e.KEYCLOAK_USER_ADMIN_CLIENT_ID?.trim()) {
      out.push("KEYCLOAK_USER_ADMIN_CLIENT_ID is not set");
    }
    if (!e.KEYCLOAK_USER_ADMIN_CLIENT_SECRET?.trim()) {
      out.push("KEYCLOAK_USER_ADMIN_CLIENT_SECRET is not set");
    }
    return out;
  }

  private async fetchAccessToken(): Promise<string> {
    const e = this.getEnv();
    const base = this.getBaseUrl();
    const realm = this.getTargetRealm();
    const id = e.KEYCLOAK_USER_ADMIN_CLIENT_ID?.trim();
    const secret = e.KEYCLOAK_USER_ADMIN_CLIENT_SECRET;
    if (!base || !realm || !id || !secret) {
      throw new Error("keycloak_realm_admin_not_configured");
    }
    const tokenUrl = `${base}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials"
    });
    const res = await fetch(tokenUrl, {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST"
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Keycloak token failed: ${res.status} ${t.slice(0, 400)}`);
      throw new Error("keycloak_token_failed");
    }
    const j = (await res.json()) as TokenResponse;
    if (!j.access_token) {
      throw new Error("keycloak_token_missing");
    }
    this.accessToken = j.access_token;
    this.accessTokenExpiresAt = Date.now() + (j.expires_in ?? 60) * 1000 - 10_000;
    return this.accessToken;
  }

  private async bearer(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }
    return this.fetchAccessToken();
  }

  private adminPath(path: string) {
    const base = this.getBaseUrl();
    const realm = this.getTargetRealm();
    if (!base || !realm) {
      throw new Error("keycloak_realm_admin_not_configured");
    }
    return `${base}/admin/realms/${encodeURIComponent(realm)}${path.startsWith("/") ? path : `/${path}`}`;
  }

  /**
   * Search realm user by email. Returns internal Keycloak id (use as `sub` for OIDC) or null.
   */
  async findUserIdByEmail(email: string): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }
    const token = await this.bearer();
    const q = this.adminPath(
      `/users?email=${encodeURIComponent(email.toLowerCase().trim())}&exact=true&max=1`
    );
    const res = await fetch(q, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      this.log.warn(`Keycloak list users: ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as { id: string; email?: string }[];
    return rows[0]?.id ?? null;
  }

  /**
   * Create a realm user (no password). Caller stores returned id in `user_profile.keycloak_subject`.
   */
  async createUser(input: {
    displayName: string;
    email: string;
    emailVerified: boolean;
    enabled: boolean;
    requiredActions: string[];
  }): Promise<{ id: string }> {
    if (!this.isEnabled()) {
      throw new Error("keycloak_realm_admin_not_configured");
    }
    const token = await this.bearer();
    const [first, ...rest] = input.displayName.trim().split(/\s+/u);
    const last = rest.join(" ");
    const body = {
      email: input.email.toLowerCase().trim(),
      emailVerified: input.emailVerified,
      enabled: input.enabled,
      firstName: first ?? input.email,
      lastName: last || "",
      requiredActions: input.requiredActions,
      username: input.email.toLowerCase().trim()
    };
    const res = await fetch(this.adminPath("/users"), {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      method: "POST"
    });
    if (res.status === 409) {
      throw new Error("keycloak_user_conflict");
    }
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Keycloak create user: ${res.status} ${t.slice(0, 500)}`);
      throw new Error("keycloak_create_user_failed");
    }
    const loc = res.headers.get("location");
    const id = loc?.split("/").pop();
    if (id && id.length > 8) {
      return { id };
    }
    const found = await this.findUserIdByEmail(input.email);
    if (found) {
      return { id: found };
    }
    throw new Error("keycloak_create_user_id_unknown");
  }

  /**
   * Trigger default Keycloak "execute actions" email (e.g. VERIFY_EMAIL, UPDATE_PASSWORD).
   */
  async sendExecuteActionsEmail(
    keycloakUserId: string,
    actions: string[],
    lifespanSeconds: number
  ): Promise<boolean> {
    if (!this.isEnabled() || actions.length === 0) {
      return false;
    }
    const token = await this.bearer();
    const u = this.adminPath(`/users/${encodeURIComponent(keycloakUserId)}/execute-actions-email`);
    const res = await fetch(
      `${u}?lifespan=${encodeURIComponent(String(lifespanSeconds))}`,
      {
        body: JSON.stringify(actions),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        method: "PUT"
      }
    );
    if (!res.ok) {
      this.log.warn(`Keycloak execute-actions-email: ${res.status}`);
      return false;
    }
    return true;
  }
}
