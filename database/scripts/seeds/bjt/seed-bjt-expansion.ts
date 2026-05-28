/**
 * BJT Assessment Expansion Seed — adds production-level questions to existing exams
 *
 * Supplements the baseline seed with additional original BJT-style questions
 * to bring each exam from ~20 questions to ~34 questions total.
 *
 * Structure:
 * - LC_SCENE: 5 total (adds 2 new)
 * - LC_STATEMENT: 5 total (adds 2 new)
 * - LC_INTEGRATED: 4 total (adds 2 new)
 * - LR_SITUATION: 3 total (adds 1 new)
 * - LR_DOCUMENT: 3 total (adds 1 new)
 * - LR_INTEGRATED: 3 total (adds 1 new)
 * - RC_VOCAB_GRAMMAR: 5 total (adds 2 new)
 * - RC_EXPRESSION: 3 total (adds 1 new)
 * - RC_INTEGRATED: 3 total (adds 1 new)
 *
 * All content is ORIGINAL — no official BJT text is copied.
 * Idempotent: skips existing questions by matching prompt text.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-bjt-expansion.ts
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
/* Additional Questions Pool                                          */
/* ------------------------------------------------------------------ */

function getExpansionQuestions(
  sectionCode: string,
  diff: string
): SeedQuestion[] {
  const pool: Record<string, SeedQuestion[]> = {
    LC_SCENE: [
      {
        prompt:
          "商談の席で取引先が「御社の製品は品質が高いと聞いておりますが、納品スケジュールについてお伺いしてもよろしいですか」と聞いています。適切な応答を選んでください。",
        scenario:
          "取引先との商談。初めての取引について質問されている場面。",
        explanationVi:
          "Khi đối tác hỏi về lịch giao hàng trong cuộc họp kinh doanh, cần trả lời cụ thể và chuyên nghiệp, thể hiện sự chuẩn bị kỹ lưỡng.",
        skillTag: "delivery_schedule_discussion",
        difficulty: diff,
        businessSituation: "sales_customer",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "ありがとうございます。ご注文をいただいてから通常2週間で納品可能です。大口のご注文の場合は事前にご相談いただければ対応いたします。",
            isCorrect: true,
          },
          {
            key: "B",
            text: "納品はいつでも大丈夫です。",
            isCorrect: false,
          },
          {
            key: "C",
            text: "品質のことしか分かりません。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "スケジュールは担当者に聞いてください。私には関係ありません。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_scene", "sales", "delivery"],
      },
      {
        prompt:
          "社内の廊下で上司が「来月の新入社員研修の講師、引き受けてもらえないかな」と頼んでいます。適切な応答を選んでください。",
        scenario:
          "社内の廊下。上司から研修講師を頼まれる場面。",
        explanationVi:
          "Khi cấp trên nhờ đảm nhận vai trò giảng viên đào tạo, nên trả lời tích cực kèm xác nhận chi tiết.",
        skillTag: "assignment_acceptance",
        difficulty: diff,
        businessSituation: "internal_coordination",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "研修は嫌いです。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "はい、ぜひお引き受けいたします。日程と内容の詳細をお教えいただけますか。",
            isCorrect: true,
          },
          {
            key: "C",
            text: "新入社員と話したくありません。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "来月は忙しいかもしれません。分かりません。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_scene", "training", "assignment"],
      },
    ],
    LC_STATEMENT: [
      {
        prompt:
          "取引先に製品の不具合についてお詫びする場合、最も適切なビジネス表現を選んでください。",
        scenario:
          "電話でのクレーム対応。製品に不具合があったことを謝罪する場面。",
        explanationVi:
          "Khi xin lỗi đối tác về lỗi sản phẩm, cần sử dụng kính ngữ trang trọng, thừa nhận vấn đề và đưa ra phương án xử lý.",
        skillTag: "complaint_apology",
        difficulty: diff,
        businessSituation: "phone",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "不良品があったので、すみません。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "この度は弊社製品の不具合によりご迷惑をおかけし、誠に申し訳ございません。直ちに代替品をお送りいたします。",
            isCorrect: true,
          },
          {
            key: "C",
            text: "そちらの使い方が悪かったのではないでしょうか。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "不具合ですか。よくあることです。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_statement", "complaint", "keigo"],
      },
      {
        prompt:
          "会議で部下の提案を前向きに受け止める場合、上司として最も適切な表現を選んでください。",
        scenario:
          "部門会議。部下が新しい企画を提案している場面。",
        explanationVi:
          "Khi tiếp nhận đề xuất của cấp dưới, cấp trên nên đánh giá tích cực và đề xuất bước tiếp theo cụ thể.",
        skillTag: "proposal_evaluation",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "まあまあの提案ですね。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "面白い提案ですが、実現は無理でしょう。",
            isCorrect: false,
          },
          {
            key: "C",
            text: "なかなか良い着眼点ですね。具体的な実施計画と予算案を次回の会議までにまとめてもらえますか。",
            isCorrect: true,
          },
          {
            key: "D",
            text: "もっと良い案を考えてください。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_statement", "meeting", "management"],
      },
    ],
    LC_INTEGRATED: [
      {
        prompt:
          "人事部長と総務部長が社内制度の見直しについて話し合っています。最終的にどのような方針に決まりましたか。",
        scenario:
          "経営会議。社内の福利厚生制度改革について議論している場面。複数の意見を統合する。",
        explanationVi:
          "Trong cuộc họp về cải cách chế độ phúc lợi, cần lắng nghe cả hai bên và hiểu phương án cuối cùng được thống nhất.",
        skillTag: "policy_decision_comprehension",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "現行制度を維持し、来年度に再検討する。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "リモートワーク手当を新設し、通勤手当の上限を見直す。",
            isCorrect: true,
          },
          {
            key: "C",
            text: "全ての福利厚生を廃止する。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "社員アンケートを実施してから決める。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_integrated", "hr_policy", "decision"],
      },
      {
        prompt:
          "営業チームのミーティングで、先月の売上データを見ながら今後の戦略を議論しています。チームリーダーが提案した施策はどれですか。",
        scenario:
          "営業チーム定例会議。売上推移グラフを見ながら議論している場面。",
        explanationVi:
          "Trong cuộc họp nhóm kinh doanh, cần hiểu đề xuất của trưởng nhóm dựa trên phân tích dữ liệu bán hàng.",
        skillTag: "sales_strategy_comprehension",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "chart",
        options: [
          {
            key: "A",
            text: "既存顧客へのアフターフォローを強化し、リピート率を20%向上させる。",
            isCorrect: true,
          },
          {
            key: "B",
            text: "全営業担当者の給与を上げる。",
            isCorrect: false,
          },
          {
            key: "C",
            text: "営業部門を縮小する。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "新製品の開発をやめる。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lc_integrated", "sales", "strategy"],
      },
    ],
    LR_SITUATION: [
      {
        prompt:
          "工場見学の案内をしている社員と外国人視察団が話しています。視察団が最も関心を持っているのは何ですか。",
        scenario:
          "工場見学。品質管理システムについて説明している場面。",
        explanationVi:
          "Khi hướng dẫn đoàn tham quan nhà máy, cần nắm bắt đúng mối quan tâm chính của khách.",
        skillTag: "factory_tour_comprehension",
        difficulty: diff,
        businessSituation: "presentation",
        stimulusKind: "conversation",
        options: [
          {
            key: "A",
            text: "工場の建設費用",
            isCorrect: false,
          },
          {
            key: "B",
            text: "品質検査の自動化システム",
            isCorrect: true,
          },
          {
            key: "C",
            text: "社員食堂のメニュー",
            isCorrect: false,
          },
          {
            key: "D",
            text: "工場周辺の環境",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lr_situation", "factory", "quality"],
      },
    ],
    LR_DOCUMENT: [
      {
        prompt:
          "新しい人事評価制度についての社内通達を読みながら、説明会の音声を聴いています。従来制度との最大の違いは何ですか。",
        scenario:
          "人事制度改革の説明会。社内通達と音声解説を組み合わせて理解する場面。",
        explanationVi:
          "Khi nghe giải thích về chế độ đánh giá nhân sự mới kết hợp đọc thông báo, cần xác định điểm khác biệt lớn nhất.",
        skillTag: "hr_policy_document",
        difficulty: diff,
        businessSituation: "hr_interview",
        stimulusKind: "document",
        options: [
          {
            key: "A",
            text: "評価回数が年1回から年2回に増える。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "360度評価を導入し、同僚や部下からの評価も反映される。",
            isCorrect: true,
          },
          {
            key: "C",
            text: "評価基準が全社統一から部門別に変わる。",
            isCorrect: false,
          },
          {
            key: "D",
            text: "自己評価が廃止される。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lr_document", "hr", "evaluation"],
      },
    ],
    LR_INTEGRATED: [
      {
        prompt:
          "マーケティング部と開発部が新製品の発売計画について協議しています。市場調査資料を見ながら、最終的に決まった発売時期はいつですか。",
        scenario:
          "部門間協議会。市場調査データとスケジュール表を見ながら話し合う場面。",
        explanationVi:
          "Trong cuộc họp liên phòng ban về kế hoạch ra mắt sản phẩm mới, cần kết hợp dữ liệu nghiên cứu thị trường và lịch trình để xác định thời điểm cuối cùng.",
        skillTag: "product_launch_planning",
        difficulty: diff,
        businessSituation: "meeting",
        stimulusKind: "chart",
        options: [
          {
            key: "A",
            text: "4月の新年度に合わせて発売する。",
            isCorrect: false,
          },
          {
            key: "B",
            text: "競合他社の動向を見てから判断する。",
            isCorrect: false,
          },
          {
            key: "C",
            text: "9月の展示会直後にプレスリリースし、10月から一般販売を開始する。",
            isCorrect: true,
          },
          {
            key: "D",
            text: "年末商戦に間に合うよう12月に発売する。",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "lr_integrated", "marketing", "launch"],
      },
    ],
    RC_VOCAB_GRAMMAR: [
      {
        prompt:
          "次の文の＿＿に入る最もよいものを選んでください。「プロジェクトの成否は、チーム全員の＿＿にかかっている。」",
        scenario:
          "社内報告書の一文。ビジネスにおける協力の重要性を述べている。",
        explanationVi:
          "Câu văn nói về sự thành bại của dự án phụ thuộc vào sự hợp tác/nỗ lực của toàn bộ thành viên. 「連携」là từ phù hợp nhất trong ngữ cảnh kinh doanh.",
        skillTag: "vocab_business_cooperation",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "text",
        options: [
          { key: "A", text: "連携", isCorrect: true },
          { key: "B", text: "連絡", isCorrect: false },
          { key: "C", text: "連続", isCorrect: false },
          { key: "D", text: "連帯", isCorrect: false },
        ],
        tags: ["bjt", "rc_vocab_grammar", "vocabulary", "teamwork"],
      },
      {
        prompt:
          "次の文の＿＿に入る最もよいものを選んでください。「お客様のご要望＿＿、仕様を一部変更いたしました。」",
        scenario:
          "クライアントへの報告メール。仕様変更の理由を説明している。",
        explanationVi:
          "Cấu trúc 「～に基づき」(dựa trên) là cách diễn đạt phù hợp nhất khi giải thích lý do thay đổi thông số kỹ thuật theo yêu cầu khách hàng.",
        skillTag: "grammar_formal_expression",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          { key: "A", text: "に関して", isCorrect: false },
          { key: "B", text: "に基づき", isCorrect: true },
          { key: "C", text: "にとって", isCorrect: false },
          { key: "D", text: "によると", isCorrect: false },
        ],
        tags: ["bjt", "rc_vocab_grammar", "grammar", "keigo"],
      },
    ],
    RC_EXPRESSION: [
      {
        prompt:
          "取引先への見積もり回答メールで、＿＿に入る最も適切な表現を選んでください。「ご依頼いただきました見積もりにつきまして、＿＿。」",
        scenario:
          "見積もり回答メール。正式な見積書を送付する際の書き出し。",
        explanationVi:
          "Khi gửi email phản hồi báo giá, cần sử dụng cách diễn đạt trang trọng và rõ ràng trong kinh doanh.",
        skillTag: "quotation_email_expression",
        difficulty: diff,
        businessSituation: "email_chat",
        stimulusKind: "text",
        options: [
          {
            key: "A",
            text: "添付ファイルにてお送りしますのでご確認ください",
            isCorrect: false,
          },
          {
            key: "B",
            text: "別添のとおりお見積書をお送り申し上げますので、ご査収のほどよろしくお願いいたします",
            isCorrect: true,
          },
          {
            key: "C",
            text: "見積もりを作ったので見てください",
            isCorrect: false,
          },
          {
            key: "D",
            text: "見積書ができましたのでお返事お待ちしております",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "rc_expression", "email", "quotation"],
      },
    ],
    RC_INTEGRATED: [
      {
        prompt:
          "次の社内メモは、オフィス移転計画に関するものです。移転の最大の理由として挙げられているのはどれですか。",
        scenario:
          "社内メモ。「現オフィスの賃貸契約満了に伴い、よりアクセスの良い駅前ビルへの移転を計画しています。新オフィスは現在の1.5倍の広さで、会議室も増設予定です。移転費用は約500万円を見込んでおり、来年度予算で対応します。」",
        explanationVi:
          "Bản ghi nhớ nội bộ về kế hoạch chuyển văn phòng. Lý do lớn nhất được nêu là hợp đồng thuê hiện tại sắp hết hạn.",
        skillTag: "office_relocation_comprehension",
        difficulty: diff,
        businessSituation: "report_document",
        stimulusKind: "document",
        options: [
          {
            key: "A",
            text: "現在のオフィスが古くなったから",
            isCorrect: false,
          },
          {
            key: "B",
            text: "賃貸契約の満了時期が近いから",
            isCorrect: true,
          },
          {
            key: "C",
            text: "社員数が急激に増えたから",
            isCorrect: false,
          },
          {
            key: "D",
            text: "顧客からの要望があったから",
            isCorrect: false,
          },
        ],
        tags: ["bjt", "rc_integrated", "office", "memo"],
      },
    ],
  };

  return pool[sectionCode] ?? [];
}

/* ------------------------------------------------------------------ */
/* Seed Runner                                                        */
/* ------------------------------------------------------------------ */

async function seedExpansion() {
  console.log("BJT Assessment Expansion Seed - starting...\n");

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
      const expansionQs = getExpansionQuestions(section.code, diff);
      const existingPrompts = new Set(
        section.questions.map((q) => q.prompt.trim())
      );

      for (const q of expansionQs) {
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
    `\n✅ Expansion complete: ${added} questions added, ${skipped} skipped (already exist)`
  );
  await prisma.$disconnect();
}

seedExpansion().catch((err) => {
  console.error("Expansion seed failed:", err);
  process.exit(1);
});
