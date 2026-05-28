/**
 * Radar Seed: Family & Education batch 3 (10 cards)
 * Topics: school system, bullying, cram school, teen life, maternity, childcare support
 * Run: node scripts/seed-radar-family-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M = MODULES.family_school;

const cards = [
  {
    slug: "japanese-school-system-overview",
    moduleConfigId: M,
    titleVi: "学校制度 — Hệ thống trường học Nhật",
    titleJa: "日本の学校制度",
    descriptionVi: "Tiểu học → trung học → cao đẳng/đại học. Hệ thống, kỳ học, từ vựng.",
    recommendationReasonVi: "Có con = phải hiểu hệ thống giáo dục Nhật. 6-3-3-4 là gì?",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["education_system", "school", "parenting"],
      contentGoal: "Hiểu cấu trúc 6-3-3-4, kỳ học, từ vựng trường học.",
      usageNote: "小学校 6年 → 中学校 3年 (nghĩa vụ) → 高校 3年 (98% đi) → 大学 4年. Kỳ: 1学期 4-7月, 2学期 9-12月, 3学期 1-3月. 入学式 4月, 卒業式 3月.",
      japaneseExpressions: [
        { word: "義務教育", reading: "ぎむきょういく", meaning: "Giáo dục bắt buộc (6+3=9 năm)", jlptLevel: "N3", example: "日本の義務教育は小学校6年と中学校3年です。", exampleReading: "にほんのぎむきょういくはしょうがっこうろくねんとちゅうがっこうさんねんです。", exampleMeaning: "Giáo dục bắt buộc ở Nhật là 6 năm tiểu học + 3 năm THCS.", usageNote: "Free. Sách giáo khoa free. Bắt buộc cho cả người nước ngoài cư trú." },
        { word: "入学式", reading: "にゅうがくしき", meaning: "Lễ nhập học (entrance ceremony — 4月)", jlptLevel: "N4", example: "4月に入学式があるので、スーツを買いました。", exampleReading: "しがつににゅうがくしきがあるので、スーツをかいました。", exampleMeaning: "Tháng 4 có lễ nhập học nên mua suit.", usageNote: "Trang trọng. Cha mẹ mặc suit/formal. Con: ランドセル (cặp sách) mới. 写真撮影 = bắt buộc." },
        { word: "学童保育", reading: "がくどうほいく", meaning: "After-school care (trông trẻ sau giờ học)", jlptLevel: "N3", example: "共働きなので、子どもは学童保育に通っています。", exampleReading: "ともばたらきなので、こどもはがくどうほいくにかよっています。", exampleMeaning: "Cả hai vợ chồng đi làm nên con đi after-school.", usageNote: "小1-6. 放課後~18-19時. Phí: 5000-15000¥/月. Đăng ký qua 市役所. Đợi list nếu đông." },
        { word: "通知表", reading: "つうちひょう", meaning: "Phiếu đánh giá học lực (report card)", jlptLevel: "N3", example: "学期末に通知表をもらいます。", exampleReading: "がっきまつにつうちひょうをもらいます。", exampleMeaning: "Cuối kỳ nhận phiếu đánh giá.", usageNote: "Mỗi kỳ 1 lần. 3段階 hoặc 5段階 đánh giá. Cha mẹ ký 印鑑 rồi trả lại. 所見 (nhận xét) = cô viết." }
      ]
    }
  },
  {
    slug: "school-lunch-kyushoku",
    moduleConfigId: M,
    titleVi: "給食 — Bữa trưa trường học",
    titleJa: "学校の給食制度",
    descriptionVi: "Hệ thống cơm trưa trường Nhật — dinh dưỡng, phí, dị ứng.",
    recommendationReasonVi: "給食 = tự hào giáo dục Nhật. Con bạn ăn gì mỗi ngày?",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["school_lunch", "nutrition", "allergy"],
      contentGoal: "Biết hệ thống 給食 + cách xử lý dị ứng.",
      usageNote: "小中学校: hầu hết có 給食. Phí: 4000-5000¥/月. Menu: dinh dưỡng sĩ lên. Con tự phục vụ (当番). Dị ứng: khai báo → menu riêng.",
      japaneseExpressions: [
        { word: "給食", reading: "きゅうしょく", meaning: "Bữa trưa trường (school lunch — chuẩn dinh dưỡng)", jlptLevel: "N4", example: "うちの子は給食が大好きです。", exampleReading: "うちのこはきゅうしょくがだいすきです。", exampleMeaning: "Con tôi rất thích cơm trưa trường.", usageNote: "Cân bằng: 主食 (cơm/bánh mì) + 主菜 (protein) + 副菜 (rau) + 牛乳. ~600kcal." },
        { word: "給食当番", reading: "きゅうしょくとうばん", meaning: "Trực bữa trưa (phục vụ đồ ăn)", jlptLevel: "N4", example: "今週は給食当番なので、白衣を洗ってください。", exampleReading: "こんしゅうはきゅうしょくとうばんなので、はくいをあらってください。", exampleMeaning: "Tuần này trực bữa trưa, giặt áo trắng nhé.", usageNote: "Luân phiên. Mặc 白衣+帽子. Múc đồ ăn cho bạn. Trách nhiệm + cooperation." },
        { word: "食物アレルギー", reading: "しょくもつアレルギー", meaning: "Dị ứng thực phẩm (food allergy)", jlptLevel: "N3", example: "食物アレルギーがある場合は、事前に学校に連絡してください。", exampleReading: "しょくもつアレルギーがあるばあいは、じぜんにがっこうにれんらくしてください。", exampleMeaning: "Nếu có dị ứng thực phẩm, liên hệ trường trước.", usageNote: "Khai báo lúc nhập học. Cung cấp 診断書 (giấy bác sĩ). Trường chuẩn bị menu riêng hoặc bento." }
      ]
    }
  },
  {
    slug: "juku-cram-school",
    moduleConfigId: M,
    titleVi: "塾 — Học thêm (Juku)",
    titleJa: "塾の選び方と費用",
    descriptionVi: "Hệ thống học thêm ở Nhật — loại, phí, khi nào nên cho con đi.",
    recommendationReasonVi: "70% học sinh Nhật đi 塾. Hiểu = quyết định đúng cho con.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["education", "cram_school", "exam_prep"],
      contentGoal: "Biết loại 塾, chi phí, khi nào nên đăng ký.",
      usageNote: "Loại: 補習塾 (bổ trợ, theo kịp trường), 進学塾 (thi vào trường top). Phí: 20,000-50,000¥/月. Bắt đầu: 小4 (thi中学受験) hoặc 中1 (thi高校受験). 大手: SAPIX, 日能研, 早稲田アカデミー.",
      japaneseExpressions: [
        { word: "塾", reading: "じゅく", meaning: "Lớp học thêm (cram school)", jlptLevel: "N4", example: "息子は週3回塾に通っています。", exampleReading: "むすこはしゅうさんかいじゅくにかよっています。", exampleMeaning: "Con trai đi học thêm 3 lần/tuần.", usageNote: "Sau giờ học: 17-21時. 送迎 (đưa đón) = cha mẹ. 夏期講習 (summer intensive) = thêm phí." },
        { word: "受験", reading: "じゅけん", meaning: "Thi tuyển sinh (entrance exam)", jlptLevel: "N3", example: "来年は高校受験なので、塾を増やしました。", exampleReading: "らいねんはこうこうじゅけんなので、じゅくをふやしました。", exampleMeaning: "Năm sau thi cấp 3 nên tăng lớp học thêm.", usageNote: "中学受験 (小6→私立中): khó nhất. 高校受験 (中3→高校): phổ biến. 大学受験: 共通テスト + 二次試験." },
        { word: "偏差値", reading: "へんさち", meaning: "Điểm chuẩn/deviation (xếp hạng trường)", jlptLevel: "N2", example: "この高校の偏差値は65です。", exampleReading: "このこうこうのへんさちはろくじゅうごです。", exampleMeaning: "Trường cấp 3 này điểm chuẩn 65.", usageNote: "50=trung bình. 60+=khá. 70+=top. Dùng xếp hạng trường + đánh giá năng lực học sinh." }
      ]
    }
  },
  {
    slug: "ijime-bullying-awareness",
    moduleConfigId: M,
    titleVi: "いじめ — Bắt nạt học đường",
    titleJa: "いじめの対処法",
    descriptionVi: "Nhận biết + xử lý bắt nạt — dấu hiệu, nơi tư vấn, hành động.",
    recommendationReasonVi: "Con người nước ngoài = rủi ro cao hơn. Biết dấu hiệu + kênh hỗ trợ.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 195,
    metadata: {
      seed: true,
      skills: ["bullying", "child_protection", "school_counseling"],
      contentGoal: "Nhận biết dấu hiệu + biết kênh hỗ trợ chống bắt nạt.",
      usageNote: "Dấu hiệu: 学校に行きたくない, đồ bị mất/hỏng, thương tích không giải thích. Kênh: 担任の先生, スクールカウンセラー, 教育委員会, いじめ相談ダイヤル (0120-0-78310). KHÔNG im lặng.",
      japaneseExpressions: [
        { word: "いじめ", reading: "いじめ", meaning: "Bắt nạt (bullying)", jlptLevel: "N3", example: "いじめを見たら、すぐに先生に報告してください。", exampleReading: "いじめをみたら、すぐにせんせいにほうこくしてください。", exampleMeaning: "Thấy bắt nạt, báo cô giáo ngay.", usageNote: "Nhật: 無視 (phớt lờ), 仲間はずれ (loại ra), SNSいじめ (cyberbullying) phổ biến." },
        { word: "不登校", reading: "ふとうこう", meaning: "Không đi học (school refusal/truancy)", jlptLevel: "N2", example: "いじめが原因で不登校になる子どもが増えています。", exampleReading: "いじめがげんいんでふとうこうになるこどもがふえています。", exampleMeaning: "Trẻ bỏ học do bị bắt nạt ngày càng nhiều.", usageNote: "30日/年以上 nghỉ = 不登校 chính thức. 2023: 30万人. Giải pháp: フリースクール, 適応指導教室." },
        { word: "スクールカウンセラー", reading: "スクールカウンセラー", meaning: "Tư vấn viên trường (school counselor)", jlptLevel: "N3", example: "スクールカウンセラーに相談することができます。", exampleReading: "スクールカウンセラーにそうだんすることができます。", exampleMeaning: "Có thể tư vấn với counselor trường.", usageNote: "Tuần 1-2 ngày ở trường. Miễn phí. Bảo mật. Đặt lịch qua 担任 hoặc 保健室." }
      ]
    }
  },
  {
    slug: "maternity-leave-pregnancy",
    moduleConfigId: M,
    titleVi: "産休・妊娠 — Nghỉ thai sản",
    titleJa: "妊娠から産休までの手続き",
    descriptionVi: "Mang thai ở Nhật — khám, thủ tục, nghỉ thai sản, tiền hỗ trợ.",
    recommendationReasonVi: "Mang thai ở Nhật = nhiều hỗ trợ. Nhưng phải biết XIN.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["pregnancy", "maternity_leave", "healthcare"],
      contentGoal: "Biết quy trình mang thai ở Nhật + các khoản hỗ trợ.",
      usageNote: "Bước: 妊娠判明 → 産婦人科 → 母子手帳 (quận) → 妊婦健診 (14回 hỗ trợ) → 産休 (6週前~8週sau) → 育休 (1年). Tiền: 出産一時金 50万円 (2023~), 出産手当金 (67% lương), 育児休業給付金.",
      japaneseExpressions: [
        { word: "母子手帳", reading: "ぼしてちょう", meaning: "Sổ tay mẹ con (maternal-child health handbook)", jlptLevel: "N3", example: "妊娠がわかったら、役所で母子手帳をもらいます。", exampleReading: "にんしんがわかったら、やくしょでぼしてちょうをもらいます。", exampleMeaning: "Biết có thai thì ra phường lấy sổ tay mẹ con.", usageNote: "QUAN TRỌNG: ghi toàn bộ sức khỏe mẹ + bé. Mang đi khám luôn. Có bản tiếng Anh/Việt ở một số quận." },
        { word: "出産一時金", reading: "しゅっさんいちじきん", meaning: "Trợ cấp sinh con 1 lần (500,000¥)", jlptLevel: "N2", example: "出産一時金は50万円支給されます。", exampleReading: "しゅっさんいちじきんはごじゅうまんえんしきゅうされます。", exampleMeaning: "Trợ cấp sinh con được 50 vạn yên.", usageNote: "2023: tăng 42→50万円. Bệnh viện trừ trực tiếp (直接支払制度). Chi phí sinh: 40-70万 tùy nơi." },
        { word: "産前産後休業", reading: "さんぜんさんごきゅうぎょう", meaning: "Nghỉ trước+sau sinh (maternity leave)", jlptLevel: "N2", example: "産前6週間、産後8週間の休業が取れます。", exampleReading: "さんぜんろくしゅうかん、さんごはっしゅうかんのきゅうぎょうがとれます。", exampleMeaning: "Nghỉ 6 tuần trước sinh, 8 tuần sau sinh.", usageNote: "産前: 6週 (任意). 産後: 8週 (BẮT BUỘC nghỉ 6週, ý muốn thì 8週). Sau: 育休 tiếp nối." }
      ]
    }
  },
  {
    slug: "hoikuen-nursery-waiting",
    moduleConfigId: M,
    titleVi: "保活 — Xin nhà trẻ (chiến dịch!)",
    titleJa: "保育園に入るための保活",
    descriptionVi: "Bí quyết xin 保育園 ở Nhật — điểm, thời gian, chiến lược.",
    recommendationReasonVi: "待機児童 = ác mộng. Biết 保活 strategy = tăng cơ hội.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 188,
    metadata: {
      seed: true,
      skills: ["childcare", "nursery", "application_strategy"],
      contentGoal: "Biết cách 保活 hiệu quả — điểm số + chiến lược.",
      usageNote: "保活 = 保育園活動 (hoạt động xin nhà trẻ). Hệ thống điểm: 共働き (cả 2 đi làm fulltime) = max điểm. Thời gian: 10-11月 nộp đơn → 2月 kết quả. Không đậu = 不承諾通知 → 育休 kéo dài.",
      japaneseExpressions: [
        { word: "保育園", reading: "ほいくえん", meaning: "Nhà trẻ (nursery — 0-5 tuổi, cả ngày)", jlptLevel: "N4", example: "来年4月から保育園に入れたいです。", exampleReading: "らいねんしがつからほいくえんにいれたいです。", exampleMeaning: "Muốn cho vào nhà trẻ từ tháng 4 năm sau.", usageNote: "認可 (公立/quận): rẻ, chất lượng. 認可外 (tư nhân): đắt hơn, dễ vào. 幼稚園 = khác (3-5 tuổi, nửa ngày)." },
        { word: "待機児童", reading: "たいきじどう", meaning: "Trẻ chờ nhà trẻ (waiting list child)", jlptLevel: "N2", example: "この地域は待機児童が多いので、早めに申し込みましょう。", exampleReading: "このちいきはたいきじどうがおおいので、はやめにもうしこみましょう。", exampleMeaning: "Khu này nhiều trẻ chờ, nộp đơn sớm.", usageNote: "Tokyo 23区: vẫn khó. Giải pháp: 認可外 / 小規模保育 / 引っ越し (chuyển nhà đến khu ít cạnh tranh)." },
        { word: "点数", reading: "てんすう", meaning: "Điểm (selection criteria points)", jlptLevel: "N4", example: "フルタイム共働きだと点数が高くなります。", exampleReading: "フルタイムともばたらきだとてんすうがたかくなります。", exampleMeaning: "Cả 2 full-time thì điểm cao.", usageNote: "各区 khác nhau. Cha+mẹ fulltime=基準点. Bonus: 兄弟加点, 祖父母遠方. Check区のホームページ." }
      ]
    }
  },
  {
    slug: "childrens-day-events",
    moduleConfigId: M,
    titleVi: "子どもの行事 — Sự kiện theo tuổi",
    titleJa: "子どもの年中行事",
    descriptionVi: "Các sự kiện quan trọng theo tuổi con — Shichi-Go-San, nhập học, thành nhân.",
    recommendationReasonVi: "Mỗi tuổi có sự kiện. Biết = chuẩn bị đúng + tham gia cộng đồng.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 158,
    metadata: {
      seed: true,
      skills: ["traditions", "childrens_events", "seasonal"],
      contentGoal: "Biết các sự kiện quan trọng theo tuổi con ở Nhật.",
      usageNote: "お宮参り (30日), お食い初め (100日), 初節句 (năm đầu), 七五三 (3,5,7 tuổi), 入学式 (6 tuổi), 成人式 (20 tuổi→18 tuổi 2022~).",
      japaneseExpressions: [
        { word: "七五三", reading: "しちごさん", meaning: "Lễ 7-5-3 (mừng trẻ 3,5,7 tuổi ở đền)", jlptLevel: "N3", example: "11月に七五三のお参りに行きます。", exampleReading: "じゅういちがつにしちごさんのおまいりにいきます。", exampleMeaning: "Tháng 11 đi lễ Shichi-Go-San.", usageNote: "11/15 (nhưng 10-11月 OK). Mặc 着物 (kimono) or formal. 千歳飴 (kẹo trường thọ). Thuê kimono: 10,000-30,000¥. Chụp ảnh studio: 30,000-100,000¥." },
        { word: "お宮参り", reading: "おみやまいり", meaning: "Lễ đền đầu tiên (sinh ~30 ngày)", jlptLevel: "N3", example: "生後1か月でお宮参りに行きました。", exampleReading: "せいごいっかげつでおみやまいりにいきました。", exampleMeaning: "Sinh 1 tháng đi lễ đền lần đầu.", usageNote: "初宮参り. Cảm ơn thần + cầu sức khỏe. Bé mặc 白い着物. 初穂料: 5000-10,000¥." },
        { word: "成人式", reading: "せいじんしき", meaning: "Lễ thành nhân (coming-of-age ceremony)", jlptLevel: "N3", example: "成人式で久しぶりに同級生に会えました。", exampleReading: "せいじんしきでひさしぶりにどうきゅうせいにあえました。", exampleMeaning: "Lễ thành nhân gặp lại bạn cũ.", usageNote: "1月第2月曜 (祝日). 2022~: 18歳成人 nhưng lễ vẫn 20歳 ở nhiều nơi. 振袖 (kimono nữ): thuê 100,000-300,000¥!" }
      ]
    }
  },
  {
    slug: "homework-study-support",
    moduleConfigId: M,
    titleVi: "宿題 — Hỗ trợ bài tập ở nhà",
    titleJa: "子どもの宿題サポート",
    descriptionVi: "Loại bài tập + cách hỗ trợ con khi cha mẹ không giỏi tiếng Nhật.",
    recommendationReasonVi: "Con cần help bài tập. Cha mẹ nước ngoài = khó. Biết cách hỗ trợ.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 162,
    metadata: {
      seed: true,
      skills: ["homework", "study_support", "parenting"],
      contentGoal: "Biết loại bài tập + cách hỗ trợ con khi tiếng Nhật chưa giỏi.",
      usageNote: "Loại: 漢字ドリル (luyện kanji), 計算ドリル (toán), 音読 (đọc to), 日記 (nhật ký), 自由研究 (summer project). Tip: 音読カード (ký mỗi ngày), Google Translate giúp hiểu đề.",
      japaneseExpressions: [
        { word: "音読", reading: "おんどく", meaning: "Đọc to (reading aloud — bài tập hàng ngày)", jlptLevel: "N4", example: "毎日音読の宿題があるので、聞いてサインしてください。", exampleReading: "まいにちおんどくのしゅくだいがあるので、きいてサインしてください。", exampleMeaning: "Mỗi ngày có bài đọc to, nghe xong ký tên.", usageNote: "Con đọc → cha mẹ nghe → ký 音読カード. Không cần hiểu 100% — chỉ cần nghe + ký." },
        { word: "自由研究", reading: "じゆうけんきゅう", meaning: "Nghiên cứu tự do (summer homework project)", jlptLevel: "N3", example: "夏休みの自由研究のテーマを決めないと。", exampleReading: "なつやすみのじゆうけんきゅうのテーマをきめないと。", exampleMeaning: "Phải chọn đề tài nghiên cứu tự do hè.", usageNote: "Hè: bài tập LỚN. Con chọn đề tài → nghiên cứu → viết/làm mô hình. Cha mẹ help = OK. YouTube có nhiều ideas." },
        { word: "漢字ドリル", reading: "かんじドリル", meaning: "Vở tập kanji (kanji workbook)", jlptLevel: "N4", example: "漢字ドリルを3ページやってから遊んでね。", exampleReading: "かんじドリルをさんページやってからあそんでね。", exampleMeaning: "Làm 3 trang vở kanji xong mới chơi.", usageNote: "Mỗi ngày 1-2 trang. 小1: 80字, 小6: 181字 (total 1006字). Con biết kanji hơn cha mẹ = bình thường!" }
      ]
    }
  },
  {
    slug: "school-supplies-shopping",
    moduleConfigId: M,
    titleVi: "入学準備 — Mua đồ nhập học",
    titleJa: "入学準備の買い物リスト",
    descriptionVi: "Danh sách đồ dùng học tập cần mua — ランドセル, 文房具, 体操着.",
    recommendationReasonVi: "Nhập học = mua NHIỀU đồ + quy tắc riêng. Biết trước = không bỡ ngỡ.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 158,
    metadata: {
      seed: true,
      skills: ["school_supplies", "shopping", "preparation"],
      contentGoal: "Biết cần mua gì cho con nhập học + quy cách.",
      usageNote: "Bắt buộc: ランドセル (40,000-70,000¥ — mua 1 năm trước!), 体操着 (đồ thể dục), 上履き (giày trong nhà), 防災頭巾 (mũ chống thảm họa), 文房具 (theo quy định trường). Tên: MỌI THỨ ghi tên (お名前シール/スタンプ).",
      japaneseExpressions: [
        { word: "ランドセル", reading: "ランドセル", meaning: "Cặp sách tiểu học (leather backpack — 6 năm dùng)", jlptLevel: "N4", example: "ランドセルは年中さんのうちに予約した方がいいですよ。", exampleReading: "ランドセルはねんちゅうさんのうちによやくしたほうがいいですよ。", exampleMeaning: "Nên đặt ランドセル từ lúc con 4 tuổi.", usageNote: "ラン活: việc chọn mua ランドセル. Bắt đầu 4月 năm trước. Màu: xưa 赤/黒, giờ tự do. 6年保証." },
        { word: "上履き", reading: "うわばき", meaning: "Giày đi trong trường (indoor shoes)", jlptLevel: "N4", example: "上履きのサイズが小さくなったので、新しいのを買います。", exampleReading: "うわばきのサイズがちいさくなったので、あたらしいのをかいます。", exampleMeaning: "Giày trong trường nhỏ rồi nên mua mới.", usageNote: "Trắng. Ghi tên. Mỗi tuần mang về giặt (金曜). 1000-2000¥. Mua ở shoe shop hoặc AEON." },
        { word: "お名前シール", reading: "おなまえシール", meaning: "Sticker dán tên (name labels cho đồ dùng)", jlptLevel: "N4", example: "入学前にお名前シールを全部の持ち物に貼りました。", exampleReading: "にゅうがくまえにおなまえシールをぜんぶのもちものにはりました。", exampleMeaning: "Trước nhập học dán sticker tên lên tất cả đồ.", usageNote: "MỌI THỨ phải có tên: bút, tẩy, cặp, áo, giày, hộp cơm. お名前スタンプ (stamp) tiện hơn. 1000-3000¥ bộ." }
      ]
    }
  },
  {
    slug: "teen-smartphone-rules",
    moduleConfigId: M,
    titleVi: "スマホルール — Quản lý điện thoại con",
    titleJa: "子どものスマホルール",
    descriptionVi: "Khi nào mua ĐT cho con, cài đặt giới hạn, từ vựng liên quan.",
    recommendationReasonVi: "Con đòi smartphone? Biết cách quản lý = an toàn + hòa bình.",
    category: "family",
    visualTheme: "rose_family",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 155,
    metadata: {
      seed: true,
      skills: ["parenting", "digital_literacy", "smartphone"],
      contentGoal: "Biết khi nào + cách quản lý smartphone cho con.",
      usageNote: "Trung bình: 小学高学年~中1 mua. フィルタリング (18歳未満: BẮT BUỘC theo luật). 利用時間制限 (giới hạn giờ): Screen Time / Google Family Link. ルール作り: cùng con viết quy tắc (食事中✗, 夜10時まで).",
      japaneseExpressions: [
        { word: "フィルタリング", reading: "フィルタリング", meaning: "Lọc nội dung (content filtering — luật bắt buộc <18)", jlptLevel: "N3", example: "18歳未満はフィルタリングの設定が義務付けられています。", exampleReading: "じゅうはっさいみまんはフィルタリングのせっていがぎむづけられています。", exampleMeaning: "Dưới 18 tuổi bắt buộc cài bộ lọc.", usageNote: "Cửa hàng ĐT cài lúc mua. Giải trừ: cha mẹ viết 申出書. Loại: SNS制限, アダルト制限." },
        { word: "利用時間", reading: "りようじかん", meaning: "Thời gian sử dụng (screen time)", jlptLevel: "N4", example: "スマホの利用時間は1日2時間までにしましょう。", exampleReading: "スマホのりようじかんはいちにちにじかんまでにしましょう。", exampleMeaning: "Dùng ĐT tối đa 2 tiếng/ngày.", usageNote: "平均: 中学生 4時間/日 (!). Recommend: 1-2h. 設定 → スクリーンタイム で制限." },
        { word: "ネットいじめ", reading: "ネットいじめ", meaning: "Bắt nạt qua mạng (cyberbullying)", jlptLevel: "N3", example: "ネットいじめに遭ったら、すぐに親に相談してね。", exampleReading: "ネットいじめにあったら、すぐにおやにそうだんしてね。", exampleMeaning: "Bị bắt nạt online thì nói cha mẹ ngay.", usageNote: "LINE group外し, 悪口投稿, 写真拡散. スクショ保存 → 学校/警察に相談." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("👨‍👩‍👧 Family/Education batch 3...");
  await runBatch(client, cards, "Family-Education-3");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
