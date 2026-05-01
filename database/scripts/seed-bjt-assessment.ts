/**
 * BJT Assessment + Battle Seed Script — production baseline data
 *
 * Creates original BJT-style items with:
 * - 1 mock exam per level (BJT-J5 through BJT-J1+) = 6 mock exams
 * - 9 sections per exam (LC_SCENE..RC_INTEGRATED)
 * - 2-3 questions per section = ~18-27 questions per exam
 * - 4 options per question, exactly 1 correct
 * - Vietnamese explanation, Japanese prompt/options
 * - Battle configs and managed bot personas for admin/runtime readiness
 * - Provenance: nihongo-bjt-original-seed-v1, license: original-internal-production-seed
 *
 * All content is ORIGINAL — no official BJT sample text is copied.
 *
 * Idempotent: upserts exams/sections/questions/options and battle managed data.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-bjt-assessment.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../packages/config/src/index.js";
import { createPrismaClient, Prisma } from "../../packages/database/src/index.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const seedActorId =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

const SEED_PROVENANCE = "nihongo-bjt-original-seed-v1";
const SEED_LICENSE = "original-internal-production-seed";

/* ------------------------------------------------------------------ */
/* BJT Structure Constants                                            */
/* ------------------------------------------------------------------ */

const BJT_LEVELS = ["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1", "BJT-J1+"] as const;

interface SectionDef {
  code: string;
  titleVi: string;
  titleJa: string;
  type: string;
  timeLimitSec: number;
  questionCount: number;
}

const SECTIONS: SectionDef[] = [
  {
    code: "LC_SCENE",
    titleVi: "Nghe – Cảnh huống",
    titleJa: "聴解 – 場面把握",
    type: "listening",
    timeLimitSec: 300,
    questionCount: 3
  },
  {
    code: "LC_STATEMENT",
    titleVi: "Nghe – Phát ngôn",
    titleJa: "聴解 – 発話表現",
    type: "listening",
    timeLimitSec: 300,
    questionCount: 3
  },
  {
    code: "LC_INTEGRATED",
    titleVi: "Nghe – Tổng hợp",
    titleJa: "聴解 – 総合聴解",
    type: "listening",
    timeLimitSec: 300,
    questionCount: 2
  },
  {
    code: "LR_SITUATION",
    titleVi: "Nghe-Đọc – Tình huống",
    titleJa: "聴読解 – 状況把握",
    type: "listening_reading",
    timeLimitSec: 300,
    questionCount: 2
  },
  {
    code: "LR_DOCUMENT",
    titleVi: "Nghe-Đọc – Tài liệu",
    titleJa: "聴読解 – 資料聴読解",
    type: "listening_reading",
    timeLimitSec: 300,
    questionCount: 2
  },
  {
    code: "LR_INTEGRATED",
    titleVi: "Nghe-Đọc – Tổng hợp",
    titleJa: "聴読解 – 総合聴読解",
    type: "listening_reading",
    timeLimitSec: 300,
    questionCount: 2
  },
  {
    code: "RC_VOCAB_GRAMMAR",
    titleVi: "Đọc – Từ vựng & Ngữ pháp",
    titleJa: "読解 – 語彙・文法",
    type: "reading",
    timeLimitSec: 300,
    questionCount: 3
  },
  {
    code: "RC_EXPRESSION",
    titleVi: "Đọc – Biểu hiện",
    titleJa: "読解 – 表現読解",
    type: "reading",
    timeLimitSec: 300,
    questionCount: 2
  },
  {
    code: "RC_INTEGRATED",
    titleVi: "Đọc – Tổng hợp",
    titleJa: "読解 – 総合読解",
    type: "reading",
    timeLimitSec: 300,
    questionCount: 2
  }
];

/* ------------------------------------------------------------------ */
/* Business Situations Pool                                           */
/* ------------------------------------------------------------------ */

type BusinessSituation =
  | "meeting"
  | "phone"
  | "presentation"
  | "email_chat"
  | "report_document"
  | "schedule"
  | "internal_coordination"
  | "sales_customer"
  | "hr_interview";

type BattleConfigSeed = {
  botDifficulties: string[];
  description: string;
  level: string;
  maxParticipants: number;
  name: string;
  questionCount: number;
  questionPoolKey: string;
  scoringRules: Prisma.InputJsonObject;
  timePerQuestionSec: number;
};

type BattleBotSeed = {
  accuracyPct: number;
  difficulty: "easy" | "medium" | "hard";
  maxDelayMs: number;
  minDelayMs: number;
  name: string;
  persona: string;
  vocabularyLevel: string;
};

