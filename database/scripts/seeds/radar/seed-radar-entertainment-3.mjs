/**
 * Radar Seed: Entertainment & Culture batch 3 (10 cards)
 * Topics: manga/anime, seasonal travel, temples, hot springs, J-pop, sports, gaming
 * Run: node scripts/seed-radar-entertainment-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M = MODULES.japan_today;

const cards = [
  {
    slug: "manga-anime-culture",
    moduleConfigId: M,
    titleVi: "漫画・アニメ — Văn hóa manga/anime",
    titleJa: "漫画とアニメの楽しみ方",
    descriptionVi: "Manga/anime ở Nhật — mua, đọc, thuê, app, genre từ vựng.",
    recommendationReasonVi: "Manga = cách học tiếng Nhật vui nhất + hiểu văn hóa sâu.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["manga", "anime", "pop_culture", "reading"],
      contentGoal: "Biết cách đọc/xem manga-anime + genre từ vựng.",
      usageNote: "Mua: 本屋 (nhà sách), Amazon, BookOff (2nd hand). App: ジャンプ+, マンガワン, ピッコマ (free chapters). Genre: 少年 (shounen: battle), 少女 (shoujo: romance), 青年 (seinen: mature), 日常 (slice of life). Cách học: まず anime (nghe) → manga (đọc + furigana).",
      japaneseExpressions: [
        { word: "連載", reading: "れんさい", meaning: "Liên tải (serialization — ra hàng tuần/tháng)", jlptLevel: "N3", example: "あの漫画は週刊少年ジャンプで連載中です。", exampleReading: "あのまんがはしゅうかんしょうねんジャンプでれんさいちゅうです。", exampleMeaning: "Manga đó đang liên tải trên Jump tuần.", usageNote: "週刊 (tuần), 月刊 (tháng). 連載開始 = bắt đầu. 完結 (かんけつ) = kết thúc." },
        { word: "単行本", reading: "たんこうぼん", meaning: "Manga tập (tankoubon — collected volume)", jlptLevel: "N3", example: "新刊の単行本を予約しました。", exampleReading: "しんかんのたんこうぼんをよやくしました。", exampleMeaning: "Đặt trước tập manga mới.", usageNote: "1冊: 500-700¥. 新刊 (mới ra), 既刊 (đã ra). BookOff: 100-300¥/冊 (2nd hand)." },
        { word: "声優", reading: "せいゆう", meaning: "Diễn viên lồng tiếng (voice actor)", jlptLevel: "N3", example: "好きな声優のイベントに行きたいです。", exampleReading: "すきなせいゆうのイベントにいきたいです。", exampleMeaning: "Muốn đi event seiyuu yêu thích.", usageNote: "Nhật: 声優 = celebrity. Radio, live, concert. 推し (oshi) = fan cứng của ai đó." }
      ]
    }
  },
  {
    slug: "shrine-temple-visit",
    moduleConfigId: M,
    titleVi: "神社・お寺 — Viếng đền/chùa",
    titleJa: "神社とお寺の参拝方法",
    descriptionVi: "Cách viếng đền (神社) vs chùa (お寺) — đúng lễ nghi.",
    recommendationReasonVi: "Sống Nhật = đi 神社/お寺 thường xuyên. Biết cách = tôn trọng + enjoy.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["shrine", "temple", "religion", "etiquette"],
      contentGoal: "Phân biệt 神社/お寺 + cách viếng đúng cách.",
      usageNote: "神社 (Shinto): 鳥居, 二礼二拍手一礼 (2 cúi, 2 vỗ tay, 1 cúi). お寺 (Buddhist): 山門, 合掌 (chắp tay), KHÔNG vỗ tay. Dịp: 初詣 (1/1), 七五三, 合格祈願 (cầu đỗ), 厄除け (trừ xui).",
      japaneseExpressions: [
        { word: "お賽銭", reading: "おさいせん", meaning: "Tiền công đức (offering coins)", jlptLevel: "N3", example: "お賽銭を入れてから手を合わせます。", exampleReading: "おさいせんをいれてからてをあわせます。", exampleMeaning: "Bỏ tiền công đức xong chắp tay.", usageNote: "5円 (ご縁 = duyên) = phổ biến nhất. 10円 NG (遠縁 = xa duyên). 100円, 500円 も OK." },
        { word: "御朱印", reading: "ごしゅいん", meaning: "Con dấu đền/chùa (shrine/temple stamp — sưu tập)", jlptLevel: "N3", example: "御朱印帳を持って全国の神社を巡っています。", exampleReading: "ごしゅいんちょうをもってぜんこくのじんじゃをめぐっています。", exampleMeaning: "Cầm sổ stamp đi khắp đền cả nước.", usageNote: "300-500¥/cái. 御朱印帳: sổ đặc biệt (~2000¥). Sưu tập = hobby phổ biến. Mỗi nơi unique design." },
        { word: "おみくじ", reading: "おみくじ", meaning: "Quẻ xăm (fortune slip)", jlptLevel: "N4", example: "初詣でおみくじを引いたら大吉でした。", exampleReading: "はつもうででおみくじをひいたらだいきちでした。", exampleMeaning: "Rút quẻ đầu năm được đại cát.", usageNote: "100-200¥. 大吉 > 吉 > 中吉 > 小吉 > 末吉 > 凶 > 大凶. Xui: buộc lại ở cây đền. Tốt: mang về." }
      ]
    }
  },
  {
    slug: "onsen-ryokan-experience",
    moduleConfigId: M,
    titleVi: "温泉旅館 — Suối nóng & nhà trọ Nhật",
    titleJa: "温泉旅館の楽しみ方",
    descriptionVi: "Trải nghiệm ryokan — tắm onsen đúng cách, manners, từ vựng.",
    recommendationReasonVi: "温泉 = quintessential Japan. Biết manner = relax thực sự.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 162,
    metadata: {
      seed: true,
      skills: ["onsen", "ryokan", "travel", "etiquette"],
      contentGoal: "Biết cách tắm onsen đúng + trải nghiệm ryokan.",
      usageNote: "Rules: 1) Rửa sạch TRƯỚC khi vào bồn. 2) Không khăn trong nước. 3) Không bơi/lặn. 4) Xăm: nhiều nơi CẤM (貸切風呂 = private OK). Flow: 脱衣所 (cởi) → 洗い場 (rửa) → 浴槽 (ngâm) → repeat.",
      japaneseExpressions: [
        { word: "露天風呂", reading: "ろてんぶろ", meaning: "Bồn ngoài trời (open-air bath)", jlptLevel: "N3", example: "雪を見ながら露天風呂に入るのは最高です。", exampleReading: "ゆきをみながらろてんぶろにはいるのはさいこうです。", exampleMeaning: "Ngắm tuyết trong khi tắm ngoài trời = tuyệt nhất.", usageNote: "Mùa đông = best. 景色 (cảnh) + cold air + hot water = bliss." },
        { word: "貸切風呂", reading: "かしきりぶろ", meaning: "Bồn riêng (private bath — gia đình/couple)", jlptLevel: "N3", example: "タトゥーがあるので貸切風呂を予約しました。", exampleReading: "タトゥーがあるのでかしきりぶろをよやくしました。", exampleMeaning: "Có xăm nên đặt bồn riêng.", usageNote: "45-60分, 2000-5000¥ thêm. Có xăm: lựa chọn tốt nhất. Gia đình nhỏ: convenient." },
        { word: "浴衣", reading: "ゆかた", meaning: "Áo yukata (mặc trong ryokan)", jlptLevel: "N4", example: "旅館では浴衣を着て食事できます。", exampleReading: "りょかんではゆかたをきてしょくじできます。", exampleMeaning: "Ở ryokan mặc yukata đi ăn được.", usageNote: "Ryokan provide free. Mặc: 左前 (bên trái đè lên). 右前 = người chết. 帯 (đai) buộc eo." }
      ]
    }
  },
  {
    slug: "seasonal-travel-japan",
    moduleConfigId: M,
    titleVi: "季節の旅行 — Du lịch theo mùa",
    titleJa: "季節ごとのおすすめ旅行先",
    descriptionVi: "Mỗi mùa đi đâu — hoa anh đào, biển, lá đỏ, tuyết.",
    recommendationReasonVi: "Nhật = 4 mùa rõ rệt. Du lịch đúng mùa = gấp 10 lần đẹp.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["travel", "seasonal", "sightseeing"],
      contentGoal: "Biết du lịch gì mỗi mùa ở Nhật.",
      usageNote: "春 (3-5月): 花見 (桜: 東京3月末, 北海道5月). 夏 (6-8月): 海水浴, 花火大会, 北海道 涼しい. 秋 (9-11月): 紅葉 (京都11月best). 冬 (12-2月): スキー (北海道/長野), 温泉, イルミネーション.",
      japaneseExpressions: [
        { word: "紅葉", reading: "こうよう", meaning: "Lá đỏ mùa thu (autumn foliage)", jlptLevel: "N3", example: "京都の紅葉は11月が見頃です。", exampleReading: "きょうとのこうようはじゅういちがつがみごろです。", exampleMeaning: "Lá đỏ Kyoto đẹp nhất tháng 11.", usageNote: "紅葉狩り (もみじがり) = đi ngắm lá đỏ. Spots: 嵐山 (京都), 日光, 箱根. ライトアップ (đèn đêm) = stunning." },
        { word: "花見", reading: "はなみ", meaning: "Ngắm hoa (cherry blossom viewing picnic)", jlptLevel: "N4", example: "週末に花見をする予定です。", exampleReading: "しゅうまつにはなみをするよていです。", exampleMeaning: "Cuối tuần dự định đi ngắm hoa.", usageNote: "Trải シート (tấm lót) dưới 桜. Ăn uống. 場所取り: sáng sớm đi giữ chỗ. 満開 (mankai) = nở đẹp nhất (3-5 ngày only!)." },
        { word: "見頃", reading: "みごろ", meaning: "Thời điểm đẹp nhất (best viewing time)", jlptLevel: "N3", example: "桜の見頃は地域によって違います。", exampleReading: "さくらのみごろはちいきによってちがいます。", exampleMeaning: "Thời điểm hoa đẹp nhất khác nhau theo vùng.", usageNote: "桜前線 (sakura front): 沖縄 1月 → 北海道 5月. Check: weathernews.jp." }
      ]
    }
  },
  {
    slug: "japanese-music-jpop",
    moduleConfigId: M,
    titleVi: "J-POP — Âm nhạc Nhật",
    titleJa: "J-POPの楽しみ方",
    descriptionVi: "J-POP, J-Rock, idol — cách nghe, live, fan culture.",
    recommendationReasonVi: "Nhạc Nhật = cách học hay + hòa nhập. Live concert = trải nghiệm đỉnh.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 152,
    metadata: {
      seed: true,
      skills: ["music", "jpop", "concerts", "fan_culture"],
      contentGoal: "Biết cách nghe nhạc + đi concert ở Nhật.",
      usageNote: "Streaming: Spotify, Apple Music, LINE MUSIC (Nhật có nhiều exclusive). Live: チケット khó mua (抽選 = lottery). Giá: 5000-15,000¥. Fan culture: 推し (oshi = bias), 応援 (ủng hộ), ペンライト (lightstick), 物販 (merch).",
      japaneseExpressions: [
        { word: "推し", reading: "おし", meaning: "Bias/người mình fan cứng (favorite idol/artist)", jlptLevel: "N3", example: "推しの新曲が出たので何回も聴いています。", exampleReading: "おしのしんきょくがでたのでなんかいもきいています。", exampleMeaning: "Bài mới của bias ra nên nghe đi nghe lại.", usageNote: "推し活 (oshi-katsu) = hoạt động fan: concert, goods, cafe, 聖地巡礼 (đi nơi liên quan)." },
        { word: "抽選", reading: "ちゅうせん", meaning: "Rút thăm/lottery (để mua vé concert)", jlptLevel: "N3", example: "ライブチケットの抽選に当たりました！", exampleReading: "ライブチケットのちゅうせんにあたりました！", exampleMeaning: "Trúng lottery vé concert!", usageNote: "Phổ biến: 先行抽選 (fan club trước) → 一般発売 (public sale). 人気アーティスト: tỷ lệ 10-30%." },
        { word: "物販", reading: "ぶっぱん", meaning: "Bán merch (merchandise sales tại concert)", jlptLevel: "N3", example: "物販の列が長かったので、1時間並びました。", exampleReading: "ぶっぱんのれつがながかったので、いちじかんならびました。", exampleMeaning: "Hàng merch dài nên xếp 1 tiếng.", usageNote: "Tシャツ 3000-5000¥, タオル 2000¥, ペンライト 3000¥. 事前販売 (online trước) = tránh xếp hàng." }
      ]
    }
  },
  {
    slug: "video-games-japan",
    moduleConfigId: M,
    titleVi: "ゲーム — Gaming ở Nhật",
    titleJa: "日本のゲーム文化",
    descriptionVi: "Game center, Switch, mobile game — culture + từ vựng gamer.",
    recommendationReasonVi: "Nhật = cái nôi game. Hiểu culture = kết bạn + practice tiếng Nhật.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 150,
    metadata: {
      seed: true,
      skills: ["gaming", "game_center", "mobile_games"],
      contentGoal: "Biết game culture Nhật + từ vựng gamer.",
      usageNote: "Game center: UFOキャッチャー (claw machine), 音ゲー (rhythm), 格ゲー (fighting). Mobile: ガチャ (gacha), スマホゲー. Console: Switch, PS5. Học tiếng: game RPG tiếng Nhật = vocab+reading practice. 実況 (jikkyo: let's play) YouTube = listening.",
      japaneseExpressions: [
        { word: "ガチャ", reading: "ガチャ", meaning: "Gacha (random draw — mobile game monetization)", jlptLevel: "N4", example: "ガチャで推しキャラが出て嬉しいです。", exampleReading: "ガチャでおしキャラがでてうれしいです。", exampleMeaning: "Kéo gacha ra nhân vật yêu thích, vui.", usageNote: "無料石 (free currency) vs 課金 (trả tiền). 天井 (てんじょう) = pity system. Ghiện NG." },
        { word: "対戦", reading: "たいせん", meaning: "Đấu/PvP (versus battle)", jlptLevel: "N4", example: "オンラインで対戦するのが好きです。", exampleReading: "オンラインでたいせんするのがすきです。", exampleMeaning: "Thích đấu online.", usageNote: "Game center: 100¥/lượt. Online: 無料. ランク (rank): ブロンズ→シルバー→ゴールド→マスター." },
        { word: "攻略", reading: "こうりゃく", meaning: "Chiến lược/guide (game walkthrough)", jlptLevel: "N3", example: "このボスの攻略法を教えてください。", exampleReading: "このボスのこうりゃくほうをおしえてください。", exampleMeaning: "Chỉ cách đánh boss này.", usageNote: "攻略サイト: wiki, gamewith, game8. 攻略動画 = video hướng dẫn." }
      ]
    }
  },
  {
    slug: "japanese-food-izakaya",
    moduleConfigId: M,
    titleVi: "居酒屋 — Quán nhậu Nhật",
    titleJa: "居酒屋のルールと注文方法",
    descriptionVi: "Cách gọi đồ, chia tiền, văn hóa uống ở izakaya.",
    recommendationReasonVi: "居酒屋 = nơi kết bạn + team bonding. Biết rule = hòa nhập.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["izakaya", "drinking_culture", "ordering"],
      contentGoal: "Biết quy tắc izakaya + cách gọi đồ.",
      usageNote: "お通し (appetizer tự động: 300-500¥/人 — KHÔNG optional). 飲み放題 (unlimited drinks: 1500-3000¥/2h). 割り勘 (chia đều). 席料 (phí ghế: ở một số nơi). Rót bia cho người khác = manner. 「とりあえずビール」= câu đầu tiên.",
      japaneseExpressions: [
        { word: "飲み放題", reading: "のみほうだい", meaning: "Uống không giới hạn (all-you-can-drink)", jlptLevel: "N4", example: "今日は飲み放題コースにしましょう。", exampleReading: "きょうはのみほうだいコースにしましょう。", exampleMeaning: "Hôm nay chọn course uống thoải mái nhé.", usageNote: "2-3h. 1500-3000¥. ビール, サワー, ハイボール, ソフトドリンク. ラストオーダー 30分前." },
        { word: "お通し", reading: "おとおし", meaning: "Món khai vị tự động (compulsory appetizer)", jlptLevel: "N3", example: "お通しは注文しなくても自動的に出てきます。", exampleReading: "おとおしはちゅうもんしなくてもじどうてきにでてきます。", exampleMeaning: "Món khai vị ra tự động dù không gọi.", usageNote: "300-500¥. Không từ chối được (phần lớn). = phí ngồi. Chain izakaya: rẻ. 高級店: 美味しい." },
        { word: "割り勘", reading: "わりかん", meaning: "Chia đều tiền (split the bill equally)", jlptLevel: "N3", example: "今日は割り勘でいいですか？", exampleReading: "きょうはわりかんでいいですか？", exampleMeaning: "Hôm nay chia đều OK không?", usageNote: "Nhật: phổ biến (khác VN). 上司/先輩 pay nhiều hơn (おごり) = cũng có. Đừng ngại nói 割り勘." }
      ]
    }
  },
  {
    slug: "convenience-store-culture",
    moduleConfigId: M,
    titleVi: "コンビニ活用 — Tận dụng combini",
    titleJa: "コンビニの便利な活用法",
    descriptionVi: "Combini Nhật không chỉ bán đồ ăn — dịch vụ ẩn + mẹo.",
    recommendationReasonVi: "Combini Nhật = mini city hall + bank + post office. Biết = tiện x10.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["convenience_store", "daily_services", "life_hack"],
      contentGoal: "Biết tất cả dịch vụ combini cung cấp ngoài đồ ăn.",
      usageNote: "Dịch vụ: ATM (ゆうちょ, 海外カード OK), コピー/FAX/スキャン, 住民票 (giấy cư trú — マイナンバー), 宅配便 (gửi đồ), チケット発券, 公共料金支払い (tiền điện/nước), 写真印刷, Wi-Fi. 24h. Top: セブン (ATM tốt nhất), ファミマ, ローソン.",
      japaneseExpressions: [
        { word: "マルチコピー機", reading: "マルチコピーき", meaning: "Máy photocopy đa năng (multi-function printer)", jlptLevel: "N4", example: "マルチコピー機で住民票を取れます。", exampleReading: "マルチコピーきでじゅうみんひょうをとれます。", exampleMeaning: "Lấy giấy cư trú ở máy photocopy.", usageNote: "マイナンバーカード cần. 住民票, 印鑑証明, 戸籍 đều lấy được. 200-400¥. 6:30-23:00." },
        { word: "宅配便", reading: "たくはいびん", meaning: "Dịch vụ gửi đồ (parcel delivery)", jlptLevel: "N4", example: "コンビニから宅配便で荷物を送れます。", exampleReading: "コンビニからたくはいびんでにもつをおくれます。", exampleMeaning: "Gửi đồ qua dịch vụ chuyển phát ở combini.", usageNote: "ヤマト (クロネコ), 佐川, ゆうパック. Combini: 24h gửi được. 伝票 (phiếu) điền tại chỗ." },
        { word: "公共料金", reading: "こうきょうりょうきん", meaning: "Tiền dịch vụ công (utility bills)", jlptLevel: "N3", example: "公共料金はコンビニで払えます。", exampleReading: "こうきょうりょうきんはコンビニではらえます。", exampleMeaning: "Tiền dịch vụ công trả ở combini được.", usageNote: "電気, ガス, 水道, NHK, 税金. Mang 払込票 (phiếu) → quầy → trả tiền mặt. 24h." }
      ]
    }
  },
  {
    slug: "japanese-cooking-classes",
    moduleConfigId: M,
    titleVi: "料理教室 — Học nấu ăn Nhật",
    titleJa: "料理教室の選び方",
    descriptionVi: "Lớp nấu ăn ở Nhật — loại, giá, cách tìm + từ vựng bếp.",
    recommendationReasonVi: "Nấu ăn Nhật = tiết kiệm + khỏe + hobby. Lớp học = practice tiếng Nhật.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 148,
    metadata: {
      seed: true,
      skills: ["cooking", "hobby", "japanese_cuisine"],
      contentGoal: "Biết cách tìm lớp nấu ăn + từ vựng bếp cơ bản.",
      usageNote: "Loại: ABCクッキング (chain, 体験500¥), 個人教室 (nhỏ, intimate), オンライン. Giá: 3000-6000¥/回. Site: ストアカ, cookpad教室. Cơ bản: 出汁 (dashi), 煮物 (ninh), 焼き物 (nướng), 和食の基本 (washoku basics).",
      japaneseExpressions: [
        { word: "出汁", reading: "だし", meaning: "Nước dùng Nhật (dashi — nền tảng washoku)", jlptLevel: "N4", example: "美味しい味噌汁は出汁が命です。", exampleReading: "おいしいみそしるはだしがいのちです。", exampleMeaning: "Miso ngon thì dashi là linh hồn.", usageNote: "Loại: 昆布 (tảo bẹ), 鰹節 (cá bào), 煮干し (cá khô). Instant: ほんだし (tiện). Tự nấu: ngon hơn." },
        { word: "レシピ", reading: "レシピ", meaning: "Công thức (recipe)", jlptLevel: "N4", example: "クックパッドでレシピを検索しました。", exampleReading: "クックパッドでレシピをけんさくしました。", exampleMeaning: "Tìm công thức trên Cookpad.", usageNote: "App: クックパッド (user recipes), DELISH KITCHEN (video), クラシル (video). つくれぽ (review ảnh)." },
        { word: "包丁", reading: "ほうちょう", meaning: "Dao bếp (kitchen knife)", jlptLevel: "N4", example: "包丁の使い方を習いたいです。", exampleReading: "ほうちょうのつかいかたをならいたいです。", exampleMeaning: "Muốn học cách dùng dao bếp.", usageNote: "Nhật: 和包丁 = sắc nhất thế giới. 初心者: 三徳包丁 (santoku — đa năng). 100均 dao cũng tạm OK." }
      ]
    }
  },
  {
    slug: "theme-parks-amusement",
    moduleConfigId: M,
    titleVi: "テーマパーク — Công viên giải trí",
    titleJa: "テーマパークの楽しみ方",
    descriptionVi: "Disney, USJ, Fuji-Q — mẹo mua vé, sắp lịch, từ vựng.",
    recommendationReasonVi: "Theme park Nhật = top thế giới. Biết mẹo = tiết kiệm + enjoy max.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 150,
    metadata: {
      seed: true,
      skills: ["theme_park", "leisure", "planning"],
      contentGoal: "Biết mẹo đi theme park ở Nhật.",
      usageNote: "Top: 東京ディズニー (TDL/TDS: 10,900¥), USJ (8,600¥~), 富士急 (tàu lượn #1). Mẹo: 平日 (weekday) đi, 開園前 30分到着, ファストパス/DPA (paid skip), アプリ check 待ち時間 (thời gian chờ).",
      japaneseExpressions: [
        { word: "待ち時間", reading: "まちじかん", meaning: "Thời gian chờ (wait time for rides)", jlptLevel: "N4", example: "人気のアトラクションは待ち時間が2時間です。", exampleReading: "にんきのアトラクションはまちじかんがにじかんです。", exampleMeaning: "Trò chơi nổi tiếng chờ 2 tiếng.", usageNote: "App check realtime. 平日: 30-60分. 休日: 90-180分. Tip: 開園直後 + 閉園前 = ngắn nhất." },
        { word: "アトラクション", reading: "アトラクション", meaning: "Trò chơi/rides (attraction)", jlptLevel: "N4", example: "子ども向けのアトラクションも多いです。", exampleReading: "こどもむけのアトラクションもおおいです。", exampleMeaning: "Trò chơi cho trẻ em cũng nhiều.", usageNote: "身長制限 (giới hạn chiều cao): 102cm, 117cm, 132cm tùy ride. Check trước cho con." },
        { word: "年間パスポート", reading: "ねんかんパスポート", meaning: "Vé năm (annual pass)", jlptLevel: "N4", example: "年3回以上行くなら年間パスポートがお得です。", exampleReading: "ねんさんかいいじょういくならねんかんパスポートがおとくです。", exampleMeaning: "Đi 3+ lần/năm thì mua annual pass lời.", usageNote: "Disney: hiện không bán. USJ: 28,800¥~. 地元テーマパーク: 安い. Tip: 株主優待 (shareholder perks) = vé giảm." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🎭 Entertainment/Culture batch 3...");
  await runBatch(client, cards, "Entertainment-3");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
