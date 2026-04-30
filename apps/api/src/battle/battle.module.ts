import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { BattleAdminController } from "./battle-admin.controller.js";
import { BattleController } from "./battle.controller.js";
import { BattleGateway } from "./battle.gateway.js";
import { BattleOrchestratorService } from "./battle-orchestrator.service.js";
import { BattleRepository } from "./battle.repository.js";
import { InMemoryMatchmakingStub, MatchmakingPort } from "./matchmaking.port.js";

@Module({
  controllers: [BattleController, BattleAdminController],
  imports: [AdminModule],
  providers: [
    BattleRepository,
    BattleOrchestratorService,
    BattleGateway,
    { provide: MatchmakingPort, useClass: InMemoryMatchmakingStub }
  ]
})
export class BattleModule {}
