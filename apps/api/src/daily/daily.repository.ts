import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { greetingForHour, repairDailyContentFlashcardBackIfNeeded, todayDateKey } from "@nihongo-bjt/shared";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

interface SuggestedFlashcard {
  backText: string;
  frontText: string;
  reading?: string;
}

type DailyLearningLink = {
  href: string;
  label: string;
};

type DailyLearningSafeguard = {
  learningObjective: string;
  remediationLinks: DailyLearningLink[];
  riskDisclaimer: string;
  sourceDate: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
};

@Injectable()
export class DailyRepository {
  private readonly prisma = createPrismaClient();

  async home(locale: "vi" | "ja", userId?: string) {
    const today = new Date(`${todayDateKey(new Date())}T00:00:00.000Z`);
    const [configs, contentItems, dueReviews] = await Promise.all([
      this.prisma.dailyWidgetConfig.findMany({
        orderBy: { displayOrder: "asc" },
        where: { enabled: true, locale }
      }),
      this.prisma.dailyContentItem.findMany({
        include: { extraction: true },
        orderBy: { createdAt: "asc" },
        where: { contentDate: today, locale, status: "published" }
      }),
      userId
        ? this.prisma.userFlashcard.count({ where: { dueAt: { lte: new Date() }, userId } })
        : Promise.resolve(0)
    ]);

    if (userId) {
      await this.prisma.analyticsEvent.create({
        data: {
          eventName: "daily_hub_viewed",
          payload: { locale, widgetCount: configs.length },
          source: "api",
          userId
        }
      });
    }

    return {
      greeting: greetingForHour(new Date().getHours()),
      today: todayDateKey(today),
      dueReviews,
      widgets: configs.map((config) => ({
        config,
        item: this.withLearningSafeguard(
          contentItems.find((item) => item.widgetKind === config.widgetKind) ?? null,
          locale
        )
      }))
    };
  }

  widgets(locale: "vi" | "ja") {
    return this.prisma.dailyWidgetConfig.findMany({
      orderBy: { displayOrder: "asc" },
      where: { enabled: true, locale }
    });
  }

  async findPublishedItem(id: string) {
    const item = await this.prisma.dailyContentItem.findUnique({
      include: { extraction: true },
      where: { id }
    });
    if (!item || item.status !== "published") {
      throw new NotFoundException("Daily content item not found");
    }
    const safeguard = this.buildLearningSafeguard(item.widgetKind, item.extraction?.extractedEntries, item.locale as "vi" | "ja");
    return {
      id: item.id,
      title: item.title,
      widgetKind: item.widgetKind,
      contentDate: item.contentDate,
      locale: item.locale,
      japaneseText: item.japaneseText,
      readingText: item.readingText,
      explanationText: item.explanationText,
      bodyMd: item.bodyMd,
      sourceProvider: item.sourceProvider,
      sourceRef: item.sourceRef,
      ...(safeguard ? { learningSafeguard: safeguard } : {})
    };
  }

  async generateFlashcards(itemId: string, userId: string) {
    const item = await this.prisma.dailyContentItem.findUnique({
      include: { extraction: true },
      where: { id: itemId }
    });
    if (!item?.extraction) {
      throw new NotFoundException("Daily content item not found");
    }

    const rawCards = this.parseFlashcards(item.extraction.suggestedFlashcards);
    const cards = rawCards.map((card, index) => this.maybeRepairDailyFlashcardBack(item, card, index));
    if (cards.length === 0) {
      throw new NotFoundException("No suggested flashcards for daily content item");
    }

    return this.prisma.$transaction(async (tx) => {
      const deck = await tx.deck.create({
        data: {
          descriptionVi: item.explanationText,
          ownerUserId: userId,
          titleJa: `Daily Hub ${item.contentDate.toISOString().slice(0, 10)}`,
          titleVi: `Daily Hub - ${item.title}`
        }
      });

      for (const [index, card] of cards.entries()) {
        const variant = await tx.flashcardVariant.create({
          data: {
            backText: card.backText,
            frontText: card.frontText,
            reading: card.reading,
            sourceId: item.id,
            sourceType: "daily_content"
          }
        });
        await tx.deckCard.create({
          data: { cardId: variant.id, deckId: deck.id, position: index }
        });
        await tx.userFlashcard.create({ data: { cardId: variant.id, userId } });
      }

      await tx.dailyUserAction.create({
        data: {
          actionType: "flashcards_generated",
          dailyContentItemId: item.id,
          payload: { cardCount: cards.length, deckId: deck.id },
          userId
        }
      });
      await tx.analyticsEvent.create({
        data: {
          eventName: "daily_flashcards_generated",
          payload: { cardCount: cards.length, deckId: deck.id, itemId: item.id },
          source: "api",
          userId
        }
      });

      return { cardCount: cards.length, deck };
    });
  }

