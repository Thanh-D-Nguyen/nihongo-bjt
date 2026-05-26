import { Inject, Injectable, Logger } from "@nestjs/common";
import { MagazineRepository } from "./magazine.repository.js";
import { AiContentProvider, type GenerationContext } from "./providers/ai-content.provider.js";
import { JmaWeatherProvider } from "./providers/jma-weather.provider.js";
import { LotoDataProvider } from "./providers/loto-data.provider.js";

@Injectable()
export class MagazineGenerationService {
  private readonly logger = new Logger(MagazineGenerationService.name);

  constructor(
    @Inject(MagazineRepository) private readonly repo: MagazineRepository,
    @Inject(AiContentProvider) private readonly ai: AiContentProvider,
    @Inject(JmaWeatherProvider) private readonly weather: JmaWeatherProvider,
    @Inject(LotoDataProvider) private readonly loto: LotoDataProvider,
  ) {}

  async generateForDate(widgetKind: string, date: Date, locale = "vi"): Promise<string | null> {
    // Idempotent: skip if already generated
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
