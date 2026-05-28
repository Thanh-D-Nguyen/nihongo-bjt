import { Module } from "@nestjs/common";

import { PresenceModule } from "../presence/presence.module.js";
import { PublicProfileController } from "./public-profile.controller.js";
import { PublicProfileRepository } from "./public-profile.repository.js";

@Module({
  controllers: [PublicProfileController],
  exports: [PublicProfileRepository],
  imports: [PresenceModule],
  providers: [PublicProfileRepository],
})
export class PublicProfileModule {}
