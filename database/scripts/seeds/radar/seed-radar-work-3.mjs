/**
 * Radar Seed: Work Advanced batch 3 (10 cards)
 * Topics: meetings, nomikai, promotion, resignation, freelance, harassment, manners
 * Run: node scripts/seed-radar-work-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_WORK = MODULES.workplace_mission;
const M_INT = MODULES.interview_career;

const cards = [
  {
    slug: "meeting-culture-kaigi",
    moduleConfigId: M_WORK,
    titleVi: "会議 — Văn hóa họp ở Nhật",
    titleJa: "日本の会議マナー",
    descriptionVi: "Họp ở Nhật — quy tắc, từ vựng, cách phát biểu, nemawashi.",
    recommendationReasonVi: "Nhật: họp NHIỀU. Biết manner + từ vựng = tồn tại + thăng tiến.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["meeting", "business_culture", "communication"],
      contentGoal: "Biết quy tắc họp + cách phát biểu + nemawashi.",
      usageNote: "Quy tắc: đến SỚM 5分, 議事録 (biên bản) ai đó ghi, 根回し (nemawashi: thống nhất TRƯỚC họp), phát biểu: 'すみません、一点よろしいでしょうか' (xin phép nói 1 điểm). Kết: 確認事項 (confirm actions).",
      japaneseExpressions: [
        { word: "根回し", reading: "ねまわし", meaning: "Thống nhất trước (pre-meeting consensus building)", jlptLevel: "N2", example: "大事な提案は会議の前に根回ししておきましょう。", exampleReading: "だいじなていあんはかいぎのまえにねまわししておきましょう。", exampleMeaning: "Đề xuất quan trọng thì nemawashi trước.", usageNote: "= nói chuyện riêng với từng người TRƯỚC họp → họp chỉ confirm. Không làm = bị bác. Văn hóa Nhật core." },
        { word: "議事録", reading: "ぎじろく", meaning: "Biên bản họp (meeting minutes)", jlptLevel: "N3", example: "議事録を共有してください。", exampleReading: "ぎじろくをきょうゆうしてください。", exampleMeaning: "Chia sẻ biên bản họp.", usageNote: "新人/若手 thường ghi. Format: 日時, 参加者, 議題, 決定事項, 次回アクション. Gửi nội ngày." },
        { word: "アジェンダ", reading: "アジェンダ", meaning: "Chương trình họp (agenda)", jlptLevel: "N3", example: "会議のアジェンダを事前に送ってください。", exampleReading: "かいぎのアジェンダをじぜんにおくってください。", exampleMeaning: "Gửi agenda trước cuộc họp.", usageNote: "Gửi 前日 tối hoặc sáng. 所要時間 (thời lượng) ghi. Không agenda = họp loãng." }
      ]
    }
  },
  {
    slug: "nomikai-drinking-party",
    moduleConfigId: M_WORK,
    titleVi: "飲み会 — Tiệc nhậu công ty",
    titleJa: "飲み会のマナーと断り方",
    descriptionVi: "Nomikai — quy tắc, vai trò, cách từ chối lịch sự.",
    recommendationReasonVi: "飲み会 = networking + bonding. Biết rule + cách nói không = balance.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 172,
    metadata: {
      seed: true,
      skills: ["drinking_party", "social_skills", "declining"],
      contentGoal: "Biết manner nomikai + cách từ chối khi cần.",
      usageNote: "Vai trò: 幹事 (tổ chức: đặt chỗ, thu tiền). Rule: rót cho 上司/先輩 (bia tay phải, đỡ tay trái), 「乾杯！」mở đầu, 一次会 (round 1) → 二次会 (round 2: karaoke). Từ chối: 「すみません、今日は予定があって...」(lịch sự).",
      japaneseExpressions: [
        { word: "幹事", reading: "かんじ", meaning: "Người tổ chức (party organizer)", jlptLevel: "N3", example: "今回の飲み会は私が幹事をします。", exampleReading: "こんかいののみかいはわたしがかんじをします。", exampleMeaning: "Lần này tôi tổ chức nomikai.", usageNote: "若手/新人 thường làm. Task: 店予約, 人数確認, 会計, 2次会手配. Tip: 予約 ホットペッパー." },
        { word: "二次会", reading: "にじかい", meaning: "Round 2 (after-party — thường karaoke)", jlptLevel: "N4", example: "二次会はカラオケに行きましょう。", exampleReading: "にじかいはカラオケにいきましょう。", exampleMeaning: "Round 2 đi karaoke nhé.", usageNote: "任意 (tuỳ ý) — từ chối OK: 「明日早いので、お先に失礼します」(mai sớm nên xin phép về)." },
        { word: "お酌", reading: "おしゃく", meaning: "Rót rượu cho người khác (pouring drinks)", jlptLevel: "N3", example: "上司のグラスが空いたらお酌しましょう。", exampleReading: "じょうしのグラスがあいたらおしゃくしましょう。", exampleMeaning: "Ly sếp trống thì rót.", usageNote: "ビール: label lên (ラベルを上に). 若手: xung quanh rót. 上司 rót cho bạn: 両手 で nhận. 2024: culture giảm dần." }
      ]
    }
  },
  {
    slug: "resignation-taishoku",
    moduleConfigId: M_INT,
    titleVi: "退職 — Nghỉ việc đúng cách",
    titleJa: "退職の手続きと流れ",
    descriptionVi: "Cách nghỉ việc ở Nhật — thời điểm, form, lưu ý, từ vựng.",
    recommendationReasonVi: "Nghỉ việc Nhật = quy trình. Làm sai = mất quyền lợi.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["resignation", "career", "procedure"],
      contentGoal: "Biết quy trình nghỉ việc đúng + bảo vệ quyền lợi.",
      usageNote: "Flow: 1) Nói trực tiếp 上司 (1-3 tháng trước). 2) 退職届 viết. 3) 引き継ぎ (bàn giao). 4) 有給消化 (dùng phép còn lại). 5) Ngày cuối. Luật: 2週間前 báo = đủ (nhưng 1ヶ月 = manner). 有給 = QUYỀN, đừng từ bỏ.",
      japaneseExpressions: [
        { word: "退職届", reading: "たいしょくとどけ", meaning: "Đơn xin nghỉ (resignation letter)", jlptLevel: "N3", example: "退職届を提出しました。", exampleReading: "たいしょくとどけをていしゅつしました。", exampleMeaning: "Đã nộp đơn nghỉ.", usageNote: "退職届 (chính thức, không rút) vs 退職願 (xin, có thể rút). Format: 手書き, 「一身上の都合」(lý do cá nhân). Đặt phong bì trắng." },
        { word: "引き継ぎ", reading: "ひきつぎ", meaning: "Bàn giao công việc (handover)", jlptLevel: "N3", example: "退職までに引き継ぎを完了させてください。", exampleReading: "たいしょくまでにひきつぎをかんりょうさせてください。", exampleMeaning: "Hoàn thành bàn giao trước khi nghỉ.", usageNote: "引き継ぎ書 (tài liệu bàn giao) viết. Dạy người thay. Responsible = đánh giá tốt → reference letter tốt." },
        { word: "有給消化", reading: "ゆうきゅうしょうか", meaning: "Dùng phép còn lại (using remaining paid leave)", jlptLevel: "N3", example: "退職前に有給消化で2週間休みます。", exampleReading: "たいしょくまえにゆうきゅうしょうかでにしゅうかんやすみます。", exampleMeaning: "Trước nghỉ việc dùng 2 tuần phép còn.", usageNote: "QUYỀN. Công ty KHÔNG được từ chối. Thường: 引き継ぎ xong → 有給消化 → 退職日. Plan: dùng HẾT." }
      ]
    }
  },
  {
    slug: "power-harassment-pawahara",
    moduleConfigId: M_WORK,
    titleVi: "パワハラ — Bạo lực quyền lực",
    titleJa: "パワハラの対処法",
    descriptionVi: "Nhận biết + đối phó power harassment ở Nhật — luật + kênh hỗ trợ.",
    recommendationReasonVi: "パワハラ phổ biến. Người nước ngoài = dễ bị target. Biết quyền = tự bảo vệ.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 190,
    metadata: {
      seed: true,
      skills: ["harassment", "labor_rights", "self_protection"],
      contentGoal: "Nhận biết パワハラ + biết kênh bảo vệ quyền lợi.",
      usageNote: "6 loại: 身体的 (đánh), 精神的 (mắng/bully), 人間関係 (cô lập), 過大要求 (việc quá sức), 過小要求 (việc dưới level), 個の侵害 (xâm phạm đời tư). 2020: 法律化 (luật). Kênh: 社内相談窓口, 労働基準監督署, 総合労働相談コーナー (FREE).",
      japaneseExpressions: [
        { word: "パワーハラスメント", reading: "パワーハラスメント", meaning: "Bạo lực quyền lực (power harassment)", jlptLevel: "N3", example: "パワハラを受けたら、証拠を残して相談しましょう。", exampleReading: "パワハラをうけたら、しょうこをのこしてそうだんしましょう。", exampleMeaning: "Bị パワハラ thì giữ bằng chứng và tư vấn.", usageNote: "証拠: メール保存, 録音 (hợp pháp ở Nhật), 日記記録. Đừng 1 mình chịu." },
        { word: "労働基準監督署", reading: "ろうどうきじゅんかんとくしょ", meaning: "Thanh tra lao động (labor standards office)", jlptLevel: "N2", example: "労働基準監督署に相談すれば、会社に指導が入ります。", exampleReading: "ろうどうきじゅんかんとくしょにそうだんすれば、かいしゃにしどうがはいります。", exampleMeaning: "Tư vấn thanh tra thì công ty bị nhắc nhở.", usageNote: "FREE. Đa ngôn ngữ (一部). Nặng: 是正勧告 (yêu cầu sửa). Quyền lợi: 解雇無効, 損害賠償." },
        { word: "相談窓口", reading: "そうだんまどぐち", meaning: "Quầy tư vấn (consultation desk)", jlptLevel: "N3", example: "社内の相談窓口に匿名で相談できます。", exampleReading: "しゃないのそうだんまどぐちにとくめいでそうだんできます。", exampleMeaning: "Tư vấn ẩn danh ở quầy trong công ty.", usageNote: "2022~: 全企業 bắt buộc có. 匿名 OK. 外部委託 (outsource) = an tâm hơn nội bộ." }
      ]
    }
  },
  {
    slug: "freelance-kojin-jigyo",
    moduleConfigId: M_INT,
    titleVi: "フリーランス — Làm tự do ở Nhật",
    titleJa: "フリーランスの始め方",
    descriptionVi: "Đăng ký freelance, thuế, bảo hiểm, invoice — từ vựng cần biết.",
    recommendationReasonVi: "Freelance Nhật tăng mạnh. Biết thủ tục = bắt đầu đúng cách.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 170,
    metadata: {
      seed: true,
      skills: ["freelance", "tax", "business_registration"],
      contentGoal: "Biết cách đăng ký freelance + nghĩa vụ thuế.",
      usageNote: "Bước: 開業届 (đăng ký kinh doanh, FREE, 税務署) + 青色申告承認 (khai thuế xanh: giảm 65万). Bảo hiểm: 国民健康保険 + 国民年金 (tự đóng). Invoice制度 (2023~): 登録番号 cần. 確定申告: 毎年 2-3月.",
      japaneseExpressions: [
        { word: "開業届", reading: "かいぎょうとどけ", meaning: "Đăng ký kinh doanh (business registration)", jlptLevel: "N3", example: "フリーランスを始める時は開業届を出します。", exampleReading: "フリーランスをはじめるときはかいぎょうとどけをだします。", exampleMeaning: "Bắt đầu freelance thì nộp đăng ký kinh doanh.", usageNote: "税務署. FREE. 1枚 form. Online: e-Tax. 開業freee (app) giúp điền." },
        { word: "青色申告", reading: "あおいろしんこく", meaning: "Khai thuế xanh (blue tax return — giảm 65万)", jlptLevel: "N2", example: "青色申告にすると最大65万円の控除が受けられます。", exampleReading: "あおいろしんこくにするとさいだいろくじゅうごまんえんのこうじょがうけられます。", exampleMeaning: "Khai thuế xanh được giảm tối đa 65 vạn.", usageNote: "白色 (trắng): đơn giản nhưng không giảm. 青色: sổ sách kỹ hơn → giảm 65万 (e-Tax) or 55万. Dùng: 会計ソフト (freee, マネーフォワード)." },
        { word: "インボイス制度", reading: "インボイスせいど", meaning: "Chế độ hóa đơn (invoice system — 2023~)", jlptLevel: "N2", example: "インボイス登録をしないと取引先に影響があります。", exampleReading: "インボイスとうろくをしないととりひきさきにえいきょうがあります。", exampleMeaning: "Không đăng ký invoice ảnh hưởng đối tác.", usageNote: "2023/10~. Đăng ký → 登録番号 (T+13 số). Không đăng ký: client không được khấu trừ消費税 → có thể mất deal." }
      ]
    }
  },
  {
    slug: "salary-negotiation-japan",
    moduleConfigId: M_INT,
    titleVi: "給料交渉 — Đàm phán lương",
    titleJa: "給料交渉のコツ",
    descriptionVi: "Khi nào + cách đàm phán lương ở Nhật — timing, phrase, data.",
    recommendationReasonVi: "Nhật: ít đàm phán lương. Nhưng ĐÚNG CÁCH = tăng thu nhập significant.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["salary", "negotiation", "career_growth"],
      contentGoal: "Biết khi nào + cách đàm phán lương ở Nhật.",
      usageNote: "Timing: 評価面談 (review), 転職offer, 昇進時. Cách: data-driven (市場相場 check: doda, openwork), 実績 nêu cụ thể, yêu cầu rõ (具体的な金額). Đừng: so sánh đồng nghiệp, đe dọa nghỉ. Nhật: 年功序列 giảm, 成果主義 tăng → đàm phán OK hơn.",
      japaneseExpressions: [
        { word: "昇給", reading: "しょうきゅう", meaning: "Tăng lương (salary raise)", jlptLevel: "N3", example: "今年の昇給は3%でした。", exampleReading: "ことしのしょうきゅうはさんパーセントでした。", exampleMeaning: "Năm nay tăng lương 3%.", usageNote: "Nhật: 年1回 (4月). ベースアップ (base-up: toàn công ty) + 定期昇給 (cá nhân). 2024: ベア 5%+ (cao nhất 30 năm)." },
        { word: "年収", reading: "ねんしゅう", meaning: "Thu nhập năm (annual income)", jlptLevel: "N3", example: "転職で年収が100万円上がりました。", exampleReading: "てんしょくでねんしゅうがひゃくまんえんあがりました。", exampleMeaning: "Đổi việc lương năm tăng 100 vạn.", usageNote: "Nhật: 年収 = tổng (lương + thưởng + 手当). 手取り (thực nhận) = ~75-80% 年収. Chuyển việc: cơ hội tăng 50-150万." },
        { word: "評価面談", reading: "ひょうかめんだん", meaning: "Phỏng vấn đánh giá (performance review meeting)", jlptLevel: "N3", example: "評価面談で来期の目標を話し合います。", exampleReading: "ひょうかめんだんでらいきのもくひょうをはなしあいます。", exampleMeaning: "Review đánh giá bàn mục tiêu kỳ tới.", usageNote: "年2回 hoặc 4回. Timing tốt nhất để nói chuyện lương. 自己評価シート viết trước." }
      ]
    }
  },
  {
    slug: "business-card-meishi",
    moduleConfigId: M_WORK,
    titleVi: "名刺交換 — Trao đổi danh thiếp",
    titleJa: "名刺交換のマナー",
    descriptionVi: "Cách trao/nhận danh thiếp đúng chuẩn business Nhật.",
    recommendationReasonVi: "名刺交換 = first impression. Sai = mất điểm ngay. Biết = chuyên nghiệp.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["business_card", "business_manner", "first_impression"],
      contentGoal: "Biết cách trao/nhận danh thiếp đúng chuẩn.",
      usageNote: "Rule: 1) Đứng trao. 2) Hai tay. 3) Tên hướng về người nhận. 4) Nhận = đọc tên + khen (会社名, 部署). 5) Không viết lên, không bỏ túi ngay. 6) Họp: đặt trên bàn theo thứ tự ngồi. 同時交換: cả 2 trao cùng lúc (tay phải đưa, tay trái nhận).",
      japaneseExpressions: [
        { word: "名刺入れ", reading: "めいしいれ", meaning: "Hộp đựng danh thiếp (card case)", jlptLevel: "N4", example: "名刺入れから名刺を出して両手で渡します。", exampleReading: "めいしいれからめいしをだしてりょうてでわたします。", exampleMeaning: "Rút danh thiếp từ hộp và trao bằng hai tay.", usageNote: "Leather/metal = professional. Không dùng: ví, túi quần. Đặt danh thiếp nhận lên 名刺入れ trong họp." },
        { word: "頂戴します", reading: "ちょうだいします", meaning: "Xin nhận (humble way to receive card)", jlptLevel: "N3", example: "「頂戴いたします」と言って名刺を受け取ります。", exampleReading: "「ちょうだいいたします」といってめいしをうけとります。", exampleMeaning: "Nói 'xin nhận' và nhận danh thiếp.", usageNote: "Nhận: 「頂戴します」hoặc「ちょうだいいたします」(formal hơn). Đọc tên: 「〇〇様ですね、よろしくお願いいたします」." },
        { word: "所属", reading: "しょぞく", meaning: "Phòng ban/bộ phận (department/affiliation)", jlptLevel: "N3", example: "名刺に所属と役職が書いてあります。", exampleReading: "めいしにしょぞくとやくしょくがかいてあります。", exampleMeaning: "Danh thiếp ghi phòng ban và chức vụ.", usageNote: "読み方 khó: hỏi lịch sự「お名前の読み方を教えていただけますか」. Ghi lại sau buổi gặp." }
      ]
    }
  },
  {
    slug: "work-from-home-telework",
    moduleConfigId: M_WORK,
    titleVi: "テレワーク — Làm việc từ xa",
    titleJa: "テレワークのマナーと環境整備",
    descriptionVi: "WFH ở Nhật — quy tắc, tools, từ vựng online meeting.",
    recommendationReasonVi: "Post-COVID: hybrid phổ biến. Biết manner online = chuyên nghiệp.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 160,
    metadata: {
      seed: true,
      skills: ["remote_work", "online_meeting", "productivity"],
      contentGoal: "Biết manner + tools WFH phổ biến ở Nhật.",
      usageNote: "Tools: Teams, Zoom, Google Meet, Slack, Chatwork. Manner: camera ON (nhiều công ty yêu cầu), mute khi không nói, 背景 (background) chỉnh, đúng giờ. 在宅勤務手当: 3000-5000¥/月 (phụ cấp điện/net).",
      japaneseExpressions: [
        { word: "在宅勤務", reading: "ざいたくきんむ", meaning: "Làm việc tại nhà (work from home)", jlptLevel: "N3", example: "週2日は在宅勤務にしています。", exampleReading: "しゅうふつかはざいたくきんむにしています。", exampleMeaning: "Tuần 2 ngày làm ở nhà.", usageNote: "= テレワーク = リモートワーク. ハイブリッド勤務 (hybrid) phổ biến nhất 2024." },
        { word: "画面共有", reading: "がめんきょうゆう", meaning: "Chia sẻ màn hình (screen share)", jlptLevel: "N4", example: "画面共有しますので、ご覧ください。", exampleReading: "がめんきょうゆうしますので、ごらんください。", exampleMeaning: "Chia sẻ màn hình, mời xem.", usageNote: "Trước share: đóng tab cá nhân, notification tắt. 「見えていますか？」(thấy chưa?) hỏi." },
        { word: "ミュート", reading: "ミュート", meaning: "Tắt mic (mute)", jlptLevel: "N4", example: "発言しない時はミュートにしてください。", exampleReading: "はつげんしないときはミュートにしてください。", exampleMeaning: "Không nói thì mute mic.", usageNote: "Nhật: NGHIÊM. Background noise = NG. Unmute chỉ khi nói. 「聞こえますか？」(nghe thấy không?) = mở đầu." }
      ]
    }
  },
  {
    slug: "overtime-zangyo-rules",
    moduleConfigId: M_WORK,
    titleVi: "残業 — OT và quyền lợi",
    titleJa: "残業のルールと権利",
    descriptionVi: "Luật OT Nhật — giới hạn, phụ cấp, cách từ chối, サービス残業.",
    recommendationReasonVi: "OT Nhật có LUẬT. Biết quyền = không bị bóc lột. サービス残業 = vi phạm.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N3-N2",
    estimatedMinutes: 3,
    priority: 185,
    metadata: {
      seed: true,
      skills: ["overtime", "labor_rights", "work_life_balance"],
      contentGoal: "Biết luật OT + quyền từ chối + cách khai báo.",
      usageNote: "Luật: max 45h/月, 360h/年 (36協定). Phụ cấp: 25% (thường), 50% (đêm 22-5時), 35% (nghỉ lễ). サービス残業 (OT không trả tiền) = VI PHẠM PHÁP LUẬT. Bằng chứng: メール送信時刻, PCログ, タイムカード写真.",
      japaneseExpressions: [
        { word: "サービス残業", reading: "サービスざんぎょう", meaning: "OT không lương (unpaid overtime — VI PHẠM)", jlptLevel: "N3", example: "サービス残業は法律違反です。", exampleReading: "サービスざんぎょうはほうりついはんです。", exampleMeaning: "OT không trả tiền là vi phạm luật.", usageNote: "= 無給残業. Phổ biến nhưng ILLEGAL. 証拠 giữ → 労基署 tố cáo → công ty trả + phạt." },
        { word: "36協定", reading: "さぶろくきょうてい", meaning: "Hiệp định 36 (overtime agreement — giới hạn OT)", jlptLevel: "N2", example: "36協定で月45時間までの残業が認められています。", exampleReading: "さぶろくきょうていでつきよんじゅうごじかんまでのざんぎょうがみとめられています。", exampleMeaning: "Hiệp định 36 cho phép OT tối đa 45h/tháng.", usageNote: "Không có 36協定 = OT 0 (BẮT BUỘC). 特別条項: max 100h/月 (temporary). 過労死ライン: 80h/月." },
        { word: "割増賃金", reading: "わりましちんぎん", meaning: "Phụ cấp OT (overtime premium pay)", jlptLevel: "N2", example: "深夜の割増賃金は50%です。", exampleReading: "しんやのわりましちんぎんはごじゅっパーセントです。", exampleMeaning: "Phụ cấp OT đêm là 50%.", usageNote: "時間外: 25%. 深夜(22-5時): +25% (total 50%). 休日: 35%. 月60h超: 50%. PHẢI trả." }
      ]
    }
  },
  {
    slug: "workplace-japanese-phrases",
    moduleConfigId: M_WORK,
    titleVi: "職場の定番フレーズ — Câu cửa miệng",
    titleJa: "職場で毎日使うフレーズ",
    descriptionVi: "Những câu nói HÀNG NGÀY ở công ty Nhật — phải thuộc lòng.",
    recommendationReasonVi: "Nói đúng câu đúng lúc = hòa nhập + chuyên nghiệp từ ngày 1.",
    category: "work",
    visualTheme: "blue_corporate",
    levelLabel: "N4-N3",
    estimatedMinutes: 3,
    priority: 192,
    metadata: {
      seed: true,
      skills: ["business_phrases", "daily_workplace", "communication"],
      contentGoal: "Thuộc các câu cửa miệng ở công ty Nhật.",
      usageNote: "Sáng: 「おはようございます」. Đi ra ngoài: 「行ってきます」→ 「行ってらっしゃい」. Về: 「ただいま戻りました」. Về cuối ngày: 「お先に失礼します」→ 「お疲れ様です」. Nhờ việc: 「お忙しいところすみません」. Xin lỗi: 「申し訳ございません」.",
      japaneseExpressions: [
        { word: "お疲れ様です", reading: "おつかれさまです", meaning: "Cảm ơn đã vất vả (goodbye/greeting colleagues)", jlptLevel: "N4", example: "「お先に失礼します」「お疲れ様です」", exampleReading: "「おさきにしつれいします」「おつかれさまです」", exampleMeaning: "'Xin phép về trước' — 'Vất vả rồi'", usageNote: "= câu dùng NHIỀU NHẤT. Chào, email mở đầu, khi ai về, khi gặp. Không dùng với 上司 theo strict rule (dùng「お疲れ様でございます」)." },
        { word: "承知しました", reading: "しょうちしました", meaning: "Đã hiểu/nhận (polite acknowledgment)", jlptLevel: "N3", example: "「明日までにお願いします」「承知しました」", exampleReading: "「あしたまでにおねがいします」「しょうちしました」", exampleMeaning: "'Nhờ xong trước ngày mai' — 'Đã nhận'", usageNote: "Formal hơn 「わかりました」. Email/với khách: luôn dùng 承知しました. 「かしこまりました」= formal nhất." },
        { word: "お忙しいところ恐れ入りますが", reading: "おいそがしいところおそれいりますが", meaning: "Xin lỗi làm phiền lúc bận (polite interruption)", jlptLevel: "N3", example: "お忙しいところ恐れ入りますが、ご確認をお願いできますでしょうか。", exampleReading: "おいそがしいところおそれいりますが、ごかくにんをおねがいできますでしょうか。", exampleMeaning: "Xin lỗi làm phiền, nhờ xác nhận được không ạ.", usageNote: "Email + nói trực tiếp. Khi nhờ ai đó (sếp, đồng nghiệp busy). Ngắn hơn: 「すみません、少しよろしいですか」." }
      ]
    }
  }
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("💼 Work Advanced batch 3...");
  await runBatch(client, cards, "Work-Advanced-3");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
