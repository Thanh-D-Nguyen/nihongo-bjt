import { createHash } from "node:crypto";

import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

export type NhkNewsType = "easy" | "normal";

export interface NhkArticleSummary {
  id: string;
  title: string;
  titleWithRuby: string | null;
  publishedAt: string;
  imageUrl: string | null;
  difficulty: string | null;
  url: string;
  sourceType: NhkNewsType;
  sourceLabel: "NHK Easy" | "NHK";
}

export interface NhkArticleDetail extends NhkArticleSummary {
  bodyHtml: string;
  bodyPlain: string;
  vocabulary: NhkVocabItem[];
}

export interface NhkVocabItem {
  word: string;
  reading: string | null;
  meaning: string | null;
  pos: string | null;
}

export interface NhkNewsConfig {
  defaultType: NhkNewsType;
  easyEnabled: boolean;
  easyFeedUrl: string;
  normalEnabled: boolean;
  normalFeedUrl: string;
  widgetId: string | null;
}

const CONFIG_WIDGET_KIND = "nhk_news_home";
const DEFAULT_EASY_FEED_URL = "https://nhkeasier.com/feed/";
const DEFAULT_NORMAL_FEED_URL = "https://www3.nhk.or.jp/rss/news/cat0.xml";
const DEFAULT_NORMAL_CATEGORY_FEED_URLS = Array.from(
  { length: 7 },
  (_, index) => `https://www3.nhk.or.jp/rss/news/cat${index + 1}.xml`
);
const HTTP_TIMEOUT_MS = 8_000;
const NEWS_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const NEWS_IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedArticle = NhkArticleSummary & { summaryHtml?: string | null; summaryPlain?: string | null };
type TimedCacheEntry<T> = { expiresAt: number; promise: Promise<T> };
const articleCache = new Map<string, CachedArticle>();
const listCache = new Map<string, TimedCacheEntry<NhkArticleSummary[]>>();
const imageCache = new Map<string, TimedCacheEntry<string | null>>();

function cached<T>(store: Map<string, TimedCacheEntry<T>>, key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = loader().catch((error) => {
    store.delete(key);
    throw error;
  });
  store.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

function cleanText(input: string | null | undefined) {
  return decodeHtml(input ?? "")
    .replace(/<!\[CDATA\[/gu, "")
    .replace(/\]\]>/gu, "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[/gu, "")
    .replace(/\]\]>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'");
}

function stripTags(input: string) {
  return cleanText(input);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function stableId(type: NhkNewsType, urlOrId: string) {
  const hash = createHash("sha1").update(`${type}:${urlOrId}`).digest("hex").slice(0, 16);
  return `${type}-${hash}`;
}

function firstMatch(input: string, re: RegExp) {
  return re.exec(input)?.[1]?.trim() ?? null;
}

function firstCapture(input: string, re: RegExp) {
  const match = re.exec(input);
  if (!match) return null;
  return match.slice(1).find((group) => group?.trim())?.trim() ?? null;
}

function htmlAttr(tag: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*(['"])(.*?)\\1`, "iu").exec(tag);
  return match?.[2]?.trim() ?? null;
}

function imageUrlOrNull(input: string | null | undefined, baseUrl?: string) {
  if (!input) return null;
  try {
    const url = baseUrl ? new URL(input, baseUrl) : new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.protocol === "http:") url.protocol = "https:";
    const pathname = url.pathname.toLowerCase();
    if (url.hostname === "imgu.web.nhk") return url.toString();
    if (/\.(avif|gif|jpe?g|png|webp)$/u.test(pathname)) return url.toString();
  } catch {
    return null;
  }
  return null;
}

function normalizeHttpUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported_url_protocol");
  if (url.protocol === "http:") url.protocol = "https:";
  return url.toString();
}

function isNhkArticleUrl(input: string) {
  try {
    const url = new URL(input);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "www3.nhk.or.jp" || url.hostname === "www3.nhk.jp" || url.hostname === "nhkeasier.com")
    );
  } catch {
    return false;
  }
}

function deriveNewsWebUrl(input: string): string | null {
  try {
    const url = new URL(input);
    const id = url.pathname.match(/(k\d{11,})/iu)?.[1];
    if (!id) return null;
    return `https://news.web.nhk/newsweb/na/na-${id}`;
  } catch {
    return null;
  }
}

