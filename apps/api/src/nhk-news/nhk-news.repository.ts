import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

export interface NhkArticleSummary {
  id: string;
  title: string;
  titleWithRuby: string | null;
  publishedAt: string;
  imageUrl: string | null;
  difficulty: string | null;
  url: string;
}

export interface NhkArticleDetail extends NhkArticleSummary {
  bodyHtml: string;
  bodyPlain: string;
  /** Extracted vocabulary items from the article */
  vocabulary: NhkVocabItem[];
}

export interface NhkVocabItem {
  word: string;
  reading: string | null;
  meaning: string | null;
  pos: string | null;
}

const NHK_EASY_BASE = "https://www3.nhk.or.jp/news/easy";

/** High-quality seed articles with images for development */
const SEED_ARTICLES: NhkArticleSummary[] = [
  {
    id: "nhk-seed-001",
    title: "日本の会社で働く外国人が増えている",
    titleWithRuby:
      "日本<ruby>の<rt>の</rt></ruby><ruby>会社<rt>かいしゃ</rt></ruby>で<ruby>働<rt>はたら</rt></ruby>く<ruby>外国人<rt>がいこくじん</rt></ruby>が<ruby>増<rt>ふ</rt></ruby>えている",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=640&h=360&fit=crop",
    difficulty: "N3",
    url: `${NHK_EASY_BASE}/nhk-seed-001/nhk-seed-001.html`,
  },
  {
    id: "nhk-seed-002",
    title: "東京の電車が新しくなります",
    titleWithRuby:
      "<ruby>東京<rt>とうきょう</rt></ruby>の<ruby>電車<rt>でんしゃ</rt></ruby>が<ruby>新<rt>あたら</rt></ruby>しくなります",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1565803974275-dccd2f933cbb?w=640&h=360&fit=crop",
    difficulty: "N4",
    url: `${NHK_EASY_BASE}/nhk-seed-002/nhk-seed-002.html`,
  },
  {
    id: "nhk-seed-003",
    title: "日本で地震が起きたときに気をつけること",
    titleWithRuby:
      "<ruby>日本<rt>にほん</rt></ruby>で<ruby>地震<rt>じしん</rt></ruby>が<ruby>起<rt>お</rt></ruby>きたときに<ruby>気<rt>き</rt></ruby>をつけること",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=640&h=360&fit=crop",
    difficulty: "N3",
    url: `${NHK_EASY_BASE}/nhk-seed-003/nhk-seed-003.html`,
  },
  {
    id: "nhk-seed-004",
    title: "新しい薬が病気の人を助ける",
    titleWithRuby:
      "<ruby>新<rt>あたら</rt></ruby>しい<ruby>薬<rt>くすり</rt></ruby>が<ruby>病気<rt>びょうき</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>を<ruby>助<rt>たす</rt></ruby>ける",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=640&h=360&fit=crop",
    difficulty: "N4",
    url: `${NHK_EASY_BASE}/nhk-seed-004/nhk-seed-004.html`,
  },
  {
    id: "nhk-seed-005",
    title: "ビジネスメールの書き方を学ぶ",
    titleWithRuby: "ビジネスメールの<ruby>書<rt>か</rt></ruby>き<ruby>方<rt>かた</rt></ruby>を<ruby>学<rt>まな</rt></ruby>ぶ",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=640&h=360&fit=crop",
    difficulty: "N3",
    url: `${NHK_EASY_BASE}/nhk-seed-005/nhk-seed-005.html`,
  },
  {
    id: "nhk-seed-006",
    title: "桜の季節に外国人観光客が多く来る",
    titleWithRuby:
      "<ruby>桜<rt>さくら</rt></ruby>の<ruby>季節<rt>きせつ</rt></ruby>に<ruby>外国人<rt>がいこくじん</rt></ruby><ruby>観光客<rt>かんこうきゃく</rt></ruby>が<ruby>多<rt>おお</rt></ruby>く<ruby>来<rt>く</rt></ruby>る",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=640&h=360&fit=crop",
    difficulty: "N4",
    url: `${NHK_EASY_BASE}/nhk-seed-006/nhk-seed-006.html`,
  },
  {
    id: "nhk-seed-007",
    title: "日本の学校で英語の授業が変わる",
    titleWithRuby:
      "<ruby>日本<rt>にほん</rt></ruby>の<ruby>学校<rt>がっこう</rt></ruby>で<ruby>英語<rt>えいご</rt></ruby>の<ruby>授業<rt>じゅぎょう</rt></ruby>が<ruby>変<rt>か</rt></ruby>わる",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=640&h=360&fit=crop",
    difficulty: "N3",
    url: `${NHK_EASY_BASE}/nhk-seed-007/nhk-seed-007.html`,
  },
  {
    id: "nhk-seed-008",
    title: "夏祭りで花火を楽しむ人がたくさんいた",
    titleWithRuby:
      "<ruby>夏祭<rt>なつまつ</rt></ruby>りで<ruby>花火<rt>はなび</rt></ruby>を<ruby>楽<rt>たの</rt></ruby>しむ<ruby>人<rt>ひと</rt></ruby>がたくさんいた",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1554797589-7241bb691973?w=640&h=360&fit=crop",
    difficulty: "N4",
    url: `${NHK_EASY_BASE}/nhk-seed-008/nhk-seed-008.html`,
  },
];

