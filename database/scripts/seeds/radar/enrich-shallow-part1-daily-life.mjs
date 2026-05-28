/**
 * Enrich shallow radar cards — Part 1: Daily Life & Living
 * Cards: apartment, transport, health, post office, city hall, school, trash, delivery
 * ~17 cards enriched with full japaneseExpressions objects
 */
import { createClient, upsertRadarCard, MODULES } from "./radar-seed-helpers.mjs";

const CARDS = [
  {
    slug: "apartment-noise-note",
    moduleConfigId: MODULES.life_hack,
    titleVi: "Viết giấy nhắc hàng xóm về tiếng ồn",
    titleJa: "騒音に関する注意文を書く",
    descriptionVi: "Học cách viết thông báo lịch sự về vấn đề tiếng ồn trong chung cư.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "home",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["written_communication", "apartment_life"],
      japaneseExpressions: [
        { word: "騒音", reading: "そうおん", meaning: "Tiếng ồn", example: "夜10時以降の騒音にご注意ください。", jlptLevel: "N3", usageNote: "Dùng trong văn bản chính thức của chung cư." },
        { word: "注意", reading: "ちゅうい", meaning: "Chú ý, cẩn thận", example: "騒音に関するご注意のお願いです。", jlptLevel: "N4", usageNote: "Thường đi với お願い trong thông báo." },
        { word: "駐輪場", reading: "ちゅうりんじょう", meaning: "Bãi đậu xe đạp", example: "駐輪場は1階にあります。", jlptLevel: "N3", usageNote: "Từ cần biết khi sống ở chung cư Nhật." },
        { word: "ご配慮", reading: "ごはいりょ", meaning: "Sự quan tâm, cân nhắc (kính ngữ)", example: "皆様のご配慮をお願いいたします。", jlptLevel: "N2", usageNote: "Cách nói lịch sự khi nhờ hàng xóm chú ý." },
        { word: "管理組合", reading: "かんりくみあい", meaning: "Ban quản lý chung cư", example: "管理組合からのお知らせです。", jlptLevel: "N2", usageNote: "Tổ chức quản lý tòa nhà, nguồn phát thông báo." }
      ],
      contentGoal: "Viết và hiểu thông báo chung cư về tiếng ồn bằng tiếng Nhật lịch sự."
    },
  },
  {
    slug: "ask-station-staff",
    moduleConfigId: MODULES.transport_commute,
    titleVi: "Hỏi nhân viên ga tàu",
    titleJa: "駅員さんに聞く",
    descriptionVi: "Cách hỏi đường, tuyến tàu và lối ra ở ga.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "transport",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "transport"],
      japaneseExpressions: [
        { word: "何番線", reading: "なんばんせん", meaning: "Tuyến số mấy", example: "新宿行きは何番線ですか？", jlptLevel: "N4", usageNote: "Câu hỏi cơ bản nhất khi ở ga." },
        { word: "乗り換え", reading: "のりかえ", meaning: "Chuyển tàu", example: "渋谷で乗り換えてください。", jlptLevel: "N4", usageNote: "Rất thường dùng — chuyển từ tuyến này sang tuyến khác." },
        { word: "出口", reading: "でぐち", meaning: "Lối ra", example: "南出口はどこですか？", jlptLevel: "N5", usageNote: "Ga lớn có nhiều 出口 đánh số hoặc tên." },
        { word: "片道", reading: "かたみち", meaning: "Một chiều", example: "片道切符を一枚ください。", jlptLevel: "N3", usageNote: "Đối lập với 往復 (khứ hồi)." },
        { word: "終電", reading: "しゅうでん", meaning: "Chuyến tàu cuối", example: "終電は何時ですか？", jlptLevel: "N3", usageNote: "Cực kỳ quan trọng — miss 終電 = taxi đắt hoặc manga cafe." }
      ],
      contentGoal: "Tự tin hỏi thông tin ở ga tàu Nhật."
    },
  },
  {
    slug: "call-119",
    moduleConfigId: MODULES.safety_emergency,
    titleVi: "Gọi 119 — cấp cứu / cứu hỏa",
    titleJa: "119番に電話する",
    descriptionVi: "Biết nói gì khi gọi cấp cứu ở Nhật.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N4",
    visualTheme: "emergency",
    priority: 95,
    metadata: {
      seed: true,
      skills: ["spoken_emergency", "survival"],
      japaneseExpressions: [
        { word: "救急車をお願いします", reading: "きゅうきゅうしゃをおねがいします", meaning: "Xin gọi xe cấp cứu", example: "もしもし、救急車をお願いします。", jlptLevel: "N4", usageNote: "Câu đầu tiên khi gọi 119 cần cấp cứu." },
        { word: "住所は", reading: "じゅうしょは", meaning: "Địa chỉ là...", example: "住所は東京都新宿区西新宿1丁目です。", jlptLevel: "N5", usageNote: "Luôn chuẩn bị sẵn địa chỉ nhà bằng tiếng Nhật." },
        { word: "意識があります", reading: "いしきがあります", meaning: "Có ý thức (tỉnh)", example: "意識はありますが、動けません。", jlptLevel: "N3", usageNote: "Nhân viên 119 sẽ hỏi 意識はありますか？" },
        { word: "火事です", reading: "かじです", meaning: "Cháy rồi!", example: "火事です！消防車をお願いします。", jlptLevel: "N4", usageNote: "Nói ngay đầu tiên nếu là hỏa hoạn." },
        { word: "けが人がいます", reading: "けがにんがいます", meaning: "Có người bị thương", example: "交通事故でけが人がいます。", jlptLevel: "N3", usageNote: "Thông tin quan trọng để họ chuẩn bị đúng đội." }
      ],
      contentGoal: "Có thể gọi 119 và truyền đạt thông tin cấp cứu cơ bản."
    },
  },
  {
    slug: "call-school-sick",
    moduleConfigId: MODULES.family_school,
    titleVi: "Gọi trường xin nghỉ ốm",
    titleJa: "学校に欠席連絡する",
    descriptionVi: "Cách gọi điện báo con nghỉ học vì bệnh.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "school",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "parenting"],
      japaneseExpressions: [
        { word: "欠席します", reading: "けっせきします", meaning: "Nghỉ học", example: "今日は体調が悪いので欠席します。", jlptLevel: "N4", usageNote: "Dùng khi báo nghỉ học/làm." },
        { word: "熱があります", reading: "ねつがあります", meaning: "Bị sốt", example: "38度の熱があります。", jlptLevel: "N4", usageNote: "Nói rõ nhiệt độ nếu biết — trường thường hỏi." },
        { word: "お休みさせてください", reading: "おやすみさせてください", meaning: "Xin cho (con) nghỉ", example: "体調が悪いのでお休みさせてください。", jlptLevel: "N4", usageNote: "Cách nói lịch sự hơn khi xin phép nghỉ." },
        { word: "連絡帳", reading: "れんらくちょう", meaning: "Sổ liên lạc (nhà - trường)", example: "連絡帳に書いて持たせます。", jlptLevel: "N3", usageNote: "Sổ giao tiếp giữa phụ huynh và giáo viên." },
        { word: "お迎え", reading: "おむかえ", meaning: "Đón (con)", example: "昼前にお迎えに行きます。", jlptLevel: "N3", usageNote: "Khi con ốm giữa chừng, trường gọi đón về." }
      ],
      contentGoal: "Gọi trường báo nghỉ ốm tự tin, đúng mẫu."
    },
  },
  {
    slug: "cityhall-address-change",
    moduleConfigId: MODULES.visa_cityhall,
    titleVi: "Đổi địa chỉ ở UBND quận",
    titleJa: "区役所で住所変更する",
    descriptionVi: "Thủ tục và từ vựng cần biết khi chuyển nhà ở Nhật.",
    category: "daily_life",
    estimatedMinutes: 5,
    levelLabel: "N3",
    visualTheme: "admin",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["admin_procedure", "daily_life"],
      japaneseExpressions: [
        { word: "住所変更", reading: "じゅうしょへんこう", meaning: "Thay đổi địa chỉ", example: "住所変更の届出をしたいのですが。", jlptLevel: "N3", usageNote: "Phải làm trong 14 ngày sau khi chuyển." },
        { word: "転入届", reading: "てんにゅうとどけ", meaning: "Đơn chuyển đến (nơi mới)", example: "転入届を提出してください。", jlptLevel: "N2", usageNote: "Nộp ở quận/thành phố MỚI sau khi chuyển đến." },
        { word: "転出届", reading: "てんしゅつとどけ", meaning: "Đơn chuyển đi (nơi cũ)", example: "引っ越す前に転出届を出してください。", jlptLevel: "N2", usageNote: "Phải lấy ở quận CŨ trước khi chuyển." },
        { word: "届出", reading: "とどけで", meaning: "Đơn khai báo", example: "届出に必要な書類を確認しましょう。", jlptLevel: "N2", usageNote: "Thuật ngữ hành chính — 'khai báo / đăng ký'." },
        { word: "窓口", reading: "まどぐち", meaning: "Quầy tiếp nhận", example: "2番窓口で手続きできます。", jlptLevel: "N3", usageNote: "Tất cả thủ tục hành chính đều qua 窓口." }
      ],
      contentGoal: "Tự mình làm thủ tục chuyển địa chỉ ở quận."
    },
  },
  {
    slug: "clinic-symptoms",
    moduleConfigId: MODULES.health_clinic,
    titleVi: "Mô tả triệu chứng ở phòng khám",
    titleJa: "クリニックで症状を伝える",
    descriptionVi: "Nói được triệu chứng với bác sĩ bằng tiếng Nhật.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N4",
    visualTheme: "health",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "health"],
      japaneseExpressions: [
        { word: "頭痛", reading: "ずつう", meaning: "Đau đầu", example: "昨日から頭痛がひどいです。", jlptLevel: "N4", usageNote: "Triệu chứng phổ biến nhất khi đi khám." },
        { word: "発熱", reading: "はつねつ", meaning: "Sốt", example: "今朝から発熱があります。", jlptLevel: "N3", usageNote: "Dùng trong y tế, đời thường nói 熱がある." },
        { word: "腹痛", reading: "ふくつう", meaning: "Đau bụng", example: "食後に腹痛があります。", jlptLevel: "N3", usageNote: "Nên nói thêm khi nào đau (食前/食後/常に)." },
        { word: "めまい", reading: "めまい", meaning: "Chóng mặt", example: "立ち上がるとめまいがします。", jlptLevel: "N3", usageNote: "めまいがする là pattern chuẩn." },
        { word: "吐き気", reading: "はきけ", meaning: "Buồn nôn", example: "吐き気がして食欲がありません。", jlptLevel: "N3", usageNote: "Thường đi kèm 食欲がない (không có cảm giác muốn ăn)." }
      ],
      contentGoal: "Mô tả triệu chứng rõ ràng để bác sĩ hiểu ngay."
    },
  },
  {
    slug: "drugstore-phrases",
    moduleConfigId: MODULES.health_clinic,
    titleVi: "Mua thuốc ở drugstore",
    titleJa: "ドラッグストアで薬を買う",
    descriptionVi: "Hỏi và mua thuốc không cần toa ở Nhật.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "health",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "health"],
      japaneseExpressions: [
        { word: "頭痛薬", reading: "ずつうやく", meaning: "Thuốc đau đầu", example: "頭痛薬はどこにありますか？", jlptLevel: "N4", usageNote: "Pattern: [triệu chứng]+薬 = thuốc cho triệu chứng đó." },
        { word: "風邪薬", reading: "かぜぐすり", meaning: "Thuốc cảm", example: "よく効く風邪薬はありますか？", jlptLevel: "N4", usageNote: "よく効く = hiệu quả tốt — cách hỏi tự nhiên." },
        { word: "腹痛", reading: "ふくつう", meaning: "Đau bụng", example: "腹痛に効く薬をください。", jlptLevel: "N3", usageNote: "〜に効く = có hiệu quả với ~." },
        { word: "第一類医薬品", reading: "だいいちるいいやくひん", meaning: "Thuốc loại 1 (cần hỏi dược sĩ)", example: "この薬は第一類なので、薬剤師に聞いてください。", jlptLevel: "N2", usageNote: "Ở Nhật thuốc chia 3 loại, loại 1 cần tư vấn dược sĩ." },
        { word: "用法・用量", reading: "ようほう・ようりょう", meaning: "Cách dùng & liều lượng", example: "用法・用量を守ってお飲みください。", jlptLevel: "N2", usageNote: "Luôn đọc trên hộp thuốc — cực kỳ quan trọng." }
      ],
      contentGoal: "Tự mua thuốc phù hợp ở drugstore Nhật."
    },
  },
  {
    slug: "pharmacy-side-effects",
    moduleConfigId: MODULES.health_clinic,
    titleVi: "Hiểu tác dụng phụ của thuốc",
    titleJa: "薬の副作用を理解する",
    descriptionVi: "Đọc hiểu thông tin tác dụng phụ trên toa thuốc.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "health",
    priority: 75,
    metadata: {
      seed: true,
      skills: ["reading_daily", "health"],
      japaneseExpressions: [
        { word: "副作用", reading: "ふくさよう", meaning: "Tác dụng phụ", example: "副作用が出たら服用を中止してください。", jlptLevel: "N2", usageNote: "Cần đọc được từ này trên tờ hướng dẫn." },
        { word: "用量", reading: "ようりょう", meaning: "Liều lượng", example: "1日3回、1回2錠が用量です。", jlptLevel: "N2", usageNote: "Vượt quá 用量 có thể nguy hiểm." },
        { word: "食後", reading: "しょくご", meaning: "Sau bữa ăn", example: "食後30分以内に服用してください。", jlptLevel: "N3", usageNote: "Đối lập: 食前(trước ăn), 食間(giữa bữa)." },
        { word: "眠気", reading: "ねむけ", meaning: "Buồn ngủ", example: "この薬は眠気を催すことがあります。", jlptLevel: "N3", usageNote: "Tác dụng phụ thường gặp — cẩn thận khi lái xe." },
        { word: "服用", reading: "ふくよう", meaning: "Uống thuốc (formal)", example: "妊娠中の方は服用しないでください。", jlptLevel: "N2", usageNote: "Văn viết y khoa, đời thường nói 薬を飲む." }
      ],
      contentGoal: "Đọc được hướng dẫn sử dụng thuốc cơ bản."
    },
  },
  {
    slug: "health-insurance-counter",
    moduleConfigId: MODULES.visa_cityhall,
    titleVi: "Quầy bảo hiểm y tế",
    titleJa: "国民健康保険の窓口で",
    descriptionVi: "Đăng ký và hỏi thông tin bảo hiểm y tế quốc dân.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "admin",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["admin_procedure", "health"],
      japaneseExpressions: [
        { word: "国民健康保険", reading: "こくみんけんこうほけん", meaning: "Bảo hiểm y tế quốc dân", example: "国民健康保険に加入したいのですが。", jlptLevel: "N2", usageNote: "Viết tắt: 国保(こくほ). Bắt buộc cho người không có 社会保険." },
        { word: "窓口", reading: "まどぐち", meaning: "Quầy tiếp nhận", example: "保険の窓口は2階です。", jlptLevel: "N3", usageNote: "Dùng ở mọi cơ quan hành chính." },
        { word: "保険料", reading: "ほけんりょう", meaning: "Phí bảo hiểm", example: "保険料はいくらですか？", jlptLevel: "N3", usageNote: "Tính theo thu nhập năm trước." },
        { word: "加入", reading: "かにゅう", meaning: "Tham gia (đăng ký)", example: "転入時に加入手続きをしてください。", jlptLevel: "N2", usageNote: "加入 ↔ 脱退(rút khỏi)." },
        { word: "保険証", reading: "ほけんしょう", meaning: "Thẻ bảo hiểm", example: "保険証を忘れずにお持ちください。", jlptLevel: "N3", usageNote: "Luôn mang theo khi đi khám — không có = trả 100%." }
      ],
      contentGoal: "Làm thủ tục bảo hiểm y tế quốc dân tại quận."
    },
  },
  {
    slug: "missed-delivery-slip",
    moduleConfigId: MODULES.life_hack,
    titleVi: "Phiếu vắng nhà — đặt giao lại",
    titleJa: "不在票で再配達を頼む",
    descriptionVi: "Hiểu phiếu vắng nhà và đặt lịch giao lại.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "home",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["reading_daily", "daily_life"],
      japaneseExpressions: [
        { word: "不在票", reading: "ふざいひょう", meaning: "Phiếu thông báo vắng nhà", example: "ポストに不在票が入っていました。", jlptLevel: "N3", usageNote: "Khi shipper đến mà bạn không ở nhà." },
        { word: "再配達", reading: "さいはいたつ", meaning: "Giao lại", example: "再配達を電話で依頼しました。", jlptLevel: "N3", usageNote: "Có thể đặt qua web, điện thoại, hoặc LINE." },
        { word: "配達希望日時", reading: "はいたつきぼうにちじ", meaning: "Ngày giờ muốn được giao", example: "配達希望日時を選んでください。", jlptLevel: "N2", usageNote: "Thường chia khung giờ: 午前/12-14/14-16/16-18/18-20/19-21." },
        { word: "保管期限", reading: "ほかんきげん", meaning: "Thời hạn giữ hàng", example: "保管期限は1週間です。", jlptLevel: "N2", usageNote: "Quá hạn = hàng trả về nơi gửi." },
        { word: "伝票番号", reading: "でんぴょうばんごう", meaning: "Số tracking", example: "伝票番号を入力して再配達を申し込めます。", jlptLevel: "N2", usageNote: "Dãy số dài trên phiếu — cần để tra cứu online." }
      ],
      contentGoal: "Tự đặt giao lại khi nhận được phiếu vắng nhà."
    },
  },
  {
    slug: "post-office-redelivery",
    moduleConfigId: MODULES.life_hack,
    titleVi: "Bưu điện — gửi / nhận hàng",
    titleJa: "郵便局で荷物を送る・受け取る",
    descriptionVi: "Từ vựng cơ bản khi đến bưu điện Nhật.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "admin",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "daily_life"],
      japaneseExpressions: [
        { word: "受け取り", reading: "うけとり", meaning: "Nhận hàng", example: "荷物の受け取りに来ました。", jlptLevel: "N3", usageNote: "Nói ngay khi vào bưu điện để nhận đồ." },
        { word: "送料", reading: "そうりょう", meaning: "Phí gửi", example: "送料はいくらですか？", jlptLevel: "N3", usageNote: "Phụ thuộc kích thước và khoảng cách." },
        { word: "追跡番号", reading: "ついせきばんごう", meaning: "Mã tracking", example: "追跡番号で配達状況を確認できます。", jlptLevel: "N2", usageNote: "Tương tự 伝票番号 — dùng để theo dõi bưu kiện." },
        { word: "速達", reading: "そくたつ", meaning: "Chuyển phát nhanh", example: "速達でお願いします。", jlptLevel: "N3", usageNote: "Đến nhanh hơn thường 1-2 ngày, phí cao hơn." },
        { word: "着払い", reading: "ちゃくばらい", meaning: "Người nhận trả phí", example: "着払いで送ってもいいですか？", jlptLevel: "N2", usageNote: "Đối lập: 元払い(người gửi trả)." }
      ],
      contentGoal: "Gửi/nhận bưu kiện tại bưu điện Nhật tự tin."
    },
  },
  {
    slug: "trash-sorting-basic",
    moduleConfigId: MODULES.life_hack,
    titleVi: "Phân loại rác cơ bản",
    titleJa: "ゴミの分別 基本ルール",
    descriptionVi: "Hiểu các loại rác và lịch đổ rác ở Nhật.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N4",
    visualTheme: "home",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["reading_daily", "apartment_life"],
      japaneseExpressions: [
        { word: "可燃ごみ", reading: "かねんごみ", meaning: "Rác cháy được", example: "生ゴミや紙は可燃ごみです。", jlptLevel: "N3", usageNote: "Tuần 2 lần ở hầu hết các quận Tokyo." },
        { word: "不燃ごみ", reading: "ふねんごみ", meaning: "Rác không cháy", example: "ガラスや金属は不燃ごみです。", jlptLevel: "N3", usageNote: "Tháng 1-2 lần — ít hơn 可燃ごみ." },
        { word: "資源ごみ", reading: "しげんごみ", meaning: "Rác tái chế", example: "ペットボトルは資源ごみに出してください。", jlptLevel: "N3", usageNote: "Chai nhựa, lon, giấy báo — phải rửa sạch trước." },
        { word: "粗大ごみ", reading: "そだいごみ", meaning: "Rác cỡ lớn", example: "粗大ごみは事前に予約が必要です。", jlptLevel: "N2", usageNote: "Đồ nội thất, đồ điện — phải đặt lịch & mua phiếu." },
        { word: "収集日", reading: "しゅうしゅうび", meaning: "Ngày thu gom rác", example: "可燃ごみの収集日は火曜と金曜です。", jlptLevel: "N3", usageNote: "Mỗi quận khác nhau — xem bảng gần thùng rác." }
      ],
      contentGoal: "Phân loại rác đúng cách, tránh bị hàng xóm phàn nàn."
    },
  },
  {
    slug: "hoikuen-notice",
    moduleConfigId: MODULES.family_school,
    titleVi: "Đọc thông báo từ nhà trẻ",
    titleJa: "保育園のお知らせを読む",
    descriptionVi: "Hiểu thông báo, lịch, và yêu cầu từ hoikuen.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "school",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["reading_daily", "parenting"],
      japaneseExpressions: [
        { word: "持ち物", reading: "もちもの", meaning: "Đồ mang theo", example: "明日の持ち物：タオル、着替え、水筒。", jlptLevel: "N3", usageNote: "Danh sách đồ con cần mang đi mỗi ngày." },
        { word: "提出", reading: "ていしゅつ", meaning: "Nộp (tài liệu)", example: "同意書を金曜日までに提出してください。", jlptLevel: "N3", usageNote: "Deadline thường rõ ràng — 〜までに提出." },
        { word: "連絡帳", reading: "れんらくちょう", meaning: "Sổ liên lạc", example: "連絡帳に体温を記入してください。", jlptLevel: "N3", usageNote: "Viết hàng ngày — nhiệt độ sáng, ăn uống, tình trạng." },
        { word: "お迎え時間", reading: "おむかえじかん", meaning: "Giờ đón con", example: "お迎え時間に変更がある場合はご連絡ください。", jlptLevel: "N3", usageNote: "Trễ giờ đón = phí phát sinh ở nhiều nơi." },
        { word: "園だより", reading: "えんだより", meaning: "Bản tin nhà trẻ (hàng tháng)", example: "今月の園だよりをご確認ください。", jlptLevel: "N2", usageNote: "Tờ giấy A4 tổng hợp lịch, sự kiện, thông báo." }
      ],
      contentGoal: "Đọc hiểu thông báo nhà trẻ, không bỏ lỡ thông tin quan trọng."
    },
  },
  {
    slug: "my-number-notice",
    moduleConfigId: MODULES.visa_cityhall,
    titleVi: "Thẻ My Number — thông báo & thủ tục",
    titleJa: "マイナンバー通知と手続き",
    descriptionVi: "Hiểu hệ thống My Number và cách sử dụng.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "admin",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["admin_procedure", "daily_life"],
      japaneseExpressions: [
        { word: "マイナンバー", reading: "まいなんばー", meaning: "Mã số cá nhân (My Number)", example: "マイナンバーは他人に教えないでください。", jlptLevel: "N3", usageNote: "Số 12 chữ số gán cho mỗi cư dân Nhật — BẢO MẬT." },
        { word: "通知カード", reading: "つうちかーど", meaning: "Thẻ thông báo (giấy)", example: "通知カードは身分証として使えません。", jlptLevel: "N3", usageNote: "Chỉ thông báo số, KHÔNG dùng làm giấy tờ tùy thân." },
        { word: "個人番号", reading: "こじんばんごう", meaning: "Số cá nhân (= My Number)", example: "個人番号を記入してください。", jlptLevel: "N2", usageNote: "Tên chính thức = 個人番号, tên thường gọi = マイナンバー." },
        { word: "マイナンバーカード", reading: "まいなんばーかーど", meaning: "Thẻ My Number (nhựa, có ảnh)", example: "マイナンバーカードがあればコンビニで住民票が取れます。", jlptLevel: "N3", usageNote: "Thẻ nhựa có chip — dùng làm ID, lấy giấy tờ ở conbini." },
        { word: "暗証番号", reading: "あんしょうばんごう", meaning: "Mã PIN", example: "暗証番号は4桁と6桁の2種類設定します。", jlptLevel: "N3", usageNote: "Khi làm thẻ phải đặt PIN — quên = phải ra quận làm lại." }
      ],
      contentGoal: "Hiểu hệ thống My Number và tự làm thủ tục liên quan."
    },
  },
  {
    slug: "residence-card-renewal-call",
    moduleConfigId: MODULES.visa_cityhall,
    titleVi: "Gia hạn thẻ lưu trú (zairyu card)",
    titleJa: "在留カード更新の手続き",
    descriptionVi: "Từ vựng và quy trình gia hạn thẻ cư trú.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "admin",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["admin_procedure", "immigration"],
      japaneseExpressions: [
        { word: "在留カード更新", reading: "ざいりゅうかーどこうしん", meaning: "Gia hạn thẻ lưu trú", example: "在留カードの更新期限が近づいています。", jlptLevel: "N2", usageNote: "Phải làm TRƯỚC khi hết hạn — nếu quá = vi phạm." },
        { word: "必要書類", reading: "ひつようしょるい", meaning: "Giấy tờ cần thiết", example: "必要書類を揃えてから申請してください。", jlptLevel: "N3", usageNote: "Mỗi loại visa cần giấy tờ khác nhau." },
        { word: "入国管理局", reading: "にゅうこくかんりきょく", meaning: "Cục quản lý xuất nhập cảnh", example: "入国管理局は品川にあります。", jlptLevel: "N2", usageNote: "Nay đổi tên: 出入国在留管理局, nhưng mọi người vẫn nói 入管." },
        { word: "在留期間", reading: "ざいりゅうきかん", meaning: "Thời hạn cư trú", example: "在留期間は1年から3年に延長されました。", jlptLevel: "N2", usageNote: "1年/3年/5年tùy visa và tình trạng." },
        { word: "申請書", reading: "しんせいしょ", meaning: "Đơn xin", example: "申請書はHPからダウンロードできます。", jlptLevel: "N3", usageNote: "Điền trước ở nhà để tiết kiệm thời gian chờ." }
      ],
      contentGoal: "Tự chuẩn bị và gia hạn thẻ lưu trú không cần phiên dịch."
    },
  },
  {
    slug: "lost-wallet-police",
    moduleConfigId: MODULES.safety_emergency,
    titleVi: "Khai báo mất ví ở đồn cảnh sát",
    titleJa: "交番で財布の紛失届を出す",
    descriptionVi: "Biết nói gì khi đến koban trình báo mất đồ.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N4",
    visualTheme: "emergency",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "emergency"],
      japaneseExpressions: [
        { word: "財布をなくしました", reading: "さいふをなくしました", meaning: "Tôi bị mất ví", example: "すみません、財布をなくしました。届出を出したいのですが。", jlptLevel: "N4", usageNote: "Câu đầu tiên nói khi vào koban." },
        { word: "遺失物届", reading: "いしつぶつとどけ", meaning: "Đơn khai mất đồ", example: "遺失物届を書いてください。", jlptLevel: "N2", usageNote: "Đơn chính thức — cảnh sát sẽ đưa mẫu." },
        { word: "交番", reading: "こうばん", meaning: "Đồn cảnh sát (nhỏ)", example: "近くの交番で届出を出しました。", jlptLevel: "N4", usageNote: "Có mặt ở hầu hết các ga và khu phố." },
        { word: "特徴", reading: "とくちょう", meaning: "Đặc điểm", example: "財布の特徴を教えてください。色は？形は？", jlptLevel: "N3", usageNote: "Cảnh sát sẽ hỏi mô tả — chuẩn bị sẵn." },
        { word: "届け出", reading: "とどけで", meaning: "Khai báo, trình báo", example: "拾った人が届け出てくれるかもしれません。", jlptLevel: "N3", usageNote: "Ở Nhật tỷ lệ trả lại đồ rất cao — nên khai báo ngay." }
      ],
      contentGoal: "Tự trình báo mất đồ ở koban bằng tiếng Nhật."
    },
  },
  {
    slug: "earthquake-phrases",
    moduleConfigId: MODULES.safety_emergency,
    titleVi: "Cụm từ khi có động đất",
    titleJa: "地震のときの表現",
    descriptionVi: "Những câu cần biết trong và sau động đất.",
    category: "daily_life",
    estimatedMinutes: 4,
    levelLabel: "N4",
    visualTheme: "emergency",
    priority: 95,
    metadata: {
      seed: true,
      skills: ["listening_daily", "emergency"],
      japaneseExpressions: [
        { word: "地震", reading: "じしん", meaning: "Động đất", example: "地震だ！テーブルの下に隠れて！", jlptLevel: "N4", usageNote: "Phản xạ đầu tiên: bảo vệ đầu, chui xuống bàn." },
        { word: "落ち着いてください", reading: "おちついてください", meaning: "Xin hãy bình tĩnh", example: "落ち着いてください。揺れはすぐ止まります。", jlptLevel: "N4", usageNote: "Câu thường nghe từ loa phát thanh." },
        { word: "避難してください", reading: "ひなんしてください", meaning: "Xin hãy sơ tán", example: "津波警報です。高台へ避難してください。", jlptLevel: "N3", usageNote: "Khi có 津波警報(cảnh báo sóng thần) → chạy lên cao." },
        { word: "余震", reading: "よしん", meaning: "Dư chấn", example: "余震に注意してください。", jlptLevel: "N2", usageNote: "Sau trận chính, luôn có 余震 — đôi khi mạnh." },
        { word: "安否確認", reading: "あんぴかくにん", meaning: "Xác nhận an toàn", example: "家族の安否確認ができました。", jlptLevel: "N2", usageNote: "Sau thiên tai, dùng 171 hoặc app để xác nhận người thân." }
      ],
      contentGoal: "Hiểu và phản ứng đúng khi có động đất ở Nhật."
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("[enrich-part1] Enriching daily-life cards...");

  let ok = 0, fail = 0;
  for (const card of CARDS) {
    try {
      await upsertRadarCard(client, card);
      ok++;
    } catch (e) {
      console.error(`  FAIL ${card.slug}: ${e.message}`);
      fail++;
    }
  }
  console.log(`[enrich-part1] Done: ${ok} enriched, ${fail} failed.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
