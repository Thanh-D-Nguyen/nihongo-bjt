import { searchQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { SearchService } from "./search.service.js";

@Controller("search")
@ApiTags("Search")
@ApiOkResponse({ description: "Successful search response." })
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: "Meilisearch projection — **read-only** copy of indexed content; canonical data lives in PostgreSQL."
  })
  @ApiQuery({ name: "q", required: true, example: "会議" })
  @ApiQuery({ name: "limit", required: false, example: 10 })
  @DocumentedHttpErrors()
  search(@Query() query: Record<string, string | undefined>) {
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.searchService.search(parsed.data.q, parsed.data.limit);
  }
}
