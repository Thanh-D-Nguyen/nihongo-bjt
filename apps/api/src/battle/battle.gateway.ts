import { parseServerEnv } from "@nihongo-bjt/config";
import { battleAnswerSchema, battleChallengeBotSchema } from "@nihongo-bjt/shared";
import { BadRequestException, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import type { Socket } from "socket.io";

import { BattleOrchestratorService } from "./battle-orchestrator.service.js";

function parseSocketMessageBody(body: unknown): unknown | null {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  return body;
}

const parseOrigins = () => {
  try {
    return parseServerEnv(process.env).CORS_ORIGINS;
  } catch {
    return ["http://localhost:3000", "http://localhost:3001"];
  }
};

@WebSocketGateway({
  cors: { credentials: true, origin: parseOrigins() },
  namespace: "/battle"
})
export class BattleGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BattleGateway.name);

  constructor(private readonly orchestrator: BattleOrchestratorService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`socket connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.orchestrator.onDisconnect(client.id);
  }

  @SubscribeMessage("battle:answer")
  async onAnswer(@ConnectedSocket() client: Socket, body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleAnswerSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.submitAnswer(client, parsed.data);
    } catch (error) {
      this.logger.warn(`battle answer error: ${(error as Error).message}`);
      client.emit("battle:error", { code: "answer_rejected" });
    }
  }

  @SubscribeMessage("battle:challenge_bot")
  async onChallengeBot(@ConnectedSocket() client: Socket, body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleChallengeBotSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.startBotBattle(client, parsed.data);
    } catch (error) {
      this.logger.warn(`challenge bot error: ${(error as Error).message}`);
      if (error instanceof BadRequestException) {
        const payload = error.getResponse();
        const message =
          typeof payload === "string"
            ? payload
            : typeof payload === "object" && payload && "message" in payload
              ? String((payload as { message?: unknown }).message)
              : "";
        if (message.includes("invalid_bot_key")) {
          client.emit("battle:error", { code: "invalid_bot" });
          return;
        }
        client.emit("battle:error", { code: "no_questions" });
        return;
      }
      client.emit("battle:error", { code: "start_failed" });
    }
  }
}
