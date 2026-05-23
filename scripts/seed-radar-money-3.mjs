/**
 * Radar Seed: Money & Finance batch 3 (10 cards)
 * Topics: tax, retirement, credit cards, budgeting, furusato nozei, side income
 * Run: node scripts/seed-radar-money-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M = MODULES.market_watch;

const cards = [
  {
    slug: "furusato-nozei-tax",
    moduleConfigId: M,
    titleVi: "ふるさと納税 — Đóng thuế quê hương",
    titleJa: "ふるさと納税の仕組みと申請",
    descriptionVi: "Hệ thống đóng thuế cho địa phương — nhận quà, giảm thuế.",
    recommendationReasonVi: "Furusato nozei = hack thuế hợp pháp. Đóng → nhận quà + giảm thuế năm sau.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["tax_optimization", "furusato_nozei", "finance"],
      contentGoal: "Hiểu cách dùng ふるさと納税 để tiết kiệm thuế.",
      usageNote: "Cơ chế: đóng thuế cho thành phố khác → nhận 返礼品 (quà, thường 30% giá trị) → năm sau giảm 住民税. Limit: tùy thu nhập (simulation trên site). Site: ふるなび, さとふる, 楽天ふるさと納税. ワンストップ特例: 5 nơi以下 + salaryman → không cần 確定申告.",
      japaneseExpressions: [
        { word: "返礼品", reading: "へんれいひん", meaning: "Quà đáp lễ (thank-you gift from municipality)", jlptLevel: "N2", example: "返礼品で和牛やお米をもらいました。", exampleReading: "へんれいひんでわぎゅうやおこめをもらいました。", exampleMeaning: "Nhận quà wagyu và gạo từ furusato nozei.", usageNote: "Phổ biến: 和牛, 海鮮, 米, フルーツ. Trị giá 30% đóng. 10,000¥ đóng → 3000¥ quà." },
        { word: "寄付金控除", reading: "きふきんこうじょ", meaning: "Khấu trừ thuế từ đóng góp (donation tax deduction)", jlptLevel: "N2", example: "ふるさと納税は寄付金控除として税金が安くなります。", exampleReading: "ふるさとのうぜいはきふきんこうじょとしてぜいきんがやすくなります。", exampleMeaning: "Furusato nozei giảm thuế qua khấu trừ đóng góp.", usageNote: "自己負担: 2000¥ (cố định). Còn lại: giảm 住民税+所得税 năm sau." },
        { word: "ワンストップ特例", reading: "ワンストップとくれい", meaning: "Đơn giản hóa thủ tục (simplified filing)", jlptLevel: "N2", example: "ワンストップ特例を使えば確定申告は不要です。", exampleReading: "ワンストップとくれいをつかえばかくていしんこくはふようです。", exampleMeaning: "Dùng one-stop thì không cần khai thuế.", usageNote: "Điều kiện: ≤5 nơi + không cần 確定申告 (salaryman). Gửi form về nơi đóng. Deadline: 1/10 năm sau." }
      ]
    }
  },
  {
    slug: "credit-card-japan-guide",
    moduleConfigId: M,
    titleVi: "クレジットカード — Thẻ tín dụng Nhật",
    titleJa: "クレジットカードの選び方",
    descriptionVi: "Chọn thẻ, điểm thưởng, lưu ý cho người nước ngoài.",
    recommendationReasonVi: "Cashless = trend. Thẻ tín dụng = tích điểm + tiện. Biết chọn đúng.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["credit_card", "cashless", "points"],
      contentGoal: "Biết cách chọn thẻ tín dụng + tích điểm hiệu quả.",
      usageNote: "Người nước ngoài: khó xin ban đầu. Dễ nhất: 楽天カード (審査ゆるい). Recommend: 年会費無料 + ポイント還元1%+. Big 3: 楽天, PayPayカード, dカード. 海外キャッシング (rút tiền nước ngoài) = tiện.",
      japaneseExpressions: [
        { word: "年会費", reading: "ねんかいひ", meaning: "Phí thường niên (annual fee)", jlptLevel: "N3", example: "このカードは年会費永年無料です。", exampleReading: "このカードはねんかいひえいねんむりょうです。", exampleMeaning: "Thẻ này miễn phí thường niên vĩnh viễn.", usageNote: "無料 = tốt nhất cho đầu. Gold: 5000-10,000¥/年 (lounge, bảo hiểm du lịch)." },
        { word: "ポイント還元", reading: "ポイントかんげん", meaning: "Hoàn điểm (points cashback)", jlptLevel: "N3", example: "ポイント還元率が高いカードを選びましょう。", exampleReading: "ポイントかんげんりつがたかいカードをえらびましょう。", exampleMeaning: "Chọn thẻ tỷ lệ hoàn điểm cao.", usageNote: "1% = chuẩn. 1.5-2% = tốt. 楽天市場: 楽天カード = 3%+. PayPay: PayPayカード best." },
        { word: "審査", reading: "しんさ", meaning: "Xét duyệt (credit screening)", jlptLevel: "N3", example: "クレジットカードの審査に通るか心配です。", exampleReading: "クレジットカードのしんさにとおるかしんぱいです。", exampleMeaning: "Lo không qua được xét duyệt thẻ.", usageNote: "Người nước ngoài: cần 在留カード + 日本の銀行口座 + 収入証明. Tip: 楽天 dễ nhất. 2枚目以降 = dễ hơn." }
      ]
    }
  },
  {
    slug: "nenkin-pension-system",
    moduleConfigId: M,
    titleVi: "年金 — Hệ thống lương hưu",
    titleJa: "年金制度の基礎知識",
    descriptionVi: "Lương hưu Nhật — ai đóng, bao nhiêu, rút khi về nước.",
    recommendationReasonVi: "Đóng 年金 mỗi tháng. Biết cách = rút khi về nước hoặc nhận khi già.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 182,
    metadata: {
      seed: true,
      skills: ["pension", "retirement", "social_insurance"],
      contentGoal: "Hiểu hệ thống 年金 + quyền lợi người nước ngoài.",
      usageNote: "Loại: 国民年金 (tất cả 20-59 tuổi, 16,980¥/月 2024) + 厚生年金 (salaryman, trừ lương). Nhận: 65歳~, đóng ≥10年. Người nước ngoài về nước: 脱退一時金 (refund, max 5年分). Xin: trong 2年 sau khi rời Nhật.",
      japaneseExpressions: [
        { word: "国民年金", reading: "こくみんねんきん", meaning: "Lương hưu quốc dân (basic pension — AI đóng)", jlptLevel: "N3", example: "20歳になったら国民年金に加入する義務があります。", exampleReading: "はたちになったらこくみんねんきんにかにゅうするぎむがあります。", exampleMeaning: "20 tuổi phải đóng lương hưu quốc dân.", usageNote: "Tự do nghề: tự đóng 16,980¥/月. 学生: 学生納付特例 (hoãn). 免除 (miễn) nếu thu nhập thấp." },
        { word: "脱退一時金", reading: "だったいいちじきん", meaning: "Tiền hoàn trả khi rời Nhật (lump-sum withdrawal)", jlptLevel: "N2", example: "帰国後に脱退一時金を請求できます。", exampleReading: "きこくごにだったいいちじきんをせいきゅうできます。", exampleMeaning: "Về nước rồi có thể xin hoàn tiền.", usageNote: "Điều kiện: đã đóng ≥6ヶ月, rời Nhật, <10年đóng. Max 5年分 hoàn. Xin: 2年以内 sau rời. Form: 日本年金機構 website." },
        { word: "ねんきん定期便", reading: "ねんきんていきびん", meaning: "Thông báo lương hưu định kỳ (pension statement)", jlptLevel: "N3", example: "ねんきん定期便で将来の年金額を確認できます。", exampleReading: "ねんきんていきびんでしょうらいのねんきんがくをかくにんできます。", exampleMeaning: "Xem số tiền hưu tương lai trên thông báo.", usageNote: "Mỗi năm gửi (sinh nhật月). Online: ねんきんネット. Xem: 加入期間, 見込み額." }
      ]
    }
  },
  {
    slug: "household-budget-kakeibo",
    moduleConfigId: M,
    titleVi: "家計簿 — Quản lý chi tiêu",
    titleJa: "家計簿のつけ方",
    descriptionVi: "Quản lý chi tiêu kiểu Nhật — kakeibo, app, tip tiết kiệm.",
    recommendationReasonVi: "家計簿 = wisdom Nhật 100 năm. Biết chi tiêu = tiết kiệm được.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["budgeting", "kakeibo", "saving"],
      contentGoal: "Biết cách quản lý chi tiêu + app phổ biến.",
      usageNote: "家計簿 (kakeibo): sổ chi tiêu Nhật từ 1904. 4 categories: 必要 (cần), 欲しい (muốn), 文化 (học/đọc), その他. App: マネーフォワード (tự sync bank), Zaim, Money Tree. Tip: 先取り貯金 (để dành TRƯỚC khi xài).",
      japaneseExpressions: [
        { word: "家計簿", reading: "かけいぼ", meaning: "Sổ chi tiêu gia đình (household budget book)", jlptLevel: "N3", example: "毎月家計簿をつけて無駄遣いを減らしています。", exampleReading: "まいつきかけいぼをつけてむだづかいをへらしています。", exampleMeaning: "Mỗi tháng ghi chi tiêu để giảm lãng phí.", usageNote: "つける = ghi. Kiên trì = key. App giúp tự động hóa." },
        { word: "先取り貯金", reading: "さきどりちょきん", meaning: "Để dành trước (pay yourself first)", jlptLevel: "N3", example: "給料日に先取り貯金をするのが一番効果的です。", exampleReading: "きゅうりょうびにさきどりちょきんをするのがいちばんこうかてきです。", exampleMeaning: "Ngày lương để dành trước = hiệu quả nhất.", usageNote: "Lương vào → tự động chuyển tiết kiệm (自動振替). Recommend: 20-30% thu nhập." },
        { word: "固定費", reading: "こていひ", meaning: "Chi phí cố định (fixed expenses)", jlptLevel: "N3", example: "固定費を見直すと、大きく節約できます。", exampleReading: "こていひをみなおすと、おおきくせつやくできます。", exampleMeaning: "Xem lại chi phí cố định → tiết kiệm lớn.", usageNote: "家賃, 保険, スマホ, サブスク. Review 年1回. スマホ: 格安SIM で 5000→1000¥/月." }
      ]
    }
  },
  {
    slug: "electricity-gas-bills",
    moduleConfigId: M,
    titleVi: "電気・ガス代 — Tiền điện/gas",
    titleJa: "電気・ガス代の節約",
    descriptionVi: "Hiểu hóa đơn điện/gas + cách tiết kiệm + đổi nhà cung cấp.",
    recommendationReasonVi: "Điện/gas = chi phí lớn. 2022~: tăng giá mạnh. Biết tiết kiệm = significant.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 165,
    metadata: {
      seed: true,
      skills: ["utilities", "electricity", "gas", "saving"],
      contentGoal: "Biết cách đọc hóa đơn + tiết kiệm điện/gas.",
      usageNote: "2016~: tự do chọn 電力会社 (nhà cung cấp điện). So sánh: エネチェンジ (site). Tiết kiệm: LED, エアコン 28°C夏/20°C冬, 待機電力カット (tắt ổ cắm). Gas: 都市ガス (rẻ) vs プロパンガス (đắt 1.5-2x).",
      japaneseExpressions: [
        { word: "電力会社", reading: "でんりょくがいしゃ", meaning: "Công ty điện lực (electricity provider)", jlptLevel: "N3", example: "電力会社を変えるだけで月1000円安くなりました。", exampleReading: "でんりょくがいしゃをかえるだけでつきせんえんやすくなりました。", exampleMeaning: "Đổi công ty điện mà giảm 1000¥/tháng.", usageNote: "Đổi: online, 5分. Không cần gọi công ty cũ. 工事不要. 比較サイト: エネチェンジ." },
        { word: "検針票", reading: "けんしんひょう", meaning: "Phiếu ghi số điện/gas (meter reading slip)", jlptLevel: "N3", example: "検針票を見れば先月の使用量がわかります。", exampleReading: "けんしんひょうをみればせんげつのしようりょうがわかります。", exampleMeaning: "Xem phiếu biết lượng dùng tháng trước.", usageNote: "Hàng tháng: đến nhà hoặc app/web. kWh (điện), m³ (gas). Giờ: 多くの会社 web明細 (online statement)." },
        { word: "待機電力", reading: "たいきでんりょく", meaning: "Điện chờ (standby power — phantom load)", jlptLevel: "N3", example: "待機電力をカットするだけで年間数千円の節約になります。", exampleReading: "たいきでんりょくをカットするだけでねんかんすうせんえんのせつやくになります。", exampleMeaning: "Cắt điện chờ tiết kiệm vài nghìn yên/năm.", usageNote: "TV, PC, 充電器 = luôn hút điện dù tắt. 節電タップ (ổ cắm có switch): 100均 có." }
      ]
    }
  },
  {
    slug: "tax-year-end-adjustment",
    moduleConfigId: M,
    titleVi: "年末調整 — Điều chỉnh thuế cuối năm",
    titleJa: "年末調整の書き方",
    descriptionVi: "Salaryman: 年末調整 hàng năm — form gì, khai gì, nhận lại tiền.",
    recommendationReasonVi: "Mỗi 11月: công ty phát form. Khai đúng = nhận lại tiền thuế đóng thừa.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["tax", "year_end_adjustment", "deductions"],
      contentGoal: "Biết cách khai 年末調整 để nhận lại tiền.",
      usageNote: "11月: HR phát form → khai → 12月 lương: +/- 調整. Khai: 生命保険 (bảo hiểm nhân thọ), 地震保険, 住宅ローン (vay mua nhà), 扶養 (người phụ thuộc), iDeCo. Quên khai = mất quyền → phải 確定申告 (phiền).",
      japaneseExpressions: [
        { word: "年末調整", reading: "ねんまつちょうせい", meaning: "Điều chỉnh thuế cuối năm (year-end tax adjustment)", jlptLevel: "N3", example: "年末調整の書類を11月中に提出してください。", exampleReading: "ねんまつちょうせいのしょるいをじゅういちがつちゅうにていしゅつしてください。", exampleMeaning: "Nộp giấy tờ điều chỉnh thuế trong tháng 11.", usageNote: "Salaryman: công ty làm thay. Freelancer: tự 確定申告. Kết quả: 12月給与 nhiều hơn bình thường = 還付 (hoàn thuế)." },
        { word: "控除", reading: "こうじょ", meaning: "Khấu trừ thuế (tax deduction)", jlptLevel: "N3", example: "生命保険料控除で所得税が安くなります。", exampleReading: "せいめいほけんりょうこうじょでしょとくぜいがやすくなります。", exampleMeaning: "Khấu trừ bảo hiểm nhân thọ → thuế giảm.", usageNote: "Loại: 保険料控除, 配偶者控除, 扶養控除, 住宅ローン控除, 医療費控除 (này: 確定申告). Nhiều 控除 = ít thuế." },
        { word: "源泉徴収票", reading: "げんせんちょうしゅうひょう", meaning: "Phiếu khấu trừ thuế tại nguồn (withholding slip)", jlptLevel: "N2", example: "転職する時は前の会社の源泉徴収票が必要です。", exampleReading: "てんしょくするときはまえのかいしゃのげんせんちょうしゅうひょうがひつようです。", exampleMeaning: "Đổi việc cần phiếu thuế công ty cũ.", usageNote: "12-1月: công ty phát. GIỮ LẠI. Cần khi: 確定申告, vay ngân hàng, thuê nhà." }
      ]
    }
  },
  {
    slug: "medical-expenses-deduction",
    moduleConfigId: M,
    titleVi: "医療費控除 — Khấu trừ y tế",
    titleJa: "医療費控除で税金を取り戻す",
    descriptionVi: "Chi y tế nhiều (>10万¥/năm) → khai thuế → nhận lại tiền.",
    recommendationReasonVi: "Năm đó đi bệnh viện nhiều? Có thể lấy lại thuế!",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 168,
    metadata: {
      seed: true,
      skills: ["medical_deduction", "tax_return", "healthcare_cost"],
      contentGoal: "Biết cách khai 医療費控除 khi chi y tế cao.",
      usageNote: "Điều kiện: chi y tế gia đình > 10万¥/năm (hoặc thu nhập×5% nếu thấp). Cover: khám, thuốc, nha, giao thông đi khám, sinh con. KHÔNG cover: thẩm mỹ, vitamin. Cách: 確定申告 (2-3月). Giữ 領収書!",
      japaneseExpressions: [
        { word: "医療費控除", reading: "いりょうひこうじょ", meaning: "Khấu trừ chi phí y tế (medical expense deduction)", jlptLevel: "N2", example: "出産した年は医療費控除で数万円戻ってきました。", exampleReading: "しゅっさんしたとしはいりょうひこうじょですうまんえんもどってきました。", exampleMeaning: "Năm sinh con nhờ khấu trừ y tế được lại vài vạn.", usageNote: "Cả gia đình合算. Sinh con + nha + thường xuyên khám = dễ vượt 10万." },
        { word: "確定申告", reading: "かくていしんこく", meaning: "Khai thuế (tax return filing)", jlptLevel: "N3", example: "医療費控除は確定申告で申請します。", exampleReading: "いりょうひこうじょはかくていしんこくでしんせいします。", exampleMeaning: "Khấu trừ y tế khai ở 確定申告.", usageNote: "2/16-3/15 hàng năm. Online: e-Tax (マイナンバーカード + PC/スマホ). Hoặc 税務署 trực tiếp." },
        { word: "領収書", reading: "りょうしゅうしょ", meaning: "Biên lai (receipt — giữ để khai thuế)", jlptLevel: "N4", example: "病院の領収書は捨てずに保管してください。", exampleReading: "びょういんのりょうしゅうしょはすてずにほかんしてください。", exampleMeaning: "Biên lai bệnh viện đừng vứt, giữ lại.", usageNote: "5年 giữ. Tip: phong bì theo tháng. 2017~: 明細書 (tổng hợp) OK thay 領収書, nhưng giữ vẫn tốt hơn." }
      ]
    }
  },
  {
    slug: "smartphone-cashless-pay",
    moduleConfigId: M,
    titleVi: "スマホ決済 — Thanh toán qua ĐT",
    titleJa: "スマホ決済の使い方",
    descriptionVi: "PayPay, Suica, iD — loại nào dùng ở đâu, cách setup.",
    recommendationReasonVi: "2024: 40%+ cashless ở Nhật. Dùng đúng = tiện + tích điểm.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 162,
    metadata: {
      seed: true,
      skills: ["cashless", "mobile_payment", "fintech"],
      contentGoal: "Biết loại thanh toán nào phổ biến + cách dùng.",
      usageNote: "QR code: PayPay (#1, 60M users), d払い, 楽天Pay, auPAY. FeliCa (chạm): Suica/PASMO (giao thông+mua sắm), iD, QUICPay. Suica = MUST HAVE (tàu + combini + vending). PayPay = có ở mọi nơi.",
      japaneseExpressions: [
        { word: "チャージ", reading: "チャージ", meaning: "Nạp tiền (top-up/charge)", jlptLevel: "N4", example: "Suicaの残高が足りないのでチャージしてください。", exampleReading: "Suicaのざんだかがたりないのでチャージしてください。", exampleMeaning: "Suica hết tiền, nạp thêm.", usageNote: "Suica: ATM, コンビニ, 改札機 で nạp. PayPay: 銀行, ATM, コンビニ. オートチャージ = tự nạp khi dưới X¥." },
        { word: "残高", reading: "ざんだか", meaning: "Số dư (balance)", jlptLevel: "N4", example: "残高不足でお支払いができませんでした。", exampleReading: "ざんだかぶそくでおしはらいができませんでした。", exampleMeaning: "Không đủ số dư nên không thanh toán được.", usageNote: "Check: app hoặc chạm máy (IC残高確認). Tip: オートチャージ set để không bao giờ hết." },
        { word: "ポイント二重取り", reading: "ポイントにじゅうどり", meaning: "Tích điểm kép (double points hack)", jlptLevel: "N3", example: "クレカからPayPayにチャージするとポイント二重取りできます。", exampleReading: "クレカからPayPayにチャージするとポイントにじゅうどりできます。", exampleMeaning: "Nạp PayPay từ credit card → tích điểm kép.", usageNote: "Credit card (1%) → PayPay (0.5-1%) = 1.5-2% tổng. 楽天カード+楽天Pay cũng OK." }
      ]
    }
  },
  {
    slug: "ideco-tsumitate-investment",
    moduleConfigId: M,
    titleVi: "iDeCo・積立 — Đầu tư dài hạn",
    titleJa: "iDeCoと積立NISAの始め方",
    descriptionVi: "Tiết kiệm hưu trí (iDeCo) + đầu tư miễn thuế (NISA) cho người mới.",
    recommendationReasonVi: "Lãi suất ngân hàng 0.001%. Đầu tư = bắt buộc để tài chính khỏe.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["investment", "ideco", "nisa", "retirement"],
      contentGoal: "Hiểu sơ lược iDeCo + NISA + cách bắt đầu.",
      usageNote: "NISA (2024 mới): 年360万 non-taxable. つみたて投資枠: 月10万max. 成長投資枠: 年240万. iDeCo: 月12,000-68,000¥ (tùy loại), giảm thuế 所得控除, 60歳まで rút không được. Recommend mới: つみたてNISA + eMAXIS Slim 全世界株式.",
      japaneseExpressions: [
        { word: "積立投資", reading: "つみたてとうし", meaning: "Đầu tư tích lũy (dollar-cost averaging)", jlptLevel: "N3", example: "毎月3万円ずつ積立投資しています。", exampleReading: "まいつきさんまんえんずつつみたてとうししています。", exampleMeaning: "Mỗi tháng đầu tư tích lũy 3 vạn.", usageNote: "Tự động mua mỗi tháng → trung bình giá. Risk thấp cho người mới. 20年+ = lãi kép mạnh." },
        { word: "非課税", reading: "ひかぜい", meaning: "Miễn thuế (tax-free)", jlptLevel: "N3", example: "NISAの利益は非課税です。", exampleReading: "NISAのりえきはひかぜいです。", exampleMeaning: "Lợi nhuận NISA miễn thuế.", usageNote: "Thường: lãi đầu tư thuế 20.315%. NISA: 0%. iDeCo: 掛金 giảm thuế + 運用益 非課税." },
        { word: "口座開設", reading: "こうざかいせつ", meaning: "Mở tài khoản (đầu tư)", jlptLevel: "N3", example: "NISA口座は1人1口座しか作れません。", exampleReading: "NISAこうざはひとりいちこうざしかつくれません。", exampleMeaning: "Tài khoản NISA mỗi người chỉ 1 cái.", usageNote: "Online: SBI証券, 楽天証券 (phổ biến, 手数料安い). マイナンバー必要. 1-2週間." }
      ]
    }
  },
  {
    slug: "moving-hikkoshi-costs",
    moduleConfigId: M,
    titleVi: "引っ越し費用 — Chi phí chuyển nhà",
    titleJa: "引っ越しの費用と節約法",
    descriptionVi: "Chuyển nhà ở Nhật = ĐẮT. Biết chi phí + mẹo tiết kiệm.",
    recommendationReasonVi: "Chuyển nhà Nhật: 初期費用 5-6ヶ月分家賃. Biết = plan tài chính được.",
    category: "money",
    visualTheme: "emerald_money",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["moving", "housing_cost", "budgeting"],
      contentGoal: "Biết chi phí chuyển nhà + cách giảm.",
      usageNote: "初期費用: 敷金 (1-2ヶ月), 礼金 (1ヶ月, gift!), 仲介手数料 (1ヶ月), 前家賃 (1ヶ月), 火災保険, 鍵交換. Total: 4.5-6ヶ月分! Tiết kiệm: 礼金0, 仲介0.5ヶ月交渉, フリーレント (1ヶ月free), 閑散期 (6-8月) = mặc cả dễ.",
      japaneseExpressions: [
        { word: "敷金", reading: "しききん", meaning: "Tiền đặt cọc (security deposit — trả lại khi ra)", jlptLevel: "N4", example: "敷金は退去時にクリーニング代を引いて返金されます。", exampleReading: "しききんはたいきょじにクリーニングだいをひいてへんきんされます。", exampleMeaning: "Tiền cọc trả lại khi ra trừ phí dọn.", usageNote: "1-2ヶ月. Trả lại một phần khi 退去. Hư hại quá = trừ hết. 敷金0 = có nhưng退去時 cao." },
        { word: "礼金", reading: "れいきん", meaning: "Tiền cảm ơn (key money — KHÔNG trả lại)", jlptLevel: "N4", example: "礼金なしの物件を探しています。", exampleReading: "れいきんなしのぶっけんをさがしています。", exampleMeaning: "Tìm nhà không có tiền cảm ơn.", usageNote: "Gift cho chủ nhà. Văn hóa cũ. 礼金0 ngày càng nhiều (mặc cả OK). 関西: ít hơn 関東." },
        { word: "仲介手数料", reading: "ちゅうかいてすうりょう", meaning: "Phí môi giới (brokerage fee)", jlptLevel: "N3", example: "仲介手数料は家賃の1か月分が上限です。", exampleReading: "ちゅうかいてすうりょうはやちんのいっかげつぶんがじょうげんです。", exampleMeaning: "Phí môi giới tối đa 1 tháng tiền nhà.", usageNote: "Max: 1ヶ月+税. Mặc cả: 0.5ヶ月 OK (法律上は借主0.5が原則). エイブル: 0.5ヶ月." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("💰 Money/Finance batch 3...");
  await runBatch(client, cards, "Money-Finance-3");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