/** Per-article vocabulary for richer detail views */
const SEED_VOCAB_MAP: Record<string, NhkVocabItem[]> = {
  "nhk-seed-001": [
    { word: "外国人", reading: "がいこくじん", meaning: "người nước ngoài / foreigner", pos: "名詞" },
    { word: "増える", reading: "ふえる", meaning: "tăng lên / to increase", pos: "動詞" },
    { word: "会社", reading: "かいしゃ", meaning: "công ty / company", pos: "名詞" },
    { word: "働く", reading: "はたらく", meaning: "làm việc / to work", pos: "動詞" },
    { word: "技術", reading: "ぎじゅつ", meaning: "kỹ thuật / technology", pos: "名詞" },
  ],
  "nhk-seed-002": [
    { word: "電車", reading: "でんしゃ", meaning: "tàu điện / train", pos: "名詞" },
    { word: "新しい", reading: "あたらしい", meaning: "mới / new", pos: "形容詞" },
    { word: "便利", reading: "べんり", meaning: "tiện lợi / convenient", pos: "形容動詞" },
    { word: "乗客", reading: "じょうきゃく", meaning: "hành khách / passenger", pos: "名詞" },
  ],
  "nhk-seed-003": [
    { word: "地震", reading: "じしん", meaning: "động đất / earthquake", pos: "名詞" },
    { word: "避難", reading: "ひなん", meaning: "lánh nạn / evacuation", pos: "名詞" },
    { word: "注意", reading: "ちゅうい", meaning: "chú ý / caution", pos: "名詞" },
    { word: "安全", reading: "あんぜん", meaning: "an toàn / safety", pos: "形容動詞" },
    { word: "準備", reading: "じゅんび", meaning: "chuẩn bị / preparation", pos: "名詞" },
  ],
  "nhk-seed-004": [
    { word: "薬", reading: "くすり", meaning: "thuốc / medicine", pos: "名詞" },
    { word: "病気", reading: "びょうき", meaning: "bệnh / illness", pos: "名詞" },
    { word: "助ける", reading: "たすける", meaning: "giúp đỡ / to help", pos: "動詞" },
    { word: "研究", reading: "けんきゅう", meaning: "nghiên cứu / research", pos: "名詞" },
  ],
  "nhk-seed-005": [
    { word: "書き方", reading: "かきかた", meaning: "cách viết / how to write", pos: "名詞" },
    { word: "敬語", reading: "けいご", meaning: "kính ngữ / honorific language", pos: "名詞" },
    { word: "丁寧", reading: "ていねい", meaning: "lịch sự / polite", pos: "形容動詞" },
    { word: "件名", reading: "けんめい", meaning: "tiêu đề / subject line", pos: "名詞" },
    { word: "添付", reading: "てんぷ", meaning: "đính kèm / attachment", pos: "名詞" },
  ],
  "nhk-seed-006": [
    { word: "桜", reading: "さくら", meaning: "hoa anh đào / cherry blossom", pos: "名詞" },
    { word: "季節", reading: "きせつ", meaning: "mùa / season", pos: "名詞" },
    { word: "観光客", reading: "かんこうきゃく", meaning: "khách du lịch / tourist", pos: "名詞" },
    { word: "花見", reading: "はなみ", meaning: "ngắm hoa / flower viewing", pos: "名詞" },
  ],
  "nhk-seed-007": [
    { word: "学校", reading: "がっこう", meaning: "trường học / school", pos: "名詞" },
    { word: "英語", reading: "えいご", meaning: "tiếng Anh / English", pos: "名詞" },
    { word: "授業", reading: "じゅぎょう", meaning: "bài giảng / class", pos: "名詞" },
    { word: "変わる", reading: "かわる", meaning: "thay đổi / to change", pos: "動詞" },
  ],
  "nhk-seed-008": [
    { word: "夏祭り", reading: "なつまつり", meaning: "lễ hội mùa hè / summer festival", pos: "名詞" },
    { word: "花火", reading: "はなび", meaning: "pháo hoa / fireworks", pos: "名詞" },
    { word: "楽しむ", reading: "たのしむ", meaning: "thưởng thức / to enjoy", pos: "動詞" },
    { word: "屋台", reading: "やたい", meaning: "quầy hàng / food stall", pos: "名詞" },
  ],
};

