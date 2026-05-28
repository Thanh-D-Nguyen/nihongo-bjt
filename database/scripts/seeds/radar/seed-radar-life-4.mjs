/**
 * Radar Seed: Life Expansion batch 4 (10 cards)
 * Topics: neighborhood associations, seasonal events, dating, post office, laundry, pets, hobbies
 * Run: node scripts/seed-radar-life-4.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_LIFE = MODULES.life_hack;
const M_HONNE = MODULES.honne_tatemae;
const M_WEATHER = MODULES.weather_japanese;

const cards = [
  {
    slug: "neighborhood-jichikai",
    moduleConfigId: M_HONNE,
    titleVi: "自治会・町内会 — Hội khu phố",
    titleJa: "自治会・町内会への参加",
    descriptionVi: "Hội khu phố Nhật — tham gia, hoạt động, từ chối.",
    recommendationReasonVi: "Sống Nhật lâu dài = gặp 自治会. Biết = hòa nhập + tránh conflict.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["community", "neighborhood", "social_integration"],
      contentGoal: "Biết 自治会 là gì + cách tham gia.",
      usageNote: "= Hội cư dân khu phố. Hoạt động: ゴミ当番 (trực rác), 回覧板 (bảng lưu hành), 防犯パトロール, 夏祭り, 防災訓練, 清掃. Phí: 200-500¥/月. Tham gia: 任意 (tự nguyện) nhưng không tham gia = hàng xóm judge. マンション: 管理組合 khác.",
      japaneseExpressions: [
        { word: "自治会", reading: "じちかい", meaning: "Hội tự quản (neighborhood association)", jlptLevel: "N3", example: "自治会の会費は月300円です。", exampleReading: "じちかいのかいひはつきさんびゃくえんです。", exampleMeaning: "Phí hội khu phố 300 yên/tháng.", usageNote: "= 町内会 (ちょうないかい). Tùy khu: lớn/nhỏ, active/relax. 加入率 giảm dần (đặc biệt 若者). Nhưng: 災害時 = mạng lưới hỗ trợ." },
        { word: "回覧板", reading: "かいらんばん", meaning: "Bảng lưu hành (circulating notice board)", jlptLevel: "N3", example: "回覧板を見たら次の家に回してください。", exampleReading: "かいらんばんをみたらつぎのいえにまわしてください。", exampleMeaning: "Xem bảng lưu hành xong chuyển nhà kế.", usageNote: "= clipboard kẹp thông báo, truyền từ nhà này sang nhà kia. Ký tên/đóng dấu xác nhận đã đọc. Nội dung: lịch thu gom, sự kiện, phòng cháy." },
        { word: "班長", reading: "はんちょう", meaning: "Trưởng nhóm khu phố (block leader — luân phiên)", jlptLevel: "N3", example: "今年はうちが班長の当番です。", exampleReading: "ことしはうちがはんちょうのとうばんです。", exampleMeaning: "Năm nay nhà mình trực trưởng nhóm.", usageNote: "Luân phiên (持ち回り). Việc: phát 回覧板, thu hội phí, liên lạc 自治会. 1年任期 (thường). Ngoại quốc: có thể giải thích 日本語苦手 → giảm bớt." }
      ]
    }
  },
  {
    slug: "seasonal-events-nenju-gyouji",
    moduleConfigId: M_WEATHER,
    titleVi: "年中行事 — Sự kiện theo mùa",
    titleJa: "日本の年中行事カレンダー",
    descriptionVi: "Lịch sự kiện Nhật quanh năm — biết để hòa nhập + vui.",
    recommendationReasonVi: "Văn hóa Nhật = theo MÙA. Biết = tham gia + chủ đề conversation.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["seasonal_events", "culture", "calendar"],
      contentGoal: "Biết sự kiện chính mỗi tháng ở Nhật.",
      usageNote: "1月: 正月, 成人式. 2月: 節分, バレンタイン. 3月: ひな祭り, 卒業式. 4月: 入学式, 花見. 5月: GW, こどもの日. 6月: 梅雨. 7月: 七夕, 夏祭り. 8月: お盆, 花火. 9月: お月見. 10月: ハロウィン, 運動会. 11月: 七五三. 12月: クリスマス, 忘年会, 大掃除.",
      japaneseExpressions: [
        { word: "お盆", reading: "おぼん", meaning: "Lễ Obon — về quê tưởng nhớ tổ tiên (mid-August)", jlptLevel: "N4", example: "お盆には実家に帰省する人が多いです。", exampleReading: "おぼんにはじっかにきせいするひとがおおいです。", exampleMeaning: "Obon nhiều người về quê.", usageNote: "8/13-16 (一部 7月). 帰省ラッシュ (đông đúc). 会社: 夏休み (3-5日). Tục: お墓参り, 盆踊り, 迎え火/送り火. = Tết Vu Lan VN." },
        { word: "花見", reading: "はなみ", meaning: "Ngắm hoa anh đào (cherry blossom viewing)", jlptLevel: "N4", example: "今年の花見は上野公園に行きましょう。", exampleReading: "ことしのはなみはうえのこうえんにいきましょう。", exampleMeaning: "Năm nay đi ngắm hoa ở công viên Ueno.", usageNote: "3月末-4月初 (地域差). 場所取り (giữ chỗ: đến sớm trải シート). Ăn uống dưới cây. 会社の花見 = nomikai ngoài trời. 開花予想 theo dõi trên news." },
        { word: "忘年会", reading: "ぼうねんかい", meaning: "Tiệc cuối năm (year-end party)", jlptLevel: "N4", example: "12月は忘年会の予約が取りにくいです。", exampleReading: "じゅうにがつはぼうねんかいのよやくがとりにくいです。", exampleMeaning: "Tháng 12 khó đặt chỗ 忘年会.", usageNote: "12月: 忘年会 season. 1月: 新年会. Company + friends + 趣味グループ. 幹事: đặt sớm (11月). 二次会 thường có." }
      ]
    }
  },
  {
    slug: "post-office-yuubinkyoku",
    moduleConfigId: M_LIFE,
    titleVi: "郵便局 — Bưu điện",
    titleJa: "郵便局の便利なサービス",
    descriptionVi: "Bưu điện Nhật — gửi EMS, ATM, 貯金, dịch vụ tiện lợi.",
    recommendationReasonVi: "Bưu điện = nhiều service hơn tưởng (ATM, bảo hiểm, tiết kiệm).",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["post_office", "mailing", "services"],
      contentGoal: "Biết dịch vụ bưu điện + cách gửi đồ về VN.",
      usageNote: "Gửi quốc tế: EMS (nhanh 3-5日), 航空便 (1-2週), SAL (2-3週, rẻ), 船便 (1-3月, rẻ nhất). ATM: ゆうちょ (miễn phí nhiều khung giờ), thẻ ngoại cũng rút được. Dịch vụ khác: ゆうちょ銀行 (tiết kiệm), かんぽ生命 (bảo hiểm), 不在票 → 再配達 (giao lại). App: ゆうパック予約.",
      japaneseExpressions: [
        { word: "書留", reading: "かきとめ", meaning: "Thư bảo đảm (registered mail)", jlptLevel: "N4", example: "大事な書類は書留で送りましょう。", exampleReading: "だいじなしょるいはかきとめでおくりましょう。", exampleMeaning: "Giấy tờ quan trọng gửi bảo đảm.", usageNote: "追跡 + 補償. 簡易書留: rẻ hơn (5万まで補償). 一般書留: 10万+ 補償. 現金書留: gửi tiền mặt (唯一合法 cách gửi tiền qua thư)." },
        { word: "不在票", reading: "ふざいひょう", meaning: "Phiếu vắng nhà (absence notice for delivery)", jlptLevel: "N4", example: "不在票があったので再配達を依頼しました。", exampleReading: "ふざいひょうがあったのでさいはいたつをいらいしました。", exampleMeaning: "Có phiếu vắng nên yêu cầu giao lại.", usageNote: "Không có nhà → postman để phiếu. 再配達: 電話, ネット, LINE. 時間指定 OK. 7日 不取 → trả lại. Tip: 宅配ボックス hoặc 置き配 (đặt cửa)." },
        { word: "ゆうパック", reading: "ゆうパック", meaning: "Bưu kiện bưu điện (Japan Post parcel service)", jlptLevel: "N4", example: "ゆうパックでお土産を実家に送りました。", exampleReading: "ゆうパックでおみやげをじっかにおくりました。", exampleMeaning: "Gửi quà về quê bằng ゆうパック.", usageNote: "Size: 60-170cm (3辺合計). Fee: tùy size + 距離 (800-2500¥). コンビニ (ローソン) cũng gửi được. 持込割引 120¥. Tracking online." }
      ]
    }
  },
  {
    slug: "laundry-tips-sentaku",
    moduleConfigId: M_LIFE,
    titleVi: "洗濯 — Giặt giũ ở Nhật",
    titleJa: "日本の洗濯事情とコツ",
    descriptionVi: "Giặt ở Nhật — máy giặt, phơi, coin laundry, mùa mưa.",
    recommendationReasonVi: "Khác VN: nước lạnh, phơi ban công, quy tắc chung cư.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["laundry", "daily_life", "apartment_rules"],
      contentGoal: "Biết cách giặt phơi đúng ở Nhật.",
      usageNote: "Máy: 縦型 (cửa trên, phổ biến) vs ドラム式 (cửa trước, đắt + sấy). Nước: LẠNH mặc định (tiết kiệm điện, 風呂の残り湯 tái sử dụng). Phơi: ベランダ (ban công), 部屋干し (trong nhà: 梅雨). Quy tắc chung cư: giặt 7-21時, không phơi ở hành lang chung. Coin laundry: 乾燥機 tiện 梅雨.",
      japaneseExpressions: [
        { word: "部屋干し", reading: "へやぼし", meaning: "Phơi trong nhà (indoor drying)", jlptLevel: "N4", example: "梅雨の時期は部屋干しが増えます。", exampleReading: "つゆのじきはへやぼしがふえます。", exampleMeaning: "Mùa mưa phơi trong nhà tăng.", usageNote: "Mùi: 部屋干し臭 (mùi khó chịu). 対策: 部屋干し用洗剤, 除湿機, サーキュレーター, 間隔あける (cách nhau). エアコン 除湿モード." },
        { word: "柔軟剤", reading: "じゅうなんざい", meaning: "Nước xả vải (fabric softener)", jlptLevel: "N4", example: "日本の柔軟剤はいい香りがします。", exampleReading: "にほんのじゅうなんざいはいいかおりがします。", exampleMeaning: "Nước xả Nhật thơm.", usageNote: "Popular: レノア, ソフラン, ハミング. 注意: 香害 (mùi quá mạnh → hàng xóm/đồng nghiệp 迷惑). 無香料 (không mùi) trend tăng. Dùng đúng lượng." },
        { word: "コインランドリー", reading: "コインランドリー", meaning: "Tiệm giặt tự phục vụ (coin laundry)", jlptLevel: "N4", example: "布団はコインランドリーの大型機で洗えます。", exampleReading: "ふとんはコインランドリーのおおがたきでああらえます。", exampleMeaning: "Chăn dùng máy lớn ở coin laundry giặt được.", usageNote: "Giặt: 200-500¥. Sấy: 100¥/10分. Máy lớn: chăn, thảm. 24時間 多い. 乾燥 = 梅雨 cứu tinh. 靴洗い機 (máy giặt giày) có ở một số tiệm." }
      ]
    }
  },
  {
    slug: "pet-ownership-japan",
    moduleConfigId: M_LIFE,
    titleVi: "ペット — Nuôi thú cưng",
    titleJa: "日本でペットを飼う時のルール",
    descriptionVi: "Nuôi pet ở Nhật — quy tắc chung cư, chi phí, đăng ký.",
    recommendationReasonVi: "Nhật yêu pet nhưng QUY TẮC nhiều. Vi phạm = đuổi khỏi nhà.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["pets", "apartment_rules", "registration"],
      contentGoal: "Biết quy tắc nuôi pet + chi phí ở Nhật.",
      usageNote: "Chung cư: ペット可 (cho phép) vs ペット不可 (cấm) — check KỸ hợp đồng. 犬: 登録 (市区町村) + 狂犬病予防注射 (bắt buộc yearly). 猫: 完全室内飼い (trong nhà only). Chi phí: 犬 30-50万/年, 猫 15-25万/年 (thức ăn, bệnh viện, bảo hiểm). Manner: 散歩 フン処理, 鳴き声 (tiếng kêu) chú ý.",
      japaneseExpressions: [
        { word: "ペット可", reading: "ペットか", meaning: "Cho phép nuôi pet (pets allowed)", jlptLevel: "N4", example: "ペット可の物件は家賃が少し高いです。", exampleReading: "ペットかのぶっけんはやちんがすこしたかいです。", exampleMeaning: "Nhà cho phép pet giá cao hơn chút.", usageNote: "Tìm: 不動産サイト filter 'ペット可/相談'. 敷金 +1ヶ月 (khử mùi fee). Loại/size giới hạn (小型犬のみ etc). ペット不可 mà nuôi = 強制退去 (đuổi)." },
        { word: "狂犬病予防注射", reading: "きょうけんびょうよぼうちゅうしゃ", meaning: "Tiêm phòng dại (rabies vaccination — bắt buộc cho chó)", jlptLevel: "N3", example: "毎年4月に狂犬病予防注射を受けさせます。", exampleReading: "まいとししがつにきょうけんびょうよぼうちゅうしゃをうけさせます。", exampleMeaning: "Tháng 4 hàng năm tiêm phòng dại.", usageNote: "法律 bắt buộc (狂犬病予防法). 年1回. 未接種: 20万 phạt. 集合注射 (4-6月: 会場) hoặc 動物病院. 鑑札 + 注射済票 = thẻ đeo cổ." },
        { word: "動物病院", reading: "どうぶつびょういん", meaning: "Bệnh viện thú y (veterinary hospital)", jlptLevel: "N4", example: "猫の具合が悪いので動物病院に連れて行きます。", exampleReading: "ねこのぐあいがわるいのでどうぶつびょういんにつれていきます。", exampleMeaning: "Mèo ốm nên mang đi bệnh viện thú.", usageNote: "KHÔNG có bảo hiểm quốc gia cho pet. ペット保険 (tư: 2000-5000¥/月). Khám 1 lần: 3000-10000¥. Phẫu thuật: 10-50万. 夜間救急: rất đắt." }
      ]
    }
  },
  {
    slug: "dating-culture-japan",
    moduleConfigId: M_HONNE,
    titleVi: "恋愛事情 — Yêu đương ở Nhật",
    titleJa: "日本の恋愛文化",
    descriptionVi: "Văn hóa hẹn hò Nhật — 告白, デート, apps, quốc tế.",
    recommendationReasonVi: "Sống Nhật = hiểu dating culture. Khác VN nhiều. Tránh hiểu lầm.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 158,
    metadata: {
      seed: true,
      skills: ["dating", "relationships", "culture"],
      contentGoal: "Hiểu dating culture Nhật + khác biệt.",
      usageNote: "Đặc trưng: 告白 (confession = chính thức thành couple). Trước 告白: 友達以上恋人未満 (hơn bạn, chưa người yêu). デート: AA制 (chia bill) trend tăng. App: Pairs, Omiai, Tinder, with. 国際恋愛: tăng. Lưu ý: 記念日 (anniversaries QUAN TRỌNG), ホワイトデー (3/14: đáp lễ Valentine).",
      japaneseExpressions: [
        { word: "告白", reading: "こくはく", meaning: "Tỏ tình (love confession — bước chính thức)", jlptLevel: "N3", example: "告白して付き合うことになりました。", exampleReading: "こくはくしてつきあうことになりました。", exampleMeaning: "Tỏ tình và bắt đầu hẹn hò.", usageNote: "Nhật: PHẢI 告白 mới thành couple chính thức. Câu: 「付き合ってください」(hãy hẹn hò với tôi). Không 告白 = 曖昧な関係 (mập mờ). Khác VN: rõ ràng hơn." },
        { word: "マッチングアプリ", reading: "マッチングアプリ", meaning: "App hẹn hò (matching/dating app)", jlptLevel: "N4", example: "最近はマッチングアプリで出会うカップルが多いです。", exampleReading: "さいきんはマッチングアプリであうカップルがおおいです。", exampleMeaning: "Gần đây nhiều cặp quen qua app hẹn hò.", usageNote: "Normal ở Nhật 2024 (không xấu hổ). Pairs (#1), with, Omiai = 真剣 (nghiêm túc). Tinder, Bumble = casual hơn. Phí: nam 3000-5000¥/月. 本人確認 bắt buộc." },
        { word: "記念日", reading: "きねんび", meaning: "Ngày kỷ niệm (anniversary)", jlptLevel: "N4", example: "付き合って1年の記念日にレストランを予約しました。", exampleReading: "つきあっていちねんのきねんびにレストランをよやくしました。", exampleMeaning: "Đặt nhà hàng kỷ niệm 1 năm yêu.", usageNote: "Nhật: 記念日 RẤT quan trọng. 毎月 (hàng tháng) celebrate ở đầu. 1年 = big. Quên = trouble. Gift + dinner = standard." }
      ]
    }
  },
  {
    slug: "public-library-toshokan",
    moduleConfigId: M_LIFE,
    titleVi: "図書館 — Thư viện công",
    titleJa: "図書館の活用法",
    descriptionVi: "Thư viện Nhật — mượn sách, ebooks, học tiếng, miễn phí.",
    recommendationReasonVi: "FREE + yên tĩnh + manga/DVD/CD mượn được. Learning resource tốt.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["library", "self_study", "free_resources"],
      contentGoal: "Biết cách dùng thư viện + nguồn học miễn phí.",
      usageNote: "Đăng ký: 利用カード (trong 市区町村 cư trú or làm việc). Mượn: 10-15冊, 2-4週間. Gia hạn: online/電話. Dịch vụ: 電子書籍 (ebooks), CD/DVD, 新聞 (đọc tại chỗ), WiFi, 学習室 (phòng học). 多文化コーナー: sách ngoại ngữ. 予約: online → SMS khi sẵn.",
      japaneseExpressions: [
        { word: "貸出", reading: "かしだし", meaning: "Cho mượn (lending/checkout)", jlptLevel: "N4", example: "この本は貸出中なので予約してください。", exampleReading: "このほんはかしだしちゅうなのでよやくしてください。", exampleMeaning: "Sách đang cho mượn, xin đặt trước.", usageNote: "貸出カウンター hoặc 自動貸出機. 返却: カウンター hoặc ブックポスト (ngoài giờ). 延滞 (trễ): không phạt tiền nhưng mượn bị khóa." },
        { word: "蔵書検索", reading: "ぞうしょけんさく", meaning: "Tìm kiếm sách trong thư viện (catalog search)", jlptLevel: "N3", example: "蔵書検索で読みたい本を探せます。", exampleReading: "ぞうしょけんさくでよみたいほんをさがせます。", exampleMeaning: "Tìm sách muốn đọc qua catalog search.", usageNote: "OPAC (online): tìm theo 書名, 著者, キーワード. 他館 (thư viện khác) cũng request được (相互貸借). カーリル (calil.jp): search TOÀN QUỐC." },
        { word: "読み聞かせ", reading: "よみきかせ", meaning: "Đọc truyện cho trẻ nghe (story time)", jlptLevel: "N4", example: "土曜日に子ども向けの読み聞かせがあります。", exampleReading: "どようびにこどもむけのよみきかせがあります。", exampleMeaning: "Thứ 7 có đọc truyện cho trẻ.", usageNote: "FREE event. 乳幼児 (0-3) + 幼児 (3-6). Tốt cho con nghe tiếng Nhật. おはなし会 cũng tương tự. 大人: 朗読会 (đọc sách lớn tiếng) cũng có." }
      ]
    }
  },
  {
    slug: "cycling-jitensha-life",
    moduleConfigId: M_LIFE,
    titleVi: "自転車生活 — Đạp xe ở Nhật",
    titleJa: "自転車のルールとマナー",
    descriptionVi: "Luật xe đạp Nhật — bắt buộc 2024, bảo hiểm, vi phạm.",
    recommendationReasonVi: "Xe đạp = phương tiện #1 cuộc sống. 2024: luật THAY ĐỔI LỚN.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["cycling", "traffic_rules", "daily_transport"],
      contentGoal: "Biết luật xe đạp + thay đổi 2024.",
      usageNote: "2024/11~: 罰則強化. Mũ: 努力義務 (2023: khuyến khích → sẽ bắt buộc). 保険: 多くの自治体 bắt buộc. Vi phạm: 酒酔い (say: 5年↓ or 100万), ながらスマホ (cầm ĐT: 6月↓), 信号無視, 逆走 (đi ngược). 防犯登録 (đăng ký chống trộm: 500-600¥, bắt buộc khi mua).",
      japaneseExpressions: [
        { word: "防犯登録", reading: "ぼうはんとうろく", meaning: "Đăng ký phòng trộm xe đạp (anti-theft registration)", jlptLevel: "N4", example: "自転車を買ったら防犯登録をしてください。", exampleReading: "じてんしゃをかったらぼうはんとうろくをしてください。", exampleMeaning: "Mua xe đạp thì đăng ký phòng trộm.", usageNote: "BẮT BUỘC (法律). Mua mới: cửa hàng làm luôn. Trung cổ: 自分 or 自転車屋. Không đăng ký: 警察 dừng → nghi trộm. Sticker dán khung xe." },
        { word: "ながら運転", reading: "ながらうんてん", meaning: "Vừa đi vừa (dùng ĐT/tai nghe khi lái)", jlptLevel: "N3", example: "ながらスマホで自転車に乗ると罰金です。", exampleReading: "ながらスマホでじてんしゃにのるとばっきんです。", exampleMeaning: "Vừa dùng ĐT vừa đạp xe bị phạt.", usageNote: "2024/11~: 罰則化. スマホ: 6月以下 or 10万. イヤホン: cũng NG (多くの自治体). 傘さし運転: NG. 2人乗り: 子供 OK (child seat), 大人2人 NG." },
        { word: "自転車保険", reading: "じてんしゃほけん", meaning: "Bảo hiểm xe đạp (bicycle insurance)", jlptLevel: "N4", example: "自転車保険への加入が義務化されました。", exampleReading: "じてんしゃほけんへのかにゅうがぎむかされました。", exampleMeaning: "Bắt buộc mua bảo hiểm xe đạp.", usageNote: "多くの都道府県: 義務. 費用: 1000-3000¥/年. Bồi thường: đâm người → 9500万 判決 (thật!). au, 楽天, コープ, TSマーク (整備+保険 set)." }
      ]
    }
  },
  {
    slug: "home-cooking-jisui",
    moduleConfigId: M_LIFE,
    titleVi: "自炊 — Tự nấu ăn ở Nhật",
    titleJa: "一人暮らしの自炊のコツ",
    descriptionVi: "Tự nấu ở Nhật — tiết kiệm, siêu thị, gia vị cơ bản.",
    recommendationReasonVi: "Tự nấu = tiết kiệm 3-5万/月. Biết trick Nhật = ngon + rẻ.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N5-N4",
    estimatedMinutes: 3,
    priority: 162,
    metadata: {
      seed: true,
      skills: ["cooking", "budgeting", "supermarket"],
      contentGoal: "Biết mẹo tự nấu + mua sắm tiết kiệm.",
      usageNote: "Gia vị cơ bản: さしすせそ (砂糖, 塩, 酢, 醤油, 味噌) + みりん, 料理酒, だしの素. Siêu thị: 閉店前 値引きシール (giảm giá 20-50%), 火曜市 (sale thứ 3), 業務スーパー (giá sỉ). Tiết kiệm: 作り置き (nấu trước), 冷凍保存, もやし/卵/豆腐 = thực phẩm rẻ nhất.",
      japaneseExpressions: [
        { word: "作り置き", reading: "つくりおき", meaning: "Nấu sẵn nhiều ngày (meal prep)", jlptLevel: "N4", example: "日曜日に1週間分の作り置きをします。", exampleReading: "にちようびにいっしゅうかんぶんのつくりおきをします。", exampleMeaning: "CN nấu sẵn cho cả tuần.", usageNote: "Trend: 時短 (tiết kiệm thời gian). 常備菜 (món thường trực): ひじき煮, きんぴら, 味玉, 漬物. Container: 100均 保存容器. Sách/YouTube: 作り置きレシピ rất nhiều." },
        { word: "値引きシール", reading: "ねびきシール", meaning: "Sticker giảm giá (discount sticker — cuối ngày)", jlptLevel: "N4", example: "閉店前に値引きシールが貼られます。", exampleReading: "へいてんまえにねびきシールがはられます。", exampleMeaning: "Trước đóng cửa dán sticker giảm giá.", usageNote: "半額 (nửa giá): 20-21時 (tùy siêu thị). 弁当, 刺身, パン = target. Timing: thử vài lần biết giờ. 見切り品コーナー: đồ sắp hết HSD riêng 1 kệ." },
        { word: "業務スーパー", reading: "ぎょうむスーパー", meaning: "Siêu thị sỉ (wholesale supermarket)", jlptLevel: "N4", example: "業務スーパーで冷凍野菜をまとめ買いします。", exampleReading: "ぎょうむスーパーでれいとうやさいをまとめがいします。", exampleMeaning: "Mua đông lạnh bulk ở 業務スーパー.", usageNote: "= 'Gyomu Super'. Size lớn, giá sỉ. 冷凍: ブロッコリー, 肉, 餃子 = best buy. 海外食品 nhiều (フォー, 調味料). Tip: 1kg入 = chia nhỏ 冷凍." }
      ]
    }
  },
  {
    slug: "smartphone-keitai-contracts",
    moduleConfigId: M_LIFE,
    titleVi: "携帯契約 — Hợp đồng điện thoại",
    titleJa: "スマホ契約の選び方",
    descriptionVi: "Chọn sim/carrier ở Nhật — 格安SIM, giải thích hợp đồng.",
    recommendationReasonVi: "Điện thoại = PHẢI CÓ. Chọn sai = mất 5000-10000¥/月 vô ích.",
    category: "life",
    visualTheme: "green_life",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["phone_contract", "budgeting", "telecom"],
      contentGoal: "Biết cách chọn carrier + tiết kiệm.",
      usageNote: "3 lớn: docomo, au, SoftBank (đắt: 7000-10000¥/月). Sub-brand: ahamo, povo, LINEMO (2000-3000¥). 格安SIM (MVNO): 楽天モバイル, IIJmio, mineo, 日本通信 (1000-2000¥). Ngoại quốc: cần 在留カード + 本人確認. 2年縛り (2-year lock) đã bỏ (2019~). MNP: chuyển số giữ lại.",
      japaneseExpressions: [
        { word: "格安SIM", reading: "かくやすシム", meaning: "SIM giá rẻ (budget SIM/MVNO)", jlptLevel: "N4", example: "格安SIMに変えたら月5000円節約できました。", exampleReading: "かくやすシムにかえたらつきごせんえんせつやくできました。", exampleMeaning: "Đổi SIM rẻ tiết kiệm 5000¥/tháng.", usageNote: "= MVNO (Mobile Virtual). Mượn mạng docomo/au/SoftBank. Rẻ: 1GB ~290¥, 20GB ~2000¥. Nhược: 昼 chậm (12-13時). Online sign-up. Recommend: 楽天 (unlimited ~3000¥)." },
        { word: "解約", reading: "かいやく", meaning: "Hủy hợp đồng (contract cancellation)", jlptLevel: "N3", example: "解約手数料は無料になりました。", exampleReading: "かいやくてすうりょうはむりょうになりました。", exampleMeaning: "Phí hủy hợp đồng đã miễn phí.", usageNote: "2022~: 解約金 0¥ (luật mới). MNP (chuyển mạng): ネット申請, 2-3日. 端末残債 (trả góp máy còn) vẫn phải trả. SIMロック解除: 無料 (2021~)." },
        { word: "データ通信量", reading: "データつうしんりょう", meaning: "Dung lượng data (mobile data allowance)", jlptLevel: "N4", example: "今月のデータ通信量がもう上限に達しました。", exampleReading: "こんげつのデータつうしんりょうがもうじょうげんにたっしました。", exampleMeaning: "Tháng này data đã hết.", usageNote: "Vượt: 速度制限 (giới hạn tốc độ: 128kbps-1Mbps). 追加購入: 550¥/1GB (đắt). Tip: WiFi活用, 動画 WiFiのみ. Check: My page app." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("🌱 Life Expansion batch 4...");
  await runBatch(client, cards, "Life-4");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
