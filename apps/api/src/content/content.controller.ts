import { paginationQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { ContentRepository } from "./content.repository.js";

@Controller("content")
@ApiTags("Content")
@ApiOkResponse({ description: "Successful content response." })
export class ContentController {
  constructor(@Inject(ContentRepository) private readonly contentRepository: ContentRepository) {}

  @Get("summary")
  @ApiOperation({ summary: "Aggregate counts and summary for content dashboard (KPIs)." })
  @DocumentedHttpErrors()
  summary() {
    return this.contentRepository.summary();
  }

  @Get("lexemes")
  @ApiTags("Dictionary")
  @ApiOperation({ summary: "List lexemes (optional `q`, `limit` ≤ 50)." })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  @DocumentedHttpErrors()
  lexemes(@Query() query: Record<string, string | undefined>) {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.contentRepository.lexemes(parsed.data.q, parsed.data.limit);
  }

  @Get("kanji")
  @ApiTags("Kanji")
  @ApiOperation({ summary: "List kanji entries (search / pagination via `paginationQuerySchema`)." })
  @DocumentedHttpErrors()
  kanji(@Query() query: Record<string, string | undefined>) {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.contentRepository.kanji(parsed.data.q, parsed.data.limit);
  }

  @Get("grammar")
  @ApiTags("Grammar")
  @ApiOperation({ summary: "List grammar points." })
  @DocumentedHttpErrors()
  grammar(@Query() query: Record<string, string | undefined>) {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.contentRepository.grammar(parsed.data.q, parsed.data.limit);
  }

  @Get("examples")
  @ApiOperation({ summary: "List example sentences." })
  @DocumentedHttpErrors()
  examples(@Query() query: Record<string, string | undefined>) {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.contentRepository.examples(parsed.data.q, parsed.data.limit);
  }
}
