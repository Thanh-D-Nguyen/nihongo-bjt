import { parseServerEnv } from "@nihongo-bjt/config";
import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class GoogleOAuthService {
  private readonly env = parseServerEnv(process.env);

  buildAuthorizeUrl(state: string) {
    const id = this.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    const redirect = this.env.GOOGLE_OAUTH_REDIRECT_URI ?? "";
    const params = new URLSearchParams({
      access_type: "online",
      client_id: id,
      prompt: "select_account",
      redirect_uri: redirect,
      response_type: "code",
      scope: ["openid", "email", "profile"].join(" "),
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string) {
    const id = this.env.GOOGLE_OAUTH_CLIENT_ID;
    const secret = this.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirect = this.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!id || !secret || !redirect) {
      throw new UnauthorizedException("Google OAuth is not configured");
    }
    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirect
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST"
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException("Google token exchange failed");
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new UnauthorizedException("Google token missing");
    }
    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    if (!userRes.ok) {
      throw new UnauthorizedException("Google userinfo failed");
    }
    const u = (await userRes.json()) as {
      email?: string;
      name?: string;
      sub: string;
    };
    if (!u.email) {
      throw new UnauthorizedException("Google account has no email");
    }
    return { email: u.email, name: u.name ?? u.email, subject: u.sub };
  }
}