const SEED_BODY_MAP: Record<string, { html: string; plain: string }> = {
  "nhk-seed-001": {
    html: "<p>日本の会社で働く外国人が増えています。政府の調べでは、去年は200万人以上の外国人が日本の会社で働いていました。</p><p>IT(アイティー)の技術がある人や、工場で働く人が多いです。日本語がよくできる人はもっと仕事を見つけやすいです。</p><p>会社の人は「外国人の力が必要です。日本語の勉強を手伝いたいです」と話しました。</p>",
    plain: "日本の会社で働く外国人が増えています。政府の調べでは、去年は200万人以上の外国人が日本の会社で働いていました。ITの技術がある人や、工場で働く人が多いです。日本語がよくできる人はもっと仕事を見つけやすいです。会社の人は「外国人の力が必要です。日本語の勉強を手伝いたいです」と話しました。",
  },
  "nhk-seed-002": {
    html: "<p>東京のJR(ジェイアール)は新しい電車を走らせます。この電車は静かで、電気をあまり使いません。</p><p>中にはWi-Fi(ワイファイ)があって、充電もできます。座るところも広くなりました。</p><p>来年の春から山手線で使う予定です。乗客は「便利になってうれしい」と言いました。</p>",
    plain: "東京のJRは新しい電車を走らせます。この電車は静かで、電気をあまり使いません。中にはWi-Fiがあって、充電もできます。座るところも広くなりました。来年の春から山手線で使う予定です。乗客は「便利になってうれしい」と言いました。",
  },
  "nhk-seed-003": {
    html: "<p>日本では地震がよく起きます。地震が起きたとき、安全に過ごすために大切なことを紹介します。</p><p>まず、テーブルの下に入って頭を守ります。外にいるときは建物から離れます。</p><p>家には水や食べ物を3日分準備しておきましょう。避難場所も確認しておくと安心です。</p>",
    plain: "日本では地震がよく起きます。地震が起きたとき、安全に過ごすために大切なことを紹介します。まず、テーブルの下に入って頭を守ります。外にいるときは建物から離れます。家には水や食べ物を3日分準備しておきましょう。避難場所も確認しておくと安心です。",
  },
  "nhk-seed-004": {
    html: "<p>日本の研究者が新しい薬を作りました。この薬はがんの治療に使えます。</p><p>今までの薬より副作用が少ないそうです。まだ研究中ですが、来年から病院で使えるかもしれません。</p><p>研究者は「病気で苦しむ人を一人でも多く助けたい」と話しています。</p>",
    plain: "日本の研究者が新しい薬を作りました。この薬はがんの治療に使えます。今までの薬より副作用が少ないそうです。まだ研究中ですが、来年から病院で使えるかもしれません。研究者は「病気で苦しむ人を一人でも多く助けたい」と話しています。",
  },
  "nhk-seed-005": {
    html: "<p>日本の会社で働くとき、ビジネスメールの書き方はとても大切です。</p><p>メールの始めには「お疲れ様です」や「お世話になっております」と書きます。件名は短くてわかりやすく書きましょう。</p><p>ファイルを送るときは「添付いたします」と丁寧に書きます。最後に「よろしくお願いいたします」で終わります。</p>",
    plain: "日本の会社で働くとき、ビジネスメールの書き方はとても大切です。メールの始めには「お疲れ様です」や「お世話になっております」と書きます。件名は短くてわかりやすく書きましょう。ファイルを送るときは「添付いたします」と丁寧に書きます。最後に「よろしくお願いいたします」で終わります。",
  },
  "nhk-seed-006": {
    html: "<p>春になると日本では桜が咲きます。桜の季節には世界中から観光客がたくさん来ます。</p><p>去年は約3000万人の外国人が日本に来ました。多くの人が花見を楽しみました。</p><p>東京の上野公園や京都の嵐山は特に人気があります。「日本の桜はとても美しい」と外国人の観光客は言います。</p>",
    plain: "春になると日本では桜が咲きます。桜の季節には世界中から観光客がたくさん来ます。去年は約3000万人の外国人が日本に来ました。多くの人が花見を楽しみました。東京の上野公園や京都の嵐山は特に人気があります。「日本の桜はとても美しい」と外国人の観光客は言います。",
  },
  "nhk-seed-007": {
    html: "<p>日本の学校で英語の授業が変わります。小学校3年生から英語を勉強するようになりました。</p><p>新しい授業では、先生と英語で話す時間が増えます。テストの方法も変わって、話す力も見るようになります。</p><p>先生は「子供たちが英語を楽しいと思ってほしい」と話しています。</p>",
    plain: "日本の学校で英語の授業が変わります。小学校3年生から英語を勉強するようになりました。新しい授業では、先生と英語で話す時間が増えます。テストの方法も変わって、話す力も見るようになります。先生は「子供たちが英語を楽しいと思ってほしい」と話しています。",
  },
  "nhk-seed-008": {
    html: "<p>夏になると日本の町で夏祭りがあります。祭りでは大きな花火を見ることができます。</p><p>先月の祭りには10万人以上の人が来ました。浴衣を着て花火を見る人がたくさんいました。</p><p>屋台にはやきそばやかき氷がありました。子供たちは「花火がきれいでうれしかった」と言いました。</p>",
    plain: "夏になると日本の町で夏祭りがあります。祭りでは大きな花火を見ることができます。先月の祭りには10万人以上の人が来ました。浴衣を着て花火を見る人がたくさんいました。屋台にはやきそばやかき氷がありました。子供たちは「花火がきれいでうれしかった」と言いました。",
  },
};

