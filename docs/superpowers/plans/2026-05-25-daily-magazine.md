# NihonGo Daily Magazine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build auto-generated daily magazine feature with 5 content types (vocab, weather, horoscope, loto, BJT phrase) using AI + real data, served via ISR pages with learning integration.

**Architecture:** Cron jobs generate content via AI pipeline → PostgreSQL storage → Next.js ISR pages. Reuses existing `daily` schema, `@nestjs/schedule`, Reading Assist Layer, and flashcard API.

**Tech Stack:** NestJS, Prisma, OpenAI API, Next.js ISR, React, existing `@nihongo-bjt/database` + `@nihongo-bjt/shared`

---

## Task 1: Database Migration — Magazine Tables

**Files:**
- Create: `packages/database/prisma/migrations/YYYYMMDD_magazine_tables/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add Prisma models to schema**

Add to `packages/database/prisma/schema.prisma` (inside `daily` schema section):

```prisma
model MagazineArticle {
  id                 String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug               String              @unique @db.VarChar(200)
  widgetKind         String              @map("widget_kind") @db.VarChar(64)
  contentDate        DateTime            @map("content_date") @db.Date
  locale             String              @default("vi") @db.VarChar(16)
  titleJp            String              @map("title_jp")
  titleVi            String              @map("title_vi")
  summaryJp          String?             @map("summary_jp")
  summaryVi          String?             @map("summary_vi")
  coverImageUrl      String?             @map("cover_image_url")
  contentJson        Json                @default("{}") @map("content_json")
  jlptLevel          String?             @map("jlpt_level") @db.VarChar(8)
  sourceDataJson     Json?               @default("{}") @map("source_data_json")
  aiModel            String?             @map("ai_model") @db.VarChar(64)
  generationCostTokens Int?             @map("generation_cost_tokens")
  seoTitle           String?             @map("seo_title")
  seoDescription     String?             @map("seo_description")
  ogImageUrl         String?             @map("og_image_url")
  status             String              @default("draft") @db.VarChar(32)
  publishedAt        DateTime?           @map("published_at") @db.Timestamptz(6)
  expiresAt          DateTime?           @map("expires_at") @db.Timestamptz(6)
  createdAt          DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)
  vocabItems         MagazineVocabItem[]
  quizzes            MagazineQuiz[]
  userReads          MagazineUserRead[]

  @@unique([widgetKind, contentDate, locale], map: "uq_magazine_kind_date_locale")
  @@index([status, contentDate(sort: Desc), locale], map: "idx_magazine_article_public")
  @@index([widgetKind, status, contentDate(sort: Desc)], map: "idx_magazine_article_kind")
  @@map("magazine_article")
  @@schema("daily")
}

model MagazineVocabItem {
  id           String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId    String           @map("article_id") @db.Uuid
  wordJp       String           @map("word_jp")
  reading      String
  meaningVi    String           @map("meaning_vi")
  pos          String?          @db.VarChar(32)
  jlptLevel    String?          @map("jlpt_level") @db.VarChar(8)
  sentenceJp   String?          @map("sentence_jp")
  sentenceVi   String?          @map("sentence_vi")
  displayOrder Int              @default(0) @map("display_order")
  createdAt    DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  article      MagazineArticle  @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId, displayOrder], map: "idx_magazine_vocab_article_order")
  @@map("magazine_vocab_item")
  @@schema("daily")
}

model MagazineQuiz {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId       String           @map("article_id") @db.Uuid
  questionJp      String           @map("question_jp")
  questionVi      String?          @map("question_vi")
  quizType        String           @default("multiple_choice") @map("quiz_type") @db.VarChar(32)
  options         Json             @default("[]")
  correctAnswer   String           @map("correct_answer")
  explanationJp   String?          @map("explanation_jp")
  explanationVi   String?          @map("explanation_vi")
  displayOrder    Int              @default(0) @map("display_order")
  createdAt       DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  article         MagazineArticle  @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId, displayOrder], map: "idx_magazine_quiz_article_order")
  @@map("magazine_quiz")
  @@schema("daily")
}

model MagazineUserRead {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String           @map("user_id") @db.Uuid
  articleId       String           @map("article_id") @db.Uuid
  readAt          DateTime         @default(now()) @map("read_at") @db.Timestamptz(6)
  quizScore       Int?             @map("quiz_score")
  quizTotal       Int?             @map("quiz_total")
  vocabSavedCount Int              @default(0) @map("vocab_saved_count")
  timeSpentSeconds Int?            @map("time_spent_seconds")
  article         MagazineArticle  @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([userId, articleId], map: "uq_magazine_user_article")
  @@index([userId, readAt(sort: Desc)], map: "idx_magazine_user_read_user")
  @@map("magazine_user_read")
  @@schema("daily")
}
```

- [ ] **Step 2: Generate and run migration**

```bash
cd packages/database
pnpm prisma migrate dev --name magazine_tables
```

Expected: Migration created, tables exist in `daily` schema.

- [ ] **Step 3: Verify with prisma generate**

```bash
pnpm prisma generate
```

Expected: Client generated successfully with new models.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add magazine_article, magazine_vocab_item, magazine_quiz, magazine_user_read tables"
```

---

## Task 2: Magazine Repository (DB Access Layer)

**Files:**
- Create: `apps/api/src/magazine/magazine.repository.ts`

- [ ] **Step 1: Create repository with CRUD operations**

