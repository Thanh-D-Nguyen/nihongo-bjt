import { createHash } from "node:crypto";
import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";

import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

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
  audioUrl: string | null;
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

const CONFIG_WIDGET_KIND = "nhk_news";
const DEFAULT_EASY_FEED_URL = "https://nhkeasier.com/feed/";
const DEFAULT_NORMAL_FEED_URL = "https://www3.nhk.or.jp/rss/news/cat0.xml";
const DEFAULT_NORMAL_CATEGORY_FEED_URLS = Array.from(
  { length: 7 },
  (_, index) => `https://www3.nhk.or.jp/rss/news/cat${index + 1}.xml`
);
const HTTP_TIMEOUT_MS = 8_000;
const NEWS_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const NEWS_IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedArticle = NhkArticleSummary & { audioUrl?: string | null; summaryHtml?: string | null; summaryPlain?: string | null };
type TimedCacheEntry<T> = { expiresAt: number; promise: Promise<T> };
const ARTICLE_CACHE_MAX = 500;
const IMAGE_CACHE_MAX = 200;
const articleCache = new Map<string, CachedArticle>();
const listCache = new Map<string, TimedCacheEntry<NhkArticleSummary[]>>();
const imageCache = new Map<string, TimedCacheEntry<string | null>>();

/** Evict oldest entries when map exceeds max size (simple LRU via insertion order) */
function evictOldest<V>(map: Map<string, V>, max: number) {
  if (map.size <= max) return;
  const toDelete = map.size - max;
  let deleted = 0;
  for (const key of map.keys()) {
    if (deleted >= toDelete) break;
    map.delete(key);
    deleted++;
  }
}

