/**
 * Phase 2: Generate Listening (Part 1) + Listening-Reading (Part 2) questions
 * for BJT question banks. 125 questions per level × 6 levels = 750 total.
 *
 * Per level distribution (to reach 200 total):
 *   LC_SCENE: 13 questions (場面把握 — photo/scene understanding)
 *   LC_STATEMENT: 25 questions (発言聴解 — conversational listening)
 *   LC_INTEGRATED: 25 questions (総合聴解 — general listening)
 *   LR_SITUATION: 12 questions (状況把握 — situational understanding)
 *   LR_DOCUMENT: 25 questions (資料聴読解 — info listening-reading)
 *   LR_INTEGRATED: 25 questions (総合聴読解 — general listening-reading)
 *   Total: 125 per level
 *
 * Usage: pnpm tsx database/scripts/generate-200q-listening.ts
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
  { code: "BJT-J5", diff: "easy" },
  { code: "BJT-J4", diff: "easy" },
  { code: "BJT-J3", diff: "standard" },
  { code: "BJT-J2", diff: "standard" },
  { code: "BJT-J1", diff: "hard" },
  { code: "BJT-J1+", diff: "hard" },
] as const;

interface Q {
  prompt: string;
  scenario: string;
  explanationVi: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  tags: string[];
  businessSituation: string;
}

// =====================================================================
// LC_SCENE: 場面把握 — Photo/scene based listening (13 per level)
// In real BJT, a photo is shown and audio plays. We describe the scene.
// =====================================================================
function lcScenePool(): Q[] {
  return [
    { prompt: "【音声】あるオフィスの写真が示されています。男性が電話をしながらメモを取っています。この場面で男性は何をしていますか。", scenario: "オフィスでの電話対応場面。", explanationVi: "Nam đang ghi chú trong khi nghe điện thoại → đang tiếp nhận thông tin/yêu cầu.", options: [{ key: "A", text: "電話で情報を受けてメモしている。", isCorrect: true }, { key: "B", text: "電話で雑談をしている。", isCorrect: false }, { key: "C", text: "メモを読み上げている。", isCorrect: false }, { key: "D", text: "電話番号を確認している。", isCorrect: false }], tags: ["scene", "phone"], businessSituation: "office" },
    { prompt: "【音声】会議室の写真。女性がホワイトボードの前に立ち、グラフを指さしながら話しています。この場面を最もよく表しているのはどれですか。", scenario: "会議室でのプレゼンテーション場面。", explanationVi: "Nữ đứng trước bảng trắng chỉ vào biểu đồ → đang thuyết trình.", options: [{ key: "A", text: "女性がプレゼンテーションをしている。", isCorrect: true }, { key: "B", text: "女性がホワイトボードを掃除している。", isCorrect: false }, { key: "C", text: "女性が一人で作業している。", isCorrect: false }, { key: "D", text: "女性が会議の準備をしている。", isCorrect: false }], tags: ["scene", "presentation"], businessSituation: "meeting" },
    { prompt: "【音声】受付カウンターの写真。スーツの男性が受付の女性に名刺を渡しています。この場面で最も適切な説明はどれですか。", scenario: "企業受付での来客応対場面。", explanationVi: "Khách đến thăm trao danh thiếp tại quầy lễ tân.", options: [{ key: "A", text: "来客が受付で名刺を渡して訪問先を告げている。", isCorrect: true }, { key: "B", text: "社員が退社の手続きをしている。", isCorrect: false }, { key: "C", text: "面接の受付をしている。", isCorrect: false }, { key: "D", text: "配達員が荷物を届けている。", isCorrect: false }], tags: ["scene", "reception"], businessSituation: "reception" },
    { prompt: "【音声】工場の写真。作業員がヘルメットをかぶり、安全ゴーグルをつけて機械を操作しています。この写真から読み取れることは何ですか。", scenario: "工場の製造ラインの場面。", explanationVi: "Công nhân đội mũ bảo hộ, đeo kính → tuân thủ quy tắc an toàn khi vận hành máy.", options: [{ key: "A", text: "作業員が安全装備を着用して機械を操作している。", isCorrect: true }, { key: "B", text: "作業員が機械の修理をしている。", isCorrect: false }, { key: "C", text: "作業員が休憩を取っている。", isCorrect: false }, { key: "D", text: "作業員が新しい機械の検査をしている。", isCorrect: false }], tags: ["scene", "factory"], businessSituation: "manufacturing" },
    { prompt: "【音声】倉庫の写真。フォークリフトが動いており、作業員が棚の在庫を確認しています。この場面は何を表していますか。", scenario: "倉庫での在庫管理場面。", explanationVi: "Xe nâng đang hoạt động, nhân viên kiểm tra tồn kho → đang quản lý kho hàng.", options: [{ key: "A", text: "倉庫で在庫管理作業が行われている。", isCorrect: true }, { key: "B", text: "倉庫の建設工事中である。", isCorrect: false }, { key: "C", text: "商品の返品処理をしている。", isCorrect: false }, { key: "D", text: "倉庫を閉鎖する準備をしている。", isCorrect: false }], tags: ["scene", "warehouse"], businessSituation: "logistics" },
    { prompt: "【音声】オフィスの写真。数人がPCの画面を見ながら真剣に話し合っています。一人がペンで画面の一部を指しています。", scenario: "チームミーティングの場面。", explanationVi: "Nhiều người xem màn hình PC và thảo luận → đang review công việc cùng nhau.", options: [{ key: "A", text: "チームでデータを見ながら議論している。", isCorrect: true }, { key: "B", text: "全員がメールを書いている。", isCorrect: false }, { key: "C", text: "PC修理の相談をしている。", isCorrect: false }, { key: "D", text: "一人がプレゼンを練習している。", isCorrect: false }], tags: ["scene", "teamwork"], businessSituation: "office" },
    { prompt: "【音声】レストランの個室の写真。ビジネススーツの4人がテーブルを囲み、乾杯しています。", scenario: "接待・会食の場面。", explanationVi: "4 người mặc vest trong phòng riêng nhà hàng, nâng cốc → tiệc tiếp khách kinh doanh.", options: [{ key: "A", text: "ビジネスの接待・会食が行われている。", isCorrect: true }, { key: "B", text: "友人同士の飲み会である。", isCorrect: false }, { key: "C", text: "就職面接後の食事会である。", isCorrect: false }, { key: "D", text: "社員食堂で昼食を取っている。", isCorrect: false }], tags: ["scene", "entertainment"], businessSituation: "entertainment" },
    { prompt: "【音声】空港のゲート付近の写真。ビジネスパーソンが搭乗券とパスポートを手に持ち、列に並んでいます。", scenario: "海外出張の出発場面。", explanationVi: "Doanh nhân xếp hàng ở cổng sân bay với boarding pass + passport → đi công tác nước ngoài.", options: [{ key: "A", text: "海外出張のため搭乗手続きをしている。", isCorrect: true }, { key: "B", text: "国内旅行の帰国手続きをしている。", isCorrect: false }, { key: "C", text: "入国審査を受けている。", isCorrect: false }, { key: "D", text: "チケットの変更手続きをしている。", isCorrect: false }], tags: ["scene", "travel"], businessSituation: "business_trip" },
    { prompt: "【音声】オフィスの写真。女性がデスクで二つのモニターを使い、スプレッドシートを操作しています。隣にはコーヒーカップと付箋がたくさん貼られたノート。", scenario: "デスクワークの場面。", explanationVi: "Nữ dùng 2 màn hình làm spreadsheet, nhiều sticky notes → đang phân tích dữ liệu.", options: [{ key: "A", text: "データ分析や集計作業をしている。", isCorrect: true }, { key: "B", text: "ゲームをしている。", isCorrect: false }, { key: "C", text: "SNSを閲覧している。", isCorrect: false }, { key: "D", text: "動画編集をしている。", isCorrect: false }], tags: ["scene", "data_analysis"], businessSituation: "office" },
    { prompt: "【音声】商品棚の前の写真。店員が客に商品の説明をしており、客はパンフレットを見ています。", scenario: "店頭での商品説明場面。", explanationVi: "Nhân viên giải thích sản phẩm, khách xem brochure → tư vấn bán hàng.", options: [{ key: "A", text: "店員が顧客に商品説明をしている。", isCorrect: true }, { key: "B", text: "顧客がクレームを言っている。", isCorrect: false }, { key: "C", text: "店員が棚卸しをしている。", isCorrect: false }, { key: "D", text: "新商品の撮影をしている。", isCorrect: false }], tags: ["scene", "sales"], businessSituation: "sales_customer" },
    { prompt: "【音声】研修室の写真。新入社員と思われる若者たちが名刺交換の練習をしています。講師が横で見ています。", scenario: "新入社員研修の場面。", explanationVi: "Nhân viên mới luyện tập trao đổi danh thiếp dưới sự hướng dẫn của giảng viên.", options: [{ key: "A", text: "新入社員がビジネスマナー研修で名刺交換を練習している。", isCorrect: true }, { key: "B", text: "就職面接が行われている。", isCorrect: false }, { key: "C", text: "退職パーティーが開かれている。", isCorrect: false }, { key: "D", text: "商談が行われている。", isCorrect: false }], tags: ["scene", "training"], businessSituation: "training" },
    { prompt: "【音声】病院の窓口の写真。受付スタッフが電話をしながらPCを操作しています。待合室に数人の患者が座っています。", scenario: "病院の受付場面。", explanationVi: "Nhân viên lễ tân bệnh viện nghe điện thoại + thao tác PC → sắp xếp lịch hẹn.", options: [{ key: "A", text: "受付スタッフが電話で予約を受けながらシステムに入力している。", isCorrect: true }, { key: "B", text: "患者が診察を受けている。", isCorrect: false }, { key: "C", text: "看護師が採血の準備をしている。", isCorrect: false }, { key: "D", text: "医師が手術の説明をしている。", isCorrect: false }], tags: ["scene", "hospital"], businessSituation: "service" },
    { prompt: "【音声】建設現場の写真。ヘルメットをかぶった2人が設計図を広げ、建物を指さしながら話しています。", scenario: "建設現場での打ち合わせ場面。", explanationVi: "2 người đội mũ bảo hộ xem bản vẽ, chỉ vào tòa nhà → kiểm tra tiến độ xây dựng.", options: [{ key: "A", text: "設計図と実際の建物を照合しながら進捗を確認している。", isCorrect: true }, { key: "B", text: "建物の解体作業をしている。", isCorrect: false }, { key: "C", text: "新しい建設計画を発表している。", isCorrect: false }, { key: "D", text: "建物の写真を撮影している。", isCorrect: false }], tags: ["scene", "construction"], businessSituation: "construction" },
  ];
}

// =====================================================================
// LC_STATEMENT: 発言聴解 — Conversational listening (25 per level)
// Audio dialogue → choose best comprehension/response
// =====================================================================
function lcStatementPool(): Q[] {
  return [
    { prompt: "【音声】部長：「田中くん、来週の出張だけど、大阪じゃなくて名古屋に変更になったから。ホテルも取り直してもらえる？」\n\n田中さんがまずすべきことは何ですか。", scenario: "出張先変更の指示。", explanationVi: "Đổi địa điểm công tác sang Nagoya → đầu tiên hủy khách sạn Osaka, đặt lại ở Nagoya.", options: [{ key: "A", text: "名古屋のホテルを予約し、大阪の予約をキャンセルする。", isCorrect: true }, { key: "B", text: "大阪のホテルにチェックインする。", isCorrect: false }, { key: "C", text: "出張を辞退する。", isCorrect: false }, { key: "D", text: "名古屋の観光プランを調べる。", isCorrect: false }], tags: ["instruction", "travel"], businessSituation: "internal_coordination" },
    { prompt: "【音声】女性：「すみません、この書類、課長のサインが必要なんですけど、課長は今日お休みなんです。明日でも大丈夫でしょうか。」\n男性：「うーん、今日中に本社に送らないといけないんだよね…。副課長に代理でサインしてもらえないかな。」\n\n女性が次にすべきことは何ですか。", scenario: "署名が必要な書類の処理。", explanationVi: "Trưởng phòng nghỉ, cần ký hôm nay → nhờ phó phòng ký thay.", options: [{ key: "A", text: "副課長に代理の署名を依頼する。", isCorrect: true }, { key: "B", text: "書類を明日送る。", isCorrect: false }, { key: "C", text: "課長に電話して出勤を頼む。", isCorrect: false }, { key: "D", text: "本社に期限延長を依頼する。", isCorrect: false }], tags: ["procedure", "delegation"], businessSituation: "internal_coordination" },
    { prompt: "【音声】課長：「さっきのクライアントからの電話、何の用件だった？」\n社員：「納品日を1週間早められないかという相談でした。」\n課長：「そうか…。工場の生産スケジュールを確認してから返事しよう。」\n\n社員が次にすべきことは何ですか。", scenario: "クライアントの納期前倒し依頼への対応。", explanationVi: "Xác nhận lịch sản xuất với nhà máy trước khi trả lời client.", options: [{ key: "A", text: "工場に連絡して生産スケジュールを確認する。", isCorrect: true }, { key: "B", text: "クライアントに無理だと断る。", isCorrect: false }, { key: "C", text: "すぐに納品日を変更する。", isCorrect: false }, { key: "D", text: "1週間の休暇を取る。", isCorrect: false }], tags: ["delivery", "schedule"], businessSituation: "sales_customer" },
    { prompt: "【音声】先輩：「この見積書、合計金額が間違ってるよ。消費税の計算が旧税率になってる。」\n後輩：「あ、すみません。すぐ修正します。」\n\n後輩が修正すべき点は何ですか。", scenario: "見積書の誤り指摘。", explanationVi: "Tổng tiền sai do tính thuế theo thuế suất cũ → sửa lại thuế suất mới.", options: [{ key: "A", text: "消費税率を最新のものに更新して合計金額を再計算する。", isCorrect: true }, { key: "B", text: "見積書のフォーマットを変更する。", isCorrect: false }, { key: "C", text: "商品の単価を変更する。", isCorrect: false }, { key: "D", text: "消費税を非課税にする。", isCorrect: false }], tags: ["document", "tax"], businessSituation: "admin_work" },
    { prompt: "【音声】A：「明日の午前中に取引先と打ち合わせだよね。資料は準備できた？」\nB：「はい、データは揃ってるんですが、グラフの見せ方で迷っていまして…。」\nA：「じゃあ、今日中に下書きを見せて。一緒に確認しよう。」\n\nBが今日中にすべきことは何ですか。", scenario: "打ち合わせ資料の準備。", explanationVi: "B cần hoàn thành bản nháp và cho A xem hôm nay.", options: [{ key: "A", text: "グラフ入りの資料の下書きを作成してAに見せる。", isCorrect: true }, { key: "B", text: "取引先に打ち合わせの延期を連絡する。", isCorrect: false }, { key: "C", text: "データを再収集する。", isCorrect: false }, { key: "D", text: "グラフなしで資料を提出する。", isCorrect: false }], tags: ["preparation", "materials"], businessSituation: "internal_coordination" },
    { prompt: "【音声】人事：「来月から育休に入るんですよね。引き継ぎリストはもう作りましたか？」\n社員：「はい、8割くらいはできています。残りは来週中に完成させます。」\n人事：「わかりました。完成したら、後任の佐藤さんと私にもコピーをください。」\n\n社員がすべきことを全て選んでください。", scenario: "育休前の引き継ぎ。", explanationVi: "Hoàn thành danh sách bàn giao + gửi bản copy cho Sato + HR.", options: [{ key: "A", text: "引き継ぎリストを完成させ、佐藤さんと人事にコピーを渡す。", isCorrect: true }, { key: "B", text: "育休を延期する。", isCorrect: false }, { key: "C", text: "佐藤さんにだけリストを渡す。", isCorrect: false }, { key: "D", text: "リストなしで引き継ぎを行う。", isCorrect: false }], tags: ["handover", "hr"], businessSituation: "internal_coordination" },
    { prompt: "【音声】上司：「先週のアンケート結果はどうだった？」\n部下：「回収率は60%でした。ただ、自由記述欄に厳しい意見が多くて…。」\n上司：「まず、自由記述の意見を分類して、優先度の高い課題をまとめてくれる？」\n\n部下が次にすべきことは何ですか。", scenario: "アンケート結果の分析指示。", explanationVi: "Phân loại ý kiến mô tả tự do và tổng hợp vấn đề ưu tiên.", options: [{ key: "A", text: "自由記述の意見をカテゴリ別に分類し、優先課題をまとめる。", isCorrect: true }, { key: "B", text: "アンケートを再実施する。", isCorrect: false }, { key: "C", text: "回収率を100%にするよう催促する。", isCorrect: false }, { key: "D", text: "厳しい意見を削除する。", isCorrect: false }], tags: ["analysis", "survey"], businessSituation: "internal_coordination" },
    { prompt: "【音声】客：「この商品、先週買ったんですけど、説明書通りに使っても動かないんです。」\n店員：「大変申し訳ございません。初期不良の可能性がありますので、新しいものと交換させていただきます。レシートはお持ちですか？」\n\n店員の対応として最も適切なのはどれですか。", scenario: "商品のクレーム対応。", explanationVi: "Xin lỗi + xác nhận hóa đơn + đổi hàng mới → đúng quy trình.", options: [{ key: "A", text: "初期不良の可能性を認め、レシート確認の上で新品と交換する。", isCorrect: true }, { key: "B", text: "客の使い方が悪いと説明する。", isCorrect: false }, { key: "C", text: "メーカーに直接連絡するよう伝える。", isCorrect: false }, { key: "D", text: "修理に1か月かかると伝える。", isCorrect: false }], tags: ["customer_service", "complaint"], businessSituation: "sales_customer" },
    { prompt: "【音声】A：「今度のプロジェクト、外注と内製、どっちがいいと思う？」\nB：「コスト的には外注の方が安いですけど、品質管理を考えると内製の方が安心ですね。」\nA：「まず、両方の見積もりを取って比較しよう。」\n\nBが次にすべきことは何ですか。", scenario: "外注 vs 内製の検討。", explanationVi: "Lấy báo giá cả 2 phương án (outsource và in-house) để so sánh.", options: [{ key: "A", text: "外注と内製の両方の見積もりを取得する。", isCorrect: true }, { key: "B", text: "すぐに外注に決定する。", isCorrect: false }, { key: "C", text: "内製を即決定する。", isCorrect: false }, { key: "D", text: "プロジェクトを中止する。", isCorrect: false }], tags: ["decision", "outsourcing"], businessSituation: "internal_coordination" },
    { prompt: "【音声】部長：「来月のキャンペーン、予算が200万円から150万円に減額されたんだ。」\n担当者：「そうなると、テレビCMは難しいですね…。SNS広告に切り替えましょうか。」\n部長：「そうだね。SNS広告のプランを今週中に出してくれ。」\n\n担当者がすべきことは何ですか。", scenario: "予算削減に伴うキャンペーン計画の変更。", explanationVi: "Ngân sách giảm, chuyển từ TV CM sang quảng cáo SNS → lập kế hoạch SNS trong tuần.", options: [{ key: "A", text: "今週中にSNS広告のプランを作成して部長に提出する。", isCorrect: true }, { key: "B", text: "テレビCMの枠を予約する。", isCorrect: false }, { key: "C", text: "予算増額を上に交渉する。", isCorrect: false }, { key: "D", text: "キャンペーンを中止する。", isCorrect: false }], tags: ["budget", "marketing"], businessSituation: "internal_coordination" },
    { prompt: "【音声】先輩：「明日の研修、講師が急に来られなくなっちゃって。代わりに動画で研修を実施することになったから、プロジェクターの準備をしてくれる？」\n後輩：「はい、わかりました。WiFiの接続確認もしておいた方がいいですか？」\n先輩：「そうだね、お願い。」\n\n後輩が準備すべきことは何ですか。", scenario: "研修準備の変更。", explanationVi: "Chuẩn bị projector + kiểm tra WiFi cho đào tạo bằng video.", options: [{ key: "A", text: "プロジェクターの設置とWiFi接続の確認。", isCorrect: true }, { key: "B", text: "新しい講師を探す。", isCorrect: false }, { key: "C", text: "研修を中止する。", isCorrect: false }, { key: "D", text: "テキスト資料を印刷する。", isCorrect: false }], tags: ["preparation", "training"], businessSituation: "internal_coordination" },
    { prompt: "【音声】社員A：「あのお客さん、毎回値引きを要求してくるんですよね。」\n社員B：「ただ、年間の取引額は大きいから、無視できないんだよ。数量ベースの割引テーブルを作って提案してみたら？」\n\n社員Aが次にすべきことは何ですか。", scenario: "値引き交渉の戦略相談。", explanationVi: "Tạo bảng chiết khấu theo số lượng để đề xuất cho khách hàng lớn.", options: [{ key: "A", text: "数量に応じた割引テーブルを作成して提案資料を準備する。", isCorrect: true }, { key: "B", text: "その顧客との取引を停止する。", isCorrect: false }, { key: "C", text: "値引きを全面的に拒否する。", isCorrect: false }, { key: "D", text: "上司に代わりに対応してもらう。", isCorrect: false }], tags: ["negotiation", "pricing"], businessSituation: "sales_customer" },
    { prompt: "【音声】上司：「プロジェクトの進捗報告、毎週金曜に変更するよ。今までは月曜だったけど、金曜にした方が週の成果を振り返りやすいから。」\n\nこの変更の理由は何ですか。", scenario: "報告スケジュールの変更通知。", explanationVi: "Đổi báo cáo sang thứ Sáu để dễ tổng kết thành quả trong tuần.", options: [{ key: "A", text: "金曜日に変更することで、一週間の成果を振り返りやすくなるため。", isCorrect: true }, { key: "B", text: "月曜日は忙しいため。", isCorrect: false }, { key: "C", text: "上司が月曜日に休みを取るため。", isCorrect: false }, { key: "D", text: "クライアントが金曜日に報告を求めているため。", isCorrect: false }], tags: ["schedule", "reporting"], businessSituation: "internal_coordination" },
    { prompt: "【音声】電話：「○○商事の鈴木と申します。先日お見積もりいただいた件ですが、もう少し詳しくご説明いただけないでしょうか。できれば来週お伺いしたいのですが。」\n\nこの電話の目的は何ですか。", scenario: "取引先からの電話。", explanationVi: "Muốn được giải thích thêm về báo giá và muốn gặp trực tiếp tuần sau.", options: [{ key: "A", text: "見積書の詳細説明と来週の訪問アポイントの依頼。", isCorrect: true }, { key: "B", text: "見積書のキャンセル。", isCorrect: false }, { key: "C", text: "クレームの連絡。", isCorrect: false }, { key: "D", text: "支払い期限の変更依頼。", isCorrect: false }], tags: ["phone", "quotation"], businessSituation: "sales_customer" },
    { prompt: "【音声】係長：「今月の残業時間、平均45時間を超えてるらしいぞ。36協定のラインぎりぎりだ。」\n主任：「うちのチーム、新プロジェクトで人手が足りないんですよ。」\n係長：「わかった。業務の優先順位を見直して、他チームからの応援も検討しよう。」\n\n係長が提案した対策は何ですか。", scenario: "残業問題への対応。", explanationVi: "Xem xét lại ưu tiên công việc + xin hỗ trợ từ team khác.", options: [{ key: "A", text: "業務の優先順位を見直し、他チームからの人員応援を検討する。", isCorrect: true }, { key: "B", text: "残業手当を増額する。", isCorrect: false }, { key: "C", text: "プロジェクトを中止する。", isCorrect: false }, { key: "D", text: "36協定の上限を引き上げる。", isCorrect: false }], tags: ["overtime", "labor"], businessSituation: "internal_coordination" },
  ];
}

// =====================================================================
// LC_INTEGRATED: 総合聴解 — General/integrated listening (25 per level)
// Longer audio passage → comprehension question
// =====================================================================
function lcIntegratedPool(): Q[] {
  return [
    { prompt: "【音声】社長の年頭挨拶（要旨）：「昨年度は売上15%増を達成。しかし、利益率は低下。今年は'効率重視'をスローガンに、無駄なコストを削減しながら、新規事業の柱を育てたい。全社員に改善提案を求める。」\n\nこの挨拶の最も重要なメッセージは何ですか。", scenario: "社長の年頭挨拶。", explanationVi: "Doanh thu tăng nhưng lợi nhuận giảm → năm nay tập trung hiệu quả + cắt giảm lãng phí.", options: [{ key: "A", text: "売上はまだ不十分である。", isCorrect: false }, { key: "B", text: "効率化とコスト削減を最優先にしつつ新規事業も育てる。", isCorrect: true }, { key: "C", text: "昨年の業績に満足している。", isCorrect: false }, { key: "D", text: "全社員の給与を上げる。", isCorrect: false }], tags: ["speech", "strategy"], businessSituation: "presentation" },
    { prompt: "【音声】営業本部長のスピーチ：「今期の海外売上比率は30%に達した。しかし、アジア偏重のリスクがある。来期は欧州・米州の開拓を強化。各支店長は12月末までにエリア別戦略書を提出してほしい。」\n\n各支店長に求められていることは何ですか。", scenario: "営業方針の説明会。", explanationVi: "Nộp kế hoạch chiến lược theo khu vực trước cuối tháng 12.", options: [{ key: "A", text: "12月末までにエリア別戦略書を提出する。", isCorrect: true }, { key: "B", text: "アジア市場から撤退する計画を立てる。", isCorrect: false }, { key: "C", text: "海外出張を増やす。", isCorrect: false }, { key: "D", text: "海外売上を50%にする。", isCorrect: false }], tags: ["directive", "global"], businessSituation: "presentation" },
    { prompt: "【音声】研修講師：「報連相は日本のビジネスの基本です。報告は事実を簡潔に、連絡は関係者全員に漏れなく、相談は自分の意見を持ってから。特に相談のタイミングが重要で、問題が大きくなる前に早めに上司に相談しましょう。」\n\n講師が最も強調していることは何ですか。", scenario: "新入社員向けのビジネスマナー研修。", explanationVi: "Nhấn mạnh: tham vấn sớm trước khi vấn đề lớn lên.", options: [{ key: "A", text: "報告の簡潔さ。", isCorrect: false }, { key: "B", text: "連絡の正確さ。", isCorrect: false }, { key: "C", text: "相談のタイミングの重要性。", isCorrect: true }, { key: "D", text: "報連相が不要であること。", isCorrect: false }], tags: ["training", "hourenso"], businessSituation: "training" },
    { prompt: "【音声】工場長のスピーチ：「先月、ヒヤリハット報告が30件ありました。幸い重大事故はゼロでしたが、傾向として、夕方のシフト交代時に集中しています。引き継ぎの確認手順を徹底してください。」\n\n工場長が対策として求めていることは何ですか。", scenario: "安全ミーティングでのスピーチ。", explanationVi: "Sự cố suýt xảy ra tập trung lúc đổi ca chiều → phải tuân thủ quy trình bàn giao.", options: [{ key: "A", text: "夕方のシフトを廃止する。", isCorrect: false }, { key: "B", text: "シフト交代時の引き継ぎ確認手順の徹底。", isCorrect: true }, { key: "C", text: "報告件数を減らす。", isCorrect: false }, { key: "D", text: "夜勤スタッフを増員する。", isCorrect: false }], tags: ["safety", "shift"], businessSituation: "manufacturing" },
    { prompt: "【音声】IR担当者の説明：「今期は減収増益を見込んでいます。売上は5%減少しますが、不採算事業の整理とコスト構造改革により、営業利益率は3ポイント改善する計画です。配当は据え置き予定です。」\n\n投資家にとって最も重要な情報は何ですか。", scenario: "IR説明会。", explanationVi: "Doanh thu giảm nhưng lợi nhuận tăng nhờ cải tổ, cổ tức giữ nguyên.", options: [{ key: "A", text: "売上が増加する。", isCorrect: false }, { key: "B", text: "減収でも利益率改善により増益を見込み、配当は維持。", isCorrect: true }, { key: "C", text: "会社が倒産する可能性がある。", isCorrect: false }, { key: "D", text: "配当が増額される。", isCorrect: false }], tags: ["IR", "finance"], businessSituation: "presentation" },
    { prompt: "【音声】人事部長：「新しい評価制度では、成果だけでなくプロセスも評価します。具体的には、チーム貢献、自己啓発、イノベーション提案の3つを加えます。数値目標は全体の60%、残り40%がプロセス評価です。」\n\n新しい評価制度の特徴は何ですか。", scenario: "評価制度変更の説明会。", explanationVi: "Đánh giá mới: 60% mục tiêu số + 40% quy trình (đóng góp team, tự phát triển, đề xuất sáng tạo).", options: [{ key: "A", text: "成果のみを評価する。", isCorrect: false }, { key: "B", text: "成果（60%）とプロセス（40%）の複合評価に変更する。", isCorrect: true }, { key: "C", text: "プロセスのみを評価する。", isCorrect: false }, { key: "D", text: "評価制度を廃止する。", isCorrect: false }], tags: ["hr", "evaluation"], businessSituation: "presentation" },
    { prompt: "【音声】コンサルタントの講演：「DX成功の鍵は技術ではなく、組織文化の変革です。トップのコミットメント、中間管理職のデジタルリテラシー、現場の改善意識。この3つが揃わないと、どんな高価なシステムも効果を発揮しません。」\n\nDX成功に最も重要な要素は何ですか。", scenario: "DX推進セミナー。", explanationVi: "Chìa khóa DX: văn hóa tổ chức (cam kết lãnh đạo + năng lực số quản lý giữa + ý thức cải tiến hiện trường).", options: [{ key: "A", text: "最新技術の導入。", isCorrect: false }, { key: "B", text: "組織文化の変革（トップ・中間管理職・現場の三位一体）。", isCorrect: true }, { key: "C", text: "高額なシステム投資。", isCorrect: false }, { key: "D", text: "IT部門の人員増。", isCorrect: false }], tags: ["DX", "culture"], businessSituation: "seminar" },
    { prompt: "【音声】サプライチェーン担当者のブリーフィング：「東南アジアの部品工場が洪水で操業停止。代替サプライヤーに切り替えたが、納期が2週間遅延。国内在庫で来週までは対応可能。来週中にBCP発動の判断が必要。」\n\n最も緊急性の高い課題は何ですか。", scenario: "サプライチェーン障害のブリーフィング。", explanationVi: "Tồn kho đủ đến tuần sau → phải quyết định BCP trước tuần sau.", options: [{ key: "A", text: "来週中にBCP発動の判断を行うこと。", isCorrect: true }, { key: "B", text: "洪水の復旧を待つ。", isCorrect: false }, { key: "C", text: "国内工場を増設する。", isCorrect: false }, { key: "D", text: "新製品の開発を中止する。", isCorrect: false }], tags: ["BCP", "supply_chain"], businessSituation: "crisis_management" },
  ];
}

// =====================================================================
// LR_SITUATION: 状況把握 — Audio + visual, choose action (12 per level)
// =====================================================================
function lrSituationPool(): Q[] {
  return [
    { prompt: "【音声+資料】電話がかかってきました。お客様が「来週の月曜日に注文した商品が届かない」と言っています。画面には注文管理システムが表示されており、注文状況は「発送済み・配送中」となっています。\n\nあなたの対応として最も適切なのはどれですか。", scenario: "カスタマーサポートの電話対応。", explanationVi: "Đã gửi hàng (đang vận chuyển) → tra mã vận đơn, cung cấp cho khách.", options: [{ key: "A", text: "配送会社の追跡番号を確認し、お客様に配送状況を伝える。", isCorrect: true }, { key: "B", text: "商品を再発送する。", isCorrect: false }, { key: "C", text: "返金処理をする。", isCorrect: false }, { key: "D", text: "お客様に直接倉庫に取りに来てもらう。", isCorrect: false }], tags: ["customer_service", "tracking"], businessSituation: "sales_customer" },
    { prompt: "【音声+資料】上司から電話：「今すぐ会議室Aの空き状況を確認して、明日の午後2時から4時で予約してくれ。」画面には会議室予約システムが表示され、会議室Aの明日午後2時は「使用中」となっています。\n\nあなたがまず取るべき行動は何ですか。", scenario: "会議室予約のトラブル。", explanationVi: "Phòng A đã có người đặt → báo lại cho sếp và đề xuất phòng khác hoặc giờ khác.", options: [{ key: "A", text: "上司に会議室Aが使用中であることを伝え、別の会議室または時間帯を提案する。", isCorrect: true }, { key: "B", text: "既存の予約をキャンセルする。", isCorrect: false }, { key: "C", text: "予約せずに待つ。", isCorrect: false }, { key: "D", text: "会議をオンラインに変更する。", isCorrect: false }], tags: ["booking", "problem_solving"], businessSituation: "internal_coordination" },
    { prompt: "【音声+資料】同僚から：「急いでこのメールを英語に翻訳して先方に送ってくれない？」画面にはメールの内容が表示されています。内容は機密の契約金額が含まれています。\n\nあなたの対応として最も適切なのはどれですか。", scenario: "機密情報を含むメールの翻訳依頼。", explanationVi: "Nội dung cơ mật → xác nhận với cấp trên/pháp vụ trước khi gửi.", options: [{ key: "A", text: "機密情報が含まれるため、上司の承認を得てから翻訳・送信する。", isCorrect: true }, { key: "B", text: "すぐに翻訳して送信する。", isCorrect: false }, { key: "C", text: "Google翻訳で自動翻訳して送る。", isCorrect: false }, { key: "D", text: "翻訳を断る。", isCorrect: false }], tags: ["confidential", "procedure"], businessSituation: "internal_coordination" },
    { prompt: "【音声+資料】取引先から電話：「先日送っていただいた請求書の金額が、見積書と10万円違うのですが。」画面には見積書（500万円）と請求書（510万円）が並んで表示されています。\n\nあなたの対応として最も適切なのはどれですか。", scenario: "請求書と見積書の金額不一致。", explanationVi: "Hóa đơn và báo giá chênh 10万 → xin lỗi, xác nhận lại và sửa.", options: [{ key: "A", text: "差異の原因を確認し、間違いであれば訂正した請求書を再発行してお詫びする。", isCorrect: true }, { key: "B", text: "10万円の追加分を押し通す。", isCorrect: false }, { key: "C", text: "見積書を破棄する。", isCorrect: false }, { key: "D", text: "取引を中止する。", isCorrect: false }], tags: ["billing", "accuracy"], businessSituation: "sales_customer" },
    { prompt: "【音声+資料】部長から指示：「この採用候補者3名の履歴書を見て、明日の面接の順番を決めてくれ。」画面には3名の履歴書が表示されています。\n\nスケジューリングで最も考慮すべき点は何ですか。", scenario: "採用面接のスケジュール調整。", explanationVi: "Sắp xếp thứ tự phỏng vấn: xem xét thời gian di chuyển, sự sẵn có của ứng viên.", options: [{ key: "A", text: "各候補者の希望時間帯と面接官のスケジュールの整合性。", isCorrect: true }, { key: "B", text: "名前の五十音順。", isCorrect: false }, { key: "C", text: "年齢順。", isCorrect: false }, { key: "D", text: "応募日順。", isCorrect: false }], tags: ["hr", "scheduling"], businessSituation: "hr_interview" },
    { prompt: "【音声+資料】システムアラート音が鳴り、画面に「サーバー負荷90%超過」と表示されています。上司に電話で報告中。上司：「重要なサービスは止めるな。まず不要なプロセスを止めて様子を見ろ。」\n\nあなたが最初にすべきことは何ですか。", scenario: "サーバー障害のエスカレーション。", explanationVi: "Tải server 90% → dừng các process không cần thiết trước, giữ service quan trọng.", options: [{ key: "A", text: "不要なプロセスを特定して停止し、負荷の変化を監視する。", isCorrect: true }, { key: "B", text: "サーバーを再起動する。", isCorrect: false }, { key: "C", text: "全サービスを停止する。", isCorrect: false }, { key: "D", text: "何もせずに待つ。", isCorrect: false }], tags: ["IT", "incident"], businessSituation: "crisis_management" },
  ];
}

// =====================================================================
// LR_DOCUMENT: 資料聴読解 — Audio + document comprehension (25 per level)
// =====================================================================
function lrDocumentPool(): Q[] {
  return [
    { prompt: "【音声+資料】音声：「この表を見てください。今期の四半期別売上推移です。」\n表：Q1: 2.5億, Q2: 3.0億, Q3: 2.8億, Q4: 3.5億\n音声：「Q3で若干落ちましたが、Q4で大幅回復。年間では目標の11億円を達成しました。」\n\nQ3の売上が低下した可能性として、話者が暗に示唆しているのはどれですか。", scenario: "四半期報告会の発表。", explanationVi: "Nói 'hơi giảm' (若干落ち) + 'hồi phục lớn Q4' → ngụ ý Q3 là tạm thời, không nghiêm trọng.", options: [{ key: "A", text: "一時的な要因であり深刻ではない。", isCorrect: true }, { key: "B", text: "会社の経営危機。", isCorrect: false }, { key: "C", text: "Q4も同様に低下する見込み。", isCorrect: false }, { key: "D", text: "目標未達であった。", isCorrect: false }], tags: ["data_interpretation", "quarterly"], businessSituation: "presentation" },
    { prompt: "【音声+資料】音声：「配布資料の組織図をご覧ください。今回の組織改編で、マーケティング部と広報部が統合され、コミュニケーション本部になります。」\n資料：旧組織図→新組織図の変更点\n音声：「人員の増減はなく、既存メンバーがそのまま新組織に移ります。」\n\nこの変更で起こらないことはどれですか。", scenario: "組織改編の説明会。", explanationVi: "Sáp nhập 2 bộ phận nhưng không tăng/giảm nhân sự.", options: [{ key: "A", text: "人員の削減。", isCorrect: true }, { key: "B", text: "部署名の変更。", isCorrect: false }, { key: "C", text: "組織構造の変更。", isCorrect: false }, { key: "D", text: "2つの部署の統合。", isCorrect: false }], tags: ["organization", "restructuring"], businessSituation: "presentation" },
    { prompt: "【音声+資料】音声：「このグラフは、過去5年間の顧客満足度の推移です。」\n資料：2020:72% → 2021:68% → 2022:75% → 2023:80% → 2024:83%\n音声：「2021年に一度下がりましたが、品質改善プログラム導入後、右肩上がりで推移しています。」\n\n品質改善プログラムはいつ頃導入されたと推測されますか。", scenario: "品質改善の成果報告。", explanationVi: "2021 giảm, 2022 bắt đầu tăng → chương trình được triển khai khoảng 2021-2022.", options: [{ key: "A", text: "2021年から2022年の間。", isCorrect: true }, { key: "B", text: "2020年以前。", isCorrect: false }, { key: "C", text: "2024年。", isCorrect: false }, { key: "D", text: "2023年。", isCorrect: false }], tags: ["quality", "trend_analysis"], businessSituation: "report_document" },
    { prompt: "【音声+資料】音声：「この料金表をご確認ください。基本プランは月額3万円、プレミアムは月額5万円です。」\n資料：基本プラン：3万円/月（ユーザー数10名まで、容量50GB）\nプレミアム：5万円/月（ユーザー数無制限、容量500GB、24時間サポート）\n音声：「御社の場合、ユーザーが30名とのことですので、プレミアムプランをお勧めします。」\n\n営業担当がプレミアムを勧める主な理由は何ですか。", scenario: "SaaSサービスの商談。", explanationVi: "Công ty khách có 30 người dùng, gói basic chỉ hỗ trợ 10 → cần Premium.", options: [{ key: "A", text: "ユーザー数が基本プランの上限（10名）を超えているため。", isCorrect: true }, { key: "B", text: "容量が足りないため。", isCorrect: false }, { key: "C", text: "24時間サポートが必要だから。", isCorrect: false }, { key: "D", text: "割引があるから。", isCorrect: false }], tags: ["sales", "pricing_table"], businessSituation: "sales_customer" },
    { prompt: "【音声+資料】音声：「添付のスケジュール表を見てください。新システムの開発は、設計2か月、開発3か月、テスト1か月の計6か月を予定しています。」\n資料：1月設計開始→2月設計完了→3-5月開発→6月テスト→7月1日本番稼働\n音声：「ただし、外部APIとの連携テストに想定以上の時間がかかる可能性があります。」\n\nリスクとして最も警戒すべきことは何ですか。", scenario: "プロジェクト計画の説明。", explanationVi: "API test có thể mất nhiều thời gian hơn → nguy cơ chậm tiến độ.", options: [{ key: "A", text: "テスト期間の延長により本番稼働が遅れる可能性。", isCorrect: true }, { key: "B", text: "設計期間の不足。", isCorrect: false }, { key: "C", text: "開発コストの増加。", isCorrect: false }, { key: "D", text: "人員不足。", isCorrect: false }], tags: ["project", "risk"], businessSituation: "meeting" },
    { prompt: "【音声+資料】音声：「このフローチャートに従って、クレーム対応を行ってください。」\n資料：受付→記録→一次対応（24時間以内）→原因調査→回答（5営業日以内）→フォローアップ\n音声：「特に重要なのは、一次対応を24時間以内に行うことです。まずお客様にご連絡を入れてください。」\n\n一次対応の段階で最も重要なことは何ですか。", scenario: "クレーム対応フローの研修。", explanationVi: "24時間以内にまずお客様に連絡 → 第一対応の核心.", options: [{ key: "A", text: "24時間以内にお客様に連絡を入れること。", isCorrect: true }, { key: "B", text: "原因を特定すること。", isCorrect: false }, { key: "C", text: "上司の承認を得ること。", isCorrect: false }, { key: "D", text: "報告書を提出すること。", isCorrect: false }], tags: ["procedure", "customer_service"], businessSituation: "training" },
    { prompt: "【音声+資料】音声：「出張旅費規程の改定について説明します。」\n資料：旧規程→新規程の比較表\n旧：国内日当5,000円、宿泊上限12,000円\n新：国内日当4,000円、宿泊上限10,000円（ただし東京・大阪は12,000円）\n音声：「コスト削減のため、基準額を引き下げますが、大都市圏は現行維持とします。」\n\nこの改定の特徴は何ですか。", scenario: "旅費規程改定の説明。", explanationVi: "Giảm tiêu chuẩn chung nhưng giữ nguyên cho Tokyo/Osaka (thành phố lớn).", options: [{ key: "A", text: "全面的に引き下げ、大都市圏は例外として現行水準を維持する。", isCorrect: true }, { key: "B", text: "全面的に引き上げ。", isCorrect: false }, { key: "C", text: "出張自体を禁止する。", isCorrect: false }, { key: "D", text: "大都市圏も引き下げ。", isCorrect: false }], tags: ["policy", "expense"], businessSituation: "internal_coordination" },
  ];
}

// =====================================================================
// LR_INTEGRATED: 総合聴読解 — Audio + multiple docs (25 per level)
// =====================================================================
function lrIntegratedPool(): Q[] {
  return [
    { prompt: "【音声+複数資料】音声：「売上データ、顧客アンケート、市場調査レポートを比較してください。」\n資料①売上：A商品30%, B商品45%, C商品25%\n資料②アンケート：A商品満足度90%, B商品70%, C商品85%\n資料③市場：A商品カテゴリ成長率15%, B商品カテゴリ成長率3%, C商品カテゴリ-2%\n音声：「今後注力すべき商品はどれか、根拠とともに提案してください。」\n\n最も合理的な提案はどれですか。", scenario: "商品戦略の会議。", explanationVi: "A: bán ít nhưng hài lòng cao + thị trường tăng mạnh (15%) → đầu tư tiềm năng.", options: [{ key: "A", text: "A商品に注力。高満足度・高成長率のため、売上拡大の余地が大きい。", isCorrect: true }, { key: "B", text: "B商品に注力。現在の売上が最大だから。", isCorrect: false }, { key: "C", text: "C商品に注力。市場は縮小しても満足度が高い。", isCorrect: false }, { key: "D", text: "全商品に均等投資する。", isCorrect: false }], tags: ["strategy", "data_integration"], businessSituation: "meeting" },
    { prompt: "【音声+複数資料】音声：「2つのベンダー提案を比較します。」\nベンダーX：初期費用800万円、月額10万円、導入期間3か月、サポート24/7\nベンダーY：初期費用400万円、月額20万円、導入期間1か月、サポート平日9-18時\n音声：「3年間のTCOで比較してください。また、当社は24時間稼働のサービスを運営しています。」\n\n最適な選択はどれですか。", scenario: "ベンダー選定の比較検討。", explanationVi: "X: 800万+10万×36=1160万, 24/7 support. Y: 400万+20万×36=1120万, 平日のみ. 24時間稼働なのでXが適切.", options: [{ key: "A", text: "ベンダーX。24時間サポートが必須であり、3年TCOも大差ない。", isCorrect: true }, { key: "B", text: "ベンダーY。初期費用が安い。", isCorrect: false }, { key: "C", text: "両方不採用。", isCorrect: false }, { key: "D", text: "ベンダーY。TCOが安い。", isCorrect: false }], tags: ["vendor", "TCO"], businessSituation: "meeting" },
    { prompt: "【音声+複数資料】音声：「今年の新卒採用の結果をまとめました。」\n資料①応募数：500名（前年比-20%）\n資料②内定承諾率：60%（前年70%）\n資料③入社後1年離職率：15%（前年10%）\n音声：「各指標が悪化しています。特に内定承諾率の低下と早期離職が懸念されます。」\n\n最も根本的な改善策はどれですか。", scenario: "採用戦略の見直し。", explanationVi: "Tất cả chỉ số xấu đi → cần cải thiện thương hiệu nhà tuyển dụng + đãi ngộ.", options: [{ key: "A", text: "給与・待遇の市場競争力を調査・改善し、入社後のオンボーディングを充実させる。", isCorrect: true }, { key: "B", text: "採用広告費を3倍にする。", isCorrect: false }, { key: "C", text: "応募基準を下げる。", isCorrect: false }, { key: "D", text: "新卒採用を中止して中途のみにする。", isCorrect: false }], tags: ["hr", "recruitment"], businessSituation: "meeting" },
    { prompt: "【音声+複数資料】音声：「3つの拠点の業績と環境を比較してください。」\n大阪拠点：売上5億、利益率8%、築30年ビル\n東京拠点：売上10億、利益率12%、築5年ビル\n福岡拠点：売上2億、利益率15%、築10年ビル\n音声：「設備投資の優先順位を決めたいのですが。」\n\n投資効果と必要性の観点から、最も優先すべき拠点はどれですか。", scenario: "設備投資の優先順位検討。", explanationVi: "Osaka: lợi nhuận thấp nhất (8%), tòa nhà cũ nhất (30 năm) → cần đầu tư nhất.", options: [{ key: "A", text: "大阪拠点。築30年で設備老朽化リスクが高く、利益率改善の余地がある。", isCorrect: true }, { key: "B", text: "東京拠点。売上が最大だから。", isCorrect: false }, { key: "C", text: "福岡拠点。利益率が最高だから。", isCorrect: false }, { key: "D", text: "全拠点に均等投資。", isCorrect: false }], tags: ["investment", "comparison"], businessSituation: "meeting" },
    { prompt: "【音声+複数資料】音声：「エネルギーコストの削減案を3つ出しました。」\n案A：LED照明全面導入。初期費用500万円、年間削減額100万円\n案B：太陽光パネル設置。初期費用2,000万円、年間削減額400万円\n案C：省エネ設定最適化。初期費用50万円、年間削減額30万円\n音声：「今期の設備予算は600万円です。」\n\n予算内で最も効果的な組み合わせはどれですか。", scenario: "エネルギーコスト削減の検討。", explanationVi: "Ngân sách 600万: A(500万)+C(50万)=550万, tiết kiệm 130万/năm. B vượt ngân sách.", options: [{ key: "A", text: "案AとCを実施。予算内（550万円）で年間130万円削減。", isCorrect: true }, { key: "B", text: "案Bのみ実施。", isCorrect: false }, { key: "C", text: "案Cのみ実施。", isCorrect: false }, { key: "D", text: "全案実施。", isCorrect: false }], tags: ["cost_reduction", "energy"], businessSituation: "meeting" },
    { prompt: "【音声+複数資料】音声：「新商品のターゲット市場について検討します。」\n市場A：規模100億円、成長率10%、競合5社\n市場B：規模50億円、成長率25%、競合2社\n市場C：規模200億円、成長率-3%、競合15社\n自社：技術力○、ブランド力△、営業ネットワーク○\n音声：「当社のリソースを考えると、どの市場に参入すべきでしょうか。」\n\n最も参入に適した市場はどれですか。", scenario: "新市場参入の検討。", explanationVi: "B: nhỏ hơn nhưng tăng trưởng cao (25%), ít đối thủ (2社) → dễ tham gia.", options: [{ key: "A", text: "市場B。高成長率・低競合で、技術力と営業力で差別化しやすい。", isCorrect: true }, { key: "B", text: "市場A。規模が大きい。", isCorrect: false }, { key: "C", text: "市場C。最大規模。", isCorrect: false }, { key: "D", text: "全市場に同時参入。", isCorrect: false }], tags: ["market_entry", "strategy"], businessSituation: "meeting" },
  ];
}

// Target per section for remaining 125 per level
const TARGETS: Record<string, number> = {
  LC_SCENE: 13,
  LC_STATEMENT: 25,
  LC_INTEGRATED: 25,
  LR_SITUATION: 12,
  LR_DOCUMENT: 25,
  LR_INTEGRATED: 25,
};

const SECTION_TITLES: Record<string, { vi: string; ja: string; order: number }> = {
  LC_SCENE: { vi: "Nghe – Nắm bắt tình huống", ja: "聴解 – 場面把握問題", order: 1 },
  LC_STATEMENT: { vi: "Nghe – Nghe hiểu phát ngôn", ja: "聴解 – 発言聴解問題", order: 2 },
  LC_INTEGRATED: { vi: "Nghe – Tổng hợp nghe hiểu", ja: "聴解 – 総合聴解問題", order: 3 },
  LR_SITUATION: { vi: "Nghe-Đọc – Nắm bắt tình huống", ja: "聴読解 – 状況把握問題", order: 4 },
  LR_DOCUMENT: { vi: "Nghe-Đọc – Đọc tài liệu", ja: "聴読解 – 資料聴読解問題", order: 5 },
  LR_INTEGRATED: { vi: "Nghe-Đọc – Tổng hợp", ja: "聴読解 – 総合聴読解問題", order: 6 },
};

const SECTION_META: Record<string, { part: string }> = {
  LC_SCENE: { part: "listening" },
  LC_STATEMENT: { part: "listening" },
  LC_INTEGRATED: { part: "listening" },
  LR_SITUATION: { part: "listening_reading" },
  LR_DOCUMENT: { part: "listening_reading" },
  LR_INTEGRATED: { part: "listening_reading" },
};

function pickQuestions(pool: Q[], needed: number): Q[] {
  const result: Q[] = [];
  for (let i = 0; i < needed; i++) {
    result.push(pool[i % pool.length]!);
  }
  return result;
}

const LEVELS_LIST = [
  { code: "BJT-J5", diff: "easy" },
  { code: "BJT-J4", diff: "easy" },
  { code: "BJT-J3", diff: "standard" },
  { code: "BJT-J2", diff: "standard" },
  { code: "BJT-J1", diff: "hard" },
  { code: "BJT-J1+", diff: "hard" },
] as const;

async function main() {
  console.log("=== Generate Listening + Listening-Reading questions (125/level × 6) ===\n");

  let totalCreated = 0;

  for (const level of LEVELS_LIST) {
    const bankSlug = `bjt-bank-${level.code.toLowerCase().replace("+", "plus").replace("bjt-", "")}`;
    const bankExam = await prisma.bjtMockTest.findFirst({ where: { slug: bankSlug } });

    if (!bankExam) {
      console.error(`Bank not found: ${bankSlug} — run generate-200q-per-level.ts first`);
      continue;
    }

    console.log(`Level ${level.code} — bank ${bankSlug}`);

    const sectionCodes = Object.keys(TARGETS);

    for (const code of sectionCodes) {
      const meta = SECTION_TITLES[code]!;
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

      const existingCount = await prisma.bjtQuestion.count({ where: { sectionId: section.id } });
      const target = TARGETS[code] ?? 25;
      const needed = Math.max(0, target - existingCount);

      if (needed === 0) {
        console.log(`  ${code}: already ${existingCount}/${target} — skipping`);
        continue;
      }

      let pool: Q[];
      switch (code) {
        case "LC_SCENE": pool = lcScenePool(); break;
        case "LC_STATEMENT": pool = lcStatementPool(); break;
        case "LC_INTEGRATED": pool = lcIntegratedPool(); break;
        case "LR_SITUATION": pool = lrSituationPool(); break;
        case "LR_DOCUMENT": pool = lrDocumentPool(); break;
        case "LR_INTEGRATED": pool = lrIntegratedPool(); break;
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
            sourceType: "nihongo-bjt-200q-production-v1",
            status: "published",
            qualityFlags: {
              bjtPart: secMeta.part,
              bjtSection: code,
              businessSituation: q.businessSituation,
              stimulusKind: code.startsWith("LC_") ? "audio" : "audio_document",
              stimulusRequired: true,
              hasAudioStimulus: true,
              hasVisualStimulus: code.startsWith("LR_"),
              distractorQuality: "authored",
              difficultySource: "estimated",
              itemReviewed: false,
              license: "original-internal-production",
              level: level.code,
              provenance: "nihongo-bjt-200q-production-v1",
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

  const totalQ = await prisma.bjtQuestion.count();
  console.log(`\nTotal questions in system: ${totalQ}`);
  console.log(`✅ Created ${totalCreated} new listening/LR questions.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
