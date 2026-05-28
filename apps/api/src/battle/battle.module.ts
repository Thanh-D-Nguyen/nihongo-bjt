import { forwardRef, Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { PresenceModule } from "../presence/presence.module.js";
import { BattleAbuseAdminController } from "./battle-abuse-admin.controller.js";
import { BattleAbuseAdminRepository } from "./battle-abuse-admin.repository.js";
import { BattleAdminController } from "./battle-admin.controller.js";
import { BattleBotsAdminController } from "./battle-bots-admin.controller.js";
import { BattleBotsAdminRepository } from "./battle-bots-admin.repository.js";
import { BattleConfigsAdminController } from "./battle-configs-admin.controller.js";
import { BattleConfigsAdminRepository } from "./battle-configs-admin.repository.js";
import { BattleLeaderboardAdminController } from "./battle-leaderboard-admin.controller.js";
import { BattleLeaderboardAdminRepository } from "./battle-leaderboard-admin.repository.js";
import { BattleLeaderboardLearnerRepository } from "./battle-leaderboard-learner.repository.js";
import { BattleMatchesAdminController } from "./battle-matches-admin.controller.js";
import { BattleMatchesAdminRepository } from "./battle-matches-admin.repository.js";
import { BattleController } from "./battle.controller.js";
import { BattleGateway } from "./battle.gateway.js";
import { BattleOrchestratorService } from "./battle-orchestrator.service.js";
import { BattleRepository } from "./battle.repository.js";
import { BotChatResponderPort } from "./bot-chat-responder.port.js";
import { InMemoryMatchmakingStub, MatchmakingPort } from "./matchmaking.port.js";
import { TemplateBotChatResponder } from "./template-bot-chat-responder.js";

@Module({
  controllers: [
    BattleController,
    BattleAdminController,
    BattleConfigsAdminController,
    BattleMatchesAdminController,
    BattleLeaderboardAdminController,
    BattleBotsAdminController,
    BattleAbuseAdminController
  ],
  imports: [AdminModule, forwardRef(() => PresenceModule)],
  providers: [
    BattleRepository,
    BattleConfigsAdminRepository,
    BattleMatchesAdminRepository,
    BattleLeaderboardAdminRepository,
    BattleLeaderboardLearnerRepository,
    BattleBotsAdminRepository,
    BattleAbuseAdminRepository,
    BattleOrchestratorService,
    BattleGateway,
    { provide: MatchmakingPort, useClass: InMemoryMatchmakingStub },
    { provide: BotChatResponderPort, useClass: TemplateBotChatResponder }
  ]
})
export class BattleModule {}