```typescript
// apps/api/src/magazine/magazine.repository.ts
import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { todayDateKey } from "@nihongo-bjt/shared";

type ListFilter = {
  widgetKind?: string;
  status?: string;
  locale?: string;
  limit: number;
  page: number;
};

type CreateArticleInput = {
  slug: string;
  widgetKind: string;
  contentDate: Date;
  locale?: string;
  titleJp: string;
  titleVi: string;
  summaryJp?: string;
  summaryVi?: string;
  coverImageUrl?: string;
  contentJson: unknown;
  jlptLevel?: string;
  sourceDataJson?: unknown;
  aiModel?: string;
  generationCostTokens?: number;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  publishedAt?: Date;
  vocabItems?: Array<{
    wordJp: string;
    reading: string;
    meaningVi: string;
    pos?: string;
    jlptLevel?: string;
    sentenceJp?: string;
    sentenceVi?: string;
    displayOrder?: number;
  }>;
  quizzes?: Array<{
    questionJp: string;
    questionVi?: string;
    quizType?: string;
    options: unknown;
    correctAnswer: string;
    explanationJp?: string;
    explanationVi?: string;
    displayOrder?: number;
  }>;
};

@Injectable()
export class MagazineRepository {
  private readonly db: PrismaClient;

  constructor() {
    this.db = createPrismaClient();
  }

  async list(filter: ListFilter) {
    const where: Record<string, unknown> = { status: filter.status ?? "published" };
    if (filter.widgetKind) where.widgetKind = filter.widgetKind;
    if (filter.locale) where.locale = filter.locale;

    const [items, total] = await Promise.all([
      this.db.magazineArticle.findMany({
        where,
        orderBy: { contentDate: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: { vocabItems: { orderBy: { displayOrder: "asc" } } },
      }),
      this.db.magazineArticle.count({ where }),
    ]);

    return { items, total, page: filter.page, limit: filter.limit };
  }

  async getToday(locale = "vi") {
    const today = todayDateKey();
    return this.db.magazineArticle.findMany({
      where: { contentDate: new Date(today), locale, status: "published" },
      orderBy: { widgetKind: "asc" },
      include: {
        vocabItems: { orderBy: { displayOrder: "asc" } },
        quizzes: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  async getBySlug(slug: string) {
    return this.db.magazineArticle.findUnique({
      where: { slug },
      include: {
        vocabItems: { orderBy: { displayOrder: "asc" } },
        quizzes: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  async create(input: CreateArticleInput) {
    return this.db.magazineArticle.create({
      data: {
        slug: input.slug,
        widgetKind: input.widgetKind,
        contentDate: input.contentDate,
        locale: input.locale ?? "vi",
        titleJp: input.titleJp,
        titleVi: input.titleVi,
        summaryJp: input.summaryJp,
        summaryVi: input.summaryVi,
        coverImageUrl: input.coverImageUrl,
        contentJson: input.contentJson as any,
        jlptLevel: input.jlptLevel,
        sourceDataJson: input.sourceDataJson as any,
        aiModel: input.aiModel,
        generationCostTokens: input.generationCostTokens,
        seoTitle: input.seoTitle ?? input.titleVi,
        seoDescription: input.seoDescription ?? input.summaryVi,
        status: input.status ?? "published",
        publishedAt: input.status === "published" ? new Date() : input.publishedAt,
        vocabItems: input.vocabItems
          ? { createMany: { data: input.vocabItems } }
          : undefined,
        quizzes: input.quizzes
          ? { createMany: { data: input.quizzes } }
          : undefined,
      },
      include: { vocabItems: true, quizzes: true },
    });
  }

  async markRead(userId: string, articleId: string, data?: { quizScore?: number; quizTotal?: number; vocabSavedCount?: number; timeSpentSeconds?: number }) {
    return this.db.magazineUserRead.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId, ...data },
      update: { readAt: new Date(), ...data },
    });
  }

  async delete(id: string) {
    return this.db.magazineArticle.delete({ where: { id } });
  }

  async existsForDate(widgetKind: string, contentDate: Date, locale = "vi") {
    const count = await this.db.magazineArticle.count({
      where: { widgetKind, contentDate, locale },
    });
    return count > 0;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/magazine/
git commit -m "feat(api): add magazine repository with CRUD operations"
```

---

## Task 3: AI Content Provider (Generation Pipeline)

**Files:**
- Create: `apps/api/src/magazine/providers/ai-content.provider.ts`
- Create: `apps/api/src/magazine/providers/jma-weather.provider.ts`
- Create: `apps/api/src/magazine/providers/loto-data.provider.ts`

- [ ] **Step 1: Create AI content provider interface + OpenAI implementation**

```typescript
// apps/api/src/magazine/providers/ai-content.provider.ts
import { Injectable, Logger } from "@nestjs/common";

export type GeneratedArticle = {
  titleJp: string;
  titleVi: string;
  summaryJp: string;
  summaryVi: string;
  contentJson: Record<string, unknown>;
  vocabItems: Array<{
    wordJp: string;
    reading: string;
    meaningVi: string;
    pos?: string;
    jlptLevel?: string;
    sentenceJp?: string;
    sentenceVi?: string;
    displayOrder: number;
  }>;
  quizzes: Array<{
    questionJp: string;
    questionVi: string;
    quizType: string;
    options: string[];
    correctAnswer: string;
    explanationJp: string;
    explanationVi: string;
    displayOrder: number;
  }>;
  jlptLevel: string;
  tokensUsed: number;
};

export type GenerationContext = {
  widgetKind: string;
  date: Date;
  locale: string;
  targetJlptLevel?: string;
  realData?: Record<string, unknown>;
};

@Injectable()
export class AiContentProvider {
  private readonly logger = new Logger(AiContentProvider.name);
  private readonly apiKey = process.env.OPENAI_API_KEY ?? "";
  private readonly model = process.env.MAGAZINE_AI_MODEL ?? "gpt-4o-mini";

  async generate(ctx: GenerationContext): Promise<GeneratedArticle> {
    const prompt = this.buildPrompt(ctx);

    if (!this.apiKey) {
      this.logger.warn("No OPENAI_API_KEY configured, using mock generation");
      return this.mockGenerate(ctx);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: this.getSystemPrompt(ctx) },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI generation failed: ${response.status} ${err}`);
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);
    const tokensUsed = result.usage?.total_tokens ?? 0;

    return { ...content, tokensUsed };
  }

  private getSystemPrompt(ctx: GenerationContext): string {
    const level = ctx.targetJlptLevel ?? "N3";
    return `You are a Japanese language content creator for Vietnamese learners preparing for BJT.
Generate content at JLPT ${level} level. 
Always respond in valid JSON matching the requested schema.
Japanese text must be linguistically accurate with correct readings.
Vietnamese translations must be natural, not machine-translated.
Include 3-5 vocabulary items and 2-3 quiz questions per article.`;
  }

  private buildPrompt(ctx: GenerationContext): string {
    const templates: Record<string, string> = {
      magazine_vocab: `Create a daily vocabulary article for ${ctx.date.toISOString().split("T")[0]}.
Theme: seasonal/topical words for this time of year in Japan.
${ctx.realData ? `Context data: ${JSON.stringify(ctx.realData)}` : ""}
Output JSON: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { theme, paragraphsJp: string[], paragraphsVi: string[] }, vocabItems: [...], quizzes: [...], jlptLevel }`,

      magazine_weather: `Create a Japanese weather report article for ${ctx.date.toISOString().split("T")[0]}.
Real weather data: ${JSON.stringify(ctx.realData ?? {})}
Write as a natural JP weather forecast. Highlight weather vocabulary.
Output JSON: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { city, forecast, temperatureHigh, temperatureLow, weatherCondition, reportJp: string, reportVi: string }, vocabItems: [...], quizzes: [...], jlptLevel }`,

      magazine_horoscope: `Create a Japanese horoscope article for ${ctx.date.toISOString().split("T")[0]}.
Generate fortunes for all 12 zodiac signs in Japanese.
Use grammar patterns appropriate for the target JLPT level.
Output JSON: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { zodiacFortunes: Array<{ sign, signJp, fortuneJp, fortuneVi, luckyItem, luckyColor }> }, vocabItems: [...], quizzes: [...], jlptLevel }`,

      magazine_loto: `Create a fun loto/lucky number prediction article for ${ctx.date.toISOString().split("T")[0]}.
Historical data: ${JSON.stringify(ctx.realData ?? {})}
Present lucky numbers using Japanese number kanji (一二三...) and 数字 vocabulary.
This is entertainment - make it fun while teaching number-related Japanese.
Output JSON: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { luckyNumbers: number[], luckyKanji: string[], explanation_jp: string, explanation_vi: string, funFact_jp: string, funFact_vi: string }, vocabItems: [...], quizzes: [...], jlptLevel }`,

      magazine_bjt_phrase: `Create a BJT business Japanese phrase of the day for ${ctx.date.toISOString().split("T")[0]}.
Pick one useful business phrase and create a realistic office dialogue using it.
Output JSON: { titleJp, titleVi, summaryJp, summaryVi, contentJson: { phrase_jp: string, phrase_vi: string, usage_note_jp: string, usage_note_vi: string, dialogue: Array<{ speaker, lineJp, lineVi }>, formality_level: string }, vocabItems: [...], quizzes: [...], jlptLevel }`,
    };

    return templates[ctx.widgetKind] ?? templates.magazine_vocab;
  }

  /** Fallback mock when no API key configured (dev mode) */
  private mockGenerate(ctx: GenerationContext): GeneratedArticle {
    return {
      titleJp: `【${ctx.widgetKind}】${ctx.date.toISOString().split("T")[0]}のコンテンツ`,
      titleVi: `[${ctx.widgetKind}] Nội dung ngày ${ctx.date.toISOString().split("T")[0]}`,
      summaryJp: "これはモック生成されたコンテンツです。",
      summaryVi: "Đây là nội dung mock (chưa có API key).",
      contentJson: { mock: true, widgetKind: ctx.widgetKind },
      vocabItems: [
        { wordJp: "天気", reading: "てんき", meaningVi: "thời tiết", pos: "noun", jlptLevel: "N5", sentenceJp: "今日の天気はいいです。", sentenceVi: "Thời tiết hôm nay đẹp.", displayOrder: 0 },
      ],
      quizzes: [
        { questionJp: "「天気」の読み方は？", questionVi: "Cách đọc của「天気」là gì?", quizType: "multiple_choice", options: ["てんき", "てんぎ", "あまき", "あまぎ"], correctAnswer: "てんき", explanationJp: "天気（てんき）= thời tiết", explanationVi: "天気 đọc là てんき, nghĩa là thời tiết", displayOrder: 0 },
      ],
      jlptLevel: "N4",
      tokensUsed: 0,
    };
  }
}
```

- [ ] **Step 2: Create JMA weather provider**

```typescript
// apps/api/src/magazine/providers/jma-weather.provider.ts
import { Injectable, Logger } from "@nestjs/common";