function cached<T>(store: Map<string, TimedCacheEntry<T>>, key: string, ttlMs: number, loader: () => Promise<T>, maxSize?: number) {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = loader().catch((error) => {
    store.delete(key);
    throw error;
  });
  store.set(key, { expiresAt: now + ttlMs, promise });
  if (maxSize) evictOldest(store, maxSize);
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
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
  const target = new URL(url);

  if (proxyUrl && target.protocol === "https:") {
    return fetchViaProxy(target, proxyUrl);
  }

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

function fetchViaProxy(target: URL, proxyUrl: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyUrl);
    const timeout = HTTP_TIMEOUT_MS;
    const connectReq = http.request({
      hostname: proxy.hostname,
      port: Number(proxy.port) || 8080,
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`
    });
    connectReq.setTimeout(timeout, () => { connectReq.destroy(); reject(new Error("proxy_connect_timeout")); });
    connectReq.on("error", reject);
    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`proxy_connect_failed:${res.statusCode}`));
        return;
      }
      const tlsSocket = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: false }, () => {
        const req = http.request(
          { createConnection: () => tlsSocket, hostname: target.hostname, path: target.pathname + target.search, method: "GET", headers: { host: target.host, "user-agent": "NihonGoBJT/1.0 (+https://nihongo-bjt.local)", "accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9", "accept-encoding": "identity" } },
          (resp) => {
            // Follow redirects
            if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && redirectsLeft > 0) {
              tlsSocket.destroy();
              const redirectUrl = new URL(resp.headers.location, target.href);
              resolve(redirectUrl.protocol === "https:" ? fetchViaProxy(redirectUrl, proxyUrl, redirectsLeft - 1) : fetchText(redirectUrl.href));
              return;
            }
            if (!resp.statusCode || resp.statusCode >= 400) {
              reject(new Error(`nhk_fetch_failed:${resp.statusCode}`));
              return;
            }
            const chunks: Buffer[] = [];
            resp.on("data", (chunk: Buffer) => { chunks.push(chunk); });
            resp.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            resp.on("error", reject);
          }
        );
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error("nhk_fetch_timeout")); });
        req.on("error", reject);
        req.end();
      });
      tlsSocket.on("error", reject);
    });
    connectReq.end();
  });
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

function parseEasyRows(rawJson: string, limit: number): CachedArticle[] {
  const parsed = JSON.parse(rawJson) as unknown;
  const rows = findFirstArray(parsed);
  const articles: CachedArticle[] = rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .reduce<CachedArticle[]>((acc, row) => {
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

function parseEasyFeed(raw: string, limit: number): CachedArticle[] {
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
      const audioUrl =
        firstMatch(descriptionHtml, /<audio[^>]+src="([^"]+)"/iu) ??
        firstCapture(item, /<enclosure[^>]*(?:type="audio\/[^"]+"[^>]*url="([^"]+)"|url="([^"]+)"[^>]*type="audio\/[^"]+")/iu) ??
        null;
      acc.push({
        audioUrl,
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
    if (out.length >= 24) break;
  }
  return out;
}

function extractVocabularyFromText(text: string): NhkVocabItem[] {
  const seen = new Set<string>();
  const out: NhkVocabItem[] = [];
  // Kanji compounds (2+ kanji chars)
  const kanjiMatches = text.match(/[\p{Script=Han}々〆ヵヶ]{2,}/gu) ?? [];
  for (const raw of kanjiMatches) {
    const word = raw.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push({ meaning: null, pos: null, reading: null, word });
    if (out.length >= 20) break;
  }
  // Katakana words (3+ chars, likely loanwords / technical terms)
  const katakanaMatches = text.match(/[\p{Script=Katakana}ー]{3,}/gu) ?? [];
  for (const raw of katakanaMatches) {
    const word = raw.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push({ meaning: null, pos: "katakana", reading: null, word });
    if (out.length >= 28) break;
  }
  // Mixed kanji+kana compounds (e.g. 食べ物, 取り消し)
  const mixedMatches = text.match(/[\p{Script=Han}][\p{Script=Hiragana}\p{Script=Han}]{2,}/gu) ?? [];
  for (const raw of mixedMatches) {
    const word = raw.trim();
    if (!word || word.length < 3 || seen.has(word)) continue;
    seen.add(word);
    out.push({ meaning: null, pos: null, reading: null, word });
    if (out.length >= 32) break;
  }
  return out;
}

function extractGrammarFromText(text: string): NhkVocabItem[] {
  const candidates = [
    // N4-N3 patterns
    { pattern: /ています/u, word: "〜ています", reading: null },
    { pattern: /そうです|そうだ/u, word: "〜そうです", reading: null },
    { pattern: /ために/u, word: "〜ために", reading: null },
    { pattern: /ように/u, word: "〜ように", reading: null },
    { pattern: /とき/u, word: "〜とき", reading: null },
    { pattern: /について/u, word: "〜について", reading: null },
    { pattern: /かもしれません/u, word: "〜かもしれません", reading: null },
    { pattern: /によると/u, word: "〜によると", reading: null },
    // N3-N2 patterns (common in news)
    { pattern: /ことになった|ことになりました/u, word: "〜ことになる", reading: null },
    { pattern: /ことがある|ことがあります/u, word: "〜ことがある", reading: null },
    { pattern: /ようにする|ようにして/u, word: "〜ようにする", reading: null },
    { pattern: /てしまう|てしまった|てしまいました/u, word: "〜てしまう", reading: null },
    { pattern: /られる|られて|られた/u, word: "〜られる (受身/可能)", reading: null },
    { pattern: /ということ/u, word: "〜ということ", reading: null },
    { pattern: /に対して|に対し/u, word: "〜に対して", reading: null },
    { pattern: /として/u, word: "〜として", reading: null },
    // N2 news-specific
    { pattern: /にとって/u, word: "〜にとって", reading: null },
    { pattern: /に基づいて|に基づき/u, word: "〜に基づいて", reading: null },
    { pattern: /において|における/u, word: "〜において", reading: null },
    { pattern: /をはじめ/u, word: "〜をはじめ", reading: null },
  ];
  return candidates
    .filter((item) => item.pattern.test(text))
    .slice(0, 10)
    .map((item) => ({
      meaning: "Ngữ pháp xuất hiện trong bài / Grammar pattern from the article",
      pos: "grammar",
      reading: item.reading,
      word: item.word
    }));
}

/**
 * Extract NHK article ID (e.g. "k10015118891000") from an NHK www3 URL and
 * derive the news.web.nhk canonical URL + JSON API URL.
 */
function extractNhkArticleKey(url: string): string | null {
  const m = url.match(/\b(k\d{14,})\b/u);
  return m ? m[1] : null;
}

interface NhkApiMetadata {
  abstract: string | null;
  canonicalUrl: string | null;
  description: string | null;
  imageUrl: string | null;
  topics: string[];
}

function bestPublicText(candidates: Array<string | null | undefined>) {
  return candidates
    .map((candidate) => cleanText(candidate))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

function textToParagraphHtml(text: string) {
  const normalized = text
    .replace(/\r\n?/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  const chunks = normalized.includes("\n\n")
    ? normalized.split(/\n{2,}/gu)
    : normalized.split(/(?<=。)\s+/gu);
  const paragraphs = chunks.map((chunk) => cleanText(chunk)).filter(Boolean);
  return paragraphs.length > 0
    ? paragraphs.slice(0, 12).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")
    : "";
}

function isShortNormalArticleBody(bodyPlain: string | null | undefined) {
  return cleanText(bodyPlain).length < 90;
}

function isLegacyNormalArticleUrl(url: string | null | undefined) {
  return !url?.includes("news.web.nhk/newsweb/na/");
}

function isRicherBody(next: NhkArticleDetail, currentPlain: string | null | undefined) {
  return cleanText(next.bodyPlain).length > cleanText(currentPlain).length + 20;
}

async function fetchNhkApiMetadata(articleKey: string): Promise<NhkApiMetadata | null> {
  try {
    const apiUrl = `https://api.web.nhk/r8/t/newsarticle/na/na-${articleKey}.json`;
    const text = await fetchText(apiUrl);
    const data = JSON.parse(text) as Record<string, unknown>;
    const image = data.image as Record<string, { url?: string }> | undefined;
    const imageUrl = image?.medium?.url ?? image?.icon?.url ?? null;
    const canonicalUrl = typeof data.canonical === "string" ? data.canonical : null;
    const description = typeof data.description === "string" ? data.description : null;
    const abstract = typeof data.abstract === "string" ? data.abstract : null;
    const topicArr = Array.isArray(data.topic) ? data.topic : [];
    const topics = topicArr
      .filter((t): t is { name: string } => typeof t === "object" && t !== null && typeof (t as Record<string, unknown>).name === "string")
      .map((t) => t.name)
      .slice(0, 5);
    return { abstract, canonicalUrl, description, imageUrl, topics };
  } catch {
    return null;
  }
}

async function enrichNormalArticle(article: CachedArticle): Promise<NhkArticleDetail> {
  const rssBodyPlain = article.summaryPlain || article.title;
  const rssBodyHtml = article.summaryHtml
    ? article.summaryHtml.replace(/<audio\b[\s\S]*?<\/audio>/giu, "").replace(/<ul\b[\s\S]*?<\/ul>/giu, "")
    : `<p>${escapeHtml(rssBodyPlain)}</p>`;

  const articleKey = extractNhkArticleKey(article.url);
  let betterImage = article.imageUrl;
  let canonicalUrl = articleKey
    ? `https://news.web.nhk/newsweb/na/na-${articleKey}`
    : article.url;
  let topics: string[] = [];
  let apiBodyPlain = "";
  if (articleKey) {
    const meta = await fetchNhkApiMetadata(articleKey);
    if (meta?.imageUrl) betterImage = meta.imageUrl;
    if (meta?.canonicalUrl) canonicalUrl = meta.canonicalUrl;
    apiBodyPlain = bestPublicText([meta?.description, meta?.abstract]);
    if (meta?.topics) topics = meta.topics;
  }

  const bodyPlain = bestPublicText([apiBodyPlain, rssBodyPlain, article.title]) || article.title;
  const apiBodyHtml = textToParagraphHtml(bodyPlain);
  const rssParagraphs = rssBodyHtml.match(/<p\b[\s\S]*?<\/p>/giu);
  const cleanBody = apiBodyHtml || rssParagraphs?.slice(0, 12).join("\n") || `<p>${escapeHtml(bodyPlain)}</p>`;

  const fullText = `${article.title}\n${bodyPlain}`;
  const vocab = extractVocabularyFromText(fullText);
  const grammar = extractGrammarFromText(bodyPlain);

  return {
    ...article,
    audioUrl: article.audioUrl ?? null,
    bodyHtml: cleanBody + (topics.length > 0
      ? `\n<p class="nhk-topics"><span>${topics.map(escapeHtml).join("</span><span>")}</span></p>`
      : ""),
    bodyPlain,
    imageUrl: betterImage,
    url: canonicalUrl,
    vocabulary: [...vocab, ...grammar]
  };
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
  const audioUrl =
    fallback.audioUrl ??
    firstMatch(articleBlock, /<audio[^>]+src="([^"]+)"/iu) ??
    firstMatch(decodedHtml, /<audio[^>]+src="([^"]+)"/iu) ??
    null;
  return {
    ...fallback,
    audioUrl,
    bodyHtml,
    bodyPlain,
    imageUrl,
    title,
    url,
    vocabulary: [...vocabulary, ...grammar]
  };
}

