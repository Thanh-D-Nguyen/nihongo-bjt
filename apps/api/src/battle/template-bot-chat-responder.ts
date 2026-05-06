import { Injectable, Logger } from "@nestjs/common";

import { createPrismaClient } from "@nihongo-bjt/database";

import { BotChatResponderPort, type BotChatContext } from "./bot-chat-responder.port.js";

/**
 * Template-based bot chat responder.
 * Pulls vocabulary / grammar tips from DB and mixes with persona-flavored templates.
 * Designed to be replaced by an AI provider (OpenAI / Claude / etc.) later.
 */
@Injectable()
export class TemplateBotChatResponder extends BotChatResponderPort {
  private readonly logger = new Logger(TemplateBotChatResponder.name);
  private readonly prisma = createPrismaClient();

  /** Cached vocabulary tips, refreshed periodically */
  private vocabCache: Array<{ word: string; reading: string; meaning: string }> = [];
  private vocabCacheAt = 0;
  private grammarCache: Array<{ pattern: string; meaning: string }> = [];
  private grammarCacheAt = 0;

  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  async generateResponse(context: BotChatContext): Promise<string | null> {
    const msg = context.userMessage.toLowerCase().trim();

    // Don't respond to very short messages or if bot just spoke recently
    if (msg.length < 2) return null;
    if (this.botJustSpoke(context.recentMessages, context.botKey)) return null;

    // Determine response type based on message content
    const responseType = this.classifyMessage(msg);

    switch (responseType) {
      case "greeting":
        return this.greetingResponse(context);
      case "help":
        return this.helpResponse(context);
      case "vocabulary":
        return this.vocabularyResponse(context);
      case "grammar":
        return this.grammarResponse(context);
      case "encouragement":
        return this.encouragementResponse(context);
      case "question":
        return this.questionResponse(context);
      case "battle":
        return this.battleResponse(context);
      default:
        // ~40% chance to respond to general chat to avoid being too chatty
        if (Math.random() > 0.4) return null;
        return this.generalResponse(context);
    }
  }

  private botJustSpoke(
    recentMessages: BotChatContext["recentMessages"],
    botKey: string
  ): boolean {
    const lastTwo = recentMessages.slice(-2);
    return lastTwo.some((m) => m.userId === `bot:${botKey}` && m.kind === "bot");
  }

  private classifyMessage(msg: string): string {
    const greetings = [
      "hi", "hello", "hey", "こんにちは", "おはよう", "こんばんは",
      "やあ", "よろしく", "はじめまして", "chào", "xin chào"
    ];
    if (greetings.some((g) => msg.includes(g))) return "greeting";

    const helpWords = [
      "help", "giúp", "助けて", "たすけて", "わからない", "教えて",
      "おしえて", "how", "what", "なに", "どう", "cách"
    ];
    if (helpWords.some((w) => msg.includes(w))) return "help";

    const vocabWords = [
      "vocab", "từ vựng", "単語", "たんご", "word", "言葉", "ことば",
      "nghĩa", "meaning", "意味", "いみ"
    ];
    if (vocabWords.some((w) => msg.includes(w))) return "vocabulary";

    const grammarWords = [
      "grammar", "ngữ pháp", "文法", "ぶんぽう", "pattern", "cấu trúc"
    ];
    if (grammarWords.some((w) => msg.includes(w))) return "grammar";

    const battleWords = [
      "battle", "fight", "đấu", "バトル", "対戦", "たいせん",
      "勝負", "しょうぶ", "challenge"
    ];
    if (battleWords.some((w) => msg.includes(w))) return "battle";

    if (msg.includes("?") || msg.includes("？")) return "question";

    const encourageWords = [
      "tired", "mệt", "khó", "difficult", "hard", "むずかしい", "難しい",
      "つまらない", "boring", "chán", "できない", "can't"
    ];
    if (encourageWords.some((w) => msg.includes(w))) return "encouragement";

    return "general";
  }

