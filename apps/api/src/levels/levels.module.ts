import { createPrismaClient } from "@nihongo-bjt/database";
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Injectable, Module } from "@nestjs/common";

/* ── Level taxonomy (BJT J5 → J1+) ────────────────────────── */

interface LevelDefinition {
  code: string;
  nameJa: string;
  nameVi: string;
  scoreMin: number;
  scoreMax: number;
  jlptEquiv: string;
  descriptionVi: string;
  descriptionJa: string;
  color: string;
}

const LEVELS: LevelDefinition[] = [
  {
    code: "J5",
    nameJa: "J5 — 初級前半",
    nameVi: "J5 — Sơ cấp",
    scoreMin: 0,
    scoreMax: 199,
    jlptEquiv: "N5",
    descriptionVi: "Giao tiếp cơ bản: chào hỏi, tự giới thiệu, đọc biển hiệu đơn giản tại nơi làm việc.",
    descriptionJa: "基本的な挨拶、自己紹介、職場の簡単な表示の読解。",
    color: "#22C55E"
  },
  {
    code: "J4",
    nameJa: "J4 — 初級後半",
    nameVi: "J4 — Sơ trung cấp",
    scoreMin: 200,
    scoreMax: 319,
    jlptEquiv: "N4",
    descriptionVi: "Hội thoại đơn giản, hiểu chỉ thị cơ bản, đọc email ngắn, điền form đơn giản.",
    descriptionJa: "簡単な会話、基本的な指示の理解、短いメール読解、簡単なフォーム記入。",
    color: "#3B82F6"
  },
  {
    code: "J3",
    nameJa: "J3 — 中級前半",
    nameVi: "J3 — Trung cấp",
    scoreMin: 320,
    scoreMax: 419,
    jlptEquiv: "N3",
    descriptionVi: "Đọc email business, hiểu hội thoại văn phòng thông thường, viết báo cáo ngắn.",
    descriptionJa: "ビジネスメール読解、一般的なオフィス会話の理解、短い報告書の作成。",
    color: "#8B5CF6"
  },
  {
    code: "J2",
    nameJa: "J2 — 中級後半",
    nameVi: "J2 — Trung cao cấp",
    scoreMin: 420,
    scoreMax: 529,
    jlptEquiv: "N2",
    descriptionVi: "Xử lý tình huống business phức tạp, đọc báo cáo, tham gia họp bằng tiếng Nhật.",
    descriptionJa: "複雑なビジネス状況の対応、報告書読解、日本語での会議参加。",
    color: "#F59E0B"
  },
  {
    code: "J1",
    nameJa: "J1 — 上級前半",
    nameVi: "J1 — Cao cấp",
    scoreMin: 530,
    scoreMax: 599,
    jlptEquiv: "N1",
    descriptionVi: "Thương lượng, thuyết trình, viết báo cáo phức tạp, hiểu văn bản pháp lý cơ bản.",
    descriptionJa: "交渉、プレゼンテーション、複雑な報告書作成、基本的な法律文書の理解。",
    color: "#EF4444"
  },
  {
    code: "J1+",
    nameJa: "J1+ — 上級後半",
    nameVi: "J1+ — Cao cấp+",
    scoreMin: 600,
    scoreMax: 800,
    jlptEquiv: ">N1",
    descriptionVi: "Lãnh đạo meeting, xử lý xung đột, viết tài liệu chính thức, hiểu sắc thái ngôn ngữ tinh tế.",
    descriptionJa: "会議のリード、紛争処理、公式文書作成、微妙な言語ニュアンスの理解。",
    color: "#DC2626"
  }
];

/* Map BJT level code → JLPT filter values used in DB */
function jlptFilter(code: string): string[] {
  const map: Record<string, string[]> = {
    "J5": ["N5"],
    "J4": ["N4"],
    "J3": ["N3"],
    "J2": ["N2"],
    "J1": ["N1"],
    "J1+": ["N1"]  // J1+ shares N1 content
  };
  return map[code] ?? [];
}

function kanjiLevelFilter(code: string): number[] {
  const map: Record<string, number[]> = {
    "J5": [5],
    "J4": [4],
    "J3": [3],
    "J2": [2],
    "J1": [1],
    "J1+": [1]
  };
  return map[code] ?? [];
}

/* ── Service ───────────────────────────────────────────────── */

@Injectable()
class LevelsService {
  private readonly prisma = createPrismaClient();

