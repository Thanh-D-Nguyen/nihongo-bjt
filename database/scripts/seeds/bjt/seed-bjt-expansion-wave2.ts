/**
 * BJT Assessment Expansion Wave 2 — adds more production questions
 *
 * Target: bring each exam from ~34 to ~50 questions (16 more per exam).
 * Section distribution:
 * - LC_SCENE: +3 → 8 total
 * - LC_STATEMENT: +3 → 8 total
 * - LC_INTEGRATED: +2 → 6 total
 * - LR_SITUATION: +2 → 5 total
 * - LR_DOCUMENT: +1 → 4 total
 * - LR_INTEGRATED: +1 → 4 total
 * - RC_VOCAB_GRAMMAR: +2 → 7 total
 * - RC_EXPRESSION: +1 → 4 total
 * - RC_INTEGRATED: +1 → 4 total
 *
 * All content is ORIGINAL. Idempotent: skips existing questions.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-bjt-expansion-wave2.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const SEED_PROVENANCE = "nihongo-bjt-original-seed-v1";
const SEED_LICENSE = "original-internal-production-seed";

const BJT_LEVELS = [
  "BJT-J5",
  "BJT-J4",
  "BJT-J3",
  "BJT-J2",
  "BJT-J1",
  "BJT-J1+",
] as const;

interface SeedQuestion {
  prompt: string;
  scenario: string;
  explanationVi: string;
  skillTag: string;
  difficulty: string;
  businessSituation: string;
  stimulusKind: string;
  options: Array<{ key: string; text: string; isCorrect: boolean }>;
  tags: string[];
}

function difficultyForLevel(level: string): string {
  const idx = BJT_LEVELS.indexOf(level as (typeof BJT_LEVELS)[number]);
  if (idx <= 1) return "easy";
  if (idx <= 3) return "standard";
  return "hard";
}

/* ------------------------------------------------------------------ */
/* Wave 2 Question Pool                                               */
/* ------------------------------------------------------------------ */

