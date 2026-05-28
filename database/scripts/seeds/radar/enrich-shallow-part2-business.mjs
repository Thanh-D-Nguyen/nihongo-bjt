/**
 * Enrich shallow radar cards — Part 2: Business & Office
 * Cards: meetings, emails, interviews, reports, keigo nuances
 * ~17 cards enriched with full japaneseExpressions objects
 */
import { createClient, upsertRadarCard, MODULES } from "./radar-seed-helpers.mjs";

const CARDS = [
  {
    slug: "report-delay-to-manager",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Báo cáo trễ deadline cho sếp",
    titleJa: "納期遅延を上司に報告する",
    descriptionVi: "Cách báo tin xấu một cách chuyên nghiệp.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "office",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_business", "hourensou"],
      japaneseExpressions: [
        { word: "納期", reading: "のうき", meaning: "Deadline giao hàng", example: "納期に間に合わない可能性があります。", jlptLevel: "N2", usageNote: "Khác 締め切り(deadline chung) — 納期 chuyên về delivery." },
        { word: "遅延", reading: "ちえん", meaning: "Trễ, chậm trễ", example: "プロジェクトに1週間の遅延が発生しています。", jlptLevel: "N2", usageNote: "遅延が発生する = xảy ra chậm trễ (cách nói formal)." },
        { word: "報告", reading: "ほうこく", meaning: "Báo cáo", example: "進捗状況をご報告いたします。", jlptLevel: "N3", usageNote: "報連相(hou-ren-sou) = 報告+連絡+相談 — core skill." },
        { word: "申し訳ございません", reading: "もうしわけございません", meaning: "Xin lỗi (formal nhất)", example: "ご迷惑をおかけして申し訳ございません。", jlptLevel: "N3", usageNote: "Luôn xin lỗi TRƯỚC khi giải thích lý do." },
        { word: "対策", reading: "たいさく", meaning: "Biện pháp đối phó", example: "今後の対策として、チェック体制を強化します。", jlptLevel: "N2", usageNote: "Khi báo lỗi, luôn kèm 対策 — sếp sẽ đánh giá cao." }
      ],
      contentGoal: "Báo cáo tin xấu theo chuẩn 報連相 chuyên nghiệp."
    },
  },
  {
    slug: "reschedule-meeting-politely",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Xin đổi lịch họp lịch sự",
    titleJa: "会議の日程変更をお願いする",
    descriptionVi: "Cách yêu cầu đổi lịch mà không gây khó chịu.",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "office",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["written_business", "keigo"],
      japaneseExpressions: [
        { word: "日程変更", reading: "にっていへんこう", meaning: "Thay đổi lịch trình", example: "日程変更のお願いでご連絡いたしました。", jlptLevel: "N2", usageNote: "Dùng trong email — đi thẳng vào subject." },
        { word: "ご調整いただけますでしょうか", reading: "ごちょうせいいただけますでしょうか", meaning: "Có thể điều chỉnh giúp được không ạ?", example: "お忙しいところ恐れ入りますが、ご調整いただけますでしょうか。", jlptLevel: "N2", usageNote: "Cách xin đổi lịch lịch sự nhất — cushion + request." },
        { word: "ご都合", reading: "ごつごう", meaning: "Lịch trình, sự tiện (kính ngữ)", example: "ご都合のよい日時をお知らせください。", jlptLevel: "N3", usageNote: "Luôn dùng ご khi hỏi lịch người khác." },
        { word: "候補日", reading: "こうほび", meaning: "Ngày ứng viên (đề xuất)", example: "候補日を3つほどお送りします。", jlptLevel: "N2", usageNote: "Đề xuất 2-3 ngày để đối phương chọn." },
        { word: "急用", reading: "きゅうよう", meaning: "Việc gấp", example: "急用が入ってしまい、大変申し訳ありません。", jlptLevel: "N3", usageNote: "Lý do hợp lý để đổi lịch — không cần chi tiết." }
      ],
      contentGoal: "Đổi lịch họp bằng email keigo chuẩn mực."
    },
  },
  {
    slug: "unclear-instruction-senpai",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Khi không hiểu chỉ thị của senpai",
    titleJa: "先輩の指示が曖昧なとき",
    descriptionVi: "Cách hỏi lại mà không làm mất mặt ai.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "office",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_business", "hourensou"],
      japaneseExpressions: [
        { word: "確認させてください", reading: "かくにんさせてください", meaning: "Cho tôi xác nhận lại", example: "念のため確認させてください。", jlptLevel: "N3", usageNote: "Cách mở đầu an toàn khi muốn hỏi lại." },
        { word: "念のため", reading: "ねんのため", meaning: "Để chắc chắn, phòng trường hợp", example: "念のため、期限は金曜ということでよろしいですか？", jlptLevel: "N3", usageNote: "Cushion phrase giúp câu hỏi không aggressive." },
        { word: "つまり", reading: "つまり", meaning: "Tức là, nói cách khác", example: "つまり、A案で進めるということですね？", jlptLevel: "N3", usageNote: "Dùng để paraphrase lại hiểu biết của mình." },
        { word: "認識合わせ", reading: "にんしきあわせ", meaning: "Đồng bộ nhận thức", example: "認識合わせのために確認させてください。", jlptLevel: "N1", usageNote: "Business term — 'align understanding'." },
        { word: "具体的には", reading: "ぐたいてきには", meaning: "Cụ thể là...", example: "具体的にはどのような形式がよいでしょうか？", jlptLevel: "N2", usageNote: "Dùng khi chỉ thị mơ hồ — yêu cầu chi tiết hơn." }
      ],
      contentGoal: "Hỏi lại chỉ thị mơ hồ mà không gây mất mặt."
    },
  },
  {
    slug: "complaint-first-response",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Câu đầu tiên khi bị phàn nàn",
    titleJa: "クレーム対応の第一声",
    descriptionVi: "Phản ứng đầu tiên đúng chuẩn khi khách phàn nàn.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "office",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_business", "customer_service"],
      japaneseExpressions: [
        { word: "ご不便をおかけし", reading: "ごふべんをおかけし", meaning: "Gây bất tiện cho (quý khách)", example: "ご不便をおかけし、誠に申し訳ございません。", jlptLevel: "N2", usageNote: "Câu mở đầu CHUẨN cho クレーム対応." },
        { word: "お詫び申し上げます", reading: "おわびもうしあげます", meaning: "Xin thành thật xin lỗi", example: "ご迷惑をおかけしましたことを深くお詫び申し上げます。", jlptLevel: "N2", usageNote: "Level cao nhất của xin lỗi — dùng với khách hàng." },
        { word: "お気持ちはよくわかります", reading: "おきもちはよくわかります", meaning: "Tôi rất hiểu cảm xúc của quý khách", example: "お客様のお気持ちはよくわかります。", jlptLevel: "N3", usageNote: "Empathy phrase — cho thấy bạn lắng nghe." },
        { word: "早急に対応いたします", reading: "そうきゅうにたいおういたします", meaning: "Sẽ xử lý ngay lập tức", example: "この件、早急に対応いたします。", jlptLevel: "N2", usageNote: "Cam kết hành động — sau xin lỗi phải có next step." },
        { word: "今後このようなことがないよう", reading: "こんごこのようなことがないよう", meaning: "Để từ nay không xảy ra nữa", example: "今後このようなことがないよう、改善してまいります。", jlptLevel: "N2", usageNote: "Kết thúc = cam kết cải thiện (改善)." }
      ],
      contentGoal: "Xử lý phàn nàn khách hàng chuẩn business Nhật."
    },
  },
  {
    slug: "meeting-action-items",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Nghe và ghi Action Items trong họp",
    titleJa: "会議のToDoを聞き取る",
    descriptionVi: "Bắt keywords quan trọng: ai làm gì, deadline nào.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N3",
    visualTheme: "office",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["listening_business", "meetings"],
      japaneseExpressions: [
        { word: "担当", reading: "たんとう", meaning: "Phụ trách, người đảm nhiệm", example: "この件の担当は田中さんです。", jlptLevel: "N3", usageNote: "Key word — khi nghe thấy = ai đó được assign task." },
        { word: "期限", reading: "きげん", meaning: "Deadline, thời hạn", example: "期限は来週の金曜日です。", jlptLevel: "N3", usageNote: "= deadline. Đồng nghĩa: 締め切り, 納期." },
        { word: "対応", reading: "たいおう", meaning: "Xử lý, đối ứng", example: "佐藤さんが対応してくれます。", jlptLevel: "N3", usageNote: "Rất thường nghe trong họp — 'handle/deal with'." },
        { word: "議事録", reading: "ぎじろく", meaning: "Biên bản cuộc họp", example: "議事録は明日までに共有します。", jlptLevel: "N2", usageNote: "Người mới thường được giao viết 議事録." },
        { word: "確認事項", reading: "かくにんじこう", meaning: "Các mục cần xác nhận", example: "確認事項を整理しました。", jlptLevel: "N2", usageNote: "Thường ở cuối họp — danh sách việc cần check." }
      ],
      contentGoal: "Nghe họp tiếng Nhật và nắm được action items."
    },
  },
  {
    slug: "soft-refusal-client",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Từ chối mềm với khách hàng",
    titleJa: "クライアントにやんわり断る",
    descriptionVi: "Nói 'không' mà không nói 'không' — nghệ thuật Nhật.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "office",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["spoken_business", "negotiation"],
      japaneseExpressions: [
        { word: "難しいかもしれません", reading: "むずかしいかもしれません", meaning: "Có lẽ khó...", example: "その納期だと少し難しいかもしれません。", jlptLevel: "N3", usageNote: "= 'Không được' trong 90% trường hợp business." },
        { word: "別案をご提案します", reading: "べつあんをごていあんします", meaning: "Xin đề xuất phương án khác", example: "代わりに別案をご提案させていただきます。", jlptLevel: "N2", usageNote: "Từ chối + ngay lập tức đưa alternative = chuyên nghiệp." },
        { word: "社内で検討させてください", reading: "しゃないでけんとうさせてください", meaning: "Cho tôi bàn nội bộ", example: "持ち帰って社内で検討させてください。", jlptLevel: "N2", usageNote: "= 'Tôi không quyết được ngay' — mua thời gian lịch sự." },
        { word: "ご期待に沿えず", reading: "ごきたいにそえず", meaning: "Không đáp ứng được kỳ vọng", example: "ご期待に沿えず申し訳ございません。", jlptLevel: "N1", usageNote: "Câu chuẩn khi phải chính thức từ chối." },
        { word: "前向きに検討しますが", reading: "まえむきにけんとうしますが", meaning: "Sẽ cân nhắc tích cực nhưng...", example: "前向きに検討しますが、お約束はできかねます。", jlptLevel: "N2", usageNote: "Vẫn là từ chối mềm — đừng hiểu là 'yes'." }
      ],
      contentGoal: "Từ chối khéo léo theo chuẩn business Nhật."
    },
  },
  {
    slug: "kentou-shimasu-real-meaning",
    moduleConfigId: MODULES.honne_tatemae,
    titleVi: "「検討します」 — đồng ý hay từ chối?",
    titleJa: "「検討します」の本当の意味",
    descriptionVi: "Giải mã câu nổi tiếng nhất trong business Nhật.",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "lightbulb",
    priority: 95,
    metadata: {
      seed: true,
      skills: ["cultural_literacy", "business_nuance"],
      japaneseExpressions: [
        { word: "検討します", reading: "けんとうします", meaning: "Sẽ cân nhắc (thường = từ chối)", example: "ご提案は検討します。", jlptLevel: "N3", usageNote: "80% trường hợp = 'Không, nhưng tôi nói lịch sự.' Context quyết định." },
        { word: "前向きに検討します", reading: "まえむきにけんとうします", meaning: "Sẽ cân nhắc tích cực (50/50)", example: "前向きに検討させていただきます。", jlptLevel: "N2", usageNote: "Có 前向きに = khả năng yes cao hơn, nhưng vẫn không chắc." },
        { word: "持ち帰って検討します", reading: "もちかえってけんとうします", meaning: "Tôi mang về (công ty) để xem xét", example: "一度持ち帰って検討させてください。", jlptLevel: "N2", usageNote: "Cần hỏi lại sếp — có thể chân thành hoặc từ chối." },
        { word: "善処します", reading: "ぜんしょします", meaning: "Sẽ xử lý thích hợp (= prob no)", example: "善処いたします。", jlptLevel: "N1", usageNote: "Chính trị gia hay dùng — gần như = 'no'." },
        { word: "お気持ちはありがたいのですが", reading: "おきもちはありがたいのですが", meaning: "Cảm ơn thiện ý nhưng...", example: "お気持ちはありがたいのですが、今回は見送らせてください。", jlptLevel: "N2", usageNote: "Từ chối rõ ràng nhất (trong phạm vi lịch sự Nhật)." }
      ],
      contentGoal: "Đọc được ý thật sau những câu 'cân nhắc' trong business."
    },
  },
  {
    slug: "muzukashii-kamoshiremasen",
    moduleConfigId: MODULES.honne_tatemae,
    titleVi: "「少し難しいかもしれません」の真意",
    titleJa: "「少し難しいかもしれません」= No?",
    descriptionVi: "Tại sao 'hơi khó' thường có nghĩa 'không được'.",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N3",
    visualTheme: "lightbulb",
    priority: 90,
    metadata: {
      seed: true,
      skills: ["cultural_literacy", "business_nuance"],
      japaneseExpressions: [
        { word: "少し難しいかもしれません", reading: "すこしむずかしいかもしれません", meaning: "Hơi khó (= Không được đâu)", example: "来週の金曜は少し難しいかもしれません。", jlptLevel: "N3", usageNote: "Trong business Nhật, 'hơi khó' = 'NO'. Đây là soft refusal." },
        { word: "ちょっと厳しいですね", reading: "ちょっときびしいですね", meaning: "Hơi khắt khe/khó đấy (= No)", example: "その予算だとちょっと厳しいですね。", jlptLevel: "N3", usageNote: "Informal hơn nhưng cùng meaning — dùng với đồng nghiệp." },
        { word: "お約束できかねます", reading: "おやくそくできかねます", meaning: "Không thể hứa được", example: "品質面ではお約束できかねます。", jlptLevel: "N2", usageNote: "Từ chối rõ ràng hơn — dùng khi cần nói thẳng." },
        { word: "別の方法を考えましょう", reading: "べつのほうほうをかんがえましょう", meaning: "Hãy nghĩ cách khác", example: "この方向は難しいので、別の方法を考えましょう。", jlptLevel: "N3", usageNote: "Redirect = cách từ chối constructive nhất." },
        { word: "ご要望に沿いかねる", reading: "ごようぼうにそいかねる", meaning: "Không thể đáp ứng yêu cầu", example: "申し訳ありませんが、ご要望に沿いかねる状況です。", jlptLevel: "N1", usageNote: "Formal written refusal — dùng trong email." }
      ],
      contentGoal: "Hiểu 'difficult' trong tiếng Nhật business = 'no'."
    },
  },
  {
    slug: "maemuki-ni-kentou",
    moduleConfigId: MODULES.honne_tatemae,
    titleVi: "「前向きに検討します」 hiểu sao?",
    titleJa: "「前向きに検討します」を解読する",
    descriptionVi: "Positive sounding nhưng có thật sự positive?",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N2",
    visualTheme: "lightbulb",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["cultural_literacy", "business_nuance"],
      japaneseExpressions: [
        { word: "前向きに検討します", reading: "まえむきにけんとうします", meaning: "Sẽ xem xét tích cực (50/50)", example: "前向きに検討させていただきます。", jlptLevel: "N2", usageNote: "Hơn 検討します nhưng vẫn chưa phải cam kết." },
        { word: "社内で確認します", reading: "しゃないでかくにんします", meaning: "Tôi xác nhận nội bộ", example: "社内で確認して、来週ご連絡します。", jlptLevel: "N3", usageNote: "Cần follow-up — nếu 1 tuần không reply = probably no." },
        { word: "方向性としては賛成です", reading: "ほうこうせいとしてはさんせいです", meaning: "Về hướng đi thì đồng ý", example: "方向性としては賛成ですが、詳細はこれからですね。", jlptLevel: "N2", usageNote: "= 'Ý tưởng ok nhưng chưa approve details'." },
        { word: "実現可能性を確認します", reading: "じつげんかのうせいをかくにんします", meaning: "Xác nhận tính khả thi", example: "技術面での実現可能性を確認します。", jlptLevel: "N2", usageNote: "= 'Chưa chắc làm được, để check'." },
        { word: "具体的に詰めましょう", reading: "ぐたいてきにつめましょう", meaning: "Hãy bàn chi tiết cụ thể", example: "方向性はOKなので、具体的に詰めましょう。", jlptLevel: "N2", usageNote: "Khi nghe câu này = thật sự muốn tiến hành — POSITIVE." }
      ],
      contentGoal: "Phân biệt mức độ 'yes' thật sự trong business Nhật."
    },
  },
  {
    slug: "seasonal-greeting-email",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Email chào theo mùa (thời hậu)",
    titleJa: "季節の挨拶メール",
    descriptionVi: "Câu mở đầu email theo mùa — kỹ năng business Nhật chuẩn.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "email",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["written_business", "cultural_literacy"],
      japaneseExpressions: [
        { word: "時下ますますご清栄のこととお喜び申し上げます", reading: "じかますますごせいえいのこととおよろこびもうしあげます", meaning: "Kính chúc quý công ty ngày càng phát triển", example: "時下ますますご清栄のこととお喜び申し上げます。", jlptLevel: "N1", usageNote: "Câu mở đầu email formal nhất — dùng mọi mùa." },
        { word: "お世話になっております", reading: "おせわになっております", meaning: "Cảm ơn đã quan tâm (greeting)", example: "いつもお世話になっております。", jlptLevel: "N3", usageNote: "Câu mở đầu email phổ biến nhất — dùng hàng ngày." },
        { word: "残暑お見舞い申し上げます", reading: "ざんしょおみまいもうしあげます", meaning: "Lời hỏi thăm mùa hè muộn", example: "残暑お見舞い申し上げます。", jlptLevel: "N1", usageNote: "Dùng sau 立秋(đầu tháng 8) — kết thúc mùa hè." },
        { word: "年末のご挨拶", reading: "ねんまつのごあいさつ", meaning: "Lời chào cuối năm", example: "年末のご挨拶を申し上げます。", jlptLevel: "N2", usageNote: "Email cuối năm trước nghỉ — quan trọng cho関係維持." },
        { word: "本年もよろしくお願いいたします", reading: "ほんねんもよろしくおねがいいたします", meaning: "Năm nay cũng xin nhờ nhiều", example: "本年もどうぞよろしくお願いいたします。", jlptLevel: "N3", usageNote: "Email đầu năm — gửi cho tất cả đối tác." }
      ],
      contentGoal: "Viết email theo mùa chuẩn business Nhật."
    },
  },
  {
    slug: "client-follow-up-email-j2",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Email follow-up khách hàng (N2)",
    titleJa: "取引先へのフォローアップメール",
    descriptionVi: "Nhắc khách mà không gây áp lực — keigo level cao.",
    category: "business",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "email",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["written_business", "keigo"],
      japaneseExpressions: [
        { word: "進捗はいかがでしょうか", reading: "しんちょくはいかがでしょうか", meaning: "Tiến độ thế nào ạ?", example: "先日の件、その後進捗はいかがでしょうか。", jlptLevel: "N2", usageNote: "Cách hỏi status lịch sự — không gây áp lực." },
        { word: "ご連絡ありがとうございます", reading: "ごれんらくありがとうございます", meaning: "Cảm ơn đã liên lạc", example: "お忙しいところご連絡ありがとうございます。", jlptLevel: "N3", usageNote: "Mở đầu reply — luôn cảm ơn trước." },
        { word: "ご検討状況", reading: "ごけんとうじょうきょう", meaning: "Tình hình xem xét", example: "ご検討状況をお聞かせいただけますと幸いです。", jlptLevel: "N2", usageNote: "Hỏi progress nhẹ nhàng — 'nếu được biết thì tốt'." },
        { word: "お忙しいところ恐れ入りますが", reading: "おいそがしいところおそれいりますが", meaning: "Biết rằng quý khách bận, xin thứ lỗi", example: "お忙しいところ恐れ入りますが、ご確認のほどよろしくお願いいたします。", jlptLevel: "N2", usageNote: "Cushion phrase chuẩn — đặt trước request." },
        { word: "お手すきの際に", reading: "おてすきのさいに", meaning: "Khi nào rảnh", example: "お手すきの際にご確認いただけますと幸いです。", jlptLevel: "N1", usageNote: "Cách nói 'không gấp' rất lịch sự — giảm áp lực." }
      ],
      contentGoal: "Follow-up khách hàng bằng email keigo chuyên nghiệp."
    },
  },
  {
    slug: "interview-tenshoku-reason",
    moduleConfigId: MODULES.interview_career,
    titleVi: "Trả lời lý do chuyển việc (phỏng vấn)",
    titleJa: "転職理由の答え方",
    descriptionVi: "Nói lý do nghỉ việc cũ một cách positive.",
    category: "career",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "career",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["spoken_business", "interview"],
      japaneseExpressions: [
        { word: "転職理由", reading: "てんしょくりゆう", meaning: "Lý do chuyển việc", example: "転職理由を教えていただけますか？", jlptLevel: "N2", usageNote: "Câu hỏi bắt buộc trong mọi cuộc phỏng vấn." },
        { word: "成長機会", reading: "せいちょうきかい", meaning: "Cơ hội phát triển", example: "より大きな成長機会を求めて転職を決意しました。", jlptLevel: "N2", usageNote: "Lý do positive — không nói xấu công ty cũ." },
        { word: "スキルアップ", reading: "すきるあっぷ", meaning: "Nâng cao kỹ năng", example: "新しい環境でスキルアップしたいと考えています。", jlptLevel: "N3", usageNote: "Wasei-eigo nhưng rất tự nhiên trong phỏng vấn." },
        { word: "御社の〇〇に魅力を感じ", reading: "おんしゃの〇〇にみりょくをかんじ", meaning: "Cảm thấy hấp dẫn bởi XX của quý công ty", example: "御社のグローバルな環境に魅力を感じました。", jlptLevel: "N2", usageNote: "Link lý do nghỉ → lý do chọn công ty mới = answer hoàn hảo." },
        { word: "前職では", reading: "ぜんしょくでは", meaning: "Ở công ty trước", example: "前職では5年間営業を担当しておりました。", jlptLevel: "N2", usageNote: "Mô tả kinh nghiệm — dùng ておりました (khiêm nhường)." }
      ],
      contentGoal: "Trả lời lý do chuyển việc positive, tự tin."
    },
  },
  {
    slug: "self-pr-japanese",
    moduleConfigId: MODULES.interview_career,
    titleVi: "Tự PR bản thân (phỏng vấn Nhật)",
    titleJa: "面接での自己PR",
    descriptionVi: "Cách giới thiệu điểm mạnh theo format Nhật.",
    category: "career",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "career",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["spoken_business", "interview"],
      japaneseExpressions: [
        { word: "自己PR", reading: "じこぴーあーる", meaning: "Tự quảng bá bản thân", example: "自己PRをお願いします。", jlptLevel: "N2", usageNote: "Câu hỏi chắc chắn có — chuẩn bị 1-2 phút nói." },
        { word: "強み", reading: "つよみ", meaning: "Điểm mạnh", example: "私の強みはコミュニケーション力です。", jlptLevel: "N2", usageNote: "Nêu 1 điểm mạnh + ví dụ cụ thể = pattern chuẩn." },
        { word: "成果", reading: "せいか", meaning: "Thành quả, kết quả", example: "前職で売上20%アップという成果を出しました。", jlptLevel: "N2", usageNote: "Dùng số liệu cụ thể → convincing hơn." },
        { word: "貢献できる", reading: "こうけんできる", meaning: "Có thể đóng góp", example: "御社でも同様に貢献できると考えております。", jlptLevel: "N2", usageNote: "Kết thúc PR = link sang contribution cho công ty mới." },
        { word: "チームワーク", reading: "ちーむわーく", meaning: "Tinh thần đồng đội", example: "チームワークを大切にして仕事に取り組んでいます。", jlptLevel: "N3", usageNote: "Công ty Nhật cực kỳ coi trọng — ưu tiên nêu." }
      ],
      contentGoal: "Tự PR bằng tiếng Nhật chuẩn format phỏng vấn."
    },
  },
  {
    slug: "salary-condition-politeness",
    moduleConfigId: MODULES.interview_career,
    titleVi: "Hỏi về lương / điều kiện lịch sự",
    titleJa: "条件面を丁寧に確認する",
    descriptionVi: "Cách hỏi lương, OT, remote mà không bị đánh giá xấu.",
    category: "career",
    estimatedMinutes: 4,
    levelLabel: "N2",
    visualTheme: "career",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["spoken_business", "interview"],
      japaneseExpressions: [
        { word: "条件面", reading: "じょうけんめん", meaning: "Mặt điều kiện (lương, phúc lợi)", example: "条件面についてお伺いしてもよろしいでしょうか。", jlptLevel: "N2", usageNote: "Cách hỏi về lương gián tiếp — không nói thẳng '給料'." },
        { word: "残業", reading: "ざんぎょう", meaning: "Tăng ca", example: "月の平均残業時間はどのくらいでしょうか。", jlptLevel: "N3", usageNote: "Hỏi được nhưng tránh để thành câu hỏi đầu tiên." },
        { word: "リモート", reading: "りもーと", meaning: "Làm việc từ xa", example: "リモートワークの制度はございますか。", jlptLevel: "N3", usageNote: "Post-COVID nhiều công ty có — hỏi bình thường." },
        { word: "福利厚生", reading: "ふくりこうせい", meaning: "Phúc lợi", example: "福利厚生について教えていただけますか。", jlptLevel: "N2", usageNote: "Bao gồm bảo hiểm, nghỉ phép, trợ cấp nhà..." },
        { word: "年収", reading: "ねんしゅう", meaning: "Thu nhập năm", example: "希望年収は450万円程度です。", jlptLevel: "N2", usageNote: "Ở Nhật tính theo năm, không theo tháng." }
      ],
      contentGoal: "Hỏi về điều kiện làm việc một cách chuyên nghiệp."
    },
  },
  {
    slug: "today-small-talk-office",
    moduleConfigId: MODULES.workplace_mission,
    titleVi: "Small talk đầu ngày ở văn phòng",
    titleJa: "朝のちょっとした雑談",
    descriptionVi: "Câu chuyện nhỏ buổi sáng — xây dựng quan hệ.",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "office",
    priority: 80,
    metadata: {
      seed: true,
      skills: ["spoken_daily", "relationship"],
      japaneseExpressions: [
        { word: "週末はどうでしたか", reading: "しゅうまつはどうでしたか", meaning: "Cuối tuần thế nào?", example: "週末はどうでしたか？どこか行きましたか？", jlptLevel: "N4", usageNote: "Câu mở đầu Monday morning phổ biến nhất." },
        { word: "電車が遅れていましたね", reading: "でんしゃがおくれていましたね", meaning: "Tàu bị trễ nhỉ", example: "今朝、電車が遅れていましたね。大変でしたか？", jlptLevel: "N4", usageNote: "Topic an toàn — ai cũng relate được." },
        { word: "天気いいですね", reading: "てんきいいですね", meaning: "Trời đẹp nhỉ", example: "今日は天気いいですね。お花見日和ですよ。", jlptLevel: "N5", usageNote: "Small talk vạn năng — mọi mùa dùng được." },
        { word: "お疲れ様です", reading: "おつかれさまです", meaning: "Xin chào (nội bộ, cả ngày)", example: "お疲れ様です。昨日の件、ありがとうございました。", jlptLevel: "N4", usageNote: "Greeting vạn năng nội bộ — sáng/trưa/chiều đều OK." },
        { word: "最近どうですか", reading: "さいきんどうですか", meaning: "Dạo này thế nào?", example: "最近どうですか？忙しそうですね。", jlptLevel: "N4", usageNote: "Mở đầu conversation casual với đồng nghiệp." }
      ],
      contentGoal: "Xây dựng quan hệ qua small talk tự nhiên."
    },
  },
  {
    slug: "train-delay-report",
    moduleConfigId: MODULES.transport_commute,
    titleVi: "Báo trễ vì tàu bị delay",
    titleJa: "電車遅延で遅刻を報告する",
    descriptionVi: "Message đúng chuẩn khi tàu trễ và bạn sẽ muộn.",
    category: "business",
    estimatedMinutes: 3,
    levelLabel: "N4",
    visualTheme: "transport",
    priority: 85,
    metadata: {
      seed: true,
      skills: ["written_business", "hourensou"],
      japaneseExpressions: [
        { word: "電車遅延", reading: "でんしゃちえん", meaning: "Tàu bị trễ", example: "電車遅延のため、出社が遅れます。", jlptLevel: "N3", usageNote: "Message lúc sáng sớm cho sếp/nhóm." },
        { word: "到着が遅れます", reading: "とうちゃくがおくれます", meaning: "Sẽ đến muộn", example: "10分ほど到着が遅れます。申し訳ありません。", jlptLevel: "N3", usageNote: "Ước tính thời gian — luôn nêu cụ thể." },
        { word: "遅延証明書", reading: "ちえんしょうめいしょ", meaning: "Giấy chứng nhận trễ tàu", example: "遅延証明書をもらってきます。", jlptLevel: "N2", usageNote: "Lấy ở ga khi tàu trễ — công ty chấp nhận làm bằng chứng." },
        { word: "振替輸送", reading: "ふりかえゆそう", meaning: "Chuyển sang tuyến khác (miễn phí)", example: "振替輸送で別ルートを使います。", jlptLevel: "N2", usageNote: "Khi tuyến tàu bị dừng — dùng tuyến khác free." },
        { word: "ご迷惑をおかけします", reading: "ごめいわくをおかけします", meaning: "Xin lỗi đã gây phiền", example: "ご迷惑をおかけして申し訳ございません。", jlptLevel: "N3", usageNote: "Kết thúc message = lịch sự, trách nhiệm." }
      ],
      contentGoal: "Báo trễ vì tàu delay đúng chuẩn business."
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("[enrich-part2] Enriching business/office cards...");

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
  console.log(`[enrich-part2] Done: ${ok} enriched, ${fail} failed.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