  async quickQuiz(itemId: string, userId?: string) {
    const item = await this.prisma.dailyContentItem.findUnique({
      include: { extraction: true },
      where: { id: itemId }
    });
    if (!item?.extraction) {
      throw new NotFoundException("Daily content item not found");
    }

    await this.logAction(itemId, "quick_quiz_started", "daily_quiz_started", userId, {
      widgetKind: item.widgetKind
    });

    return item.extraction.suggestedQuiz;
  }

  async completeQuickQuiz(itemId: string, input: { selectedIndex: number; userId?: string }) {
    const item = await this.prisma.dailyContentItem.findUnique({
      include: { extraction: true },
      where: { id: itemId }
    });
    if (!item?.extraction) {
      throw new NotFoundException("Daily content item not found");
    }

    const quiz = this.parseQuickQuizJson(item.extraction.suggestedQuiz);
    if (!quiz) {
      throw new NotFoundException("Quick quiz not available for this item");
    }
    if (input.selectedIndex >= quiz.options.length) {
      throw new BadRequestException("Invalid option index");
    }

    const selected = quiz.options[input.selectedIndex]!;
    const isCorrect = selected === quiz.answer;
    await this.logAction(itemId, "quick_quiz_completed", "daily_quiz_completed", input.userId, {
      isCorrect,
      selectedIndex: input.selectedIndex,
      widgetKind: item.widgetKind
    });
    return {
      correctAnswer: quiz.answer,
      isCorrect,
      options: quiz.options,
      prompt: quiz.prompt,
      selected
    };
  }

  async markUseful(itemId: string, userId?: string) {
    await this.logAction(itemId, "marked_useful", "daily_item_marked_useful", userId, {});
    return { ok: true };
  }

  adminWidgets(locale: "vi" | "ja") {
    return this.prisma.dailyWidgetConfig.findMany({
      orderBy: { displayOrder: "asc" },
      where: { locale }
    });
  }

  updateWidget(id: string, input: { displayOrder?: number; enabled?: boolean }) {
    return this.prisma.dailyWidgetConfig.update({
      data: input,
      where: { id }
    });
  }

  private async logAction(
    itemId: string,
    actionType: string,
    eventName: string,
    userId: string | undefined,
    payload: Record<string, unknown>
  ) {
    await this.prisma.$transaction([
      this.prisma.dailyUserAction.create({
        data: {
          actionType,
          dailyContentItemId: itemId,
          payload: payload as Prisma.InputJsonValue,
          userId
        }
      }),
      this.prisma.analyticsEvent.create({
        data: {
          eventName,
          payload: { ...payload, itemId } as Prisma.InputJsonValue,
          source: "api",
          userId
        }
      })
    ]);
  }