function getWave2Questions(
  sectionCode: string,
  diff: string
): SeedQuestion[] {
  const pool: Record<string, SeedQuestion[]> = {
    LC_SCENE: [
      {
        prompt:
          "エレベーターで社長と偶然会いました。「最近のプロジェクトはどうですか」と聞かれています。適切な応答を選んでください。",
        scenario:
          "社内エレベーター。社長と偶然会い、仕事の状況を聞かれる場面。",
        explanationVi:
          "Khi gặp giám đốc trong thang máy và được hỏi về dự án, cần trả lời ngắn gọn, tích cực nhưng lịch sự.",
        skillTag: "executive_casual_report",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "おかげさまで順調に進んでおります。来月には第一次成果をご報告できる見込みです。",
            isCorrect: true,
          },
          { key: "B", text: "忙しすぎて大変です。", isCorrect: false },
          { key: "C", text: "プロジェクトって何のことですか。", isCorrect: false },
          { key: "D", text: "社長にはあまり関係ないと思います。", isCorrect: false },
        ],
        tags: ["bjt", "lc_scene", "executive", "report"],
      },
      {
        prompt:
          "昼休みに同僚が「今度の忘年会の幹事、やってくれないかな」と頼んでいます。適切な応答を選んでください。",
        scenario:
          "社内食堂での昼食時。同僚から忘年会の幹事を頼まれる場面。",
        explanationVi:
          "Khi được nhờ làm người tổ chức tiệc cuối năm, nên đáp ứng tích cực và hỏi thêm chi tiết cần thiết.",
        skillTag: "event_organization",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "忘年会はやりたくないです。", isCorrect: false },
          {
            key: "B",
            text: "いいですよ。参加人数と予算の目安を教えてもらえますか。",
            isCorrect: true,
          },
          { key: "C", text: "忘年会って何ですか。", isCorrect: false },
          { key: "D", text: "他の人に頼んでください。", isCorrect: false },
        ],
        tags: ["bjt", "lc_scene", "event", "coordination"],
      },
      {
        prompt:
          "展示会ブースで来場者が「この製品の特徴を教えていただけますか」と聞いています。適切な応答を選んでください。",
        scenario:
          "国際展示会。自社ブースで来場者に製品説明をする場面。",
        explanationVi:
          "Khi khách tham quan triển lãm hỏi về đặc điểm sản phẩm, cần giới thiệu ngắn gọn và nêu bật điểm khác biệt.",
        skillTag: "product_presentation",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "カタログを見てください。", isCorrect: false },
          { key: "B", text: "この製品は普通です。特に特徴はありません。", isCorrect: false },
          {
            key: "C",
            text: "はい、こちらの製品は従来品に比べて消費電力を30%削減しつつ、処理速度を2倍に向上させた点が最大の特徴です。",
            isCorrect: true,
          },
          { key: "D", text: "すみません、私は担当者ではありません。", isCorrect: false },
        ],
        tags: ["bjt", "lc_scene", "exhibition", "product"],
      },
    ],
    LC_STATEMENT: [
      {
        prompt:
          "海外支社とのテレビ会議で、回線が不安定になった場合、最も適切な対応表現を選んでください。",
        scenario:
          "海外支社とのテレビ会議中。音声が途切れている場面。",
        explanationVi:
          "Khi cuộc họp video bị gián đoạn do đường truyền, cần thông báo lịch sự và đề xuất phương án thay thế.",
        skillTag: "video_conference_trouble",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "聞こえません。もういいです。", isCorrect: false },
          {
            key: "B",
            text: "申し訳ございません。回線が不安定なようです。一度切断して再接続してもよろしいでしょうか。",
            isCorrect: true,
          },
          { key: "C", text: "音が悪いのはそちらのせいです。", isCorrect: false },
          { key: "D", text: "テレビ会議はやめましょう。", isCorrect: false },
        ],
        tags: ["bjt", "lc_statement", "video_conference", "trouble"],
      },
      {
        prompt:
          "部下のミスを指摘する際、建設的なフィードバックとして最も適切な表現を選んでください。",
        scenario:
          "1on1ミーティング。部下の業務ミスについてフィードバックする場面。",
        explanationVi:
          "Khi góp ý về lỗi của cấp dưới, cần chỉ ra vấn đề cụ thể nhưng đồng thời khuyến khích và hỗ trợ cải thiện.",
        skillTag: "constructive_feedback",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "こんなミスをするなんて信じられません。", isCorrect: false },
          { key: "B", text: "ミスは誰でもするから、気にしないで。", isCorrect: false },
          {
            key: "C",
            text: "今回の資料で数値の転記ミスがありました。確認手順にダブルチェックを加えると防げると思いますので、次回から試してみませんか。",
            isCorrect: true,
          },
          { key: "D", text: "もうこの仕事は他の人に任せます。", isCorrect: false },
        ],
        tags: ["bjt", "lc_statement", "feedback", "management"],
      },
      {
        prompt:
          "新規取引先に初めてメールを送る際の書き出しとして、最も適切な表現を選んでください。",
        scenario:
          "新規取引先への初回連絡メール。自己紹介と用件を伝える場面。",
        explanationVi:
          "Khi gửi email lần đầu cho đối tác mới, cần giới thiệu bản thân và công ty một cách lịch sự, kèm lý do liên lạc.",
        skillTag: "first_contact_email",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "こんにちは。取引しませんか。", isCorrect: false },
          {
            key: "B",
            text: "突然のご連絡失礼いたします。株式会社ABCの営業部、山田と申します。貴社のウェブサイトを拝見し、ぜひ一度お打ち合わせの機会をいただきたくご連絡いたしました。",
            isCorrect: true,
          },
          { key: "C", text: "営業の山田です。時間ありますか。", isCorrect: false },
          { key: "D", text: "お世話になっております。山田です。", isCorrect: false },
        ],
        tags: ["bjt", "lc_statement", "email", "first_contact"],
      },
    ],
    LC_INTEGRATED: [
      {
        prompt:
          "経営企画部のプレゼンテーションを聴いています。来期の重点施策として発表されたのはどれですか。",
        scenario:
          "全社会議。経営企画部長が来期の経営方針をプレゼンしている場面。スライドとともに説明を聴く。",
        explanationVi:
          "Trong buổi thuyết trình về phương hướng kinh doanh kỳ tới, cần lắng nghe và xác định chính xác biện pháp trọng tâm được công bố.",
        skillTag: "strategy_presentation_comprehension",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "conversation",
        options: [
          { key: "A", text: "全部門の人員を一律に10%削減する。", isCorrect: false },
          {
            key: "B",
            text: "デジタル化の推進とアジア市場への本格進出を柱とする。",
            isCorrect: true,
          },
          { key: "C", text: "国内市場に集中し海外事業を縮小する。", isCorrect: false },
          { key: "D", text: "新規事業はすべて凍結する。", isCorrect: false },
        ],
        tags: ["bjt", "lc_integrated", "strategy", "presentation"],
      },
      {
        prompt:
          "社員研修で講師が安全管理について説明しています。事故が起きた場合の初動対応として正しい順序はどれですか。",
        scenario:
          "工場安全研修。講師がフローチャートを示しながら事故対応手順を説明している場面。",
        explanationVi:
          "Trong buổi đào tạo an toàn, cần nắm đúng thứ tự hành động khi xảy ra sự cố theo quy trình được giảng viên trình bày.",
        skillTag: "safety_procedure_comprehension",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "illustration",
        options: [
          { key: "A", text: "報告 → 避難 → 応急処置 → 記録", isCorrect: false },
          {
            key: "B",
            text: "現場の安全確保 → 負傷者の応急処置 → 上司への報告 → 記録の作成",
            isCorrect: true,
          },
          { key: "C", text: "記録 → 報告 → 避難 → 応急処置", isCorrect: false },
          { key: "D", text: "上司への報告 → 現場の安全確保 → 記録 → 帰宅", isCorrect: false },
        ],
        tags: ["bjt", "lc_integrated", "safety", "procedure"],
      },
    ],
    LR_SITUATION: [
      {
        prompt:
          "新入社員オリエンテーションで、人事担当者が社内規定について説明しています。有給休暇の申請方法として正しいのはどれですか。",
        scenario:
          "新入社員向けオリエンテーション。社内規定のスライドを見ながら説明を聴く場面。",
        explanationVi:
          "Trong buổi hướng dẫn nhân viên mới, cần hiểu đúng quy trình xin phép nghỉ có lương theo nội quy công ty.",
        skillTag: "hr_policy_comprehension",
        difficulty: diff,
        businessSituation: "hr_interview",
        stimulusKind: "document",
        options: [
          { key: "A", text: "口頭で上司に伝えるだけでよい。", isCorrect: false },
          {
            key: "B",
            text: "社内システムで申請し、直属の上司の承認を得た後、人事部に届け出る。",
            isCorrect: true,
          },
          { key: "C", text: "人事部に直接電話する。", isCorrect: false },
          { key: "D", text: "当日の朝にメールで連絡する。", isCorrect: false },
        ],
        tags: ["bjt", "lr_situation", "hr", "leave_policy"],
      },
      {
        prompt:
          "社内カフェテリアの案内を見ながら、同僚がメニューの変更点を説明しています。今月から変わったのはどれですか。",
        scenario:
          "社内カフェテリア。新しいメニュー表を見ながら同僚が説明している場面。",
        explanationVi:
          "Khi xem bảng thực đơn mới của cafeteria công ty, cần xác định đúng thay đổi mới từ tháng này.",
        skillTag: "facility_info_comprehension",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "document",
        options: [
          { key: "A", text: "営業時間が延長された。", isCorrect: false },
          { key: "B", text: "価格が全品10%値上げされた。", isCorrect: false },
          {
            key: "C",
            text: "ヘルシーメニューが追加され、アレルギー表示が全品に導入された。",
            isCorrect: true,
          },
          { key: "D", text: "カフェテリアが閉鎖される予定だ。", isCorrect: false },
        ],
        tags: ["bjt", "lr_situation", "facility", "cafeteria"],
      },
    ],
    LR_DOCUMENT: [
      {
        prompt:
          "四半期の売上報告書を見ながら、部長の説明を聴いています。前年同期と比較して最も成長した部門はどれですか。",
        scenario:
          "四半期報告会議。売上グラフと表を見ながら部長が分析結果を報告している場面。",
        explanationVi:
          "Khi nghe giải thích báo cáo doanh thu quý kết hợp biểu đồ, cần xác định bộ phận có tăng trưởng cao nhất so với cùng kỳ năm trước.",
        skillTag: "quarterly_report_analysis",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "chart",
        options: [
          { key: "A", text: "国内営業部", isCorrect: false },
          { key: "B", text: "海外事業部", isCorrect: true },
          { key: "C", text: "開発部", isCorrect: false },
          { key: "D", text: "管理部", isCorrect: false },
        ],
        tags: ["bjt", "lr_document", "report", "quarterly"],
      },
    ],
    LR_INTEGRATED: [
      {
        prompt:
          "物流部門と営業部門が、来月の大型受注に対する配送計画を協議しています。配送方法として最終的に選ばれたのはどれですか。",
        scenario:
          "物流・営業合同会議。配送コスト表とスケジュール表を見ながら最適な配送方法を議論している場面。",
        explanationVi:
          "Trong cuộc họp liên phòng ban về kế hoạch giao hàng cho đơn hàng lớn, cần kết hợp bảng chi phí và lịch trình để xác định phương án được chọn.",
        skillTag: "logistics_planning",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "chart",
        options: [
          { key: "A", text: "全量を一括空輸する。", isCorrect: false },
          {
            key: "B",
            text: "緊急分は空輸し、残りは海上輸送と陸路を組み合わせる分割配送。",
            isCorrect: true,
          },
          { key: "C", text: "納期を延期して全量海上輸送する。", isCorrect: false },
          { key: "D", text: "受注を辞退する。", isCorrect: false },
        ],
        tags: ["bjt", "lr_integrated", "logistics", "delivery"],
      },
    ],
    RC_VOCAB_GRAMMAR: [
      {
        prompt:
          "次の文の＿＿に入る最もよいものを選んでください。「お忙しいところ恐縮ですが、本件について＿＿いただけますでしょうか。」",
        scenario:
          "上司への依頼メール。案件の確認をお願いする場面。",
        explanationVi:
          "Cấu trúc 「ご確認いただく」là cách diễn đạt kính ngữ phù hợp nhất khi nhờ cấp trên xem xét vấn đề.",
        skillTag: "grammar_keigo_request",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "ご確認", isCorrect: true },
          { key: "B", text: "確認して", isCorrect: false },
          { key: "C", text: "確認する", isCorrect: false },
          { key: "D", text: "ご確認される", isCorrect: false },
        ],
        tags: ["bjt", "rc_vocab_grammar", "keigo", "request"],
      },
      {
        prompt:
          "次の文の＿＿に入る最もよいものを選んでください。「新製品の市場＿＿は、来年第1四半期に実施する予定です。」",
        scenario:
          "社内企画書の一文。新製品の市場投入計画について述べている。",
        explanationVi:
          "「市場投入」là cụm từ kinh doanh phù hợp nhất để chỉ việc đưa sản phẩm mới ra thị trường.",
        skillTag: "vocab_business_product",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "text",
        options: [
          { key: "A", text: "投入", isCorrect: true },
          { key: "B", text: "投資", isCorrect: false },
          { key: "C", text: "投票", isCorrect: false },
          { key: "D", text: "投下", isCorrect: false },
        ],
        tags: ["bjt", "rc_vocab_grammar", "vocabulary", "product"],
      },
    ],
    RC_EXPRESSION: [
      {
        prompt:
          "会議の延期を関係者に通知するメールで、＿＿に入る最も適切な表現を選んでください。「＿＿、来週月曜日の定例会議は、講師の都合により延期となりました。」",
        scenario:
          "会議延期の通知メール。関係者全員への一斉連絡。",
        explanationVi:
          "Khi thông báo hoãn cuộc họp qua email, cần mở đầu bằng cách diễn đạt trang trọng phù hợp với email công việc hàng loạt.",
        skillTag: "meeting_notification_expression",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "お知らせです。", isCorrect: false },
          { key: "B", text: "関係者各位", isCorrect: true },
          { key: "C", text: "みなさんへ", isCorrect: false },
          { key: "D", text: "こんにちは。", isCorrect: false },
        ],
        tags: ["bjt", "rc_expression", "email", "notification"],
      },
    ],
    RC_INTEGRATED: [
      {
        prompt:
          "次のビジネスメールは、プロジェクトの進捗報告に関するものです。報告者が最も懸念しているリスクはどれですか。",
        scenario:
          "プロジェクト進捗報告メール。「お疲れ様です。プロジェクトXの進捗をご報告いたします。開発作業は予定通り進行中ですが、主要部品の一つが供給元の工場火災により入荷が2週間遅延する見込みです。代替サプライヤーの手配を並行して進めておりますが、品質テストに追加時間が必要となる可能性がございます。最終納期への影響は現時点では限定的と見込んでおりますが、引き続き状況を注視いたします。」",
        explanationVi:
          "Email báo cáo tiến độ dự án. Người báo cáo lo ngại nhất về việc linh kiện chính bị chậm giao do cháy nhà máy nhà cung cấp.",
        skillTag: "project_risk_comprehension",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "email",
        options: [
          { key: "A", text: "開発チームの人員不足", isCorrect: false },
          {
            key: "B",
            text: "主要部品の供給遅延と代替品の品質テスト期間",
            isCorrect: true,
          },
          { key: "C", text: "予算のオーバー", isCorrect: false },
          { key: "D", text: "クライアントからの仕様変更要求", isCorrect: false },
        ],
        tags: ["bjt", "rc_integrated", "email", "project_risk"],
      },
    ],
  };

  return pool[sectionCode] ?? [];
}