function extractImageFromHtml(html: string, baseUrl?: string) {
  const metaTags = html.match(/<meta\b[^>]*>/giu) ?? [];
  for (const tag of metaTags) {
    const metaName = htmlAttr(tag, "property") ?? htmlAttr(tag, "name");
    if (!metaName || !/^(og:image|twitter:image)$/iu.test(metaName)) continue;
    const imageUrl = imageUrlOrNull(htmlAttr(tag, "content"), baseUrl);
    if (imageUrl) return imageUrl;
  }

  const imageTags = html.match(/<img\b[^>]*>/giu) ?? [];
  for (const tag of imageTags) {
    const imageUrl = imageUrlOrNull(htmlAttr(tag, "src"), baseUrl);
    if (imageUrl) return imageUrl;
  }

  // NHK pages (news.web.nhk) often embed image URLs inside JSON/script payloads instead of visible <img>.
  const embeddedImageUrls = html.match(/https?:\/\/imgu\.web\.nhk\/[^\s"'<>]+/giu) ?? [];
  for (const candidate of embeddedImageUrls) {
    const imageUrl = imageUrlOrNull(candidate, baseUrl);
    if (imageUrl) return imageUrl;
  }

  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "accept": "application/json, application/rss+xml, application/xml, text/xml, text/html;q=0.9",
      "user-agent": "NihonGoBJT/1.0 (+https://nihongo-bjt.local)"
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`nhk_fetch_failed:${res.status}`);
  return res.text();
}

function normalizeDate(raw: unknown) {
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function findFirstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findFirstArray(v);
      if (found.length > 0) return found;
    }
  }
  return [];
}

function stringField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseEasyRows(rawJson: string, limit: number): NhkArticleSummary[] {
  const parsed = JSON.parse(rawJson) as unknown;
  const rows = findFirstArray(parsed);
  const articles: NhkArticleSummary[] = rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .reduce<NhkArticleSummary[]>((acc, row) => {
      const upstreamId = stringField(row, ["news_id", "id", "newsId"]);
      const title = stringField(row, ["title", "title_with_ruby_removed", "titleWithoutRuby"]);
      const titleWithRuby = stringField(row, ["title_with_ruby", "titleWithRuby"]) || null;
      const url =
        stringField(row, ["news_web_url", "url", "link"]) ||
        (upstreamId ? `https://www3.nhk.or.jp/news/easy/${upstreamId}/${upstreamId}.html` : "");
      const imageUrl = imageUrlOrNull(stringField(row, ["news_web_image_uri", "imageUrl", "image", "thumbnail"]));
      const publishedAt = normalizeDate(
        stringField(row, ["news_prearranged_time", "publishedAt", "pubDate", "date"])
      );
      if (!title || !url) return acc;
      acc.push({
        difficulty: "Easy",
        id: stableId("easy", upstreamId || url),
        imageUrl,
        publishedAt,
        sourceLabel: "NHK Easy" as const,
        sourceType: "easy" as const,
        title,
        titleWithRuby,
        url
      });
      return acc;
    }, []);
  return articles.slice(0, limit);
}

function parseEasyFeed(raw: string, limit: number): NhkArticleSummary[] {
  try {
    return parseEasyRows(raw, limit);
  } catch {
    return parseRssItems(raw, limit).map((article) => ({
      ...article,
      difficulty: "Easy",
      id: stableId("easy", article.url),
      sourceLabel: "NHK Easy" as const,
      sourceType: "easy" as const
    }));
  }
}