export type WeatherData = {
  city: string;
  date: string;
  condition: string;
  temperatureHigh: number;
  temperatureLow: number;
  precipitation: number;
  humidity: number;
};

@Injectable()
export class JmaWeatherProvider {
  private readonly logger = new Logger(JmaWeatherProvider.name);

  /** Fetch weather forecast from JMA (気象庁) open data API */
  async fetchTokyo(): Promise<WeatherData> {
    try {
      // JMA provides free JSON forecast data
      const res = await fetch(
        "https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json",
      );
      if (!res.ok) throw new Error(`JMA API returned ${res.status}`);

      const data = await res.json();
      const area = data[0]?.timeSeries?.[0]?.areas?.[0];
      const temps = data[0]?.timeSeries?.[2]?.areas?.[0];

      return {
        city: "東京",
        date: new Date().toISOString().split("T")[0],
        condition: area?.weathers?.[0] ?? "晴れ",
        temperatureHigh: parseInt(temps?.temps?.[1] ?? "25", 10),
        temperatureLow: parseInt(temps?.temps?.[0] ?? "18", 10),
        precipitation: 0,
        humidity: 60,
      };
    } catch (e) {
      this.logger.warn("JMA fetch failed, using fallback", e);
      return {
        city: "東京",
        date: new Date().toISOString().split("T")[0],
        condition: "晴れ時々曇り",
        temperatureHigh: 25,
        temperatureLow: 18,
        precipitation: 10,
        humidity: 65,
      };
    }
  }
}
```

- [ ] **Step 3: Create loto data provider**

```typescript
// apps/api/src/magazine/providers/loto-data.provider.ts
import { Injectable, Logger } from "@nestjs/common";

export type LotoData = {
  recentResults: number[][];
  frequencyMap: Record<number, number>;
  hotNumbers: number[];
  coldNumbers: number[];
};

@Injectable()
export class LotoDataProvider {
  private readonly logger = new Logger(LotoDataProvider.name);

  /** Get historical loto data for "prediction" content (entertainment only) */
  async getHistoricalData(): Promise<LotoData> {
    // For MVP: use statistical mock based on common loto patterns
    // Phase 2: integrate with actual loto result API
    const frequencyMap: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) {
      frequencyMap[i] = Math.floor(Math.random() * 50) + 10;
    }

