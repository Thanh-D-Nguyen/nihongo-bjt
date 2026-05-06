import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AnnouncementRepository } from "./announcement.repository.js";

@Controller("announcements")
@ApiTags("Announcements")
export class AnnouncementController {
  constructor(
    @Inject(AnnouncementRepository) private readonly repo: AnnouncementRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List active announcements for homepage strip" })
  @ApiOkResponse({ description: "Active announcements ordered by sortOrder" })
  async listActive() {
    return this.repo.listActive();
  }
}
