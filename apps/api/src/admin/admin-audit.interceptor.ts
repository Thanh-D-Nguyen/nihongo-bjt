import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor
} from "@nestjs/common";
import type { Prisma } from "@nihongo-bjt/database";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Observable, tap } from "rxjs";

import { AdminAuditService } from "./admin-audit.service.js";
import { ADMIN_AUDIT_METADATA_KEY, type LogAdminActionOptions } from "./admin-audit.decorator.js";
import type { AdminRequest } from "./admin-rbac.guard.js";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AdminAuditService) private readonly auditService: AdminAuditService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<LogAdminActionOptions>(ADMIN_AUDIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AdminRequest>();
    const method = req.method.toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const beforeState = this.buildBeforeState(req);

    return next.handle().pipe(
      tap(async (result) => {
        const actorId = req.adminPrincipal?.actorId;
        if (!actorId) {
          return;
        }

        await this.auditService.createAuditLog({
          action: meta.action ?? `${method} ${this.resolvePath(req)}`,
          adminUserId: actorId,
          afterState: this.buildAfterState(result) as Prisma.InputJsonValue,
          beforeState: beforeState as Prisma.InputJsonValue,
          resourceId: this.resolveResourceId(req),
          resourceType: meta.resourceType,
          timestamp: new Date()
        });
      })
    );
  }

  private buildBeforeState(req: Request) {
    return {
      body: req.body ?? null,
      params: req.params ?? {},
      query: req.query ?? {}
    };
  }

  private buildAfterState(result: unknown) {
    if (result === null || result === undefined) {
      return { result: null };
    }
    if (typeof result !== "object") {
      return { result };
    }
    return result as Record<string, unknown>;
  }

  private resolveResourceId(req: Request): string | undefined {
    return req.params?.id ?? req.params?.key ?? req.params?.planId ?? req.params?.userId;
  }

  private resolvePath(req: Request): string {
    const routePath = req.route?.path;
    return typeof routePath === "string" ? routePath : req.path;
  }
}
