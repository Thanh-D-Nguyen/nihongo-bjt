import { paginationQuerySchema, searchQuerySchema } from "@nihongo-bjt/shared";
import { parseServerEnv } from "@nihongo-bjt/config";
import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
  StreamableFile
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { MediaService } from "../media/media.service.js";
import { ContentRepository } from "./content.repository.js";
import { isRepoRelativeKanjiStrokePath, openKanjiStrokeRepoReadStream } from "./kanji-stroke-repo-path.util.js";

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
  constructor(
    @Inject(ContentRepository) contentRepository: ContentRepository,
    private readonly mediaService: MediaService
  ) {
    super(contentRepository);
  }

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

  @Get(":id/stroke")
  @Header("Cache-Control", "public, max-age=86400")
  @ApiOperation({
    summary:
      "Kanji stroke-order SVG (same-origin): reads repo files under data/generated/kanji-strokes/, streams object storage keys, or fetches allowlisted HTTPS (avoids browser→MinIO CORS)."
  })
  @ApiParam({ name: "id" })
  async stroke(@Param("id") id: string): Promise<StreamableFile> {
    const strokeSvgPath = await this.contentRepository.kanjiStrokeSvgPath(id);
    if (!strokeSvgPath) {
      throw new NotFoundException("Kanji stroke diagram is not available");
    }

    if (strokeSvgPath.startsWith("<")) {
      throw new BadRequestException("Inline stroke SVG is delivered in JSON; use client rendering");
    }

    if (/^https?:\/\//i.test(strokeSvgPath)) {
      const env = parseServerEnv(process.env);
      let url: URL;
      try {
        url = new URL(strokeSvgPath);
      } catch {
        throw new BadRequestException("Invalid stroke SVG URL");
      }
      if (!strokeSvgFetchHostAllowed(url.hostname, env)) {
        throw new BadRequestException("Stroke SVG URL host is not allowlisted for server fetch");
      }
      const upstream = await fetch(strokeSvgPath, { redirect: "follow" });
      if (upstream.status === 404) {
        throw new NotFoundException("Upstream stroke SVG not found");
      }
      if (!upstream.ok) {
        throw new BadGatewayException("Upstream stroke SVG could not be fetched");
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > 2_000_000) {
        throw new BadRequestException("Stroke SVG exceeds size limit");
      }
      return new StreamableFile(buf, { type: "image/svg+xml; charset=utf-8" });
    }

    if (isRepoRelativeKanjiStrokePath(strokeSvgPath)) {
      const stream = openKanjiStrokeRepoReadStream(strokeSvgPath);
      return new StreamableFile(stream, { type: "image/svg+xml; charset=utf-8" });
    }

    const key = strokeSvgPath.replace(/^\/+/, "");
    const stream = await this.mediaService.streamPublicBucketObject(key);
    return new StreamableFile(stream, { type: "image/svg+xml; charset=utf-8" });
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

function strokeSvgExtraFetchHosts(): string[] {
  return (process.env.KANJI_STROKE_SVG_FETCH_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function strokeSvgFetchHostAllowed(hostname: string, env: ReturnType<typeof parseServerEnv>): boolean {
  const h = hostname.toLowerCase();
  const allowed = new Set<string>([
    env.MINIO_ENDPOINT.toLowerCase(),
    "localhost",
    "127.0.0.1",
    ...strokeSvgExtraFetchHosts()
  ]);
  return allowed.has(h);
}