  private personaPrefix(context: BotChatContext): string {
    // Persona-flavored prefix based on bot style
    const prefixes: Record<string, string[]> = {
      bot_j1: ["⚡ ", "💪 ", "🔥 "],
      bot_j2: ["🌸 ", "✨ ", "🍵 "],
      bot_j3: ["📚 ", "🎯 ", "💡 "],
      bot_j4: ["🏆 ", "⭐ ", "🎌 "]
    };
    const options = prefixes[context.botKey] ?? prefixes["bot_j3"]!;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private greetingResponse(context: BotChatContext): string {
    const greetings: Record<string, string[]> = {
      bot_j1: [
        `こんにちは、${context.userDisplayName}！準備はいい？バトルしよう！`,
        `やあ！今日も一緒に頑張ろう！`,
        `Hello! Ready for a challenge? 💪`
      ],
      bot_j2: [
        `こんにちは～ ${context.userDisplayName}さん！ゆっくり楽しもう🌸`,
        `はーい！今日もよろしくね～`,
        `Chào bạn! Hôm nay học gì nào? ✨`
      ],
      bot_j3: [
        `こんにちは！${context.userDisplayName}さん、一緒に勉強しましょう📚`,
        `よろしく！今日は何を練習する？`,
        `Hi! Let's practice Japanese together 🎯`
      ],
      bot_j4: [
        `よう、${context.userDisplayName}！今日も勝負だ！🏆`,
        `こんにちは！BJTの準備は進んでる？`,
        `Hey! Let's sharpen our BJT skills today ⭐`
      ]
    };
    const options = greetings[context.botKey] ?? greetings["bot_j3"]!;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private helpResponse(context: BotChatContext): string {
    return `${this.personaPrefix(context)}何か困ってる？ここではBJTの練習やバトルができるよ！\n` +
      `• 「単語」って言ったら、おすすめの単語を紹介するよ\n` +
      `• 「文法」で文法パターンを教えるよ\n` +
      `• バトル開始ボタンで対戦できるよ！`;
  }

  private async vocabularyResponse(context: BotChatContext): Promise<string> {
    await this.refreshVocabCache();
    if (this.vocabCache.length === 0) {
      return `${this.personaPrefix(context)}今はデータを準備中... バトルで語彙力を鍛えよう！`;
    }
    const pick = this.vocabCache[Math.floor(Math.random() * this.vocabCache.length)]!;
    return `${this.personaPrefix(context)}今日の単語：\n` +
      `📝 ${pick.word}（${pick.reading}）\n` +
      `意味: ${pick.meaning}\n` +
      `覚えたらバトルで使ってみよう！`;
  }

  private async grammarResponse(context: BotChatContext): Promise<string> {
    await this.refreshGrammarCache();
    if (this.grammarCache.length === 0) {
      return `${this.personaPrefix(context)}文法パターンを準備中... まずはバトルで基礎を固めよう！`;
    }
    const pick = this.grammarCache[Math.floor(Math.random() * this.grammarCache.length)]!;
    return `${this.personaPrefix(context)}文法チップ：\n` +
      `📖 ${pick.pattern}\n` +
      `${pick.meaning}`;
  }

  private encouragementResponse(context: BotChatContext): string {
    const messages: Record<string, string[]> = {
      bot_j1: [
        `大丈夫！少しずつ上達してるよ。一緒に頑張ろう！💪`,
        `難しいときこそ成長のチャンス！もう一回やってみよう！`
      ],
      bot_j2: [
        `ゆっくりでいいよ～ 焦らなくて大丈夫🌸`,
        `休憩も大事だよ。リフレッシュしてからまた来てね！`
      ],
      bot_j3: [
        `毎日少しずつ。それが一番の近道だよ📚`,
        `分からないところを見つけるのも勉強の一部！前進してるよ！`
      ],
      bot_j4: [
        `強い人ほど失敗を経験してる。ここで諦めるな！🏆`,
        `BJTは難しいけど、練習すれば必ず上がる！`
      ]
    };
    const options = messages[context.botKey] ?? messages["bot_j3"]!;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private questionResponse(context: BotChatContext): string {
    return `${this.personaPrefix(context)}いい質問だね！\n` +
      `今はテンプレート回答だけど、もうすぐAIで詳しく答えられるようになるよ！\n` +
      `とりあえずバトルで実践練習してみない？ 🎮`;
  }

  private battleResponse(context: BotChatContext): string {
    const messages: Record<string, string[]> = {
      bot_j1: [
        `バトル？いいね！上のスタートボタンを押して！負けないよ！⚡`,
        `挑戦を受けて立つ！準備はいい？`
      ],
      bot_j2: [
        `バトルかー！一緒に楽しもう～ スタートボタンをどうぞ🌸`,
        `のんびりバトルしよ！間違えても大丈夫だよ～`
      ],
      bot_j3: [
        `よし、バトルしよう！上の「開始」ボタンで始められるよ📚`,
        `Practice makes perfect! Let's battle! 🎯`
      ],
      bot_j4: [
        `かかってこい！🏆 上のスタートボタンで勝負だ！`,
        `今日こそ全問正解を目指そう！`
      ]
    };
    const options = messages[context.botKey] ?? messages["bot_j3"]!;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private generalResponse(context: BotChatContext): string {
    const messages: Record<string, string[]> = {
      bot_j1: [
        `なるほど！バトルで実力を見せて！⚡`,
        `面白いね！日本語の練習、続けよう！`,
        `ふむふむ。ところでBJTの勉強は進んでる？`
      ],
      bot_j2: [
        `そうなんだ～ 🌸`,
        `ふふ、楽しいね！一緒に学ぼう～`,
        `いい感じ！のんびり頑張ろうね`
      ],
      bot_j3: [
        `うん！日本語の学習、一緒に頑張ろう📚`,
        `いいね！バトルやボキャブラリーも試してみて`,
        `なるほど。何か質問があったら聞いてね！`
      ],
      bot_j4: [
        `おう！いつでもバトルに挑戦できるぞ🏆`,
        `そうか！BJTで高得点を目指そう！`,
        `ところで、「単語」って打ったら単語を紹介するよ`
      ]
    };
    const options = messages[context.botKey] ?? messages["bot_j3"]!;
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private async refreshVocabCache() {
    if (Date.now() - this.vocabCacheAt < this.CACHE_TTL_MS && this.vocabCache.length > 0) return;
    try {
      const rows = await this.prisma.lexeme.findMany({
        select: { headword: true, reading: true, senses: { select: { meaningVi: true }, take: 1 } },
        take: 100,
        where: { jlptLevel: { not: null } },
        orderBy: { updatedAt: "desc" }
      });
      this.vocabCache = rows
        .filter((r) => r.senses.length > 0)
        .map((r) => ({
          meaning: r.senses[0]!.meaningVi ?? "",
          reading: r.reading ?? r.headword,
          word: r.headword
        }));
      this.vocabCacheAt = Date.now();
    } catch (error) {
      this.logger.warn(`Failed to refresh vocab cache: ${(error as Error).message}`);
    }
  }

  private async refreshGrammarCache() {
    if (Date.now() - this.grammarCacheAt < this.CACHE_TTL_MS && this.grammarCache.length > 0) return;
    try {
      const rows = await this.prisma.grammarPoint.findMany({
        select: { pattern: true, meaningVi: true },
        take: 50,
        where: { status: "active" },
        orderBy: { updatedAt: "desc" }
      });
      this.grammarCache = rows.map((r) => ({
        meaning: r.meaningVi ?? "",
        pattern: r.pattern
      }));
      this.grammarCacheAt = Date.now();
    } catch (error) {
      this.logger.warn(`Failed to refresh grammar cache: ${(error as Error).message}`);
    }
  }
}