  async list() {
    // Get aggregate counts per JLPT level
    const [vocabCounts, kanjiCounts, grammarCounts] = await this.prisma.$transaction([
      this.prisma.lexeme.groupBy({
        by: ["jlptLevel"],
        _count: true,
        where: { status: "active", jlptLevel: { not: null } }
      }),
      this.prisma.kanji.groupBy({
        by: ["level"],
        _count: true,
        where: { status: "active", level: { not: null } }
      }),
      this.prisma.grammarPoint.groupBy({
        by: ["jlptLevel"],
        _count: true,
        where: { status: "active", jlptLevel: { not: null } }
      })
    ]);

    const vcMap = new Map(vocabCounts.map((r) => [r.jlptLevel, r._count]));
    const kcMap = new Map(kanjiCounts.map((r) => [String(r.level), r._count]));
    const gcMap = new Map(grammarCounts.map((r) => [r.jlptLevel, r._count]));

    return LEVELS.map((lv) => {
      const jlpt = jlptFilter(lv.code);
      const kl = kanjiLevelFilter(lv.code);
      return {
        ...lv,
        vocabCount: jlpt.reduce((sum, j) => sum + (vcMap.get(j) ?? 0), 0),
        kanjiCount: kl.reduce((sum, k) => sum + (kcMap.get(String(k)) ?? 0), 0),
        grammarCount: jlpt.reduce((sum, j) => sum + (gcMap.get(j) ?? 0), 0)
      };
    });
  }

  detail(code: string) {
    const lv = LEVELS.find((l) => l.code === code);
    if (!lv) return null;
    return lv;
  }

  vocabulary(code: string, q: string | undefined, limit: number, offset: number) {
    const jlpt = jlptFilter(code);
    if (!jlpt.length) return [];
    return this.prisma.lexeme.findMany({
      include: { senses: { orderBy: { position: "asc" }, take: 3 } },
      orderBy: [{ headword: "asc" }],
      skip: offset,
      take: limit,
      where: {
        status: "active",
        jlptLevel: { in: jlpt },
        ...(q ? { OR: [
          { headword: { contains: q, mode: "insensitive" as const } },
          { reading: { contains: q, mode: "insensitive" as const } },
          { shortMeaningVi: { contains: q, mode: "insensitive" as const } }
        ] } : {})
      }
    });
  }

  kanji(code: string, q: string | undefined, limit: number, offset: number) {
    const levels = kanjiLevelFilter(code);
    if (!levels.length) return [];
    return this.prisma.kanji.findMany({
      include: {
        components: { orderBy: { position: "asc" }, take: 4 },
        examples: { orderBy: { position: "asc" }, take: 4 }
      },
      orderBy: [{ frequency: "asc" }],
      skip: offset,
      take: limit,
      where: {
        status: "active",
        level: { in: levels },
        ...(q ? { OR: [
          { character: q },
          { meaningVi: { contains: q, mode: "insensitive" as const } },
          { onyomi: { contains: q, mode: "insensitive" as const } },
          { kunyomi: { contains: q, mode: "insensitive" as const } }
        ] } : {})
      }
    });
  }

  grammar(code: string, q: string | undefined, limit: number, offset: number) {
    const jlpt = jlptFilter(code);
    if (!jlpt.length) return [];
    return this.prisma.grammarPoint.findMany({
      include: { details: { orderBy: { position: "asc" }, take: 2 } },
      orderBy: [{ pattern: "asc" }],
      skip: offset,
      take: limit,
      where: {
        status: "active",
        jlptLevel: { in: jlpt },
        ...(q ? { OR: [
          { pattern: { contains: q, mode: "insensitive" as const } },
          { meaningVi: { contains: q, mode: "insensitive" as const } }
        ] } : {})
      }
    });
  }

  /* ── Lessons ────────────────────────────────────────────── */