const BATTLE_CONFIGS: BattleConfigSeed[] = [
  {
    botDifficulties: ["easy", "medium"],
    description:
      "Short BJT warmup battle for J5/J4 learners. Uses active original BJT question pool.",
    level: "BJT-J5",
    maxParticipants: 2,
    name: "BJT Warmup Duel J5",
    questionCount: 5,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 100,
      speedBonusPerSec: 2,
      streakMultiplier: 1.1,
      wrongPenalty: 0
    },
    timePerQuestionSec: 45
  },
  {
    botDifficulties: ["easy", "medium"],
    description:
      "Daily office battle focused on basic business exchanges and schedule coordination.",
    level: "BJT-J4",
    maxParticipants: 2,
    name: "Office Situation Duel J4",
    questionCount: 7,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 100,
      speedBonusPerSec: 3,
      streakMultiplier: 1.15,
      wrongPenalty: 0
    },
    timePerQuestionSec: 40
  },
  {
    botDifficulties: ["medium", "hard"],
    description: "Coordination and document-reading sprint for intermediate BJT practice.",
    level: "BJT-J3",
    maxParticipants: 2,
    name: "Coordination Sprint J3",
    questionCount: 10,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 100,
      speedBonusPerSec: 4,
      streakMultiplier: 1.2,
      wrongPenalty: 10
    },
    timePerQuestionSec: 35
  },
  {
    botDifficulties: ["medium", "hard"],
    description: "Higher-pressure meeting, negotiation, and multi-source comprehension battle.",
    level: "BJT-J2",
    maxParticipants: 2,
    name: "Business Decision Duel J2",
    questionCount: 12,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 100,
      speedBonusPerSec: 5,
      streakMultiplier: 1.25,
      wrongPenalty: 15
    },
    timePerQuestionSec: 35
  },
  {
    botDifficulties: ["hard"],
    description: "Advanced executive-reading battle for learners aiming at J1/J1+ readiness.",
    level: "BJT-J1",
    maxParticipants: 2,
    name: "Executive Reading Duel J1",
    questionCount: 15,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 100,
      speedBonusPerSec: 6,
      streakMultiplier: 1.3,
      wrongPenalty: 20
    },
    timePerQuestionSec: 30
  },
  {
    botDifficulties: ["hard"],
    description:
      "Elite integrated-comprehension boss battle for near-native business Japanese control.",
    level: "BJT-J1+",
    maxParticipants: 2,
    name: "Integrated Boss Duel J1+",
    questionCount: 15,
    questionPoolKey: "bjt_questions_active",
    scoringRules: {
      correctPoints: 120,
      speedBonusPerSec: 6,
      streakMultiplier: 1.35,
      wrongPenalty: 25
    },
    timePerQuestionSec: 30
  }
];

const BATTLE_BOTS: BattleBotSeed[] = [
  {
    accuracyPct: 42,
    difficulty: "easy",
    maxDelayMs: 2600,
    minDelayMs: 700,
    name: "Mika J4 Coach",
    persona:
      "Encouraging office-Japanese sparring partner tuned for basic business response practice.",
    vocabularyLevel: "bjt_basic"
  },
  {
    accuracyPct: 58,
    difficulty: "medium",
    maxDelayMs: 2200,
    minDelayMs: 500,
    name: "Sato J3 Rival",
    persona:
      "Balanced rival that pressures learners on coordination, reporting, and polite expressions.",
    vocabularyLevel: "bjt_intermediate"
  },
  {
    accuracyPct: 74,
    difficulty: "hard",
    maxDelayMs: 1800,
    minDelayMs: 350,
    name: "Kuroda J1 Mentor",
    persona:
      "Advanced business mentor for fast decisions across integrated reading and meeting contexts.",
    vocabularyLevel: "bjt_advanced"
  }
];

/* ------------------------------------------------------------------ */
/* Original BJT-style Question Bank                                   */
/* ------------------------------------------------------------------ */

interface SeedQuestion {
  prompt: string;
  scenario: string | null;
  explanationVi: string;
  skillTag: string;
  difficulty: "easy" | "standard" | "hard" | "elite";
  businessSituation: BusinessSituation;
  stimulusKind: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  tags: string[];
}

