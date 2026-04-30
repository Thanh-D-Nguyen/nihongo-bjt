import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type MissingBehavior = "allow" | "deny";

@Injectable()
export class RuntimeFeatureGateService {
  private readonly prisma = createPrismaClient();

  async requireEnabled(
    key: string,
    options?: {
      message?: string;
      missingBehavior?: MissingBehavior;
    }
  ) {
    const missingBehavior = options?.missingBehavior ?? "deny";
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });

    if (!flag) {
      if (missingBehavior === "allow") return;
      throw this.unavailable(key, options?.message ?? "Feature flag is not configured");
    }

    if (!flag.enabled || flag.killSwitch) {
      throw this.unavailable(key, options?.message ?? "Feature is temporarily unavailable");
    }
  }

  private unavailable(key: string, message: string) {
    return new ServiceUnavailableException({
      code: "feature_disabled",
      feature: key,
      message
    });
  }
}
