/**
 * Upgrade ALL 12 BJT exams from 50 to 80 questions (standard BJT format).
 *
 * Official BJT distribution (80 questions, 120 minutes):
 *   Part 1 聴解 (45 min): LC_SCENE=12, LC_STATEMENT=10, LC_INTEGRATED=8 → 30q
 *   Part 2 聴読解 (30 min): LR_SITUATION=5, LR_DOCUMENT=5, LR_INTEGRATED=5 → 15q
 *   Part 3 読解 (45 min): RC_VOCAB_GRAMMAR=15, RC_EXPRESSION=10, RC_INTEGRATED=10 → 35q
 *
 * This script adds additional questions to sections that need them and updates blueprintMeta.
 *
 * Usage: pnpm tsx database/scripts/upgrade-exams-80q.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../packages/config/src/index.js";
import { createPrismaClient } from "../../packages/database/src/index.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const PROVENANCE = "nihongo-bjt-80q-upgrade";
const LICENSE = "original-internal-production-seed";

// Target question count per section (total = 80)
const TARGET: Record<string, number> = {
  LC_SCENE: 12,
  LC_STATEMENT: 10,
  LC_INTEGRATED: 8,
  LR_SITUATION: 5,
  LR_DOCUMENT: 5,
  LR_INTEGRATED: 5,
  RC_VOCAB_GRAMMAR: 15,
  RC_EXPRESSION: 10,
  RC_INTEGRATED: 10,
};

interface SeedQ {
  prompt: string;
  scenario: string;
  explanationVi: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  tags: string[];
  businessSituation: string;
  stimulusKind: string;
}

// ===================== ADDITIONAL QUESTIONS =====================

function additionalLcScene(): SeedQ[] {
  return [
    { prompt: "工場の検品エリアで品質管理担当者が「今朝のロットから不良率が2%を超えています」と報告しています。製造部長として最も適切な指示を選んでください。", scenario: "工場の品質検品エリア。不良率上昇への対応場面。", explanationVi: "Tỷ lệ lỗi >2%, cần dừng dây chuyền và kiểm tra nguyên nhân.", options: [ { key: "A", text: "2%なら問題ありません。生産を続けてください。", isCorrect: false }, { key: "B", text: "すぐにラインを一時停止して、原因を特定してください。今朝のロットは全数検品に切り替えます。", isCorrect: true }, { key: "C", text: "不良品だけ取り除いて出荷しましょう。", isCorrect: false }, { key: "D", text: "明日の会議で報告してください。", isCorrect: false } ], tags: ["quality_control", "manufacturing"], businessSituation: "internal_coordination", stimulusKind: "photo" },
    { prompt: "取引先との名刺交換の場面です。相手が「初めまして、○○商事営業部の山本と申します」と言いました。適切な対応を選んでください。", scenario: "初対面の取引先との名刺交換場面。", explanationVi: "Trao đổi danh thiếp: nhận bằng hai tay, đọc tên, tự giới thiệu.", options: [ { key: "A", text: "名刺を片手で受け取って、すぐにポケットに入れる。", isCorrect: false }, { key: "B", text: "「頂戴いたします。○○株式会社の△△と申します。本日はお時間をいただきありがとうございます。」と言って、両手で名刺を受け取る。", isCorrect: true }, { key: "C", text: "「あ、どうも。」と言って自分の名刺だけ渡す。", isCorrect: false }, { key: "D", text: "名刺を持っていないことを謝る。", isCorrect: false } ], tags: ["business_card", "greeting"], businessSituation: "sales_customer", stimulusKind: "photo" },
    { prompt: "オフィスの移転作業中、引っ越し業者が「この書類棚は重すぎて階段では運べません」と言っています。総務担当として適切な対応を選んでください。", scenario: "オフィス移転の引っ越し作業現場。", explanationVi: "Tủ tài liệu quá nặng cho cầu thang → dùng thang máy hàng hóa hoặc tháo rời.", options: [ { key: "A", text: "じゃあ、その棚は捨ててください。", isCorrect: false }, { key: "B", text: "貨物用エレベーターの使用許可を取りますので、それで運んでいただけますか。棚の中身は先に別で運びましょう。", isCorrect: true }, { key: "C", text: "人を増やせば階段でも大丈夫ですよね。", isCorrect: false }, { key: "D", text: "明日に延期しましょう。", isCorrect: false } ], tags: ["office_move", "logistics"], businessSituation: "internal_coordination", stimulusKind: "photo" },
    { prompt: "忘年会の幹事として、会場のレストランに電話しています。店員が「金曜日は満席ですが、木曜日なら個室をご用意できます」と言っています。適切な対応を選んでください。", scenario: "忘年会の予約電話。日程調整の場面。", explanationVi: "Thứ Sáu hết chỗ, Thứ Năm có phòng riêng → hỏi ý kiến đồng nghiệp trước khi quyết.", options: [ { key: "A", text: "「では木曜日で予約します。」とすぐに決める。", isCorrect: false }, { key: "B", text: "「ありがとうございます。参加者に木曜日への変更を確認して、本日中にご連絡いたします。」", isCorrect: true }, { key: "C", text: "「金曜日じゃないとダメです。キャンセル待ちはできますか。」", isCorrect: false }, { key: "D", text: "「忘年会はやめます。」", isCorrect: false } ], tags: ["event_planning", "phone"], businessSituation: "phone", stimulusKind: "photo" },
  ];
}

function additionalLcStatement(): SeedQ[] {
  return [
    { prompt: "会議の招集メールに対して「当日は別件があるため、欠席させていただきたいのですが」と返信する場合、最も適切な追記を選んでください。", scenario: "会議欠席の連絡メール。代替案の提示場面。", explanationVi: "Xin vắng họp: nên đề xuất phương án thay thế (gửi ý kiến trước hoặc cử người thay).", options: [ { key: "A", text: "以上、よろしくお願いいたします。", isCorrect: false }, { key: "B", text: "事前に意見書をお送りしますので、ご確認いただけますでしょうか。また、必要であれば代理として佐藤を出席させることも可能です。", isCorrect: true }, { key: "C", text: "議事録を後で送ってください。", isCorrect: false }, { key: "D", text: "会議自体を延期していただけませんか。", isCorrect: false } ], tags: ["meeting", "email"], businessSituation: "email_chat", stimulusKind: "audio" },
    { prompt: "部下が「昨日のプレゼン、自分ではうまくいったと思うんですが」と自己評価を述べています。上司として改善点を伝える際、最も適切な表現を選んでください。", scenario: "プレゼンの振り返り面談場面。", explanationVi: "Phản hồi xây dựng: khen điểm tốt trước, rồi đề xuất cải thiện cụ thể.", options: [ { key: "A", text: "いいえ、全然だめでした。", isCorrect: false }, { key: "B", text: "データの説明は分かりやすかったですね。次回はもう少し結論を先に述べてから、根拠を示す構成にすると、より説得力が増すと思いますよ。", isCorrect: true }, { key: "C", text: "まあ、いいんじゃないですか。", isCorrect: false }, { key: "D", text: "次回は私がやります。", isCorrect: false } ], tags: ["feedback", "coaching"], businessSituation: "internal_coordination", stimulusKind: "audio" },
  ];
}

function additionalLcIntegrated(): SeedQ[] {
  return [
    { prompt: "物流部長が「港の混雑で輸入部品が2週間遅延する」と報告し、生産部長が「在庫は1週間分しかない」と返しています。最も適切な経営判断はどれですか。", scenario: "サプライチェーン混乱時の緊急経営会議。", explanationVi: "Linh kiện trễ 2 tuần, tồn kho 1 tuần → tìm nhà cung cấp thay thế + điều chỉnh sản xuất.", options: [ { key: "A", text: "2週間、工場を完全に停止する。", isCorrect: false }, { key: "B", text: "国内の代替サプライヤーからの緊急調達を手配しつつ、在庫のある製品の生産を優先して工場の稼働を維持する。", isCorrect: true }, { key: "C", text: "顧客に全注文のキャンセルを伝える。", isCorrect: false }, { key: "D", text: "在庫がなくなるまで通常通り生産を続ける。", isCorrect: false } ], tags: ["supply_chain", "crisis_management"], businessSituation: "meeting", stimulusKind: "conversation" },
    { prompt: "マーケティング部長が「SNS広告のCPAが前月比50%上昇した」と報告し、デジタル担当が「競合の出稿が急増してオークション単価が上がっている」と分析しています。適切な対策はどれですか。", scenario: "デジタルマーケティング戦略会議。", explanationVi: "CPA tăng 50% do đối thủ đẩy giá đấu thầu → đa dạng hóa kênh + tối ưu targeting.", options: [ { key: "A", text: "SNS広告を全面停止する。", isCorrect: false }, { key: "B", text: "SNS広告のターゲティングを精緻化しつつ、SEOやメールマーケティングなど他チャネルへの予算配分を検討する。", isCorrect: true }, { key: "C", text: "競合と同じ金額まで入札単価を引き上げる。", isCorrect: false }, { key: "D", text: "広告代理店を変更する。", isCorrect: false } ], tags: ["marketing", "digital"], businessSituation: "meeting", stimulusKind: "conversation" },
  ];
}

function additionalLrDocument(): SeedQ[] {
  return [
    { prompt: "A社とB社の福利厚生を比較した資料と、人事コンサルタントのコメントを読んでください。\n\nA社：「住宅手当3万円、通勤手当実費、退職金制度あり、育休取得率65%」\nB社：「住宅手当5万円、通勤手当上限2万円、退職金制度なし（確定拠出年金）、育休取得率90%」\nコンサルタント：「若手採用ではB社型が人気だが、長期雇用にはA社型が安定。」\n\n30歳独身の転職希望者に最も参考になる情報はどれですか。", scenario: "転職検討時の福利厚生比較場面。", explanationVi: "Trẻ tuổi chưa gia đình: B有利 (trợ cấp nhà cao, nghỉ sinh 90%). Dài hạn: A有利 (退職金).", options: [ { key: "A", text: "A社の方が全ての面で優れている。", isCorrect: false }, { key: "B", text: "短期的にはB社の住宅手当と育休制度が魅力的だが、長期的な退職金制度の有無も考慮すべきである。", isCorrect: true }, { key: "C", text: "通勤手当が最も重要な判断基準である。", isCorrect: false }, { key: "D", text: "福利厚生は給与で全て代替できる。", isCorrect: false } ], tags: ["hr", "benefits_comparison"], businessSituation: "hr_interview", stimulusKind: "table" },
  ];
}

function additionalLrIntegrated(): SeedQ[] {
  return [
    { prompt: "プレスリリース、社内メモ、アナリストレポートを参照してください。\n\nプレスリリース：「A社とB社は経営統合を発表。新会社は業界シェア35%。」\n社内メモ：「統合後、重複部門の人員整理が想定される。特に管理部門。」\nアナリスト：「統合シナジーは2年後に年間50億円と予測。ただし文化の違いがリスク。」\n\n統合成功のために最も重要な要素はどれですか。", scenario: "企業統合に関する複数情報源の分析場面。", explanationVi: "M&A: シナジー dự kiến 50 tỷ/năm, rủi ro lớn nhất là khác biệt văn hóa.", options: [ { key: "A", text: "できるだけ早く人員を削減すること。", isCorrect: false }, { key: "B", text: "両社の企業文化の違いを理解し、段階的な統合プロセスと明確なコミュニケーションを行うこと。", isCorrect: true }, { key: "C", text: "シェア拡大のために値下げ競争をすること。", isCorrect: false }, { key: "D", text: "アナリストの予測をそのまま社内目標にすること。", isCorrect: false } ], tags: ["merger", "corporate_strategy"], businessSituation: "report_document", stimulusKind: "document" },
  ];
}

function additionalRcVocabGrammar(): SeedQ[] {
  return [
    { prompt: "「先般ご依頼いただいた件につきまして、（　　）ご報告申し上げます。」空欄に入る最も適切な語を選んでください。", scenario: "取引先への報告メール。", explanationVi: "'Xin báo cáo dưới đây' → 下記の通り.", options: [ { key: "A", text: "下記の通り", isCorrect: true }, { key: "B", text: "適当に", isCorrect: false }, { key: "C", text: "ついでに", isCorrect: false }, { key: "D", text: "いつか", isCorrect: false } ], tags: ["vocabulary", "formal_report"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「新制度の導入に（　　）、社員への説明会を実施する。」空欄に入る最も適切な表現を選んでください。", scenario: "新制度に関する社内通達。", explanationVi: "'Trước khi đưa vào' → 先立ち.", options: [ { key: "A", text: "先立ち", isCorrect: true }, { key: "B", text: "関わらず", isCorrect: false }, { key: "C", text: "引き換えに", isCorrect: false }, { key: "D", text: "つれて", isCorrect: false } ], tags: ["grammar", "formal"], businessSituation: "internal_coordination", stimulusKind: "text" },
    { prompt: "「本プロジェクトは予算の（　　）もあり、第2フェーズは来期に見送ることとなりました。」空欄に入る最も適切な語を選んでください。", scenario: "プロジェクト進捗報告。", explanationVi: "'Do hạn chế ngân sách' → 制約.", options: [ { key: "A", text: "余裕", isCorrect: false }, { key: "B", text: "制約", isCorrect: true }, { key: "C", text: "充実", isCorrect: false }, { key: "D", text: "拡大", isCorrect: false } ], tags: ["vocabulary", "project"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「お客様のご要望に（　　）べく、最善を尽くしてまいります。」空欄に入る最も適切な語を選んでください。", scenario: "顧客への回答メール。", explanationVi: "'Để đáp ứng yêu cầu' → 応える.", options: [ { key: "A", text: "応える", isCorrect: true }, { key: "B", text: "逆らう", isCorrect: false }, { key: "C", text: "甘える", isCorrect: false }, { key: "D", text: "耐える", isCorrect: false } ], tags: ["vocabulary", "customer_service"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「本決定は、関係各所との（　　）を経て最終的に決定されたものです。」空欄に入る最も適切な語を選んでください。", scenario: "社内決裁文書。", explanationVi: "'Sau khi hiệp thương' → 協議.", options: [ { key: "A", text: "雑談", isCorrect: false }, { key: "B", text: "対立", isCorrect: false }, { key: "C", text: "協議", isCorrect: true }, { key: "D", text: "妥協", isCorrect: false } ], tags: ["vocabulary", "formal_decision"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "「市場環境の変化を（　　）に入れた上で、中期経営計画を見直す必要がある。」空欄に入る最も適切な語を選んでください。", scenario: "経営会議での発言。", explanationVi: "'Đưa vào xem xét' → 視野.", options: [ { key: "A", text: "視野", isCorrect: true }, { key: "B", text: "手中", isCorrect: false }, { key: "C", text: "射程", isCorrect: false }, { key: "D", text: "範囲", isCorrect: false } ], tags: ["vocabulary", "strategy"], businessSituation: "meeting", stimulusKind: "text" },
    { prompt: "「当該案件については、（　　）対処いたしますので、しばらくお待ちください。」空欄に入る最も適切な語を選んでください。", scenario: "顧客からの問い合わせへの返信。", explanationVi: "'Xử lý nhanh chóng' → 早急に.", options: [ { key: "A", text: "のんびり", isCorrect: false }, { key: "B", text: "早急に", isCorrect: true }, { key: "C", text: "曖昧に", isCorrect: false }, { key: "D", text: "気軽に", isCorrect: false } ], tags: ["vocabulary", "customer_response"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "「新入社員には（　　）的なビジネスマナーを研修で徹底的に教育する。」空欄に入る最も適切な語を選んでください。", scenario: "新入社員研修計画書。", explanationVi: "'Kỹ năng cơ bản' → 基礎.", options: [ { key: "A", text: "革新", isCorrect: false }, { key: "B", text: "応用", isCorrect: false }, { key: "C", text: "基礎", isCorrect: true }, { key: "D", text: "専門", isCorrect: false } ], tags: ["vocabulary", "training"], businessSituation: "report_document", stimulusKind: "text" },
  ];
}

function additionalRcExpression(): SeedQ[] {
  return [
    { prompt: "以下のお断りメールを読んで、送信者の真意として最も適切なものを選んでください。\n\n「この度はご提案いただき誠にありがとうございます。大変魅力的な内容ではございますが、現時点では弊社の方針と合致しない部分がございますので、今回は見送らせていただきたく存じます。今後、状況が変わりましたら、改めてご相談させていただければ幸いです。」", scenario: "取引先からのお断りメールの意図を読み解く場面。", explanationVi: "Từ chối lịch sự: không phù hợp hiện tại, nhưng để ngỏ cửa tương lai.", options: [ { key: "A", text: "二度と取引したくないと考えている。", isCorrect: false }, { key: "B", text: "現時点では提案を断るが、将来的な可能性は完全に否定していない。", isCorrect: true }, { key: "C", text: "提案内容に全く興味がない。", isCorrect: false }, { key: "D", text: "すぐに再提案してほしいと思っている。", isCorrect: false } ], tags: ["rejection", "email"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下の社長年頭挨拶を読んで、今年の経営方針として最も重要視されているものを選んでください。\n\n「昨年は厳しい事業環境の中、皆様の尽力により過去最高の売上を達成しました。しかし、利益率は業界平均を下回っています。今年は『選択と集中』をテーマに、収益性の高い事業に経営資源を集中させ、不採算事業の見直しを進めてまいります。」", scenario: "年頭社長メッセージの主旨を理解する場面。", explanationVi: "Chủ đề: 'chọn lọc và tập trung' → cải thiện tỷ suất lợi nhuận.", options: [ { key: "A", text: "売上のさらなる拡大。", isCorrect: false }, { key: "B", text: "利益率改善のための事業ポートフォリオの再構築。", isCorrect: true }, { key: "C", text: "新規事業への積極的な投資。", isCorrect: false }, { key: "D", text: "社員数の大幅な増加。", isCorrect: false } ], tags: ["corporate_message", "strategy"], businessSituation: "presentation", stimulusKind: "text" },
    { prompt: "以下の研修後アンケートの自由記述を読んで、参加者の主な要望を選んでください。\n\n「講義の内容は大変参考になりました。ただ、座学が中心で実践の時間が少なかったため、次回はケーススタディやロールプレイなどの実習を多く取り入れていただけると、より理解が深まると思います。」", scenario: "研修後アンケートの分析場面。", explanationVi: "Nội dung tốt nhưng muốn nhiều thực hành hơn (case study, role play).", options: [ { key: "A", text: "講義の時間を増やしてほしい。", isCorrect: false }, { key: "B", text: "実践的な演習（ケーススタディ・ロールプレイ）を増やしてほしい。", isCorrect: true }, { key: "C", text: "研修自体が不要だと考えている。", isCorrect: false }, { key: "D", text: "講師を変えてほしい。", isCorrect: false } ], tags: ["training", "feedback"], businessSituation: "report_document", stimulusKind: "text" },
    { prompt: "以下の顧客からの問い合わせメールを読んで、対応の優先度として最も適切なものを選んでください。\n\n「御社のシステムを利用しておりますが、今朝から請求書の発行機能が使えなくなっております。月末の締め処理が今日中に必要なため、至急対応をお願いいたします。」", scenario: "システム障害に関する緊急問い合わせ場面。", explanationVi: "Chức năng xuất hóa đơn lỗi + deadline cuối tháng hôm nay = khẩn cấp nhất.", options: [ { key: "A", text: "通常の問い合わせとして3営業日以内に回答する。", isCorrect: false }, { key: "B", text: "業務に直接影響する障害であり月末期限もあるため、最優先で即時対応する。", isCorrect: true }, { key: "C", text: "FAQページを案内する。", isCorrect: false }, { key: "D", text: "来月の請求で合算処理を提案する。", isCorrect: false } ], tags: ["support", "priority"], businessSituation: "complaint", stimulusKind: "text" },
    { prompt: "以下の取引条件変更の通知を読んで、受け手として最も注意すべき点を選んでください。\n\n「誠に恐縮ではございますが、原材料費の高騰に伴い、来月1日より一部製品の価格を改定させていただきます。改定幅は5〜8%を予定しております。詳細は添付の価格表をご確認ください。現行価格での最終発注は今月25日までとなります。」", scenario: "仕入先からの値上げ通知場面。", explanationVi: "Tăng giá 5-8% từ tháng sau. Hạn đặt giá cũ: ngày 25 tháng này.", options: [ { key: "A", text: "原材料費の内訳を確認すること。", isCorrect: false }, { key: "B", text: "今月25日までに現行価格で必要な発注を済ませ、値上げ分の予算への影響を試算すること。", isCorrect: true }, { key: "C", text: "すぐに取引を中止すること。", isCorrect: false }, { key: "D", text: "値上げを無視して従来の価格で発注すること。", isCorrect: false } ], tags: ["procurement", "price_change"], businessSituation: "email_chat", stimulusKind: "text" },
    { prompt: "以下の新製品レビュー記事を読んで、製品の最大の課題として指摘されているものを選んでください。\n\n「デザインは洗練されており、基本性能も申し分ない。しかし、バッテリーの持続時間が競合製品の半分程度であり、外出先での使用には不安が残る。価格帯を考えると、この点の改善は必須だろう。」", scenario: "製品レビュー記事の分析場面。", explanationVi: "Thiết kế/tính năng OK, nhưng pin chỉ bằng nửa đối thủ = vấn đề lớn nhất.", options: [ { key: "A", text: "デザインが悪い。", isCorrect: false }, { key: "B", text: "バッテリーの持続時間が競合製品に対して大幅に劣っていること。", isCorrect: true }, { key: "C", text: "価格が高すぎる。", isCorrect: false }, { key: "D", text: "基本性能が不足している。", isCorrect: false } ], tags: ["product_review", "analysis"], businessSituation: "report_document", stimulusKind: "text" },
  ];
}

function additionalRcIntegrated(): SeedQ[] {
  return [
    { prompt: "以下の3つの文書から、最も効果的な人材育成策を判断してください。\n\n①離職率データ：「入社3年以内の離職率32%。主因：成長実感の不足。」\n②研修部報告：「外部研修は好評だが、OJTの質にばらつきがある。」\n③競合他社事例：「メンター制度導入後、離職率が15%に低下。」\n\n最も優先すべき施策はどれですか。", scenario: "人材定着率改善のための施策検討場面。", explanationVi: "Tỷ lệ nghỉ việc 32%, nguyên nhân: thiếu cảm giác phát triển + OJT không đều → đưa vào mentor.", options: [ { key: "A", text: "外部研修の回数を倍にする。", isCorrect: false }, { key: "B", text: "メンター制度を導入し、OJTの質を標準化して若手の成長実感を高める。", isCorrect: true }, { key: "C", text: "給与を大幅に引き上げる。", isCorrect: false }, { key: "D", text: "採用基準を厳格化する。", isCorrect: false } ], tags: ["hr", "retention"], businessSituation: "report_document", stimulusKind: "document" },
    { prompt: "以下の複数資料を統合して最適なオフィス選定を行ってください。\n\n不動産資料：「物件X：駅徒歩3分、月額200万円、100名収容。物件Y：駅徒歩10分、月額120万円、80名収容。」\n総務部：「現在の社員数70名、来年10名増員予定。」\n財務部：「オフィスコスト年間1,800万円以内が望ましい。」\n\n最も合理的な選択はどれですか。", scenario: "新オフィス選定の意思決定場面。", explanationVi: "70+10=80人. Y: 80人, 120万/月=1440万/年 (trong budget). X: quá đắt.", options: [ { key: "A", text: "物件Xを選ぶ。立地が良いから。", isCorrect: false }, { key: "B", text: "物件Yが予算内（年間1,440万円）で80名収容でき、来年の増員にも対応できるため最適。", isCorrect: true }, { key: "C", text: "どちらも不適で、別の物件を探す。", isCorrect: false }, { key: "D", text: "リモートワークに完全移行してオフィスをなくす。", isCorrect: false } ], tags: ["office_selection", "decision_making"], businessSituation: "internal_coordination", stimulusKind: "document" },
    { prompt: "以下のデータから販売戦略の最適化を判断してください。\n\nEC売上：「前年比30%増。平均単価4,500円。リピート率45%。」\n実店舗売上：「前年比5%減。平均単価8,000円。リピート率70%。」\nマーケティング：「EC顧客の実店舗への送客施策が未実施。」\n\n売上最大化のために最も効果的な施策はどれですか。", scenario: "EC（電子商取引）と実店舗の販売データ分析場面。", explanationVi: "EC tăng mạnh nhưng đơn giá thấp, cửa hàng đơn giá cao + tỷ lệ quay lại cao → dẫn EC sang cửa hàng.", options: [ { key: "A", text: "実店舗を全て閉鎖してECに集中する。", isCorrect: false }, { key: "B", text: "EC顧客を実店舗に送客するO2O施策を実施し、高単価購入とリピート率向上を図る。", isCorrect: true }, { key: "C", text: "ECの価格を実店舗と同じに引き上げる。", isCorrect: false }, { key: "D", text: "実店舗の品揃えを減らしてコスト削減する。", isCorrect: false } ], tags: ["sales_strategy", "omnichannel"], businessSituation: "meeting", stimulusKind: "document" },
    { prompt: "環境報告書、規制情報、業界トレンドを参照してください。\n\n報告書：「CO2排出量：年間1万トン。目標：2030年までに50%削減。」\n規制：「2027年からカーボンプライシング導入。1トンあたり3,000円の課金。」\n業界：「競合3社は再エネ比率50%を達成。自社は20%。」\n\n経営上最も緊急な対応はどれですか。", scenario: "脱炭素経営戦略の策定場面。", explanationVi: "2027年 carbon pricing = 3000¥/tấn × 10000 = 30M¥/năm. Cần tăng tỷ lệ năng lượng tái tạo.", options: [ { key: "A", text: "2030年まで現状維持で問題ない。", isCorrect: false }, { key: "B", text: "2027年のカーボンプライシングに備え、再エネ比率の引き上げとCO2削減投資を早急に計画する。", isCorrect: true }, { key: "C", text: "カーボンプライシングの課金額を払えばよい。", isCorrect: false }, { key: "D", text: "環境報告書の目標を下方修正する。", isCorrect: false } ], tags: ["sustainability", "compliance"], businessSituation: "report_document", stimulusKind: "document" },
    { prompt: "採用市場データ、自社の待遇データ、退職面談記録を統合して判断してください。\n\nデータ：「エンジニア平均年収（業界）：650万円。自社エンジニア平均年収：520万円。」\n採用：「エンジニア応募数：前年比40%減。内定辞退率：60%。」\n退職面談：「退職理由1位：給与（55%）、2位：技術的チャレンジ不足（30%）」\n\n最も効果的な改善策はどれですか。", scenario: "エンジニア採用・定着率改善の検討場面。", explanationVi: "Lương thấp hơn thị trường 20%, tỷ lệ từ chối 60%. Cần tăng lương + tạo thử thách kỹ thuật.", options: [ { key: "A", text: "採用広告を増やす。", isCorrect: false }, { key: "B", text: "エンジニアの報酬を業界水準に近づけ、技術的に挑戦的なプロジェクトへの参画機会を整備する。", isCorrect: true }, { key: "C", text: "採用基準を下げて応募者を増やす。", isCorrect: false }, { key: "D", text: "エンジニアの業務を外部委託に切り替える。", isCorrect: false } ], tags: ["recruitment", "compensation"], businessSituation: "hr_interview", stimulusKind: "document" },
    { prompt: "以下のプロジェクト後レビュー資料を読んで、最も重要な改善点を選んでください。\n\n成果：「予算内で完了。顧客満足度85%。」\n課題：「要件変更23回（当初計画の5倍）。残業時間：月平均50時間。チーム満足度：55%。」\n顧客コメント：「完成品は良いが、何度も仕様確認があり進捗が見えにくかった。」\n\n次回プロジェクトで最も改善すべき点はどれですか。", scenario: "プロジェクト振り返り（レトロスペクティブ）場面。", explanationVi: "Kết quả OK nhưng thay đổi yêu cầu quá nhiều (23 lần) → cải thiện quy trình quản lý yêu cầu.", options: [ { key: "A", text: "予算をさらに削減する。", isCorrect: false }, { key: "B", text: "要件定義プロセスを強化し、変更管理のルールを明確にすることで、仕様変更の頻度を削減する。", isCorrect: true }, { key: "C", text: "顧客とのコミュニケーションを減らす。", isCorrect: false }, { key: "D", text: "チームの人数を増やして残業を減らす。", isCorrect: false } ], tags: ["project_review", "process_improvement"], businessSituation: "meeting", stimulusKind: "document" },
  ];
}

function getAdditionalQuestions(sectionCode: string): SeedQ[] {
  switch (sectionCode) {
    case "LC_SCENE": return additionalLcScene();
    case "LC_STATEMENT": return additionalLcStatement();
    case "LC_INTEGRATED": return additionalLcIntegrated();
    case "LR_DOCUMENT": return additionalLrDocument();
    case "LR_INTEGRATED": return additionalLrIntegrated();
    case "RC_VOCAB_GRAMMAR": return additionalRcVocabGrammar();
    case "RC_EXPRESSION": return additionalRcExpression();
    case "RC_INTEGRATED": return additionalRcIntegrated();
    default: return []; // LR_SITUATION already at target (5)
  }
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

function buildBlueprintMeta80(level: string) {
  return {
    examFormat: "bjt-mock-full",
    bjtVersion: "current",
    parts: [
      { code: "listening", titleJa: "第1部 聴解", titleVi: "Phần I – Nghe hiểu", timeLimitSec: 2700, sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"] },
      { code: "listening_reading", titleJa: "第2部 聴読解", titleVi: "Phần II – Nghe-Đọc hiểu", timeLimitSec: 1800, sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"] },
      { code: "reading", titleJa: "第3部 読解", titleVi: "Phần III – Đọc hiểu", timeLimitSec: 2700, sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"] },
    ],
    totalTimeMin: 120,
    totalQuestions: 80,
    scoringMethod: "IRT-estimated",
    scoreRange: { min: 0, max: 800 },
    bandMapping: [
      { band: "J5", min: 0, max: 199 }, { band: "J4", min: 200, max: 319 },
      { band: "J3", min: 320, max: 419 }, { band: "J2", min: 420, max: 529 },
      { band: "J1", min: 530, max: 599 }, { band: "J1+", min: 600, max: 800 },
    ],
    sections: [
      { code: "LC_SCENE", type: "listening", titleJa: "聴解 – 場面把握問題", titleVi: "Nghe – Nhận biết tình huống", questionCount: 12, timeLimitSec: 900 },
      { code: "LC_STATEMENT", type: "listening", titleJa: "聴解 – 発言聴解問題", titleVi: "Nghe – Nghe hiểu phát ngôn", questionCount: 10, timeLimitSec: 900 },
      { code: "LC_INTEGRATED", type: "listening", titleJa: "聴解 – 総合聴解問題", titleVi: "Nghe – Tổng hợp nghe hiểu", questionCount: 8, timeLimitSec: 900 },
      { code: "LR_SITUATION", type: "listening_reading", titleJa: "聴読解 – 状況把握問題", titleVi: "Nghe-Đọc – Nhận biết tình huống", questionCount: 5, timeLimitSec: 600 },
      { code: "LR_DOCUMENT", type: "listening_reading", titleJa: "聴読解 – 資料聴読解問題", titleVi: "Nghe-Đọc – Tài liệu nghe-đọc", questionCount: 5, timeLimitSec: 600 },
      { code: "LR_INTEGRATED", type: "listening_reading", titleJa: "聴読解 – 総合聴読解問題", titleVi: "Nghe-Đọc – Tổng hợp nghe-đọc", questionCount: 5, timeLimitSec: 600 },
      { code: "RC_VOCAB_GRAMMAR", type: "reading", titleJa: "読解 – 語彙・文法問題", titleVi: "Đọc – Từ vựng & Ngữ pháp", questionCount: 15, timeLimitSec: 900 },
      { code: "RC_EXPRESSION", type: "reading", titleJa: "読解 – 表現読解問題", titleVi: "Đọc – Đọc hiểu biểu đạt", questionCount: 10, timeLimitSec: 900 },
      { code: "RC_INTEGRATED", type: "reading", titleJa: "読解 – 総合読解問題", titleVi: "Đọc – Tổng hợp đọc hiểu", questionCount: 10, timeLimitSec: 900 },
    ],
    level,
  };
}

async function main() {
  console.log("=== Upgrade ALL exams to 80 questions (BJT standard) ===\n");

  // Find all mock exams (both Set 1 and Set 2)
  const allExams = await prisma.bjtMockTest.findMany({
    where: { type: "mock" },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { slug: "asc" },
  });

  console.log(`Found ${allExams.length} mock exams.\n`);

  let totalAdded = 0;

  for (const exam of allExams) {
    const currentTotal = exam.sections.reduce((s, sec) => s + sec._count.questions, 0);
    console.log(`--- ${exam.slug} (${currentTotal} questions) ---`);

    if (currentTotal >= 80) {
      console.log("  Already at 80+ questions — updating blueprintMeta only.\n");
      await prisma.bjtMockTest.update({
        where: { id: exam.id },
        data: {
          timeLimitSeconds: 7200,
          blueprintMeta: buildBlueprintMeta80(exam.level ?? "BJT") as any,
        },
      });
      continue;
    }

    // Determine difficulty from exam level
    const diff = (exam.level?.includes("J5") || exam.level?.includes("J4")) ? "easy"
      : (exam.level?.includes("J1+") || exam.level?.includes("J1")) ? "hard" : "standard";

    // Add questions to each section
    let examAdded = 0;
    for (const section of exam.sections) {
      const target = TARGET[section.code] ?? section._count.questions;
      const needed = target - section._count.questions;
      if (needed <= 0) {
        console.log(`  ${section.code}: ${section._count.questions}/${target} — OK`);
        continue;
      }

      const additionalQs = getAdditionalQuestions(section.code);
      const toAdd = additionalQs.slice(0, needed);

      if (toAdd.length < needed) {
        console.log(`  ⚠ ${section.code}: only ${toAdd.length}/${needed} additional questions available`);
      }

      const meta = SECTION_META[section.code] ?? { part: "reading", stimulusRequired: false };

      for (const q of toAdd) {
        const question = await prisma.bjtQuestion.create({
          data: {
            sectionId: section.id,
            prompt: q.prompt,
            scenario: q.scenario,
            explanationVi: q.explanationVi,
            skillTag: q.tags[0] ?? "general",
            difficulty: diff,
            sourceType: PROVENANCE,
            status: "published",
            qualityFlags: {
              bjtPart: meta.part,
              bjtSection: section.code,
              businessSituation: q.businessSituation,
              stimulusKind: q.stimulusKind,
              stimulusRequired: meta.stimulusRequired,
              hasAudioStimulus: false,
              hasVisualStimulus: false,
              distractorQuality: "generated",
              difficultySource: "estimated",
              itemReviewed: false,
              license: LICENSE,
              level: exam.level ?? "BJT",
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
        examAdded++;
        totalAdded++;
      }

      console.log(`  ${section.code}: ${section._count.questions} → ${section._count.questions + toAdd.length} (+${toAdd.length})`);
    }

    // Update blueprintMeta and time
    await prisma.bjtMockTest.update({
      where: { id: exam.id },
      data: {
        timeLimitSeconds: 7200,
        blueprintMeta: buildBlueprintMeta80(exam.level ?? "BJT") as any,
      },
    });

    console.log(`  Added ${examAdded} questions. Updated to 7200s (120 min).\n`);
  }

  // Verification
  console.log("=== Verification ===");
  const verified = await prisma.bjtMockTest.findMany({
    where: { type: "mock" },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { slug: "asc" },
  });

  for (const exam of verified) {
    const total = exam.sections.reduce((s, sec) => s + sec._count.questions, 0);
    const bp = exam.blueprintMeta as any;
    const sectionDetail = exam.sections.map((s) => `${s.code}:${s._count.questions}`).join(", ");
    console.log(`  ${exam.slug}: ${total}q, ${exam.sections.length} sections, ${exam.timeLimitSeconds}s, bp.totalQ=${bp?.totalQuestions}`);
    console.log(`    ${sectionDetail}`);
  }

  console.log(`\n✅ Done! Added ${totalAdded} questions total across all exams.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