@Injectable()
export class NhkNewsRepository implements OnModuleInit {
  private readonly logger = new Logger(NhkNewsRepository.name);
  private _prisma: ReturnType<typeof createPrismaClient> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private get prisma() {
    if (!this._prisma) this._prisma = createPrismaClient();
    return this._prisma;
  }

  onModuleInit() {
    // Background refresh every 5 minutes — keeps cache warm so users don't wait on cold fetches
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
    this.refreshTimer = setInterval(() => {
      void this.backgroundRefresh();
    }, REFRESH_INTERVAL_MS);
    // Initial warm-up after 10s
    setTimeout(() => void this.backgroundRefresh(), 10_000);
  }

  private async backgroundRefresh() {
    try {
      await Promise.allSettled([
        this.listArticles(20, "easy", "vi"),
        this.listArticles(20, "normal", "vi"),
      ]);
      this.logger.debug("NHK feeds refreshed in background");
    } catch {
      this.logger.warn("Background NHK refresh failed");
    }
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

    try {
      return await cached(listCache, cacheKey, NEWS_LIST_CACHE_TTL_MS, async () => {
        const articles =
          resolvedType === "easy"
            ? parseEasyFeed(await fetchText(feedUrl), limit)
            : await this.listNormalArticlesFromFeeds(feedUrl, limit);
        for (const article of articles) {
          articleCache.set(article.id, article);
          void this.persistArticleSummary(article).catch(() => {});
        }
        evictOldest(articleCache, ARTICLE_CACHE_MAX);
        return articles.slice(0, limit);
      });
    } catch {
      return [];
    }
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
        extractImageFromHtml(await fetchText(normalizedUrl), normalizedUrl),
        IMAGE_CACHE_MAX
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
    // Try DB first for persistent storage
    const dbArticle = await this.prisma.nhkArticle.findUnique({ where: { id: articleId } });
    if (dbArticle?.bodyHtml) {
      // If DB lacks audioUrl, check in-memory cache (may have been extracted from RSS)
      const cachedAudioUrl = dbArticle.audioUrl ?? articleCache.get(articleId)?.audioUrl ?? null;
      // Backfill audioUrl to DB if found in cache but missing in DB
      if (cachedAudioUrl && !dbArticle.audioUrl) {
        void this.prisma.nhkArticle.update({ where: { id: articleId }, data: { audioUrl: cachedAudioUrl } }).catch(() => {});
      }
      const persistedDetail: NhkArticleDetail = {
        audioUrl: cachedAudioUrl,
        bodyHtml: dbArticle.bodyHtml,
        bodyPlain: dbArticle.bodyPlain ?? "",
        difficulty: dbArticle.difficulty,
        id: dbArticle.id,
        imageUrl: dbArticle.imageUrl,
        publishedAt: dbArticle.publishedAt.toISOString(),
        sourceLabel: dbArticle.sourceType === "easy" ? "NHK Easy" : "NHK",
        sourceType: dbArticle.sourceType as NhkNewsType,
        title: dbArticle.title,
        titleWithRuby: dbArticle.titleWithRuby,
        url: dbArticle.url,
        vocabulary: (dbArticle.vocabulary as unknown as NhkVocabItem[]) ?? [],
      };
      if (
        persistedDetail.sourceType === "normal" &&
        (isShortNormalArticleBody(persistedDetail.bodyPlain) || isLegacyNormalArticleUrl(persistedDetail.url))
      ) {
        const refreshed = await enrichNormalArticle({
          ...persistedDetail,
          audioUrl: cachedAudioUrl,
          summaryHtml: persistedDetail.bodyHtml,
          summaryPlain: persistedDetail.bodyPlain
        });
        if (isRicherBody(refreshed, persistedDetail.bodyPlain) || refreshed.url !== persistedDetail.url) {
          void this.persistArticle(refreshed).catch(() => {});
          return refreshed;
        }
      }
      return persistedDetail;
    }

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

    // Normal NHK public endpoints expose only the article excerpt unless the
    // reader completes NHK's own usage confirmation/login flow.
    if (article.sourceType === "normal") {
      const enriched = await enrichNormalArticle(article);
      void this.persistArticle(enriched).catch(() => {});
      return enriched;
    }

    try {
      const detail = parseArticleHtml(article.url, await fetchText(article.url), article);
      // Persist to DB (fire-and-forget)
      void this.persistArticle(detail).catch(() => {});
      return detail;
    } catch {
      const fallbackText = `${article.title}\n${article.summaryPlain ?? ""}`;
      return {
        ...article,
        audioUrl: article.audioUrl ?? null,
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

  // ─── Persistent article storage ───

  private async persistArticle(article: NhkArticleDetail) {
    await this.prisma.nhkArticle.upsert({
      where: { id: article.id },
      create: {
        id: article.id,
        sourceType: article.sourceType,
        title: article.title,
        titleWithRuby: article.titleWithRuby,
        url: article.url,
        imageUrl: article.imageUrl,
        audioUrl: article.audioUrl,
        difficulty: article.difficulty,
        bodyHtml: article.bodyHtml,
        bodyPlain: article.bodyPlain,
        vocabulary: article.vocabulary as unknown as object,
        publishedAt: new Date(article.publishedAt),
      },
      update: {
        title: article.title,
        url: article.url,
        imageUrl: article.imageUrl,
        audioUrl: article.audioUrl,
        bodyHtml: article.bodyHtml,
        bodyPlain: article.bodyPlain,
        vocabulary: article.vocabulary as unknown as object,
      },
    });
  }

  async persistArticleSummary(article: NhkArticleSummary) {
    await this.prisma.nhkArticle.upsert({
      where: { id: article.id },
      create: {
        id: article.id,
        sourceType: article.sourceType,
        title: article.title,
        titleWithRuby: article.titleWithRuby,
        url: article.url,
        imageUrl: article.imageUrl,
        difficulty: article.difficulty,
        publishedAt: new Date(article.publishedAt),
      },
      update: {
        title: article.title,
        imageUrl: article.imageUrl,
      },
    });
  }

  // ─── Reading progress ───

  async trackReading(userId: string, articleId: string, readTimeSec?: number, completed?: boolean) {
    // Ensure article exists in DB (at least minimal)
    const exists = await this.prisma.nhkArticle.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!exists) return null;

    return this.prisma.nhkReadingProgress.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId, readTimeSec: readTimeSec ?? null, completed: completed ?? false },
      update: {
        readAt: new Date(),
        ...(readTimeSec != null ? { readTimeSec } : {}),
        ...(completed != null ? { completed } : {}),
      },
    });
  }

  async getReadingProgress(userId: string, articleIds?: string[]) {
    return this.prisma.nhkReadingProgress.findMany({
      where: {
        userId,
        ...(articleIds ? { articleId: { in: articleIds } } : {}),
      },
      orderBy: { readAt: "desc" },
      take: 100,
    });
  }

  // ─── Bookmarks ───

  async toggleBookmark(userId: string, articleId: string): Promise<{ bookmarked: boolean }> {
    const exists = await this.prisma.nhkArticle.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!exists) return { bookmarked: false };

    const existing = await this.prisma.nhkBookmark.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });
    if (existing) {
      await this.prisma.nhkBookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }
    await this.prisma.nhkBookmark.create({ data: { userId, articleId } });
    return { bookmarked: true };
  }

  async getBookmarks(userId: string, limit = 20, offset = 0) {
    const items = await this.prisma.nhkBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { article: true },
    });
    return items.map((bm) => ({
      bookmarkId: bm.id,
      createdAt: bm.createdAt.toISOString(),
      article: {
        id: bm.article.id,
        title: bm.article.title,
        imageUrl: bm.article.imageUrl,
        sourceType: bm.article.sourceType,
        difficulty: bm.article.difficulty,
        publishedAt: bm.article.publishedAt.toISOString(),
        url: bm.article.url,
      },
    }));
  }

  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    const bm = await this.prisma.nhkBookmark.findUnique({
      where: { userId_articleId: { userId, articleId } },
      select: { id: true },
    });
    return bm !== null;
  }
}