/* ------------------------------------------------------------------ */
/* Seed Runner                                                        */
/* ------------------------------------------------------------------ */

async function seedWave2() {
  console.log("BJT Assessment Expansion Wave 2 - starting...\n");

  let added = 0;
  let skipped = 0;

  for (const level of BJT_LEVELS) {
    const slug = `bjt-production-${level.toLowerCase().replace("+", "plus")}`;
    const diff = difficultyForLevel(level);

    const exam = await prisma.bjtMockTest.findFirst({
      where: { slug },
      include: {
        sections: {
          include: { questions: { select: { prompt: true } } },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!exam) {
      console.log(`  ⚠ Exam not found: ${slug} — run base seed first`);
      continue;
    }

    console.log(`  Expanding: ${slug} (${exam.id})`);

    for (const section of exam.sections) {
      const wave2Qs = getWave2Questions(section.code, diff);
      const existingPrompts = new Set(
        section.questions.map((q) => q.prompt.trim())
      );

      for (const q of wave2Qs) {
        if (existingPrompts.has(q.prompt.trim())) {
          skipped++;
          continue;
        }

        const question = await prisma.bjtQuestion.create({
          data: {
            sectionId: section.id,
            prompt: q.prompt,
            scenario: q.scenario,
            explanationVi: q.explanationVi,
            skillTag: q.skillTag,
            difficulty: q.difficulty,
            sourceType: SEED_PROVENANCE,
            sourceId: null,
            status: "published",
            qualityFlags: {
              bjtPart: section.code.startsWith("LC")
                ? "listening"
                : section.code.startsWith("LR")
                  ? "listening_reading"
                  : "reading",
              bjtSection: section.code,
              businessSituation: q.businessSituation,
              stimulusKind: q.stimulusKind,
              license: SEED_LICENSE,
              level,
              provenance: SEED_PROVENANCE,
            },
            tags: q.tags,
          },
        });

        for (const opt of q.options) {
          await prisma.bjtQuestionOption.create({
            data: {
              questionId: question.id,
              optionKey: opt.key,
              text: opt.text,
              isCorrect: opt.isCorrect,
            },
          });
        }

        added++;
      }
    }
  }

  console.log(
    `\n✅ Wave 2 complete: ${added} questions added, ${skipped} skipped (already exist)`
  );
  await prisma.$disconnect();
}

seedWave2().catch((err) => {
  console.error("Wave 2 seed failed:", err);
  process.exit(1);
});
