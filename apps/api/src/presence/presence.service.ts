import { parseServerEnv } from "@nihongo-bjt/config";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

const PRESENCE_KEY = "presence:online";
const LAST_SEEN_KEY = "presence:last_seen";
const HEARTBEAT_TTL_SECONDS = 90;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private redis!: RedisClientType;
  private readonly env = parseServerEnv(process.env);

  async onModuleInit() {
    this.redis = createClient({ url: this.env.REDIS_URL }) as RedisClientType;
    this.redis.on("error", (err: Error) => this.logger.warn(`Redis presence error: ${err.message}`));
    await this.redis.connect();
    this.logger.log("Presence service connected to Redis");
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  /** Mark user as online. Called on socket connect + heartbeat. */
  async setOnline(userId: string): Promise<void> {
    const now = Date.now().toString();
    await Promise.all([
      this.redis.hSet(PRESENCE_KEY, userId, now),
      this.redis.hSet(LAST_SEEN_KEY, userId, now),
    ]);
  }

  /** Mark user as offline. Called on socket disconnect. */
  async setOffline(userId: string): Promise<void> {
    const now = Date.now().toString();
    await Promise.all([
      this.redis.hDel(PRESENCE_KEY, userId),
      this.redis.hSet(LAST_SEEN_KEY, userId, now),
    ]);
  }

  /** Check if a single user is online. */
  async isOnline(userId: string): Promise<boolean> {
    const ts = await this.redis.hGet(PRESENCE_KEY, userId);
    if (!ts) return false;
    // Stale if no heartbeat within TTL
    return Date.now() - Number(ts) < HEARTBEAT_TTL_SECONDS * 1000;
  }

  /** Get presence for multiple users at once. */
  async getPresenceBatch(userIds: string[]): Promise<Record<string, { online: boolean; lastSeenAt: string | null }>> {
    if (userIds.length === 0) return {};

    const [onlineEntries, lastSeenEntries] = await Promise.all([
      Promise.all(userIds.map((id) => this.redis.hGet(PRESENCE_KEY, id))),
      Promise.all(userIds.map((id) => this.redis.hGet(LAST_SEEN_KEY, id))),
    ]);

    const now = Date.now();
    const result: Record<string, { online: boolean; lastSeenAt: string | null }> = {};

    for (let i = 0; i < userIds.length; i++) {
      const onlineTs = onlineEntries[i];
      const lastSeenTs = lastSeenEntries[i];
      const online = !!onlineTs && now - Number(onlineTs) < HEARTBEAT_TTL_SECONDS * 1000;
      result[userIds[i]] = {
        online,
        lastSeenAt: lastSeenTs ? new Date(Number(lastSeenTs)).toISOString() : null,
      };
    }

    return result;
  }

  /** Heartbeat — refreshes TTL for user. */
  async heartbeat(userId: string): Promise<void> {
    await this.setOnline(userId);
  }

  /** Cleanup stale entries (run periodically if needed). */
  async cleanupStale(): Promise<number> {
    const all = await this.redis.hGetAll(PRESENCE_KEY);
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [userId, ts] of Object.entries(all)) {
      if (now - Number(ts) >= HEARTBEAT_TTL_SECONDS * 1000) {
        staleIds.push(userId);
      }
    }

    if (staleIds.length > 0) {
      await this.redis.hDel(PRESENCE_KEY, staleIds);
    }

    return staleIds.length;
  }

  /** Get count of online users. */
  async getOnlineCount(): Promise<number> {
    return this.redis.hLen(PRESENCE_KEY);
  }
}
