/**
 * Radar Seed: Mixed batch 5b — entertainment/news roundup (12 cards)
 * Run: node scripts/seed-radar-mixed-5b.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_JAPAN = MODULES.japan_today;
const M_LOTO = MODULES.loto_ai_lab;
const M_NEWS = MODULES.news_bjt;
const M_LIFE = MODULES.life_hack;
const M_TRANSPORT = MODULES.transport_commute;

const cards = [
  // === ENTERTAINMENT (6) ===
  {
    slug: "seasonal-food-shun",
    moduleConfigId: M_JAPAN,
    titleVi: "旬の食べ物 — Thực phẩm theo mùa",
    titleJa: "日本の旬の食材を楽しむ",
    descriptionVi: "Ăn theo mùa ở Nhật — biết 旬 = ngon + rẻ + văn hóa.",
    recommendationReasonVi: "旬 = văn hóa ẩm thực Nhật. Biết = ăn ngon + tiết kiệm + hội thoại.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["seasonal_food", "culture", "vocabulary"],
      contentGoal: "Biết thực phẩm theo mùa + từ vựng.",
      usageNote: "春: いちご, 筍 (takenoko), 桜餅. 夏: すいか, 枝豆, うなぎ (土用の丑). 秋: さんま, 栗, 松茸, 柿. 冬: みかん, 鍋 (nabe), おでん, ふぐ. Siêu thị: 旬 = rẻ + ngon nhất. Văn hóa: 初物 (đồ đầu mùa) = may mắn.",
      japaneseExpressions: [
        { word: "旬", reading: "しゅん", meaning: "Mùa (của thực phẩm — khi ngon nhất)", jlptLevel: "N3", example: "旬のさんまは脂がのっていて美味しいです。", exampleReading: "しゅんのさんまはあぶらがのっていておいしいです。", exampleMeaning: "Cá sanma mùa béo ngậy ngon.", usageNote: "Siêu thị ghi 旬. Giá rẻ nhất, dinh dưỡng cao nhất. Conversation: 「今が旬ですね」= pha trò hay." },
        { word: "鍋", reading: "なべ", meaning: "Lẩu (hot pot — món mùa đông)", jlptLevel: "N4", example: "冬はみんなで鍋を囲むのが楽しいです。", exampleReading: "ふゆはみんなでなべをかこむのがたのしいです。", exampleMeaning: "Đông quây quần ăn lẩu vui.", usageNote: "Loại: キムチ鍋, 寄せ鍋, すき焼き, しゃぶしゃぶ, もつ鍋, 水炊き. 締め (kết): ご飯 (cơm) or うどん or 雑炊 (cháo). スーパー: 鍋つゆ (nước lẩu ready-made) rất tiện." },
        { word: "食べ放題", reading: "たべほうだい", meaning: "Buffet/ăn thả ga (all-you-can-eat)", jlptLevel: "N4", example: "焼肉食べ放題に行きませんか。", exampleReading: "やきにくたべほうだいにいきませんか。", exampleMeaning: "Đi buffet thịt nướng không?", usageNote: "= 放題 (houdai) = unlimited. 飲み放題 (uống thả ga): 2h ~1500-2000¥. 焼肉食べ放題: 2500-4000¥. 時間制限: 90-120分. 注文制 (order) vs バイキング (self-serve)." }
      ]
    }
  },
  {
    slug: "japanese-festivals-matsuri",
    moduleConfigId: M_JAPAN,
    titleVi: "祭り — Lễ hội Nhật",
    titleJa: "日本の祭りを楽しむ",
    descriptionVi: "Lễ hội Nhật — từ vựng, quy tắc, ăn vặt, 浴衣.",
    recommendationReasonVi: "祭り = trải nghiệm VUI NHẤT ở Nhật. Biết rule + vocab = enjoy max.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["festival", "culture", "seasonal_events"],
      contentGoal: "Biết loại lễ hội + từ vựng + mẹo.",
      usageNote: "Loại: 夏祭り (hè: 7-8月), 秋祭り (thu: 9-11月), 初詣 (năm mới). Đặc trưng: 屋台 (quầy ăn vặt), 花火大会 (pháo hoa), 盆踊り (múa Obon), 神輿 (kiệu thần). Ăn: たこ焼き, 焼きそば, りんご飴, かき氷, 綿あめ. Mặc: 浴衣 (yukata). Mẹo: đi sớm tránh đông, mang tiền mặt (屋台 cash only).",
      japaneseExpressions: [
        { word: "屋台", reading: "やたい", meaning: "Quầy hàng lễ hội (festival food stall)", jlptLevel: "N4", example: "屋台でたこ焼きを買いました。", exampleReading: "やたいでたこやきをかいました。", exampleMeaning: "Mua takoyaki ở quầy lễ hội.", usageNote: "現金 only (hầu hết). 500-800¥/món. 定番: たこ焼き, 焼きそば, フランクフルト, チョコバナナ, わたあめ, 金魚すくい (vớt cá)." },
        { word: "花火大会", reading: "はなびたいかい", meaning: "Đại hội pháo hoa (fireworks festival)", jlptLevel: "N4", example: "隅田川の花火大会は毎年7月に開催されます。", exampleReading: "すみだがわのはなびたいかいはまいとししちがつにかいさいされます。", exampleMeaning: "Pháo hoa sông Sumida tổ chức tháng 7.", usageNote: "夏: toàn quốc. Lớn: 隅田川 (2万発), 長岡, 大曲. 場所取り: sáng sớm trải シート. 浴衣 mặc đi. 有料席: 5000-10000¥ (thoải mái hơn)." },
        { word: "浴衣", reading: "ゆかた", meaning: "Áo kimono mùa hè (summer kimono — casual)", jlptLevel: "N4", example: "花火大会に浴衣で行きたいです。", exampleReading: "はなびたいかいにゆかたでいきたいです。", exampleMeaning: "Muốn mặc yukata đi xem pháo hoa.", usageNote: "= kimono mỏng, casual (夏 + lễ hội + 旅館). Mua: ユニクロ 4000¥~, しまむら, 古着屋. 着方: YouTube tutorial. 左前 (trái trước) = đúng. 右前 = người chết. 帯 (obi: đai) nhiều kiểu thắt." }
      ]
    }
  },
  {
    slug: "sports-watching-japan",
    moduleConfigId: M_JAPAN,
    titleVi: "スポーツ観戦 — Xem thể thao",
    titleJa: "日本のスポーツ観戦の楽しみ方",
    descriptionVi: "Xem thể thao ở Nhật — baseball, sumo, soccer, marathon.",
    recommendationReasonVi: "Sports = hội nhập + conversation topic + FUN.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["sports", "entertainment", "conversation"],
      contentGoal: "Biết xem thể thao ở đâu + từ vựng.",
      usageNote: "Phổ biến: 野球 (#1: 12 teams Pro, sân ~4000-7000¥), サッカー (J-League), 相撲 (6 場所/年: 1,3,5,7,9,11月), 駅伝 (chạy tiếp sức: 箱根 1/2-3), マラソン (東京マラソン 3月). TV: NHK (相撲 free), DAZN (soccer/baseball streaming). Sân: ビール売り子, 応援歌.",
      japaneseExpressions: [
        { word: "応援", reading: "おうえん", meaning: "Cổ vũ (cheering/support)", jlptLevel: "N4", example: "スタジアムでチームを応援するのは最高です。", exampleReading: "スタジアムでチームをおうえんするのはさいこうです。", exampleMeaning: "Cổ vũ team ở sân vận động tuyệt nhất.", usageNote: "野球: 応援歌 (mỗi player có bài), メガホン (loa nhỏ), ジェット風船 (bóng bay: 7回). サッカー: チャント (chant), タオルマフラー. Manner: 相手チーム disrespect = NG." },
        { word: "相撲", reading: "すもう", meaning: "Sumo (đấu vật truyền thống Nhật)", jlptLevel: "N4", example: "初めて国技館で相撲を見ました。", exampleReading: "はじめてこくぎかんですもうをみました。", exampleMeaning: "Lần đầu xem sumo ở Kokugikan.", usageNote: "場所: 東京(1,5,9月), 大阪(3), 名古屋(7), 福岡(11). Vé: 3800¥~ (自由席: sáng sớm xếp hàng). 番付 (ranking): 横綱 > 大関 > 関脇 > ... NHK free 15日 liên tục." },
        { word: "駅伝", reading: "えきでん", meaning: "Chạy tiếp sức (relay marathon — university/corporate)", jlptLevel: "N3", example: "箱根駅伝は毎年お正月にテレビで見ます。", exampleReading: "はこねえきでんはまいとしおしょうがつにテレビでみます。", exampleMeaning: "Xem Hakone Ekiden trên TV mỗi Tết.", usageNote: "箱根駅伝: 1/2-3, 大学 (10区間, 217km). 視聴率 30%+. 実業団: ニューイヤー駅伝 1/1. ドラマ性 cao (繰り上げスタート = bị loại hình thức)." }
      ]
    }
  },
  {
    slug: "japanese-bath-culture",
    moduleConfigId: M_JAPAN,
    titleVi: "お風呂文化 — Văn hóa tắm",
    titleJa: "日本のお風呂文化",
    descriptionVi: "Tắm ở Nhật — quy tắc, 銭湯, スーパー銭湯, mẹo.",
    recommendationReasonVi: "Tắm = văn hóa core Nhật. Sai quy tắc = xấu hổ. Đúng = relax max.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["bath_culture", "manners", "relaxation"],
      contentGoal: "Biết quy tắc tắm chung + types.",
      usageNote: "Quy tắc: ①洗い場 (rửa sạch TRƯỚC khi vào bồn). ②タオル không nhúng nước bồn. ③髪 buộc lên. ④静か (yên lặng). ⑤脱衣所 lau khô trước khi ra. Types: 銭湯 (nhà tắm công: 520¥ Tokyo), スーパー銭湯 (lớn: 800-2000¥, sauna, 食事), 温泉 (nước nóng tự nhiên). Tattoo: 多くの温泉/銭湯 cấm (đang thay đổi dần).",
      japaneseExpressions: [
        { word: "銭湯", reading: "せんとう", meaning: "Nhà tắm công cộng (public bathhouse)", jlptLevel: "N4", example: "近所の銭湯に週2回通っています。", exampleReading: "きんじょのせんとうにしゅうにかいかよっています。", exampleMeaning: "Đi nhà tắm gần nhà 2 lần/tuần.", usageNote: "Fee: 地域 定額 (Tokyo 520¥). Mang: タオル, シャンプー (hoặc mua tại). 番台/フロント: trả tiền. 男湯/女湯 chia. のれん (rèm cửa): 赤=女, 青=男 (không phải luôn)." },
        { word: "サウナ", reading: "サウナ", meaning: "Xông hơi (sauna — trend 2020s)", jlptLevel: "N4", example: "サウナの後の水風呂が気持ちいいです。", exampleReading: "サウナのあとのみずぶろがきもちいいです。", exampleMeaning: "Nước lạnh sau sauna sảng khoái.", usageNote: "2020s BOOM: 「ととのう」(trance state: sauna→水風呂→外気浴 loop). サ活 (sauna activity). サウナイキタイ (app: review). Etiquette: 汗流し (rửa mồ hôi trước vào), タオル敷く (trải khăn ngồi)." },
        { word: "露天風呂", reading: "ろてんぶろ", meaning: "Bồn tắm ngoài trời (outdoor bath)", jlptLevel: "N4", example: "温泉旅館の露天風呂から富士山が見えました。", exampleReading: "おんせんりょかんのろてんぶろからふじさんがみえました。", exampleMeaning: "Từ bồn ngoài trời ryokan thấy Fuji.", usageNote: "= highlight 温泉旅館. 景色 (cảnh) + お湯 + 外の空気 = 最高. 混浴 (nam nữ chung): hiếm + thường có 湯着 (áo tắm). 貸切風呂 (bồn riêng): gia đình/couple." }
      ]
    }
  },
  {
    slug: "karaoke-culture",
    moduleConfigId: M_JAPAN,
    titleVi: "カラオケ — Karaoke",
    titleJa: "カラオケの楽しみ方",
    descriptionVi: "Karaoke Nhật — cách dùng máy, mẹo, フリータイム.",
    recommendationReasonVi: "Karaoke = social activity #1. 二次会 standard. Biết dùng = vui hơn.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 162,
    metadata: {
      seed: true,
      skills: ["karaoke", "social", "entertainment"],
      contentGoal: "Biết cách dùng karaoke + mẹo tiết kiệm.",
      usageNote: "Chains: まねきねこ, ビッグエコー, カラオケ館, ジャンカラ. Giá: 30分 200-500¥ (tùy giờ). フリータイム (unlimited): 1000-2000¥ (昼: rẻ). ドリンクバー: 必須 (bắt buộc order). Máy: DAM, JOYSOUND. 採点 (chấm điểm): fun. ヒトカラ (hát 1 mình): NORMAL ở Nhật, đừng ngại.",
      japaneseExpressions: [
        { word: "フリータイム", reading: "フリータイム", meaning: "Hát không giới hạn thời gian (unlimited time)", jlptLevel: "N5", example: "平日のフリータイムは1000円でお得です。", exampleReading: "へいじつのフリータイムはせんえんでおとくです。", exampleMeaning: "Free time ngày thường 1000 yên = hời.", usageNote: "Thường: 11-18時 (daytime). 夜: đắt hơn. 学割 (student discount) có. 予約: アプリ hoặc walk-in. 延長: 30分単位." },
        { word: "ヒトカラ", reading: "ヒトカラ", meaning: "Hát karaoke 1 mình (solo karaoke)", jlptLevel: "N4", example: "ストレス解消にヒトカラに行きます。", exampleReading: "ストレスかいしょうにヒトカラにいきます。", exampleMeaning: "Đi hát 1 mình giải stress.", usageNote: "= 一人カラオケ. 2024: 30%+ khách = ヒトカラ. 専門店: ワンカラ (1人 booth nhỏ). Lợi: 自由に歌える, 練習, ストレス解消. Đừng ngại!" },
        { word: "十八番", reading: "おはこ", meaning: "Bài tủ/bài ruột (signature song — go-to karaoke song)", jlptLevel: "N3", example: "あなたの十八番は何ですか？", exampleReading: "あなたのおはこはなんですか？", exampleMeaning: "Bài tủ của bạn là gì?", usageNote: "Ai cũng nên có 1-2 bài tủ. Nomikai → karaoke: 順番 (lần lượt). Mới = リモコン予約 (đặt bài remote). Mọi người: 手拍子 (vỗ tay), タンバリン. Kết: ラスト1曲 (bài cuối)." }
      ]
    }
  },
  {
    slug: "japanese-gardens-hobby",
    moduleConfigId: M_JAPAN,
    titleVi: "趣味探し — Tìm hobby ở Nhật",
    titleJa: "日本で始める趣味",
    descriptionVi: "Hobby phổ biến ở Nhật — đăng ký, chi phí, gặp bạn.",
    recommendationReasonVi: "Hobby = giao lưu + tiếng Nhật lên + vui. Nhiều lựa chọn.",
    category: "entertainment",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["hobbies", "community", "social_integration"],
      contentGoal: "Biết hobby options + cách tìm ở Nhật.",
      usageNote: "Phổ biến: ジム (gym: 3000-10000¥/月), ヨガ, ランニング (running club free), 料理教室, 書道 (thư pháp), 茶道, 華道, ダンス, 楽器 (nhạc cụ), 写真 (chụp ảnh), 登山 (leo núi). Tìm: ジモティー, meetup.com, 市区町村 広報誌 (tạp chí ward: 教室 rẻ/free), ストアカ (online class).",
      japaneseExpressions: [
        { word: "習い事", reading: "ならいごと", meaning: "Học ngoại khóa/hobby có lớp (lessons/classes)", jlptLevel: "N4", example: "大人の習い事でピアノを始めました。", exampleReading: "おとなのならいごとでピアノをはじめました。", exampleMeaning: "Bắt đầu học piano (hobby người lớn).", usageNote: "大人: ヨガ, 英会話, 料理, 楽器, ダンス popular. 体験レッスン (trial: FREE/500¥) thử trước. 月謝: 5000-15000¥." },
        { word: "サークル", reading: "サークル", meaning: "Câu lạc bộ/nhóm hobby (circle/club)", jlptLevel: "N4", example: "地域のランニングサークルに入りました。", exampleReading: "ちいきのランニングサークルにはいりました。", exampleMeaning: "Tham gia CLB chạy khu vực.", usageNote: "= nhóm cùng sở thích. 社会人サークル (người đi làm). Tìm: ジモティー 'メンバー募集', つなげーと, スポーツやろうよ!. FREE hoặc 会費 500-2000¥/月." },
        { word: "体験", reading: "たいけん", meaning: "Trải nghiệm/thử (trial experience)", jlptLevel: "N4", example: "陶芸の体験教室に参加しました。", exampleReading: "とうげいのたいけんきょうしつにさんかしました。", exampleMeaning: "Tham gia lớp thử làm gốm.", usageNote: "体験レッスン: thử 1 buổi trước khi commit. じゃらん体験, アソビュー: booking trải nghiệm. 1回 2000-5000¥. ものづくり体験 (handcraft) = popular date/weekend." }
      ]
    }
  },
  // === MISC: TRANSPORT & LIFE (6) ===
  {
    slug: "train-etiquette-manner",
    moduleConfigId: M_TRANSPORT,
    titleVi: "電車マナー — Quy tắc đi tàu",
    titleJa: "電車内のマナー",
    descriptionVi: "Manners trên tàu Nhật — dùng ĐT, ưu tiên, giờ rush.",
    recommendationReasonVi: "Sai manner = bị nhìn + judge. Biết = hòa nhập từ ngày 1.",
    category: "life",
    visualTheme: "cyan_transport",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["train_manners", "public_transport", "social_rules"],
      contentGoal: "Biết quy tắc đi tàu ở Nhật.",
      usageNote: "Quy tắc: ①通話NG (gọi ĐT: TUYỆT ĐỐI KHÔNG). ②マナーモード (silent mode). ③優先席 (ghế ưu tiên: 妊婦, 高齢者, 障害者, 子連れ). ④リュック 前 (balo đeo trước giờ rush). ⑤降りる人優先 (xuống trước, lên sau). ⑥整列乗車 (xếp hàng). ⑦音漏れNG (âm tai nghe lọt ra). Rush hour: 7:30-9:00, 17:30-19:30.",
      japaneseExpressions: [
        { word: "優先席", reading: "ゆうせんせき", meaning: "Ghế ưu tiên (priority seat)", jlptLevel: "N4", example: "お年寄りが立っていたので優先席を譲りました。", exampleReading: "おとしよりがたっていたのでゆうせんせきをゆずりました。", exampleMeaning: "Người già đứng nên nhường ghế ưu tiên.", usageNote: "Ngồi OK nếu trống, nhưng nhường ngay khi cần. 携帯: 優先席付近 マナーモード (一部: 電源OFF yêu cầu — ペースメーカー). 色: thường cam/緑." },
        { word: "駆け込み乗車", reading: "かけこみじょうしゃ", meaning: "Chạy nhảy lên tàu khi cửa đóng (rushing onto train)", jlptLevel: "N3", example: "駆け込み乗車は危険ですのでおやめください。", exampleReading: "かけこみじょうしゃはきけんですのでおやめください。", exampleMeaning: "Chạy nhảy lên tàu nguy hiểm, xin đừng.", usageNote: "TUYỆT ĐỐI NG. 遅延 gây ra cho toàn line. Announcement nói hàng ngày. 次の電車: 2-5分 sau. Đừng chạy." },
        { word: "女性専用車両", reading: "じょせいせんようしゃりょう", meaning: "Toa dành cho nữ (women-only car)", jlptLevel: "N4", example: "朝のラッシュ時は女性専用車両があります。", exampleReading: "あさのラッシュじはじょせいせんようしゃりょうがあります。", exampleMeaning: "Giờ rush sáng có toa dành nữ.", usageNote: "時間限定 (rush hour only: ~9:30). Vị trí: đầu/cuối tàu (路線 khác nhau). 男性 vô = lỗi manner (không phạm pháp nhưng 注意). 小学生以下男児: OK. 障害者の介護者: OK." }
      ]
    }
  },
  {
    slug: "natural-disasters-prep-bag",
    moduleConfigId: M_LIFE,
    titleVi: "防災バッグ — Túi khẩn cấp",
    titleJa: "防災バッグの中身",
    descriptionVi: "Chuẩn bị túi khẩn cấp — danh sách đồ cần thiết.",
    recommendationReasonVi: "Nhật = thiên tai. 1 túi chuẩn bị sẵn = sống sót 3 ngày.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["disaster_prep", "emergency_bag", "survival"],
      contentGoal: "Biết cần gì trong túi khẩn cấp.",
      usageNote: "Essentials (3日分): 水 (3L/人/日), 食料 (缶詰, アルファ米, カロリーメイト), 懐中電灯, 電池/モバイルバッテリー, ラジオ, 救急セット, 常備薬, 現金 (小銭多め: 自販機), 身分証コピー, 携帯トイレ, 防寒シート, ホイッスル, マスク. 外国人追加: パスポートコピー, 在留カードコピー, 大使館連絡先, 翻訳カード.",
      japaneseExpressions: [
        { word: "非常持出袋", reading: "ひじょうもちだしぶくろ", meaning: "Túi mang theo khẩn cấp (emergency go-bag)", jlptLevel: "N3", example: "非常持出袋は玄関の近くに置きましょう。", exampleReading: "ひじょうもちだしぶくろはげんかんのちかくにおきましょう。", exampleMeaning: "Để túi khẩn cấp gần cửa chính.", usageNote: "= 防災リュック. Để: 玄関/寝室. 1人1袋. 半年に1回 中身 check (消期限, 電池). 買: Amazon '防災セット' 5000-15000¥ (ready-made)." },
        { word: "備蓄", reading: "びちく", meaning: "Dự trữ (stockpile — food/water for emergency)", jlptLevel: "N3", example: "最低3日分の水と食料を備蓄しましょう。", exampleReading: "さいていみっかぶんのみずとしょくりょうをびちくしましょう。", exampleMeaning: "Dự trữ nước + thức ăn ít nhất 3 ngày.", usageNote: "推奨: 7日分 (南海トラフ chuẩn bị). ローリングストック: mua → dùng → bổ sung (luân phiên: không để hết hạn). 置き場: 分散 (nhiều chỗ: 倒壊 1 chỗ vẫn còn chỗ khác)." },
        { word: "携帯トイレ", reading: "けいたいトイレ", meaning: "Toilet di động (portable toilet bag)", jlptLevel: "N4", example: "断水に備えて携帯トイレを用意してください。", exampleReading: "だんすいにそなえてけいたいトイレをよういしてください。", exampleMeaning: "Chuẩn bị toilet di động phòng mất nước.", usageNote: "Quan trọng nhưng hay QUÊN. 断水 = トイレ dùng不可. 1人5-7回/日 × 3日 = 15-20個. 100均 3-5個入. 凝固剤 (chất đông) + 袋. 黒い袋 (không thấy bên trong)." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🔶 Mixed batch 5b (entertainment/life)...");
  await runBatch(client, cards, "Mixed-5b");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
