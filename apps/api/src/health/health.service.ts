import { createPrismaClient } from "@nihongo-bjt/database";
import { parseServerEnv } from "@nihongo-bjt/config";
import type { HealthStatus } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";
import { Socket } from "node:net";

import { KeycloakRealmAdminService } from "../keycloak/keycloak-realm-admin.service.js";

const service = "nihongo-bjt-api";
const version = process.env.npm_package_version ?? "0.0.0";

@Injectable()
export class HealthService {
  private readonly prisma = createPrismaClient();
  private readonly env = parseServerEnv(process.env);

  constructor(private readonly keycloakRealmAdmin: KeycloakRealmAdminService) {}

  live(): HealthStatus {
    return {
      checkedAt: new Date().toISOString(),
      service,
      status: "ok",
      version
    };
  }

  async ready(): Promise<HealthStatus> {
    const checks: NonNullable<HealthStatus["checks"]> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "ok" };
    } catch {
      checks.database = {
        message: "database_unreachable",
        status: "degraded"
      };
    }

    checks.redis = await this.checkRedis();
    checks.search = await this.checkSearch();

    checks.media_provider = {
      message: `minio_endpoint=${this.env.MINIO_ENDPOINT}:${this.env.MINIO_PORT}`,
      status: "ok"
    };

    const kc = this.keycloakRealmAdmin;
    if (kc.isEnabled()) {
      checks.keycloak_realm_admin = { message: "enabled", status: "ok" };
    } else {
      checks.keycloak_realm_admin = {
        message: `not_configured: ${kc.getDisabledReasons().join("; ")}`.slice(0, 500),
        status: "degraded"
      };
    }

    const status = Object.values(checks).every((check) => check.status === "ok")
      ? "ok"
      : "degraded";

    return {
      checkedAt: new Date().toISOString(),
      checks,
      service,
      status,
      version
    };
  }

  version() {
    const kc = this.keycloakRealmAdmin;
    const enabled = kc.isEnabled();
    return {
      keycloakRealmAdmin: {
        enabled,
        ...(!enabled && { disabledReasons: kc.getDisabledReasons() })
      },
      service,
      version
    };
  }

  protected async checkRedis(): Promise<{ status: "ok" | "degraded"; message?: string }> {
    let redisUrl: URL;
    try {
      redisUrl = new URL(this.env.REDIS_URL);
    } catch {
      return { message: "redis_url_invalid", status: "degraded" };
    }

    const port = Number(redisUrl.port || 6379);
    const host = redisUrl.hostname;

    return await new Promise((resolve) => {
      const socket = new Socket();
      let settled = false;

      const done = (result: { status: "ok" | "degraded"; message?: string }) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(1200);
      socket.once("error", () => done({ message: "redis_unreachable", status: "degraded" }));
      socket.once("timeout", () => done({ message: "redis_timeout", status: "degraded" }));
      socket.connect(port, host, () => {
        socket.write("*1\r\n$4\r\nPING\r\n");
      });
      socket.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        if (text.includes("PONG")) {
          done({ status: "ok" });
        } else {
          done({ message: "redis_unexpected_response", status: "degraded" });
        }
      });
    });
  }

  protected async checkSearch(): Promise<{ status: "ok" | "degraded"; message?: string }> {
    const base = this.env.MEILI_HOST.replace(/\/$/u, "");
    try {
      const response = await fetch(`${base}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(1500)
      });
      if (!response.ok) {
        return { message: `search_http_${response.status}`, status: "degraded" };
      }
      return { status: "ok" };
    } catch {
      return { message: "search_unreachable", status: "degraded" };
    }
  }
}