  private parseQuickQuizJson(
    value: Prisma.JsonValue
  ): { answer: string; options: string[]; prompt: string } | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const o = value as Record<string, unknown>;
    if (!Array.isArray(o.options)) {
      return null;
    }
    const options = o.options.filter((x): x is string => typeof x === "string");
    if (options.length === 0 || typeof o.answer !== "string" || typeof o.prompt !== "string") {
      return null;
    }
    return { answer: o.answer, options, prompt: o.prompt };
  }

  private maybeRepairDailyFlashcardBack(
    item: Prisma.DailyContentItemGetPayload<{ include: { extraction: true } }>,
    card: SuggestedFlashcard,
    index: number
  ): SuggestedFlashcard {
    if (index !== 0) {
      return card;
    }
    const fixed = repairDailyContentFlashcardBackIfNeeded(
      card.backText,
      item.bodyMd,
      item.explanationText
    );
    if (fixed == null) {
      return card;
    }
    return { ...card, backText: fixed };
  }

  private parseFlashcards(value: Prisma.JsonValue): SuggestedFlashcard[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "frontText" in item &&
        "backText" in item &&
        typeof item.frontText === "string" &&
        typeof item.backText === "string"
      ) {
        return [
          {
            backText: item.backText,
            frontText: item.frontText,
            reading:
              "reading" in item && typeof item.reading === "string" ? item.reading : undefined
          }
        ];
      }
      return [];
    });
  }

  private withLearningSafeguard(
    item: Prisma.DailyContentItemGetPayload<{ include: { extraction: true } }> | null,
    locale: "vi" | "ja"
  ) {
    if (!item) {
      return null;
    }
    const safeguard = this.buildLearningSafeguard(
      item.widgetKind,
      item.extraction?.extractedEntries,
      locale
    );
    return safeguard ? { ...item, learningSafeguard: safeguard } : item;
  }

  private buildLearningSafeguard(
    widgetKind: string,
    payload: Prisma.JsonValue | null | undefined,
    locale: "vi" | "ja"
  ): DailyLearningSafeguard | null {
    const normalizedKind = widgetKind.toLowerCase();
    const isLifeInJapan =
      normalizedKind.includes("life") ||
      normalizedKind.includes("housing") ||
      normalizedKind.includes("bank") ||
      normalizedKind.includes("tax") ||
      normalizedKind.includes("insurance") ||
      normalizedKind.includes("pension") ||
      normalizedKind.includes("lottery") ||
      normalizedKind.includes("stock") ||
      normalizedKind.includes("crypto");

    if (!isLifeInJapan) {
      return null;
    }

    const p =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const links = this.parseRemediationLinks(p.remediationLinks);
    const defaultObjective =
      locale === "ja"
        ? "日本での生活場面を日本語とリスク理解の文脈で学ぶ"
        : "Học ngữ cảnh sống tại Nhật theo hướng hiểu ngôn ngữ và rủi ro";
    const defaultDisclaimer =
      locale === "ja"
        ? "これは学習目的の内容であり、法律・税務・金融の助言ではありません。必ず公式情報で確認してください。"
        : "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn pháp lý/thuế/tài chính. Hãy xác minh bằng nguồn chính thức.";

    return {
      learningObjective:
        typeof p.learningObjective === "string" && p.learningObjective.trim().length > 0
          ? p.learningObjective.trim()
          : defaultObjective,
      remediationLinks: links,
      riskDisclaimer:
        typeof p.riskDisclaimer === "string" && p.riskDisclaimer.trim().length > 0
          ? p.riskDisclaimer.trim()
          : defaultDisclaimer,
      sourceDate: this.normalizeOptionalText(p.sourceDate),
      sourceTitle: this.normalizeOptionalText(p.sourceTitle),
      sourceUrl: this.normalizeSourceUrl(p.sourceUrl)
    };
  }

  private parseRemediationLinks(value: unknown): DailyLearningLink[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return [];
      }
      const candidate = entry as Record<string, unknown>;
      const href = typeof candidate.href === "string" ? candidate.href.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      if (!href || !label) {
        return [];
      }
      if (!(href.startsWith("http://") || href.startsWith("https://"))) {
        return [];
      }
      return [{ href, label }];
    });
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeSourceUrl(value: unknown): string | null {
    const url = this.normalizeOptionalText(value);
    if (!url) {
      return null;
    }
    if (!(url.startsWith("http://") || url.startsWith("https://"))) {
      return null;
    }
    return url;
  }
}