function getQuestionsForSection(sectionCode: string, level: string): SeedQuestion[] {
  const lvlIdx = BJT_LEVELS.indexOf(level as (typeof BJT_LEVELS)[number]);
  const diff = lvlIdx <= 1 ? "easy" : lvlIdx <= 3 ? "standard" : lvlIdx <= 4 ? "hard" : "elite";

  const pool: Record<string, () => SeedQuestion[]> = {
    LC_SCENE: () => [
      {
        prompt:
          "会議室で上司が「この案件の進捗はどうなっていますか」と聞いています。適切な応答を選んでください。",
        scenario: "社内会議。上司が部下にプロジェクトの進捗を確認している場面。",
        explanationVi:
          "Trong cuộc họp nội bộ, khi cấp trên hỏi về tiến độ dự án, câu trả lời phù hợp nhất là báo cáo tình trạng hiện tại một cách ngắn gọn và rõ ràng.",
        skillTag: "progress_reporting",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "はい、現在80%まで完了しております。来週中に最終報告をまとめる予定です。",
            isCorrect: true
          },
          { key: "B", text: "すみません、ちょっと分かりません。", isCorrect: false },
          { key: "C", text: "その件については、また今度お話しします。", isCorrect: false },
          { key: "D", text: "お疲れさまです。会議は何時に始まりますか。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "business_meeting"]
      },
      {
        prompt:
          "受付で来客が「営業部の田中さんとの打ち合わせで参りました」と言っています。適切な対応を選んでください。",
        scenario: "会社の受付。外部のお客様が来社した場面。",
        explanationVi:
          "Khi khách đến công ty và nói mục đích, nhân viên lễ tân cần xác nhận thông tin và hướng dẫn khách ngồi chờ một cách lịch sự.",
        skillTag: "visitor_reception",
        difficulty: diff,
        businessSituation: "sales_customer",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "田中は今いないので、帰ってください。", isCorrect: false },
          {
            key: "B",
            text: "少々お待ちください。田中に確認いたしますので、こちらにおかけになってお待ちいただけますか。",
            isCorrect: true
          },
          { key: "C", text: "田中さんの電話番号を教えてください。", isCorrect: false },
          { key: "D", text: "すみません、営業部はどこですか。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "reception"]
      },
      {
        prompt:
          "同僚が「来週の出張の交通手段、もう手配しましたか」と聞いています。適切な応答を選んでください。",
        scenario: "オフィスでの日常会話。出張準備について確認している場面。",
        explanationVi:
          "Khi đồng nghiệp hỏi về việc sắp xếp phương tiện di chuyển cho chuyến công tác, câu trả lời nên thể hiện tình trạng chuẩn bị hiện tại.",
        skillTag: "travel_arrangement",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "出張には行きたくないです。", isCorrect: false },
          {
            key: "B",
            text: "はい、新幹線のチケットは予約済みです。ホテルも確保しました。",
            isCorrect: true
          },
          { key: "C", text: "出張って何ですか。", isCorrect: false },
          { key: "D", text: "交通手段は必要ありません。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "business_travel"]
      }
    ],
    LC_STATEMENT: () => [
      {
        prompt:
          "電話で取引先に「納期を一週間延ばしていただけないでしょうか」と依頼する際、最も適切な表現を選んでください。",
        scenario: "取引先との電話。納期の変更を依頼する場面。",
        explanationVi:
          "Khi yêu cầu đối tác gia hạn thời hạn giao hàng qua điện thoại, cần sử dụng kính ngữ và thể hiện sự lịch sự, đồng thời giải thích lý do.",
        skillTag: "deadline_negotiation",
        difficulty: diff,
        businessSituation: "phone",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "納期を延ばせ。", isCorrect: false },
          {
            key: "B",
            text: "大変恐れ入りますが、製造工程の見直しにより、納期を一週間ほど延長させていただけないかとご相談申し上げたく存じます。",
            isCorrect: true
          },
          {
            key: "C",
            text: "納期は変えられませんか。できれば変えてほしいです。",
            isCorrect: false
          },
          { key: "D", text: "一週間遅れますが、問題ないですよね。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "negotiation", "keigo"]
      },
      {
        prompt:
          "上司への報告で「先方から見積もりの修正依頼がありました」と伝える場合、最も適切な表現を選んでください。",
        scenario: "上司への業務報告。見積もり修正の連絡を伝える場面。",
        explanationVi:
          "Khi báo cáo với cấp trên về yêu cầu sửa đổi báo giá từ đối tác, cần truyền đạt chính xác nội dung và đề xuất bước tiếp theo.",
        skillTag: "quotation_reporting",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "ご報告いたします。A社様より見積書の一部修正のご依頼をいただきました。修正箇所を確認の上、本日中に対応させていただきます。",
            isCorrect: true
          },
          { key: "B", text: "見積もりを直してって言われました。", isCorrect: false },
          { key: "C", text: "A社が文句を言っています。", isCorrect: false },
          { key: "D", text: "見積もりの件、よく分かりません。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "reporting", "keigo"]
      },
      {
        prompt: "会議で自分の提案を述べる際、最も適切なビジネス表現を選んでください。",
        scenario: "チーム会議で新しいプロジェクト案を提案する場面。",
        explanationVi:
          "Khi trình bày đề xuất trong cuộc họp, cần sử dụng biểu hiện lịch sự và logic rõ ràng để thuyết phục người nghe.",
        skillTag: "proposal_presentation",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "私の考えを言います。こうしたほうがいい。", isCorrect: false },
          {
            key: "B",
            text: "一つ提案がございます。市場調査の結果を踏まえ、新規顧客層へのアプローチを強化してはいかがでしょうか。",
            isCorrect: true
          },
          { key: "C", text: "別に意見はありません。", isCorrect: false },
          { key: "D", text: "みんなで決めればいいと思います。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "presentation", "proposal"]
      }
    ],
    LC_INTEGRATED: () => [
      {
        prompt:
          "部門間の調整会議で、経理部と営業部の意見が対立しています。司会者の発言として最も適切なものを選んでください。",
        scenario:
          "部門間調整会議。予算配分について意見が分かれている場面。複数の発言者の立場を理解する必要がある。",
        explanationVi:
          "Trong cuộc họp điều phối giữa các phòng ban, khi có ý kiến trái ngược, người chủ trì cần tổng hợp ý kiến và đề xuất hướng giải quyết trung lập.",
        skillTag: "meeting_facilitation",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "双方のご意見を整理させていただきます。まず、共通の目標を確認した上で、具体的な数字を基に調整案を検討してまいりましょう。",
            isCorrect: true
          },
          { key: "B", text: "経理部の意見が正しいと思います。", isCorrect: false },
          { key: "C", text: "この議題は来月に延期しましょう。", isCorrect: false },
          { key: "D", text: "皆さん、落ち着いてください。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "facilitation", "cross_department"]
      },
      {
        prompt:
          "プロジェクトの進捗会議で、開発チームとマーケティングチームがそれぞれ報告しています。最も重要な課題を正しく把握しているのはどれですか。",
        scenario:
          "プロジェクト進捗会議。開発側は技術的遅延を報告し、マーケティング側はローンチ日の変更不可を主張している。",
        explanationVi:
          "Khi hai đội báo cáo tiến độ với các quan điểm khác nhau, cần nắm bắt vấn đề cốt lõi: sự xung đột giữa delay kỹ thuật và deadline marketing.",
        skillTag: "integrated_comprehension",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "開発の遅延とローンチ日程の調整が必要であること。", isCorrect: true },
          { key: "B", text: "マーケティング予算が不足していること。", isCorrect: false },
          { key: "C", text: "開発チームの人員が足りないこと。", isCorrect: false },
          { key: "D", text: "会議の時間が長すぎること。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "project_management"]
      }
    ],
    LR_SITUATION: () => [
      {
        prompt:
          "以下の社内メールと電話メッセージの内容を合わせて、最も適切な対応を選んでください。\n\nメール：「本日15時の会議室Aでの打ち合わせは、会議室Bに変更になりました。」\n電話：「申し訳ありません、会議の開始時間が30分遅れて15時半からになります。」",
        scenario: "社内の会議変更連絡。メールと電話で異なる情報が伝えられている。",
        explanationVi:
          "Khi nhận thông tin thay đổi từ cả email và điện thoại, cần tổng hợp: phòng họp đổi sang B, giờ bắt đầu lùi 30 phút thành 15:30.",
        skillTag: "information_integration",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "email",
        options: [
          { key: "A", text: "15時に会議室Aに行く。", isCorrect: false },
          { key: "B", text: "15時半に会議室Bに行く。", isCorrect: true },
          { key: "C", text: "15時に会議室Bに行く。", isCorrect: false },
          { key: "D", text: "15時半に会議室Aに行く。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "schedule_change"]
      },
      {
        prompt:
          "掲示板のお知らせと部長の口頭指示を合わせて読んでください。\n\n掲示板：「来月より、出張申請は新システム経由で提出してください。」\n部長：「来月からの新システムだが、最初の2週間は旧システムも並行で使えるようにしておく。」",
        scenario: "社内システム変更に関する掲示と上司の補足説明。",
        explanationVi:
          "Khi kết hợp thông tin từ bảng thông báo và chỉ thị miệng, cần hiểu: hệ thống mới bắt đầu tháng sau, nhưng 2 tuần đầu vẫn dùng song song hệ thống cũ.",
        skillTag: "policy_comprehension",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "document",
        options: [
          { key: "A", text: "来月から旧システムは完全に使えなくなる。", isCorrect: false },
          {
            key: "B",
            text: "来月の最初の2週間は、新旧どちらのシステムも使用可能である。",
            isCorrect: true
          },
          { key: "C", text: "新システムの導入は再来月に延期された。", isCorrect: false },
          { key: "D", text: "出張申請は引き続き旧システムのみで行う。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "system_transition"]
      }
    ],
    LR_DOCUMENT: () => [
      {
        prompt:
          "以下の売上グラフと営業部からの説明を読んで、正しい分析を選んでください。\n\nグラフ：第1四半期の売上は前年比15%増、第2四半期は5%減。\n説明：「第2四半期の減少は、主力製品のリニューアル準備期間と重なったためです。」",
        scenario: "四半期売上レポートの分析。グラフデータと営業部の説明を統合する。",
        explanationVi:
          "Khi phân tích biểu đồ doanh thu kết hợp giải thích từ phòng kinh doanh: Q1 tăng 15%, Q2 giảm 5% do trùng với giai đoạn chuẩn bị ra mắt sản phẩm mới.",
        skillTag: "data_analysis",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "chart",
        options: [
          { key: "A", text: "年間を通じて売上は減少傾向にある。", isCorrect: false },
          {
            key: "B",
            text: "第2四半期の減少は主力製品リニューアルの影響であり、一時的と考えられる。",
            isCorrect: true
          },
          { key: "C", text: "営業部の説明とグラフのデータは矛盾している。", isCorrect: false },
          { key: "D", text: "第1四半期も第2四半期も売上は減少した。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "sales_analysis", "chart_reading"]
      },
      {
        prompt:
          "以下の求人広告と人事部の補足説明を読んで、応募条件を正しく理解しているものを選んでください。\n\n求人：「営業職募集。要：ビジネス日本語能力。経験3年以上。」\n人事：「今回は日本語ネイティブでなくても、BJT J2以上あれば書類選考を通します。」",
        scenario: "採用情報。求人広告と人事担当者の補足情報を統合。",
        explanationVi:
          "Kết hợp thông tin tuyển dụng và bổ sung từ phòng nhân sự: yêu cầu 3 năm kinh nghiệm + tiếng Nhật (không cần native, BJT J2 trở lên là đủ qua vòng hồ sơ).",
        skillTag: "recruitment_comprehension",
        difficulty: diff,
        businessSituation: "hr_interview",
        stimulusKind: "document",
        options: [
          { key: "A", text: "日本語ネイティブのみが応募できる。", isCorrect: false },
          { key: "B", text: "経験不問でBJT J2以上があれば応募できる。", isCorrect: false },
          {
            key: "C",
            text: "経験3年以上かつBJT J2以上であれば、日本語ネイティブでなくても書類選考対象になる。",
            isCorrect: true
          },
          { key: "D", text: "BJT J1+のみが応募可能である。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "recruitment", "hr"]
      }
    ],
    LR_INTEGRATED: () => [
      {
        prompt:
          "プロジェクト計画書、チャットログ、週次報告メールの3つの情報源を統合して、現在のプロジェクト状況を最も正確に表しているものを選んでください。\n\n計画書：「フェーズ2は4月15日完了予定」\nチャット：「テスト環境の構築が遅れていて、フェーズ2は4月20日頃になりそう」\nメール：「クライアントには4月22日に中間報告を行います」",
        scenario: "複数の情報源からプロジェクト進捗を判断する場面。",
        explanationVi:
          "Tổng hợp 3 nguồn thông tin: kế hoạch ban đầu (15/4), chat nội bộ (delay đến ~20/4), email (báo cáo khách hàng 22/4). Tình trạng thực tế: phase 2 đang trễ ~5 ngày.",
        skillTag: "multi_source_integration",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "document",
        options: [
          {
            key: "A",
            text: "フェーズ2は予定通り4月15日に完了する見込みである。",
            isCorrect: false
          },
          {
            key: "B",
            text: "フェーズ2は約5日遅延しており、クライアント報告は完了後に設定されている。",
            isCorrect: true
          },
          { key: "C", text: "プロジェクトは中止になった。", isCorrect: false },
          { key: "D", text: "クライアントはプロジェクトの遅延を知らない。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "project_tracking"]
      },
      {
        prompt:
          "新製品発表会の案内状、会場レイアウト図、当日のタイムスケジュールを参照して、正しい情報を選んでください。\n\n案内状：「5月10日14時開始。会場：東京国際フォーラム ホールC」\nレイアウト：「受付はホールC入口左側。プレス席は最前列」\nスケジュール：「13:30開場、14:00開会挨拶、14:20製品デモ、15:00質疑応答」",
        scenario: "新製品発表会に関する複数資料を参照する場面。",
        explanationVi:
          "Kết hợp thư mời, sơ đồ hội trường và lịch trình: lễ tân bên trái, ghế báo chí hàng đầu, 13:30 mở cửa, 14:00 khai mạc, 14:20 demo, 15:00 Q&A.",
        skillTag: "event_planning_comprehension",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "document",
        options: [
          {
            key: "A",
            text: "受付は13時30分から始まり、ホールC入口の左側にある。",
            isCorrect: true
          },
          { key: "B", text: "製品デモは14時から始まる。", isCorrect: false },
          { key: "C", text: "プレス席は最後列に設定されている。", isCorrect: false },
          { key: "D", text: "会場は東京国際フォーラム ホールAである。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "event_coordination"]
      }
    ],
    RC_VOCAB_GRAMMAR: () => [
      {
        prompt:
          "「本プロジェクトの（　　）を踏まえ、次期計画を策定いたします。」空欄に入る最も適切な語を選んでください。",
        scenario: null,
        explanationVi:
          "Từ 成果 (seika - thành quả/kết quả) là phù hợp nhất trong ngữ cảnh kinh doanh khi nói về việc dựa trên kết quả dự án để lập kế hoạch tiếp theo.",
        skillTag: "business_vocabulary",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "text",
        options: [
          { key: "A", text: "成果", isCorrect: true },
          { key: "B", text: "趣味", isCorrect: false },
          { key: "C", text: "天気", isCorrect: false },
          { key: "D", text: "食事", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "vocabulary", "business_japanese"]
      },
      {
        prompt:
          "「弊社（　　）、本件についてご説明させていただきます。」空欄に入る最も適切な表現を選んでください。",
        scenario: null,
        explanationVi:
          "Trong keigo kinh doanh, 'としましては' (toshimashitewa) là cách nói khiêm nhường khi đại diện công ty trình bày quan điểm.",
        skillTag: "keigo_usage",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "text",
        options: [
          { key: "A", text: "としましては", isCorrect: true },
          { key: "B", text: "でいいから", isCorrect: false },
          { key: "C", text: "なんだけど", isCorrect: false },
          { key: "D", text: "だから", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "keigo", "grammar"]
      },
      {
        prompt:
          "「ご多忙のところ恐れ入りますが、ご（　　）のほどよろしくお願い申し上げます。」空欄に入る最も適切な語を選んでください。",
        scenario: null,
        explanationVi:
          "'検討' (kentou - xem xét) là từ phù hợp nhất: 'xin vui lòng xem xét'. Đây là biểu hiện chuẩn trong email/thư kinh doanh.",
        skillTag: "business_correspondence",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "旅行", isCorrect: false },
          { key: "B", text: "検討", isCorrect: true },
          { key: "C", text: "散歩", isCorrect: false },
          { key: "D", text: "休憩", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "email", "vocabulary"]
      }
    ],
    RC_EXPRESSION: () => [
      {
        prompt:
          "ビジネスメールで「ご査収ください」という表現の意味として最も適切なものを選んでください。",
        scenario:
          "取引先からの納品確認メール。添付ファイルとともに「ご査収ください」と記載されている。",
        explanationVi:
          "'ご査収ください' (gosashuu kudasai) có nghĩa là 'xin hãy kiểm tra và nhận'. Đây là biểu hiện thường dùng khi gửi tài liệu/file đính kèm trong email kinh doanh.",
        skillTag: "business_expression",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "内容を確認の上、お受け取りください。", isCorrect: true },
          { key: "B", text: "すぐに返信してください。", isCorrect: false },
          { key: "C", text: "添付ファイルを削除してください。", isCorrect: false },
          { key: "D", text: "内容に問題があれば修正してください。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "email_expression", "keigo"]
      },
      {
        prompt:
          "社内報に「当社は持続可能な経営を目指し、ESG投資の観点から事業戦略を見直してまいります」と書かれています。この文の趣旨を最も正確に表しているものを選んでください。",
        scenario: "社内報の経営方針記事。",
        explanationVi:
          "Bài viết nội bộ nói về việc công ty sẽ xem xét lại chiến lược kinh doanh từ góc độ ESG (Môi trường, Xã hội, Quản trị) để hướng tới kinh doanh bền vững.",
        skillTag: "reading_comprehension",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "text",
        options: [
          {
            key: "A",
            text: "会社は環境・社会・ガバナンスの視点を取り入れた経営戦略に移行する方針である。",
            isCorrect: true
          },
          { key: "B", text: "会社はESG投資をやめる方針である。", isCorrect: false },
          { key: "C", text: "社内報の内容は従業員の個人的意見である。", isCorrect: false },
          { key: "D", text: "会社は短期利益を最優先にする方針を発表した。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "corporate_communication"]
      }
    ],
    RC_INTEGRATED: () => [
      {
        prompt:
          "以下の社内規定と業務フロー図を参照して、新規取引先との契約手続きについて正しいものを選んでください。\n\n規定：「新規取引は、信用調査完了後、部長承認を経て契約締結とする。100万円以上の案件は役員承認も必要。」\n業務フロー：信用調査→部長承認→（100万以上の場合）役員承認→契約書作成→双方署名",
        scenario: "新規取引先との契約プロセスに関する社内規定と業務フロー。",
        explanationVi:
          "Kết hợp nội quy và sơ đồ quy trình: mọi hợp đồng mới cần điều tra tín dụng + duyệt trưởng phòng. Trên 100 vạn yên cần thêm duyệt ban giám đốc.",
        skillTag: "regulation_comprehension",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "document",
        options: [
          { key: "A", text: "すべての新規取引は役員承認が必要である。", isCorrect: false },
          { key: "B", text: "信用調査は契約締結後に行えばよい。", isCorrect: false },
          { key: "C", text: "100万円未満の案件は部長承認のみで契約可能である。", isCorrect: true },
          { key: "D", text: "契約書の作成は信用調査の前に行う。", isCorrect: false }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "contract_process", "regulation"]
      },
      {
        prompt:
          "年次報告書の財務データと社長メッセージを統合して、会社の現状を最も正確に理解しているものを選んでください。\n\n財務データ：売上高12%増、営業利益率8.5%（前年7.2%）、海外売上比率が35%→42%に上昇。\n社長メッセージ：「海外展開の加速により、為替リスクへの対応が今後の重要課題です。」",
        scenario: "年次報告書。財務データと社長メッセージの統合読解。",
        explanationVi:
          "Kết hợp dữ liệu tài chính (doanh thu +12%, lợi nhuận tăng, tỷ lệ doanh thu nước ngoài tăng 35→42%) và thông điệp chủ tịch (mở rộng quốc tế nhanh → rủi ro tỷ giá).",
        skillTag: "financial_comprehension",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "document",
        options: [
          {
            key: "A",
            text: "業績は好調だが、海外展開に伴う為替リスク管理が今後の経営課題である。",
            isCorrect: true
          },
          {
            key: "B",
            text: "会社の業績は悪化しており、海外事業から撤退する予定である。",
            isCorrect: false
          },
          {
            key: "C",
            text: "国内売上のみで成長しており、海外展開は行っていない。",
            isCorrect: false
          },
          {
            key: "D",
            text: "営業利益率が低下しているため、コスト削減が最優先課題である。",
            isCorrect: false
          }
        ],
        tags: ["bjt", sectionCode.toLowerCase(), "annual_report", "financial_analysis"]
      }
    ]
  };

  const fn = pool[sectionCode];
  if (!fn) return [];
  return fn();
}

/* ------------------------------------------------------------------ */
/* Seed Runner                                                        */
/* ------------------------------------------------------------------ */

async function seedAssessment() {
  console.log("BJT Assessment Seed - starting...\n");

  let totalExams = 0;
  let totalSections = 0;
  let totalQuestions = 0;
  let totalOptions = 0;

  for (const level of BJT_LEVELS) {
    const slug = `bjt-production-${level.toLowerCase().replace("+", "plus")}`;
    const titleVi = `Đề luyện BJT chuẩn ${level}`;
    const titleJa = `BJT標準模擬試験 ${level}`;

    const totalTimeSec = SECTIONS.reduce((s, sec) => s + sec.timeLimitSec, 0);

    const exam = await prisma.bjtMockTest.upsert({
      create: {
        slug,
        titleVi,
        titleJa,
        type: "mock",
        status: "published",
        level,
        timeLimitSeconds: totalTimeSec,
        description: `Original NihonGo BJT production baseline content. Level: ${level}. Provenance: ${SEED_PROVENANCE}.`,
        blueprintMeta: {
          sections: SECTIONS.map((s) => ({
            code: s.code,
            titleVi: s.titleVi,
            titleJa: s.titleJa,
            type: s.type,
            questionCount: s.questionCount,
            timeLimitSec: s.timeLimitSec,
            sourcePool: null
          })),
          totalTimeMin: Math.ceil(totalTimeSec / 60),
          scoringRubric: {
            passingScore: 400,
            perCorrectPoints: Math.round(
              800 / SECTIONS.reduce((s, sec) => s + sec.questionCount, 0)
            ),
            bandThresholds: [
              { band: "J5", min: 0 },
              { band: "J4", min: 300 },
              { band: "J3", min: 420 },
              { band: "J2", min: 530 },
              { band: "J1", min: 600 },
              { band: "J1+", min: 700 }
            ]
          }
        }
      },
      update: {
        blueprintMeta: {
          provenance: SEED_PROVENANCE,
          license: SEED_LICENSE,
          sections: SECTIONS.map((s) => ({
            code: s.code,
            titleVi: s.titleVi,
            titleJa: s.titleJa,
            type: s.type,
            questionCount: s.questionCount,
            timeLimitSec: s.timeLimitSec,
            sourcePool: "bjt_questions_active"
          })),
          totalTimeMin: Math.ceil(totalTimeSec / 60)
        },
        description: `Original NihonGo BJT production baseline content. Level: ${level}. Provenance: ${SEED_PROVENANCE}.`,
        level,
        status: "published",
        timeLimitSeconds: totalTimeSec,
        titleJa,
        titleVi,
        type: "mock"
      },
      where: { slug }
    });

    totalExams++;
    console.log(`  Upserted exam: ${slug} (${exam.id})`);

    for (let i = 0; i < SECTIONS.length; i++) {
      const secDef = SECTIONS[i];
      const section = await prisma.bjtTestSection.upsert({
        create: {
          testId: exam.id,
          code: secDef.code,
          titleVi: secDef.titleVi,
          titleJa: secDef.titleJa,
          displayOrder: i + 1
        },
        update: {
          displayOrder: i + 1,
          titleJa: secDef.titleJa,
          titleVi: secDef.titleVi
        },
        where: { testId_code: { code: secDef.code, testId: exam.id } }
      });
      totalSections++;

      const questions = getQuestionsForSection(secDef.code, level);
      for (const q of questions) {
        const existingQuestion = await prisma.bjtQuestion.findFirst({
          select: { id: true },
          where: { prompt: q.prompt, sectionId: section.id }
        });
        const questionData = {
          difficulty: q.difficulty,
          explanationVi: q.explanationVi,
          prompt: q.prompt,
          qualityFlags: {
            bjtPart: secDef.type,
            bjtSection: secDef.code,
            businessSituation: q.businessSituation,
            license: SEED_LICENSE,
            level,
            provenance: SEED_PROVENANCE,
            stimulusKind: q.stimulusKind
          },
          scenario: q.scenario,
          sectionId: section.id,
          skillTag: q.skillTag,
          sourceId: null,
          sourceType: SEED_PROVENANCE,
          status: "published",
          tags: q.tags
        };
        const question = existingQuestion
          ? await prisma.bjtQuestion.update({
              data: questionData,
              where: { id: existingQuestion.id }
            })
          : await prisma.bjtQuestion.create({
              data: questionData
            });
        totalQuestions++;

        for (const option of q.options) {
          await prisma.bjtQuestionOption.upsert({
            create: {
              isCorrect: option.isCorrect,
              optionKey: option.key,
              questionId: question.id,
              text: option.text
            },
            update: {
              isCorrect: option.isCorrect,
              text: option.text
            },
            where: { questionId_optionKey: { optionKey: option.key, questionId: question.id } }
          });
          totalOptions++;
        }
      }
    }
  }

  console.log(`\nBJT Assessment Seed - done.`);
  console.log(`   Exams upserted: ${totalExams}`);
  console.log(`   Sections upserted: ${totalSections}`);
  console.log(`   Questions upserted: ${totalQuestions}`);
  console.log(`   Options upserted: ${totalOptions}`);
  console.log(`   Provenance: ${SEED_PROVENANCE}, license: ${SEED_LICENSE}`);
}

async function ensureSeedActor() {
  return prisma.adminActor.upsert({
    create: {
      displayName: "NihonGo BJT Seed System",
      email: "seed-system@nihongo-bjt.local",
      id: seedActorId,
      status: "active"
    },
    update: { status: "active" },
    where: { id: seedActorId }
  });
}

async function writeCreationAudit(input: {
  action: string;
  actorId: string;
  after: Prisma.InputJsonValue;
  targetId: string;
  targetType: string;
}) {
  const exists = await prisma.adminAuditLog.findFirst({
    where: {
      action: input.action,
      actorId: input.actorId,
      targetId: input.targetId,
      targetType: input.targetType
    }
  });
  if (exists) return;
  await prisma.adminAuditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      after: input.after,
      before: Prisma.JsonNull,
      reason: "Initial production baseline seed",
      targetId: input.targetId,
      targetType: input.targetType,
      traceId: "seed-bjt-battle-production-v1"
    }
  });
}

async function seedBattle() {
  console.log("\nBattle Seed - starting...\n");
  const actor = await ensureSeedActor();

  let configs = 0;
  let bots = 0;

  for (const item of BATTLE_CONFIGS) {
    const existing = await prisma.battleConfig.findFirst({
      where: { level: item.level, name: item.name, questionPoolKey: item.questionPoolKey }
    });
    const data = {
      botDifficulties: item.botDifficulties,
      createdById: actor.id,
      description: item.description,
      level: item.level,
      maxParticipants: item.maxParticipants,
      name: item.name,
      publishedAt: new Date(),
      questionCount: item.questionCount,
      questionPoolKey: item.questionPoolKey,
      scoringRules: item.scoringRules,
      status: "published",
      timePerQuestionSec: item.timePerQuestionSec,
      updatedById: actor.id
    };
    const row = existing
      ? await prisma.battleConfig.update({ data, where: { id: existing.id } })
      : await prisma.battleConfig.create({ data });
    if (!existing) {
      await writeCreationAudit({
        action: "admin.battle.config.created",
        actorId: actor.id,
        after: {
          botDifficulties: row.botDifficulties,
          level: row.level,
          name: row.name,
          questionPoolKey: row.questionPoolKey,
          status: row.status
        },
        targetId: row.id,
        targetType: "learning.battle_config"
      });
    }
    configs++;
  }

  for (const item of BATTLE_BOTS) {
    const existing = await prisma.battleBot.findFirst({
      where: { name: item.name }
    });
    const data = {
      accuracyPct: item.accuracyPct,
      createdById: actor.id,
      difficulty: item.difficulty,
      maxDelayMs: item.maxDelayMs,
      minDelayMs: item.minDelayMs,
      name: item.name,
      persona: item.persona,
      status: "active",
      updatedById: actor.id,
      vocabularyLevel: item.vocabularyLevel
    };
    const row = existing
      ? await prisma.battleBot.update({ data, where: { id: existing.id } })
      : await prisma.battleBot.create({ data });
    if (!existing) {
      await writeCreationAudit({
        action: "admin.battle.bot.created",
        actorId: actor.id,
        after: {
          accuracyPct: row.accuracyPct,
          difficulty: row.difficulty,
          name: row.name,
          status: row.status,
          vocabularyLevel: row.vocabularyLevel
        },
        targetId: row.id,
        targetType: "learning.battle_bot"
      });
    }
    bots++;
  }

  console.log("Battle Seed - done.");
  console.log(`   Battle configs upserted: ${configs}`);
  console.log(`   Battle bots upserted: ${bots}`);
}

async function main() {
  await seedAssessment();
  await seedBattle();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
