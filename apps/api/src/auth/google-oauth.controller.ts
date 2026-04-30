import { parseServerEnv, isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { Controller, Get, Inject, Query, Res, ServiceUnavailableException } from "@nestjs/common";
import type { Response } from "express";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { AuthService } from "./auth.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { randomNonce, signOAuthState, verifyOAuthState } from "./oauth-state.util.js";

@Controller("auth/google")
@ApiTags("Auth")
@DocumentedHttpErrors()
export class GoogleOAuthController {
  private readonly webEnv = parseServerEnv(process.env);

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(GoogleOAuthService) private readonly google: GoogleOAuthService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Get("start")
  @ApiOperation({
    summary: "Start Google account linking (OAuth2 redirect)",
    description:
      "Redirects to Google. **State** is signed with server secret (not the Keycloak **client** secret). Requires server env for OAuth; returns **503** if not configured. **No** client credentials in the response or query string."
  })
  @ApiQuery({ name: "ref", required: false, description: "Optional referral code (for landing after link)" })
  @ApiQuery({ name: "ui_locale", required: false, description: "Supported UI locale hint (e.g. vi, ja)" })
  @ApiResponse({ status: 302, description: "Redirect to Google authorize URL" })
  @ApiResponse({ status: 503, description: "Google OAuth or state secret not configured" })
  async start(
    @Query("ref") ref: string | undefined,
    @Query("ui_locale") uiLocale: string | undefined,
    @Res() res: Response
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social login is temporarily disabled"
    });
    this.auth.requireGoogleConfig();
    const secret = this.webEnv.OAUTH_STATE_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException("OAUTH_STATE_SECRET is not set");
    }
    const locale: SupportedLocale | undefined =
      uiLocale && isSupportedLocale(uiLocale) ? uiLocale : undefined;
    const state = signOAuthState(
      {
        exp: Date.now() + 600_000,
        n: randomNonce(),
        ref: ref?.trim().toLowerCase().slice(0, 32),
        locale: locale === "ja" || locale === "vi" ? locale : undefined
      },
      secret
    );
    const url = this.google.buildAuthorizeUrl(state);
    return res.redirect(302, url);
  }

  @Get("callback")
  @ApiOperation({
    summary: "Google OAuth callback (exchanges `code`, links identity, issues web `linkCode`)",
    description:
      "**302** redirects to the web app settings URL with `linkCode` or `authError`. This endpoint is **not** a JSON API. Provider tokens are **not** exposed in the response."
  })
  @ApiQuery({ name: "code", required: false, description: "Authorization code from Google" })
  @ApiQuery({ name: "state", required: false, description: "Signed state from `/start`" })
  @ApiQuery({ name: "error", required: false, description: "Provider error" })
  @ApiResponse({ status: 302, description: "Redirect to web (success or error)" })
  @ApiResponse({ status: 503, description: "OAuth state secret not set" })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social login is temporarily disabled"
    });
    this.auth.requireGoogleConfig();
    const secret = this.webEnv.OAUTH_STATE_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException("OAUTH_STATE_SECRET is not set");
    }
    if (error || !code || !state) {
      return res.redirect(
        302,
        `${this.webEnv.WEB_PUBLIC_URL}/vi/settings/accounts?authError=${encodeURIComponent(error ?? "denied")}`
      );
    }
    const v = verifyOAuthState(state, secret);
    if (!v.ok) {
      return res.redirect(
        302,
        `${this.webEnv.WEB_PUBLIC_URL}/vi/settings/accounts?authError=state`
      );
    }
    const g = await this.google.exchangeCode(code);
    const { user } = await this.auth.upsertUserFromGoogle({
      email: g.email,
      name: g.name,
      refCode: v.payload.ref,
      subject: g.subject
    });
    const { code: linkCode } = await this.auth.createLinkCode(user.id);
    const loc = v.payload.locale === "ja" ? "ja" : "vi";
    return res.redirect(
      302,
      `${this.webEnv.WEB_PUBLIC_URL}/${loc}/settings/accounts?linkCode=${encodeURIComponent(linkCode)}`
    );
  }
}
