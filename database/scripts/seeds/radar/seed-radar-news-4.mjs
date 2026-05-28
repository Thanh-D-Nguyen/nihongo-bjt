/**
 * Radar Seed: News/Current Affairs batch 4 (10 cards)
 * Topics: environment, aging society, education reform, AI/tech, economy, politics
 * Run: node scripts/seed-radar-news-4.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_NEWS = MODULES.news_bjt;
const M_MARKET = MODULES.market_watch;
const M_JAPAN = MODULES.japan_today;

const cards = [
  {
    slug: "aging-society-shoshika",
    moduleConfigId: M_NEWS,
    titleVi: "少子高齢化 — Già hóa dân số",
    titleJa: "日本の少子高齢化問題",
    descriptionVi: "Khủng hoảng nhân khẩu học Nhật — số liệu, ảnh hưởng, chính sách.",
    recommendationReasonVi: "Topic #1 tin tức Nhật. BJT hay ra. Hiểu = đọc báo + thi được.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 195,
    metadata: {
      seed: true,
      skills: ["demographics", "social_issues", "news_comprehension"],
      contentGoal: "Hiểu vấn đề nhân khẩu + từ vựng liên quan.",
      usageNote: "Thực trạng: 出生率 1.20 (2023 — thấp kỷ lục). 65+ = 29% dân số. 人口減少: giảm 80万/年. Ảnh hưởng: 人手不足, 年金/医療 áp lực, 地方消滅 (nông thôn biến mất). Chính sách: 異次元の少子化対策, 外国人材受入 (特定技能). BJT: topic tin tức thường xuyên.",
      japaneseExpressions: [
        { word: "少子高齢化", reading: "しょうしこうれいか", meaning: "Già hóa + ít con (aging society with declining birthrate)", jlptLevel: "N2", example: "少子高齢化が日本経済に影響を与えています。", exampleReading: "しょうしこうれいかがにほんけいざいにえいきょうをあたえています。", exampleMeaning: "Già hóa ảnh hưởng kinh tế Nhật.", usageNote: "= 少子化 (ít con) + 高齢化 (già hóa). Tin tức xuất hiện HÀNG NGÀY. BJT reading/listening ra rất nhiều." },
        { word: "人手不足", reading: "ひとでぶそく", meaning: "Thiếu nhân lực (labor shortage)", jlptLevel: "N3", example: "飲食業界は深刻な人手不足に直面しています。", exampleReading: "いんしょくぎょうかいはしんこくなひとでぶそくにちょくめんしています。", exampleMeaning: "Ngành ẩm thực đối mặt thiếu người nghiêm trọng.", usageNote: "特に: 介護, 建設, 飲食, 運送. → Lý do Nhật nhận thêm 外国人労働者. Người VN = nhóm đông nhất." },
        { word: "出生率", reading: "しゅっしょうりつ", meaning: "Tỷ lệ sinh (birth rate)", jlptLevel: "N2", example: "日本の出生率は過去最低を更新しました。", exampleReading: "にほんのしゅっしょうりつはかこさいていをこうしんしました。", exampleMeaning: "Tỷ lệ sinh Nhật phá kỷ lục thấp.", usageNote: "合計特殊出生率: 1.20 (2023). Cần 2.07 để duy trì dân số. 東京: 0.99 (dưới 1!). 沖縄: cao nhất ~1.60." }
      ]
    }
  },
  {
    slug: "ai-technology-japan",
    moduleConfigId: M_NEWS,
    titleVi: "AI・テクノロジー — Công nghệ AI ở Nhật",
    titleJa: "日本のAI政策と活用",
    descriptionVi: "AI ở Nhật — chính sách, ứng dụng, ảnh hưởng việc làm.",
    recommendationReasonVi: "AI = hot topic 2024-2025. Tin tức + interview hay hỏi. Từ vựng cần.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["technology", "ai", "business_trends"],
      contentGoal: "Biết từ vựng AI/tech + trend Nhật.",
      usageNote: "Nhật: AI活用 tăng nhanh. 生成AI (generative AI): ChatGPT, Gemini. Chính phủ: AI戦略, デジタル庁. Ứng dụng: 翻訳, 自動運転, 医療診断, ロボット介護. Lo ngại: 雇用への影響 (việc làm), 著作権 (bản quyền). BJT: reading về tech policy.",
      japaneseExpressions: [
        { word: "生成AI", reading: "せいせいエーアイ", meaning: "AI tạo sinh (generative AI)", jlptLevel: "N2", example: "生成AIを業務に活用する企業が増えています。", exampleReading: "せいせいエーアイをぎょうむにかつようするきぎょうがふえています。", exampleMeaning: "Doanh nghiệp dùng AI tạo sinh cho công việc tăng.", usageNote: "2024~: buzzword #1 kinh doanh Nhật. 社内ガイドライン (quy định nội bộ) nhiều công ty ban hành." },
        { word: "自動運転", reading: "じどううんてん", meaning: "Lái xe tự động (autonomous driving)", jlptLevel: "N3", example: "2025年に一部地域で自動運転バスが実用化されます。", exampleReading: "にせんにじゅうごねんにいちぶちいきでじどううんてんバスがじつようかされます。", exampleMeaning: "2025 bus tự lái đi vào hoạt động ở một số vùng.", usageNote: "Level 4 (特定条件下): 2023 giải cấm. 地方 bus (人手不足 giải pháp). トヨタ, ホンダ, ソニー đầu tư mạnh." },
        { word: "デジタル庁", reading: "デジタルちょう", meaning: "Cơ quan Kỹ thuật số (Digital Agency)", jlptLevel: "N2", example: "デジタル庁がマイナンバーカードの普及を推進しています。", exampleReading: "デジタルちょうがマイナンバーカードのふきゅうをすいしんしています。", exampleMeaning: "Digital庁 thúc đẩy phổ cập MN card.", usageNote: "2021年 thành lập. Mục tiêu: 行政手続きオンライン化. Phụ trách: MN card, ガバメントクラウド, オープンデータ." }
      ]
    }
  },
  {
    slug: "foreign-workers-gaikokujin",
    moduleConfigId: M_NEWS,
    titleVi: "外国人労働者 — Lao động nước ngoài",
    titleJa: "外国人労働者の受入政策",
    descriptionVi: "Chính sách nhận lao động ngoại — 特定技能, 技能実習, thay đổi mới.",
    recommendationReasonVi: "= CHÍNH BẠN. Biết chính sách + từ vựng = hiểu quyền lợi.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 195,
    metadata: {
      seed: true,
      skills: ["immigration_policy", "labor", "visa_types"],
      contentGoal: "Hiểu chính sách lao động ngoại + biến đổi.",
      usageNote: "Hiện: 200万+ (2023 kỷ lục). VN = #1. Hệ thống: 技能実習 (thực tập kỹ năng: bỏ 2024 → 育成就労). 特定技能 (kỹ năng đặc định: 1号 → 2号 → 永住 path). 高度人材 (高度専門職). 2024: 育成就労制度 ra đời (thay 技能実習). Từ vựng QUAN TRỌNG cho đọc tin tức.",
      japaneseExpressions: [
        { word: "特定技能", reading: "とくていぎのう", meaning: "Kỹ năng đặc định (specified skilled worker)", jlptLevel: "N3", example: "特定技能2号になると家族を呼べます。", exampleReading: "とくていぎのうにごうになるとかぞくをよべます。", exampleMeaning: "Đạt 特定技能 2 thì gọi gia đình được.", usageNote: "1号: 5年, 14分野. 2号: 更新無制限, 家族帯同 OK → 永住 path. 2024: 2号 mở rộng 11分野 (ít người biết!). Test: 日本語 N4+ + 技能試験." },
        { word: "技能実習", reading: "ぎのうじっしゅう", meaning: "Thực tập kỹ năng (technical intern training — sắp bỏ)", jlptLevel: "N3", example: "技能実習制度は2024年に廃止が決まりました。", exampleReading: "ぎのうじっしゅうせいどはにせんにじゅうよねんにはいしがきまりました。", exampleMeaning: "Chế độ thực tập kỹ năng quyết bỏ năm 2024.", usageNote: "Bị chỉ trích: 人権問題, 失踪. 2027~: 育成就労 thay thế (転籍OK = chuyển chỗ làm được). Quá độ: vài năm song song." },
        { word: "育成就労", reading: "いくせいしゅうろう", meaning: "Đào tạo-việc làm (new system replacing 技能実習)", jlptLevel: "N2", example: "育成就労制度では転籍が認められます。", exampleReading: "いくせいしゅうろうせいどでは てんせきがみとめられます。", exampleMeaning: "Chế độ mới cho phép chuyển chỗ làm.", usageNote: "2024 luật pass, 2027~ vận hành. Khác 技能実習: 1) 転籍 OK (1年後). 2) 特定技能 へ path rõ. 3) 監理団体 → 監理支援機関 (giám sát tốt hơn)." }
      ]
    }
  },
  {
    slug: "natural-disasters-bousai",
    moduleConfigId: M_NEWS,
    titleVi: "自然災害と防災 — Thiên tai & phòng chống",
    titleJa: "日本の自然災害ニュースの読み方",
    descriptionVi: "Từ vựng tin tức thiên tai — động đất, bão, sóng thần.",
    recommendationReasonVi: "Nhật = thiên tai nhiều. Đọc tin = sống sót. BJT ra bài liên quan.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["disaster_news", "emergency_vocabulary", "news_reading"],
      contentGoal: "Đọc hiểu tin thiên tai + biết hành động.",
      usageNote: "Nhật: 地震 (annually 1000+回 cảm nhận được), 台風 (6-10月), 津波, 洪水, 土砂災害. Alert level: 警戒レベル1-5 (5 = 命を守る行動). NHK news vocab: 震度 (intensity), マグニチュード, 避難指示, 特別警報. App: Yahoo防災, NHK防災.",
      japaneseExpressions: [
        { word: "避難指示", reading: "ひなんしじ", meaning: "Chỉ thị sơ tán (evacuation order — Level 4)", jlptLevel: "N3", example: "避難指示が出たらすぐに避難してください。", exampleReading: "ひなんしじがでたらすぐにひなんしてください。", exampleMeaning: "Khi có chỉ thị sơ tán hãy tránh ngay.", usageNote: "Level 4 = 全員避難. Level 5 = 緊急安全確保 (đã muộn, cố bảo toàn mạng). 2021 改正: 避難勧告 bỏ → 避難指示 thống nhất." },
        { word: "震度", reading: "しんど", meaning: "Cường độ rung (seismic intensity — thang Nhật)", jlptLevel: "N3", example: "震度5強の地震が発生しました。", exampleReading: "しんどごきょうのじしんがはっせいしました。", exampleMeaning: "Xảy ra động đất cường độ 5+.", usageNote: "Thang Nhật: 0-7 (5弱/5強, 6弱/6強 = 10 cấp). ≠ マグニチュード (magnitude: năng lượng). 震度4+ = nguy hiểm. 震度6+ = đổ nhà." },
        { word: "特別警報", reading: "とくべつけいほう", meaning: "Cảnh báo đặc biệt (emergency warning — hiếm, cực nguy)", jlptLevel: "N3", example: "大雨の特別警報が発表されました。直ちに命を守る行動を。", exampleReading: "おおあめのとくべつけいほうがはっぴょうされました。ただちにいのちをまもるこうどうを。", exampleMeaning: "Cảnh báo mưa lớn đặc biệt. Lập tức bảo toàn tính mạng.", usageNote: "数十年に一度 (vài chục năm 1 lần). Ra = NGUY HIỂM NHẤT. 大雨, 暴風, 津波, 地震 (震度6弱+). Nghe trên TV/radio → hành động NGAY." }
      ]
    }
  },
  {
    slug: "japanese-economy-keizai",
    moduleConfigId: M_MARKET,
    titleVi: "日本経済 — Kinh tế Nhật hiện tại",
    titleJa: "日本経済の現状と課題",
    descriptionVi: "Kinh tế Nhật — lạm phát, lãi suất, yên yếu, tăng lương.",
    recommendationReasonVi: "BJT reading: kinh tế = chủ đề core. Biết trend = hiểu context.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["economy", "finance_news", "business_japanese"],
      contentGoal: "Hiểu từ vựng kinh tế + trend Nhật 2024.",
      usageNote: "2024: 円安 (1$=155¥+), 物価上昇 (inflation 3%+), 賃上げ (5%+ — 30年ぶり), 日銀 利上げ (マイナス金利 解除 2024/3). 株価: 日経平均 最高値更新 (4万超え). 課題: 実質賃金 マイナス (物価 > 給料). BJT: kinh tế article = main content.",
      japaneseExpressions: [
        { word: "円安", reading: "えんやす", meaning: "Yên yếu (weak yen — đồng yên giảm giá)", jlptLevel: "N3", example: "円安の影響で輸入品の価格が上がっています。", exampleReading: "えんやすのえいきょうでゆにゅうひんのかかくがあがっています。", exampleMeaning: "Yên yếu → giá hàng nhập tăng.", usageNote: "2024: 155-160¥/$. Tốt cho 輸出企業, 観光. Xấu cho: 輸入 (ăn, energy), 留学. 円高 = ngược lại." },
        { word: "物価上昇", reading: "ぶっかじょうしょう", meaning: "Giá cả tăng (inflation/price increase)", jlptLevel: "N3", example: "物価上昇で生活が苦しくなっています。", exampleReading: "ぶっかじょうしょうでせいかつがくるしくなっています。", exampleMeaning: "Giá tăng → đời sống khó khăn.", usageNote: "= インフレ. 2022~: thực phẩm +10-20%. 電気 +30%. 30年 deflation sau = shock. 消費者物価指数 (CPI) xem hàng tháng." },
        { word: "賃上げ", reading: "ちんあげ", meaning: "Tăng lương (wage increase)", jlptLevel: "N3", example: "今年の春闘で平均5%の賃上げが実現しました。", exampleReading: "ことしのしゅんとうでへいきんごパーセントのちんあげがじつげんしました。", exampleMeaning: "春闘 năm nay tăng lương bình quân 5%.", usageNote: "春闘 (しゅんとう): đàm phán lương xuân (2-3月). 2024: 5.28% — cao nhất 33年. Nhưng: 実質賃金 vẫn マイナス (giá tăng nhanh hơn lương)." }
      ]
    }
  },
  {
    slug: "environment-kankyou",
    moduleConfigId: M_NEWS,
    titleVi: "環境問題 — Môi trường ở Nhật",
    titleJa: "日本の環境問題と取り組み",
    descriptionVi: "Môi trường Nhật — carbon neutral, rác nhựa, năng lượng.",
    recommendationReasonVi: "環境 = topic news + BJT phổ biến. ESG = trend kinh doanh.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["environment", "sustainability", "green_business"],
      contentGoal: "Biết từ vựng môi trường + chính sách Nhật.",
      usageNote: "Nhật: 2050 カーボンニュートラル mục tiêu. Chính sách: レジ袋有料化 (2020), プラスチック削減, 再生エネルギー 推進, EV補助金. Doanh nghiệp: ESG, SDGs, サステナビリティ report bắt buộc. Vấn đề: 原発 (nuclear) restart tranh cãi, 処理水 放出.",
      japaneseExpressions: [
        { word: "カーボンニュートラル", reading: "カーボンニュートラル", meaning: "Carbon trung tính (carbon neutral)", jlptLevel: "N2", example: "日本は2050年にカーボンニュートラルを目指しています。", exampleReading: "にほんはにせんごじゅうねんにカーボンニュートラルをめざしています。", exampleMeaning: "Nhật mục tiêu carbon neutral 2050.", usageNote: "= CO2 排出 = 吸収. GX (グリーントランスフォーメーション). 企業: SBT目標, Scope 1/2/3 báo cáo." },
        { word: "再生可能エネルギー", reading: "さいせいかのうエネルギー", meaning: "Năng lượng tái tạo (renewable energy)", jlptLevel: "N2", example: "再生可能エネルギーの割合を36%に引き上げる計画です。", exampleReading: "さいせいかのうエネルギーのわりあいをさんじゅうろくパーセントにひきあげるけいかくです。", exampleMeaning: "Kế hoạch nâng năng lượng tái tạo lên 36%.", usageNote: "太陽光, 風力, 水力, 地熱, バイオマス. 2022: ~22%. Mục tiêu 2030: 36-38%. Trở ngại: 系統接続, コスト, 土地." },
        { word: "脱炭素", reading: "だつたんそ", meaning: "Thoát carbon (decarbonization)", jlptLevel: "N2", example: "脱炭素に向けた企業の取り組みが加速しています。", exampleReading: "だつたんそにむけたきぎょうのとりくみがかそくしています。", exampleMeaning: "Nỗ lực thoát carbon của doanh nghiệp đang tăng tốc.", usageNote: "= カーボンニュートラル giống. Dùng trong: 政策, 企業戦略, 投資. 脱炭素社会 (xã hội phi carbon) = vision." }
      ]
    }
  },
  {
    slug: "working-style-reform",
    moduleConfigId: M_NEWS,
    titleVi: "働き方改革 — Cải cách lao động",
    titleJa: "働き方改革の最新動向",
    descriptionVi: "Cải cách cách làm việc — luật mới, ảnh hưởng thực tế.",
    recommendationReasonVi: "Ảnh hưởng TRỰC TIẾP người lao động ngoại. BJT business topic.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["work_reform", "labor_law", "business_trends"],
      contentGoal: "Hiểu 働き方改革 + ảnh hưởng thực tế.",
      usageNote: "2019~: 残業上限 (36協定 strict hơn), 有給5日 bắt buộc, 同一労働同一賃金, 副業解禁 trend. 2024: 物流/建設/医師 にも残業上限 (2024年問題). 週休3日 (4-day week) thí điểm. ジョブ型雇用 tăng (vs メンバーシップ型 truyền thống).",
      japaneseExpressions: [
        { word: "働き方改革", reading: "はたらきかたかいかく", meaning: "Cải cách cách làm việc (work style reform)", jlptLevel: "N3", example: "働き方改革で残業が月45時間に制限されました。", exampleReading: "はたらきかたかいかくでざんぎょうがつきよんじゅうごじかんにせいげんされました。", exampleMeaning: "Cải cách lao động giới hạn OT 45h/tháng.", usageNote: "2019 luật. Trụ cột: ① 残業上限 ② 有給5日 ③ 同一賃金 ④ 高プロ制度. Ảnh hưởng: interview hỏi 'うちの働き方は...' = company PR." },
        { word: "2024年問題", reading: "にせんにじゅうよねんもんだい", meaning: "Vấn đề 2024 (logistics crisis from OT cap)", jlptLevel: "N2", example: "2024年問題でトラックドライバーの残業が制限されます。", exampleReading: "にせんにじゅうよねんもんだいでトラックドライバーのざんぎょうがせいげんされます。", exampleMeaning: "Vấn đề 2024: OT tài xế truck bị giới hạn.", usageNote: "4/2024~: 物流/建設/医師 cũng áp OT上限. Kết quả: 配達遅延, 人手不足 nghiêm trọng hơn. 対策: 中継輸送, 再配達削減, ロボット." },
        { word: "副業", reading: "ふくぎょう", meaning: "Nghề phụ/việc tay trái (side job)", jlptLevel: "N3", example: "副業を認める企業が増えています。", exampleReading: "ふくぎょうをみとめるきぎょうがふえています。", exampleMeaning: "Công ty cho phép nghề phụ tăng.", usageNote: "2018 ガイドライン: 副業OK trend. 2024: ~50% 企業 cho phép. Lưu ý: 確定申告 cần nếu 20万+ thu nhập. 住民税: 普通徴収 chọn (đừng để công ty biết)." }
      ]
    }
  },
  {
    slug: "tourism-inbound-boom",
    moduleConfigId: M_JAPAN,
    titleVi: "インバウンド — Du lịch Nhật bùng nổ",
    titleJa: "インバウンド観光の現状",
    descriptionVi: "Du lịch Nhật — số khách kỷ lục, overtourism, ảnh hưởng.",
    recommendationReasonVi: "Hot topic 2024. Ảnh hưởng đời sống + kinh tế. Từ vựng news.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["tourism", "current_events", "economy"],
      contentGoal: "Hiểu trend du lịch Nhật + từ vựng liên quan.",
      usageNote: "2024: 3500万+ khách (vượt pre-COVID). 円安 = Nhật RẺ. Vấn đề: オーバーツーリズム (quá tải du khách), マナー問題, 宿泊施設 thiếu, 地価上昇 khu du lịch. Chính sách: 観光税 (入湯税, 宿泊税), 分散化 (phân tán → 地方), 高付加価値旅行 (du lịch cao cấp).",
      japaneseExpressions: [
        { word: "インバウンド", reading: "インバウンド", meaning: "Du lịch Nhật (inbound tourism)", jlptLevel: "N3", example: "インバウンド需要で飲食店の売上が回復しました。", exampleReading: "インバウンドじゅようでいんしょくてんのうりあげがかいふくしました。", exampleMeaning: "Nhu cầu du lịch → nhà hàng phục hồi doanh thu.", usageNote: "= 訪日外国人. 2024: kỷ lục. Tin tức dùng hàng ngày. Đối: アウトバウンド (Nhật đi nước ngoài)." },
        { word: "オーバーツーリズム", reading: "オーバーツーリズム", meaning: "Quá tải du khách (overtourism)", jlptLevel: "N2", example: "京都ではオーバーツーリズムが深刻な問題になっています。", exampleReading: "きょうとではオーバーツーリズムがしんこくなもんだいになっています。", exampleMeaning: "Kyoto quá tải du khách trở thành vấn đề nghiêm trọng.", usageNote: "京都, 富士山, 鎌倉 đặc biệt. Dân local: 混雑, 物価↑, マナー↓. 対策: 時間帯分散, 入場制限, 観光税." },
        { word: "免税", reading: "めんぜい", meaning: "Miễn thuế (tax-free)", jlptLevel: "N3", example: "免税制度の見直しが検討されています。", exampleReading: "めんぜいせいどのみなおしがけんとうされています。", exampleMeaning: "Đang xem xét sửa đổi chế độ miễn thuế.", usageNote: "2025 改正 dự kiến: 空港受取 (nhận ở sân bay, không mang ra ngoài). 転売防止. 現行: パスポート見せ → 消費税10% miễn." }
      ]
    }
  },
  {
    slug: "education-reform-kyouiku",
    moduleConfigId: M_NEWS,
    titleVi: "教育改革 — Cải cách giáo dục",
    titleJa: "日本の教育改革",
    descriptionVi: "Thay đổi giáo dục Nhật — 英語, GIGA, 不登校, ゆとり後.",
    recommendationReasonVi: "Có con ở Nhật = cần biết. BJT reading topic. Xã hội issue.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["education", "social_issues", "policy"],
      contentGoal: "Hiểu vấn đề giáo dục Nhật + trend mới.",
      usageNote: "Trend: GIGAスクール (1人1台PC/tablet), 英語教育 強化 (小3~), プログラミング教育 (必修), 探究学習. Vấn đề: 不登校 (30万人+: nghỉ học), 教員不足, いじめ (bully), 受験競争. Cải cách: 通知表 見直し, 部活動 地域移行.",
      japaneseExpressions: [
        { word: "不登校", reading: "ふとうこう", meaning: "Không đến trường (school non-attendance)", jlptLevel: "N3", example: "不登校の子どもは過去最多の30万人を超えました。", exampleReading: "ふとうこうのこどもはかこさいたのさんじゅうまんにんをこえました。", exampleMeaning: "Trẻ không đến trường vượt 30 vạn — kỷ lục.", usageNote: "30日+/年 nghỉ = 不登校 (定義). Nguyên nhân: いじめ, 友人関係, 学業, 家庭. Hỗ trợ: フリースクール, 適応指導教室, オンライン出席認定." },
        { word: "GIGAスクール", reading: "ギガスクール", meaning: "Chương trình 1 em 1 máy tính (GIGA School program)", jlptLevel: "N2", example: "GIGAスクールで全生徒にタブレットが配布されました。", exampleReading: "ギガスクールでぜんせいとにタブレットがはいふされました。", exampleMeaning: "GIGA School phát tablet cho mọi học sinh.", usageNote: "2020~: 1人1台端末. Chromebook/iPad. 課題: 教員 ICT skill, ネット依存, 故障対応. 良い: 個別最適化学習." },
        { word: "探究学習", reading: "たんきゅうがくしゅう", meaning: "Học tập khám phá (inquiry-based learning)", jlptLevel: "N2", example: "高校で探究学習の授業が必修になりました。", exampleReading: "こうこうでたんきゅうがくしゅうのじゅぎょうがひっしゅうになりました。", exampleMeaning: "Cấp 3 bắt buộc học khám phá.", usageNote: "2022~: 総合的な探究の時間 (高校). 自分でテーマ設定 → 調査 → 発表. Đánh giá: レポート, プレゼン. ≠ 暗記 truyền thống." }
      ]
    }
  },
  {
    slug: "politics-senkyo-basics",
    moduleConfigId: M_NEWS,
    titleVi: "選挙・政治 — Chính trị cơ bản",
    titleJa: "日本の政治ニュースの読み方",
    descriptionVi: "Chính trị Nhật — đảng phái, bầu cử, từ vựng tin tức.",
    recommendationReasonVi: "Đọc báo Nhật = gặp chính trị hàng ngày. BJT reading nội dung này.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["politics", "election", "news_vocabulary"],
      contentGoal: "Biết từ vựng chính trị cơ bản để đọc tin.",
      usageNote: "Hệ thống: 議院内閣制 (parliamentary). 衆議院 (hạ viện: 465 ghế, quyền lực hơn) + 参議院 (thượng viện: 248 ghế). Đảng: 自民党 (cầm quyền lâu nhất), 公明党 (liên minh), 立憲民主党 (đối lập chính). 総理大臣 = PM. Bầu cử: 18+ vote quyền. Ngoại quốc: KHÔNG có quyền vote.",
      japaneseExpressions: [
        { word: "選挙", reading: "せんきょ", meaning: "Bầu cử (election)", jlptLevel: "N3", example: "衆議院選挙は10月に実施されました。", exampleReading: "しゅうぎいんせんきょはじゅうがつにじっしされました。", exampleMeaning: "Bầu cử hạ viện tổ chức tháng 10.", usageNote: "衆院選 (4年 max, giải tán bất kỳ lúc nào), 参院選 (3年 1 lần, nửa). 投票率 thấp (~55%). Ngoại quốc: xem = understand society." },
        { word: "国会", reading: "こっかい", meaning: "Quốc hội (National Diet/Parliament)", jlptLevel: "N3", example: "国会で新しい法律が可決されました。", exampleReading: "こっかいであたらしいほうりつがかけつされました。", exampleMeaning: "Quốc hội thông qua luật mới.", usageNote: "= 国の唯一の立法機関. 通常国会 (1月~6月: 150日), 臨時国会, 特別国会. 予算, 法律, 条約 thông qua." },
        { word: "内閣", reading: "ないかく", meaning: "Nội các (Cabinet — chính phủ điều hành)", jlptLevel: "N3", example: "新しい内閣が発足しました。", exampleReading: "あたらしいないかくがほっそくしました。", exampleMeaning: "Nội các mới ra mắt.", usageNote: "内閣総理大臣 (PM) + 国務大臣 (bộ trưởng). 内閣改造: thay bộ trưởng. 支持率 (approval rate): NHK, 各社 khảo sát hàng tháng." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("📰 News/Current Affairs batch 4...");
  await runBatch(client, cards, "News-4");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
