import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";

/**
 * Public legal info controller.
 * Serves current published policy documents for legal/compliance pages.
 * All routes are public (no auth required).
 *
 * - /legal/tokusho: Japanese e-commerce disclosure law (特定商取引法に基づく表記).
 * - /legal/cookies: Cookie policy.
 *
 * Content is served from the LegalPolicy table (status=published, latest effectiveAt per key).
 * Returns minimal non-404 response when no published policy exists (content is TBD placeholder).
 */
@Controller("legal")
@ApiTags("Legal")
export class LegalInfoController {
  private readonly prisma = createPrismaClient();

  private async getLatestPublished(policyKey: string) {
    return this.prisma.legalPolicy.findFirst({
      orderBy: { effectiveAt: "desc" },
      where: {
        effectiveAt: { lte: new Date() },
        policyKey,
        status: "published"
      }
    });
  }

  @Get("tokusho")
  @ApiOperation({
    summary: "特定商取引法に基づく表記 (Japanese e-commerce law disclosure)",
    description:
      "Returns the published tokusho policy document. Content is stored in LegalPolicy table with policyKey='tokusho'. Not financial/legal advice; educational context only."
  })
  async tokusho() {
    const policy = await this.getLatestPublished("tokusho");
    return {
      policyKey: "tokusho",
      version: policy?.version ?? null,
      effectiveAt: policy?.effectiveAt ?? null,
      contentMd: policy?.contentMd ?? null,
      // Non-null status so the page renders even if contentMd is pending
      status: policy ? "published" : "coming_soon"
    };
  }

  @Get("cookies")
  @ApiOperation({
    summary: "Cookie policy",
    description: "Returns the published cookie policy document."
  })
  async cookies() {
    const policy = await this.getLatestPublished("cookie_policy");
    return {
      policyKey: "cookie_policy",
      version: policy?.version ?? null,
      effectiveAt: policy?.effectiveAt ?? null,
      contentMd: policy?.contentMd ?? null,
      status: policy ? "published" : "coming_soon"
    };
  }

  @Get("terms")
  @ApiOperation({ summary: "Terms of service" })
  async terms() {
    const policy = await this.getLatestPublished("terms_of_service");
    return {
      policyKey: "terms_of_service",
      version: policy?.version ?? null,
      effectiveAt: policy?.effectiveAt ?? null,
      contentMd: policy?.contentMd ?? null,
      status: policy ? "published" : "coming_soon"
    };
  }

  @Get("privacy")
  @ApiOperation({ summary: "Privacy policy" })
  async privacy() {
    const policy = await this.getLatestPublished("privacy_policy");
    return {
      policyKey: "privacy_policy",
      version: policy?.version ?? null,
      effectiveAt: policy?.effectiveAt ?? null,
      contentMd: policy?.contentMd ?? null,
      status: policy ? "published" : "coming_soon"
    };
  }
}
