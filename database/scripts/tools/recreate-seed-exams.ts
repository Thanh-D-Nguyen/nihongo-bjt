/**
 * Delete empty seed exams and recreate with full BJT-standard format.
 *
 * - Deletes 6 seed-bjt-* exams (cleans FK dependents first)
 * - Creates 6 new "Set 2" exams with proper blueprintMeta
 * - Creates 9 sections per exam (official BJT distribution)
 * - Creates 50 questions per exam with 4 options each
 *
 * Official BJT distribution (50 questions):
 *   Part 1 Listening (45 min): LC_SCENE=8, LC_STATEMENT=8, LC_INTEGRATED=6
 *   Part 2 Listening-Reading (30 min): LR_SITUATION=5, LR_DOCUMENT=4, LR_INTEGRATED=4
 *   Part 3 Reading (30 min): RC_VOCAB_GRAMMAR=7, RC_EXPRESSION=4, RC_INTEGRATED=4
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm tsx database/scripts/recreate-seed-exams.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../packages/database/src/index.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const SEED_PROVENANCE = "nihongo-bjt-original-seed-v2";
const SEED_LICENSE = "original-internal-production-seed";

const BJT_LEVELS = [
  { code: "BJT-J5", slug: "bjt-set2-j5", titleSuffix: "J5", diff: "easy" },
  { code: "BJT-J4", slug: "bjt-set2-j4", titleSuffix: "J4", diff: "easy" },
  { code: "BJT-J3", slug: "bjt-set2-j3", titleSuffix: "J3", diff: "standard" },
  { code: "BJT-J2", slug: "bjt-set2-j2", titleSuffix: "J2", diff: "standard" },
  { code: "BJT-J1", slug: "bjt-set2-j1", titleSuffix: "J1", diff: "hard" },
  { code: "BJT-J1+", slug: "bjt-set2-j1plus", titleSuffix: "J1+", diff: "hard" },
] as const;

function buildBlueprintMeta(level: string) {
  return {
    examFormat: "bjt-mock-full",
    bjtVersion: "current",
    parts: [
      { code: "listening", titleJa: "第1部 聴解", titleVi: "Phần I – Nghe hiểu", timeLimitSec: 2700, sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"] },
      { code: "listening_reading", titleJa: "第2部 聴読解", titleVi: "Phần II – Nghe-Đọc hiểu", timeLimitSec: 1800, sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"] },
      { code: "reading", titleJa: "第3部 読解", titleVi: "Phần III – Đọc hiểu", timeLimitSec: 1800, sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"] },
    ],
    totalTimeMin: 105,
    totalQuestions: 50,
    scoringMethod: "IRT-estimated",
    scoreRange: { min: 0, max: 800 },
    bandMapping: [
      { band: "J5", min: 0, max: 199 }, { band: "J4", min: 200, max: 319 },
      { band: "J3", min: 320, max: 419 }, { band: "J2", min: 420, max: 529 },
      { band: "J1", min: 530, max: 599 }, { band: "J1+", min: 600, max: 800 },
    ],
    sections: [
      { code: "LC_SCENE", type: "listening", titleJa: "聴解 – 場面把握問題", titleVi: "Nghe – Nhận biết tình huống", questionCount: 8, timeLimitSec: 900 },
      { code: "LC_STATEMENT", type: "listening", titleJa: "聴解 – 発言聴解問題", titleVi: "Nghe – Nghe hiểu phát ngôn", questionCount: 8, timeLimitSec: 900 },
      { code: "LC_INTEGRATED", type: "listening", titleJa: "聴解 – 総合聴解問題", titleVi: "Nghe – Tổng hợp nghe hiểu", questionCount: 6, timeLimitSec: 900 },
      { code: "LR_SITUATION", type: "listening_reading", titleJa: "聴読解 – 状況把握問題", titleVi: "Nghe-Đọc – Nhận biết tình huống", questionCount: 5, timeLimitSec: 600 },
      { code: "LR_DOCUMENT", type: "listening_reading", titleJa: "聴読解 – 資料聴読解問題", titleVi: "Nghe-Đọc – Tài liệu nghe-đọc", questionCount: 4, timeLimitSec: 600 },
      { code: "LR_INTEGRATED", type: "listening_reading", titleJa: "聴読解 – 総合聴読解問題", titleVi: "Nghe-Đọc – Tổng hợp nghe-đọc", questionCount: 4, timeLimitSec: 600 },
      { code: "RC_VOCAB_GRAMMAR", type: "reading", titleJa: "読解 – 語彙・文法問題", titleVi: "Đọc – Từ vựng & Ngữ pháp", questionCount: 7, timeLimitSec: 600 },
      { code: "RC_EXPRESSION", type: "reading", titleJa: "読解 – 表現読解問題", titleVi: "Đọc – Đọc hiểu biểu đạt", questionCount: 4, timeLimitSec: 600 },
      { code: "RC_INTEGRATED", type: "reading", titleJa: "読解 – 総合読解問題", titleVi: "Đọc – Tổng hợp đọc hiểu", questionCount: 4, timeLimitSec: 600 },
    ],
    level,
  };
}

const SECTIONS = [
  { code: "LC_SCENE", titleJa: "聴解 – 場面把握問題", titleVi: "Nghe – Nhận biết tình huống", order: 1, part: "listening", stimulusRequired: true },
  { code: "LC_STATEMENT", titleJa: "聴解 – 発言聴解問題", titleVi: "Nghe – Nghe hiểu phát ngôn", order: 2, part: "listening", stimulusRequired: true },
  { code: "LC_INTEGRATED", titleJa: "聴解 – 総合聴解問題", titleVi: "Nghe – Tổng hợp nghe hiểu", order: 3, part: "listening", stimulusRequired: true },
  { code: "LR_SITUATION", titleJa: "聴読解 – 状況把握問題", titleVi: "Nghe-Đọc – Nhận biết tình huống", order: 4, part: "listening_reading", stimulusRequired: true },
  { code: "LR_DOCUMENT", titleJa: "聴読解 – 資料聴読解問題", titleVi: "Nghe-Đọc – Tài liệu nghe-đọc", order: 5, part: "listening_reading", stimulusRequired: true },
  { code: "LR_INTEGRATED", titleJa: "聴読解 – 総合聴読解問題", titleVi: "Nghe-Đọc – Tổng hợp nghe-đọc", order: 6, part: "listening_reading", stimulusRequired: true },
  { code: "RC_VOCAB_GRAMMAR", titleJa: "読解 – 語彙・文法問題", titleVi: "Đọc – Từ vựng & Ngữ pháp", order: 7, part: "reading", stimulusRequired: false },
  { code: "RC_EXPRESSION", titleJa: "読解 – 表現読解問題", titleVi: "Đọc – Đọc hiểu biểu đạt", order: 8, part: "reading", stimulusRequired: false },
  { code: "RC_INTEGRATED", titleJa: "読解 – 総合読解問題", titleVi: "Đọc – Tổng hợp đọc hiểu", order: 9, part: "reading", stimulusRequired: false },
] as const;

interface SeedQ {
  prompt: string;
  scenario: string;
  explanationVi: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  tags: string[];
  businessSituation: string;
  stimulusKind: string;
}

// ===================== QUESTION POOLS =====================

function lcSceneQuestions(): SeedQ[] {
  return [
    { prompt: "会議室で同僚が「このプレゼン資料、もう少し図表を増やした方がいいと思うんだけど」と言っています。適切な返答を選んでください。", scenario: "会議室でプレゼン資料の改善について同僚と話す場面。", explanationVi: "Đồng nghiệp đề nghị thêm biểu đồ. Câu trả lời phù hợp là đồng ý và đề xuất cải thiện cụ thể.", options: [ { key: "A", text: "図表はいらないと思います。", isCorrect: false }, { key: "B", text: "そうですね。特にこの数値データの部分をグラフにすると分かりやすくなりますね。", isCorrect: true }, { key: "C", text: "プレゼンは来週ですから、まだ大丈夫です。", isCorrect: false }, { key: "D", text: "資料は私が全部作り直します。", isCorrect: false } ], tags: ["presentation", "teamwork"], businessSituation: "meeting", stimulusKind: "photo" },
    { prompt: "お客様が「すみません、予約した山田ですが、個室は空いていますか」と言っています。レストランのスタッフとして適切な対応を選んでください。", scenario: "レストランの受付。予約客への対応場面。", explanationVi: "Khách đã đặt bàn hỏi về phòng riêng. Phản hồi phù hợp là xác nhận và hướng dẫn.", options: [ { key: "A", text: "個室はありませんので、お帰りください。", isCorrect: false }, { key: "B", text: "山田様ですね。ご予約ありがとうございます。個室をご用意しておりますので、ご案内いたします。", isCorrect: true }, { key: "C", text: "予約はしていないと思います。", isCorrect: false }, { key: "D", text: "個室は予約した人だけが使えます。", isCorrect: false } ], tags: ["customer_service", "restaurant"], businessSituation: "sales_customer", stimulusKind: "photo" },
    { prompt: "上司が「来月の展示会のブース設営、今年は佐藤さんに任せようと思うんだけど」と言っています。佐藤さんとして適切な返答を選んでください。", scenario: "オフィスで上司から展示会の担当を打診される場面。", explanationVi: "Cấp trên muốn giao nhiệm vụ. Câu trả lời phù hợp là nhận nhiệm vụ và xác nhận chi tiết.", options: [ { key: "A", text: "展示会は興味がありません。", isCorrect: false }, { key: "B", text: "来月はちょっと忙しいかもしれません。", isCorrect: false }, { key: "C", text: "はい、承知しました。ブースのレイアウトや必要な機材について、改めてご相談させてください。", isCorrect: true }, { key: "D", text: "去年と同じでいいですか。", isCorrect: false } ], tags: ["event", "delegation"], businessSituation: "internal_coordination", stimulusKind: "photo" },
    { prompt: "取引先の担当者が「御社の新製品、弊社のニーズに合うかどうか検討したいのですが」と言っています。営業担当として適切な返答を選んでください。", scenario: "取引先訪問。新製品の提案場面。", explanationVi: "Đối tác muốn xem xét sản phẩm mới. Câu trả lời phù hợp là đề xuất buổi demo.", options: [ { key: "A", text: "ぜひ一度、御社の要件に合わせたデモンストレーションをさせていただければと思います。ご都合のよい日時をお教えいただけますか。", isCorrect: true }, { key: "B", text: "カタログを送りますので、読んでください。", isCorrect: false }, { key: "C", text: "弊社の製品は全ての会社に合います。", isCorrect: false }, { key: "D", text: "検討は不要です。すぐに契約しましょう。", isCorrect: false } ], tags: ["sales", "product_demo"], businessSituation: "sales_customer", stimulusKind: "photo" },
    { prompt: "社内の廊下で部長が「明日の部門会議、30分繰り上げて9時からにしたいんだが」と言っています。適切な対応を選んでください。", scenario: "社内廊下で部長からの会議時間変更の連絡を受ける場面。", explanationVi: "Trưởng phòng muốn đổi giờ họp. Phản hồi phù hợp là xác nhận và hỏi về thông báo cho thành viên khác.", options: [ { key: "A", text: "9時は早すぎます。", isCorrect: false }, { key: "B", text: "承知いたしました。他のメンバーにも連絡しておきましょうか。", isCorrect: true }, { key: "C", text: "会議は中止ですか。", isCorrect: false }, { key: "D", text: "明日は休みたいです。", isCorrect: false } ], tags: ["schedule", "meeting"], businessSituation: "schedule", stimulusKind: "photo" },
    { prompt: "取引先のロビーで受付の方に「本日14時にマーケティング部の鈴木様とお約束しております」と伝えています。受付の方は何と返答しますか。", scenario: "取引先ビルのロビー。訪問者として受付で対応を受ける場面。", explanationVi: "Nhân viên lễ tân sẽ xác nhận cuộc hẹn và hướng dẫn.", options: [ { key: "A", text: "鈴木は今日休みです。", isCorrect: false }, { key: "B", text: "マーケティング部はこのビルにはありません。", isCorrect: false }, { key: "C", text: "鈴木でございますね。確認いたしますので、少々お待ちいただけますか。", isCorrect: true }, { key: "D", text: "アポイントがない場合はお通しできません。", isCorrect: false } ], tags: ["reception", "business_visit"], businessSituation: "sales_customer", stimulusKind: "photo" },
    { prompt: "新入社員研修で講師が「今日は電話応対の基本を学びます」と言っています。最初に練習する内容として適切なものを選んでください。", scenario: "新入社員研修の教室。ビジネス電話の基本を学ぶ場面。", explanationVi: "Nội dung đầu tiên phù hợp là cách nhận cuộc gọi cơ bản.", options: [ { key: "A", text: "クレーム対応の仕方。", isCorrect: false }, { key: "B", text: "「お電話ありがとうございます。○○会社でございます」という基本的な受け方。", isCorrect: true }, { key: "C", text: "海外取引先への英語での電話のかけ方。", isCorrect: false }, { key: "D", text: "電話を切る際のマナー。", isCorrect: false } ], tags: ["training", "phone"], businessSituation: "phone", stimulusKind: "photo" },
    { prompt: "コンビニエンスストアで外国人の同僚が「この書類、コピーしたいんですけど」と言っています。適切な助言を選んでください。", scenario: "コンビニのマルチコピー機の前。同僚を手伝う場面。", explanationVi: "Hướng dẫn phù hợp là chỉ cách sử dụng máy copy.", options: [ { key: "A", text: "このコピー機は使えません。", isCorrect: false }, { key: "B", text: "コピーは会社でした方がいいです。", isCorrect: false }, { key: "C", text: "このボタンを押して、原稿をここに置いて、サイズを選んでスタートを押せば大丈夫ですよ。", isCorrect: true }, { key: "D", text: "私がやりますから待っていてください。", isCorrect: false } ], tags: ["daily_life", "helping"], businessSituation: "other", stimulusKind: "photo" },
  ];
}

function lcStatementQuestions(): SeedQ[] {
  return [
    { prompt: "取引先への謝罪メールで「納品が遅れましたこと」を詫びる際、最も適切なビジネス表現を選んでください。", scenario: "納品遅延に対する取引先への謝罪メール作成場面。", explanationVi: "Xin lỗi về giao hàng trễ. Biểu đạt phù hợp là sử dụng kính ngữ trang trọng.", options: [ { key: "A", text: "納品が遅れてすみませんでした。", isCorrect: false }, { key: "B", text: "この度は納品に遅延が生じましたこと、心よりお詫び申し上げます。今後このようなことがないよう、管理体制を強化してまいります。", isCorrect: true }, { key: "C", text: "納品が遅れたのは運送会社のせいです。", isCorrect: false }, { key: "D", text: "遅れましたが、届いたので問題ないと思います。", isCorrect: false } ], tags: ["apology", "email"], businessSituation: "email_chat", stimulusKind: "audio" },
    { prompt: "上司に残業の許可を求める際、最も適切な表現を選んでください。", scenario: "夕方のオフィス。残業が必要な業務がある場面。", explanationVi: "Xin phép làm thêm giờ. Cách nói phù hợp là giải thích lý do và hỏi ý kiến cấp trên.", options: [ { key: "A", text: "今日は残業します。", isCorrect: false }, { key: "B", text: "明日の会議資料の準備がまだ終わっておりませんので、本日2時間ほど残業させていただいてもよろしいでしょうか。", isCorrect: true }, { key: "C", text: "残業代が出るなら残業したいです。", isCorrect: false }, { key: "D", text: "仕事が多すぎるので残業は当然です。", isCorrect: false } ], tags: ["overtime", "permission"], businessSituation: "internal_coordination", stimulusKind: "audio" },
    { prompt: "社内プレゼンで自社の新サービスを紹介する冒頭の挨拶として、最も適切な表現を選んでください。", scenario: "社内会議室でのプレゼンテーション開始場面。", explanationVi: "Lời mở đầu phù hợp là chào hỏi, cảm ơn sự tham gia và giới thiệu chủ đề.", options: [ { key: "A", text: "早速ですが、新サービスについて話します。", isCorrect: false }, { key: "B", text: "お忙しいところお集まりいただき、ありがとうございます。本日は、来月リリース予定の新サービスについてご説明させていただきます。", isCorrect: true }, { key: "C", text: "新サービスができました。説明します。", isCorrect: false }, { key: "D", text: "時間がないので手短に説明します。", isCorrect: false } ], tags: ["presentation", "greeting"], businessSituation: "presentation", stimulusKind: "audio" },
    { prompt: "電話で顧客から商品の返品を求められた際、最も適切な初期対応の表現を選んでください。", scenario: "カスタマーサポートでの電話対応場面。", explanationVi: "Khách muốn trả hàng. Phản hồi phù hợp là xin lỗi, lắng nghe và xác nhận thông tin.", options: [ { key: "A", text: "返品はできません。", isCorrect: false }, { key: "B", text: "ご不便をおかけして申し訳ございません。返品のご希望とのこと、まずはお手元の商品の状態とご購入日を確認させていただけますか。", isCorrect: true }, { key: "C", text: "レシートはありますか。ないとダメです。", isCorrect: false }, { key: "D", text: "上司に聞いてみますので、明日またかけてください。", isCorrect: false } ], tags: ["customer_service", "return"], businessSituation: "complaint", stimulusKind: "audio" },
    { prompt: "会議で自分の意見に反対された場合、建設的に議論を続けるための表現として最も適切なものを選んでください。", scenario: "部門会議で企画案について意見が分かれている場面。", explanationVi: "Khi bị phản đối, cách phản hồi xây dựng là thừa nhận quan điểm đối phương và đề xuất thảo luận thêm.", options: [ { key: "A", text: "私の意見が正しいです。", isCorrect: false }, { key: "B", text: "なるほど、○○さんのご懸念はよく分かります。その点を踏まえて、もう少し詳しくデータを確認してみてはいかがでしょうか。", isCorrect: true }, { key: "C", text: "反対するなら、代わりの案を出してください。", isCorrect: false }, { key: "D", text: "では、この話は終わりにしましょう。", isCorrect: false } ], tags: ["meeting", "negotiation"], businessSituation: "meeting", stimulusKind: "audio" },
    { prompt: "取引先に見積書を送付する際のメール本文として、最も適切な表現を選んでください。", scenario: "取引先からの見積依頼に対してメールで回答する場面。", explanationVi: "Gửi báo giá cho đối tác. Cách viết phù hợp là kèm tài liệu, nêu thời hạn hiệu lực.", options: [ { key: "A", text: "見積書を送ります。確認してください。", isCorrect: false }, { key: "B", text: "先日ご依頼いただきましたお見積りを添付にてお送りいたします。有効期限は本日より30日間となっております。ご不明な点がございましたら、お気軽にお問い合わせください。", isCorrect: true }, { key: "C", text: "見積もりはPDFです。値段は安くできません。", isCorrect: false }, { key: "D", text: "お見積りの件、了解しました。", isCorrect: false } ], tags: ["email", "quotation"], businessSituation: "email_chat", stimulusKind: "audio" },
    { prompt: "プロジェクトの締め切りに間に合わないことを上司に報告する際、最も適切な表現を選んでください。", scenario: "オフィスで上司にプロジェクトの遅延を報告する場面。", explanationVi: "Báo cáo trễ deadline. Cách nói phù hợp là nêu tình hình, nguyên nhân và đề xuất giải pháp.", options: [ { key: "A", text: "締め切りに間に合いません。", isCorrect: false }, { key: "B", text: "申し訳ございません。テスト工程で予想以上の不具合が見つかり、当初の締め切りより3日ほど遅れる見込みです。対策として、チーム内で作業を再分担することをご提案いたします。", isCorrect: true }, { key: "C", text: "もう少し時間をください。", isCorrect: false }, { key: "D", text: "他の人のせいで遅れています。", isCorrect: false } ], tags: ["report", "deadline"], businessSituation: "report_document", stimulusKind: "audio" },
    { prompt: "異動の挨拶メールで、前部署の同僚に感謝を伝える最も適切な表現を選んでください。", scenario: "人事異動に伴う社内メールでの挨拶場面。", explanationVi: "Lời cảm ơn khi chuyển phòng ban. Cách viết phù hợp là cảm ơn sự hỗ trợ.", options: [ { key: "A", text: "今までお世話になりました。さようなら。", isCorrect: false }, { key: "B", text: "○○部での3年間、皆様には大変お世話になりました。温かいご指導をいただいたおかげで、大きく成長することができました。今後ともよろしくお願いいたします。", isCorrect: true }, { key: "C", text: "異動になったので、連絡先を変えてください。", isCorrect: false }, { key: "D", text: "異動先でも頑張ります。", isCorrect: false } ], tags: ["transfer", "email"], businessSituation: "email_chat", stimulusKind: "audio" },
  ];
}

function lcIntegratedQuestions(): SeedQ[] {
  return [
    { prompt: "営業部と経理部の打ち合わせで、営業部長は「来期の広告予算を20%増やしたい」と主張し、経理部長は「コスト削減が全社方針だ」と述べています。核心的な対立点は何ですか。", scenario: "営業部と経理部の予算会議。", explanationVi: "Xung đột cốt lõi: đầu tư để tăng doanh thu vs. chính sách cắt giảm chi phí.", options: [ { key: "A", text: "売上目標の達成のための投資と全社的なコスト削減方針の間の対立。", isCorrect: true }, { key: "B", text: "営業部長と経理部長の個人的な対立。", isCorrect: false }, { key: "C", text: "広告の効果に関する意見の相違。", isCorrect: false }, { key: "D", text: "来期の売上予測に関する見解の違い。", isCorrect: false } ], tags: ["meeting", "budget"], businessSituation: "meeting", stimulusKind: "conversation" },
    { prompt: "社長が「今年は守りから攻めの経営に転じる」と述べた後、人事部長が「採用計画を前倒しで進めます」と発言しました。人事部長の発言の意図は何ですか。", scenario: "年始の全社朝礼。経営方針の共有場面。", explanationVi: "GĐ nhân sự đẩy nhanh tuyển dụng = hưởng ứng phương châm kinh doanh tích cực.", options: [ { key: "A", text: "社長の方針に反対している。", isCorrect: false }, { key: "B", text: "攻めの経営を人材面から支えるために採用を強化する意思を示している。", isCorrect: true }, { key: "C", text: "人事部門の予算を増やしたいと暗示している。", isCorrect: false }, { key: "D", text: "現在の社員は能力不足だと言っている。", isCorrect: false } ], tags: ["corporate_strategy", "hr"], businessSituation: "presentation", stimulusKind: "conversation" },
    { prompt: "エンジニアが「この機能の実装には最低3か月必要」と言い、マネージャーが「クライアントには1か月後にデモを見せる約束をしています」と返しました。最も建設的な次のステップは何ですか。", scenario: "製品開発ミーティング。スケジュールの調整場面。", explanationVi: "Kỹ sư cần 3 tháng, manager hẹn demo 1 tháng. Bước xây dựng: định nghĩa MVP cho demo.", options: [ { key: "A", text: "エンジニアに1か月で完成するよう指示する。", isCorrect: false }, { key: "B", text: "クライアントにデモの延期を伝える。", isCorrect: false }, { key: "C", text: "1か月で実現可能な最小限の機能セットを定義し、段階的なデモ計画を策定する。", isCorrect: true }, { key: "D", text: "プロジェクト自体をキャンセルする。", isCorrect: false } ], tags: ["project_management", "negotiation"], businessSituation: "meeting", stimulusKind: "conversation" },
    { prompt: "労働組合が「福利厚生の拡充」を求め、経営側が「業績改善後に検討する」と回答しました。最も現実的な落とし所はどれですか。", scenario: "労使交渉の場面。", explanationVi: "Thỏa hiệp thực tế: đặt KPI cụ thể làm điều kiện tăng phúc lợi.", options: [ { key: "A", text: "経営側の提案をそのまま受け入れる。", isCorrect: false }, { key: "B", text: "具体的な業績指標を設定し、達成時に福利厚生を段階的に拡充するロードマップを作成する。", isCorrect: true }, { key: "C", text: "組合側が全面的に譲歩する。", isCorrect: false }, { key: "D", text: "ストライキを行う。", isCorrect: false } ], tags: ["negotiation", "hr"], businessSituation: "negotiation", stimulusKind: "conversation" },
    { prompt: "カスタマーサポート担当者が技術的な質問に答えられず上司に報告しています。上司のアドバイスとして最も適切なものを選んでください。", scenario: "カスタマーサポート部門。技術的な問い合わせへの対応場面。", explanationVi: "Lời khuyên phù hợp: liên hệ bộ phận kỹ thuật và gọi lại trong thời gian đã hẹn.", options: [ { key: "A", text: "「技術部に聞いて、30分以内にお客様に折り返し連絡してください。回答が遅れる場合は、途中経過もお伝えしましょう。」", isCorrect: true }, { key: "B", text: "「マニュアルを読めば分かるはずです。」", isCorrect: false }, { key: "C", text: "「そういう質問には答えなくていいです。」", isCorrect: false }, { key: "D", text: "「メールで回答すれば大丈夫です。」", isCorrect: false } ], tags: ["customer_support", "escalation"], businessSituation: "complaint", stimulusKind: "conversation" },
    { prompt: "CFOが「第3四半期の利益率が目標を下回った」と報告し、COOが「生産効率の改善プロジェクトが第4四半期から効果を発揮する」と補足しました。最も正確な現状認識はどれですか。", scenario: "経営会議での四半期業績レビュー場面。", explanationVi: "Q3 dưới mục tiêu nhưng Q4 có kế hoạch cải thiện → tạm thời dưới mục tiêu, có khả năng phục hồi.", options: [ { key: "A", text: "会社は深刻な経営危機にある。", isCorrect: false }, { key: "B", text: "現在は目標未達だが、第4四半期以降に改善が見込めるため、通期での回復可能性がある。", isCorrect: true }, { key: "C", text: "生産効率は問題ないが、販売が不振である。", isCorrect: false }, { key: "D", text: "第3四半期の結果は予想通りである。", isCorrect: false } ], tags: ["finance", "executive_meeting"], businessSituation: "meeting", stimulusKind: "conversation" },
  ];
}

function lrSituationQuestions(): SeedQ[] {
  return [
    { prompt: "社内掲示と上司の口頭説明を合わせて読んでください。\n\n掲示：「6月1日より、リモートワークは週3日まで可能となります。申請はHRシステムから。」\n上司：「うちの部署は、プロジェクトの進捗状況を見て、各自の上限を個別に判断するから。」\n\n正しいのはどれですか。", scenario: "リモートワーク制度変更の通知と上司の補足説明。", explanationVi: "Thông báo: tối đa 3 ngày/tuần. Cấp trên: quyết định riêng theo tiến độ dự án.", options: [ { key: "A", text: "全社員が週3日リモートワークできる。", isCorrect: false }, { key: "B", text: "リモートワークの上限は部署ごとにプロジェクト状況に応じて調整される可能性がある。", isCorrect: true }, { key: "C", text: "リモートワークは6月1日から廃止される。", isCorrect: false }, { key: "D", text: "上司の許可なくリモートワークの申請ができる。", isCorrect: false } ], tags: ["remote_work", "policy"], businessSituation: "internal_coordination", stimulusKind: "document" },
    { prompt: "ビルの掲示板とメールを読んでください。\n\n掲示板：「エレベーター点検のため、7月15日（土）9時〜17時、A号機を停止。B号機をご利用ください。」\nメール：「点検作業の進捗により、16時頃に終了する可能性があります。」\n\n正しい情報はどれですか。", scenario: "ビルのエレベーター点検に関する通知。", explanationVi: "A停止 9-17h ngày 15/7, có thể xong sớm lúc 16h. Dùng B.", options: [ { key: "A", text: "7月15日は両方のエレベーターが使えない。", isCorrect: false }, { key: "B", text: "A号機は9時から17時まで停止予定だが、16時頃に復旧する可能性がある。", isCorrect: true }, { key: "C", text: "B号機が点検のため停止する。", isCorrect: false }, { key: "D", text: "点検は日曜日に行われる。", isCorrect: false } ], tags: ["building_notice", "schedule"], businessSituation: "other", stimulusKind: "document" },
    { prompt: "人事部の通知と部長のコメントを合わせて読んでください。\n\n通知：「来年度から有給休暇の取得率70%以上を各部門の目標とします。」\n部長：「うちは繁忙期の8月と12月を除いて、計画的に取得するようにしてほしい。」\n\n正しい理解はどれですか。", scenario: "有給休暇の取得促進に関する通知と上司の指示。", explanationVi: "Mục tiêu ≥70%, tránh tháng 8 và 12, lên kế hoạch nghỉ hợp lý.", options: [ { key: "A", text: "有給休暇は8月と12月に集中して取得すべきである。", isCorrect: false }, { key: "B", text: "部門目標として70%以上の取得を目指しつつ、繁忙期を避けて計画的に休暇を取得する必要がある。", isCorrect: true }, { key: "C", text: "70%の有給休暇を必ず1月までに使い切らなければならない。", isCorrect: false }, { key: "D", text: "部長の指示により有給休暇の取得は制限されている。", isCorrect: false } ], tags: ["hr", "policy"], businessSituation: "hr_interview", stimulusKind: "document" },
    { prompt: "研修案内メールと先輩のアドバイスを合わせて読んでください。\n\nメール：「ビジネスマナー研修：4月10日10時〜16時。持ち物：筆記用具、名刺（20枚）。」\n先輩：「名刺交換の実習が長いから、名刺は多めに。あと、ランチは出ないから自分で用意してね。」\n\n確実に言えることはどれですか。", scenario: "新入社員ビジネスマナー研修の情報収集場面。", explanationVi: "Mang danh thiếp 20+ tấm, tự chuẩn bị cơm trưa.", options: [ { key: "A", text: "ランチが提供される。", isCorrect: false }, { key: "B", text: "名刺は20枚より多めに持参し、昼食は自分で用意する必要がある。", isCorrect: true }, { key: "C", text: "研修は半日で終わる。", isCorrect: false }, { key: "D", text: "名刺交換の実習は短時間で終わる。", isCorrect: false } ], tags: ["training", "preparation"], businessSituation: "other", stimulusKind: "document" },
    { prompt: "社食のメニュー掲示と総務部からの連絡を読んでください。\n\n掲示：「本日のメニュー：A定食650円、B定食550円、C定食600円。」\n総務部：「食堂改装のため、来週月曜から2週間、社食は閉鎖します。ビル1階のコンビニまたは近隣飲食店をご利用ください。」\n\n来週のランチについて正しいのはどれですか。", scenario: "社食改装に伴うランチ手配の情報場面。", explanationVi: "Tuần sau canteen đóng cửa 2 tuần. Dùng combini hoặc nhà hàng.", options: [ { key: "A", text: "来週もA定食が食べられる。", isCorrect: false }, { key: "B", text: "社食が閉鎖されるため、コンビニか外部の飲食店で昼食を取る必要がある。", isCorrect: true }, { key: "C", text: "社食は来週から値上げする。", isCorrect: false }, { key: "D", text: "メニューが変更になる。", isCorrect: false } ], tags: ["daily_life", "office"], businessSituation: "other", stimulusKind: "document" },
  ];
}

function lrDocumentQuestions(): SeedQ[] {
  return [
    { prompt: "月次売上報告書と部長のコメントを読んでください。\n\n報告書：「4月の売上高は前月比8%減。主要因はA製品の在庫切れ（2週間）。B製品は前月比12%増。」\n部長：「A製品の在庫管理を改善し、来月は前月比15%増を目指そう。」\n\n5月の売上目標達成に最も重要なことは何ですか。", scenario: "月次売上会議。売上データと部長の指示を統合分析する場面。", explanationVi: "A hết hàng 2 tuần gây giảm 8%. Ưu tiên: cải thiện quản lý tồn kho A.", options: [ { key: "A", text: "B製品の販売を中止する。", isCorrect: false }, { key: "B", text: "A製品の在庫切れを防ぎ、安定供給を確保すること。", isCorrect: true }, { key: "C", text: "全製品の価格を引き下げる。", isCorrect: false }, { key: "D", text: "営業チームの人数を倍にする。", isCorrect: false } ], tags: ["sales_report", "analysis"], businessSituation: "report_document", stimulusKind: "chart" },
    { prompt: "社員アンケート結果と人事部の分析を読んでください。\n\n結果：満足度「高い」35%、「普通」40%、「低い」25%。不満理由：「キャリアパスが不明確」42%、「給与」28%、「人間関係」18%、「その他」12%。\n分析：「前年比で満足度5ポイント改善したが、キャリアパスへの不満は最大の課題。」\n\n最も適切な読み取りはどれですか。", scenario: "年次社員満足度アンケートの分析報告場面。", explanationVi: "Hài lòng tăng 5 điểm, nhưng lo ngại lớn nhất: lộ trình nghề nghiệp (42%).", options: [ { key: "A", text: "社員の大多数は給与に不満を持っている。", isCorrect: false }, { key: "B", text: "全体的な満足度は改善傾向にあるが、キャリア開発制度の整備が最優先課題である。", isCorrect: true }, { key: "C", text: "人間関係の改善が最も急務である。", isCorrect: false }, { key: "D", text: "社員満足度は前年より悪化している。", isCorrect: false } ], tags: ["hr", "survey"], businessSituation: "report_document", stimulusKind: "chart" },
    { prompt: "出張経費精算ガイドラインとQ&Aを読んでください。\n\nガイドライン：「宿泊費上限：東京・大阪12,000円、その他10,000円。日当3,000円。領収書必要。」\nQ&A：「Q：上限超過の場合は？ A：事前承認があれば差額を精算可能。」\n\n東京出張で13,000円のホテルに泊まる場合の手続きはどれですか。", scenario: "出張経費精算のルール確認場面。", explanationVi: "Giới hạn Tokyo: 12,000¥. Khách sạn 13,000¥ → xin phê duyệt trước.", options: [ { key: "A", text: "13,000円全額を自費で払う。", isCorrect: false }, { key: "B", text: "12,000円のホテルに変更するか、事前に承認を得て差額を精算する。", isCorrect: true }, { key: "C", text: "領収書なしで12,000円だけ請求する。", isCorrect: false }, { key: "D", text: "出張後に承認を得れば問題ない。", isCorrect: false } ], tags: ["expense", "business_trip"], businessSituation: "report_document", stimulusKind: "table" },
    { prompt: "プロジェクト進捗表とマネージャーの週次コメントを読んでください。\n\n進捗表：タスクA「完了100%」、タスクB「進行中75%」、タスクC「未着手0%」、タスクD「進行中30%」。\nマネージャー：「タスクCはBの完了後に着手。DはAPI連携の問題を今週中に解決したい。」\n\nプロジェクト全体の状況として最も正確なのはどれですか。", scenario: "プロジェクト管理ツールと週次ミーティングの情報統合場面。", explanationVi: "A xong, B 75%, C chờ B, D bị chặn bởi API.", options: [ { key: "A", text: "全タスクが順調に進んでいる。", isCorrect: false }, { key: "B", text: "タスクAは完了、Bは順調だが、Dにはボトルネックがあり、CはBの完了待ちの状態。", isCorrect: true }, { key: "C", text: "プロジェクト全体が遅延している。", isCorrect: false }, { key: "D", text: "タスクCが最も重要なボトルネックである。", isCorrect: false } ], tags: ["project_management", "progress"], businessSituation: "report_document", stimulusKind: "table" },
  ];
}

function lrIntegratedQuestions(): SeedQ[] {
  return [
    { prompt: "取引先メール、契約書の主要条項、法務部コメントを参照してください。\n\nメール：「修正版の契約書をお送りします。価格と納期を変更しました。」\n契約書：「単価：1,200円→1,100円。納期：30日→45日。違約金：契約額の5%。」\n法務部：「違約金条項は業界標準より高い。交渉の余地あり。」\n\n最も適切な対応はどれですか。", scenario: "契約書レビュー。複数情報源を統合して判断する場面。", explanationVi: "Giá giảm, thời hạn dài hơn, phạt cao hơn tiêu chuẩn. Nên thương lượng điều khoản phạt.", options: [ { key: "A", text: "修正版をそのまま承認する。", isCorrect: false }, { key: "B", text: "価格引き下げと納期延長を受け入れつつ、違約金条項について業界標準の3%への引き下げを交渉する。", isCorrect: true }, { key: "C", text: "契約を全面的に拒否する。", isCorrect: false }, { key: "D", text: "法務部のコメントを無視して契約する。", isCorrect: false } ], tags: ["contract", "negotiation"], businessSituation: "negotiation", stimulusKind: "document" },
    { prompt: "新オフィス移転案内、フロアマップ、IT部門のネットワーク設定ガイドを参照してください。\n\n案内：「9月1日より新オフィスへ移転。」\nフロアマップ：「3F：営業・マーケ、4F：開発・IT、5F：経営陣・会議室」\nIT部門：「移転初日は旧VPN設定をリセット。新Wi-Fiは当日案内を配布。」\n\n移転初日に最も注意すべきことは何ですか。", scenario: "オフィス移転に関する複数資料の確認場面。", explanationVi: "VPN cũ sẽ bị reset, cần thiết lập Wi-Fi mới theo hướng dẫn phát tại chỗ.", options: [ { key: "A", text: "旧オフィスのVPNがそのまま使える。", isCorrect: false }, { key: "B", text: "ネットワーク接続には当日配布されるWi-Fi設定案内が必要であり、旧VPNは使用不可になる。", isCorrect: true }, { key: "C", text: "ITサポートは不要である。", isCorrect: false }, { key: "D", text: "新オフィスは在宅勤務に切り替わる。", isCorrect: false } ], tags: ["office_move", "IT"], businessSituation: "internal_coordination", stimulusKind: "document" },
    { prompt: "求人広告、応募者の履歴書、面接官のメモを参照してください。\n\n求人：「マーケティングマネージャー。要件：5年以上経験、データ分析、英語ビジネスレベル。」\n履歴書：「経験7年、GA/Tableau使用、TOEIC 850点。前職：大手メーカーのデジタルマーケ。」\n面接官：「コミュニケーション力は高いが、チームマネジメント経験がない点が懸念。」\n\n総合評価として最も適切なのはどれですか。", scenario: "採用面接後の候補者評価場面。", explanationVi: "Đáp ứng yêu cầu kỹ thuật nhưng thiếu kinh nghiệm quản lý đội nhóm.", options: [ { key: "A", text: "全ての要件を完全に満たしているので即採用すべき。", isCorrect: false }, { key: "B", text: "スキルと経験は要件を満たしているが、マネージャー職に必要なチーム管理経験の不足が課題である。", isCorrect: true }, { key: "C", text: "英語力が不足しているため不採用とすべき。", isCorrect: false }, { key: "D", text: "データ分析スキルがないため候補から外すべき。", isCorrect: false } ], tags: ["recruitment", "evaluation"], businessSituation: "hr_interview", stimulusKind: "document" },
    { prompt: "製品リコール通知、対象リスト、サポート対応マニュアルを参照してください。\n\n通知：「安全上の理由で、X-200シリーズのリコール実施。対象：2025年1月〜6月製造分。」\nリスト：「X-201、X-202、X-203。シリアルXA00001〜XA50000。」\nマニュアル：「①対象確認→②交換品手配→③着払い返送→④代替品発送。対応期限：6か月。」\n\n「X-202のシリアルXA30000を持っている」と連絡があった場合の対応はどれですか。", scenario: "製品リコール対応場面。", explanationVi: "X-202, XA30000 nằm trong phạm vi. Quy trình: xác nhận → gửi thay thế → trả hàng cũ.", options: [ { key: "A", text: "対象外なので通常サポートを案内する。", isCorrect: false }, { key: "B", text: "リコール対象であることを確認し、交換品の手配と着払い返送の手続きを進める。", isCorrect: true }, { key: "C", text: "修理のみ対応し、交換はしない。", isCorrect: false }, { key: "D", text: "メーカーに直接連絡するよう案内する。", isCorrect: false } ], tags: ["recall", "customer_support"], businessSituation: "complaint", stimulusKind: "document" },
  ];
}

function rcVocabGrammarQuestions(): SeedQ[] {
  return [
    { prompt: "「本件について（　　）検討いたします。」空欄に入る最も適切な語を選んでください。", scenario: "ビジネスメールでの丁寧な表現。", explanationVi: "'Xem xét kỹ lưỡng' → 慎重に.", options: [ { key: "A", text: "慎重に", isCorrect: true }, { key: "B", text: "大胆に", isCorrect: false }, { key: "C", text: "簡単に", isCorrect: false }, { key: "D", text: "適当に", isCorrect: false } ], tags: ["vocabulary", "email"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「市場動向を（　　）した上で、新規事業計画を策定する予定です。」空欄に入る最も適切な語を選んでください。", scenario: "事業計画に関する報告書。", explanationVi: "'Sau khi phân tích xu hướng thị trường' → 分析.", options: [ { key: "A", text: "無視", isCorrect: false }, { key: "B", text: "分析", isCorrect: true }, { key: "C", text: "放棄", isCorrect: false }, { key: "D", text: "圧縮", isCorrect: false } ], tags: ["vocabulary", "business_planning"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「取締役会の決議（　　）、人事異動を発表いたします。」空欄に入る最も適切な表現を選んでください。", scenario: "公式な社内告知文。", explanationVi: "'Dựa trên nghị quyết' → に基づき.", options: [ { key: "A", text: "にもかかわらず", isCorrect: false }, { key: "B", text: "に反して", isCorrect: false }, { key: "C", text: "に基づき", isCorrect: true }, { key: "D", text: "を無視して", isCorrect: false } ], tags: ["grammar", "formal"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「この度、貴社との取引を開始（　　）運びとなりました。」空欄に入る最も適切な表現を選んでください。", scenario: "新規取引先への挨拶文。", explanationVi: "'Được bắt đầu giao dịch' → させていただく (kính ngữ).", options: [ { key: "A", text: "させていただく", isCorrect: true }, { key: "B", text: "してやる", isCorrect: false }, { key: "C", text: "するかもしれない", isCorrect: false }, { key: "D", text: "してほしい", isCorrect: false } ], tags: ["keigo", "business_letter"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「競合他社の動きを（　　）しつつ、自社の強みを活かした戦略を構築する必要がある。」空欄に入る最も適切な語を選んでください。", scenario: "経営戦略に関する議論。", explanationVi: "'Theo dõi chặt chẽ đối thủ' → 注視.", options: [ { key: "A", text: "注視", isCorrect: true }, { key: "B", text: "無視", isCorrect: false }, { key: "C", text: "黙殺", isCorrect: false }, { key: "D", text: "楽観", isCorrect: false } ], tags: ["vocabulary", "strategy"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "「顧客の個人情報は厳重に管理し、（　　）第三者に開示してはならない。」空欄に入る最も適切な表現を選んでください。", scenario: "個人情報保護に関する社内規定。", explanationVi: "'Không được bừa bãi tiết lộ' → みだりに.", options: [ { key: "A", text: "積極的に", isCorrect: false }, { key: "B", text: "みだりに", isCorrect: true }, { key: "C", text: "速やかに", isCorrect: false }, { key: "D", text: "丁寧に", isCorrect: false } ], tags: ["vocabulary", "compliance"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「本提案は、御社の課題を（　　）解決するためのものです。」空欄に入る最も適切な語を選んでください。", scenario: "取引先への提案書。", explanationVi: "'Giải quyết triệt để' → 抜本的に.", options: [ { key: "A", text: "一時的に", isCorrect: false }, { key: "B", text: "表面的に", isCorrect: false }, { key: "C", text: "抜本的に", isCorrect: true }, { key: "D", text: "部分的に", isCorrect: false } ], tags: ["vocabulary", "proposal"], businessSituation: "sales_customer", stimulusKind: "text" },
  ];
}

function rcExpressionQuestions(): SeedQ[] {
  return [
    { prompt: "以下のビジネスメールを読んで、送信者の意図として最も適切なものを選んでください。\n\n「先日のお打ち合わせでは大変有意義なお話を伺うことができました。ご提案いただいた件につきましては、社内で前向きに検討しております。近日中に改めてご連絡を差し上げたいと存じます。」", scenario: "取引先へのフォローアップメールの意図を読み解く場面。", explanationVi: "Đang xem xét tích cực, sẽ liên lạc lại sớm = quan tâm nhưng chưa quyết.", options: [ { key: "A", text: "提案を断ろうとしている。", isCorrect: false }, { key: "B", text: "提案に関心があり、検討中であることを丁寧に伝えている。", isCorrect: true }, { key: "C", text: "すぐに契約したいと考えている。", isCorrect: false }, { key: "D", text: "別の会社に依頼する予定である。", isCorrect: false } ], tags: ["email", "reading_comprehension"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下の社内通達の最も重要なメッセージを選んでください。\n\n「昨今の情報セキュリティ事案の増加を踏まえ、来月1日より、社外へのファイル送信時にはすべて暗号化を義務付けます。詳細はイントラネットの『セキュリティガイドライン2026』をご参照ください。」", scenario: "社内セキュリティポリシーの変更通達を理解する場面。", explanationVi: "Thông điệp quan trọng: tất cả file gửi bên ngoài phải được mã hóa từ tháng sau.", options: [ { key: "A", text: "IT部門の連絡先が変わった。", isCorrect: false }, { key: "B", text: "社外へのファイル送信時の暗号化が必須となること。", isCorrect: true }, { key: "C", text: "イントラネットがリニューアルされた。", isCorrect: false }, { key: "D", text: "情報セキュリティ事案は減少している。", isCorrect: false } ], tags: ["security", "policy"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "以下のクレーム回答メールの対応の特徴として最も適切なものを選んでください。\n\n「この度はご期待に沿えない結果となり、深くお詫び申し上げます。ご指摘の点につきましては、担当部署で原因を調査し、再発防止策を講じてまいります。改善結果につきましては、来週中にご報告させていただきます。」", scenario: "クレーム対応メールの品質を評価する場面。", explanationVi: "Xin lỗi → điều tra → phòng ngừa → báo cáo = quy trình chuẩn.", options: [ { key: "A", text: "責任を回避している。", isCorrect: false }, { key: "B", text: "謝罪、原因調査、再発防止、報告予定を含む適切なクレーム対応の流れに沿っている。", isCorrect: true }, { key: "C", text: "顧客に責任を転嫁している。", isCorrect: false }, { key: "D", text: "問題を認めていない。", isCorrect: false } ], tags: ["complaint_handling", "email"], businessSituation: "complaint", stimulusKind: "text" },
    { prompt: "以下の議事録要約を読んで、次回までのアクションアイテムとして正しいものを選んでください。\n\n「新商品パッケージデザインについて3案を比較検討。コスト面ではA案が最安だが、ブランドイメージの観点からB案を推す意見が多数。最終決定は来週。担当者はB案のコスト削減案を準備すること。」", scenario: "会議議事録を読んで次のアクションを把握する場面。", explanationVi: "Action: chuẩn bị phương án giảm chi phí cho B trước tuần sau.", options: [ { key: "A", text: "A案を採用する準備をする。", isCorrect: false }, { key: "B", text: "B案のコスト削減案を来週の会議までに準備する。", isCorrect: true }, { key: "C", text: "新しいC案を作成する。", isCorrect: false }, { key: "D", text: "パッケージデザインの外注先を探す。", isCorrect: false } ], tags: ["meeting_minutes", "action_items"], businessSituation: "meeting", stimulusKind: "text" },
  ];
}

function rcIntegratedQuestions(): SeedQ[] {
  return [
    { prompt: "以下の3つの文書を読んで判断してください。\n\n①社長メッセージ：「DX推進は最重要課題。全部門でデジタル化を加速する。」\n②IT部門報告：「クラウド移行には18か月と5億円が必要。」\n③財務部：「今期の設備投資予算は3億円。追加は来期の業績次第。」\n\n最も現実的なDX推進アプローチはどれですか。", scenario: "DX推進に関する複数部門の見解を統合する場面。", explanationVi: "Ngân sách 3 tỷ, cần 5 tỷ. Cách thực tế: ưu tiên module quan trọng, triển khai giai đoạn.", options: [ { key: "A", text: "5億円の追加予算をすぐに確保する。", isCorrect: false }, { key: "B", text: "今期の3億円で最も効果の高い領域から段階的にクラウド移行を開始し、来期に残りを実施する計画を策定する。", isCorrect: true }, { key: "C", text: "DX推進を来期に延期する。", isCorrect: false }, { key: "D", text: "現在のシステムをそのまま使い続ける。", isCorrect: false } ], tags: ["DX", "strategy"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "以下の情報から企業の経営課題を分析してください。\n\n年次報告書：「売上高：前年比5%増。営業利益：前年比10%減。従業員数：前年比3%減。」\n社長：「人材への投資を強化し、生産性向上を図る。」\nアナリスト：「売上は成長しているが、コスト構造の改善が急務。」\n\n最も核心的な経営課題はどれですか。", scenario: "企業分析。複数情報源から経営課題を特定する場面。", explanationVi: "Doanh thu +5%, lợi nhuận -10%, nhân sự -3%. Vấn đề: cấu trúc chi phí.", options: [ { key: "A", text: "売上高の減少。", isCorrect: false }, { key: "B", text: "売上成長にもかかわらず利益率が悪化しており、コスト構造の改善と生産性向上が急務である。", isCorrect: true }, { key: "C", text: "従業員の満足度の低下。", isCorrect: false }, { key: "D", text: "新規事業への参入の遅れ。", isCorrect: false } ], tags: ["business_analysis", "finance"], businessSituation: "report_document", stimulusKind: "document" },
    { prompt: "法令改正通知、業界ガイドライン、自社規程を比較してください。\n\n法令：「2026年7月より、月間残業上限45時間に厳格化。違反企業に罰則。」\n業界：「月40時間以内を推奨。36協定の見直しを推奨。」\n自社：「月間残業上限60時間。特別条項80時間まで。」\n\n最も緊急な対応はどれですか。", scenario: "労働法改正に伴う社内規程の見直し場面。", explanationVi: "Luật mới: max 45h/tháng. Quy định hiện tại: 60h. Sửa đổi ngay.", options: [ { key: "A", text: "業界ガイドラインの40時間を参考に社内目標を設定する。", isCorrect: false }, { key: "B", text: "自社の月間残業上限を法令改正に合わせて45時間以内に引き下げ、36協定を改定する。", isCorrect: true }, { key: "C", text: "特別条項の適用範囲を拡大する。", isCorrect: false }, { key: "D", text: "現行規程のまま様子を見る。", isCorrect: false } ], tags: ["compliance", "labor_law"], businessSituation: "report_document", stimulusKind: "document" },
    { prompt: "顧客満足度調査、販売データ、キャンペーン報告を統合して判断してください。\n\n調査：「品質満足度92%。価格の適正感68%。アフターサービス75%。」\n販売：「リピート率：前年比5%低下。新規獲得：前年比10%増。」\nキャンペーン：「新規獲得ROI 350%。リテンション施策は未実施。」\n\n最も優先すべき改善領域はどれですか。", scenario: "顧客データの統合分析場面。", explanationVi: "Chất lượng OK, nhưng tỷ lệ mua lại giảm, chưa có chiến dịch giữ chân. Ưu tiên: retention.", options: [ { key: "A", text: "製品品質のさらなる向上。", isCorrect: false }, { key: "B", text: "新規顧客獲得キャンペーンの強化。", isCorrect: false }, { key: "C", text: "既存顧客のリテンション施策（価格の適正感向上、アフターサービス改善）を最優先で実施する。", isCorrect: true }, { key: "D", text: "マーケティング予算の全面削減。", isCorrect: false } ], tags: ["customer_retention", "marketing"], businessSituation: "report_document", stimulusKind: "document" },
  ];
}

function getQuestionsForSection(code: string): SeedQ[] {
  switch (code) {
    case "LC_SCENE": return lcSceneQuestions();
    case "LC_STATEMENT": return lcStatementQuestions();
    case "LC_INTEGRATED": return lcIntegratedQuestions();
    case "LR_SITUATION": return lrSituationQuestions();
    case "LR_DOCUMENT": return lrDocumentQuestions();
    case "LR_INTEGRATED": return lrIntegratedQuestions();
    case "RC_VOCAB_GRAMMAR": return rcVocabGrammarQuestions();
    case "RC_EXPRESSION": return rcExpressionQuestions();
    case "RC_INTEGRATED": return rcIntegratedQuestions();
    default: return [];
  }
}

// ===================== MAIN =====================

async function main() {
  console.log("=== BJT Seed Exam Recreate ===\n");

  // 1. Delete old empty seed exams (clean up FK dependents first)
  console.log("1. Deleting empty seed-bjt-* exams...");
  const seedExams = await prisma.bjtMockTest.findMany({
    where: { slug: { startsWith: "seed-bjt-" } },
    include: {
      sections: {
        include: { questions: { select: { id: true } } },
      },
    },
  });

  for (const exam of seedExams) {
    const questionIds = exam.sections.flatMap((s) => s.questions.map((q) => q.id));

    if (questionIds.length > 0) {
      // Delete battle_rounds referencing these questions
      const br = await prisma.battleRound.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      if (br.count) console.log(`  Deleted ${br.count} battle_rounds for ${exam.slug}`);

      // Delete quiz_answers referencing these questions
      const qa = await prisma.quizAnswer.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      if (qa.count) console.log(`  Deleted ${qa.count} quiz_answers for ${exam.slug}`);
    }

    // Delete quiz_sessions referencing this exam (Restrict FK)
    const qs = await prisma.quizSession.deleteMany({
      where: { testId: exam.id },
    });
    if (qs.count) console.log(`  Deleted ${qs.count} quiz_sessions for ${exam.slug}`);

    // Now safe to delete (CASCADE: sections → questions → options)
    await prisma.bjtMockTest.delete({ where: { id: exam.id } });
    console.log(`  Deleted: ${exam.slug} (${questionIds.length} questions cleaned)`);
  }
  console.log(`  Total deleted: ${seedExams.length}\n`);

  // 2. Create new Set 2 exams
  console.log("2. Creating new Set 2 exams with full BJT format...\n");
  let totalQuestions = 0;
  let totalOptions = 0;

  for (const level of BJT_LEVELS) {
    const existing = await prisma.bjtMockTest.findFirst({
      where: { slug: level.slug },
    });
    if (existing) {
      console.log(`  ⏭ ${level.slug} already exists — skipping`);
      continue;
    }

    const exam = await prisma.bjtMockTest.create({
      data: {
        slug: level.slug,
        titleVi: `Đề luyện BJT chuẩn ${level.titleSuffix} — Bộ 2`,
        titleJa: `BJT標準模擬試験 ${level.titleSuffix}（第2回）`,
        type: "mock",
        status: "published",
        level: level.code,
        timeLimitSeconds: 6300,
        description: `NihonGo BJT production exam set 2 for ${level.code}. Full BJT format: 3 parts, 9 sections, 50 questions, 105 minutes.`,
        blueprintMeta: buildBlueprintMeta(level.code) as any,
      },
    });

    console.log(`  Created exam: ${level.slug} (${exam.id})`);

    for (const sec of SECTIONS) {
      const section = await prisma.bjtTestSection.create({
        data: {
          testId: exam.id,
          code: sec.code,
          titleVi: sec.titleVi,
          titleJa: sec.titleJa,
          displayOrder: sec.order,
        },
      });

      const questions = getQuestionsForSection(sec.code);

      for (const q of questions) {
        const question = await prisma.bjtQuestion.create({
          data: {
            sectionId: section.id,
            prompt: q.prompt,
            scenario: q.scenario,
            explanationVi: q.explanationVi,
            skillTag: q.tags[0] ?? "general",
            difficulty: level.diff,
            sourceType: SEED_PROVENANCE,
            status: "published",
            qualityFlags: {
              bjtPart: sec.part,
              bjtSection: sec.code,
              businessSituation: q.businessSituation,
              stimulusKind: q.stimulusKind,
              stimulusRequired: sec.stimulusRequired,
              hasAudioStimulus: false,
              hasVisualStimulus: false,
              distractorQuality: "generated",
              difficultySource: "estimated",
              itemReviewed: false,
              license: SEED_LICENSE,
              level: level.code,
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
          totalOptions++;
        }
        totalQuestions++;
      }

      console.log(`    ${sec.code}: ${questions.length} questions`);
    }
    console.log();
  }

  // 3. Verification
  console.log("3. Verification...");
  for (const level of BJT_LEVELS) {
    const verify = await prisma.bjtMockTest.findFirst({
      where: { slug: level.slug },
      include: {
        sections: {
          orderBy: { displayOrder: "asc" },
          include: { _count: { select: { questions: true } } },
        },
      },
    });
    if (verify) {
      const totalQ = verify.sections.reduce((s, sec) => s + sec._count.questions, 0);
      const hasBP = !!(verify.blueprintMeta as any)?.parts?.length;
      console.log(`  ${verify.slug}: ${totalQ} questions, ${verify.sections.length} sections, bp=${hasBP}, time=${verify.timeLimitSeconds}s`);
    }
  }

  console.log(`\n✅ Done! Created ${totalQuestions} questions, ${totalOptions} options.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