function parseRssItems(xml: string, limit: number): CachedArticle[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/giu) ?? [];
  const articles = itemBlocks.reduce<CachedArticle[]>((acc, item) => {
      const title = cleanText(firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/iu));
      const url = cleanText(firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/iu));
      const descriptionRaw = firstMatch(item, /<description[^>]*>([\s\S]*?)<\/description>/iu);
      const descriptionHtml = decodeHtml(descriptionRaw ?? "");
      const imageUrl = imageUrlOrNull(
        firstMatch(descriptionHtml, /<img[^>]+src="([^"]+)"/iu) ??
          firstCapture(item, /<media:content[^>]*(?:type="image\/[^"]+"[^>]*url="([^"]+)"|url="([^"]+)"[^>]*type="image\/[^"]+")/iu) ??
          firstCapture(item, /<enclosure[^>]*(?:type="image\/[^"]+"[^>]*url="([^"]+)"|url="([^"]+)"[^>]*type="image\/[^"]+")/iu),
        url
      );
      const publishedAt = normalizeDate(cleanText(firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/iu)));
      if (!title || !url) return acc;
      const summaryPlain = cleanText(descriptionHtml);
      acc.push({
        difficulty: null,
        id: stableId("normal", url),
        imageUrl,
        publishedAt,
        sourceLabel: "NHK" as const,
        sourceType: "normal" as const,
        summaryHtml: descriptionHtml || null,
        summaryPlain,
        title,
        titleWithRuby: null,
        url
      });
      return acc;
    }, []);
  return articles.slice(0, limit);
}

