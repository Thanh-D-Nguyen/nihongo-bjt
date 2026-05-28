/**
 * Enrich shallow radar cards — Part 3: Finance, News, Weather & Seasonal
 * Cards: news reading, finance, lottery, weather, seasonal events
 * ~17 cards enriched with full japaneseExpressions objects
 */
import { createClient, upsertRadarCard, MODULES } from "./radar-seed-helpers.mjs";

const CARDS = [
  {
    slug: "business-news-vocab",
    moduleConfigId: MODULES.news_bjt,
    titleVi: "Từ vựng tin kinh tế cơ bản",
    titleJa: "ビジネスニュースの基本語彙",
    descriptionVi: "Đọc hiểu tiêu đề tin kinh tế Nhật.",
    category: "news",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "news",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["reading_news", "business_vocab"],
      japaneseExpressions: [
        { word: "発表", reading: "はっぴょう", meaning: "Công bố, phát biểu", example: "政府が新しい経済政策を発表しました。", jlptLevel: "N3", usageNote: "Xuất hiện trong hầu hết tiêu đề tin tức." },
        { word: "増加", reading: "ぞうか", meaning: "Tăng lên", example: "外国人観光客が増加しています。", jlptLevel: "N3", usageNote: "Đối: 減少(giảm). Formal hơn 増える." },
        { word: "影響", reading: "えいきょう", meaning: "Ảnh hưởng", example: "円安が企業に大きな影響を与えています。", jlptLevel: "N3", usageNote: "影響を与える/受ける = gây ra/chịu ảnh hưởng." },
        { word: "対策", reading: "たいさく", meaning: "Biện pháp đối phó", example: "政府は物価高騰への対策を検討しています。", jlptLevel: "N2", usageNote: "Luôn đi với vấn đề: 〇〇対策 = biện pháp cho XX." },
        { word: "見通し", reading: "みとおし", meaning: "Triển vọng, dự báo", example: "来年度の経済見通しは慎重なものとなっています。", jlptLevel: "N2", usageNote: "= forecast/outlook — hay xuất hiện cuối bài tin." }
      ],
      contentGoal: "Đọc được tiêu đề và đoạn mở đầu tin kinh tế."
    },
  },
  {
    slug: "chart-news-reading",
    moduleConfigId: MODULES.news_bjt,
    titleVi: "Đọc biểu đồ trong tin tức",
    titleJa: "ニュースのグラフを読む",
    descriptionVi: "Từ vựng mô tả xu hướng tăng/giảm trong biểu đồ.",
    category: "news",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "chart",
    priority: 75,
    metadata: {
      seed: true,
      skills: ["reading_news", "data_literacy"],
      japaneseExpressions: [
        { word: "増加", reading: "ぞうか", meaning: "Tăng", example: "先月比10%の増加となりました。", jlptLevel: "N3", usageNote: "Dùng cho số liệu — formal hơn 増えた." },
        { word: "減少", reading: "げんしょう", meaning: "Giảm", example: "人口は年々減少しています。", jlptLevel: "N3", usageNote: "Đối nghĩa 増加. 年々 = năm này qua năm khác." },
        { word: "前年比", reading: "ぜんねんひ", meaning: "So với năm trước", example: "前年比15%増の売上高でした。", jlptLevel: "N2", usageNote: "YoY (year-over-year). Cũng có 前月比, 前期比." },
        { word: "横ばい", reading: "よこばい", meaning: "Đi ngang, không thay đổi", example: "ここ3ヶ月は横ばいの状態です。", jlptLevel: "N2", usageNote: "Biểu đồ phẳng = 横ばい. Hay xuất hiện trong báo cáo." },
        { word: "回復", reading: "かいふく", meaning: "Phục hồi", example: "景気は緩やかに回復しています。", jlptLevel: "N3", usageNote: "Sau giai đoạn giảm → tăng lại = 回復." }
      ],
      contentGoal: "Mô tả xu hướng biểu đồ bằng tiếng Nhật business."
    },
  },
  {
    slug: "headline-grammar",
    moduleConfigId: MODULES.news_bjt,
    titleVi: "Ngữ pháp tiêu đề báo",
    titleJa: "ニュース見出しの文法",
    descriptionVi: "Tại sao tiêu đề tin cắt ngắn và cách đọc.",
    category: "news",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "news",
    priority: 75,
    metadata: {
      seed: true,
      skills: ["reading_news", "grammar"],
      japaneseExpressions: [
        { word: "見出し", reading: "みだし", meaning: "Tiêu đề, headline", example: "見出しだけで内容を把握できるようになりましょう。", jlptLevel: "N2", usageNote: "Tiêu đề Nhật cắt trợ từ, dùng thể từ điển." },
        { word: "速報", reading: "そくほう", meaning: "Tin nóng, breaking news", example: "【速報】大阪で震度5弱の地震。", jlptLevel: "N2", usageNote: "Luôn có 【】 hoặc đỏ — tin quan trọng nhất." },
        { word: "判明", reading: "はんめい", meaning: "Được xác nhận, sáng tỏ", example: "原因が判明しました。", jlptLevel: "N2", usageNote: "Headline hay dùng: 〇〇判明 = 'XX revealed'." },
        { word: "〜へ", reading: "〜へ", meaning: "Hướng tới (headline style)", example: "消費税引き上げへ。", jlptLevel: "N4", usageNote: "Headline用: 名詞+へ = 'sắp xảy ra/hướng tới'. Không cần động từ." },
        { word: "〜か", reading: "〜か", meaning: "...chăng? (headline question)", example: "総理辞任か。", jlptLevel: "N4", usageNote: "Headline kết bằng か = chưa xác nhận, đang đồn." }
      ],
      contentGoal: "Đọc nhanh tiêu đề tin Nhật dù cắt ngắn."
    },
  },
  {
    slug: "nhk-easy-reading-one-question",
    moduleConfigId: MODULES.news_bjt,
    titleVi: "Đọc 1 bài NHK Easy + câu hỏi",
    titleJa: "NHKやさしいニュースを読む",
    descriptionVi: "Luyện đọc hiểu tin đơn giản với 1 câu hỏi kiểm tra.",
    category: "news",
    estimatedMinutes: 5,
    levelLabel: "N4",
    visualTheme: "news",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["reading_news", "comprehension"],
      japaneseExpressions: [
        { word: "発表", reading: "はっぴょう", meaning: "Công bố", example: "厚生労働省が新しいデータを発表しました。", jlptLevel: "N3", usageNote: "Chủ ngữ thường là cơ quan chính phủ." },
        { word: "影響", reading: "えいきょう", meaning: "Ảnh hưởng", example: "台風の影響で電車が止まりました。", jlptLevel: "N3", usageNote: "〜の影響で = do ảnh hưởng của ~." },
        { word: "対策", reading: "たいさく", meaning: "Biện pháp", example: "熱中症対策として水分補給が大切です。", jlptLevel: "N2", usageNote: "NHK Easy hay kết bài bằng khuyến nghị 対策." },
        { word: "について", reading: "について", meaning: "Về, liên quan đến", example: "新しい法律について説明します。", jlptLevel: "N4", usageNote: "Grammar point cực phổ biến trong tin tức." },
        { word: "ということです", reading: "ということです", meaning: "Được cho biết là...", example: "来月から値上げするということです。", jlptLevel: "N3", usageNote: "= hearsay/report — tin tức luôn dùng khi dẫn nguồn." }
      ],
      contentGoal: "Đọc hiểu NHK Easy News và trả lời được câu hỏi."
    },
  },
  {
    slug: "earnings-report-vocab",
    moduleConfigId: MODULES.market_watch,
    titleVi: "Từ vựng báo cáo tài chính",
    titleJa: "決算報告の語彙",
    descriptionVi: "Đọc hiểu thông cáo kết quả kinh doanh.",
    category: "finance",
    estimatedMinutes: 5,
    levelLabel: "N2",
    visualTheme: "chart",
    priority: 75,
    metadata: {
      seed: true,
      skills: ["reading_business", "finance"],
      japaneseExpressions: [
        { word: "売上高", reading: "うりあげだか", meaning: "Doanh thu", example: "売上高は前年比12%増加しました。", jlptLevel: "N2", usageNote: "= revenue/sales. Con số đầu tiên trong mọi 決算." },
        { word: "営業利益", reading: "えいぎょうりえき", meaning: "Lợi nhuận kinh doanh", example: "営業利益率は8.5%に改善しました。", jlptLevel: "N2", usageNote: "= operating profit. Khác 純利益(net profit)." },
        { word: "前年比", reading: "ぜんねんひ", meaning: "So với năm trước (YoY)", example: "前年比で15%の増収となりました。", jlptLevel: "N2", usageNote: "前年比+数字+増/減 = pattern chuẩn." },
        { word: "増収増益", reading: "ぞうしゅうぞうえき", meaning: "Tăng doanh thu & tăng lợi nhuận", example: "3期連続の増収増益を達成しました。", jlptLevel: "N1", usageNote: "4 combo: 増収増益/増収減益/減収増益/減収減益." },
        { word: "業績見通し", reading: "ぎょうせきみとおし", meaning: "Triển vọng kinh doanh", example: "通期の業績見通しを上方修正しました。", jlptLevel: "N1", usageNote: "上方修正(nâng dự báo) / 下方修正(hạ dự báo)." }
      ],
      contentGoal: "Đọc được báo cáo tài chính cơ bản của công ty Nhật."
    },
  },
  {
    slug: "nikkei-basic",
    moduleConfigId: MODULES.market_watch,
    titleVi: "Hiểu chỉ số Nikkei cơ bản",
    titleJa: "日経平均を理解する",
    descriptionVi: "Nikkei 225 là gì, tại sao quan trọng.",
    category: "finance",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "chart",
    priority: 70,
    metadata: {
      seed: true,
      skills: ["reading_news", "finance"],
      japaneseExpressions: [
        { word: "日経平均", reading: "にっけいへいきん", meaning: "Chỉ số Nikkei 225", example: "日経平均が4万円を超えました。", jlptLevel: "N2", usageNote: "Chỉ số chứng khoán chính của Nhật — 225 công ty lớn nhất." },
        { word: "株価指数", reading: "かぶかしすう", meaning: "Chỉ số giá cổ phiếu", example: "主要な株価指数はすべて上昇しました。", jlptLevel: "N2", usageNote: "General term cho Nikkei, TOPIX, S&P 500..." },
        { word: "上昇", reading: "じょうしょう", meaning: "Tăng, đi lên", example: "株価が大幅に上昇しています。", jlptLevel: "N2", usageNote: "Formal hơn 上がる. Đối: 下落(downfall)." },
        { word: "下落", reading: "げらく", meaning: "Rớt, sụt giảm", example: "一時500円以上の下落となりました。", jlptLevel: "N2", usageNote: "Mạnh hơn 下がる — dùng cho stock crash." },
        { word: "取引", reading: "とりひき", meaning: "Giao dịch", example: "午前の取引で日経平均は反発しました。", jlptLevel: "N2", usageNote: "午前の取引/午後の取引 = phiên sáng/chiều." }
      ],
      contentGoal: "Hiểu tin Nikkei cơ bản trên NHK/Nikkei."
    },
  },
  {
    slug: "usd-jpy-vocab",
    moduleConfigId: MODULES.market_watch,
    titleVi: "Tỷ giá USD/JPY — từ vựng",
    titleJa: "ドル円の為替ニュース語彙",
    descriptionVi: "Hiểu tin tỷ giá — quan trọng cho người sống ở Nhật.",
    category: "finance",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "chart",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["reading_news", "finance"],
      japaneseExpressions: [
        { word: "円安", reading: "えんやす", meaning: "Yên yếu (1USD = nhiều Yên hơn)", example: "円安が進んで輸出企業に有利です。", jlptLevel: "N3", usageNote: "Ví dụ: 1$=110¥→150¥ = 円安. Gửi tiền về VN = lỗ." },
        { word: "円高", reading: "えんだか", meaning: "Yên mạnh (1USD = ít Yên hơn)", example: "円高で海外旅行が安くなります。", jlptLevel: "N3", usageNote: "Ví dụ: 1$=150¥→110¥ = 円高. Gửi tiền về = lời." },
        { word: "為替", reading: "かわせ", meaning: "Tỷ giá, ngoại hối", example: "為替市場でドルが買われています。", jlptLevel: "N2", usageNote: "為替レート = exchange rate." },
        { word: "変動", reading: "へんどう", meaning: "Biến động", example: "為替の大きな変動に注意してください。", jlptLevel: "N2", usageNote: "= fluctuation. 価格変動 = biến động giá." },
        { word: "送金", reading: "そうきん", meaning: "Chuyển tiền", example: "海外送金の手数料が高いです。", jlptLevel: "N2", usageNote: "Người nước ngoài ở Nhật hay 送金 về quê." }
      ],
      contentGoal: "Hiểu tin tỷ giá và ảnh hưởng đến đời sống."
    },
  },
  {
    slug: "nisa-ideco-words",
    moduleConfigId: MODULES.market_watch,
    titleVi: "NISA / iDeCo — từ vựng đầu tư",
    titleJa: "NISA・iDeCoの基本用語",
    descriptionVi: "Hiểu chương trình đầu tư miễn thuế của Nhật.",
    category: "finance",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "chart",
    priority: 70,
    metadata: {
      seed: true,
      skills: ["reading_news", "finance"],
      japaneseExpressions: [
        { word: "NISA", reading: "にーさ", meaning: "Tài khoản đầu tư miễn thuế", example: "新NISAの年間投資枠は360万円です。", jlptLevel: "N2", usageNote: "Nippon Individual Savings Account — lợi nhuận không bị thuế." },
        { word: "iDeCo", reading: "いでこ", meaning: "Quỹ hưu trí cá nhân (miễn thuế)", example: "iDeCoは節税効果が大きいです。", jlptLevel: "N2", usageNote: "Individual Defined Contribution — tiết kiệm hưu trí." },
        { word: "積立", reading: "つみたて", meaning: "Tích lũy định kỳ", example: "毎月3万円の積立投資をしています。", jlptLevel: "N2", usageNote: "積立NISA = đầu tư hàng tháng vào NISA." },
        { word: "非課税", reading: "ひかぜい", meaning: "Miễn thuế", example: "NISA口座は非課税で運用できます。", jlptLevel: "N2", usageNote: "Lợi điểm chính của NISA/iDeCo — lãi không bị thuế." },
        { word: "投資信託", reading: "とうししんたく", meaning: "Quỹ đầu tư (mutual fund)", example: "初心者には投資信託がおすすめです。", jlptLevel: "N2", usageNote: "Loại phổ biến nhất trong NISA — diversified fund." }
      ],
      contentGoal: "Hiểu NISA/iDeCo để cân nhắc tài chính cá nhân."
    },
  },
  {
    slug: "loto6-hot-cold",
    moduleConfigId: MODULES.loto_ai_lab,
    titleVi: "Loto 6 — thống kê nóng/lạnh",
    titleJa: "ロト6 統計分析の用語",
    descriptionVi: "Từ vựng thống kê và xổ số Nhật.",
    category: "entertainment",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "fun",
    priority: 60,
    metadata: {
      seed: true,
      skills: ["reading_daily", "entertainment"],
      japaneseExpressions: [
        { word: "統計", reading: "とうけい", meaning: "Thống kê", example: "過去の統計データを分析しました。", jlptLevel: "N2", usageNote: "Dùng cả trong tin tức và business." },
        { word: "抽選", reading: "ちゅうせん", meaning: "Bốc thăm, quay số", example: "毎週木曜日に抽選が行われます。", jlptLevel: "N2", usageNote: "Loto 6 抽選日 = thứ 5." },
        { word: "当選", reading: "とうせん", meaning: "Trúng (thưởng/cử)", example: "1等当選金額は約2億円です。", jlptLevel: "N2", usageNote: "当選番号 = số trúng. Cũng dùng cho bầu cử." },
        { word: "出現回数", reading: "しゅつげんかいすう", meaning: "Số lần xuất hiện", example: "この番号の出現回数は平均より多いです。", jlptLevel: "N2", usageNote: "Hot number = 出現回数 nhiều. Cold = ít." },
        { word: "確率", reading: "かくりつ", meaning: "Xác suất", example: "1等の当選確率は約610万分の1です。", jlptLevel: "N2", usageNote: "〇〇分の1 = 1 phần XX (cách đọc phân số)." }
      ],
      contentGoal: "Đọc hiểu bảng thống kê Loto bằng tiếng Nhật."
    },
  },
  {
    slug: "loto7-patterns",
    moduleConfigId: MODULES.loto_ai_lab,
    titleVi: "Loto 7 — xu hướng & mẫu",
    titleJa: "ロト7 パターン分析",
    descriptionVi: "Từ vựng phân tích pattern trong Loto 7.",
    category: "entertainment",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "fun",
    priority: 55,
    metadata: {
      seed: true,
      skills: ["reading_daily", "entertainment"],
      japaneseExpressions: [
        { word: "組み合わせ", reading: "くみあわせ", meaning: "Tổ hợp", example: "全部で約1029万通りの組み合わせがあります。", jlptLevel: "N2", usageNote: "Combination — math term cũng dùng đời thường." },
        { word: "傾向", reading: "けいこう", meaning: "Xu hướng", example: "最近の傾向として偶数が多く出ています。", jlptLevel: "N2", usageNote: "= trend. Dùng trong business, tin tức, thống kê." },
        { word: "連続数字", reading: "れんぞくすうじ", meaning: "Số liên tiếp", example: "連続数字が2組含まれるパターンが多いです。", jlptLevel: "N2", usageNote: "Ví dụ: 12-13, 25-26 = 連続数字." },
        { word: "奇数・偶数", reading: "きすう・ぐうすう", meaning: "Số lẻ / Số chẵn", example: "奇数と偶数のバランスを見ましょう。", jlptLevel: "N3", usageNote: "Math vocab cơ bản — hay gặp trong thống kê." },
        { word: "過去データ", reading: "かこでーた", meaning: "Dữ liệu quá khứ", example: "過去データから当選パターンを分析します。", jlptLevel: "N3", usageNote: "Phân tích 過去データ — dù xác suất mỗi lần = independent." }
      ],
      contentGoal: "Đọc bài phân tích Loto 7 bằng tiếng Nhật."
    },
  },
  {
    slug: "probability-japanese",
    moduleConfigId: MODULES.loto_ai_lab,
    titleVi: "Nói về xác suất bằng tiếng Nhật",
    titleJa: "確率を日本語で表現する",
    descriptionVi: "Từ vựng xác suất, thống kê cơ bản.",
    category: "knowledge",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "learning",
    priority: 60,
    metadata: {
      seed: true,
      skills: ["reading_daily", "math_vocab"],
      japaneseExpressions: [
        { word: "確率", reading: "かくりつ", meaning: "Xác suất", example: "雨が降る確率は60%です。", jlptLevel: "N2", usageNote: "Dùng rất rộng: thời tiết, bảo hiểm, thống kê..." },
        { word: "統計", reading: "とうけい", meaning: "Thống kê", example: "統計によると、日本人の平均寿命は84歳です。", jlptLevel: "N2", usageNote: "統計によると = 'theo thống kê' — cách dẫn dữ liệu." },
        { word: "抽選", reading: "ちゅうせん", meaning: "Rút thăm, bốc ngẫu nhiên", example: "応募者多数の場合は抽選となります。", jlptLevel: "N2", usageNote: "Ngoài xổ số, còn dùng cho vé concert, apartment lottery." },
        { word: "当選", reading: "とうせん", meaning: "Trúng", example: "キャンペーンに当選しました！", jlptLevel: "N2", usageNote: "当選おめでとう！= Chúc mừng trúng!" },
        { word: "平均", reading: "へいきん", meaning: "Trung bình", example: "今月の平均気温は25度でした。", jlptLevel: "N3", usageNote: "平均〇〇 = XX trung bình. Rất hay dùng." }
      ],
      contentGoal: "Nói và đọc về xác suất/thống kê bằng tiếng Nhật."
    },
  },
  {
    slug: "rainy-season-words",
    moduleConfigId: MODULES.weather_japanese,
    titleVi: "Từ vựng mùa mưa (梅雨)",
    titleJa: "梅雨の日本語",
    descriptionVi: "Mùa mưa Nhật và cách nói chuyện về thời tiết ẩm.",
    category: "seasonal",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "rain",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["seasonal_vocab", "small_talk"],
      japaneseExpressions: [
        { word: "梅雨", reading: "つゆ", meaning: "Mùa mưa (tháng 6-7)", example: "今年の梅雨入りは6月10日頃の見込みです。", jlptLevel: "N3", usageNote: "梅雨入り(vào mùa mưa) / 梅雨明け(hết mùa mưa)." },
        { word: "湿気", reading: "しっけ", meaning: "Độ ẩm", example: "湿気がすごくて髪がまとまりません。", jlptLevel: "N3", usageNote: "Nhật rất ẩm vào 梅雨 — topic small talk phổ biến." },
        { word: "蒸し暑い", reading: "むしあつい", meaning: "Nóng oi bức", example: "梅雨時は蒸し暑い日が続きます。", jlptLevel: "N3", usageNote: "Khác 暑い(nóng) — 蒸し暑い = humid + hot." },
        { word: "梅雨入り", reading: "つゆいり", meaning: "Bắt đầu mùa mưa (chính thức)", example: "関東地方が梅雨入りしました。", jlptLevel: "N2", usageNote: "Khí tượng Nhật tuyên bố chính thức — tin tức lớn." },
        { word: "除湿", reading: "じょしつ", meaning: "Hút ẩm", example: "除湿機をつけないとカビが生えます。", jlptLevel: "N2", usageNote: "除湿機(máy hút ẩm) — cần thiết ở Nhật mùa mưa." },
        { word: "カビ", reading: "かび", meaning: "Nấm mốc", example: "梅雨時はカビに注意してください。", jlptLevel: "N3", usageNote: "Kẻ thù số 1 của mùa mưa — đồ ăn, quần áo, tường." }
      ],
      contentGoal: "Small talk về mùa mưa và đối phó thực tế."
    },
  },
  {
    slug: "heatstroke-warning-phrase",
    moduleConfigId: MODULES.weather_japanese,
    titleVi: "Cảnh báo say nắng",
    titleJa: "熱中症警告フレーズ",
    descriptionVi: "Nhận biết cảnh báo say nắng và cách phòng ngừa.",
    category: "seasonal",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "sun",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["listening_daily", "health"],
      japaneseExpressions: [
        { word: "熱中症", reading: "ねっちゅうしょう", meaning: "Say nắng, sốc nhiệt", example: "熱中症で毎年多くの人が救急搬送されます。", jlptLevel: "N3", usageNote: "Tháng 7-8 tin tức nói hàng ngày." },
        { word: "水分補給", reading: "すいぶんほきゅう", meaning: "Bổ sung nước", example: "こまめに水分補給をしてください。", jlptLevel: "N3", usageNote: "こまめに = thường xuyên, ít một. Pattern chuẩn." },
        { word: "日陰", reading: "ひかげ", meaning: "Bóng râm", example: "できるだけ日陰を歩きましょう。", jlptLevel: "N3", usageNote: "Đối: 日向(ひなた) = chỗ nắng." },
        { word: "猛暑日", reading: "もうしょび", meaning: "Ngày nóng cực (≥35°C)", example: "明日は猛暑日になる見込みです。", jlptLevel: "N2", usageNote: "真夏日(≥30°) < 猛暑日(≥35°) < 酷暑日(≥40°)." },
        { word: "エアコン", reading: "えあこん", meaning: "Máy lạnh", example: "我慢せずにエアコンを使いましょう。", jlptLevel: "N4", usageNote: "Người già Nhật hay nhịn bật → nguy hiểm." }
      ],
      contentGoal: "Nhận biết và phòng ngừa say nắng ở Nhật."
    },
  },
  {
    slug: "disaster-prevention-day",
    moduleConfigId: MODULES.safety_emergency,
    titleVi: "Ngày phòng chống thiên tai (9/1)",
    titleJa: "防災の日に覚える言葉",
    descriptionVi: "Từ vựng quan trọng cho phòng chống thiên tai.",
    category: "seasonal",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "alert",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["reading_daily", "emergency"],
      japaneseExpressions: [
        { word: "避難所", reading: "ひなんじょ", meaning: "Nơi sơ tán", example: "最寄りの避難所を確認してください。", jlptLevel: "N3", usageNote: "Mỗi khu vực có 避難所 riêng — check trước." },
        { word: "防災", reading: "ぼうさい", meaning: "Phòng chống thiên tai", example: "9月1日は防災の日です。", jlptLevel: "N3", usageNote: "防災グッズ(đồ phòng tai nạn), 防災訓練(diễn tập)." },
        { word: "非常持ち出し袋", reading: "ひじょうもちだしぶくろ", meaning: "Túi đồ khẩn cấp", example: "非常持ち出し袋を玄関に置いておきましょう。", jlptLevel: "N2", usageNote: "Nước, đèn pin, thuốc, áo mưa, radio — chuẩn bị sẵn." },
        { word: "避難経路", reading: "ひなんけいろ", meaning: "Đường sơ tán", example: "避難経路を家族で確認しましょう。", jlptLevel: "N2", usageNote: "Tòa nhà, trường học đều có bảng 避難経路." },
        { word: "安否確認", reading: "あんぴかくにん", meaning: "Xác nhận an toàn", example: "災害時は171番で安否確認ができます。", jlptLevel: "N2", usageNote: "171 = 災害用伝言ダイヤル. Nhớ số này!" }
      ],
      contentGoal: "Chuẩn bị phòng chống thiên tai bằng tiếng Nhật."
    },
  },
  {
    slug: "rain-umbrella-phrase",
    moduleConfigId: MODULES.weather_japanese,
    titleVi: "Nói về mưa và ô dù",
    titleJa: "雨と傘のフレーズ",
    descriptionVi: "Câu thường ngày về thời tiết mưa.",
    category: "seasonal",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "rain",
    priority: 75,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "weather"],
      japaneseExpressions: [
        { word: "今日は雨が降りそうです", reading: "きょうはあめがふりそうです", meaning: "Hôm nay có vẻ sẽ mưa", example: "雲が多いから、今日は雨が降りそうですね。", jlptLevel: "N4", usageNote: "〜そう = trông có vẻ ~. Dự đoán từ quan sát." },
        { word: "午後から雨が降るらしいです", reading: "ごごからあめがふるらしいです", meaning: "Nghe nói chiều sẽ mưa", example: "天気予報によると、午後から雨が降るらしいです。", jlptLevel: "N4", usageNote: "〜らしい = nghe nói/apparently. Dẫn nguồn khác." },
        { word: "傘を持っていったほうがいい", reading: "かさをもっていったほうがいい", meaning: "Nên mang ô đi", example: "午後雨だから、傘を持っていったほうがいいよ。", jlptLevel: "N4", usageNote: "〜ほうがいい = nên ~. Lời khuyên tự nhiên." },
        { word: "土砂降り", reading: "どしゃぶり", meaning: "Mưa xối xả", example: "急に土砂降りになって、びしょ濡れです。", jlptLevel: "N2", usageNote: "Mưa cực to — びしょ濡れ = ướt sũng." },
        { word: "折りたたみ傘", reading: "おりたたみがさ", meaning: "Ô gấp", example: "折りたたみ傘をバッグに入れておくと安心です。", jlptLevel: "N3", usageNote: "Lifehack Nhật: luôn có 折りたたみ傘 trong túi." }
      ],
      contentGoal: "Nói tự nhiên về mưa, gợi ý mang ô."
    },
  },
  {
    slug: "train-delay-weather",
    moduleConfigId: MODULES.transport_commute,
    titleVi: "Tàu trễ vì thời tiết xấu",
    titleJa: "天候による電車の遅延",
    descriptionVi: "Hiểu thông báo delay do mưa/bão/tuyết.",
    category: "transport",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "transport",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["listening_daily", "transport"],
      japaneseExpressions: [
        { word: "大雨で電車が遅れています", reading: "おおあめででんしゃがおくれています", meaning: "Tàu bị trễ vì mưa lớn", example: "大雨の影響で電車が遅れています。", jlptLevel: "N4", usageNote: "Pattern: 〇〇の影響で〜が遅れています." },
        { word: "運転見合わせ", reading: "うんてんみあわせ", meaning: "Tạm ngừng chạy tàu", example: "安全確認のため、運転を見合わせています。", jlptLevel: "N2", usageNote: "Nghiêm trọng hơn 遅延 — tàu dừng hoàn toàn." },
        { word: "振替輸送", reading: "ふりかえゆそう", meaning: "Chuyển sang tuyến khác (miễn phí)", example: "振替輸送をご利用ください。", jlptLevel: "N2", usageNote: "Dùng vé tuyến bị dừng để đi free tuyến khác." },
        { word: "運行状況", reading: "うんこうじょうきょう", meaning: "Tình hình chạy tàu", example: "運行状況はアプリで確認できます。", jlptLevel: "N2", usageNote: "Check app JR, Yahoo路線 để biết real-time." },
        { word: "復旧", reading: "ふっきゅう", meaning: "Khôi phục (hoạt động)", example: "午後3時頃に復旧する見込みです。", jlptLevel: "N2", usageNote: "復旧見込み = dự kiến khôi phục — thông tin quan trọng nhất." }
      ],
      contentGoal: "Hiểu thông báo delay tàu và biết cách đối phó."
    },
  },
  {
    slug: "coupon-terms",
    moduleConfigId: MODULES.deals_points,
    titleVi: "Đọc điều kiện coupon / khuyến mãi",
    titleJa: "クーポンの利用条件を読む",
    descriptionVi: "Hiểu các điều kiện nhỏ trên coupon Nhật.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "shopping",
    priority: 70,
    metadata: {
      seed: true,
      skills: ["reading_daily", "shopping"],
      japaneseExpressions: [
        { word: "対象商品", reading: "たいしょうしょうひん", meaning: "Sản phẩm áp dụng", example: "対象商品のみご利用いただけます。", jlptLevel: "N3", usageNote: "Không phải mọi đồ đều dùng coupon được." },
        { word: "併用不可", reading: "へいようふか", meaning: "Không dùng chung được", example: "他のクーポンとの併用不可です。", jlptLevel: "N2", usageNote: "= Không stack coupon. Rất hay gặp." },
        { word: "期間限定", reading: "きかんげんてい", meaning: "Chỉ trong thời gian nhất định", example: "期間限定：6月1日〜6月30日まで。", jlptLevel: "N3", usageNote: "Cũng dùng cho menu, sản phẩm mùa." },
        { word: "税込", reading: "ぜいこみ", meaning: "Đã bao gồm thuế", example: "表示価格は税込です。", jlptLevel: "N3", usageNote: "Đối: 税抜(ぜいぬき) = chưa thuế. Check kỹ!" },
        { word: "一人一回限り", reading: "ひとりいっかいかぎり", meaning: "Mỗi người chỉ 1 lần", example: "お一人様一回限りのご利用となります。", jlptLevel: "N3", usageNote: "Giới hạn sử dụng — tránh bị từ chối ở quầy." }
      ],
      contentGoal: "Đọc điều kiện coupon tránh bị từ chối."
    },
  },
  {
    slug: "point-campaign-reading",
    moduleConfigId: MODULES.deals_points,
    titleVi: "Đọc chương trình tích điểm",
    titleJa: "ポイントキャンペーンを読む",
    descriptionVi: "Hiểu chương trình point của store/card.",
    category: "daily_life",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "shopping",
    priority: 65,
    metadata: {
      seed: true,
      skills: ["reading_daily", "shopping"],
      japaneseExpressions: [
        { word: "ポイント還元", reading: "ぽいんとかんげん", meaning: "Hoàn điểm", example: "最大10%ポイント還元キャンペーン中です。", jlptLevel: "N2", usageNote: "Cashback dưới dạng point — rất phổ biến ở Nhật." },
        { word: "対象店舗", reading: "たいしょうてんぽ", meaning: "Cửa hàng áp dụng", example: "対象店舗は公式サイトでご確認ください。", jlptLevel: "N3", usageNote: "Không phải mọi nơi đều tham gia campaign." },
        { word: "エントリー", reading: "えんとりー", meaning: "Đăng ký tham gia", example: "事前エントリーが必要です。", jlptLevel: "N3", usageNote: "Nhiều campaign phải đăng ký TRƯỚC khi mua." },
        { word: "付与", reading: "ふよ", meaning: "Cấp, trao (point)", example: "ポイントは翌月に付与されます。", jlptLevel: "N2", usageNote: "Point không vào ngay — thường 翌月(tháng sau)." },
        { word: "有効期限", reading: "ゆうこうきげん", meaning: "Hạn sử dụng", example: "ポイントの有効期限は1年間です。", jlptLevel: "N3", usageNote: "Point hết hạn = mất trắng. Check app thường xuyên." }
      ],
      contentGoal: "Tận dụng tối đa chương trình tích điểm."
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("[enrich-part3] Enriching finance/news/seasonal cards...");

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
  console.log(`[enrich-part3] Done: ${ok} enriched, ${fail} failed.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
