import { Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AnnouncementRepository } from "./announcement.repository.js";

/** Extract optional userId from Keycloak JWT (no guard — anonymous allowed). */
function optionalUserId(req: Request): string | null {
  const principal = (req as unknown as Record<string, unknown>).user as { sub?: string } | undefined;
  return principal?.sub ?? null;
}

@Controller("announcements")
@ApiTags("Announcements")
export class AnnouncementController {
  constructor(
    @Inject(AnnouncementRepository) private readonly repo: AnnouncementRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List active announcements (filters dismissed for auth users)" })
  @ApiOkResponse({ description: "Active announcements ordered by priority then sortOrder" })
  async listActive(@Req() req: Request) {
    const userId = optionalUserId(req);
    if (userId) {
      return this.repo.listActiveForUser(userId);
    }
    return this.repo.listActive();
  }

  @Post(":id/dismiss")
  @ApiOperation({ summary: "Dismiss an announcement (auth users persisted, guests use localStorage)" })
  @ApiParam({ name: "id", description: "Announcement UUID" })
  @ApiOkResponse({ description: "Dismissed" })
  async dismiss(@Req() req: Request, @Param("id") id: string) {
    const userId = optionalUserId(req);
    if (!userId) {
      // Guest — client handles via localStorage
      return { dismissed: true, persisted: false };
    }
    const ann = await this.repo.findById(id);
    if (!ann) {
      return { dismissed: true, persisted: false };
    }
    await this.repo.dismiss(id, userId);
    return { dismissed: true, persisted: true };
  }
}
