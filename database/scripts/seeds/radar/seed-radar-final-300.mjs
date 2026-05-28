/**
 * Radar Seed: Final push to 300 (5 cards)
 * Run: node scripts/seed-radar-final-300.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_NEWS = MODULES.news_bjt;
const M_JAPAN = MODULES.japan_today;
const M_FAMILY = MODULES.family_school;

const cards = [
  {
    slug: "cashless-society-trend",
    moduleConfigId: M_NEWS,
    titleVi: "キャッシュレス — Xã hội không tiền mặt",
    titleJa: "日本のキャッシュレス化",
    descriptionVi: "Cashless ở Nhật — QR, IC card, trend + vấn đề.",
    recommendationReasonVi: "Nhật đang chuyển nhanh sang cashless. Biết = tiện + tiết kiệm points.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["cashless", "fintech", "daily_life"],
      contentGoal: "Hiểu landscape cashless Nhật.",
      usageNote: "2024: ~40% cashless (mục tiêu 80% 2025). Loại: QRコード (PayPay #1, 楽天Pay, d払い), 交通系IC (Suica, PASMO), クレカ (Visa, Master), 電子マネー (iD, QUICPay). Ưu: ポイント還元 (0.5-2%+). Vấn đề: 高齢者 gap, 小規模店 chưa adopt, 災害時 = dùng不可.",
      japaneseExpressions: [
        { word: "ポイント還元", reading: "ポイントかんげん", meaning: "Hoàn điểm (point cashback)", jlptLevel: "N3", example: "PayPayで支払うと1%のポイント還元があります。", exampleReading: "ペイペイでしはらうといちパーセントのポイントかんげんがあります。", exampleMeaning: "Trả PayPay được hoàn 1% điểm.", usageNote: "Cashless = lý do #1 dùng. PayPay: 0.5-1.5%. 楽天: 1%+SPU. Campaign: 20-50% back (たまに). ポイ活 (săn point) = hobby phổ biến." },
        { word: "電子マネー", reading: "でんしマネー", meaning: "Tiền điện tử (e-money — NFC tap payment)", jlptLevel: "N4", example: "コンビニでは電子マネーが使えます。", exampleReading: "コンビニではでんしマネーがつかえます。", exampleMeaning: "Combini dùng được tiền điện tử.", usageNote: "= tap to pay. Suica/PASMO: 電車 + コンビニ + 自販機. iD/QUICPay: ポストペイ (trả sau). Apple Pay/Google Pay: スマホ 1台 cho tất cả." },
        { word: "チャージ", reading: "チャージ", meaning: "Nạp tiền (charge/top-up — for prepaid)", jlptLevel: "N5", example: "Suicaに3000円チャージしました。", exampleReading: "スイカにさんぜんえんチャージしました。", exampleMeaning: "Nạp 3000 yên vào Suica.", usageNote: "Prepaid型: trước dùng phải nạp. 方法: 現金 (駅 券売機), クレカ (アプリ), オートチャージ (tự nạp khi thấp). 残高不足: 改札 止まる (cổng dừng) — embarrassing." }
      ]
    }
  },
  {
    slug: "housing-crisis-jutaku",
    moduleConfigId: M_NEWS,
    titleVi: "住宅問題 — Nhà ở Nhật",
    titleJa: "日本の住宅事情",
    descriptionVi: "Vấn đề nhà ở — giá tăng, 空き家, compact living.",
    recommendationReasonVi: "Nhà = chi phí lớn nhất. Hiểu thị trường = quyết định đúng.",
    category: "news",
    visualTheme: "amber_news",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["housing", "real_estate", "social_issues"],
      contentGoal: "Hiểu vấn đề nhà ở Nhật hiện tại.",
      usageNote: "2024: マンション価格 過去最高 (Tokyo 23区: 平均 1億超!). 背景: 円安 → 海外投資家, 建設コスト↑, 人口集中. 対比: 空き家 900万戸 (全国 13.8%: kỷ lục). 地方: 家 0円 (空き家バンク). 若者: 賃貸 vs 購入 議論. 2024: 住宅ローン金利 上昇 (変動 → 要注意).",
      japaneseExpressions: [
        { word: "住宅ローン", reading: "じゅうたくローン", meaning: "Vay mua nhà (housing loan/mortgage)", jlptLevel: "N3", example: "住宅ローンの金利が上がり始めています。", exampleReading: "じゅうたくローンのきんりがあがりはじめています。", exampleMeaning: "Lãi suất vay nhà bắt đầu tăng.", usageNote: "変動金利: 0.3-0.5% (2024: tăng dần). 固定: 1.5-2%. 35年返済 standard. 頭金: 0-20%. 団信 (bảo hiểm: chết → hết nợ). Ngoại quốc: 永住 ない → vay KHÓ (一部銀行 OK)." },
        { word: "空き家", reading: "あきや", meaning: "Nhà trống/bỏ hoang (vacant house)", jlptLevel: "N3", example: "地方では空き家が増え続けています。", exampleReading: "ちほうではあきやがふえつづけています。", exampleMeaning: "Vùng quê nhà trống tiếp tục tăng.", usageNote: "900万戸 (2023). 原因: 高齢化, 相続放棄, 地方人口減. 対策: 空き家バンク (nhà 0-100万), 特定空き家 (nguy hiểm: 行政撤去). Cơ hội: 地方移住 + リノベ = rẻ + cool." },
        { word: "家賃", reading: "やちん", meaning: "Tiền thuê nhà (rent)", jlptLevel: "N4", example: "東京の家賃は年々上がっています。", exampleReading: "とうきょうのやちんはねんねんあがっています。", exampleMeaning: "Tiền thuê Tokyo tăng hàng năm.", usageNote: "Tokyo 1R: 7-10万. 1LDK: 12-18万. 大阪: 70% Tokyo. 地方: 3-5万 cho 2LDK. 相場: suumo, homes.co.jp check. 更新料: 2年に1回 1ヶ月分 (東京 custom)." }
      ]
    }
  },
  {
    slug: "convenience-store-culture",
    moduleConfigId: M_JAPAN,
    titleVi: "コンビニ文化 — Combini = tất cả",
    titleJa: "日本のコンビニの使いこなし方",
    descriptionVi: "Combini Nhật — dịch vụ ẩn, tiết kiệm, from A to Z.",
    recommendationReasonVi: "Combini = lifeline. Làm được 50+ việc mà nhiều người chỉ biết 5.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["convenience_store", "daily_life", "services"],
      contentGoal: "Biết tất cả dịch vụ combini.",
      usageNote: "3 lớn: セブン, ファミマ, ローソン. Dịch vụ ngoài ăn: ATM (24h), 公共料金支払 (điện/gas/nước), 住民票取得 (MN card), コピー/印刷/FAX, 宅配便 送る/受取, チケット購入, 写真印刷, Wi-Fi, ネットプリント, メルカリ発送, 切手/はがき, 荷物ロッカー受取. Mẹo: PB商品 (private brand: rẻ + ngon), 深夜 値引き.",
      japaneseExpressions: [
        { word: "公共料金", reading: "こうきょうりょうきん", meaning: "Phí dịch vụ công (utility bills — điện/gas/nước)", jlptLevel: "N3", example: "コンビニで公共料金を支払えます。", exampleReading: "コンビニでこうきょうりょうきんをしはらえます。", exampleMeaning: "Trả bill điện/nước ở combini được.", usageNote: "振込用紙 (phiếu thanh toán) + 現金 → カウンター. 期限: check phiếu. 一部: バーコード決済 OK (PayPay etc). 口座振替 (tự trừ TK) cũng setup được." },
        { word: "マルチコピー機", reading: "マルチコピーき", meaning: "Máy đa năng (multifunction copier — print/scan/fax)", jlptLevel: "N4", example: "マルチコピー機で住民票を印刷しました。", exampleReading: "マルチコピーきでじゅうみんひょうをいんさつしました。", exampleMeaning: "In 住民票 ở máy đa năng.", usageNote: "できること: コピー (10¥/白黒), 写真印刷 (30¥/L判), スキャン→USB/メール, FAX (50¥), ネットプリント (家で登録→店で印刷), 住民票/印鑑証明 (MN card). 24h available." },
        { word: "ネットプリント", reading: "ネットプリント", meaning: "In từ internet (cloud print — upload → combini print)", jlptLevel: "N4", example: "家にプリンターがないのでネットプリントを使います。", exampleReading: "いえにプリンターがないのでネットプリントをつかいます。", exampleMeaning: "Nhà không có máy in nên dùng net print.", usageNote: "セブン: netprint. ファミマ/ローソン: ネットワークプリント. App upload → 予約番号 → 店のコピー機で印刷. 白黒 20¥, カラー 60¥. PDFも写真もOK." }
      ]
    }
  },
  {
    slug: "parenting-support-kosodate",
    moduleConfigId: M_FAMILY,
    titleVi: "子育て支援 — Hỗ trợ nuôi con",
    titleJa: "自治体の子育て支援制度",
    descriptionVi: "Trợ cấp + dịch vụ nuôi con miễn phí từ thành phố.",
    recommendationReasonVi: "Nhiều hỗ trợ FREE mà ngoại quốc KHÔNG BIẾT → mất tiền oan.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["childcare_support", "benefits", "government_services"],
      contentGoal: "Biết tất cả hỗ trợ nuôi con ở Nhật.",
      usageNote: "Trợ cấp: 児童手当 (15,000¥/月 ~3歳, 10,000¥ 3-中学生, 2024 拡充: 高校生まで). 出産育児一時金: 50万 (2023~). 医療費: 子ども 無料~中学卒 (自治体). Dịch vụ: 子育て支援センター (FREE play + tư vấn), ファミリーサポート (ファミサポ: giữ hộ 700-900¥/h), 一時保育 (gửi tạm). 保育園/幼稚園: 3-5歳 無償化.",
      japaneseExpressions: [
        { word: "児童手当", reading: "じどうてあて", meaning: "Trợ cấp trẻ em (child allowance — hàng tháng)", jlptLevel: "N3", example: "児童手当は中学卒業まで支給されます。", exampleReading: "じどうてあてはちゅうがくそつぎょうまでしきゅうされます。", exampleMeaning: "Trợ cấp trẻ em đến hết trung học cơ sở.", usageNote: "2024 拡充: 高校生まで + 第3子以降 30,000¥. 所得制限 撤廃. 申請: 出生届 + 同時 at 役所. 4ヶ月ごと振込. 外国人: CÙNG QUYỀN (在留資格 valid)." },
        { word: "一時保育", reading: "いちじほいく", meaning: "Gửi trẻ tạm thời (temporary childcare)", jlptLevel: "N3", example: "用事がある時は一時保育を利用しています。", exampleReading: "ようじがあるときはいちじほいくをりようしています。", exampleMeaning: "Khi có việc dùng dịch vụ gửi trẻ tạm.", usageNote: "保育園/認定こども園: 予約制. 1日 2000-3000¥. リフレッシュ目的 OK (疲れた: 正当理由). 登録制: 事前 面接 + 書類. 空き: 少ない → 早め予約." },
        { word: "子育て支援センター", reading: "こそだてしえんセンター", meaning: "Trung tâm hỗ trợ nuôi con (childcare support center)", jlptLevel: "N3", example: "子育て支援センターで同じ月齢のママ友ができました。", exampleReading: "こそだてしえんセンターでおなじげつれいのママともができました。", exampleMeaning: "Quen bạn mẹ cùng tháng ở trung tâm hỗ trợ.", usageNote: "FREE (市区町村 運営). Mỗi 区 có 1+. 0-3歳: chơi tự do, イベント (手遊び, 読み聞かせ), 相談 (tư vấn nuôi con). Ngoại quốc: welcome. Giao lưu tốt." }
      ]
    }
  },
  {
    slug: "japanese-new-year-oshogatsu",
    moduleConfigId: M_JAPAN,
    titleVi: "お正月 — Tết Nhật",
    titleJa: "お正月の過ごし方",
    descriptionVi: "Tết Nhật — phong tục, đồ ăn, hoạt động, お年玉.",
    recommendationReasonVi: "正月 = Tết Nhật (1/1-3). Biết phong tục = hòa nhập + thưởng thức.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["new_year", "traditions", "culture"],
      contentGoal: "Biết phong tục Tết Nhật + từ vựng.",
      usageNote: "Trước: 大掃除 (tổng vệ sinh: 28-30/12), 年賀状 (thiệp chúc: gửi trước 25/12 → đến 1/1), 忘年会. Đêm 31: 年越しそば (mì soba giao thừa), 除夜の鐘 (108 hồi chuông). 1/1-3: 初詣 (viếng đền), おせち料理 (mâm Tết), お年玉 (lì xì: 小学生 3000¥, 中学生 5000¥), 初売り (sale đầu năm), 福袋 (túi may mắn).",
      japaneseExpressions: [
        { word: "お年玉", reading: "おとしだま", meaning: "Tiền lì xì (New Year's money gift to children)", jlptLevel: "N4", example: "甥っ子にお年玉を5000円あげました。", exampleReading: "おいっこにおとしだまをごせんえんあげました。", exampleMeaning: "Lì xì cháu trai 5000 yên.", usageNote: "Cho: 子ども (cháu, con bạn thân). Mức: 幼児 1000¥, 小学低 3000¥, 小学高 5000¥, 中学 5000¥, 高校 10000¥. ポチ袋 (bao lì xì nhỏ) bỏ vào. Tên người nhận viết ngoài." },
        { word: "初詣", reading: "はつもうで", meaning: "Viếng đền đầu năm (first shrine/temple visit)", jlptLevel: "N4", example: "元旦に家族で初詣に行きました。", exampleReading: "がんたんにかぞくではつもうでにいきました。", exampleMeaning: "Mùng 1 cả nhà đi viếng đền.", usageNote: "1/1-3 (三が日). Đông nhất: 明治神宮 (300万), 成田山, 川崎大師. する: お賽銭 (bỏ tiền: 5円 = ご縁), おみくじ (xăm: 大吉→凶), お守り (bùa), 絵馬 (bảng gỗ viết ước). 2礼2拍手1礼 (thần社)." },
        { word: "福袋", reading: "ふくぶくろ", meaning: "Túi may mắn (lucky bag — bán đầu năm)", jlptLevel: "N4", example: "毎年スタバの福袋を買うのが楽しみです。", exampleReading: "まいとしスタバのふくぶくろをかうのがたのしみです。", exampleMeaning: "Mỗi năm mua fukubukuro Starbucks là thú vui.", usageNote: "1/1-3: 百貨店, ブランド, 飲食店. Giá: 3000-50000¥. 中身: bí mật (usually 2-3x giá trị). 人気: Apple (抽選), スタバ, 無印, ヨドバシ. 事前予約 (online) phổ biến → bán hết nhanh." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🎯 Final push to 300...");
  await runBatch(client, cards, "Final-300");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
