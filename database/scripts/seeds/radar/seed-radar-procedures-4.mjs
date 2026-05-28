/**
 * Radar Seed: Procedures batch 4 (10 cards)
 * Topics: car ownership, inkan, visa renewal, driver's license, marriage, national ID, inheritance
 * Run: node scripts/seed-radar-procedures-4.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_PROC = MODULES.visa_cityhall;

const cards = [
  {
    slug: "car-ownership-japan",
    moduleConfigId: M_PROC,
    titleVi: "車の所有 — Sở hữu ô tô ở Nhật",
    titleJa: "日本での車の維持費",
    descriptionVi: "Chi phí nuôi xe ở Nhật — thuế, bảo hiểm, 車検, parking.",
    recommendationReasonVi: "Xe Nhật: nhiều chi phí ẩn. Biết trước = budget đúng.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["car_ownership", "maintenance", "budgeting"],
      contentGoal: "Biết tổng chi phí + thủ tục nuôi xe ở Nhật.",
      usageNote: "Chi phí: 自動車税 (39,500¥/năm cho 1500cc), 車検 (2年1回: 10-15万), 自賠責保険 (bắt buộc), 任意保険 (tự nguyện: 5-10万/年), 駐車場 (2-5万/月 Tokyo). 軽自動車 rẻ hơn cực nhiều. Tổng: 30-50万/年.",
      japaneseExpressions: [
        { word: "車検", reading: "しゃけん", meaning: "Kiểm định xe (vehicle inspection — bắt buộc)", jlptLevel: "N3", example: "来月、車検の期限が切れます。", exampleReading: "らいげつ、しゃけんのきげんがきれます。", exampleMeaning: "Tháng sau hết hạn kiểm định xe.", usageNote: "Xe mới: 3年 → sau đó 2年 1 lần. Chi phí: 7-15万 (tùy xe). Qua hạn = vi phạm. ユーザー車検 (tự đi): rẻ hơn." },
        { word: "自動車税", reading: "じどうしゃぜい", meaning: "Thuế ô tô (annual vehicle tax)", jlptLevel: "N3", example: "毎年5月に自動車税の通知が届きます。", exampleReading: "まいとしごがつにじどうしゃぜいのつうちがとどきます。", exampleMeaning: "Tháng 5 hàng năm nhận thông báo thuế xe.", usageNote: "排気量 (dung tích) → thuế. 660cc (軽): 10,800¥. 1500cc: 34,500¥. 2000cc: 39,500¥. Trễ = 延滞金." },
        { word: "駐車場", reading: "ちゅうしゃじょう", meaning: "Bãi đậu xe (parking lot)", jlptLevel: "N4", example: "マンションの駐車場は月3万円です。", exampleReading: "マンションのちゅうしゃじょうはつきさんまんえんです。", exampleMeaning: "Bãi đậu xe chung cư 3 vạn/tháng.", usageNote: "Mua xe PHẢI có 車庫証明 (giấy chứng nhận có chỗ đậu). Tokyo中心: 3-5万/月. 地方: 5000-1万." }
      ]
    }
  },
  {
    slug: "inkan-registration-seal",
    moduleConfigId: M_PROC,
    titleVi: "印鑑登録 — Đăng ký con dấu",
    titleJa: "印鑑登録の手続き",
    descriptionVi: "Con dấu cá nhân Nhật — loại, đăng ký, khi nào dùng.",
    recommendationReasonVi: "印鑑 = chữ ký Nhật. Mua nhà/xe/hợp đồng = BẮT BUỘC.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["inkan", "official_documents", "city_hall"],
      contentGoal: "Biết phân biệt loại dấu + cách đăng ký.",
      usageNote: "3 loại: 実印 (đăng ký chính thức: mua nhà/xe, hợp đồng lớn), 銀行印 (bank: mở TK), 認印 (thường: nhận bưu kiện, đơn nội bộ). Đăng ký: 市区町村役所, mang 印鑑 + 本人確認書類 + 転入届 xong. Ngoại quốc: tên katakana OK. 印鑑証明書: cần khi dùng 実印.",
      japaneseExpressions: [
        { word: "実印", reading: "じついん", meaning: "Con dấu chính thức (registered seal)", jlptLevel: "N3", example: "不動産の契約には実印が必要です。", exampleReading: "ふどうさんのけいやくにはじついんがひつようです。", exampleMeaning: "Hợp đồng bất động sản cần 実印.", usageNote: "Đăng ký 1 lần → dùng mãi (nếu không đổi). Size: 8-25mm. Tên đầy đủ. KHÔNG mua 100均 (quá phổ biến → giả dễ)." },
        { word: "印鑑証明書", reading: "いんかんしょうめいしょ", meaning: "Giấy chứng nhận con dấu (seal certificate)", jlptLevel: "N3", example: "印鑑証明書は市役所で発行してもらいます。", exampleReading: "いんかんしょうめいしょはしやくしょではっこうしてもらいます。", exampleMeaning: "Giấy chứng nhận dấu xin ở thị sở.", usageNote: "Dùng 実印 thì LUÔN kèm 印鑑証明書 (3ヶ月以内: trong vòng 3 tháng). マイナンバーカード → コンビニ phát hành." },
        { word: "認印", reading: "みとめいん", meaning: "Con dấu thường (personal stamp for daily use)", jlptLevel: "N3", example: "宅配便の受け取りは認印で大丈夫です。", exampleReading: "たくはいびんのうけとりはみとめいんでだいじょうぶです。", exampleMeaning: "Nhận bưu kiện dùng dấu thường OK.", usageNote: "100均 OK. Không đăng ký. Dùng: nhận đồ, form nội bộ, 回覧板 (bảng lưu hành khu phố). 2024: nhiều thứ chuyển sang điện tử (電子印鑑)." }
      ]
    }
  },
  {
    slug: "visa-renewal-koshin",
    moduleConfigId: M_PROC,
    titleVi: "ビザ更新 — Gia hạn visa",
    titleJa: "在留資格の更新手続き",
    descriptionVi: "Gia hạn 在留カード — hồ sơ, timing, lưu ý quan trọng.",
    recommendationReasonVi: "Quá hạn = bất hợp pháp. Biết quy trình + timing = an toàn.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 195,
    metadata: {
      seed: true,
      skills: ["visa", "immigration", "residence_card"],
      contentGoal: "Biết quy trình gia hạn visa + documents cần.",
      usageNote: "Timing: nộp 3ヶ月前 (sớm nhất). Nơi: 出入国在留管理局 (入管). Hồ sơ: 在留期間更新許可申請書, パスポート, 在留カード, 写真 (4x3), 住民税納税証明書, 在職証明書/契約書. Online: マイナポータル (2024~). Xử lý: 2週間~3ヶ月. Nhận kết quả: ハガキ → 入管 nhận カード mới.",
      japaneseExpressions: [
        { word: "在留カード", reading: "ざいりゅうカード", meaning: "Thẻ lưu trú (residence card)", jlptLevel: "N3", example: "在留カードは常に携帯してください。", exampleReading: "ざいりゅうカードはつねにけいたいしてください。", exampleMeaning: "Luôn mang theo thẻ lưu trú.", usageNote: "LUÔN mang theo (法律). Không mang = phạt 20万. Mặt trước: tên, quốc tịch, 在留資格, 期限. Mặt sau: 住所 (cập nhật khi chuyển nhà)." },
        { word: "出入国在留管理局", reading: "しゅつにゅうこくざいりゅうかんりきょく", meaning: "Cục quản lý xuất nhập cảnh (immigration bureau)", jlptLevel: "N2", example: "出入国在留管理局で在留資格の更新をします。", exampleReading: "しゅつにゅうこくざいりゅうかんりきょくでざいりゅうしかくのこうしんをします。", exampleMeaning: "Gia hạn visa ở cục xuất nhập cảnh.", usageNote: "略: 入管 (にゅうかん). Đông → đi SÁNG SỚM. 予約 online (一部). 代理人申請 OK (行政書士, 会社の人事)." },
        { word: "在留期間", reading: "ざいりゅうきかん", meaning: "Thời hạn lưu trú (period of stay)", jlptLevel: "N3", example: "在留期間が切れる前に更新手続きをしましょう。", exampleReading: "ざいりゅうきかんがきれるまえにこうしんてつづきをしましょう。", exampleMeaning: "Gia hạn trước khi hết hạn lưu trú.", usageNote: "1年, 3年, 5年 (tùy thâm niên + thuế đóng đủ). 永住 (vĩnh trú): 10年+ hoặc 高度人材 3年. Nộp muộn: 特例期間 2ヶ月 (nhưng ĐỪNG để muộn)." }
      ]
    }
  },
  {
    slug: "drivers-license-conversion",
    moduleConfigId: M_PROC,
    titleVi: "運転免許切替 — Đổi bằng lái",
    titleJa: "外国免許から日本の免許への切替",
    descriptionVi: "Đổi bằng lái nước ngoài sang Nhật — quy trình, test, documents.",
    recommendationReasonVi: "Thi mới = KHÓ (chỉ 30% đậu lần 1). Đổi = nhanh hơn nhiều.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["drivers_license", "conversion", "driving"],
      contentGoal: "Biết quy trình đổi bằng lái + chuẩn bị.",
      usageNote: "Điều kiện: bằng gốc valid + ở nước đó 3ヶ月+ sau khi có bằng. Quy trình: 1) 書類 chuẩn bị (翻訳: JAF dịch). 2) 運転免許センター nộp. 3) 視力検査 (thị lực). 4) 知識確認 (10 câu O/X) + 技能確認 (lái thử). Một số nước miễn test (US 一部州, UK, etc). VN: phải test.",
      japaneseExpressions: [
        { word: "免許切替", reading: "めんきょきりかえ", meaning: "Đổi bằng lái (license conversion)", jlptLevel: "N3", example: "ベトナムの免許を日本の免許に切り替えたいです。", exampleReading: "ベトナムのめんきょをにほんのめんきょにきりかえたいです。", exampleMeaning: "Muốn đổi bằng VN sang bằng Nhật.", usageNote: "Nơi: 運転免許センター (KHÔNG phải 警察署). Đặt 予約 trước. Fee: 3,850¥~. Mang: パスポート toàn bộ (cũ+mới), 在留カード, 写真, bằng gốc + 翻訳." },
        { word: "技能確認", reading: "ぎのうかくにん", meaning: "Test kỹ năng lái (skills test)", jlptLevel: "N3", example: "技能確認ではS字カーブと方向転換があります。", exampleReading: "ぎのうかくにんではエスじカーブとほうこうてんかんがあります。", exampleMeaning: "Test lái có cua S và quay đầu.", usageNote: "Khó nhất. S字, クランク (L-turn), 方向変換 (quay đầu), 縦列駐車 (đậu dọc). Tips: 確認 (quay đầu check mirrors), ウインカー sớm, 目視." },
        { word: "国際運転免許証", reading: "こくさいうんてんめんきょしょう", meaning: "Bằng lái quốc tế (international driving permit)", jlptLevel: "N3", example: "国際運転免許証は1年間有効です。", exampleReading: "こくさいうんてんめんきょしょうはいちねんかんゆうこうです。", exampleMeaning: "Bằng lái quốc tế có hiệu lực 1 năm.", usageNote: "Tạm dùng khi mới đến. 1年 max. Sau đó PHẢI đổi/thi. Lưu ý: VN bằng quốc tế Geneva convention → dùng được ở Nhật." }
      ]
    }
  },
  {
    slug: "marriage-registration-konin",
    moduleConfigId: M_PROC,
    titleVi: "婚姻届 — Đăng ký kết hôn",
    titleJa: "国際結婚の手続き",
    descriptionVi: "Kết hôn quốc tế ở Nhật — hồ sơ, thủ tục, lưu ý visa.",
    recommendationReasonVi: "Kết hôn quốc tế = nhiều giấy tờ cả 2 nước. Biết trước = mượt.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 5,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["marriage", "international", "family_registration"],
      contentGoal: "Biết quy trình đăng ký kết hôn quốc tế.",
      usageNote: "Cần: 婚姻届 (form), 婚姻要件具備証明書 (từ đại sứ quán nước mình: chứng nhận đủ ĐK kết hôn), パスポート, 在留カード, 戸籍謄本 (người Nhật). Nộp: 市区町村役所. Sau đó: báo đại sứ quán VN + đổi visa → 配偶者ビザ. Timeline: 2-6 tháng tổng.",
      japaneseExpressions: [
        { word: "婚姻届", reading: "こんいんとどけ", meaning: "Đơn đăng ký kết hôn (marriage registration form)", jlptLevel: "N3", example: "婚姻届は24時間いつでも提出できます。", exampleReading: "こんいんとどけはにじゅうよじかんいつでもていしゅつできます。", exampleMeaning: "Đơn kết hôn nộp 24h bất cứ lúc nào.", usageNote: "Form: 役所 lấy miễn phí hoặc download. 証人2人 (nhân chứng 2 người: bạn bè OK). Nộp ngày nào = ngày kết hôn chính thức. 記念日 chọn ngày đẹp: 11/22 (いい夫婦の日)." },
        { word: "婚姻要件具備証明書", reading: "こんいんようけんぐびしょうめいしょ", meaning: "Giấy xác nhận tình trạng hôn nhân (certificate of legal capacity to marry)", jlptLevel: "N2", example: "大使館で婚姻要件具備証明書をもらってください。", exampleReading: "たいしかんでこんいんようけんぐびしょうめいしょをもらってください。", exampleMeaning: "Lấy giấy xác nhận hôn nhân ở đại sứ quán.", usageNote: "= chứng nhận: CHƯA kết hôn + đủ tuổi. VN: xin ở ĐSQ VN tại Tokyo/Osaka. Cần: 独身証明 từ VN (apostille). Phiên dịch sang 日本語 + 公証." },
        { word: "配偶者ビザ", reading: "はいぐうしゃビザ", meaning: "Visa phối ngẫu (spouse visa)", jlptLevel: "N3", example: "結婚後、配偶者ビザに変更しました。", exampleReading: "けっこんご、はいぐうしゃビザにへんこうしました。", exampleMeaning: "Sau kết hôn đổi sang visa phối ngẫu.", usageNote: "= 日本人の配偶者等. Thay 在留資格: 入管 nộp 在留資格変更許可申請. Quyền: làm bất kỳ việc gì (就労制限なし). 期間: 1年 → 3年 → 永住 xin được." }
      ]
    }
  },
  {
    slug: "my-number-card-benefits",
    moduleConfigId: M_PROC,
    titleVi: "マイナンバーカード — Thẻ số cá nhân",
    titleJa: "マイナンバーカードの活用法",
    descriptionVi: "MyNumber card — cách làm, dùng gì, tiện lợi ra sao.",
    recommendationReasonVi: "2024+: gần bắt buộc. Nhiều thủ tục CHỈ dùng MN card.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["my_number", "government_id", "digital_services"],
      contentGoal: "Biết cách làm + tận dụng MyNumber card.",
      usageNote: "Dùng: 1) 本人確認 (ID chính thức). 2) コンビニ交付 (lấy 住民票, 印鑑証明... ở combini). 3) 確定申告 online (e-Tax). 4) 健康保険証 thay thế (2024/12~). 5) マイナポイント (2万point khi đăng ký — đã hết nhưng có campaign mới). Làm: 市区町村 nộp + 1ヶ月 chờ + nhận.",
      japaneseExpressions: [
        { word: "マイナンバーカード", reading: "マイナンバーカード", meaning: "Thẻ số cá nhân (My Number Card — government ID)", jlptLevel: "N4", example: "マイナンバーカードがあればコンビニで住民票を取れます。", exampleReading: "マイナンバーカードがあればコンビニでじゅうみんひょうをとれます。", exampleMeaning: "Có MN card thì lấy 住民票 ở combini được.", usageNote: "FREE. Xin: 役所 trực tiếp hoặc online (スマホ). 暗証番号 (PIN) 4 chữ số đặt. Ngoại quốc: dùng 在留カード + thông báo MN nhận được." },
        { word: "コンビニ交付", reading: "コンビニこうふ", meaning: "Phát hành giấy tờ ở combini (convenience store issuance)", jlptLevel: "N4", example: "コンビニ交付なら朝6時半から夜11時まで利用できます。", exampleReading: "コンビニこうふならあさろくじはんからよるじゅういちじまでりようできます。", exampleMeaning: "Combini phát hành dùng 6:30-23:00.", usageNote: "Cần MN card + 暗証番号. Lấy được: 住民票, 印鑑証明, 戸籍(一部), 税証明. Rẻ hơn 役所 (200¥ vs 300¥). 7-11, ローソン, ファミマ." },
        { word: "暗証番号", reading: "あんしょうばんごう", meaning: "Mã PIN (personal identification number)", jlptLevel: "N4", example: "暗証番号を3回間違えるとロックされます。", exampleReading: "あんしょうばんごうをさんかいまちがえるとロックされます。", exampleMeaning: "Nhập sai PIN 3 lần bị khóa.", usageNote: "4桁 (署名用: 6-16桁). Quên/khóa: 役所 reset (本人 mang card đi). TIP: đừng dùng sinh nhật." }
      ]
    }
  },
  {
    slug: "pension-nenkin-withdrawal",
    moduleConfigId: M_PROC,
    titleVi: "年金脱退一時金 — Rút tiền lương hưu",
    titleJa: "年金の脱退一時金の申請",
    descriptionVi: "Rời Nhật thì lấy lại tiền pension — điều kiện, cách xin.",
    recommendationReasonVi: "Đóng 年金 nhiều năm → về nước = lấy lại được (tối đa 5年分). Nhiều người KHÔNG BIẾT.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["pension", "withdrawal", "leaving_japan"],
      contentGoal: "Biết điều kiện + cách xin rút 年金.",
      usageNote: "Điều kiện: 1) 日本国籍 không có. 2) 6ヶ月+ đóng. 3) Rời Nhật (住民票 転出済). 4) Chưa nhận lương hưu. 5) Xin trong 2年 sau khi rời. Số tiền: tùy năm đóng (max 5年分 = ~100万 cho mức lương trung bình). Form: 脱退一時金裁定請求書. Nộp: 日本年金機構 (gửi thư từ nước ngoài OK).",
      japaneseExpressions: [
        { word: "脱退一時金", reading: "だったいいちじきん", meaning: "Tiền hoàn trả lương hưu khi rời Nhật (lump-sum withdrawal)", jlptLevel: "N2", example: "帰国後2年以内に脱退一時金を請求できます。", exampleReading: "きこくごにねんいないにだったいいちじきんをせいきゅうできます。", exampleMeaning: "Trong 2 năm sau về nước có thể xin hoàn 年金.", usageNote: "2021~: max 5年分 (trước 3年). Thuế 20.42% trừ → 退職所得の選択課税 xin refund (税務署 代理人 cần). Gửi bưu: 2-4ヶ月 nhận tiền." },
        { word: "年金手帳", reading: "ねんきんてちょう", meaning: "Sổ lương hưu (pension booklet — đã bỏ 2022)", jlptLevel: "N3", example: "年金手帳の基礎年金番号が必要です。", exampleReading: "ねんきんてちょうのきそねんきんばんごうがひつようです。", exampleMeaning: "Cần số 年金 cơ bản trong sổ.", usageNote: "2022/4~: bỏ sổ → 基礎年金番号通知書. Nhưng sổ cũ vẫn valid. Số 10 chữ số = key. Mất: ねんきんネット check online." },
        { word: "転出届", reading: "てんしゅつとどけ", meaning: "Khai báo chuyển đi (moving-out notification)", jlptLevel: "N3", example: "帰国する前に転出届を出してください。", exampleReading: "きこくするまえにてんしゅつとどけをだしてください。", exampleMeaning: "Trước khi về nước hãy nộp khai báo chuyển đi.", usageNote: "役所: nộp 14日前~当日. Nộp = xóa 住民票 → ĐIỀU KIỆN để xin 脱退一時金. Không nộp: vẫn bị đòi 住民税, 保険料." }
      ]
    }
  },
  {
    slug: "moving-hikkoshi-procedures",
    moduleConfigId: M_PROC,
    titleVi: "引っ越し手続き — Thủ tục chuyển nhà",
    titleJa: "引っ越しで必要な届出リスト",
    descriptionVi: "Checklist chuyển nhà ở Nhật — giấy tờ, đổi địa chỉ, hợp đồng.",
    recommendationReasonVi: "Chuyển nhà = 10+ thủ tục. Bỏ sót = phạt hoặc service mất.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["moving", "address_change", "utilities"],
      contentGoal: "Biết checklist chuyển nhà đầy đủ.",
      usageNote: "Before: 転出届 (14日前), 電気/ガス/水道 停止 + 新住所 開始 (電話/online), 郵便転送 (e転居 = online: 1年 free forward). After: 転入届 (14日以内!), 在留カード裏 住所更新, マイナンバー住所変更, 銀行/携帯/会社/保険 住所変更. 忘れがち: NHK, 選挙人名簿.",
      japaneseExpressions: [
        { word: "転入届", reading: "てんにゅうとどけ", meaning: "Khai báo chuyển đến (moving-in notification)", jlptLevel: "N3", example: "引っ越し後14日以内に転入届を出してください。", exampleReading: "ひっこしごじゅうよっかいないにてんにゅうとどけをだしてください。", exampleMeaning: "Nộp khai báo chuyển đến trong 14 ngày.", usageNote: "新しい市区町村 役所. Mang: 転出証明書 + 在留カード + マイナンバーカード. 14日 quá = 過料 5万. 同じ市内: 転居届 (khác form)." },
        { word: "郵便転送", reading: "ゆうびんてんそう", meaning: "Chuyển tiếp thư (mail forwarding)", jlptLevel: "N4", example: "郵便局で転送届を出すと1年間転送されます。", exampleReading: "ゆうびんきょくでてんそうとどけをだすといちねんかんてんそうされます。", exampleMeaning: "Nộp form bưu điện thì chuyển tiếp 1 năm.", usageNote: "MIỄN PHÍ. e転居 (online): スマホ + 本人確認. 1年後 hết → gia hạn 1 lần nữa OK. Important: 不在届 ≠ 転送届 (khác!)." },
        { word: "敷金", reading: "しききん", meaning: "Tiền đặt cọc thuê nhà (security deposit)", jlptLevel: "N3", example: "退去時に敷金から修繕費を引かれました。", exampleReading: "たいきょじにしききんからしゅうぜんひをひかれました。", exampleMeaning: "Khi trả nhà bị trừ tiền sửa từ cọc.", usageNote: "Trả nhà: 退去立会 (kiểm tra cùng 大家). 原状回復: trả nguyên trạng (合理的な範囲). 敷金 trả lại trừ sửa chữa. Tip: 入居時 写真 chụp = bằng chứng." }
      ]
    }
  },
  {
    slug: "tax-return-kakutei-shinkoku",
    moduleConfigId: M_PROC,
    titleVi: "確定申告 — Khai thuế thu nhập",
    titleJa: "確定申告のやり方",
    descriptionVi: "Khai thuế — ai cần, khi nào, cách làm online, hoàn thuế.",
    recommendationReasonVi: "Nhiều người bỏ quên = MẤT TIỀN hoàn thuế. Freelance = bắt buộc.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 188,
    metadata: {
      seed: true,
      skills: ["tax_return", "deductions", "e_tax"],
      contentGoal: "Biết khi nào cần khai thuế + cách làm.",
      usageNote: "Ai cần: フリーランス, 副業 20万+, 医療費 10万+, 住宅ローン年1, 年収2000万+, 退職 年中. Kỳ: 2/16-3/15 (nộp), 1/1~ (hoàn thuế xin sớm OK). Cách: e-Tax (online, MN card + スマホ), 税務署 trực tiếp, 郵送. Hoàn thuế: 医療費控除, ふるさと納税, 住宅ローン.",
      japaneseExpressions: [
        { word: "確定申告", reading: "かくていしんこく", meaning: "Khai thuế thu nhập (tax return)", jlptLevel: "N3", example: "副業の収入が20万円を超えたら確定申告が必要です。", exampleReading: "ふくぎょうのしゅうにゅうがにじゅうまんえんをこえたらかくていしんこくがひつようです。", exampleMeaning: "Thu nhập phụ trên 20 vạn thì cần khai thuế.", usageNote: "会社員: 年末調整 = công ty lo. Nhưng: 医療費多い, ふるさと納税 6自治体+, 副業 → tự khai. Không khai = bị truy thu + 加算税." },
        { word: "還付金", reading: "かんぷきん", meaning: "Tiền hoàn thuế (tax refund)", jlptLevel: "N3", example: "医療費控除で5万円の還付金がありました。", exampleReading: "いりょうひこうじょでごまんえんのかんぷきんがありました。", exampleMeaning: "Khấu trừ y tế được hoàn 5 vạn.", usageNote: "Xin = 1-2ヶ月 sau nhận (振込). Không xin = KHÔNG được hoàn. 5年以内 xin lại OK (更正の請求). Check: ふるさと納税, 住宅, 医療." },
        { word: "控除", reading: "こうじょ", meaning: "Khấu trừ thuế (tax deduction)", jlptLevel: "N3", example: "生命保険料控除の書類を会社に提出します。", exampleReading: "せいめいほけんりょうこうじょのしょるいをかいしゃにていしゅつします。", exampleMeaning: "Nộp giấy khấu trừ bảo hiểm cho công ty.", usageNote: "Loại: 基礎控除 48万 (ai cũng có), 社会保険料, 生命保険, 医療費, 住宅ローン, 扶養控除, ふるさと納税. Nhiều控除 = thuế ít hơn." }
      ]
    }
  },
  {
    slug: "garbage-disposal-bunbetsu",
    moduleConfigId: M_PROC,
    titleVi: "ゴミ分別 — Phân loại rác",
    titleJa: "日本のゴミ出しルール",
    descriptionVi: "Quy tắc phân loại + đổ rác ở Nhật — sai = hàng xóm ghét.",
    recommendationReasonVi: "Sai = rác bị TRẢ LẠI + hàng xóm complain. Đúng = hòa nhập.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["garbage", "neighborhood_rules", "recycling"],
      contentGoal: "Biết phân loại rác đúng + lịch đổ.",
      usageNote: "Phân loại (tùy 市区町村): 燃えるゴミ (cháy: thức ăn, giấy, vải), 燃えないゴミ (không cháy: kim loại nhỏ, gốm), プラ (nhựa bao bì: ♻マーク), 缶・びん・ペットボトル, 紙 (giấy/carton). Lịch: check 市 website/app. Giờ: SÁNG (8時前). 粗大ゴミ (đồ lớn): đặt lịch + trả phí.",
      japaneseExpressions: [
        { word: "燃えるゴミ", reading: "もえるゴミ", meaning: "Rác cháy được (burnable garbage)", jlptLevel: "N4", example: "燃えるゴミは火曜日と金曜日に出します。", exampleReading: "もえるゴミはかようびときんようびにだします。", exampleMeaning: "Rác cháy đổ thứ 3 và thứ 6.", usageNote: "Nhiều nhất. Bao: 指定袋 (túi chỉ định: mua ở combini/スーパー). Thức ăn: 水切り (vắt nước). 生ゴミ xử lý trước khi bỏ." },
        { word: "粗大ゴミ", reading: "そだいゴミ", meaning: "Rác cồng kềnh (large/bulky garbage)", jlptLevel: "N4", example: "粗大ゴミの予約をネットでしました。", exampleReading: "そだいゴミのよやくをネットでしました。", exampleMeaning: "Đã đặt lịch đổ rác lớn online.", usageNote: "Ghế, bàn, nệm, tivi... Đặt lịch: 電話 or NET. Mua 粗大ゴミシール (200-2000¥ tùy size). Dán + để chỗ chỉ định đúng ngày." },
        { word: "分別", reading: "ぶんべつ", meaning: "Phân loại (sorting/separating)", jlptLevel: "N4", example: "ゴミの分別を間違えると回収されません。", exampleReading: "ゴミのぶんべつをまちがえるとかいしゅうされません。", exampleMeaning: "Phân loại sai thì không thu gom.", usageNote: "Sai → dán sticker đỏ 'ルール違反' trả lại. Nhiều lần: 管理人/自治会 nhắc. App: ゴミ分別アプリ (mỗi thành phố có). Tip: ペットボトル rửa + bỏ 蓋+ラベル riêng." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("📋 Procedures batch 4...");
  await runBatch(client, cards, "Procedures-4");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