  async lessons(code: string) {
    const lessons = await this.prisma.bjtLesson.findMany({
      where: { levelCode: code, status: "active" },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          select: { contentType: true },
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    return lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      sortOrder: l.sortOrder,
      titleVi: l.titleVi,
      titleJa: l.titleJa,
      descriptionVi: l.descriptionVi,
      descriptionJa: l.descriptionJa,
      vocabCount: l.items.filter((i) => i.contentType === "vocabulary").length,
      kanjiCount: l.items.filter((i) => i.contentType === "kanji").length,
      grammarCount: l.items.filter((i) => i.contentType === "grammar").length,
    }));
  }

  async lessonDetail(slug: string) {
    const lesson = await this.prisma.bjtLesson.findFirst({
      where: { slug, status: "active" },
      include: {
        items: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!lesson) return null;

    // Batch-fetch content for each type
    const vocabIds = lesson.items.filter((i) => i.contentType === "vocabulary").map((i) => i.contentId);
    const kanjiIds = lesson.items.filter((i) => i.contentType === "kanji").map((i) => i.contentId);
    const grammarIds = lesson.items.filter((i) => i.contentType === "grammar").map((i) => i.contentId);

    const [vocabs, kanjis, grammars] = await this.prisma.$transaction([
      vocabIds.length ? this.prisma.lexeme.findMany({
        where: { id: { in: vocabIds }, status: "active" },
        include: { senses: { orderBy: { position: "asc" }, take: 3 } }
      }) : this.prisma.$queryRawUnsafe<never[]>("SELECT 1 WHERE false"),
      kanjiIds.length ? this.prisma.kanji.findMany({
        where: { id: { in: kanjiIds }, status: "active" },
        include: { components: { orderBy: { position: "asc" }, take: 4 }, examples: { orderBy: { position: "asc" }, take: 4 } }
      }) : this.prisma.$queryRawUnsafe<never[]>("SELECT 1 WHERE false"),
      grammarIds.length ? this.prisma.grammarPoint.findMany({
        where: { id: { in: grammarIds }, status: "active" },
        include: { details: { orderBy: { position: "asc" }, take: 2 } }
      }) : this.prisma.$queryRawUnsafe<never[]>("SELECT 1 WHERE false"),
    ]);

    // Build ordered content list
    const contentMap = new Map<string, { type: string; data: unknown }>();
    for (const v of vocabs) contentMap.set(v.id, { type: "vocabulary", data: v });
    for (const k of kanjis) contentMap.set(k.id, { type: "kanji", data: k });
    for (const g of grammars) contentMap.set(g.id, { type: "grammar", data: g });

    const contents = lesson.items
      .map((item) => {
        const c = contentMap.get(item.contentId);
        return c ? { sortOrder: item.sortOrder, contentType: c.type, content: c.data } : null;
      })
      .filter(Boolean);

    // Find prev/next lessons for navigation
    const [prevLesson, nextLesson] = await Promise.all([
      this.prisma.bjtLesson.findFirst({
        where: { levelCode: lesson.levelCode, status: "active", sortOrder: { lt: lesson.sortOrder } },
        orderBy: { sortOrder: "desc" },
        select: { slug: true, titleVi: true, titleJa: true, sortOrder: true }
      }),
      this.prisma.bjtLesson.findFirst({
        where: { levelCode: lesson.levelCode, status: "active", sortOrder: { gt: lesson.sortOrder } },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, titleVi: true, titleJa: true, sortOrder: true }
      })
    ]);

    return {
      id: lesson.id,
      slug: lesson.slug,
      levelCode: lesson.levelCode,
      sortOrder: lesson.sortOrder,
      titleVi: lesson.titleVi,
      titleJa: lesson.titleJa,
      descriptionVi: lesson.descriptionVi,
      descriptionJa: lesson.descriptionJa,
      contents,
      prevLesson: prevLesson ? { slug: prevLesson.slug, titleVi: prevLesson.titleVi, sortOrder: prevLesson.sortOrder } : null,
      nextLesson: nextLesson ? { slug: nextLesson.slug, titleVi: nextLesson.titleVi, sortOrder: nextLesson.sortOrder } : null
    };
  }
}

/* ── Controller ────────────────────────────────────────────── */

@Controller("levels")
@ApiTags("BJT Levels")
class LevelsController {
  constructor(@Inject(LevelsService) private readonly svc: LevelsService) {}

  @Get()
  @ApiOperation({ summary: "List all BJT levels (J5 → J1+) with content counts." })
  list() {
    return this.svc.list();
  }

  @Get("lessons/:slug")
  @ApiOperation({ summary: "Get lesson detail with all content items." })
  @ApiParam({ name: "slug", example: "j5-01-greetings" })
  lessonDetail(@Param("slug") slug: string) {
    return this.svc.lessonDetail(slug);
  }

  @Get(":code")
  @ApiOperation({ summary: "Get a single BJT level definition." })
  @ApiParam({ name: "code", example: "J3" })
  detail(@Param("code") code: string) {
    return this.svc.detail(code.toUpperCase());
  }

  @Get(":code/lessons")
  @ApiOperation({ summary: "List lessons for a BJT level with content counts." })
  @ApiParam({ name: "code", example: "J3" })
  lessons(@Param("code") code: string) {
    return this.svc.lessons(code.toUpperCase());
  }

  @Get(":code/vocabulary")
  @ApiOperation({ summary: "List vocabulary for a BJT level." })
  @ApiParam({ name: "code", example: "J3" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false, example: 30 })
  @ApiQuery({ name: "offset", required: false, example: 0 })
  vocabulary(
    @Param("code") code: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.svc.vocabulary(
      code.toUpperCase(),
      q,
      Math.min(Number(limit) || 30, 50),
      Number(offset) || 0
    );
  }

  @Get(":code/kanji")
  @ApiOperation({ summary: "List kanji for a BJT level." })
  @ApiParam({ name: "code", example: "J3" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false, example: 30 })
  @ApiQuery({ name: "offset", required: false, example: 0 })
  kanji(
    @Param("code") code: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.svc.kanji(
      code.toUpperCase(),
      q,
      Math.min(Number(limit) || 30, 50),
      Number(offset) || 0
    );
  }

  @Get(":code/grammar")
  @ApiOperation({ summary: "List grammar points for a BJT level." })
  @ApiParam({ name: "code", example: "J3" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false, example: 30 })
  @ApiQuery({ name: "offset", required: false, example: 0 })
  grammar(
    @Param("code") code: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.svc.grammar(
      code.toUpperCase(),
      q,
      Math.min(Number(limit) || 30, 50),
      Number(offset) || 0
    );
  }
}

/* ── Module ────────────────────────────────────────────────── */

@Module({
  controllers: [LevelsController],
  providers: [LevelsService]
})
export class LevelsModule {}
