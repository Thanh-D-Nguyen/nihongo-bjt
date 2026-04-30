import { paginationQuerySchema, searchQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { ContentRepository } from "./content.repository.js";

@ApiTags("Dictionary", "Content")
@DocumentedHttpErrors()
export class CanonicalContentBase {
  constructor(@Inject(ContentRepository) protected readonly contentRepository: ContentRepository) {}

  protected parsePagination(query: Record<string, string | undefined>) {
    const parsed = paginationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }
}

@Controller("dictionary")
export class DictionaryController extends CanonicalContentBase {
  @Get("search")
  @ApiOperation({ summary: "Canonical v15 JP->VI dictionary search backed by PostgreSQL content." })
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  search(@Query() query: Record<string, string | undefined>) {
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.contentRepository.lexemes(parsed.data.q, parsed.data.limit);
  }

  @Get("words/:id")
  @ApiOperation({ summary: "Canonical v15 dictionary word detail." })
  @ApiParam({ name: "id" })
  detail(@Param("id") id: string) {
    return this.contentRepository.lexemeDetail(id);
  }
}

@Controller("kanji")
@ApiTags("Kanji")
export class KanjiController extends CanonicalContentBase {
  @Get()
  @ApiOperation({ summary: "Canonical v15 kanji list." })
  list(@Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination({ ...query, q: query.q ?? query.level });
    return this.contentRepository.kanji(parsed.q, parsed.limit);
  }

  @Get("search")
  @ApiOperation({ summary: "Canonical v15 kanji search." })
  search(@Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination(query);
    return this.contentRepository.kanji(parsed.q, parsed.limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Canonical v15 kanji detail." })
  @ApiParam({ name: "id" })
  detail(@Param("id") id: string) {
    return this.contentRepository.kanjiDetail(id);
  }
}

@Controller("grammar")
@ApiTags("Grammar")
export class GrammarController extends CanonicalContentBase {
  @Get()
  @ApiOperation({ summary: "Canonical v15 grammar list." })
  list(@Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination({ ...query, q: query.q ?? query.level });
    return this.contentRepository.grammar(parsed.q, parsed.limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Canonical v15 grammar detail." })
  @ApiParam({ name: "id" })
  detail(@Param("id") id: string) {
    return this.contentRepository.grammarDetail(id);
  }
}

@Controller("examples")
@ApiTags("Content")
export class ExamplesController extends CanonicalContentBase {
  @Get()
  @ApiOperation({ summary: "Canonical v15 example sentence list." })
  list(@Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination(query);
    return this.contentRepository.examples(parsed.q, parsed.limit);
  }

  @Get("by-word/:wordId")
  @ApiOperation({ summary: "Canonical v15 examples linked to a dictionary word." })
  @ApiParam({ name: "wordId" })
  byWord(@Param("wordId") wordId: string, @Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination(query);
    return this.contentRepository.examplesByWord(wordId, parsed.limit);
  }

  @Get("search")
  @ApiOperation({ summary: "Canonical v15 example search." })
  search(@Query() query: Record<string, string | undefined>) {
    const parsed = this.parsePagination({ ...query, q: query.keyword ?? query.q });
    return this.contentRepository.examples(parsed.q, parsed.limit);
  }
}

@Controller("vija")
@ApiTags("Dictionary")
export class VijaController extends CanonicalContentBase {
  @Get("search")
  @ApiOperation({ summary: "Canonical v15 VI->JP reverse dictionary search." })
  search(@Query() query: Record<string, string | undefined>) {
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.contentRepository.reverseSearch(parsed.data.q, parsed.data.limit);
  }
}
