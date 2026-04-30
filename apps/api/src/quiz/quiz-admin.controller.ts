import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";
import { z } from "zod";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { QuizRepository } from "./quiz.repository.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().trim().min(1).max(32).optional(),
  type: z.string().trim().min(1).max(32).optional()
});

@Controller("admin/quiz")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.quiz" })
@ApiTags("Admin Quiz / BJT")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class QuizAdminController {
  private readonly prisma = createPrismaClient();
  constructor(@Inject(QuizRepository) private readonly quizRepo: QuizRepository) {}

  @Get("tests")
  @ApiOperation({ summary: "List BJT mock tests with pagination. Filter by type and status." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "type", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of BJT mock tests." })
  async listTests(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    return this.quizRepo.adminListTests(parsed);
  }

  @Get("remediation")
  @ApiOperation({ summary: "List questions with remediation card links." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiOkResponse({ description: "Questions with remediation metadata." })
  async listRemediation(@Query() query: Record<string, unknown>) {
    const limit = z.coerce.number().int().min(1).max(200).optional().default(50).parse(query.limit);
    const items = await this.prisma.bjtQuestion.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prompt: true,
        skillTag: true,
        difficulty: true,
        remediationCardId: true,
        explanationVi: true,
        status: true,
        createdAt: true,
        _count: { select: { options: true } }
      },
      take: limit
    });
    return {
      items: items.map((i) => ({
        ...i,
        hasRemediation: i.remediationCardId !== null,
        hasExplanation: i.explanationVi.length > 0
      }))
    };
  }

  @Get("questions")
  @ApiOperation({ summary: "List BJT questions with pagination (question bank)." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of BJT questions." })
  async listQuestions(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.bjtQuestion.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          prompt: true,
          skillTag: true,
          difficulty: true,
          status: true,
          createdAt: true,
          _count: { select: { options: true } }
        },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.bjtQuestion.count({ where })
    ]);
    return { items, total };
  }

  @Get("sessions")
  @ApiOperation({ summary: "List quiz sessions with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of quiz sessions." })
  async listSessions(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.quizSession.findMany({
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          userId: true,
          testId: true,
          status: true,
          totalQuestions: true,
          correctCount: true,
          estimatedScore: true,
          estimatedBjtBand: true,
          startedAt: true,
          completedAt: true
        },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.quizSession.count({ where })
    ]);
    return { items, total };
  }
}
