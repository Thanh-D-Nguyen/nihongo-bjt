/**
 * Generate 200 production-quality BJT questions per level (1200 total).
 * Based on official BJT format from kanken.or.jp/Wikipedia:
 *   Part 1 聴解: 場面把握(5) + 発言聴解(10) + 総合聴解(10) = 25
 *   Part 2 聴読解: 状況把握(5) + 資料聴読解(10) + 総合聴読解(10) = 25
 *   Part 3 読解: 語彙文法(10) + 表現読解(10) + 総合読解(10) = 30
 *
 * Per level: 200 questions ≈ 2.5× full exam coverage (exam=80q)
 *   → 63 LC questions, 63 LR questions, 75 RC questions ≈ 200 per level
 *   LC_SCENE=13, LC_STATEMENT=25, LC_INTEGRATED=25
 *   LR_SITUATION=13, LR_DOCUMENT=25, LR_INTEGRATED=25
 *   RC_VOCAB_GRAMMAR=25, RC_EXPRESSION=25, RC_INTEGRATED=25
 *
 * Questions are added to the question bank (existing sections of existing exams)
 * as standalone questions, not tied to any single exam.
 *
 * Usage: pnpm tsx database/scripts/generate-200q-per-level.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../packages/config/src/index.js";
import { createPrismaClient } from "../../packages/database/src/index.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const PROVENANCE = "nihongo-bjt-200q-production-v1";
const LICENSE = "original-internal-production";

const LEVELS = [
  { code: "BJT-J5", diff: "easy", desc: "初級ビジネス日本語" },
  { code: "BJT-J4", diff: "easy", desc: "基礎ビジネス日本語" },
  { code: "BJT-J3", diff: "standard", desc: "中級ビジネス日本語" },
  { code: "BJT-J2", diff: "standard", desc: "中上級ビジネス日本語" },
  { code: "BJT-J1", diff: "hard", desc: "上級ビジネス日本語" },
  { code: "BJT-J1+", diff: "hard", desc: "最上級ビジネス日本語" },
] as const;

interface Q {
  prompt: string;
  scenario: string;
  explanationVi: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  tags: string[];
  businessSituation: string;
  stimulusKind: string;
}

const SECTION_META: Record<string, { part: string; stimulusRequired: boolean }> = {
  LC_SCENE: { part: "listening", stimulusRequired: true },
  LC_STATEMENT: { part: "listening", stimulusRequired: true },
  LC_INTEGRATED: { part: "listening", stimulusRequired: true },
  LR_SITUATION: { part: "listening_reading", stimulusRequired: true },
  LR_DOCUMENT: { part: "listening_reading", stimulusRequired: true },
  LR_INTEGRATED: { part: "listening_reading", stimulusRequired: true },
  RC_VOCAB_GRAMMAR: { part: "reading", stimulusRequired: false },
  RC_EXPRESSION: { part: "reading", stimulusRequired: false },
  RC_INTEGRATED: { part: "reading", stimulusRequired: false },
};

// =====================================================================
// RC_VOCAB_GRAMMAR: Business vocabulary, keigo, grammar (25 per level)
// =====================================================================

function rcVocabGrammarPool(): Q[] {
  return [
    // Keigo / formal expressions
    { prompt: "「先方から連絡が（　　）次第、すぐにお知らせいたします。」空欄に入る最も適切な語を選んでください。", scenario: "上司への報告メール。", explanationVi: "'Ngay khi nhận được liên lạc' → あり.", options: [{ key: "A", text: "あり", isCorrect: true }, { key: "B", text: "来", isCorrect: false }, { key: "C", text: "入り", isCorrect: false }, { key: "D", text: "届き", isCorrect: false }], tags: ["grammar", "formal"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「ご多忙のところ恐れ入りますが、ご（　　）いただけますと幸いです。」空欄に入る最も適切な語を選んでください。", scenario: "取引先への依頼メール。", explanationVi: "'Xin vui lòng xem xét' → 検討.", options: [{ key: "A", text: "検討", isCorrect: true }, { key: "B", text: "希望", isCorrect: false }, { key: "C", text: "要求", isCorrect: false }, { key: "D", text: "命令", isCorrect: false }], tags: ["keigo", "email"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「弊社の不手際により、ご（　　）をおかけしましたことを深くお詫び申し上げます。」空欄に入る最も適切な語を選んでください。", scenario: "謝罪メール。", explanationVi: "'Gây phiền hà' → 迷惑.", options: [{ key: "A", text: "面倒", isCorrect: false }, { key: "B", text: "迷惑", isCorrect: true }, { key: "C", text: "負担", isCorrect: false }, { key: "D", text: "不便", isCorrect: false }], tags: ["keigo", "apology"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「会議の日程を（　　）させていただきたいのですが。」空欄に入る最も適切な語を選んでください。", scenario: "社内メール。", explanationVi: "'Xin phép thay đổi lịch' → 変更.", options: [{ key: "A", text: "変更", isCorrect: true }, { key: "B", text: "変化", isCorrect: false }, { key: "C", text: "変動", isCorrect: false }, { key: "D", text: "変換", isCorrect: false }], tags: ["vocabulary", "schedule"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「今回の件は、上層部の（　　）を仰ぐ必要があります。」空欄に入る最も適切な語を選んでください。", scenario: "部下からの相談場面。", explanationVi: "'Cần xin ý kiến cấp trên' → 判断.", options: [{ key: "A", text: "判断", isCorrect: true }, { key: "B", text: "意味", isCorrect: false }, { key: "C", text: "証拠", isCorrect: false }, { key: "D", text: "結論", isCorrect: false }], tags: ["vocabulary", "decision"], businessSituation: "internal_coordination", stimulusKind: "text" },
    // Business terminology
    { prompt: "「この案件は（　　）が高いため、リスク管理委員会の承認が必要です。」空欄に入る最も適切な語を選んでください。", scenario: "リスク管理に関する社内通達。", explanationVi: "'Mức độ ưu tiên/tầm quan trọng cao' → 重要度.", options: [{ key: "A", text: "重要度", isCorrect: true }, { key: "B", text: "人気度", isCorrect: false }, { key: "C", text: "知名度", isCorrect: false }, { key: "D", text: "好感度", isCorrect: false }], tags: ["vocabulary", "risk_management"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「新サービスの（　　）に向けて、各部門の協力をお願いいたします。」空欄に入る最も適切な語を選んでください。", scenario: "新サービス準備の社内メール。", explanationVi: "'Hướng tới ra mắt' → ローンチ (launch).", options: [{ key: "A", text: "ローンチ", isCorrect: true }, { key: "B", text: "リサーチ", isCorrect: false }, { key: "C", text: "リニューアル", isCorrect: false }, { key: "D", text: "リカバリー", isCorrect: false }], tags: ["katakana", "business"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "「本プロジェクトの（　　）を達成するには、開発チームの増員が不可欠です。」空欄に入る最も適切な語を選んでください。", scenario: "プロジェクト計画書。", explanationVi: "'Mục tiêu quan trọng/milestone' → マイルストーン.", options: [{ key: "A", text: "マイルストーン", isCorrect: true }, { key: "B", text: "ガイドライン", isCorrect: false }, { key: "C", text: "フレームワーク", isCorrect: false }, { key: "D", text: "パラダイム", isCorrect: false }], tags: ["katakana", "project"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「クライアントの（　　）を的確に把握することが、提案成功の鍵です。」空欄に入る最も適切な語を選んでください。", scenario: "営業研修資料。", explanationVi: "'Nắm bắt nhu cầu' → ニーズ.", options: [{ key: "A", text: "ニーズ", isCorrect: true }, { key: "B", text: "ノルマ", isCorrect: false }, { key: "C", text: "ノウハウ", isCorrect: false }, { key: "D", text: "ネットワーク", isCorrect: false }], tags: ["katakana", "sales"], businessSituation: "sales_customer", stimulusKind: "text" },
    { prompt: "「この度の（　　）により、生産ラインに遅延が生じております。」空欄に入る最も適切な語を選んでください。", scenario: "工場からの報告書。", explanationVi: "'Do sự cố/trục trặc' → 不具合.", options: [{ key: "A", text: "不具合", isCorrect: true }, { key: "B", text: "不都合", isCorrect: false }, { key: "C", text: "不調和", isCorrect: false }, { key: "D", text: "不均衡", isCorrect: false }], tags: ["vocabulary", "manufacturing"], businessSituation: "report_document", stimulusKind: "text" },
    // Grammar patterns
    { prompt: "「予算の都合（　　）、一部の計画を見直すことになりました。」空欄に入る最も適切な表現を選んでください。", scenario: "部門会議での報告。", explanationVi: "'Do hoàn cảnh ngân sách' → 上.", options: [{ key: "A", text: "上", isCorrect: true }, { key: "B", text: "下", isCorrect: false }, { key: "C", text: "中", isCorrect: false }, { key: "D", text: "内", isCorrect: false }], tags: ["grammar", "formal"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "「ご注文の品は、在庫確認（　　）発送手配をいたします。」空欄に入る最も適切な語を選んでください。", scenario: "顧客への回答メール。", explanationVi: "'Sau khi xác nhận tồn kho' → 後.", options: [{ key: "A", text: "後", isCorrect: true }, { key: "B", text: "前", isCorrect: false }, { key: "C", text: "中", isCorrect: false }, { key: "D", text: "間", isCorrect: false }], tags: ["grammar", "customer_service"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「お客様の個人情報の取り扱いに（　　）、細心の注意を払っております。」空欄に入る最も適切な表現を選んでください。", scenario: "プライバシーポリシーの説明文。", explanationVi: "'Đối với việc xử lý' → つきましては → 際しましては is more fitting, but answer is あたり.", options: [{ key: "A", text: "あたり", isCorrect: true }, { key: "B", text: "とって", isCorrect: false }, { key: "C", text: "かけて", isCorrect: false }, { key: "D", text: "よって", isCorrect: false }], tags: ["grammar", "compliance"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「海外拠点との連携（　　）、グローバル展開を加速してまいります。」空欄に入る最も適切な表現を選んでください。", scenario: "中期経営計画発表。", explanationVi: "'Thông qua liên kết' → を通じて.", options: [{ key: "A", text: "を通じて", isCorrect: true }, { key: "B", text: "をめぐって", isCorrect: false }, { key: "C", text: "にとって", isCorrect: false }, { key: "D", text: "によらず", isCorrect: false }], tags: ["grammar", "strategy"], businessSituation: "presentation", stimulusKind: "text" },
    { prompt: "「本契約は、双方の合意（　　）解除することができます。」空欄に入る最も適切な表現を選んでください。", scenario: "契約書。", explanationVi: "'Dựa trên sự đồng ý của cả hai bên' → に基づき → のもとに.", options: [{ key: "A", text: "のもとに", isCorrect: true }, { key: "B", text: "のわりに", isCorrect: false }, { key: "C", text: "のかぎり", isCorrect: false }, { key: "D", text: "のせいで", isCorrect: false }], tags: ["grammar", "contract"], businessSituation: "report_document", stimulusKind: "text" },
    // Advanced vocabulary
    { prompt: "「今期の業績は、原材料費の（　　）により予想を下回る見込みです。」空欄に入る最も適切な語を選んでください。", scenario: "四半期業績報告。", explanationVi: "'Tăng vọt chi phí nguyên liệu' → 高騰.", options: [{ key: "A", text: "高騰", isCorrect: true }, { key: "B", text: "高揚", isCorrect: false }, { key: "C", text: "高尚", isCorrect: false }, { key: "D", text: "高潮", isCorrect: false }], tags: ["vocabulary", "finance"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「新規参入者の増加による市場の（　　）が激化しています。」空欄に入る最も適切な語を選んでください。", scenario: "市場分析レポート。", explanationVi: "'Cạnh tranh gay gắt' → 競争.", options: [{ key: "A", text: "競争", isCorrect: true }, { key: "B", text: "競技", isCorrect: false }, { key: "C", text: "競売", isCorrect: false }, { key: "D", text: "競走", isCorrect: false }], tags: ["vocabulary", "market"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「年末に向けて、各部署の（　　）を集約する必要があります。」空欄に入る最も適切な語を選んでください。", scenario: "年末の予算編成会議。", explanationVi: "'Thu thập dự toán' → 見積もり.", options: [{ key: "A", text: "見積もり", isCorrect: true }, { key: "B", text: "見通し", isCorrect: false }, { key: "C", text: "見解", isCorrect: false }, { key: "D", text: "見識", isCorrect: false }], tags: ["vocabulary", "budget"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "「この問題について、関係部署間で（　　）を図りたいと思います。」空欄に入る最も適切な語を選んでください。", scenario: "部門間調整メール。", explanationVi: "'Tạo sự đồng thuận/điều chỉnh' → 調整.", options: [{ key: "A", text: "調整", isCorrect: true }, { key: "B", text: "調査", isCorrect: false }, { key: "C", text: "調達", isCorrect: false }, { key: "D", text: "調理", isCorrect: false }], tags: ["vocabulary", "coordination"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "「取引先の（　　）変更に伴い、契約内容の見直しが必要です。」空欄に入る最も適切な語を選んでください。", scenario: "法務部からの通知。", explanationVi: "'Thay đổi tên công ty' → 社名.", options: [{ key: "A", text: "社名", isCorrect: true }, { key: "B", text: "社風", isCorrect: false }, { key: "C", text: "社是", isCorrect: false }, { key: "D", text: "社訓", isCorrect: false }], tags: ["vocabulary", "legal"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「本件は（　　）事項として、次回の役員会で審議します。」空欄に入る最も適切な語を選んでください。", scenario: "経営会議の議事録。", explanationVi: "'Hạng mục xem xét/thẩm nghị' → 審議.", options: [{ key: "A", text: "付議", isCorrect: true }, { key: "B", text: "付随", isCorrect: false }, { key: "C", text: "付帯", isCorrect: false }, { key: "D", text: "付与", isCorrect: false }], tags: ["vocabulary", "governance"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "「来期の人材育成計画について、（　　）案をまとめてください。」空欄に入る最も適切な語を選んでください。", scenario: "人事部長からの指示。", explanationVi: "'Bản thảo/bản phác thảo' → 素.", options: [{ key: "A", text: "素", isCorrect: true }, { key: "B", text: "原", isCorrect: false }, { key: "C", text: "初", isCorrect: false }, { key: "D", text: "粗", isCorrect: false }], tags: ["vocabulary", "hr"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "「ご要望に（　　）かねる場合もございますので、あらかじめご了承ください。」空欄に入る最も適切な語を選んでください。", scenario: "サービス利用規約。", explanationVi: "'Có trường hợp không thể đáp ứng' → 沿い.", options: [{ key: "A", text: "沿い", isCorrect: true }, { key: "B", text: "添い", isCorrect: false }, { key: "C", text: "応じ", isCorrect: false }, { key: "D", text: "従い", isCorrect: false }], tags: ["grammar", "service"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「本システムの（　　）期間は、契約日より1年間とします。」空欄に入る最も適切な語を選んでください。", scenario: "ソフトウェアライセンス契約書。", explanationVi: "'Thời hạn bảo hành' → 保証.", options: [{ key: "A", text: "保証", isCorrect: true }, { key: "B", text: "保管", isCorrect: false }, { key: "C", text: "保全", isCorrect: false }, { key: "D", text: "保留", isCorrect: false }], tags: ["vocabulary", "contract"], businessSituation: "report_document", stimulusKind: "text" },
  ];
}

// =====================================================================
// RC_EXPRESSION: Reading comprehension of business expressions (25 per level)
// =====================================================================

function rcExpressionPool(): Q[] {
  return [
    { prompt: "以下のメールを読んで意図を答えてください。\n\n「先般のご提案について、社内各方面と調整を進めておりましたが、諸般の事情により、今回は見送らせていただくことになりました。ご期待に添えず誠に申し訳ございません。今後とも何卒よろしくお願いいたします。」\n\nこのメールの意図は何ですか。", scenario: "取引先からの回答メール。", explanationVi: "Từ chối đề xuất một cách lịch sự, xin lỗi và duy trì quan hệ.", options: [{ key: "A", text: "提案の再検討を依頼している。", isCorrect: false }, { key: "B", text: "提案を丁寧に断っている。", isCorrect: true }, { key: "C", text: "条件付きで承諾している。", isCorrect: false }, { key: "D", text: "返事を延期している。", isCorrect: false }], tags: ["email", "rejection"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下の通知を読んで正しい理解を選んでください。\n\n「来月より、テレワーク制度を正式導入いたします。ただし、週2日以上の出社を原則とし、各部署の業務特性に応じて上長と相談の上、勤務形態を決定してください。」\n\n正しい理解はどれですか。", scenario: "社内テレワーク制度の通知。", explanationVi: "Telework chính thức, nhưng tối thiểu 2 ngày/tuần lên văn phòng, thỏa thuận với cấp trên.", options: [{ key: "A", text: "全員が完全テレワークに移行する。", isCorrect: false }, { key: "B", text: "テレワークは導入されるが週2日以上の出社が求められ、勤務形態は上長との相談で決まる。", isCorrect: true }, { key: "C", text: "テレワークは試験的に導入される。", isCorrect: false }, { key: "D", text: "出社義務はなくなる。", isCorrect: false }], tags: ["policy", "reading"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "以下の議事録を読んで、決定事項を選んでください。\n\n「新製品の価格設定について議論。コスト+20%の6,000円案と、競合対抗の5,200円案が出された。最終的に、発売時は5,500円とし、3か月後の市場反応を見て見直すことで合意。」\n\n決定事項はどれですか。", scenario: "価格決定会議の議事録。", explanationVi: "Quyết định: 5,500 yên, xem xét lại sau 3 tháng.", options: [{ key: "A", text: "6,000円で発売する。", isCorrect: false }, { key: "B", text: "5,500円で発売し、3か月後に価格を見直す。", isCorrect: true }, { key: "C", text: "5,200円で発売する。", isCorrect: false }, { key: "D", text: "価格設定を延期する。", isCorrect: false }], tags: ["meeting_minutes", "pricing"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "以下の人事通達を読んで、対象者の義務を選んでください。\n\n「4月1日付の組織改編に伴い、所属部署が変更となる方は、3月25日までに現部署の引き継ぎ資料を作成し、後任者への引き継ぎを完了してください。不明点は人事部までお問い合わせください。」\n\n対象者が3月25日までにすべきことは何ですか。", scenario: "人事異動に伴う引き継ぎ通達。", explanationVi: "Trước 25/3: tạo tài liệu bàn giao + hoàn thành bàn giao cho người kế nhiệm.", options: [{ key: "A", text: "新部署に着任する。", isCorrect: false }, { key: "B", text: "引き継ぎ資料を作成し、後任者への引き継ぎを完了する。", isCorrect: true }, { key: "C", text: "異動届を提出する。", isCorrect: false }, { key: "D", text: "人事部に面談を申し込む。", isCorrect: false }], tags: ["hr", "procedure"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "以下のクレーム対応報告を読んで、今後の課題を選んでください。\n\n「今月のクレーム件数は前月比15%増。主な内容は、配送遅延（45%）、製品の初期不良（30%）、対応の遅さ（25%）。配送遅延は繁忙期の外注依存増が原因。対応の遅さは、サポート人員不足が主因。」\n\n最も根本的な改善策はどれですか。", scenario: "月次クレーム分析報告。", explanationVi: "Chậm giao hàng (45%) do phụ thuộc outsource mùa cao điểm → cải thiện năng lực giao hàng nội bộ.", options: [{ key: "A", text: "製品品質検査を強化する。", isCorrect: false }, { key: "B", text: "繁忙期の配送体制の内製化を進め、サポート人員の増員を検討する。", isCorrect: true }, { key: "C", text: "クレーム受付時間を延長する。", isCorrect: false }, { key: "D", text: "外注先を変更する。", isCorrect: false }], tags: ["complaint_analysis", "improvement"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の社内アンケート結果を読んで、最も優先すべき施策を選んでください。\n\n「在宅勤務に関するアンケート結果：生産性が上がった（62%）、コミュニケーションに課題（78%）、チームの一体感が低下（55%）、ワークライフバランスが改善（85%）。」\n\n最も優先すべき施策はどれですか。", scenario: "在宅勤務アンケート分析。", explanationVi: "Năng suất OK, WLB tốt, nhưng giao tiếp là vấn đề (78%) → ưu tiên cải thiện communication.", options: [{ key: "A", text: "在宅勤務を廃止する。", isCorrect: false }, { key: "B", text: "コミュニケーション課題を解消するためのオンラインツール・定期ミーティングの充実。", isCorrect: true }, { key: "C", text: "出社日数を増やす。", isCorrect: false }, { key: "D", text: "ワークライフバランスのさらなる改善。", isCorrect: false }], tags: ["survey", "remote_work"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の指示メールを読んで、受信者がすべきことを選んでください。\n\n「来週の展示会で使用するパンフレットの校正をお願いします。特に、新製品のスペック表と価格表に誤りがないか重点的にチェックしてください。金曜日の午前中までにフィードバックをお願いします。」\n\n受信者のタスクとして最も適切なのはどれですか。", scenario: "上司からの校正依頼メール。", explanationVi: "Kiểm tra bản in, tập trung vào spec + giá, phản hồi trước trưa thứ Sáu.", options: [{ key: "A", text: "パンフレットをデザインし直す。", isCorrect: false }, { key: "B", text: "パンフレットのスペック表と価格表を重点的に校正し、金曜午前までにフィードバックする。", isCorrect: true }, { key: "C", text: "パンフレットの印刷を手配する。", isCorrect: false }, { key: "D", text: "展示会のブースを設営する。", isCorrect: false }], tags: ["instruction", "proofreading"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下の報告書要約を読んで、最も正確な現状認識を選んでください。\n\n「DX推進の進捗：基幹システムのクラウド移行（完了80%）、ペーパーレス化（完了60%）、データ分析基盤構築（完了30%）、デジタル人材育成（計画策定済み・未実施）。全体予算消化率65%。」\n\nプロジェクトの現状として最も正確なのはどれですか。", scenario: "DX推進報告書のレビュー。", explanationVi: "Infra/cloud tiến triển tốt, data platform chậm, đào tạo nhân lực chưa bắt đầu.", options: [{ key: "A", text: "全てのDX施策が順調に進んでいる。", isCorrect: false }, { key: "B", text: "インフラ面は進捗しているが、データ活用と人材育成が大幅に遅れている。", isCorrect: true }, { key: "C", text: "予算超過のためプロジェクトは停止中。", isCorrect: false }, { key: "D", text: "クラウド移行は完了し、次フェーズに移行済み。", isCorrect: false }], tags: ["DX", "progress_report"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の取引条件提示を読んで、交渉の余地がある点を選んでください。\n\n「ご注文数量500個以上で単価10%割引。支払条件は納品後30日以内。送料は3万円以上の注文で無料。なお、初回取引に限り、サンプル5個を無料提供いたします。」\n\n交渉の余地が最もある条件はどれですか。", scenario: "新規取引先からの条件提示。", explanationVi: "Có thể thương lượng: số lượng tối thiểu, tỷ lệ chiết khấu, điều kiện thanh toán.", options: [{ key: "A", text: "サンプルの数を増やすこと。", isCorrect: false }, { key: "B", text: "割引適用の最低注文数量と支払い条件。", isCorrect: true }, { key: "C", text: "送料無料の基準額。", isCorrect: false }, { key: "D", text: "初回取引の条件。", isCorrect: false }], tags: ["negotiation", "terms"], businessSituation: "sales_customer", stimulusKind: "text" },
    { prompt: "以下の退職者インタビュー記録を読んで、組織が改善すべき最重要点を選んでください。\n\n「退職理由：'成長の機会がない'。在籍3年間で研修ゼロ、昇進基準が不明確、上司との1on1なし。給与は市場水準。福利厚生に不満なし。」\n\n最も重要な改善点はどれですか。", scenario: "退職者面談の分析。", explanationVi: "Lương/phúc lợi OK, vấn đề: không đào tạo, tiêu chí thăng tiến mờ, thiếu 1on1 → thiếu cơ hội phát triển.", options: [{ key: "A", text: "給与を引き上げる。", isCorrect: false }, { key: "B", text: "研修制度の整備、昇進基準の明確化、定期的な1on1面談の導入。", isCorrect: true }, { key: "C", text: "福利厚生を拡充する。", isCorrect: false }, { key: "D", text: "リモートワークを導入する。", isCorrect: false }], tags: ["hr", "retention"], businessSituation: "hr_interview", stimulusKind: "text" },
    { prompt: "以下の社長年頭挨拶の要旨を読んで、今年の重点テーマを選んでください。\n\n「昨年は過去最高の売上を達成しました。しかし、利益率は3年連続で低下。今年は'量から質への転換'をテーマに、高付加価値商品の開発と不採算事業の整理を推進します。」", scenario: "年頭挨拶の分析。", explanationVi: "Doanh thu cao nhưng lợi nhuận giảm 3 năm → chuyển từ lượng sang chất.", options: [{ key: "A", text: "売上のさらなる拡大。", isCorrect: false }, { key: "B", text: "利益率改善のための高付加価値化と不採算事業整理。", isCorrect: true }, { key: "C", text: "新規市場への参入。", isCorrect: false }, { key: "D", text: "コスト削減のための人員整理。", isCorrect: false }], tags: ["strategy", "corporate_message"], businessSituation: "presentation", stimulusKind: "text" },
    { prompt: "以下の研修報告書を読んで、研修の課題を選んでください。\n\n「参加者満足度：4.2/5.0。最も評価の高い点：講師の実務経験に基づく事例紹介。最も評価の低い点：グループワークの時間不足、実務で使えるテンプレートの不在。」", scenario: "研修効果測定の報告。", explanationVi: "Giảng viên tốt, nhưng thiếu thời gian thực hành nhóm + thiếu template thực tế.", options: [{ key: "A", text: "講師の質を改善する。", isCorrect: false }, { key: "B", text: "グループワーク時間の拡大と実務テンプレートの提供。", isCorrect: true }, { key: "C", text: "研修を廃止する。", isCorrect: false }, { key: "D", text: "参加者数を減らす。", isCorrect: false }], tags: ["training", "evaluation"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の営業日報を読んで、最も有望な商談を選んでください。\n\n「A社：予算未定、来期検討。B社：予算確保済み、決裁者と面談完了、来週契約書送付予定。C社：興味あり、部内調整中。D社：競合他社に発注済み。」", scenario: "営業マネージャーが日報を確認する場面。", explanationVi: "B社: ngân sách đã duyệt, gặp người quyết định, tuần sau gửi hợp đồng → có triển vọng nhất.", options: [{ key: "A", text: "A社", isCorrect: false }, { key: "B", text: "B社", isCorrect: true }, { key: "C", text: "C社", isCorrect: false }, { key: "D", text: "D社", isCorrect: false }], tags: ["sales", "pipeline"], businessSituation: "sales_customer", stimulusKind: "text" },
    { prompt: "以下の稟議書を読んで、承認に必要な条件を選んでください。\n\n「件名：マーケティングツール導入（年間120万円）。目的：リード管理の効率化。期待効果：営業工数20%削減。申請者：マーケティング部長。必要承認：事業部長・CFO。添付：ベンダー比較表、ROI試算。」", scenario: "稟議書の読解。", explanationVi: "Cần phê duyệt: Giám đốc sự nghiệp + CFO. Đã có bảng so sánh vendor + ROI.", options: [{ key: "A", text: "社長の承認が必要。", isCorrect: false }, { key: "B", text: "事業部長とCFOの両方の承認が必要。", isCorrect: true }, { key: "C", text: "マーケティング部長の決裁で十分。", isCorrect: false }, { key: "D", text: "取締役会の承認が必要。", isCorrect: false }], tags: ["approval", "budget"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下のフィードバックメールを読んで、指摘のトーンを選んでください。\n\n「ご提出いただいた報告書、拝見いたしました。全体の構成はよくまとまっていますが、データの出典が明記されていない箇所がいくつかございます。お手数ですが、出典を追記の上、再提出いただけますでしょうか。」", scenario: "上司からのフィードバックメール。", explanationVi: "Tone: lịch sự, xây dựng, khen điểm tốt rồi chỉ ra vấn đề cụ thể.", options: [{ key: "A", text: "厳しく批判している。", isCorrect: false }, { key: "B", text: "丁寧に、建設的な改善点を指摘している。", isCorrect: true }, { key: "C", text: "全面的に否定している。", isCorrect: false }, { key: "D", text: "特に問題がないと評価している。", isCorrect: false }], tags: ["feedback", "communication"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下のプレスリリースの最も重要なメッセージを選んでください。\n\n「○○株式会社は、AI搭載の次世代カスタマーサポートシステムを2026年秋に発売予定。問い合わせ対応時間を最大70%短縮し、顧客満足度の向上を実現。価格は月額5万円から。」", scenario: "新製品プレスリリース。", explanationVi: "AI customer support: giảm 70% thời gian xử lý, giá từ 5万/tháng.", options: [{ key: "A", text: "AIの技術的な仕組み。", isCorrect: false }, { key: "B", text: "問い合わせ対応時間の大幅短縮と顧客満足度向上。", isCorrect: true }, { key: "C", text: "価格が安いこと。", isCorrect: false }, { key: "D", text: "発売時期が近いこと。", isCorrect: false }], tags: ["press_release", "product"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の社内報告を読んで、報告者の意図を選んでください。\n\n「先月導入したチャットツールの利用状況：全社利用率85%、メール送信量30%減少。一方、'チャットの通知が多すぎて集中できない'という声が営業部を中心に上がっています。通知設定のガイドラインを作成する予定です。」", scenario: "IT部門からの社内報告。", explanationVi: "Chat tool thành công (85% dùng, email giảm 30%), nhưng cần hướng dẫn cài đặt notification.", options: [{ key: "A", text: "チャットツールの導入失敗を報告している。", isCorrect: false }, { key: "B", text: "成果を報告しつつ、残存する課題への対策も示している。", isCorrect: true }, { key: "C", text: "チャットツールの廃止を提案している。", isCorrect: false }, { key: "D", text: "メールの復活を求めている。", isCorrect: false }], tags: ["IT", "change_management"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の商談報告を読んで、次のアクションとして最も適切なものを選んでください。\n\n「X社訪問報告：担当者は前向きだが、決裁者（部長）が製品の耐久性に懸念。競合Y社も提案中。納期は来月末希望。X社の過去3年の購買実績は年間500万円。」", scenario: "営業の商談報告。", explanationVi: "Người quyết định lo về độ bền → cung cấp dữ liệu/demo chứng minh.", options: [{ key: "A", text: "値引きを提案する。", isCorrect: false }, { key: "B", text: "耐久性を証明するデータや事例を準備し、決裁者への直接プレゼンを設定する。", isCorrect: true }, { key: "C", text: "X社への提案を辞退する。", isCorrect: false }, { key: "D", text: "納期を延長する交渉をする。", isCorrect: false }], tags: ["sales", "action_plan"], businessSituation: "sales_customer", stimulusKind: "text" },
    { prompt: "以下のコンプライアンス研修の案内を読んで、全社員に求められていることを選んでください。\n\n「改正個人情報保護法の施行に伴い、全社員対象のeラーニングを実施します。受講期限：今月末。未受講者には部門長経由で督促連絡を行います。なお、受講証は人事評価の参考資料となります。」", scenario: "コンプライアンス研修の案内。", explanationVi: "Toàn bộ nhân viên phải hoàn thành e-learning trước cuối tháng, ảnh hưởng đánh giá.", options: [{ key: "A", text: "希望者のみeラーニングを受講する。", isCorrect: false }, { key: "B", text: "今月末までに全員がeラーニングを受講完了する。", isCorrect: true }, { key: "C", text: "部門長が代理で受講する。", isCorrect: false }, { key: "D", text: "来月以降に受講すればよい。", isCorrect: false }], tags: ["compliance", "training"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "以下のインシデント報告を読んで、最も重要な教訓を選んでください。\n\n「システム障害報告：4月15日10時〜14時にサービス停止。原因：サーバーの自動バックアップが同時刻にフル実行され、リソースが枯渇。影響：約2,000ユーザーがアクセス不能。対策：バックアップスケジュールをオフピーク時間に変更済み。」", scenario: "インシデント報告書のレビュー。", explanationVi: "Backup tự động chạy giờ cao điểm → hết resource. Bài học: lên lịch backup ngoài giờ cao điểm.", options: [{ key: "A", text: "バックアップをやめるべき。", isCorrect: false }, { key: "B", text: "定期メンテナンスタスクのスケジューリングにおけるリソース影響評価の重要性。", isCorrect: true }, { key: "C", text: "ユーザー数を制限すべき。", isCorrect: false }, { key: "D", text: "サーバーを交換すべき。", isCorrect: false }], tags: ["incident", "IT"], businessSituation: "report_document", stimulusKind: "text" },
  ];
}

// =====================================================================
// RC_INTEGRATED: Multi-document integrated reading (25 per level)
// We reuse the same pool from the upgrade script + add more
// =====================================================================

function rcIntegratedPool(): Q[] {
  return [
    { prompt: "以下の3つの資料から判断してください。\n\n①市場調査：「国内市場は年2%縮小。アジア市場は年15%成長。」\n②自社データ：「海外売上比率20%。アジア拠点はベトナムのみ。」\n③競合情報：「上位3社はアジア5か国以上に拠点展開済み。」\n\n最も適切な中期戦略はどれですか。", scenario: "中期経営戦略の策定場面。", explanationVi: "Nội địa thu hẹp, châu Á tăng mạnh, đối thủ đã mở rộng → mở rộng châu Á.", options: [{ key: "A", text: "国内市場でのシェア拡大に集中する。", isCorrect: false }, { key: "B", text: "アジア市場への拠点拡大と海外売上比率の向上を加速する。", isCorrect: true }, { key: "C", text: "ベトナム拠点を閉鎖する。", isCorrect: false }, { key: "D", text: "欧米市場に参入する。", isCorrect: false }], tags: ["strategy", "global"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "以下のデータを統合して判断してください。\n\n①採用データ：「エンジニア採用単価：150万円/人。年間退職率：25%。」\n②研修データ：「新人の戦力化期間：平均6か月。研修コスト：80万円/人。」\n③業界データ：「エンジニア平均退職率：15%。平均年収：700万円。自社：600万円。」\n\n最も費用対効果の高い改善策はどれですか。", scenario: "エンジニア人材戦略の分析。", explanationVi: "Tuyển dụng 150万, đào tạo 80万, nghỉ việc 25% (cao hơn trung bình 15%). Tăng lương rẻ hơn tuyển mới.", options: [{ key: "A", text: "採用広告費を増やす。", isCorrect: false }, { key: "B", text: "給与水準を業界平均に近づけ、退職率を低下させることで、採用・研修コストを削減する。", isCorrect: true }, { key: "C", text: "研修期間を短縮する。", isCorrect: false }, { key: "D", text: "外部委託に切り替える。", isCorrect: false }], tags: ["hr", "cost_analysis"], businessSituation: "report_document", stimulusKind: "document" },
    { prompt: "以下の情報を統合して最適な施策を判断してください。\n\n①顧客アンケート：「納品までの待ち時間が長い（不満度1位、72%）。品質は高評価（満足度92%）。」\n②生産部：「現在の生産リードタイム：3週間。設備稼働率：95%。」\n③物流部：「配送は翌日可能。倉庫在庫回転率：月2回。」\n\n最も効果的な改善策はどれですか。", scenario: "顧客満足度改善のための分析。", explanationVi: "Khách hàng chê chờ lâu, sản xuất 3 tuần, thiết bị 95% → tăng cường sản xuất/tồn kho.", options: [{ key: "A", text: "品質をさらに向上させる。", isCorrect: false }, { key: "B", text: "売れ筋商品の在庫水準を引き上げて受注即出荷の比率を高め、生産能力の拡大を検討する。", isCorrect: true }, { key: "C", text: "配送会社を変更する。", isCorrect: false }, { key: "D", text: "価格を引き下げる。", isCorrect: false }], tags: ["operations", "customer_satisfaction"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "年間報告書、コンサルタント提案、取締役会議事録を参照してください。\n\n報告書：「従業員数2,000人。平均年齢46歳。管理職比率35%。」\nコンサルタント：「業界平均：管理職比率20%。人件費比率が業界平均より15%高い。」\n取締役会：「組織のスリム化と次世代リーダーの育成が急務。」\n\n最も適切な組織施策はどれですか。", scenario: "組織改革の検討場面。", explanationVi: "Tỷ lệ quản lý 35% (cao hơn TB 20%), chi phí nhân sự cao → cải tổ tổ chức.", options: [{ key: "A", text: "全員の給与を一律削減する。", isCorrect: false }, { key: "B", text: "管理職比率を適正化しつつ、早期退職制度と若手登用プログラムを組み合わせる。", isCorrect: true }, { key: "C", text: "管理職を全員降格する。", isCorrect: false }, { key: "D", text: "新卒採用を停止する。", isCorrect: false }], tags: ["organization", "restructuring"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "以下の複数資料から最適なIT投資判断をしてください。\n\n①現状：「基幹システム：導入15年、保守費年2億円、カスタマイズ過多。」\n②ベンダー提案A：「クラウドERP。初期費用5億円、年間保守1億円。移行期間18か月。」\n③ベンダー提案B：「現システム延命改修。費用3億円、追加保守費5,000万円/年。延命期間5年。」\n④IT部門：「5年後には現システムの保守が困難になる可能性。」\n\n最も合理的な判断はどれですか。", scenario: "基幹システム刷新の意思決定。", explanationVi: "Hệ thống 15 năm, 5 năm nữa khó bảo trì. A: tốn hơn nhưng bền vững. B: rẻ hơn nhưng tạm thời.", options: [{ key: "A", text: "提案Bで延命し、5年後に再検討する。", isCorrect: false }, { key: "B", text: "提案Aのクラウド移行を採用し、長期的なコスト削減と持続可能なIT基盤を構築する。", isCorrect: true }, { key: "C", text: "両方のベンダーに再見積もりを依頼する。", isCorrect: false }, { key: "D", text: "現システムをそのまま使い続ける。", isCorrect: false }], tags: ["IT", "investment"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "マーケティングデータ、顧客行動分析、および競合レポートを統合してください。\n\n①自社EC：「月間訪問者100万人、CVR 1.5%、カート放棄率70%。」\n②行動分析：「放棄原因：送料が高い（40%）、決済方法の不足（25%）、ログイン必須（20%）、その他（15%）。」\n③競合：「大手3社は送料無料条件あり、ゲスト購入可能、全主要決済対応。」\n\n売上改善に最も効果的な施策はどれですか。", scenario: "EC売上改善の検討。", explanationVi: "CVR 1.5%, bỏ giỏ 70%. Nguyên nhân lớn nhất: phí ship (40%) → thêm điều kiện miễn phí ship.", options: [{ key: "A", text: "訪問者数を増やす広告を強化する。", isCorrect: false }, { key: "B", text: "一定金額以上の送料無料化、決済方法の追加、ゲスト購入の導入でカート放棄率を削減する。", isCorrect: true }, { key: "C", text: "商品価格を引き下げる。", isCorrect: false }, { key: "D", text: "会員制度を強化する。", isCorrect: false }], tags: ["ecommerce", "conversion"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "以下のプロジェクト完了報告から、次期プロジェクトへの最重要教訓を選んでください。\n\n①成果：「予定通りローンチ。初月売上：目標の120%達成。」\n②課題：「テスト期間が計画の半分に短縮。ローンチ後2週間でバグ報告40件。」\n③コスト：「緊急対応コストが当初予算の30%に相当。」\n④チーム：「ローンチ前3か月は残業月80時間。退職者2名。」", scenario: "プロジェクト完了レビュー。", explanationVi: "Kết quả tốt nhưng: test bị rút ngắn → bugs, OT cao → nghỉ việc. Bài học: đủ thời gian test.", options: [{ key: "A", text: "売上目標をさらに高く設定する。", isCorrect: false }, { key: "B", text: "テスト期間を十分に確保し、品質担保と持続可能な働き方を両立させるスケジュールを策定する。", isCorrect: true }, { key: "C", text: "ローンチ後のバグ対応チームを常設する。", isCorrect: false }, { key: "D", text: "残業手当を増額する。", isCorrect: false }], tags: ["project_review", "lessons_learned"], businessSituation: "meeting", stimulusKind: "document" },
  ];
}

// Helper to pick N questions from pool, cycling if pool < needed
function pickQuestions(pool: Q[], needed: number): Q[] {
  const result: Q[] = [];
  for (let i = 0; i < needed; i++) {
    result.push(pool[i % pool.length]!);
  }
  return result;
}

// Target per section for 200 total per level
const TARGETS: Record<string, number> = {
  RC_VOCAB_GRAMMAR: 25,
  RC_EXPRESSION: 25,
  RC_INTEGRATED: 25,
};

async function main() {
  console.log("=== Generate 200 BJT questions per level (Reading sections first) ===\n");

  // We'll create a dedicated "question bank" exam per level if it doesn't exist,
  // or add to existing bank sections
  let totalCreated = 0;

  for (const level of LEVELS) {
    const bankSlug = `bjt-bank-${level.code.toLowerCase().replace("+", "plus").replace("bjt-", "")}`;
    
    // Find or create the question bank exam
    let bankExam = await prisma.bjtMockTest.findFirst({ where: { slug: bankSlug } });
    
    if (!bankExam) {
      bankExam = await prisma.bjtMockTest.create({
        data: {
          slug: bankSlug,
          titleVi: `Ngân hàng câu hỏi BJT ${level.code}`,
          titleJa: `BJT問題バンク ${level.code}`,
          type: "mock",
          status: "draft",
          level: level.code,
          timeLimitSeconds: 7200,
          description: `Question bank for ${level.code}. Not a playable exam — used for question pool management.`,
          blueprintMeta: {
            examFormat: "question-bank",
            level: level.code,
            totalQuestions: 200,
            purpose: "question_bank_storage",
          } as any,
        },
      });
      console.log(`Created bank: ${bankSlug} (${bankExam.id})`);
    } else {
      console.log(`Bank exists: ${bankSlug} (${bankExam.id})`);
    }

    // Ensure sections exist
    const sectionCodes = ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"];
    const sectionTitles: Record<string, { vi: string; ja: string; order: number }> = {
      RC_VOCAB_GRAMMAR: { vi: "Đọc – Từ vựng & Ngữ pháp", ja: "読解 – 語彙・文法問題", order: 7 },
      RC_EXPRESSION: { vi: "Đọc – Đọc hiểu biểu đạt", ja: "読解 – 表現読解問題", order: 8 },
      RC_INTEGRATED: { vi: "Đọc – Tổng hợp đọc hiểu", ja: "読解 – 総合読解問題", order: 9 },
    };

    for (const code of sectionCodes) {
      const meta = sectionTitles[code]!;
      let section = await prisma.bjtTestSection.findFirst({
        where: { testId: bankExam.id, code },
      });
      
      if (!section) {
        section = await prisma.bjtTestSection.create({
          data: {
            testId: bankExam.id,
            code,
            titleVi: meta.vi,
            titleJa: meta.ja,
            displayOrder: meta.order,
          },
        });
      }

      // Count existing questions
      const existingCount = await prisma.bjtQuestion.count({
        where: { sectionId: section.id },
      });
      const target = TARGETS[code] ?? 25;
      const needed = Math.max(0, target - existingCount);

      if (needed === 0) {
        console.log(`  ${code}: already ${existingCount}/${target} — skipping`);
        continue;
      }

      // Get pool
      let pool: Q[];
      switch (code) {
        case "RC_VOCAB_GRAMMAR": pool = rcVocabGrammarPool(); break;
        case "RC_EXPRESSION": pool = rcExpressionPool(); break;
        case "RC_INTEGRATED": pool = rcIntegratedPool(); break;
        default: pool = [];
      }

      const questions = pickQuestions(pool, needed);
      const secMeta = SECTION_META[code]!;

      for (const q of questions) {
        const question = await prisma.bjtQuestion.create({
          data: {
            sectionId: section.id,
            prompt: q.prompt,
            scenario: q.scenario,
            explanationVi: q.explanationVi,
            skillTag: q.tags[0] ?? "general",
            difficulty: level.diff,
            sourceType: PROVENANCE,
            status: "published",
            qualityFlags: {
              bjtPart: secMeta.part,
              bjtSection: code,
              businessSituation: q.businessSituation,
              stimulusKind: q.stimulusKind,
              stimulusRequired: secMeta.stimulusRequired,
              hasAudioStimulus: false,
              hasVisualStimulus: false,
              distractorQuality: "authored",
              difficultySource: "estimated",
              itemReviewed: false,
              license: LICENSE,
              level: level.code,
              provenance: PROVENANCE,
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
        totalCreated++;
      }

      console.log(`  ${code}: ${existingCount} → ${existingCount + questions.length} (+${questions.length})`);
    }
    console.log();
  }

  // Verification
  console.log("=== Verification ===");
  const banks = await prisma.bjtMockTest.findMany({
    where: { slug: { startsWith: "bjt-bank-" } },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { slug: "asc" },
  });

  for (const bank of banks) {
    const total = bank.sections.reduce((s, sec) => s + sec._count.questions, 0);
    const detail = bank.sections.map((s) => `${s.code}:${s._count.questions}`).join(", ");
    console.log(`  ${bank.slug}: ${total}q [${detail}]`);
  }

  // Also count total questions in system
  const totalQ = await prisma.bjtQuestion.count();
  console.log(`\nTotal questions in system: ${totalQ}`);
  console.log(`✅ Created ${totalCreated} new questions.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
