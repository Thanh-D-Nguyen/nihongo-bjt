import { Module } from "@nestjs/common";

import { PresenceGateway } from "./presence.gateway.js";
import { PresenceService } from "./presence.service.js";

@Module({
  exports: [PresenceService, PresenceGateway],
  providers: [PresenceGateway, PresenceService],
})
export class PresenceModule {}
