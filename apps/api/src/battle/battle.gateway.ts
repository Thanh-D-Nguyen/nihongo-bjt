import { parseServerEnv } from "@nihongo-bjt/config";
import {
  battleAcceptChallengeSchema,
  battleAnswerSchema,
  battleChallengeBotSchema,
  battleDeclineChallengeSchema,
  battleLobbyChallengeUserSchema,
  battleLobbyJoinSchema,
  battleLobbyMessageSchema,
  battlePvpAnswerSchema,
  battlePvpForfeitSchema
} from "@nihongo-bjt/shared";
import { BadRequestException, Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { SkipThrottle } from "@nestjs/throttler";
import type { Namespace, Socket } from "socket.io";

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
@SkipThrottle()
export class BattleGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(BattleGateway.name);

  @WebSocketServer()
  private readonly nsp!: Namespace;

  constructor(
    @Inject(BattleOrchestratorService)
    private readonly orchestrator: BattleOrchestratorService
  ) {}

  afterInit() {
    this.orchestrator.setNamespace(this.nsp);
  }

  handleConnection(client: Socket) {
    this.logger.debug(`socket connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    if (!this.orchestrator) {
      this.logger.warn(`socket disconnected before battle orchestrator was available ${client.id}`);
      return;
    }
    this.orchestrator.onDisconnect(client.id);
  }

  @SubscribeMessage("battle:lobby_join")
  async onLobbyJoin(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleLobbyJoinSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    await this.orchestrator.joinLobby(client, parsed.data);
  }

  @SubscribeMessage("battle:lobby_message")
  async onLobbyMessage(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleLobbyMessageSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.sendLobbyMessage(client, parsed.data);
    } catch (error) {
      this.logger.warn(`battle lobby message error: ${(error as Error).message}`);
      client.emit("battle:lobby_error", { code: "message_rejected" });
    }
  }

  @SubscribeMessage("battle:challenge_user")
  async onChallengeUser(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleLobbyChallengeUserSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    await this.orchestrator.challengeUser(client, parsed.data);
  }

  @SubscribeMessage("battle:answer")
  async onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
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
  async onChallengeBot(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
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

  @SubscribeMessage("battle:accept_challenge")
  async onAcceptChallenge(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleAcceptChallengeSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.acceptChallenge(client, parsed.data);
    } catch (error) {
      this.logger.warn(`accept challenge error: ${(error as Error).message}`);
      client.emit("battle:error", { code: "accept_failed" });
    }
  }

  @SubscribeMessage("battle:decline_challenge")
  async onDeclineChallenge(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    const parsed = battleDeclineChallengeSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:lobby_error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.declineChallenge(client, parsed.data);
    } catch (error) {
      this.logger.warn(`decline challenge error: ${(error as Error).message}`);
    }
  }

  @SubscribeMessage("battle:pvp_answer")
  async onPvpAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    const parsed = battlePvpAnswerSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.submitPvpAnswer(client, parsed.data);
    } catch (error) {
      this.logger.warn(`pvp answer error: ${(error as Error).message}`);
      client.emit("battle:error", { code: "answer_rejected" });
    }
  }

  @SubscribeMessage("battle:pvp_forfeit")
  async onPvpForfeit(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const raw = parseSocketMessageBody(body);
    if (raw === null) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    const parsed = battlePvpForfeitSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit("battle:error", { code: "invalid_payload" });
      return;
    }
    try {
      await this.orchestrator.forfeitPvpRoom(client, parsed.data);
    } catch (error) {
      this.logger.warn(`pvp forfeit error: ${(error as Error).message}`);
    }
  }
}
