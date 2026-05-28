/**
 * Radar Seed: Mixed batch 5a — safety/family/money (13 cards)
 * Run: node scripts/seed-radar-mixed-5a.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_SAFETY = MODULES.safety_emergency;
const M_HEALTH = MODULES.health_clinic;
const M_FAMILY = MODULES.family_school;
const M_MONEY = MODULES.deals_points;
const M_EMERALD = MODULES.market_watch;

const cards = [
  // === SAFETY/HEALTH (5) ===
  {
    slug: "food-allergies-japan",
    moduleConfigId: M_HEALTH,
    titleVi: "食物アレルギー — Dị ứng thực phẩm",
    titleJa: "食物アレルギーの伝え方",
    descriptionVi: "Cách nói dị ứng thực phẩm ở nhà hàng + đọc label.",
    recommendationReasonVi: "Sống chết = nói đúng dị ứng. Label Nhật khó đọc nếu không biết.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["allergy", "restaurant", "food_safety"],
      contentGoal: "Biết cách nói dị ứng + đọc label.",
      usageNote: "7 大アレルゲン bắt buộc ghi: 小麦 (lúa mì), 卵 (trứng), 乳 (sữa), えび, かに, そば (mì kiều mạch), 落花生 (đậu phộng). Nhà hàng: 「〇〇アレルギーがあります」. Label: アレルギー表示 (ký hiệu ⚠). 2025: くるみ (walnut) thêm vào bắt buộc.",
      japaneseExpressions: [
        { word: "アレルギー", reading: "アレルギー", meaning: "Dị ứng (allergy)", jlptLevel: "N4", example: "卵アレルギーがあるので、卵が入っていないか確認してください。", exampleReading: "たまごアレルギーがあるので、たまごがはいっていないかかくにんしてください。", exampleMeaning: "Bị dị ứng trứng, xin kiểm tra có trứng không.", usageNote: "Câu key: 「〇〇アレルギーがあります。〇〇が入っていませんか？」Mang card dị ứng (多言語) = an toàn nhất." },
        { word: "原材料", reading: "げんざいりょう", meaning: "Nguyên liệu (ingredients/raw materials)", jlptLevel: "N3", example: "原材料表示でアレルゲンを確認しましょう。", exampleReading: "げんざいりょうひょうじでアレルゲンをかくにんしましょう。", exampleMeaning: "Kiểm tra dị ứng ở phần nguyên liệu.", usageNote: "Label: 原材料名 → (一部に〇〇を含む) = chứa allergen. 太字 hoặc ngoặc highlight." },
        { word: "エピペン", reading: "エピペン", meaning: "Bút tiêm adrenaline (EpiPen — emergency)", jlptLevel: "N3", example: "アナフィラキシーの時はエピペンを使います。", exampleReading: "アナフィラキシーのときはエピペンをつかいます。", exampleMeaning: "Khi sốc phản vệ dùng EpiPen.", usageNote: "処方箋 cần (bác sĩ kê). 太もも外側 (đùi ngoài) đâm. 119 gọi ngay. 保育園/学校: 預ける (gửi) cho giáo viên." }
      ]
    }
  },
  {
    slug: "home-fire-prevention",
    moduleConfigId: M_SAFETY,
    titleVi: "火災予防 — Phòng cháy chung cư",
    titleJa: "住宅火災の予防と対応",
    descriptionVi: "Phòng cháy ở nhà — nguyên nhân, thiết bị, thoát hiểm.",
    recommendationReasonVi: "火災 = #1 nguy hiểm nhà ở. Biết cách phòng + thoát = sống.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["fire_prevention", "home_safety", "emergency"],
      contentGoal: "Biết phòng cháy + hành động khi cháy.",
      usageNote: "Nguyên nhân #1: コンロ (bếp), たばこ, 電気. Thiết bị bắt buộc: 火災警報器 (smoke detector) mọi nhà. Hành động: ①火を消す ②逃げる ③119. 消火器 (bình chữa cháy): location biết. 避難経路: mỗi tầng 2 lối. Chung cư: ベランダ 避難はしご, 蹴破り戸 (壁 kick vỡ sang nhà kế).",
      japaneseExpressions: [
        { word: "火災警報器", reading: "かさいけいほうき", meaning: "Máy báo cháy (smoke/fire detector)", jlptLevel: "N3", example: "すべての寝室に火災警報器の設置が義務です。", exampleReading: "すべてのしんしつにかさいけいほうきのせっちがぎむです。", exampleMeaning: "Mọi phòng ngủ bắt buộc lắp máy báo cháy.", usageNote: "2006~: 全住宅 義務. 煙式 (khói: phòng ngủ, cầu thang) + 熱式 (nhiệt: bếp). 電池 10年 → 交換. Kêu → 火事じゃない: 料理の煙 → 換気." },
        { word: "消火器", reading: "しょうかき", meaning: "Bình chữa cháy (fire extinguisher)", jlptLevel: "N4", example: "消火器の使い方を覚えておきましょう。", exampleReading: "しょうかきのつかいかたをおぼえておきましょう。", exampleMeaning: "Nhớ cách dùng bình chữa cháy.", usageNote: "Cách: ①ピン抜く (rút chốt) ②ホース向ける (hướng vòi) ③レバー握る (bóp cần). 15秒 phun. 距離: 3-5m. 天井まで燃えたら → 逃げる (KHÔNG chữa nữa)." },
        { word: "避難経路", reading: "ひなんけいろ", meaning: "Đường thoát hiểm (evacuation route)", jlptLevel: "N3", example: "避難経路を事前に確認しておいてください。", exampleReading: "ひなんけいろをじぜんにかくにんしておいてください。", exampleMeaning: "Kiểm tra đường thoát trước.", usageNote: "Chung cư: 2方向避難 (2 hướng). ベランダ: 隔て板 (仕切り板) = kick vỡ sang hàng xóm. 避難はしご: 蓋開ける → 下の階. 普段: 物置かない." }
      ]
    }
  },
  {
    slug: "mental-health-سترس",
    moduleConfigId: M_HEALTH,
    titleVi: "メンタルヘルス — Sức khỏe tâm thần",
    titleJa: "ストレスとメンタルヘルスケア",
    descriptionVi: "Stress + sức khỏe tâm lý ở Nhật — nơi tìm giúp đỡ.",
    recommendationReasonVi: "Nhiều người ngoại stress nhưng KHÔNG BIẾT tìm help ở đâu.",
    category: "safety",
    visualTheme: "teal_health",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["mental_health", "stress", "counseling"],
      contentGoal: "Biết dấu hiệu stress + nơi tìm giúp đỡ.",
      usageNote: "Dấu hiệu: 不眠 (mất ngủ), 食欲不振, イライラ, 涙が止まらない, 出社拒否. Kênh: 心療内科 (tâm thần nhẹ: đặt予約), 精神科 (nặng hơn), よりそいホットライン (0120-279-338: 24h, 多言語), TELL Lifeline (English). Công ty: 産業医 (bác sĩ công ty), EAP. 休職 (nghỉ bệnh): 傷病手当金 (67% lương, 最大1.5年).",
      japaneseExpressions: [
        { word: "心療内科", reading: "しんりょうないか", meaning: "Khoa tâm thể (psychosomatic medicine — khám stress, lo âu)", jlptLevel: "N3", example: "眠れない日が続いたので心療内科を受診しました。", exampleReading: "ねむれないひがつづいたのでしんりょうないかをじゅしんしました。", exampleMeaning: "Mất ngủ liên tục nên đi khám tâm thể.", usageNote: "= bước 1 khi stress nặng. 予約制 (2-4週待ち phổ biến). 初診: 30-60分. 薬 + カウンセリング. 保険適用 (3割負担)." },
        { word: "休職", reading: "きゅうしょく", meaning: "Nghỉ phép bệnh (leave of absence from work)", jlptLevel: "N3", example: "うつ病で3ヶ月間休職しました。", exampleReading: "うつびょうでさんかげつかんきゅうしょくしました。", exampleMeaning: "Nghỉ bệnh 3 tháng vì trầm cảm.", usageNote: "診断書 (giấy chẩn đoán) cần. 傷病手当金: 健保 trả 67% lương, 最大1年6ヶ月. 復職: 段階的 (dần dần tăng giờ). 解雇: KHÔNG hợp pháp trong 休職期間." },
        { word: "カウンセリング", reading: "カウンセリング", meaning: "Tư vấn tâm lý (counseling)", jlptLevel: "N3", example: "会社のカウンセリングサービスは無料で利用できます。", exampleReading: "かいしゃのカウンセリングサービスはむりょうでりようできます。", exampleMeaning: "Dịch vụ tư vấn công ty dùng miễn phí.", usageNote: "保険外: 5000-15000¥/回 (đắt). 保険内: 心療内科 の一部. EAP (会社提供): FREE 3-5回. Online: cotree, Unlace. 外国語: TELL, Tokyo English Life Line." }
      ]
    }
  },
  {
    slug: "traffic-accident-jiko",
    moduleConfigId: M_SAFETY,
    titleVi: "交通事故 — Tai nạn giao thông",
    titleJa: "交通事故に遭った時の対処法",
    descriptionVi: "Bị/gây tai nạn — bước xử lý, bảo hiểm, cảnh sát.",
    recommendationReasonVi: "Tai nạn = panic. Biết bước → xử lý đúng → bảo vệ quyền lợi.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["traffic_accident", "insurance", "emergency_procedure"],
      contentGoal: "Biết xử lý tai nạn giao thông đúng cách.",
      usageNote: "Bước: ①安全確保 (an toàn). ②119 (người bị thương). ③110 (cảnh sát: BẮT BUỘC gọi). ④相手の情報 (tên, SĐT, 保険, ナンバー). ⑤保険会社 連絡. ⑥病院 (ngay cả không đau: むちうち 2-3日 sau mới đau). ĐỪNG: 「大丈夫です」nói ngay tại hiện trường (= từ bỏ bồi thường). 事故証明書: 警察 → 保険 claim cần.",
      japaneseExpressions: [
        { word: "事故証明書", reading: "じこしょうめいしょ", meaning: "Giấy chứng nhận tai nạn (accident certificate)", jlptLevel: "N3", example: "保険請求には事故証明書が必要です。", exampleReading: "ほけんせいきゅうにはじこしょうめいしょがひつようです。", exampleMeaning: "Claim bảo hiểm cần giấy chứng nhận tai nạn.", usageNote: "警察 gọi → họ làm 実況見分 → 自動車安全運転センター phát行. Không gọi 警察 = KHÔNG có giấy = bảo hiểm KHÔNG trả." },
        { word: "過失割合", reading: "かしつわりあい", meaning: "Tỷ lệ lỗi (fault ratio — chia % lỗi)", jlptLevel: "N2", example: "この事故の過失割合は8対2でした。", exampleReading: "このじこのかしつわりあいははちたいにでした。", exampleMeaning: "Tỷ lệ lỗi vụ này là 8:2.", usageNote: "Ví dụ: 8:2 = bên kia 80% lỗi, mình 20%. Quyết: 保険会社 đàm phán. Không đồng ý: 弁護士 (luật sư), 紛争処理センター (miễn phí)." },
        { word: "むちうち", reading: "むちうち", meaning: "Whiplash — chấn thương cổ (thường sau va chạm xe)", jlptLevel: "N3", example: "事故の2日後にむちうちの症状が出ました。", exampleReading: "じこのふつかごにむちうちのしょうじょうがでました。", exampleMeaning: "2 ngày sau tai nạn xuất hiện triệu chứng cổ.", usageNote: "QUAN TRỌNG: 事故当日 đi bệnh viện DÙ KHÔNG ĐAU. Sau 2-3日 mới đau = phổ biến. Không khám sớm = bảo hiểm từ chối (因果関係 chứng minh khó)." }
      ]
    }
  },
  {
    slug: "water-disaster-preparation",
    moduleConfigId: M_SAFETY,
    titleVi: "水害対策 — Phòng chống ngập lụt",
    titleJa: "大雨・洪水への備え",
    descriptionVi: "Mưa lớn, ngập — chuẩn bị, cảnh báo, sơ tán.",
    recommendationReasonVi: "Mỗi năm Nhật có 水害. Biết chuẩn bị + level cảnh báo = an toàn.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 178,
    metadata: {
      seed: true,
      skills: ["flood", "disaster_prep", "weather_alert"],
      contentGoal: "Biết chuẩn bị cho 水害 + hiểu cảnh báo.",
      usageNote: "Mùa: 6-10月 (梅雨 + 台風). 警戒レベル: 1 (心構え), 2 (避難行動確認), 3 (高齢者等避難), 4 (全員避難!), 5 (命を守る行動: ĐÃ MUỘN). Check: ハザードマップ (bản đồ nguy hiểm: 市区町村 HP). Chuẩn bị: 非常持出袋, 浸水対策 (止水板, 土のう), 車 di chuyển sớm.",
      japaneseExpressions: [
        { word: "ハザードマップ", reading: "ハザードマップ", meaning: "Bản đồ nguy hiểm (hazard map — vùng ngập/lở)", jlptLevel: "N3", example: "自分の住んでいる場所のハザードマップを確認しましょう。", exampleReading: "じぶんのすんでいるばしょのハザードマップをかくにんしましょう。", exampleMeaning: "Kiểm tra hazard map nơi mình ở.", usageNote: "市区町村 website + 重ねるハザードマップ (国交省: toàn quốc online). Check TRƯỚC mùa mưa. Vùng đỏ/tím = nguy hiểm cao." },
        { word: "氾濫", reading: "はんらん", meaning: "Tràn bờ/ngập (flooding/overflow)", jlptLevel: "N3", example: "川が氾濫して住宅地に浸水しました。", exampleReading: "かわがはんらんしてじゅうたくちにしんすいしました。", exampleMeaning: "Sông tràn bờ ngập khu dân cư.", usageNote: "氾濫危険水位 → 氾濫発生. NHK/気象庁 dùng trong tin. 内水氾濫 (ngập cống: đô thị) vs 外水氾濫 (sông tràn)." },
        { word: "土砂災害", reading: "どしゃさいがい", meaning: "Sạt lở đất (landslide/debris flow)", jlptLevel: "N3", example: "大雨の後は土砂災害に警戒してください。", exampleReading: "おおあめのあとはどしゃさいがいにけいかいしてください。", exampleMeaning: "Sau mưa lớn cảnh giác sạt lở.", usageNote: "山/崖 gần = nguy hiểm. 前兆: 地鳴り (đất rung), 川の水 濁る (đục), 斜面にひび. Thấy → 即避難. 2014 広島, 2018 西日本: nhiều người chết." }
      ]
    }
  },
  // === FAMILY (5) ===
  {
    slug: "childcare-leave-ikukyuu",
    moduleConfigId: M_FAMILY,
    titleVi: "育休 — Nghỉ phép nuôi con",
    titleJa: "育児休業の取り方",
    descriptionVi: "Nghỉ nuôi con ở Nhật — quyền lợi, trợ cấp, nam cũng được.",
    recommendationReasonVi: "QUYỀN LỢI LỚN mà nhiều người ngoại KHÔNG BIẾT. Nam: được nghỉ!",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 188,
    metadata: {
      seed: true,
      skills: ["parental_leave", "benefits", "work_life_balance"],
      contentGoal: "Biết quyền 育休 + cách xin + trợ cấp.",
      usageNote: "Ai: MỌI NGƯỜI (正社員, 契約社員, パート — 1年+ làm). Thời gian: max 子が2歳. Nam: 産後パパ育休 (4週, 2回分割OK) + 通常育休. Trợ cấp: 育児休業給付金 67% lương (6ヶ月) → 50% (sau). 社会保険料: MIỄN. 2025: 80%に引上げ dự kiến. ĐỪNG từ bỏ. 解雇: BẤT HỢP PHÁP.",
      japaneseExpressions: [
        { word: "育児休業", reading: "いくじきゅうぎょう", meaning: "Nghỉ phép nuôi con (childcare leave)", jlptLevel: "N3", example: "男性の育児休業取得率が上がっています。", exampleReading: "だんせいのいくじきゅうぎょうしゅとくりつがあがっています。", exampleMeaning: "Tỷ lệ nam lấy phép nuôi con tăng.", usageNote: "略: 育休. 申請: 1ヶ月前 会社に. Nam 2023: ~30% (目標 50%). Nữ: ~80%. Ngoại quốc: CÙNG QUYỀN. Công ty từ chối = vi phạm." },
        { word: "育児休業給付金", reading: "いくじきゅうぎょうきゅうふきん", meaning: "Trợ cấp nghỉ nuôi con (childcare leave benefit)", jlptLevel: "N2", example: "育児休業給付金は最初の6ヶ月は給料の67%です。", exampleReading: "いくじきゅうぎょうきゅうふきんはさいしょのろっかげつはきゅうりょうのろくじゅうななパーセントです。", exampleMeaning: "Trợ cấp 6 tháng đầu = 67% lương.", usageNote: "ハローワーク (Hello Work) trả. 非課税 (không đóng thuế) + 社保免除 → thực tế ~80% thu nhập. 2025: 80% dự kiến (vợ chồng cùng nghỉ)." },
        { word: "産後パパ育休", reading: "さんごパパいくきゅう", meaning: "Nghỉ bố sau sinh (postnatal father's leave — 4 tuần)", jlptLevel: "N2", example: "産後パパ育休を2回に分けて取得しました。", exampleReading: "さんごパパいくきゅうをにかいにわけてしゅとくしました。", exampleMeaning: "Lấy phép bố sau sinh chia 2 lần.", usageNote: "2022/10~ mới. 出生後8週以内 (8 tuần sau sinh). 4週間 max. 2回 chia OK. 申請: 2週間前. Làm việc一部 OK (合意あれば). + 通常育休 riêng = total rất dài." }
      ]
    }
  },
  {
    slug: "elderly-care-kaigo",
    moduleConfigId: M_FAMILY,
    titleVi: "介護 — Chăm sóc người già",
    titleJa: "親の介護と制度",
    descriptionVi: "Khi bố mẹ già — chế độ 介護保険, dịch vụ, nghỉ phép.",
    recommendationReasonVi: "Nhật: ai cũng sẽ đối mặt. Biết chế độ = không lo tài chính.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["elderly_care", "insurance", "family_support"],
      contentGoal: "Biết chế độ chăm sóc người già + dịch vụ có.",
      usageNote: "介護保険: 40歳+ đóng. 65歳+ dùng được (hoặc 40-64 bệnh cụ thể). 認定: 要支援1-2, 要介護1-5 (申請 → 調査 → 認定). Dịch vụ: ヘルパー (helper đến nhà), デイサービス (trung tâm ngày), 施設入所 (vào viện). Tự trả: 10-30% (thu nhập). 介護休業 (nghỉ chăm): 93日/人, 3回分割.",
      japaneseExpressions: [
        { word: "介護保険", reading: "かいごほけん", meaning: "Bảo hiểm chăm sóc (long-term care insurance)", jlptLevel: "N3", example: "介護保険を使えば自己負担は1-3割です。", exampleReading: "かいごほけんをつかえばじこふたんはいちからさんわりです。", exampleMeaning: "Dùng bảo hiểm chăm sóc tự trả 10-30%.", usageNote: "40歳~ lương bị trừ (月: ~6000-10000¥). 65歳~ sử dụng quyền. 申請: 市区町村 窓口 → 訪問調査 → 認定 (30日~). ケアマネ (care manager) lên plan." },
        { word: "デイサービス", reading: "デイサービス", meaning: "Dịch vụ ngày (adult day care service)", jlptLevel: "N3", example: "母は週3回デイサービスに通っています。", exampleReading: "ははしゅうさんかいデイサービスにかよっています。", exampleMeaning: "Mẹ đi trung tâm ngày 3 lần/tuần.", usageNote: "朝 đón → 入浴, 食事, レクリエーション → 夕方 送り. 家族: nghỉ ngơi (レスパイト). 費用: 1000-2000¥/回 (保険後). 認知症対応型 cũng có." },
        { word: "介護休業", reading: "かいごきゅうぎょう", meaning: "Nghỉ phép chăm sóc (family care leave)", jlptLevel: "N3", example: "親の介護のため介護休業を取りました。", exampleReading: "おやのかいごのためかいごきゅうぎょうをとりました。", exampleMeaning: "Nghỉ phép chăm sóc bố mẹ.", usageNote: "93日/対象家族. 3回分割 OK. 給付: 67% lương (雇用保険). 介護休暇: 年5日 (子or親 1人), 年10日 (2人+). 時間単位 OK." }
      ]
    }
  },
  {
    slug: "children-safety-kodomo",
    moduleConfigId: M_FAMILY,
    titleVi: "子どもの安全 — An toàn trẻ em",
    titleJa: "子どもの安全対策",
    descriptionVi: "Bảo vệ con ở Nhật — GPS, 防犯ブザー, 通学路.",
    recommendationReasonVi: "Nhật an toàn nhưng VẪN CÓ vụ. Biết tools + quy tắc = an tâm.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 178,
    metadata: {
      seed: true,
      skills: ["child_safety", "gps", "community_watch"],
      contentGoal: "Biết tools + quy tắc bảo vệ con.",
      usageNote: "Tools: 防犯ブザー (còi báo động: cấp 小学校 cho free), キッズケータイ/GPS (docomo, au: theo dõi vị trí), こども110番の家 (nhà an toàn: sticker vàng). Quy tắc: 通学路 (đường đi học: định sẵn), 一人で帰らない (không về 1 mình tối), 「いかのおすし」(not go with stranger).",
      japaneseExpressions: [
        { word: "防犯ブザー", reading: "ぼうはんブザー", meaning: "Còi báo động (personal safety alarm — cho trẻ)", jlptLevel: "N4", example: "ランドセルに防犯ブザーを付けましょう。", exampleReading: "ランドセルにぼうはんブザーをつけましょう。", exampleMeaning: "Gắn còi báo động lên cặp.", usageNote: "小学校 入学時 phát (多くの自治体). Kéo = kêu inh ỏi. 月1 kiểm tra pin. Gắn ngoài (dễ với tay). 不審者 (người lạ đáng ngờ) → kéo + chạy." },
        { word: "通学路", reading: "つうがくろ", meaning: "Đường đi học (school route)", jlptLevel: "N4", example: "通学路には見守りボランティアがいます。", exampleReading: "つうがくろにはみまもりボランティアがいます。", exampleMeaning: "Đường đi học có tình nguyện viên canh.", usageNote: "学校 chỉ定. 集団登校 (đi nhóm): 班長 (lớp 6) dẫn. 旗当番: phụ huynh luân phiên cầm cờ. 帰り: 1-2年 集団下校, 3+ tự về (nhóm)." },
        { word: "こども110番の家", reading: "こどもひゃくとおばんのいえ", meaning: "Nhà an toàn cho trẻ (community safe house)", jlptLevel: "N4", example: "怖いことがあったらこども110番の家に逃げ込みましょう。", exampleReading: "こわいことがあったらこどもひゃくとおばんのいえににげこみましょう。", exampleMeaning: "Gặp nguy hiểm chạy vào nhà 110.", usageNote: "Sticker vàng/cam ở cửa. Cửa hàng, nhà dân đăng ký. Trẻ: dạy nhận diện sticker. 不審者: chạy vào → người lớn giúp gọi 110." }
      ]
    }
  },
  // === MONEY (3) ===
  {
    slug: "moving-cost-saving",
    moduleConfigId: M_MONEY,
    titleVi: "引越し費用 — Tiết kiệm chuyển nhà",
    titleJa: "引越し費用を安くするコツ",
    descriptionVi: "Chi phí chuyển nhà — cách giảm, so sánh, mùa rẻ.",
    recommendationReasonVi: "Chuyển nhà Nhật = ĐẮT (10-30万). Biết trick = tiết kiệm 50%.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["moving_cost", "negotiation", "budgeting"],
      contentGoal: "Biết cách tiết kiệm phí chuyển nhà.",
      usageNote: "Phí TB: 単身 5-10万, 家族 15-30万. Mùa đắt: 3-4月 (x1.5-2 giá). Rẻ: 5-2月 (閑散期). Tips: ①相見積もり (so sánh 3+ hãng). ②不用品処分 trước. ③平日/午後便 rẻ. ④単身パック (1 box: 2-4万). ⑤フリー便 (không chọn giờ). Site: 引越し侍, SUUMO引越し (比較).",
      japaneseExpressions: [
        { word: "見積もり", reading: "みつもり", meaning: "Báo giá (estimate/quotation)", jlptLevel: "N3", example: "3社から見積もりを取って比較しました。", exampleReading: "さんしゃからみつもりをとってひかくしました。", exampleMeaning: "Lấy báo giá 3 hãng so sánh.", usageNote: "相見積もり (nhiều hãng): QUAN TRỌNG NHẤT. Hãng biết bạn so sánh → giảm giá. 訪問見積もり (đến nhà xem): chính xác hơn. ネット見積もり: nhanh nhưng sơ bộ." },
        { word: "閑散期", reading: "かんさんき", meaning: "Mùa thấp điểm (off-peak season)", jlptLevel: "N3", example: "閑散期に引越しすると半額近く安くなります。", exampleReading: "かんさんきにひっこしするとはんがくちかくやすくなります。", exampleMeaning: "Chuyển nhà mùa thấp điểm rẻ gần nửa.", usageNote: "5-2月: 閑散期 (trừ GW, 年末). 平日 > 土日. 午後/フリー > 午前. 月末 > 月初. 組合わせ: 閑散期 + 平日 + 午後 = RẺ NHẤT." },
        { word: "不用品", reading: "ふようひん", meaning: "Đồ không dùng (unwanted items)", jlptLevel: "N4", example: "引越し前に不用品を処分しましょう。", exampleReading: "ひっこしまえにふようひんをしょぶんしましょう。", exampleMeaning: "Xử lý đồ không dùng trước khi chuyển.", usageNote: "Ít đồ = phí chuyển rẻ (荷物量 quyết giá). Bán: メルカリ, ジモティー. 捨: 粗大ゴミ. 寄付: NPO. リサイクルショップ: tiền ít nhưng nhanh." }
      ]
    }
  },
  {
    slug: "insurance-types-hoken",
    moduleConfigId: M_EMERALD,
    titleVi: "保険の種類 — Các loại bảo hiểm",
    titleJa: "日本で必要な保険",
    descriptionVi: "Bảo hiểm cần/không cần ở Nhật — phân biệt, tiết kiệm.",
    recommendationReasonVi: "Nhân viên bảo hiểm hay gạ. Biết = chỉ mua CẦN, tiết kiệm万/năm.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["insurance", "financial_planning", "consumer_protection"],
      contentGoal: "Biết loại bảo hiểm nào cần/không cần.",
      usageNote: "Bắt buộc: 健康保険 (y tế: có rồi), 年金 (lương hưu: có rồi), 自賠責 (xe: bắt buộc), 火災保険 (cháy: chung cư yêu cầu). Nên có: 自転車保険, 生命保険 (nếu có gia đình), がん保険. KHÔNG CẦN (đa số): 医療保険 (vì 高額療養費制度 = max 8-9万/月). Tip: 共済 (CO-OP mutual: rẻ).",
      japaneseExpressions: [
        { word: "高額療養費制度", reading: "こうがくりょうようひせいど", meaning: "Chế độ giới hạn chi phí y tế (high-cost medical expense system)", jlptLevel: "N2", example: "高額療養費制度のおかげで月の医療費は約8万円が上限です。", exampleReading: "こうがくりょうようひせいどのおかげでつきのいりょうひはやくはちまんえんがじょうげんです。", exampleMeaning: "Nhờ chế độ giới hạn y tế, max ~8 vạn/tháng.", usageNote: "= lý do 医療保険 KHÔNG CẦN cho nhiều người. Thu nhập TB: max 80,100¥/月 (dù phẫu thuật 100万). 限度額適用認定証: xin trước → không ứng tiền." },
        { word: "掛け捨て", reading: "かけすて", meaning: "Bảo hiểm không hoàn (term insurance — rẻ)", jlptLevel: "N3", example: "掛け捨ての生命保険は保険料が安いです。", exampleReading: "かけすてのせいめいほけんはほけんりょうがやすいです。", exampleMeaning: "Bảo hiểm sinh mạng không hoàn phí rẻ.", usageNote: "掛け捨て (thuần bảo hiểm: rẻ, hết kỳ = hết) vs 貯蓄型 (tích lũy: đắt, trả lại). Hầu hết expert khuyên: 掛け捨て + 投資 riêng = hiệu quả hơn." },
        { word: "火災保険", reading: "かさいほけん", meaning: "Bảo hiểm cháy (fire insurance — cho nhà ở)", jlptLevel: "N3", example: "賃貸でも火災保険への加入が必要です。", exampleReading: "ちんたいでもかさいほけんへのかにゅうがひつようです。", exampleMeaning: "Thuê nhà cũng cần bảo hiểm cháy.", usageNote: "Thuê: 大家/管理会社 yêu cầu (1.5-2万/2年). Cover: 火災, 水漏れ (rò nước), 盗難, 個人賠償. 不動産 giới thiệu: ĐẮT → tự chọn hãng OK (告知すれば)." }
      ]
    }
  },
  {
    slug: "secondhand-shopping-chuuko",
    moduleConfigId: M_MONEY,
    titleVi: "中古・リユース — Mua đồ secondhand",
    titleJa: "中古品の賢い買い方",
    descriptionVi: "Mua đồ cũ ở Nhật — app, cửa hàng, mẹo.",
    recommendationReasonVi: "Nhật: đồ cũ = GẦN NHƯ MỚI, giá 50-70% off. Biết = sống sang + rẻ.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["secondhand", "frugal_living", "apps"],
      contentGoal: "Biết mua đồ cũ ở đâu + mẹo.",
      usageNote: "App: メルカリ (#1, 個人間), ラクマ, PayPayフリマ. Cửa hàng: ハードオフ/オフハウス (điện tử, đồ nhà), セカンドストリート (quần áo), ブックオフ (sách/manga/game), トレジャーファクトリー. Online: ヤフオク (auction). Mẹo: 値下げ交渉 (mặc cả: メルカリ OK), 引越しシーズン = nhiều đồ tốt rẻ (3-4月).",
      japaneseExpressions: [
        { word: "フリマアプリ", reading: "フリマアプリ", meaning: "App chợ trời (flea market app — メルカリ etc)", jlptLevel: "N4", example: "フリマアプリで家電を安く買いました。", exampleReading: "フリマアプリでかでんをやすくかいました。", exampleMeaning: "Mua đồ điện rẻ trên app chợ trời.", usageNote: "メルカリ: #1 (2000万+ users). 匿名配送 (giao ẩn danh). 評価 check. 値下げ交渉:「お値下げ可能ですか？」(thường 10-20% off OK)." },
        { word: "リサイクルショップ", reading: "リサイクルショップ", meaning: "Cửa hàng đồ cũ (secondhand/thrift store)", jlptLevel: "N4", example: "リサイクルショップで洗濯機を1万円で買えました。", exampleReading: "リサイクルショップでせんたくきをいちまんえんでかえました。", exampleMeaning: "Mua máy giặt 1 vạn ở shop đồ cũ.", usageNote: "Nhật: chất lượng CAO (người Nhật thay đồ nhanh). 動作確認済み (đã test). 保証 短い (1-3ヶ月). 引越し 3-4月: 大量入荷 → rẻ." },
        { word: "ジモティー", reading: "ジモティー", meaning: "App cho/nhận đồ local (community board — often FREE)", jlptLevel: "N4", example: "ジモティーで冷蔵庫を無料でもらいました。", exampleReading: "ジモティーでれいぞうこをむりょうでもらいました。", exampleMeaning: "Nhận tủ lạnh miễn phí trên Jmty.", usageNote: "= Craigslist Nhật. 0円 (miễn phí) nhiều. 引き取り (tự đến lấy). Gia dụng lớn: 粗大ゴミ出すの面倒 → cho free. 直接会う: 公共の場 で." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🔷 Mixed batch 5a (safety/family/money)...");
  await runBatch(client, cards, "Mixed-5a");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
