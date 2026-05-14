import { Injectable, Logger } from "@nestjs/common";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type AutofillFormType =
  | "battle-bot"
  | "battle-config"
  | "mock-exam"
  | "quiz-template"
  | "remediation"
  | "question-bank"
  | "growth-social"
  | "growth-postcard"
  | "daily-hub"
  | "daily-radar-module"
  | "daily-radar-card";

export type AutofillMode = "template" | "ai";

export interface AutofillRequest {
  formType: AutofillFormType;
  mode: AutofillMode;
  locale: string;
  context?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slug(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

const JP_NAMES = [
  "田中先生", "鈴木太郎", "山本花子", "佐藤一郎", "渡辺美咲",
  "高橋健太", "伊藤由美", "中村直樹", "小林真理", "加藤雄介",
  "松本さくら", "吉田誠", "山口愛", "斎藤翔", "木村七海",
];

const JP_PERSONAS = [
  "ビジネスの基本を丁寧に教えるタイプ。敬語の使い方に厳しいが、間違えても優しくフォロー。",
  "テンポが速く、瞬時の判断力を鍛える。時間を意識したトレーニングが得意。",
  "関西弁まじりで親しみやすい。ビジネスメールの書き方にこだわりがある。",
  "論理的で冷静。データや数字を使った報告・プレゼンが専門分野。",
  "明るくエネルギッシュ。商談や顧客対応のロールプレイが得意。",
  "ベテラン社員風。報連相（ほうれんそう）の重要性を常に説く。",
  "新入社員研修のプロ。名刺交換から会議マナーまで基礎を徹底。",
  "IT業界出身。カタカナ語やIT用語を交えたビジネス日本語が専門。",
];

const BJT_TOPICS = [
  "ビジネスメール", "電話応対", "会議進行", "プレゼン", "報連相",
  "名刺交換", "敬語", "商談", "顧客対応", "社内報告", "面接対策",
  "クレーム処理", "出張手配", "スケジュール調整", "議事録作成",
];

const SCENARIO_TEMPLATES = [
  "あなたは{company}の{role}です。{situation}について{task}してください。",
  "{role}として{situation}。{person}に{task}するメールを作成してください。",
  "{company}の会議で{situation}。{task}について意見を述べてください。",
];

const COMPANIES = ["東京テック株式会社", "グローバル商事", "さくら電機", "日本フード", "アジアトレード"];
const ROLES = ["営業部の主任", "人事部の新入社員", "IT部門のリーダー", "経理課の担当者", "マーケティング部長"];
const SITUATIONS = [
  "納期が遅れている", "新商品の発売", "部門の予算を見直す", "取引先から苦情があった",
  "新しいプロジェクトが始まる", "年度末の報告書を作成する",
];
const TASKS = ["報告", "確認", "提案", "質問", "回答", "依頼"];

/* ------------------------------------------------------------------ */
/*  Template registry                                                 */
/* ------------------------------------------------------------------ */

type TemplateGenerator = () => Record<string, unknown>;

const TEMPLATES: Record<AutofillFormType, TemplateGenerator[]> = {
  "battle-bot": [
    () => {
      const name = pick(JP_NAMES);
      const key = slug([name.slice(0, 2), String(randInt(1, 999))]);
      return {
        botKey: `bot-${key}`,
        name,
        difficulty: pick(["easy", "medium", "hard"]),
        persona: pick(JP_PERSONAS),
        accuracyPct: randInt(40, 95),
        minDelayMs: randInt(500, 2000),
        maxDelayMs: randInt(3000, 8000),
        avatarFallback: name.slice(0, 2),
        styleToken: pick(["calm", "focused", "sharp"]),
        vocabularyLevel: pick(["jlpt_n5", "jlpt_n4", "jlpt_n3", "jlpt_n2", "jlpt_n1", "bjt_basic", "bjt_intermediate", "bjt_advanced"]),
        riveSrc: "",
        riveArtboard: "BotAvatar",
        riveStateMachine: "StateMachine",
        riveLicense: "CC-BY-4.0",
        riveProvenanceJson: JSON.stringify({ source: "template-autofill", date: new Date().toISOString().slice(0, 10) }),
      };
    },
  ],

  "battle-config": [
    () => {
      const topic = pick(BJT_TOPICS);
      const level = pick(["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1"]);
      return {
        name: `${topic} バトル (${level})`,
        description: `${level}レベル対象。${topic}をテーマにしたリアルタイム対戦。`,
        level,
        gameType: "ranked",
        questionPoolKey: slug([topic, level]),
        questionCount: randInt(5, 20),
        timePerQuestionSec: pick([15, 20, 30, 45, 60]),
        maxParticipants: pick([2, 4, 6, 8]),
        botDifficulties: ["easy", "medium"],
        correctPoints: String(randInt(8, 15)),
        wrongPenalty: String(randInt(0, 5)),
        speedBonusPerSec: String(pick([0.5, 1, 1.5, 2])),
        streakMultiplier: String(pick([1.2, 1.5, 2])),
        scheduleStart: "",
        scheduleEnd: "",
      };
    },
  ],

  "mock-exam": [
    () => {
      const level = pick(["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1"]);
      const slug_val = `mock-${level.toLowerCase()}-${randInt(100, 999)}`;
      return {
        slug: slug_val,
        titleVi: `Đề thi thử BJT ${level} - Bộ ${randInt(1, 20)}`,
        titleJa: `BJT${level}模擬試験 第${randInt(1, 20)}回`,
        descriptionVi: `Đề thi thử ${level} gồm các phần nghe hiểu, đọc hiểu và ngữ pháp kinh doanh.`,
        type: "mock",
        level,
        timeLimitSeconds: pick([3600, 5400, 7200]),
        sections: [
          { code: "listening", label: "Nghe hiểu", durationMin: pick([20, 30, 40]), questionCount: pick([15, 20, 25]) },
          { code: "reading", label: "Đọc hiểu", durationMin: pick([30, 40, 50]), questionCount: pick([20, 25, 30]) },
          { code: "grammar", label: "Ngữ pháp", durationMin: pick([15, 20, 25]), questionCount: pick([10, 15, 20]) },
        ],
      };
    },
  ],

  "quiz-template": [
    () => {
      const topic = pick(BJT_TOPICS);
      const level = pick(["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1"]);
      return {
        slug: slug([topic, level, String(randInt(1, 999))]),
        titleVi: `Bài kiểm tra: ${topic} (${level})`,
        titleJa: `テスト: ${topic} (${level})`,
        description: `${level}レベルの${topic}に関する練習テスト。`,
        level,
        type: pick(["practice", "drill", "challenge"]),
        questionCount: pick([5, 10, 15, 20]),
        timeLimitSec: pick([300, 600, 900, 1200]),
        sectionCoverage: [pick(["listening", "reading", "grammar"])],
        difficultyMix: [
          { difficulty: "easy", weight: 0.3 },
          { difficulty: "standard", weight: 0.5 },
          { difficulty: "hard", weight: 0.2 },
        ],
        topicMix: [{ topic, weight: 1 }],
      };
    },
  ],

  "remediation": [
    () => {
      const topic = pick(BJT_TOPICS);
      const skillTag = slug([topic]);
      const level = pick(["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1"]);
      return {
        name: `${topic} 弱点補強 (${level})`,
        description: `${level}レベルで${topic}が苦手な学習者向けの補強ルール。`,
        topicSkillTag: skillTag,
        level,
        thresholdFailedCount: randInt(2, 5),
        thresholdWindowQuestions: randInt(5, 20),
        recommendedContentType: pick(["lesson", "flashcard", "quiz"]),
        recommendedContentId: "",
      };
    },
  ],

  "question-bank": [
    () => {
      const topic = pick(BJT_TOPICS);
      const scenario = pick(SCENARIO_TEMPLATES)
        .replace("{company}", pick(COMPANIES))
        .replace("{role}", pick(ROLES))
        .replace("{situation}", pick(SITUATIONS))
        .replace("{task}", pick(TASKS))
        .replace("{person}", "上司");
      const correctIdx = randInt(0, 3);
      const optionTexts = [
        "はい、承知いたしました。すぐに対応いたします。",
        "申し訳ございません。確認して改めてご連絡いたします。",
        "ご指摘ありがとうございます。至急確認させていただきます。",
        "大変恐れ入りますが、少々お時間をいただけますでしょうか。",
      ];
      return {
        sectionId: "",
        prompt: `次の場面で最も適切な返答はどれですか。\n\n${scenario}`,
        scenario,
        explanationVi: `Đáp án đúng là phương án ${correctIdx + 1}. Trong tình huống kinh doanh này, cách phản hồi lịch sự và chuyên nghiệp là phù hợp nhất.`,
        skillTag: slug([topic]),
        difficulty: pick(["easy", "standard", "hard"]),
        tags: [topic, "BJT", pick(["敬語", "メール", "会議", "電話"])].join(", "),
        imageUrl: "",
        imageAlt: "",
        audioUrl: "",
        audioScript: "",
        options: ["A", "B", "C", "D"].map((key, i) => ({
          optionKey: key,
          text: optionTexts[i],
          isCorrect: i === correctIdx,
        })),
      };
    },
  ],

  "growth-social": [
    () => {
      const kinds = ["social_link", "share_card", "invite_friend"];
      const kind = pick(kinds);
      return {
        slug: slug(["social", kind, String(randInt(100, 999))]),
        kind,
        name: `Share Template - ${kind.replace(/_/g, " ")}`,
        description: "Template for social sharing of learning achievements.",
        bodyTemplate: `🎉 {{user_name}} đã đạt streak {{streak_count}} ngày học liên tiếp trên NihonGo BJT!`,
        privacyClass: "anonymized",
        noPiiVerified: true,
      };
    },
  ],

  "growth-postcard": [
    () => {
      const kinds = ["streak", "level_up", "battle_win", "quiz_perfect"];
      const kind = pick(kinds);
      return {
        slug: slug(["postcard", kind, String(randInt(100, 999))]),
        kind,
        name: `Postcard - ${kind.replace(/_/g, " ")}`,
        description: `Achievement postcard template for ${kind.replace(/_/g, " ")} events.`,
        bodyTemplate: `おめでとうございます！ {{achievement_text}}`,
        variables: "user_name, achievement_text, date",
        thumbnailKey: "",
        privacyClass: "anonymized",
        noPiiVerified: true,
      };
    },
  ],

  "daily-hub": [
    () => {
      const topic = pick(BJT_TOPICS);
      const widgetKinds = ["life_situation", "phrase", "grammar", "kanji", "listening", "news_clip", "culture_note"];
      const kind = pick(widgetKinds);
      const today = new Date();
      today.setDate(today.getDate() + randInt(0, 14));
      const dateStr = today.toISOString().slice(0, 10);

      const jaTexts: Record<string, { jp: string; reading: string; explanation: string }> = {
        life_situation: {
          jp: `${pick(COMPANIES)}での${topic}の場面。${pick(ROLES)}が${pick(SITUATIONS)}について対応する。`,
          reading: `${pick(COMPANIES)}での${topic}のばめん。`,
          explanation: `Tình huống ${topic} trong môi trường doanh nghiệp Nhật Bản. Học cách xử lý chuyên nghiệp.`,
        },
        phrase: {
          jp: pick(["お疲れ様です。本日の件についてご報告いたします。", "ご確認いただけますでしょうか。", "大変恐れ入りますが、少々お待ちいただけますか。", "ご多忙のところ恐縮ですが、ご検討いただけますと幸いです。", "先日はお忙しい中お時間いただき、ありがとうございました。"]),
          reading: pick(["おつかれさまです。ほんじつのけんについてごほうこくいたします。", "ごかくにんいただけますでしょうか。", "たいへんおそれいりますが、しょうしょうおまちいただけますか。"]),
          explanation: "Cụm từ thường dùng trong email và giao tiếp kinh doanh Nhật Bản.",
        },
        grammar: {
          jp: "〜させていただきます（使役＋受身＋丁寧）— ビジネスシーンで頻出の謙譲表現。",
          reading: "〜させていただきます",
          explanation: "Mẫu ngữ pháp kính ngữ bậc cao, thường dùng khi xin phép hoặc thông báo lịch sự trong kinh doanh.",
        },
        kanji: {
          jp: pick(["報告（ほうこく）", "確認（かくにん）", "承認（しょうにん）", "提案（ていあん）", "決裁（けっさい）"]),
          reading: pick(["ほうこく", "かくにん", "しょうにん", "ていあん", "けっさい"]),
          explanation: "Hán tự kinh doanh quan trọng cho kỳ thi BJT.",
        },
      };

      const content = jaTexts[kind] ?? jaTexts["phrase"]!;

      return {
        contentDate: dateStr,
        locale: pick(["vi", "ja", "en"]),
        widgetKind: kind,
        title: `${topic} — ${kind.replace(/_/g, " ")} (${dateStr})`,
        bodyMd: `## ${topic}\n\n${content.jp}\n\n**Giải thích:** ${content.explanation}`,
        japaneseText: content.jp,
        readingText: content.reading,
        explanationText: content.explanation,
        imageUrl: "",
        sourceProvider: pick(["admin_seed", "nhk_news", "manual", "ai_generated"]),
        sourceRef: `autofill-${dateStr}-${randInt(100, 999)}`,
      };
    },
  ],

  "daily-radar-module": [
    () => {
      const categories = ["work", "life", "news", "money", "entertainment", "procedure", "safety", "family", "study"];
      const cat = pick(categories);
      const moduleTypes = ["content", "quiz", "flashcard", "listening", "reading"];
      const mType = pick(moduleTypes);
      const themes = ["green_life", "blue_work", "orange_news", "purple_study", "red_safety", "pink_family"];
      const catLabels: Record<string, string> = {
        work: "Công việc", life: "Cuộc sống", news: "Tin tức",
        money: "Tài chính", entertainment: "Giải trí", procedure: "Thủ tục",
        safety: "An toàn", family: "Gia đình", study: "Học tập",
      };
      const key = slug([cat, mType, String(randInt(100, 999))]);
      return {
        moduleKey: key,
        titleVi: `${catLabels[cat] ?? cat} - ${mType} module`,
        titleJa: `${pick(BJT_TOPICS)}モジュール`,
        descriptionVi: `Module ${mType} về chủ đề ${catLabels[cat]?.toLowerCase() ?? cat} trong cuộc sống tại Nhật.`,
        category: cat,
        moduleType: mType,
        visualTheme: pick(themes),
        routePath: `/daily-radar/${key}`,
        defaultPriority: randInt(0, 10),
        status: "draft",
        isEnabled: true,
        isSpotlightEligible: Math.random() > 0.7,
      };
    },
  ],

  "daily-radar-card": [
    () => {
      const categories = ["work", "life", "news", "money", "entertainment", "procedure", "safety", "family", "study"];
      const cat = pick(categories);
      const mType = pick(["content", "quiz", "flashcard", "listening", "reading"]);
      const themes = ["green_life", "blue_work", "orange_news", "purple_study", "red_safety", "pink_family"];
      const topic = pick(BJT_TOPICS);
      const catLabels: Record<string, string> = {
        work: "Công việc", life: "Cuộc sống", news: "Tin tức",
        money: "Tài chính", entertainment: "Giải trí", procedure: "Thủ tục",
        safety: "An toàn", family: "Gia đình", study: "Học tập",
      };
      const s = slug([cat, topic, String(randInt(100, 999))]);
      return {
        slug: s,
        titleVi: `${topic} — ${catLabels[cat] ?? cat}`,
        descriptionVi: `Bài học về ${topic} trong bối cảnh ${catLabels[cat]?.toLowerCase() ?? cat} tại Nhật Bản.`,
        badgeTextVi: pick(["Mới", "Hot", "BJT", "N2", "N3", null]),
        category: cat,
        moduleType: mType,
        ctaLabelVi: pick(["Xem ngay", "Bắt đầu", "Ôn tập", "Luyện tập"]),
        targetRoute: `/daily-radar/${s}`,
        levelLabel: pick(["N5", "N4", "N3", "N2", "N1", "BJT-J5", "BJT-J3", null]),
        estimatedMinutes: pick([3, 5, 10, 15, 20]),
        priority: randInt(0, 10),
        status: "draft",
        visualTheme: pick(themes),
        recommendationReasonVi: pick(["Phù hợp với trình độ của bạn", "Chủ đề phổ biến tuần này", "Cần ôn tập thêm", null]),
        isSpotlight: Math.random() > 0.8,
        isPinned: Math.random() > 0.85,
      };
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  AI provider interface + local mock                                */
/* ------------------------------------------------------------------ */

export interface AiAutofillProvider {
  generate(formType: AutofillFormType, locale: string, context?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

class LocalMockAiProvider implements AiAutofillProvider {
  async generate(formType: AutofillFormType): Promise<Record<string, unknown>> {
    // In dev mode, AI just returns template data with a marker
    const generators = TEMPLATES[formType];
    const result = generators[Math.floor(Math.random() * generators.length)]!();
    return { ...result, _aiGenerated: true, _provider: "local-mock" };
  }
}

/* ------------------------------------------------------------------ */
/*  Service                                                           */
/* ------------------------------------------------------------------ */

@Injectable()
export class AutofillService {
  private readonly logger = new Logger(AutofillService.name);
  private readonly aiProvider: AiAutofillProvider;

  constructor() {
    // TODO: Replace with real AI provider when API keys are configured
    this.aiProvider = new LocalMockAiProvider();
  }

  async generate(req: AutofillRequest): Promise<Record<string, unknown>> {
    const { formType, mode, locale, context } = req;

    if (mode === "ai") {
      this.logger.log(`AI autofill requested for ${formType} (locale=${locale})`);
      return this.aiProvider.generate(formType, locale, context);
    }

    // Template mode
    const generators = TEMPLATES[formType];
    if (!generators || generators.length === 0) {
      return {};
    }
    const generator = generators[Math.floor(Math.random() * generators.length)]!;
    return generator();
  }
}
