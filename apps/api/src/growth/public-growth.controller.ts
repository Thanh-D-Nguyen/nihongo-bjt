import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res
} from "@nestjs/common";
import type { Response } from "express";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { ShareService } from "./share.service.js";
import { ReferralService } from "./referral.service.js";
import { parseServerEnv } from "@nihongo-bjt/config";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { FlashcardsRepository } from "../flashcards/flashcards.repository.js";

@Controller("public")
@ApiTags("Social Sharing")
@DocumentedHttpErrors()
export class PublicGrowthController {
  private readonly env = parseServerEnv(process.env);

  constructor(
    @Inject(ShareService) private readonly share: ShareService,
    @Inject(ReferralService) private readonly referral: ReferralService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService,
    @Inject(FlashcardsRepository) private readonly flashcardsRepository: FlashcardsRepository
  ) {}

  @Get("shares/:token")
  @ApiOperation({
    summary: "Public share metadata (OG-style JSON, privacy-safe snapshot)",
    description: "No authentication. Excludes private learning data beyond the public snapshot."
  })
  @ApiParam({ name: "token", description: "Opaque public share token" })
  async shareJson(@Param("token") token: string) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Public sharing is temporarily disabled"
    });
    const s = await this.share.getPublicSnapshot(token);
    if (!s) {
      throw new NotFoundException("Share not found");
    }
    const api = this.env.API_PUBLIC_URL.replace(/\/$/, "");
    return {
      description: s.title,
      imageUrl: `${api}/api/public/shares/${encodeURIComponent(token)}/image`,
      kind: s.kind,
      summary: s.summary,
      title: s.title
    };
  }

  @Get("shares/:token/image")
  @ApiOperation({ summary: "Rendered share image (PNG) for a public token" })
  @ApiParam({ name: "token", description: "Opaque public share token" })
  async shareImage(@Param("token") token: string, @Res() res: Response) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Public sharing is temporarily disabled"
    });
    const img = await this.share.getImageBufferForToken(token);
    if (!img) {
      throw new NotFoundException("Image not found");
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", img.mimeType);
    return res.send(img.buffer);
  }

  @Get("referral/:code")
  @ApiOperation({ summary: "Record referral link click and redirect to web app", description: "302 redirect; no body." })
  @ApiParam({ name: "code", description: "Referral code" })
  async referralLanding(@Param("code") code: string, @Res() res: Response) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Referral links are temporarily disabled"
    });
    await this.referral.recordLinkClick(code);
    return res.redirect(
      302,
      `${this.env.WEB_PUBLIC_URL}/vi?ref=${encodeURIComponent(code.toLowerCase())}`
    );
  }

  @Get("decks/:token")
  @ApiOperation({ summary: "Public deck preview (no auth). Returns metadata + sample cards." })
  @ApiParam({ name: "token", description: "Opaque deck share token" })
  async publicDeckPreview(@Param("token") token: string) {
    return this.flashcardsRepository.publicDeckPreview(token.trim());
  }
}