@Injectable()
export class NhkNewsRepository {
  private _prisma: ReturnType<typeof createPrismaClient> | null = null;
  private get prisma() {
    if (!this._prisma) this._prisma = createPrismaClient();
    return this._prisma;
  }

  /** List recent NHK Easy News articles */
  async listArticles(limit = 10): Promise<NhkArticleSummary[]> {
    // TODO: When nhk_news_cache table exists, query it first
    // For now return seed data for development
    return SEED_ARTICLES.slice(0, limit);
  }

  /** Get article detail with vocabulary */
  async getArticleDetail(articleId: string): Promise<NhkArticleDetail | null> {
    // TODO: When nhk_news_cache table exists, query it first

    const seed = SEED_ARTICLES.find((a) => a.id === articleId);
    if (!seed) return null;

    const body = SEED_BODY_MAP[articleId];
    const vocab = SEED_VOCAB_MAP[articleId] ?? [];

    return {
      ...seed,
      bodyHtml: body?.html ?? `<p>${seed.title}について、やさしい日本語で説明します。</p>`,
      bodyPlain: body?.plain ?? seed.title,
      vocabulary: vocab,
    };
  }

  /** Create a flashcard from NHK article vocabulary */
  async createFlashcardFromArticle(
    userId: string,
    articleId: string,
    word: string,
    reading: string | null,
    meaning: string | null,
    cardType: "kanji" | "vocabulary" | "grammar"
  ) {
    // Find or create user's NHK News deck
    let deck = await this.prisma.deck.findFirst({
      where: { ownerUserId: userId, titleVi: "NHK News", status: "active" },
    });

    if (!deck) {
      deck = await this.prisma.deck.create({
        data: {
          ownerUserId: userId,
          titleVi: "NHK News",
          titleJa: "NHKニュース",
          descriptionVi: "Flashcard tạo từ bài NHK Easy News",
          descriptionJa: "NHKやさしいニュースから作成したフラッシュカード",
          status: "active",
        },
      });
    }

    const backText = [reading, meaning].filter(Boolean).join(" — ") || word;

    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate by front text in this deck
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
          sourceId: deck.id, // use deck as source reference
        },
      });

      await tx.deckCard.create({
        data: { cardId: card.id, deckId: deck.id, position },
      });

      await tx.userFlashcard.create({
        data: { cardId: card.id, userId },
      });

      // Log analytics event
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
}