    const sorted = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);
    const hotNumbers = sorted.slice(0, 6).map(([n]) => parseInt(n, 10));
    const coldNumbers = sorted.slice(-6).map(([n]) => parseInt(n, 10));

    return {
      recentResults: [
        [3, 12, 18, 27, 35, 42],
        [7, 14, 21, 33, 38, 44],
        [2, 9, 16, 25, 31, 40],
      ],
      frequencyMap,
      hotNumbers,
      coldNumbers,
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/magazine/providers/
git commit -m "feat(api): add AI content, JMA weather, and loto data providers"
```

---

## Task 4: Magazine Generation Service + Cron

**Files:**
- Create: `apps/api/src/magazine/magazine-generation.service.ts`
- Create: `apps/api/src/magazine/magazine-generation.cron.ts`

- [ ] **Step 1: Create generation service (orchestrates pipeline)**

```typescript
// apps/api/src/magazine/magazine-generation.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { MagazineRepository } from "./magazine.repository.js";
import { AiContentProvider, type GenerationContext } from "./providers/ai-content.provider.js";
import { JmaWeatherProvider } from "./providers/jma-weather.provider.js";
import { LotoDataProvider } from "./providers/loto-data.provider.js";

@Injectable()
export class MagazineGenerationService {
  private readonly logger = new Logger(MagazineGenerationService.name);

  constructor(
    private readonly repo: MagazineRepository,
    private readonly ai: AiContentProvider,
    private readonly weather: JmaWeatherProvider,
    private readonly loto: LotoDataProvider,
  ) {}

  async generateForDate(widgetKind: string, date: Date, locale = "vi"): Promise<string | null> {
    // Idempotent: skip if already generated for this date
    const exists = await this.repo.existsForDate(widgetKind, date, locale);
    if (exists) {
      this.logger.log(`Already generated ${widgetKind} for ${date.toISOString().split("T")[0]}, skipping`);
      return null;
    }

    // Fetch real data based on content type
    const realData = await this.fetchRealData(widgetKind);

    // Generate via AI
    const ctx: GenerationContext = { widgetKind, date, locale, realData };
    const generated = await this.ai.generate(ctx);

    // Build slug
    const dateStr = date.toISOString().split("T")[0];
    const kindShort = widgetKind.replace("magazine_", "");
    const slug = `${dateStr}-${kindShort}-${locale}`;

    // Save to DB
    const article = await this.repo.create({
      slug,
      widgetKind,
      contentDate: date,
      locale,
      titleJp: generated.titleJp,
      titleVi: generated.titleVi,
      summaryJp: generated.summaryJp,
      summaryVi: generated.summaryVi,
      contentJson: generated.contentJson,
      jlptLevel: generated.jlptLevel,
      sourceDataJson: realData,
      aiModel: process.env.MAGAZINE_AI_MODEL ?? "gpt-4o-mini",
      generationCostTokens: generated.tokensUsed,
      status: "published",
      vocabItems: generated.vocabItems,
      quizzes: generated.quizzes,
    });

    this.logger.log(`Generated ${widgetKind} article: ${slug} (${generated.tokensUsed} tokens)`);
    return article.id;
  }

  private async fetchRealData(widgetKind: string): Promise<Record<string, unknown> | undefined> {
    switch (widgetKind) {
      case "magazine_weather":
        return (await this.weather.fetchTokyo()) as unknown as Record<string, unknown>;
      case "magazine_loto":
        return (await this.loto.getHistoricalData()) as unknown as Record<string, unknown>;
      default:
        return undefined;
    }
  }

  /** Manual trigger (admin) — regenerate for specific date/type */
  async regenerate(widgetKind: string, date: Date, locale = "vi"): Promise<string> {
    // Delete existing if any
    const dateStr = date.toISOString().split("T")[0];
    const kindShort = widgetKind.replace("magazine_", "");
    const slug = `${dateStr}-${kindShort}-${locale}`;

    const existing = await this.repo.getBySlug(slug);
    if (existing) {
      await this.repo.delete(existing.id);
    }

    const id = await this.generateForDate(widgetKind, date, locale);
    if (!id) throw new Error("Generation returned null unexpectedly");
    return id;
  }
}
```

- [ ] **Step 2: Create cron job scheduler**

```typescript
// apps/api/src/magazine/magazine-generation.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MagazineGenerationService } from "./magazine-generation.service.js";

@Injectable()
export class MagazineGenerationCron {
  private readonly logger = new Logger(MagazineGenerationCron.name);

  constructor(private readonly generation: MagazineGenerationService) {}

  /** Daily at 05:30 AM (Asia/Ho_Chi_Minh) — generate vocab, weather, horoscope, BJT phrase */
  @Cron("30 5 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleDailyGeneration() {
    this.logger.log("Starting daily magazine generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyKinds = ["magazine_vocab", "magazine_weather", "magazine_horoscope", "magazine_bjt_phrase"];

    for (const kind of dailyKinds) {
      try {
        await this.generation.generateForDate(kind, today);
      } catch (e) {
        this.logger.error(`Failed to generate ${kind}`, e instanceof Error ? e.stack : e);
      }
    }

    this.logger.log("Daily magazine generation complete");
  }

  /** Monday + Thursday at 17:00 (Asia/Ho_Chi_Minh) — loto prediction */
  @Cron("0 17 * * 1,4", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleLotoGeneration() {
    this.logger.log("Starting loto prediction generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.generation.generateForDate("magazine_loto", today);
      this.logger.log("Loto prediction generation complete");
    } catch (e) {
      this.logger.error("Failed to generate loto", e instanceof Error ? e.stack : e);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/magazine/
git commit -m "feat(api): add magazine generation service and cron scheduler"
```

---

## Task 5: Magazine API Controller (Public + Admin)

**Files:**
- Create: `apps/api/src/magazine/magazine.controller.ts`
- Create: `apps/api/src/magazine/magazine-admin.controller.ts`
- Create: `apps/api/src/magazine/dto/magazine.dto.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// apps/api/src/magazine/dto/magazine.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from "class-validator";
import { Type } from "class-transformer";

export class ListMagazineQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() widgetKind?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class MarkReadBody {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) quizScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) quizTotal?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) vocabSavedCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) timeSpentSeconds?: number;
}

export class AdminGenerateBody {
  @ApiProperty() @IsString() widgetKind!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiPropertyOptional({ default: "vi" }) @IsOptional() @IsString() locale?: string;
}
```

- [ ] **Step 2: Create public controller**

```typescript
// apps/api/src/magazine/magazine.controller.ts
import { Controller, Get, Post, Param, Query, Body, Req, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MagazineRepository } from "./magazine.repository.js";
import { ListMagazineQuery, MarkReadBody } from "./dto/magazine.dto.js";

@ApiTags("Magazine")
@Controller("magazine")
export class MagazineController {
  constructor(private readonly repo: MagazineRepository) {}

  @Get()
  @ApiOperation({ summary: "List published magazine articles" })
  list(@Query() query: ListMagazineQuery) {
    return this.repo.list({
      widgetKind: query.widgetKind,
      locale: query.locale ?? "vi",
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get("today")
  @ApiOperation({ summary: "Get today's magazine articles" })
  today(@Query("locale") locale?: string) {
    return this.repo.getToday(locale ?? "vi");
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get magazine article by slug (public)" })
  async getBySlug(@Param("slug") slug: string) {
    const article = await this.repo.getBySlug(slug);
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  @Post(":slug/read")
  @ApiOperation({ summary: "Mark article as read and submit quiz results" })
  async markRead(
    @Param("slug") slug: string,
    @Body() body: MarkReadBody,
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    if (!userId) return { ok: false, reason: "not_authenticated" };

    const article = await this.repo.getBySlug(slug);
    if (!article) throw new NotFoundException("Article not found");

    return this.repo.markRead(userId, article.id, body);
  }
}
```

- [ ] **Step 3: Create admin controller**

```typescript
// apps/api/src/magazine/magazine-admin.controller.ts
import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MagazineRepository } from "./magazine.repository.js";
import { MagazineGenerationService } from "./magazine-generation.service.js";
import { AdminGenerateBody, ListMagazineQuery } from "./dto/magazine.dto.js";

@ApiTags("Admin / Magazine")
@Controller("admin/magazine")
export class MagazineAdminController {
  constructor(
    private readonly repo: MagazineRepository,
    private readonly generation: MagazineGenerationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all magazine articles (admin)" })
  list(@Query() query: ListMagazineQuery) {
    return this.repo.list({
      widgetKind: query.widgetKind,
      locale: query.locale ?? "vi",
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: undefined, // show all statuses for admin
    });
  }

  @Post("generate")
  @ApiOperation({ summary: "Trigger content generation for a specific date/type" })
  async generate(@Body() body: AdminGenerateBody) {
    const id = await this.generation.generateForDate(
      body.widgetKind,
      new Date(body.date),
      body.locale ?? "vi",
    );
    return { id, generated: !!id };
  }

  @Post(":id/regenerate")
  @ApiOperation({ summary: "Regenerate article content with AI" })
  async regenerate(@Param("id") id: string) {
    const article = await this.repo.getBySlug(id);
    if (!article) {
      // Try by ID directly
      const newId = await this.generation.regenerate(id, new Date(), "vi");
      return { id: newId, regenerated: true };
    }
    const newId = await this.generation.regenerate(
      article.widgetKind,
      article.contentDate,
      article.locale,
    );
    return { id: newId, regenerated: true };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete magazine article" })
  async remove(@Param("id") id: string) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/magazine/
git commit -m "feat(api): add magazine public and admin controllers with DTOs"
```

---

## Task 6: Magazine NestJS Module

**Files:**
- Create: `apps/api/src/magazine/magazine.module.ts`
- Modify: `apps/api/src/app.module.ts` (add MagazineModule import)

- [ ] **Step 1: Create module**

```typescript
// apps/api/src/magazine/magazine.module.ts
import { Module } from "@nestjs/common";
import { MagazineController } from "./magazine.controller.js";
import { MagazineAdminController } from "./magazine-admin.controller.js";
import { MagazineRepository } from "./magazine.repository.js";
import { MagazineGenerationService } from "./magazine-generation.service.js";
import { MagazineGenerationCron } from "./magazine-generation.cron.js";
import { AiContentProvider } from "./providers/ai-content.provider.js";
import { JmaWeatherProvider } from "./providers/jma-weather.provider.js";
import { LotoDataProvider } from "./providers/loto-data.provider.js";

@Module({
  controllers: [MagazineController, MagazineAdminController],
  providers: [
    MagazineRepository,
    MagazineGenerationService,
    MagazineGenerationCron,
    AiContentProvider,
    JmaWeatherProvider,
    LotoDataProvider,
  ],
  exports: [MagazineRepository, MagazineGenerationService],
})
export class MagazineModule {}
```

- [ ] **Step 2: Add to app.module.ts**

Find the imports array in `apps/api/src/app.module.ts` and add `MagazineModule`:

```typescript
import { MagazineModule } from "./magazine/magazine.module.js";
// Add MagazineModule to the imports array
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/magazine/ apps/api/src/app.module.ts
git commit -m "feat(api): register MagazineModule in app"
```

---

## Task 7: Frontend — Magazine Archive Page

**Files:**
- Create: `apps/web/app/[locale]/magazine/page.tsx`
- Create: `apps/web/app/[locale]/magazine/_components/magazine-card.tsx`
- Create: `apps/web/app/[locale]/magazine/_components/magazine-filter.tsx`

- [ ] **Step 1: Create magazine archive page (ISR)**

```tsx
// apps/web/app/[locale]/magazine/page.tsx
import { Metadata } from "next";
import { MagazineCard } from "./_components/magazine-card";
import { MagazineFilter } from "./_components/magazine-filter";

export const revalidate = 3600; // ISR: revalidate every hour

async function fetchArticles(kind?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: "12" });
  if (kind) params.set("widgetKind", kind);

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/magazine?${params}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

export const metadata: Metadata = {
  title: "Daily Magazine — NihonGo BJT",
  description: "Học tiếng Nhật mỗi ngày qua thời tiết, tử vi, từ vựng, và nhiều hơn nữa",
};

export default async function MagazinePage({
  searchParams,
}: {
  searchParams: { kind?: string; page?: string };
}) {
  const data = await fetchArticles(searchParams.kind, Number(searchParams.page) || 1);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          📰 Daily Magazine
        </h1>
        <p className="text-muted-foreground mt-2">
          Học tiếng Nhật mỗi ngày qua nội dung thú vị
        </p>
      </header>

      <MagazineFilter activeKind={searchParams.kind} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {data.items.map((article: any) => (
          <MagazineCard key={article.id} article={article} />
        ))}
      </div>

      {data.items.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">📭</p>
          <p>Chưa có bài viết nào. Quay lại sau nhé!</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create magazine card component**

```tsx
// apps/web/app/[locale]/magazine/_components/magazine-card.tsx
import Link from "next/link";

const KIND_ICONS: Record<string, string> = {
  magazine_vocab: "🌸",
  magazine_weather: "☀️",
  magazine_horoscope: "⭐",
  magazine_loto: "🎰",
  magazine_bjt_phrase: "💼",
};

const KIND_LABELS: Record<string, string> = {
  magazine_vocab: "Từ vựng",
  magazine_weather: "Thời tiết",
  magazine_horoscope: "Tử vi",
  magazine_loto: "Loto",
  magazine_bjt_phrase: "BJT Phrase",
};

type Article = {
  id: string;
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  summaryVi: string;
  contentDate: string;
  jlptLevel: string;
  vocabItems: Array<{ wordJp: string; reading: string }>;
};

export function MagazineCard({ article }: { article: Article }) {
  const icon = KIND_ICONS[article.widgetKind] ?? "📄";
  const label = KIND_LABELS[article.widgetKind] ?? article.widgetKind;

  return (
    <Link
      href={`/magazine/${article.slug}`}
      className="group block rounded-2xl border border-border/50 bg-card p-5 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {label}
        </span>
        {article.jlptLevel && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent ml-auto">
            {article.jlptLevel}
          </span>
        )}
      </div>

      <h3 className="font-bold text-lg leading-relaxed mb-1 group-hover:text-primary transition-colors">
        {article.titleJp}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">{article.titleVi}</p>
      <p className="text-sm text-muted-foreground/80 line-clamp-2">{article.summaryVi}</p>

      {article.vocabItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {article.vocabItems.slice(0, 3).map((v) => (
            <span key={v.wordJp} className="text-xs px-2 py-0.5 rounded bg-muted">
              {v.wordJp}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        {new Date(article.contentDate).toLocaleDateString("vi-VN")}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create filter component**

```tsx
// apps/web/app/[locale]/magazine/_components/magazine-filter.tsx
"use client";
import { useRouter, usePathname } from "next/navigation";

const KINDS = [
  { key: undefined, label: "Tất cả", icon: "📰" },
  { key: "magazine_vocab", label: "Từ vựng", icon: "🌸" },
  { key: "magazine_weather", label: "Thời tiết", icon: "☀️" },
  { key: "magazine_horoscope", label: "Tử vi", icon: "⭐" },
  { key: "magazine_loto", label: "Loto", icon: "🎰" },
  { key: "magazine_bjt_phrase", label: "BJT", icon: "💼" },
];

export function MagazineFilter({ activeKind }: { activeKind?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleFilter(kind?: string) {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {KINDS.map((k) => (
        <button
          key={k.key ?? "all"}
          onClick={() => handleFilter(k.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            activeKind === k.key
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          <span>{k.icon}</span>
          {k.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\[locale\]/magazine/
git commit -m "feat(web): add magazine archive page with card and filter components"
```

---

## Task 8: Frontend — Article Detail Page (Public, SEO)

**Files:**
- Create: `apps/web/app/[locale]/magazine/[slug]/page.tsx`
- Create: `apps/web/app/[locale]/magazine/_components/magazine-article-view.tsx`
- Create: `apps/web/app/[locale]/magazine/_components/mini-quiz.tsx`

- [ ] **Step 1: Create article detail page with SEO metadata**

```tsx
// apps/web/app/[locale]/magazine/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { MagazineArticleView } from "../_components/magazine-article-view";

export const revalidate = 3600;

async function fetchArticle(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/magazine/${slug}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await fetchArticle(params.slug);
  if (!article) return { title: "Not Found" };

  return {
    title: `${article.titleJp} — NihonGo Magazine`,
    description: article.seoDescription ?? article.summaryVi,
    openGraph: {
      title: `${article.titleJp} | ${article.titleVi}`,
      description: article.summaryVi,
      type: "article",
      publishedTime: article.publishedAt,
      images: article.ogImageUrl ? [article.ogImageUrl] : undefined,
    },
  };
}

export default async function MagazineArticlePage({ params }: { params: { slug: string } }) {
  const article = await fetchArticle(params.slug);
  if (!article) notFound();

  return <MagazineArticleView article={article} />;
}
```

- [ ] **Step 2: Create article view component**

```tsx
// apps/web/app/[locale]/magazine/_components/magazine-article-view.tsx
"use client";

import { MiniQuiz } from "./mini-quiz";

type VocabItem = {
  id: string;
  wordJp: string;
  reading: string;
  meaningVi: string;
  pos?: string;
  jlptLevel?: string;
  sentenceJp?: string;
  sentenceVi?: string;
};

type Quiz = {
  id: string;
  questionJp: string;
  questionVi?: string;
  quizType: string;
  options: string[];
  correctAnswer: string;
  explanationJp?: string;
  explanationVi?: string;
};

type Article = {
  id: string;
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  summaryJp?: string;
  summaryVi?: string;
  contentJson: Record<string, any>;
  contentDate: string;
  jlptLevel?: string;
  vocabItems: VocabItem[];
  quizzes: Quiz[];
};

export function MagazineArticleView({ article }: { article: Article }) {
  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <header className="mb-8">
        <div className="text-sm text-muted-foreground mb-2">
          {new Date(article.contentDate).toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {article.jlptLevel && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
              {article.jlptLevel}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-relaxed">{article.titleJp}</h1>
        <p className="text-lg text-muted-foreground mt-1">{article.titleVi}</p>
        {article.summaryJp && (
          <p className="mt-4 text-base leading-[1.8] text-foreground/90">
            {article.summaryJp}
          </p>
        )}
      </header>

      {/* Content body — rendered from contentJson */}
      <section className="prose prose-lg max-w-none mb-8">
        {article.contentJson.paragraphsJp?.map((p: string, i: number) => (
          <div key={i} className="mb-4">
            <p className="text-base leading-[1.9] font-[\'Noto+Sans+JP\']">{p}</p>
            {article.contentJson.paragraphsVi?.[i] && (
              <p className="text-sm text-muted-foreground mt-1 italic">
                {article.contentJson.paragraphsVi[i]}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Vocabulary section */}
      {article.vocabItems.length > 0 && (
        <section className="mb-8 rounded-2xl bg-card border border-border/50 p-6">
          <h2 className="text-xl font-bold mb-4">📚 Từ vựng trong bài</h2>
          <div className="space-y-3">
            {article.vocabItems.map((v) => (
              <div key={v.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold">{v.wordJp}</span>
                    <span className="text-sm text-muted-foreground">({v.reading})</span>
                    {v.jlptLevel && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {v.jlptLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 mt-0.5">{v.meaningVi}</p>
                  {v.sentenceJp && (
                    <p className="text-sm mt-2 leading-[1.8]">
                      <span className="text-foreground/70">例）</span>
                      {v.sentenceJp}
                    </p>
                  )}
                  {v.sentenceVi && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{v.sentenceVi}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mini Quiz */}
      {article.quizzes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">🧠 Mini Quiz</h2>
          <MiniQuiz quizzes={article.quizzes} articleSlug={article.slug} />
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Create mini quiz component**

```tsx
// apps/web/app/[locale]/magazine/_components/mini-quiz.tsx
"use client";
import { useState } from "react";

type Quiz = {
  id: string;
  questionJp: string;
  questionVi?: string;
  quizType: string;
  options: string[];
  correctAnswer: string;
  explanationJp?: string;
  explanationVi?: string;
};

export function MiniQuiz({ quizzes, articleSlug }: { quizzes: Quiz[]; articleSlug: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const quiz = quizzes[currentIndex];
  if (!quiz) return null;

  const isCorrect = selected === quiz.correctAnswer;

  function handleSelect(option: string) {
    if (showResult) return;
    setSelected(option);
    setShowResult(true);
    if (option === quiz.correctAnswer) {
      setScore((s) => s + 1);
    }
  }

  function handleNext() {
    if (currentIndex < quizzes.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setCompleted(true);
      // Submit score to API
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/magazine/${articleSlug}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizScore: score + (isCorrect ? 1 : 0), quizTotal: quizzes.length }),
        credentials: "include",
      }).catch(() => {});
    }
  }

  if (completed) {
    const finalScore = score;
    const total = quizzes.length;
    return (
      <div className="text-center p-8 rounded-2xl bg-card border border-border/50">
        <p className="text-4xl mb-3">{finalScore === total ? "🎉" : finalScore > 0 ? "👏" : "💪"}</p>
        <p className="text-xl font-bold">
          {finalScore}/{total} câu đúng
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {finalScore === total ? "Tuyệt vời! Bạn nắm rõ bài hôm nay!" : "Tiếp tục cố gắng nhé!"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Câu {currentIndex + 1}/{quizzes.length}
        </span>
        <span className="text-sm font-medium text-primary">{score} điểm</span>
      </div>

      <p className="text-lg font-bold leading-relaxed mb-2">{quiz.questionJp}</p>
      {quiz.questionVi && <p className="text-sm text-muted-foreground mb-4">{quiz.questionVi}</p>}

      <div className="space-y-2">
        {quiz.options.map((option) => {
          let bg = "bg-muted hover:bg-muted/80";
          if (showResult) {
            if (option === quiz.correctAnswer) bg = "bg-green-100 border-green-500 dark:bg-green-900/30";
            else if (option === selected) bg = "bg-red-100 border-red-500 dark:bg-red-900/30";
            else bg = "bg-muted opacity-50";
          }

          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={showResult}
              className={`w-full text-left p-3 rounded-xl border transition-all ${bg} ${
                !showResult ? "cursor-pointer active:scale-[0.98]" : ""
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className={`mt-4 p-4 rounded-xl ${isCorrect ? "bg-green-50 dark:bg-green-900/20" : "bg-orange-50 dark:bg-orange-900/20"}`}>
          <p className="font-medium">{isCorrect ? "✅ Chính xác!" : "❌ Chưa đúng"}</p>
          {quiz.explanationVi && <p className="text-sm mt-1">{quiz.explanationVi}</p>}
          {quiz.explanationJp && <p className="text-sm mt-1 text-muted-foreground">{quiz.explanationJp}</p>}
          <button
            onClick={handleNext}
            className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {currentIndex < quizzes.length - 1 ? "Câu tiếp →" : "Xem kết quả"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\[locale\]/magazine/
git commit -m "feat(web): add magazine article detail page with quiz component"
```

---

## Task 9: Homepage "Hôm nay" Widget

**Files:**
- Create: `apps/web/app/[locale]/_components/today-magazine-widget.tsx`
- Modify: Homepage (`apps/web/app/[locale]/page.tsx`) to include widget

- [ ] **Step 1: Create today widget**

```tsx
// apps/web/app/[locale]/_components/today-magazine-widget.tsx
import Link from "next/link";

const KIND_ICONS: Record<string, string> = {
  magazine_vocab: "🌸",
  magazine_weather: "☀️",
  magazine_horoscope: "⭐",
  magazine_loto: "🎰",
  magazine_bjt_phrase: "💼",
};

type ArticlePreview = {
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  jlptLevel?: string;
};

export async function TodayMagazineWidget() {
  let articles: ArticlePreview[] = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/magazine/today`, {
      next: { revalidate: 1800 },
    });
    if (res.ok) articles = await res.json();
  } catch {
    // Silently fail — widget is non-critical
  }

  if (articles.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📰 Hôm nay</h2>
        <Link href="/magazine" className="text-sm text-primary hover:underline">
          Xem tất cả →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/magazine/${a.slug}`}
            className="group p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
          >
            <span className="text-2xl block mb-2">{KIND_ICONS[a.widgetKind] ?? "📄"}</span>
            <p className="font-medium text-sm leading-relaxed line-clamp-2 group-hover:text-primary transition-colors">
              {a.titleJp}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.titleVi}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add widget to homepage**

Find a suitable location in `apps/web/app/[locale]/page.tsx` and import + render `<TodayMagazineWidget />`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\[locale\]/_components/today-magazine-widget.tsx apps/web/app/\[locale\]/page.tsx
git commit -m "feat(web): add today magazine widget to homepage"
```

---

## Task 10: Seed Script — Generate Initial Content

**Files:**
- Create: `scripts/seed-magazine.mjs`

- [ ] **Step 1: Create seed script that generates 7 days of mock content**

```javascript
// scripts/seed-magazine.mjs
// Seeds magazine articles for the past 7 days using mock data (no AI API needed)
// Usage: node scripts/seed-magazine.mjs

import { PrismaClient } from "../packages/database/generated/client/index.js";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt" } },
});

const KINDS = ["magazine_vocab", "magazine_weather", "magazine_horoscope", "magazine_loto", "magazine_bjt_phrase"];

const SAMPLE_CONTENT = {
  magazine_vocab: {
    titleJp: "梅雨の季節の言葉",
    titleVi: "Từ vựng mùa mưa",
    summaryJp: "梅雨に関する日本語の表現を学びましょう。",
    summaryVi: "Cùng học các cách diễn đạt tiếng Nhật liên quan đến mùa mưa.",
    contentJson: { theme: "rainy_season", paragraphsJp: ["六月は梅雨の季節です。毎日雨が降ります。"], paragraphsVi: ["Tháng 6 là mùa mưa. Mỗi ngày đều có mưa."] },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "梅雨", reading: "つゆ", meaningVi: "mùa mưa", pos: "noun", jlptLevel: "N3", sentenceJp: "梅雨が始まりました。", sentenceVi: "Mùa mưa đã bắt đầu.", displayOrder: 0 },
      { wordJp: "傘", reading: "かさ", meaningVi: "ô, dù", pos: "noun", jlptLevel: "N5", sentenceJp: "傘を持って行きましょう。", sentenceVi: "Hãy mang theo ô đi.", displayOrder: 1 },
      { wordJp: "蒸し暑い", reading: "むしあつい", meaningVi: "oi bức, nóng ẩm", pos: "i-adj", jlptLevel: "N3", sentenceJp: "今日はとても蒸し暑いです。", sentenceVi: "Hôm nay rất oi bức.", displayOrder: 2 },
    ],
    quizzes: [
      { questionJp: "「梅雨」の読み方は？", questionVi: "Cách đọc của「梅雨」?", quizType: "multiple_choice", options: ["つゆ", "ばいう", "うめあめ", "かさ"], correctAnswer: "つゆ", explanationJp: "梅雨（つゆ）は日本の雨季です。", explanationVi: "梅雨 đọc là つゆ, là mùa mưa ở Nhật.", displayOrder: 0 },
    ],
  },
  magazine_weather: {
    titleJp: "東京の天気予報",
    titleVi: "Dự báo thời tiết Tokyo",
    summaryJp: "今日の東京の天気を日本語で確認しましょう。",
    summaryVi: "Cùng xem thời tiết Tokyo hôm nay bằng tiếng Nhật.",
    contentJson: { city: "東京", forecast: "晴れ時々曇り", temperatureHigh: 28, temperatureLow: 21, reportJp: "今日の東京は晴れ時々曇りです。最高気温は28度、最低気温は21度です。", reportVi: "Hôm nay Tokyo trời nắng có lúc mây. Nhiệt độ cao nhất 28°C, thấp nhất 21°C." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "天気予報", reading: "てんきよほう", meaningVi: "dự báo thời tiết", pos: "noun", jlptLevel: "N4", sentenceJp: "天気予報を見ましたか。", sentenceVi: "Bạn đã xem dự báo thời tiết chưa?", displayOrder: 0 },
      { wordJp: "最高気温", reading: "さいこうきおん", meaningVi: "nhiệt độ cao nhất", pos: "noun", jlptLevel: "N3", sentenceJp: "最高気温は30度です。", sentenceVi: "Nhiệt độ cao nhất là 30 độ.", displayOrder: 1 },
    ],
    quizzes: [
      { questionJp: "「晴れ」はどういう意味？", questionVi: "「晴れ」nghĩa là gì?", quizType: "multiple_choice", options: ["Trời nắng", "Trời mưa", "Trời âm u", "Có tuyết"], correctAnswer: "Trời nắng", explanationJp: "晴れ（はれ）= 太陽が出ている天気", explanationVi: "晴れ (はれ) = trời nắng, có nắng", displayOrder: 0 },
    ],
  },
  magazine_horoscope: {
    titleJp: "今日の星占い",
    titleVi: "Tử vi hôm nay",
    summaryJp: "十二星座の今日の運勢を見てみましょう。",
    summaryVi: "Cùng xem vận mệnh hôm nay của 12 cung hoàng đạo.",
    contentJson: { zodiacFortunes: [
      { sign: "aries", signJp: "おひつじ座", fortuneJp: "今日は新しいことに挑戦するのに良い日です。", fortuneVi: "Hôm nay là ngày tốt để thử thách điều mới.", luckyItem: "赤いペン", luckyColor: "赤" },
      { sign: "taurus", signJp: "おうし座", fortuneJp: "金運が上がっています。買い物を楽しみましょう。", fortuneVi: "Vận tài chính đang lên. Hãy tận hưởng mua sắm.", luckyItem: "花", luckyColor: "緑" },
    ]},
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "運勢", reading: "うんせい", meaningVi: "vận mệnh, vận may", pos: "noun", jlptLevel: "N2", sentenceJp: "今日の運勢はどうですか。", sentenceVi: "Vận mệnh hôm nay thế nào?", displayOrder: 0 },
      { wordJp: "挑戦", reading: "ちょうせん", meaningVi: "thử thách", pos: "noun/suru", jlptLevel: "N2", sentenceJp: "新しいことに挑戦する。", sentenceVi: "Thử thách điều mới.", displayOrder: 1 },
    ],
    quizzes: [
      { questionJp: "「挑戦する」の意味は？", questionVi: "「挑戦する」nghĩa là gì?", quizType: "multiple_choice", options: ["Thử thách", "Nghỉ ngơi", "Từ chối", "Đồng ý"], correctAnswer: "Thử thách", explanationJp: "挑戦する（ちょうせんする）= challenge, try", explanationVi: "挑戦する = thử thách, thách thức", displayOrder: 0 },
    ],
  },
  magazine_loto: {
    titleJp: "今週のラッキーナンバー",
    titleVi: "Số may mắn tuần này",
    summaryJp: "日本語で数字を学びながら、ラッキーナンバーを見てみましょう！",
    summaryVi: "Vừa học số bằng tiếng Nhật, vừa xem số may mắn!",
    contentJson: { luckyNumbers: [7, 14, 23, 31, 38, 42], luckyKanji: ["七", "十四", "二十三", "三十一", "三十八", "四十二"], explanation_jp: "今週は「七」が特に運がいい数字です。", explanation_vi: "Tuần này số 7 đặc biệt may mắn.", funFact_jp: "日本では「七」は縁起がいい数字です。七福神がいます。", funFact_vi: "Ở Nhật, số 7 là số may mắn. Có Thất Phúc Thần (7 vị thần may mắn)." },
    jlptLevel: "N4",
    vocabItems: [
      { wordJp: "数字", reading: "すうじ", meaningVi: "con số, chữ số", pos: "noun", jlptLevel: "N4", sentenceJp: "この数字を覚えてください。", sentenceVi: "Hãy nhớ con số này.", displayOrder: 0 },
      { wordJp: "縁起がいい", reading: "えんぎがいい", meaningVi: "may mắn, điềm lành", pos: "expression", jlptLevel: "N2", sentenceJp: "赤は縁起がいい色です。", sentenceVi: "Màu đỏ là màu may mắn.", displayOrder: 1 },
    ],
    quizzes: [
      { questionJp: "「七」の読み方は？", questionVi: "Cách đọc của「七」?", quizType: "multiple_choice", options: ["なな/しち", "はち", "ろく", "きゅう"], correctAnswer: "なな/しち", explanationJp: "七 = なな or しち (7)", explanationVi: "七 đọc là なな hoặc しち, nghĩa là 7", displayOrder: 0 },
    ],
  },
  magazine_bjt_phrase: {
    titleJp: "ビジネス日本語：お疲れ様です",
    titleVi: "Business JP: お疲れ様です",
    summaryJp: "「お疲れ様です」の正しい使い方を学びましょう。",
    summaryVi: "Cùng học cách dùng đúng「お疲れ様です」.",
    contentJson: { phrase_jp: "お疲れ様です", phrase_vi: "Anh/chị vất vả rồi (lời chào trong công sở)", usage_note_jp: "同僚や上司に対して使う日常的なビジネス挨拶です。", usage_note_vi: "Là lời chào hàng ngày trong công sở, dùng với đồng nghiệp và cấp trên.", dialogue: [{ speaker: "田中", lineJp: "お疲れ様です。今日の会議の資料、できましたか。", lineVi: "Anh vất vả rồi. Tài liệu cuộc họp hôm nay xong chưa?" }, { speaker: "あなた", lineJp: "お疲れ様です。はい、もうすぐ完成します。", lineVi: "Anh vất vả rồi. Vâng, sắp xong rồi ạ." }], formality_level: "polite" },
    jlptLevel: "N3",
    vocabItems: [
      { wordJp: "会議", reading: "かいぎ", meaningVi: "cuộc họp", pos: "noun", jlptLevel: "N4", sentenceJp: "午後から会議があります。", sentenceVi: "Chiều nay có cuộc họp.", displayOrder: 0 },
      { wordJp: "資料", reading: "しりょう", meaningVi: "tài liệu", pos: "noun", jlptLevel: "N3", sentenceJp: "資料を準備してください。", sentenceVi: "Hãy chuẩn bị tài liệu.", displayOrder: 1 },
    ],
    quizzes: [
      { questionJp: "「お疲れ様です」はいつ使いますか？", questionVi: "Khi nào dùng「お疲れ様です」?", quizType: "multiple_choice", options: ["Chào đồng nghiệp ở công sở", "Đặt hàng ở nhà hàng", "Xin lỗi ai đó", "Từ chối lời mời"], correctAnswer: "Chào đồng nghiệp ở công sở", explanationJp: "「お疲れ様です」は職場での挨拶です。", explanationVi: "「お疲れ様です」là lời chào ở nơi làm việc.", displayOrder: 0 },
    ],
  },
};

async function seed() {
  console.log("🌱 Seeding magazine articles for past 7 days...");

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0];

    for (const kind of KINDS) {
      // Skip loto on non Mon/Thu
      const dayOfWeek = date.getDay();
      if (kind === "magazine_loto" && dayOfWeek !== 1 && dayOfWeek !== 4) continue;

      const sample = SAMPLE_CONTENT[kind];
      const kindShort = kind.replace("magazine_", "");
      const slug = `${dateStr}-${kindShort}-vi`;

      const existing = await prisma.magazineArticle.findUnique({ where: { slug } });
      if (existing) {
        console.log(`  ⏭ ${slug} already exists`);
        continue;
      }

      await prisma.magazineArticle.create({
        data: {
          slug,
          widgetKind: kind,
          contentDate: date,
          locale: "vi",
          titleJp: sample.titleJp,
          titleVi: sample.titleVi,
          summaryJp: sample.summaryJp,
          summaryVi: sample.summaryVi,
          contentJson: sample.contentJson,
          jlptLevel: sample.jlptLevel,
          sourceDataJson: {},
          aiModel: "seed",
          status: "published",
          publishedAt: date,
          seoTitle: sample.titleVi,
          seoDescription: sample.summaryVi,
          vocabItems: { createMany: { data: sample.vocabItems } },
          quizzes: { createMany: { data: sample.quizzes } },
        },
      });
      console.log(`  ✅ ${slug}`);
    }
  }

  console.log("\n🎉 Magazine seed complete!");
  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run seed script**

```bash
node scripts/seed-magazine.mjs
```

Expected: ~30 articles created (5 types × 7 days, minus loto non-Mon/Thu).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-magazine.mjs
git commit -m "feat(scripts): add magazine seed script for dev data"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `pnpm prisma generate` succeeds
- [ ] API server starts (`pnpm dev:api`) without errors
- [ ] `GET /magazine` returns seeded articles
- [ ] `GET /magazine/today` returns today's articles
- [ ] `GET /magazine/:slug` returns article with vocab + quizzes
- [ ] Web app: `/magazine` page renders archive with cards
- [ ] Web app: `/magazine/[slug]` renders article with quiz
- [ ] Cron jobs registered (check NestJS startup logs)
- [ ] Homepage widget shows today's content (or gracefully hides if empty)
