import { parseServerEnv } from "@nihongo-bjt/config";
import { Inject, Logger } from "@nestjs/common";
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

import { PresenceService } from "./presence.service.js";
import { KeycloakTokenService } from "../keycloak/keycloak-token.service.js";
import { KeycloakUserService } from "../keycloak/keycloak-user.service.js";

const parseOrigins = () => {
  try {
    return parseServerEnv(process.env).CORS_ORIGINS;
  } catch {
    return ["http://localhost:3000", "http://localhost:3001"];
  }
};

interface AuthenticatedSocket extends Socket {
  data: { userId?: string; displayName?: string };
}

@WebSocketGateway({
  cors: { credentials: true, origin: parseOrigins() },
  namespace: "/presence"
})
@SkipThrottle()
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(PresenceGateway.name);
  /** Map socketId → userId for fast disconnection lookup */
  private readonly socketUserMap = new Map<string, string>();

  @WebSocketServer()
  private readonly nsp!: Namespace;

  /**
   * Send an event to a specific user across all their connected tabs/devices.
   * Returns true if the user had at least one active presence socket.
   */
  emitToUser(userId: string, event: string, payload: unknown): boolean {
    const socketIds: string[] = [];
    for (const [sid, uid] of this.socketUserMap) {
      if (uid === userId) socketIds.push(sid);
    }
    if (socketIds.length === 0) return false;
    for (const sid of socketIds) {
      this.nsp.to(sid).emit(event, payload);
    }
    return true;
  }

  constructor(
    @Inject(PresenceService) private readonly presence: PresenceService,
    @Inject(KeycloakTokenService) private readonly tokens: KeycloakTokenService,
    @Inject(KeycloakUserService) private readonly users: KeycloakUserService
  ) {}

  afterInit() {
    this.logger.log("Presence gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }

      const claims = await this.tokens.verifyAccessToken(token);
      const { appUserId } = await this.users.provisionLearner(claims);

      client.data.userId = appUserId;
      client.data.displayName =
        typeof claims.name === "string" ? claims.name : claims.preferred_username ?? "Learner";

      this.socketUserMap.set(client.id, appUserId);
      await this.presence.setOnline(appUserId);

      // Broadcast presence change to all connected clients
      this.nsp.emit("presence:user_online", {
        userId: appUserId,
        displayName: client.data.displayName,
      });

      this.logger.debug(`User ${appUserId} connected for presence`);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    this.socketUserMap.delete(client.id);

    // Check if user has other active sockets (multi-tab)
    const otherSockets = Array.from(this.socketUserMap.values()).includes(userId);
    if (!otherSockets) {
      await this.presence.setOffline(userId);
      this.nsp.emit("presence:user_offline", { userId });
    }

    this.logger.debug(`User ${userId} disconnected from presence`);
  }

  @SubscribeMessage("presence:heartbeat")
  async onHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      await this.presence.heartbeat(userId);
    }
  }

  @SubscribeMessage("presence:query")
  async onQuery(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: unknown
  ) {
    const parsed = parseQueryBody(body);
    if (!parsed) {
      client.emit("presence:error", { message: "Invalid query body" });
      return;
    }

    const result = await this.presence.getPresenceBatch(parsed.userIds);
    client.emit("presence:query_result", result);
  }
}

function parseQueryBody(body: unknown): { userIds: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.userIds)) return null;
  const userIds = obj.userIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (userIds.length === 0 || userIds.length > 50) return null;
  return { userIds };
}