function mergeArticles(articles: CachedArticle[], limit: number) {
  const seen = new Set<string>();
  return articles
    .filter((article) => {
      const key = article.url || article.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

function extractVocabularyFromRuby(html: string): NhkVocabItem[] {
  const seen = new Set<string>();
  const out: NhkVocabItem[] = [];
  const rubyRe = /<ruby>\s*([^<]+?)\s*<rt>([^<]+?)<\/rt>\s*<\/ruby>/giu;
  let match: RegExpExecArray | null;
  while ((match = rubyRe.exec(html))) {
    const word = cleanText(match[1]);
    const reading = cleanText(match[2]);
    if (!word || word.length < 2 || seen.has(word)) continue;
    seen.add(word);
    out.push({ meaning: null, pos: null, reading: reading || null, word });
    if (out.length >= 18) break;
  }
  return out;
}

function extractVocabularyFromText(text: string): NhkVocabItem[] {
  const seen = new Set<string>();
  const out: NhkVocabItem[] = [];
  const matches = text.match(/[\p{Script=Han}々〆ヵヶ]{2,}/gu) ?? [];
  for (const raw of matches) {
    const word = raw.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push({ meaning: null, pos: null, reading: null, word });
    if (out.length >= 14) break;
  }
  return out;
}

function extractGrammarFromText(text: string): NhkVocabItem[] {
  const candidates = [
    { pattern: /ています|ています。/u, word: "〜ています", reading: null },
    { pattern: /そうです|そうだ/u, word: "〜そうです", reading: null },
    { pattern: /ために/u, word: "〜ために", reading: null },
    { pattern: /ように/u, word: "〜ように", reading: null },
    { pattern: /とき/u, word: "〜とき", reading: null },
    { pattern: /について/u, word: "〜について", reading: null },
    { pattern: /かもしれません/u, word: "〜かもしれません", reading: null },
    { pattern: /によると/u, word: "〜によると", reading: null }
  ];
  return candidates
    .filter((item) => item.pattern.test(text))
    .slice(0, 8)
    .map((item) => ({
      meaning: "Ngữ pháp xuất hiện trong bài / Grammar pattern from the article",
      pos: "grammar",
      reading: item.reading,
      word: item.word
    }));
}

function parseArticleHtml(url: string, html: string, fallback: CachedArticle): NhkArticleDetail {
  const decodedHtml = decodeHtml(html);
  const title =
    cleanText(firstMatch(decodedHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/iu)) ||
    cleanText(firstMatch(decodedHtml, /<title[^>]*>([\s\S]*?)<\/title>/iu)) ||
    fallback.title;
  const articleBlock =
    firstMatch(decodedHtml, /<article[^>]*>([\s\S]*?)<\/article>/iu) ??
    firstMatch(decodedHtml, /<main[^>]*>([\s\S]*?)<\/main>/iu) ??
    fallback.summaryHtml ??
    `<p>${escapeHtml(fallback.summaryPlain || fallback.title)}</p>`;
  const cleanBlock = articleBlock.replace(/<audio\b[\s\S]*?<\/audio>/giu, "").replace(/<ul\b[\s\S]*?<\/ul>/giu, "");
  const paragraphs = cleanBlock.match(/<p\b[\s\S]*?<\/p>/giu);
  const bodyHtml = paragraphs?.slice(0, 12).join("\n") ?? `<p>${escapeHtml(stripTags(cleanBlock))}</p>`;
  const bodyPlain = stripTags(bodyHtml) || fallback.summaryPlain || fallback.title;
  const imageUrl =
    fallback.imageUrl ??
    extractImageFromHtml(decodedHtml, url) ??
    imageUrlOrNull(firstMatch(cleanBlock, /<img[^>]+src="([^"]+)"/iu), url);
  const vocab = extractVocabularyFromRuby(`${fallback.titleWithRuby ?? ""}\n${bodyHtml}`);
  const vocabulary = vocab.length > 0 ? vocab : extractVocabularyFromText(`${title}\n${bodyPlain}`);
  const grammar = extractGrammarFromText(bodyPlain);
  return {
    ...fallback,
    bodyHtml,
    bodyPlain,
    imageUrl,
    title,
    url,
    vocabulary: [...vocabulary, ...grammar]
  };
}

@Injectable()
export class NhkNewsRepository {
  private _prisma: ReturnType<typeof createPrismaClient> | null = null;
  private get prisma() {
    if (!this._prisma) this._prisma = createPrismaClient();
    return this._prisma;
  }

  async getConfig(locale = "vi"): Promise<NhkNewsConfig> {
    const row = await this.prisma.dailyWidgetConfig.findFirst({
      where: { locale, widgetKind: CONFIG_WIDGET_KIND }
    });
    const settings = (row?.settings ?? {}) as Record<string, unknown>;
    const easyEnabled = typeof settings.easyEnabled === "boolean" ? settings.easyEnabled : true;
    const normalEnabled = typeof settings.normalEnabled === "boolean" ? settings.normalEnabled : true;
    const rawDefault = settings.defaultType === "normal" ? "normal" : "easy";
    const defaultType = rawDefault === "normal" && !normalEnabled && easyEnabled ? "easy" : rawDefault;
    return {
      defaultType,
      easyEnabled,
      easyFeedUrl: typeof settings.easyFeedUrl === "string" ? settings.easyFeedUrl : DEFAULT_EASY_FEED_URL,
      normalEnabled,
      normalFeedUrl: typeof settings.normalFeedUrl === "string" ? settings.normalFeedUrl : DEFAULT_NORMAL_FEED_URL,
      widgetId: row?.id ?? null
    };
  }

  async updateConfig(
    locale: string,
    data: Partial<Omit<NhkNewsConfig, "widgetId">>
  ): Promise<NhkNewsConfig> {
    const current = await this.getConfig(locale);
    const next: Omit<NhkNewsConfig, "widgetId"> = {
      defaultType: data.defaultType ?? current.defaultType,
      easyEnabled: data.easyEnabled ?? current.easyEnabled,
      easyFeedUrl: data.easyFeedUrl?.trim() || current.easyFeedUrl,
      normalEnabled: data.normalEnabled ?? current.normalEnabled,
      normalFeedUrl: data.normalFeedUrl?.trim() || current.normalFeedUrl
    };
    if (next.defaultType === "easy" && !next.easyEnabled && next.normalEnabled) next.defaultType = "normal";
    if (next.defaultType === "normal" && !next.normalEnabled && next.easyEnabled) next.defaultType = "easy";

    await this.prisma.dailyWidgetConfig.upsert({
      create: {
        displayOrder: 30,
        enabled: next.easyEnabled || next.normalEnabled,
        locale,
        settings: next,
        widgetKind: CONFIG_WIDGET_KIND
      },
      update: {
        enabled: next.easyEnabled || next.normalEnabled,
        settings: next
      },
      where: {
        widgetKind_locale: {
          locale,
          widgetKind: CONFIG_WIDGET_KIND
        }
      }
    });
    return this.getConfig(locale);
  }

  async listArticles(
    limit = 10,
    type: NhkNewsType | "default" = "default",
    locale = "vi"
  ): Promise<NhkArticleSummary[]> {
    const config = await this.getConfig(locale);
    const resolvedType = type === "default" ? config.defaultType : type;
    if (resolvedType === "easy" && !config.easyEnabled) return [];
    if (resolvedType === "normal" && !config.normalEnabled) return [];
    const feedUrl = resolvedType === "easy" ? config.easyFeedUrl : config.normalFeedUrl;
    const cacheKey = `${locale}:${resolvedType}:${limit}:${feedUrl}`;

    return cached(listCache, cacheKey, NEWS_LIST_CACHE_TTL_MS, async () => {
      let articles =
        resolvedType === "easy"
          ? parseEasyFeed(await fetchText(feedUrl), limit)
          : await this.listNormalArticlesFromFeeds(feedUrl, limit);
      for (const article of articles) {
        articleCache.set(article.id, article);
      }
      return articles.slice(0, limit);
    });
  }

  private async listNormalArticlesFromFeeds(feedUrl: string, limit: number) {
    const urls =
      feedUrl === DEFAULT_NORMAL_FEED_URL
        ? [DEFAULT_NORMAL_FEED_URL, ...DEFAULT_NORMAL_CATEGORY_FEED_URLS]
        : [feedUrl];
    const settled = await Promise.allSettled(urls.map(async (url) => parseRssItems(await fetchText(url), limit * 3)));
    const articles = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    return mergeArticles(articles, limit);
  }

  async resolveArticleImage(articleUrl: string): Promise<string | null> {
    if (!isNhkArticleUrl(articleUrl)) return null;
    const normalizedUrl = normalizeHttpUrl(articleUrl);
    const fallbackNewsWebUrl = deriveNewsWebUrl(normalizedUrl);
    try {
      const imageUrl = await cached(imageCache, normalizedUrl, NEWS_IMAGE_CACHE_TTL_MS, async () =>
        extractImageFromHtml(await fetchText(normalizedUrl), normalizedUrl)
      );
      // Do not cache misses: NHK may temporarily serve consent/variant HTML without image metadata.
      if (!imageUrl) {
        imageCache.delete(normalizedUrl);
      }
      if (imageUrl) return imageUrl;
      if (!fallbackNewsWebUrl || fallbackNewsWebUrl === normalizedUrl) return null;
      return extractImageFromHtml(await fetchText(fallbackNewsWebUrl), fallbackNewsWebUrl);
    } catch {
      if (fallbackNewsWebUrl && fallbackNewsWebUrl !== normalizedUrl) {
        try {
          return extractImageFromHtml(await fetchText(fallbackNewsWebUrl), fallbackNewsWebUrl);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  async getArticleDetail(articleId: string): Promise<NhkArticleDetail | null> {
    let article = articleCache.get(articleId);
    if (!article) {
      const [easy, normal] = await Promise.allSettled([
        this.listArticles(30, "easy"),
        this.listArticles(30, "normal")
      ]);
      const all = [
        ...(easy.status === "fulfilled" ? easy.value : []),
        ...(normal.status === "fulfilled" ? normal.value : [])
      ];
      article = all.find((row) => row.id === articleId);
    }
    if (!article) return null;

    try {
      return parseArticleHtml(article.url, await fetchText(article.url), article);
    } catch {
      const fallbackText = `${article.title}\n${article.summaryPlain ?? ""}`;
      return {
        ...article,
        bodyHtml: `<p>${escapeHtml(article.summaryPlain || article.title)}</p>`,
        bodyPlain: article.summaryPlain || article.title,
        vocabulary: [...extractVocabularyFromText(fallbackText), ...extractGrammarFromText(fallbackText)]
      };
    }
  }

  async refreshPreview(locale = "vi") {
    const [easy, normal] = await Promise.allSettled([
      this.listArticles(10, "easy", locale),
      this.listArticles(10, "normal", locale)
    ]);
    return {
      easy: easy.status === "fulfilled" ? { count: easy.value.length, ok: true } : { count: 0, ok: false },
      normal:
        normal.status === "fulfilled" ? { count: normal.value.length, ok: true } : { count: 0, ok: false },
      refreshedAt: new Date().toISOString()
    };
  }

  async createFlashcardFromArticle(
    userId: string,
    articleId: string,
    word: string,
    reading: string | null,
    meaning: string | null,
    cardType: "kanji" | "vocabulary" | "grammar"
  ) {
    let deck = await this.prisma.deck.findFirst({
      where: { ownerUserId: userId, titleVi: "NHK News", status: "active" },
    });

    if (!deck) {
      deck = await this.prisma.deck.create({
        data: {
          ownerUserId: userId,
          titleVi: "NHK News",
          titleJa: "NHKニュース",
          descriptionVi: "Flashcard tạo từ bài NHK News",
          descriptionJa: "NHKニュースから作成したフラッシュカード",
          status: "active",
        },
      });
    }

    const backText = [reading, meaning].filter(Boolean).join(" — ") || word;

    return this.prisma.$transaction(async (tx) => {
      const existingCards = await tx.deckCard.findMany({
        where: { deckId: deck.id },
        include: { card: true },
      });
      const duplicate = existingCards.find((dc) => dc.card.frontText === word);
      if (duplicate) {
        return { created: false, flashcardId: duplicate.cardId, message: "already_exists" };
      }

      const position = existingCards.length;
      const card = await tx.flashcardVariant.create({
        data: {
          frontText: word,
          backText,
          reading,
          sourceType: `nhk_${cardType}`,
          sourceId: deck.id,
        },
      });

      await tx.deckCard.create({
        data: { cardId: card.id, deckId: deck.id, position },
      });

      await tx.userFlashcard.create({
        data: { cardId: card.id, userId },
      });

      await tx.analyticsEvent.create({
        data: {
          eventName: "nhk_flashcard_created",
          source: "nhk_news",
          payload: { articleId, word, cardType, flashcardId: card.id },
          userId,
        },
      });

      return { created: true, flashcardId: card.id, message: "created" };
    });
  }

  async createDeckFromArticle(userId: string, articleId: string, deckTitle?: string | null) {
    const article = await this.getArticleDetail(articleId);
    if (!article) return null;
    const items = (article.vocabulary.length > 0
      ? article.vocabulary
      : [...extractVocabularyFromText(`${article.title}\n${article.bodyPlain}`), ...extractGrammarFromText(article.bodyPlain)]
    ).slice(0, 40);
    if (items.length === 0) {
      return { articleId, created: 0, deckId: null, message: "no_vocabulary", skipped: 0 };
    }

    const title = deckTitle?.trim() || `NHK News - ${article.title.slice(0, 42)}`;

    return this.prisma.$transaction(async (tx) => {
      let deck = await tx.deck.findFirst({
        where: { ownerUserId: userId, status: "active", titleVi: title }
      });
      if (!deck) {
        deck = await tx.deck.create({
          data: {
            descriptionJa: `NHKニュース記事「${article.title}」から作成`,
            descriptionVi: `Tạo từ bài NHK: ${article.title}`,
            ownerUserId: userId,
            status: "active",
            titleJa: title,
            titleVi: title
          }
        });
      }

      const existingCards = await tx.deckCard.findMany({
        include: { card: true },
        where: { deckId: deck.id }
      });
      const existingFronts = new Set(existingCards.map((row) => row.card.frontText));
      let position = existingCards.length;
      let created = 0;
      let skipped = 0;

      for (const item of items) {
        if (existingFronts.has(item.word)) {
          skipped += 1;
          continue;
        }
        const cardType = item.pos === "grammar" ? "grammar" : "vocabulary";
        const backText = [item.reading, item.meaning].filter(Boolean).join(" — ") || article.title;
        const card = await tx.flashcardVariant.create({
          data: {
            backText,
            frontText: item.word,
            reading: item.reading,
            sourceId: deck.id,
            sourceType: `nhk_${cardType}`
          }
        });
        await tx.deckCard.create({ data: { cardId: card.id, deckId: deck.id, position } });
        await tx.userFlashcard.create({ data: { cardId: card.id, userId } });
        existingFronts.add(item.word);
        position += 1;
        created += 1;
      }

      await tx.analyticsEvent.create({
        data: {
          eventName: "nhk_deck_created",
          payload: { articleId, created, deckId: deck.id, skipped, title },
          source: "nhk_news",
          userId
        }
      });

      return { articleId, created, deckId: deck.id, message: "created", skipped };
    });
  }
}
