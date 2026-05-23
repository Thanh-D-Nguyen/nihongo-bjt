/**
 * Radar Seed: Safety & Health batch 4 (10 cards)
 * Topics: pharmacy, allergy season, earthquake prep, crime prevention, fitness, mental health expanded
 * Run: node scripts/seed-radar-safety-4.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_SAFE = MODULES.safety_emergency;
const M_HEALTH = MODULES.health_clinic;

const cards = [
  {
    slug: "pharmacy-drugstore-usage",
    moduleConfigId: M_HEALTH,
    titleVi: "薬局 — Mua thuốc ở Nhật",
    titleJa: "薬局・ドラッグストアの使い方",
    descriptionVi: "Phân biệt loại thuốc, cách hỏi dược sĩ, thuốc không cần toa.",
    recommendationReasonVi: "Bệnh nhẹ = drugstore đủ. Biết cách mua thuốc = tiết kiệm tiền + thời gian.",
    category: "safety",
    visualTheme: "teal_health",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["pharmacy", "medicine", "self_care"],
      contentGoal: "Biết cách mua thuốc ở drugstore + hỏi dược sĩ.",
      usageNote: "Loại: 第1類 (dược sĩ tư vấn, quầy riêng), 第2類 (phổ biến: 風邪薬, 痛み止め), 第3類 (nhẹ: vitamin, mỡ bôi). Hỏi: 薬剤師に聞く. Chain: マツキヨ, ウェルシア, スギ薬局, ツルハ.",
      japaneseExpressions: [
        { word: "市販薬", reading: "しはんやく", meaning: "Thuốc bán tự do (OTC — không cần toa)", jlptLevel: "N3", example: "軽い風邪なら市販薬で十分です。", exampleReading: "かるいかぜならしはんやくでじゅうぶんです。", exampleMeaning: "Cảm nhẹ thì thuốc OTC đủ.", usageNote: "処方薬 (thuốc toa) vs 市販薬 (tự mua). 市販薬 cho: đau đầu, cảm, dị ứng, đau bụng." },
        { word: "薬剤師", reading: "やくざいし", meaning: "Dược sĩ (pharmacist)", jlptLevel: "N3", example: "症状を薬剤師に相談してから買いましょう。", exampleReading: "しょうじょうをやくざいしにそうだんしてからかいましょう。", exampleMeaning: "Hỏi dược sĩ triệu chứng trước khi mua.", usageNote: "Nói triệu chứng → recommend thuốc. Tip: 'XXXに効く薬ありますか？' (Có thuốc trị XXX không?)" },
        { word: "お薬手帳", reading: "おくすりてちょう", meaning: "Sổ thuốc (medication record booklet)", jlptLevel: "N3", example: "お薬手帳を持っていると、薬の飲み合わせを確認してもらえます。", exampleReading: "おくすりてちょうをもっていると、くすりののみあわせをかくにんしてもらえます。", exampleMeaning: "Có sổ thuốc thì dược sĩ kiểm tra tương tác thuốc.", usageNote: "Ghi lại tất cả thuốc đang dùng. Mang khi khám bệnh. App: EPARKお薬手帳 (điện tử)." }
      ]
    }
  },
  {
    slug: "hay-fever-kafunsho",
    moduleConfigId: M_HEALTH,
    titleVi: "花粉症 — Dị ứng phấn hoa",
    titleJa: "花粉症の対策と治療",
    descriptionVi: "Dị ứng phấn hoa — mùa, triệu chứng, thuốc, biện pháp.",
    recommendationReasonVi: "40% dân Nhật bị 花粉症. Sống Nhật = rất có thể bạn cũng bị.",
    category: "safety",
    visualTheme: "teal_health",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["allergy", "seasonal_health", "prevention"],
      contentGoal: "Biết mùa phấn hoa + cách phòng/trị.",
      usageNote: "Mùa: スギ (tuyết tùng) 2-4月 = TỆ NHẤT. ヒノキ 3-5月. ブタクサ 8-10月. Triệu chứng: hắt hơi, ngứa mắt, nghẹt mũi. Phòng: マスク, メガネ, 花粉予報 check. Thuốc: 抗ヒスタミン (antihistamine) — drugstore có.",
      japaneseExpressions: [
        { word: "花粉症", reading: "かふんしょう", meaning: "Dị ứng phấn hoa (hay fever)", jlptLevel: "N3", example: "花粉症の薬を飲まないと、仕事に集中できません。", exampleReading: "かふんしょうのくすりをのまないと、しごとにしゅうちゅうできません。", exampleMeaning: "Không uống thuốc dị ứng thì không tập trung được.", usageNote: "日本人: 約40% bị. Người nước ngoài: có thể phát triệu chứng sau 2-3 năm sống ở Nhật." },
        { word: "目薬", reading: "めぐすり", meaning: "Thuốc nhỏ mắt (eye drops)", jlptLevel: "N4", example: "花粉の季節は目薬が手放せません。", exampleReading: "かふんのきせつはめぐすりがてばなせません。", exampleMeaning: "Mùa phấn hoa không thể thiếu thuốc nhỏ mắt.", usageNote: "かゆみ止め (chống ngứa) type. 300-1500¥. Cool type phổ biến ở Nhật." },
        { word: "舌下免疫療法", reading: "ぜっかめんえきりょうほう", meaning: "Liệu pháp miễn dịch dưới lưỡi (cure dị ứng)", jlptLevel: "N1", example: "舌下免疫療法を始めて、花粉症が楽になりました。", exampleReading: "ぜっかめんえきりょうほうをはじめて、かふんしょうがらくになりました。", exampleMeaning: "Bắt đầu liệu pháp miễn dịch, dị ứng đỡ hơn.", usageNote: "3-5年 uống thuốc mỗi ngày → 70-80% khỏi. Bắt đầu ngoài mùa (6-12月). Bảo hiểm cover." }
      ]
    }
  },
  {
    slug: "earthquake-bag-preparation",
    moduleConfigId: M_SAFE,
    titleVi: "防災リュック — Balo phòng thảm họa",
    titleJa: "防災リュックの準備",
    descriptionVi: "Chuẩn bị balo khẩn cấp — đồ cần có, nơi mua, checklist.",
    recommendationReasonVi: "Nhật = động đất. Balo sẵn sàng = sống sót + bình tĩnh khi cần.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["disaster_preparation", "emergency_kit", "earthquake"],
      contentGoal: "Biết cần chuẩn bị gì + mua ở đâu.",
      usageNote: "Cần: 水 (3日分: 9L/人), 食料 (カンパン, レトルト), 懐中電灯, ラジオ, モバイルバッテリー, 救急セット, 現金 (小銭), 身分証コピー, トイレ袋. Mua: Amazon, ホームセンター, 防災セット (sẵn 5000-15000¥).",
      japaneseExpressions: [
        { word: "非常持ち出し袋", reading: "ひじょうもちだしぶくろ", meaning: "Túi đồ khẩn cấp mang theo (emergency go-bag)", jlptLevel: "N3", example: "玄関に非常持ち出し袋を置いています。", exampleReading: "げんかんにひじょうもちだしぶくろをおいています。", exampleMeaning: "Để túi khẩn cấp ở cửa.", usageNote: "Đặt ở 玄関 (lối vào) = lấy nhanh khi chạy. Mỗi người 1 túi. Check hạn sử dụng 6ヶ月/lần." },
        { word: "備蓄", reading: "びちく", meaning: "Dự trữ (stockpiling supplies)", jlptLevel: "N3", example: "最低3日分の食料と水を備蓄してください。", exampleReading: "さいていみっかぶんのしょくりょうとみずをびちくしてください。", exampleMeaning: "Dự trữ tối thiểu 3 ngày đồ ăn + nước.", usageNote: "3日 = minimum. Recommend 7日. ローリングストック: dùng → bổ sung liên tục (không để hết hạn)." },
        { word: "簡易トイレ", reading: "かんいトイレ", meaning: "Toilet tạm (portable toilet bags)", jlptLevel: "N3", example: "断水時に備えて簡易トイレを用意しましょう。", exampleReading: "だんすいじにそなえてかんいトイレをよういしましょう。", exampleMeaning: "Chuẩn bị toilet tạm phòng khi mất nước.", usageNote: "Mất nước = KHÔNG xả toilet. 簡易トイレ: túi + bột hấp thụ. 50回分 ~3000¥. QUAN TRỌNG nhất mà hay quên!" }
      ]
    }
  },
  {
    slug: "crime-prevention-tips",
    moduleConfigId: M_SAFE,
    titleVi: "防犯 — Phòng chống tội phạm",
    titleJa: "日常の防犯対策",
    descriptionVi: "Phòng trộm, lừa đảo, chikan — mẹo an toàn ở Nhật.",
    recommendationReasonVi: "Nhật an toàn NHƯNG không = 0 tội phạm. Biết phòng = an tâm.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["crime_prevention", "personal_safety", "scam_awareness"],
      contentGoal: "Biết cách phòng trộm + lừa đảo + quấy rối.",
      usageNote: "Phổ biến: 空き巣 (trộm nhà — khóa 2重), 振り込め詐欺 (lừa chuyển tiền — người già), 痴漢 (quấy rối tàu — 女性専用車両). Gọi: 110 (cảnh sát), 交番 (đồn gần nhất).",
      japaneseExpressions: [
        { word: "振り込め詐欺", reading: "ふりこめさぎ", meaning: "Lừa đảo chuyển khoản (phone scam)", jlptLevel: "N2", example: "「お金を振り込んでください」という電話は詐欺です。", exampleReading: "「おかねをふりこんでください」というでんわはさぎです。", exampleMeaning: "Điện thoại bảo 'chuyển tiền' = lừa đảo.", usageNote: "オレオレ詐欺: giả con/cháu gọi điện. Cảnh sát KHÔNG BAO GIỜ yêu cầu chuyển tiền qua ĐT. Nghi → 110." },
        { word: "交番", reading: "こうばん", meaning: "Đồn cảnh sát nhỏ (police box — ở mỗi khu)", jlptLevel: "N4", example: "困ったことがあったら、近くの交番に行きましょう。", exampleReading: "こまったことがあったら、ちかくのこうばんにいきましょう。", exampleMeaning: "Gặp chuyện khó thì đến đồn gần nhất.", usageNote: "24h. Giúp: đường, đồ mất, khai báo. Thân thiện. Người nước ngoài OK hỏi." },
        { word: "女性専用車両", reading: "じょせいせんようしゃりょう", meaning: "Toa tàu dành riêng nữ (women-only car)", jlptLevel: "N3", example: "朝のラッシュ時は女性専用車両に乗ります。", exampleReading: "あさのラッシュじはじょせいせんようしゃりょうにのります。", exampleMeaning: "Giờ rush sáng tôi đi toa nữ.", usageNote: "Sáng rush (7-9:30). Đầu/cuối tàu. Biển hồng. Nam vào = khá awkward. 痴漢対策 (chống quấy rối)." }
      ]
    }
  },
  {
    slug: "gym-fitness-japan",
    moduleConfigId: M_HEALTH,
    titleVi: "ジム — Tập gym ở Nhật",
    titleJa: "ジムの選び方と利用マナー",
    descriptionVi: "Loại gym, phí, quy tắc — từ 24h gym đến public sports center.",
    recommendationReasonVi: "Khỏe = học tốt + làm tốt. Biết cách dùng gym ở Nhật.",
    category: "safety",
    visualTheme: "teal_health",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 150,
    metadata: {
      seed: true,
      skills: ["fitness", "gym", "health_lifestyle"],
      contentGoal: "Biết loại gym + quy tắc + từ vựng.",
      usageNote: "Loại: 24hジム (ANYTIME, JOYFIT: 7000-8000¥/月), 総合ジム (KONAMI, TIPNESS: 10,000-15,000¥/月 + pool + studio), 公営ジム (quận: 300-500¥/回). Quy tắc: タオル trải máy, 拭く (lau) sau dùng, KHÔNG selfie khu locker.",
      japaneseExpressions: [
        { word: "入会金", reading: "にゅうかいきん", meaning: "Phí gia nhập (enrollment fee)", jlptLevel: "N4", example: "今月入会すると入会金無料キャンペーン中です。", exampleReading: "こんげつにゅうかいするとにゅうかいきんむりょうキャンペーンちゅうです。", exampleMeaning: "Tháng này vào hội miễn phí gia nhập.", usageNote: "Thường 5000-10,000¥. Campaign: thường xuyên có. Tip: 月初 or 月末 hay có キャンペーン." },
        { word: "体験", reading: "たいけん", meaning: "Dùng thử (trial session)", jlptLevel: "N4", example: "入会前に体験レッスンを受けられます。", exampleReading: "にゅうかいまえにたいけんレッスンをうけられます。", exampleMeaning: "Trước khi vào hội có thể dùng thử.", usageNote: "Hầu hết gym: 1回無料体験. Mang: 室内シューズ, タオル, 身分証." },
        { word: "マシン", reading: "マシン", meaning: "Máy tập (gym machine/equipment)", jlptLevel: "N4", example: "マシンの使い方がわからない時は、スタッフに聞いてください。", exampleReading: "マシンのつかいかたがわからないときは、スタッフにきいてください。", exampleMeaning: "Không biết dùng máy thì hỏi staff.", usageNote: "混雑時: 1セット3分→次の人に譲る. 携帯見ながら座る = NG." }
      ]
    }
  },
  {
    slug: "heatstroke-prevention",
    moduleConfigId: M_SAFE,
    titleVi: "熱中症 — Phòng say nắng",
    titleJa: "熱中症の予防と対処",
    descriptionVi: "Say nắng ở Nhật mùa hè — triệu chứng, phòng tránh, sơ cứu.",
    recommendationReasonVi: "Hè Nhật 35-40°C. Mỗi năm 1000+ người chết vì 熱中症. Biết = sống.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 188,
    metadata: {
      seed: true,
      skills: ["heatstroke", "summer_safety", "first_aid"],
      contentGoal: "Nhận biết + phòng + sơ cứu say nắng.",
      usageNote: "Triệu chứng: めまい (chóng mặt), 吐き気 (buồn nôn), 頭痛, 意識もうろう. Phòng: uống nước thường xuyên (のどが渇く前に!), 帽子, 日傘, エアコン. Sơ cứu: 涼しい場所 (chỗ mát), 首・脇 làm lạnh, 水分補給. Nặng → 119 (cấp cứu).",
      japaneseExpressions: [
        { word: "熱中症", reading: "ねっちゅうしょう", meaning: "Say nắng/sốc nhiệt (heatstroke)", jlptLevel: "N3", example: "熱中症に注意してこまめに水分を取ってください。", exampleReading: "ねっちゅうしょうにちゅういしてこまめにすいぶんをとってください。", exampleMeaning: "Cẩn thận say nắng, uống nước thường xuyên.", usageNote: "7-8月 đỉnh. Nguy hiểm: 高齢者 (người già) + 子ども + 外作業者. WBGT 31+ = nguy hiểm." },
        { word: "経口補水液", reading: "けいこうほすいえき", meaning: "Dung dịch bù nước (oral rehydration solution)", jlptLevel: "N2", example: "熱中症の時は経口補水液を少しずつ飲んでください。", exampleReading: "ねっちゅうしょうのときはけいこうほすいえきをすこしずつのんでください。", exampleMeaning: "Say nắng thì uống từ từ dung dịch bù nước.", usageNote: "OS-1 (大塚製薬): phổ biến nhất. コンビニ, 薬局 有. Khác nước thể thao: nhiều 塩分 (muối) hơn." },
        { word: "日傘", reading: "ひがさ", meaning: "Dù che nắng (parasol — nam nữ đều dùng)", jlptLevel: "N4", example: "最近は男性も日傘を使う人が増えています。", exampleReading: "さいきんはだんせいもひがさをつかうひとがふえています。", exampleMeaning: "Gần đây nam giới dùng dù che nắng cũng nhiều.", usageNote: "2024~: 男性用日傘 trend. 体感温度 -5-8°C. UVカット率 99%+ recommend." }
      ]
    }
  },
  {
    slug: "natural-disaster-vocabulary",
    moduleConfigId: M_SAFE,
    titleVi: "災害用語 — Từ vựng thảm họa",
    titleJa: "知っておくべき災害用語",
    descriptionVi: "Từ vựng thiên tai cần biết — cảnh báo, sơ tán, cấp cứu.",
    recommendationReasonVi: "Động đất/bão = tin tức tiếng Nhật. Hiểu từ vựng = hành động đúng lúc.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 192,
    metadata: {
      seed: true,
      skills: ["disaster_vocabulary", "emergency_response", "news_comprehension"],
      contentGoal: "Biết từ vựng thiên tai quan trọng nhất để hiểu cảnh báo.",
      usageNote: "TV/app cảnh báo: 5段階 (警戒レベル1-5). レベル3: 高齢者避難. レベル4: 全員避難. レベル5: すでに災害発生. App: Yahoo!防災速報 (BẮT BUỘC cài).",
      japaneseExpressions: [
        { word: "避難所", reading: "ひなんじょ", meaning: "Nơi sơ tán (evacuation shelter)", jlptLevel: "N3", example: "地震が起きたら、最寄りの避難所に行ってください。", exampleReading: "じしんがおきたら、もよりのひなんじょにいってください。", exampleMeaning: "Động đất xảy ra thì đến nơi sơ tán gần nhất.", usageNote: "Trường học, 公民館 thường là 避難所. Check: ハザードマップ (hazard map) của quận. Đi bộ được = tốt." },
        { word: "警報", reading: "けいほう", meaning: "Cảnh báo (warning — mức cao)", jlptLevel: "N3", example: "大雨警報が出ているので、外出は控えてください。", exampleReading: "おおあめけいほうがでているので、がいしゅつはひかえてください。", exampleMeaning: "Có cảnh báo mưa lớn, hạn chế ra ngoài.", usageNote: "注意報 (advisory) < 警報 (warning) < 特別警報 (emergency warning — max). 特別警報 = LẬP TỨC hành động." },
        { word: "緊急地震速報", reading: "きんきゅうじしんそくほう", meaning: "Cảnh báo động đất khẩn (earthquake early warning)", jlptLevel: "N2", example: "緊急地震速報が鳴ったら、すぐにテーブルの下に隠れてください。", exampleReading: "きんきゅうじしんそくほうがなったら、すぐにテーブルのしたにかくれてください。", exampleMeaning: "Cảnh báo động đất kêu thì chui xuống bàn ngay.", usageNote: "ĐT kêu to + rung (toàn quốc). Vài giây trước khi rung. Hành động: DROP-COVER-HOLD ON." }
      ]
    }
  },
  {
    slug: "ambulance-hospital-emergency",
    moduleConfigId: M_SAFE,
    titleVi: "救急車 — Gọi cấp cứu",
    titleJa: "救急車の呼び方",
    descriptionVi: "Khi nào gọi 119, nói gì, bệnh viện cấp cứu hoạt động thế nào.",
    recommendationReasonVi: "Cấp cứu = phải nhanh + chính xác. Biết cách gọi 119 BẰNG TIẾNG NHẬT.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 195,
    metadata: {
      seed: true,
      skills: ["emergency_call", "ambulance", "hospital"],
      contentGoal: "Biết cách gọi 119 + nói gì với dispatcher.",
      usageNote: "119 → 「火事ですか？救急ですか？」→ 「救急です」→ 住所 → 症状 → 名前・電話番号. FREE. Đến: 8-10分 trung bình. Lưu ý: nhẹ (cảm, đau bụng nhẹ) → ĐỪNG gọi 119, gọi #7119 (tư vấn y tế). Nặng (ý thức mất, chảy máu nhiều, ngực đau) → 119 NGAY.",
      japaneseExpressions: [
        { word: "救急車", reading: "きゅうきゅうしゃ", meaning: "Xe cấp cứu (ambulance)", jlptLevel: "N4", example: "意識がない場合はすぐに救急車を呼んでください。", exampleReading: "いしきがないばあいはすぐにきゅうきゅうしゃをよんでください。", exampleMeaning: "Mất ý thức thì gọi cấp cứu ngay.", usageNote: "119 → miễn phí. Nói: 「救急です。場所は〇〇です。XXXの症状です。」Đợi cùng bệnh nhân." },
        { word: "症状", reading: "しょうじょう", meaning: "Triệu chứng (symptoms)", jlptLevel: "N3", example: "電話で症状を詳しく伝えてください。", exampleReading: "でんわでしょうじょうをくわしくつたえてください。", exampleMeaning: "Nói chi tiết triệu chứng qua điện thoại.", usageNote: "Quan trọng nói: いつから (từ khi nào), どこが (chỗ nào), どのように (thế nào). Đơn giản OK." },
        { word: "応急処置", reading: "おうきゅうしょち", meaning: "Sơ cứu (first aid)", jlptLevel: "N3", example: "救急車が来るまで応急処置をしてください。", exampleReading: "きゅうきゅうしゃがくるまでおうきゅうしょちをしてください。", exampleMeaning: "Sơ cứu trong khi đợi cấp cứu.", usageNote: "AED: 駅, コンビニ, 公共施設 に設置. 心臓マッサージ (CPR): 1分100-120回 ấn ngực." }
      ]
    }
  },
  {
    slug: "stress-mental-health-support",
    moduleConfigId: M_HEALTH,
    titleVi: "ストレス — Quản lý stress ở Nhật",
    titleJa: "ストレス管理と相談窓口",
    descriptionVi: "Stress từ công việc/cuộc sống — dấu hiệu, nơi tư vấn, cách cope.",
    recommendationReasonVi: "Người nước ngoài ở Nhật = stress cao (ngôn ngữ + văn hóa). Biết kênh hỗ trợ.",
    category: "safety",
    visualTheme: "teal_health",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 178,
    metadata: {
      seed: true,
      skills: ["mental_health", "stress_management", "counseling"],
      contentGoal: "Biết dấu hiệu stress + kênh tư vấn cho người nước ngoài.",
      usageNote: "Kênh: よりそいホットライン (0120-279-338, đa ngôn ngữ 24h), TELL (03-5774-0992, tiếng Anh), 産業医 (bác sĩ công ty — miễn phí), 精神科/心療内科 (bảo hiểm cover). Dấu hiệu: 眠れない, 食欲ない, イライラ, 集中できない.",
      japaneseExpressions: [
        { word: "心療内科", reading: "しんりょうないか", meaning: "Khoa tâm thể (psychosomatic medicine — stress/anxiety/depression)", jlptLevel: "N2", example: "ストレスがひどい時は心療内科を受診しましょう。", exampleReading: "ストレスがひどいときはしんりょうないかをじゅしんしましょう。", exampleMeaning: "Stress nặng thì đi khám tâm thể.", usageNote: "≠ 精神科 (tâm thần nặng). 心療内科: stress, mất ngủ, lo âu nhẹ. Bảo hiểm 3割負担. Đặt hẹn: 2-4週間 chờ." },
        { word: "産業医", reading: "さんぎょうい", meaning: "Bác sĩ lao động (company doctor — miễn phí)", jlptLevel: "N2", example: "残業が多くて辛い時は、産業医に相談できます。", exampleReading: "ざんぎょうがおおくてつらいときは、さんぎょういにそうだんできます。", exampleMeaning: "OT nhiều mệt thì tư vấn bác sĩ công ty được.", usageNote: "Công ty 50人+ bắt buộc có. Bảo mật (không báo sếp). Recommend: 休職 (nghỉ bệnh) nếu cần." },
        { word: "休職", reading: "きゅうしょく", meaning: "Nghỉ bệnh dài hạn (medical leave from work)", jlptLevel: "N2", example: "うつ病で3か月間休職しました。", exampleReading: "うつびょうでさんかげつかんきゅうしょくしました。", exampleMeaning: "Nghỉ bệnh 3 tháng vì trầm cảm.", usageNote: "Quyền. 診断書 (giấy bác sĩ) → HR. 傷病手当金: 67% lương từ 健保. Max 1.5年. Đừng ngại dùng." }
      ]
    }
  },
  {
    slug: "bicycle-safety-rules",
    moduleConfigId: M_SAFE,
    titleVi: "自転車ルール — Luật xe đạp",
    titleJa: "自転車の交通ルール",
    descriptionVi: "Luật đạp xe ở Nhật — 2024 mới siết, phạt nặng, bảo hiểm BẮT BUỘC.",
    recommendationReasonVi: "2024: luật xe đạp siết mạnh. Phạt 50万円+懲役. PHẢI biết.",
    category: "safety",
    visualTheme: "red_emergency",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["bicycle", "traffic_rules", "insurance"],
      contentGoal: "Biết luật xe đạp mới + bảo hiểm bắt buộc.",
      usageNote: "2024 mới: ながらスマホ (vừa lái vừa xem ĐT) = 罰金 + 懲役. 酒気帯び (uống rượu) = 50万以下/3年以下. Bảo hiểm: 多くの自治体で義務化. Đi phải: 車道左側 (bên trái đường xe). Đèn đêm BẮT BUỘC.",
      japaneseExpressions: [
        { word: "自転車保険", reading: "じてんしゃほけん", meaning: "Bảo hiểm xe đạp (BẮT BUỘC ở nhiều tỉnh)", jlptLevel: "N3", example: "自転車保険への加入が義務化されました。", exampleReading: "じてんしゃほけんへのかにゅうがぎむかされました。", exampleMeaning: "Bảo hiểm xe đạp đã bắt buộc.", usageNote: "Đụng người = bồi thường 9000万円+ (判例あり!). Phí: 150-300¥/月. 火災保険の個人賠償 で cover OK." },
        { word: "ながら運転", reading: "ながらうんてん", meaning: "Vừa lái vừa làm việc khác (distracted riding)", jlptLevel: "N3", example: "スマホのながら運転は罰金の対象です。", exampleReading: "スマホのながらうんてんはばっきんのたいしょうです。", exampleMeaning: "Vừa đạp xe vừa xem ĐT bị phạt.", usageNote: "2024/11~: 罰則強化. イヤホン cũng NG (nghe nhạc). 片手運転 (một tay: cầm ô) = NG." },
        { word: "防犯登録", reading: "ぼうはんとうろく", meaning: "Đăng ký chống trộm (bicycle registration)", jlptLevel: "N3", example: "自転車を買ったら防犯登録をしてください。", exampleReading: "じてんしゃをかったらぼうはんとうろくをしてください。", exampleMeaning: "Mua xe đạp xong đăng ký chống trộm.", usageNote: "BẮT BUỘC (義務). 500-600¥ (1回). Cửa hàng làm lúc mua. Trung cổ: tự ra 交番 đăng ký lại. Không có = cảnh sát nghi trộm." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🛡️ Safety/Health batch 4...");
  await runBatch(client, cards, "Safety-Health-4");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
