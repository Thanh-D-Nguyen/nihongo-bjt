/**
 * Career RPG Production Seed — R2 新入社員 (New Employee)
 * 3 arcs, 12 chapters: Hou-Ren-Sou + Phone reception + Business cards & visitors
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR2(client) {
  /* ═══ Arc 3: 報連相 基礎 ═══════════════════════════════════════════════ */
  const arc3Id = await upsertArc(client, {
    slug: "arc.hou-ren-sou", ja: "報連相 基礎", vi: "Nền tảng Hou-Ren-Sou (Báo-Liên-Bàn)",
    rank: "R2", order: 3,
    story: { synopsisVi: "報連相 là nền tảng giao tiếp công sở Nhật: Báo cáo (報告), Liên lạc (連絡), Tham vấn (相談). Nắm vững để tồn tại.", npcSlugs: ["yamada_bucho", "tanaka_senpai"], artAccent: "#0E7490" },
  });

  await upsertChapters(client, arc3Id, [
    {
      slug: "first-houkoku", ja: "初めての業務報告", vi: "Báo cáo công việc đầu tiên", order: 1, boss: false,
      briefing: { briefingJa: "入社して1週間。山田部長から「今日の進捗を報告してください」と言われました。初めての業務報告メールを書きます。", briefingVi: "Tuần đầu đi làm. Sếp Yamada yêu cầu báo cáo tiến độ hôm nay qua email.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_houkoku_01", scenarioType: "email", titleJa: "山田部長への業務報告メール", titleVi: "Email báo cáo công việc gửi sếp Yamada",
        contextSummaryVi: "Bạn đã hoàn thành sắp xếp hồ sơ khách hàng và bắt đầu học hệ thống nội bộ.", goalJa: "上司に分かりやすく、簡潔に業務報告を行う。", goalVi: "Báo cáo rõ ràng, ngắn gọn cho sếp.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "山田 部長", subjectJa: "【業務報告】本日の進捗について", bodyJa: "（選択する）", timestamp: "2026-04-14T17:00:00Z" }] },
        question: { id: "q_houkoku_01", skillTag: "written", difficulty: "easy",
          promptJa: "山田部長への業務報告メールとして最も適切なものはどれですか？",
          promptVi: "Email báo cáo công việc gửi sếp Yamada, phương án nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "山田部長\nお疲れ様です。本日の業務報告をいたします。\n\n1. 顧客ファイルの整理（完了）\n2. 社内システムの操作研修（進行中）\n\n明日は引き続きシステム研修を進める予定です。\nご不明点がございましたら、ご指示いただけますと幸いです。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "簡潔で分かりやすい報告です。", consequenceVi: "Báo cáo ngắn gọn, dễ hiểu.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "山田部長\n今日はファイル整理とシステム研修をやりました。以上です。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 35, businessRiskDelta: 5, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "敬語が不十分で報告内容も簡素すぎます。", consequenceVi: "Thiếu kính ngữ, nội dung quá sơ sài.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "山田部長\nお疲れ様です。\n今日は色々やりました。ファイルとかシステムとか。\n明日もがんばります！", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体性がなく、ビジネスメールとして不適切。", consequenceVi: "Thiếu cụ thể, không phù hợp email công việc.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "山田様\nいつもお世話になっております。\n本日の業務報告をお送りいたします。（以下略）", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 70, politenessScore: 60, businessRiskDelta: 3, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社内上司に「お世話になっております」は不自然。", consequenceVi: "Dùng 'osewa ni' với sếp nội bộ là không tự nhiên.", affectedNpcSlug: "yamada_bucho", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 16, skillGains: { written: 4, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 6 }] },
    },
    {
      slug: "verbal-renraku", ja: "口頭での連絡：会議室変更", vi: "Liên lạc miệng: đổi phòng họp", order: 2, boss: false,
      briefing: { briefingJa: "午後の会議の部屋が変更になりました。田中先輩に口頭で連絡します。", briefingVi: "Phòng họp chiều nay đổi. Bạn cần thông báo miệng cho senpai Tanaka.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_renraku_01", scenarioType: "chat", titleJa: "田中先輩への会議室変更連絡", titleVi: "Thông báo đổi phòng cho senpai Tanaka",
        contextSummaryVi: "Phòng A đổi sang phòng B vì bảo trì. Họp lúc 14:00, hiện 13:30.", goalJa: "必要な情報を漏れなく丁寧に伝える。", goalVi: "Truyền đạt đầy đủ thông tin, lịch sự.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "recipient" }],
        payload: { chatLog: [{ speaker: "あなた", lineJa: "（田中先輩に声をかける）", timestamp: "2026-04-15T13:30:00Z" }] },
        question: { id: "q_renraku_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "田中先輩に会議室変更を伝える際、最も適切な言い方はどれですか？",
          promptVi: "Khi thông báo đổi phòng cho senpai Tanaka, cách nói nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "田中先輩、お忙しいところすみません。14時からの会議ですが、会議室Aが設備点検のため、会議室Bに変更になりました。ご確認いただけますでしょうか。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 92, politenessScore: 90, businessRiskDelta: -4, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "必要な情報が全て含まれています。", consequenceVi: "Đầy đủ thông tin cần thiết.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "田中さん、会議室変わったよ。Bだって。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 55, politenessScore: 30, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "先輩にタメ口は失礼です。", consequenceVi: "Nói suồng sã với senpai là bất lịch sự.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "田中先輩、会議室が変更になりました。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 40, politenessScore: 75, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "どの会議か、どこに変わったか不足。", consequenceVi: "Thiếu: cuộc họp nào, phòng nào.", affectedNpcSlug: "tanaka_senpai", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "田中先輩、大変申し訳ございません。会議室の件でお時間いただけますでしょうか。", isCorrect: false, outcome: { trustDelta: -1, clarityScore: 35, politenessScore: 85, businessRiskDelta: 4, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "丁寧すぎて回りくどい。情報がすぐ伝わりません。", consequenceVi: "Quá trang trọng, vòng vo.", affectedNpcSlug: "tanaka_senpai", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 14, skillGains: { keigo: 5, meeting: 2 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 8 }] },
    },
    {
      slug: "soudan-with-boss", ja: "上司への相談：納期遅延", vi: "Tham vấn sếp: khả năng trễ deadline", order: 3, boss: false,
      briefing: { briefingJa: "資材の入荷が遅れ、納期に間に合わない可能性。山田部長に相談します。", briefingVi: "Nguyên liệu nhập chậm, có thể trễ deadline. Bạn cần tham vấn sếp Yamada.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_soudan_01", scenarioType: "meeting", titleJa: "山田部長への納期相談", titleVi: "Tham vấn sếp Yamada về deadline",
        contextSummaryVi: "Nhà cung cấp chậm 5 ngày. Deadline khách hàng 25/4. Cần báo sếp và xin ý kiến.", goalJa: "事実を正確に伝え、上司の判断を仰ぐ。自分の意見も添える。", goalVi: "Trình bày sự thật, xin ý kiến sếp, đưa đề xuất.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "manager" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "何か報告があるんだね。どうぞ。" }] },
        question: { id: "q_soudan_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "納期遅延の可能性を相談する際、最も適切な切り出し方はどれですか？",
          promptVi: "Khi tham vấn về khả năng trễ deadline, cách mở đầu nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "お時間いただきありがとうございます。A社案件の納期についてご相談があります。本日、仕入先から資材の入荷が5日遅れるとの連絡がありました。現状のままですと4月25日の納期に影響が出る可能性があります。対応策として2つ考えております。ご指示いただけますでしょうか。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実→影響→対応案の流れが完璧。", consequenceVi: "Sự thật → Ảnh hưởng → Phương án. Hoàn hảo.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "部長、ちょっとまずいんですけど、A社の納期、たぶん無理そうです。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "曖昧で具体的情報なし。敬語も不十分。", consequenceVi: "Mơ hồ, thiếu thông tin, thiếu kính ngữ.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "申し訳ありません。納期に間に合わないかもしれません。どうしたらいいでしょうか。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 45, politenessScore: 70, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "詳細なく、自分の考えも示していない。", consequenceVi: "Thiếu chi tiết, không đưa đề xuất.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "A社の件ですが、仕入先の問題で5日遅れます。私から直接連絡して調整します。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 70, politenessScore: 55, businessRiskDelta: 15, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "上司の判断を仰がず勝手に決定。", consequenceVi: "Tự quyết mà không xin ý kiến sếp.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { meeting: 6, keigo: 4, customer: 2 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "boss-multi-horenso", ja: "【難関】複数関係者への報連相", vi: "【Boss】Hou-Ren-Sou nhiều bên liên quan", order: 4, boss: true,
      briefing: { briefingJa: "顧客から急な仕様変更。山田部長への報告、田中先輩への連絡、対応案の提示を同時に。", briefingVi: "Khách đột ngột đổi yêu cầu. Cần báo sếp + liên lạc senpai + đề xuất cùng lúc.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_multi_horenso_01", scenarioType: "email", titleJa: "関係者全員への状況共有メール", titleVi: "Email chia sẻ tình hình cho tất cả bên liên quan",
        contextSummaryVi: "Sato-san muốn đổi spec sản phẩm gấp. Cần thông báo sếp & team, đề xuất timeline mới.", goalJa: "関係者全員に現状と対応策を正確に共有する。", goalVi: "Chia sẻ tình hình và phương án cho tất cả.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }, { npcSlug: "tanaka_senpai", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "佐藤 様", to: "あなた", subjectJa: "仕様変更のお願い", bodyJa: "お世話になっております。先日の仕様について一部変更をお願いしたく存じます。", timestamp: "2026-04-16T09:00:00Z" }] },
        question: { id: "q_multi_horenso_01", skillTag: "written", difficulty: "hard",
          promptJa: "仕様変更を受け、部長と先輩にCC共有メールを送ります。最も適切な書き方は？",
          promptVi: "Nhận yêu cầu đổi spec, gửi email CC cho sếp và senpai. Cách viết nào đúng?",
          options: [
            { optionKey: "A", textJa: "山田部長、田中先輩\nお疲れ様です。\n\n本日、東京テクノロジー佐藤様より仕様変更のご依頼がありましたのでご報告いたします。\n\n■ 変更概要：添付資料参照\n■ 影響範囲：納期2日延長の可能性あり\n■ 対応案：\n  ①仕様確認ミーティングを明日中に設定\n  ②田中先輩に技術的影響の確認をお願いしたい\n\nご指示をいただけますと幸いです。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 92, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "報連相の三要素が完璧にカバー。", consequenceVi: "Ba yếu tố Hou-Ren-Sou hoàn hảo.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "山田部長\n佐藤様から仕様変更の連絡がありました。対応しておきます。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 60, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "田中先輩への連絡なし。詳細不足。勝手に判断。", consequenceVi: "Không liên lạc senpai. Thiếu chi tiết. Tự quyết.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "みなさん\n佐藤さんから仕様変更って言われました。困ってます。どうしましょう？", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 25, politenessScore: 25, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "ビジネスメールとして完全に不適切。", consequenceVi: "Hoàn toàn không phù hợp email công việc.", affectedNpcSlug: "yamada_bucho", errorType: "keigo_misunderstanding" } },
            { optionKey: "D", textJa: "山田部長、田中先輩\nお疲れ様です。佐藤様より仕様変更の件ご連絡ありました。\n添付にて共有いたします。よろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 50, politenessScore: 80, businessRiskDelta: 6, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "影響範囲と対応案なし。判断材料にならない。", consequenceVi: "Thiếu ảnh hưởng & phương án. Sếp không thể quyết.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { written: 8, keigo: 6, meeting: 4, customer: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "tanaka_senpai", delta: 10 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "よく整理されているね。判断しやすい。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.hou-ren-sou: 4 chapters");

  /* ═══ Arc 4: 電話対応 基礎 ═════════════════════════════════════════════ */
  const arc4Id = await upsertArc(client, {
    slug: "arc.denwa-taiou", ja: "電話対応 基礎", vi: "Tiếp nhận điện thoại cơ bản",
    rank: "R2", order: 4,
    story: { synopsisVi: "Nghe điện thoại công ty là kỹ năng bắt buộc của nhân viên mới ở Nhật. Học cách nhận cuộc gọi, chuyển máy, ghi nhận lời nhắn.", npcSlugs: ["tanaka_senpai", "sato_kokyaku", "suzuki_kakaricho"], artAccent: "#CA8A04" },
  });

  await upsertChapters(client, arc4Id, [
    {
      slug: "receiving-call", ja: "外線電話の受け方", vi: "Cách nhận điện thoại ngoài", order: 1, boss: false,
      briefing: { briefingJa: "電話が鳴りました。佐藤様からのお電話です。山田部長は会議中。基本の電話応対を学びましょう。", briefingVi: "Điện thoại reo. Sato-san gọi đến tìm sếp Yamada nhưng sếp đang họp. Học cách nhận điện thoại.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_denwa_01", scenarioType: "chat", titleJa: "佐藤様からの電話応対", titleVi: "Nhận điện thoại từ Sato-san",
        contextSummaryVi: "Sato-san gọi tìm sếp Yamada. Sếp đang họp, dự kiến xong lúc 15:00 (còn 30 phút).", goalJa: "相手に失礼なく、正確に取り次ぐ。", goalVi: "Chuyển máy lịch sự, chính xác.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "caller" }],
        payload: { chatLog: [{ speaker: "（電話）", lineJa: "リーン、リーン…（3コール以内に出る）", timestamp: "2026-04-17T14:30:00Z" }] },
        question: { id: "q_denwa_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "佐藤様から電話。山田部長は会議中。最も適切な応対はどれですか？",
          promptVi: "Sato-san gọi đến. Sếp Yamada đang họp. Cách ứng đối nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "お電話ありがとうございます。株式会社ミライ商事、営業部○○でございます。…佐藤様、いつもお世話になっております。申し訳ございません、山田はただいま会議に出ておりまして、15時頃に終了予定でございます。折り返しお電話差し上げましょうか。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 95, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "社名・名前・状況説明・提案、全て完璧。", consequenceVi: "Tên cty, tên mình, giải thích tình hình, đề xuất — hoàn hảo.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "はい、ミライ商事です。あー、山田部長ですか。今会議中なんで、後でかけ直してもらえますか？", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 60, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社外のお客様に「かけ直して」は大変失礼。", consequenceVi: "Bảo khách 'gọi lại sau' là rất bất lịch sự.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "お電話ありがとうございます。○○です。山田は今いません。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 45, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社名なし、いつ戻るか不明、次のアクション提案なし。", consequenceVi: "Thiếu tên công ty, không biết khi nào quay lại, không đề xuất bước tiếp.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "お電話ありがとうございます。ミライ商事○○です。山田部長は会議中です。ご伝言を承りましょうか？", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 70, politenessScore: 70, businessRiskDelta: 3, satisfactionDelta: -2, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社外の方に自社の人を「部長」と呼ぶのはNG。呼び捨て「山田」が正しい。", consequenceVi: "Khi nói với bên ngoài, không gọi người nội bộ bằng chức danh. Phải gọi 'Yamada' không kèm chức vụ.", affectedNpcSlug: "sato_kokyaku", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 16, skillGains: { keigo: 6, customer: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 6 }] },
    },
    {
      slug: "taking-message", ja: "伝言メモの書き方", vi: "Cách viết memo ghi nhận lời nhắn", order: 2, boss: false,
      briefing: { briefingJa: "佐藤様からの伝言を正確にメモし、山田部長に共有します。伝言メモの書き方を学びましょう。", briefingVi: "Ghi nhận lời nhắn từ Sato-san và chuyển cho sếp Yamada. Học cách viết memo lời nhắn.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_memo_01", scenarioType: "email", titleJa: "伝言メモの作成", titleVi: "Tạo memo lời nhắn",
        contextSummaryVi: "Sato-san nhắn: 'Muốn đổi ngày giao hàng từ 25/4 sang 28/4. Xin gọi lại trước 16:00 hôm nay.' Bạn cần viết memo cho sếp.",
        goalJa: "5W1Hを押さえた正確な伝言メモを作る。", goalVi: "Viết memo chính xác theo 5W1H.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた（メモ）", to: "山田 部長（机上）", subjectJa: "伝言メモ", bodyJa: "（選ぶ）", timestamp: "2026-04-17T14:35:00Z" }] },
        question: { id: "q_memo_01", skillTag: "written", difficulty: "easy",
          promptJa: "伝言メモとして最も適切なものはどれですか？",
          promptVi: "Memo lời nhắn nào đúng chuẩn nhất?",
          options: [
            { optionKey: "A", textJa: "【伝言メモ】\n宛先：山田部長\n日時：4/17 14:30\n発信者：東京テクノロジー 佐藤様\n内容：納品日を4/25→4/28に変更希望\n対応：本日16:00までに折り返しご連絡をお願いしたいとのこと\n受信者：○○", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 95, politenessScore: 85, businessRiskDelta: -5, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "全ての情報が整理されています。", consequenceVi: "Tất cả thông tin được sắp xếp rõ ràng.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "部長、佐藤さんから電話ありました。納品日の件だそうです。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体的な日付、期限、連絡先が全て抜けています。", consequenceVi: "Thiếu ngày cụ thể, deadline, thông tin liên lạc.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "山田部長へ\n佐藤様より：納品日変更を28日にしたい。電話ください。\n○○", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 55, politenessScore: 60, businessRiskDelta: 4, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "日時・元の日付・期限が不明確。", consequenceVi: "Thiếu thời gian gọi, ngày gốc, deadline liên lạc.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様TEL\n内容：納品日25→28\n折返し希望", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 60, politenessScore: 40, businessRiskDelta: 5, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "簡潔すぎ。月の情報なし、期限時間もなし。", consequenceVi: "Quá ngắn gọn. Thiếu tháng, thiếu deadline cụ thể.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 12, skillGains: { written: 5, customer: 2 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 5 }] },
    },
    {
      slug: "transfer-call", ja: "電話の取り次ぎ", vi: "Chuyển máy điện thoại", order: 3, boss: false,
      briefing: { briefingJa: "高橋部長からの電話を鈴木係長に取り次ぎます。保留の仕方と取り次ぎ方を学びます。", briefingVi: "Chuyển máy từ GĐ Takahashi cho trưởng nhóm Suzuki. Học cách giữ máy và chuyển.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_transfer_01", scenarioType: "chat", titleJa: "高橋部長→鈴木係長への取り次ぎ", titleVi: "Chuyển máy: GĐ Takahashi → Trưởng nhóm Suzuki",
        contextSummaryVi: "Takahashi-bucho (khách hàng) gọi tìm Suzuki-kakaricho. Suzuki đang ngồi ở bàn.", goalJa: "スムーズに取り次ぐ。保留前後の対応を正確に。", goalVi: "Chuyển máy mượt mà. Ứng xử đúng trước/sau khi bấm giữ máy.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "caller" }, { npcSlug: "suzuki_kakaricho", roleInScene: "recipient" }],
        payload: { chatLog: [{ speaker: "高橋部長", lineJa: "東京テクノロジーの高橋ですが、鈴木さんをお願いできますか。" }] },
        question: { id: "q_transfer_01", skillTag: "keigo", difficulty: "standard",
          promptJa: "高橋部長の電話を鈴木係長に取り次ぐ際、正しい手順はどれですか？",
          promptVi: "Khi chuyển máy của GĐ Takahashi cho Suzuki-kakaricho, thủ tục nào đúng?",
          options: [
            { optionKey: "A", textJa: "（高橋部長に）「鈴木でございますね。少々お待ちくださいませ。」→保留→「鈴木係長、東京テクノロジーの高橋部長からお電話です。」→取り次ぎ", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 92, politenessScore: 90, businessRiskDelta: -3, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "確認→保留→社内報告の流れが正確。", consequenceVi: "Xác nhận → Giữ máy → Báo nội bộ. Chính xác.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "（保留せず大声で）「鈴木係長〜！高橋さんからお電話で〜す！」", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 15, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "保留せず叫ぶのは大変失礼。電話口の相手に聞こえます。", consequenceVi: "Không giữ máy mà hét to là rất bất lịch sự. Người gọi nghe thấy hết.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "（高橋部長に）「分かりました。繋ぎますね。」→保留→取り次ぎ", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 60, politenessScore: 40, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "「繋ぎますね」はカジュアルすぎ。社外に対して不適切。", consequenceVi: "'Tsunagimasu ne' quá xuề xòa với người ngoài công ty.", affectedNpcSlug: "takahashi_clienthq", errorType: "keigo_misunderstanding" } },
            { optionKey: "D", textJa: "（高橋部長に）「鈴木係長でございますね。」→保留→取り次ぎ", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 70, politenessScore: 60, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社外に自社の人を「係長」と呼んでいます。呼び捨て「鈴木」が正しい。", consequenceVi: "Gọi người nội bộ bằng chức danh trước khách ngoài là sai. Phải gọi tên không chức vụ.", affectedNpcSlug: "takahashi_clienthq", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 18, skillGains: { keigo: 6, customer: 4 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 5 }, { npcSlug: "takahashi_clienthq", delta: 4 }] },
    },
    {
      slug: "boss-difficult-call", ja: "【難関】クレーム電話の一次対応", vi: "【Boss】Ứng phó điện thoại khiếu nại ban đầu", order: 4, boss: true,
      briefing: { briefingJa: "高橋部長から怒りの電話。製品の不具合について。担当者不在の中、一次対応します。", briefingVi: "GĐ Takahashi gọi giận dữ về lỗi sản phẩm. Người phụ trách vắng. Bạn phải ứng phó ban đầu.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_claim_call_01", scenarioType: "chat", titleJa: "クレーム電話の初期対応", titleVi: "Ứng phó ban đầu điện thoại khiếu nại",
        contextSummaryVi: "Takahashi-bucho giận dữ: sản phẩm giao hôm qua có 5% lỗi. Suzuki (người phụ trách) đang ở ngoài. Bạn cần xử lý bước đầu.",
        goalJa: "相手の怒りを受け止め、事実確認し、適切にエスカレーションする。", goalVi: "Tiếp nhận sự giận dữ, xác nhận sự thật, leo thang đúng cách.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "caller" }],
        payload: { chatLog: [{ speaker: "高橋部長", lineJa: "おたくから届いた製品、5%も不良品が入ってたんだけど！鈴木さんはいないのか！？" }] },
        question: { id: "q_claim_call_01", skillTag: "customer", difficulty: "hard",
          promptJa: "高橋部長のクレーム電話。鈴木係長は外出中。最も適切な一次対応は？",
          promptVi: "GĐ Takahashi gọi khiếu nại. Suzuki vắng. Cách ứng phó ban đầu tốt nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、大変申し訳ございません。ご不便をおかけし、心よりお詫び申し上げます。\n状況を確認させていただきたいのですが、不良品は具体的にどのような状態でしょうか。\n…承知いたしました。担当の鈴木は現在外出中でございまして、戻り次第すぐにご連絡差し上げます。本日中に必ずご連絡いたしますので、少々お待ちいただけますでしょうか。\n改めまして、ご迷惑をおかけし申し訳ございません。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 90, politenessScore: 95, businessRiskDelta: -8, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "お詫び→事実確認→期限付き約束。完璧な一次対応。", consequenceVi: "Xin lỗi → Xác nhận sự thật → Hứa hẹn có deadline. Ứng phó hoàn hảo.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "すみません、その件は鈴木の担当なので、戻ったら電話させます。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 40, politenessScore: 25, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "お詫びもなく、他人任せ。顧客を軽視しています。", consequenceVi: "Không xin lỗi, đẩy trách nhiệm. Coi thường khách hàng.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "申し訳ございません。すぐに代替品を送ります。ご住所を確認させてください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 55, politenessScore: 70, businessRiskDelta: 12, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "事実確認せず、権限もないのに勝手に約束しています。", consequenceVi: "Chưa xác nhận sự thật, không có quyền mà tự hứa.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "5%ですか…確認しますが、弊社の検品基準は3%以下なので、もしかすると運送中の問題かもしれません。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 50, politenessScore: 30, businessRiskDelta: 18, satisfactionDelta: -18, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "責任転嫁に聞こえます。怒っている相手に言い訳は火に油。", consequenceVi: "Nghe như đổ lỗi. Bao biện với người đang giận = đổ thêm dầu vào lửa.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 35, skillGains: { customer: 8, keigo: 6, nuance: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 10 }, { npcSlug: "suzuki_kakaricho", delta: 5 }], npcReactionMontage: [{ npcSlug: "suzuki_kakaricho", quoteJa: "助かったよ。一次対応がしっかりしてたから、高橋さんも落ち着いてた。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.denwa-taiou: 4 chapters");

  /* ═══ Arc 5: 名刺交換と来客対応 ═══════════════════════════════════════ */
  const arc5Id = await upsertArc(client, {
    slug: "arc.meishi-koukan", ja: "名刺交換と来客対応", vi: "Trao đổi danh thiếp & đón khách",
    rank: "R2", order: 5,
    story: { synopsisVi: "名刺交換 (trao danh thiếp) là nghi thức quan trọng nhất khi gặp đối tác lần đầu. Học cách trao/nhận, cùng cách đón tiếp khách đến công ty.", npcSlugs: ["sato_kokyaku", "tanaka_senpai", "yamada_bucho"], artAccent: "#B45309" },
  });

  await upsertChapters(client, arc5Id, [
    {
      slug: "meishi-exchange", ja: "名刺交換の作法", vi: "Nghi thức trao đổi danh thiếp", order: 1, boss: false,
      briefing: { briefingJa: "初めて佐藤様と対面します。名刺交換の正しい手順を実践しましょう。", briefingVi: "Lần đầu gặp mặt Sato-san. Thực hành nghi thức trao đổi danh thiếp đúng cách.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_meishi_01", scenarioType: "meeting", titleJa: "佐藤様との名刺交換", titleVi: "Trao danh thiếp với Sato-san",
        contextSummaryVi: "Phòng tiếp khách. Sato-san đưa danh thiếp trước. Bạn cần đáp lễ đúng chuẩn.", goalJa: "正しいマナーで名刺交換する。", goalVi: "Trao đổi danh thiếp đúng phép tắc.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "partner" }, { npcSlug: "tanaka_senpai", roleInScene: "observer" }],
        payload: { meetingTranscript: [{ speaker: "佐藤様", lineJa: "（名刺を両手で差し出しながら）東京テクノロジーの佐藤と申します。" }] },
        question: { id: "q_meishi_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "佐藤様が名刺を差し出しました。正しい受け取り方と渡し方はどれですか？",
          promptVi: "Sato-san đưa danh thiếp. Cách nhận và trao lại nào đúng chuẩn?",
          options: [
            { optionKey: "A", textJa: "「頂戴いたします。」と両手で受け取り、すぐに自分の名刺を相手より低い位置で「株式会社ミライ商事 営業部の○○と申します。どうぞよろしくお願いいたします。」と差し出す。受け取った名刺はテーブルの上、相手の座る側に置く。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 95, businessRiskDelta: -3, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "完璧なマナーです。相手への敬意が伝わります。", consequenceVi: "Phép tắc hoàn hảo. Thể hiện sự tôn trọng đối phương.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "片手で受け取り、「どうも」と言って自分の名刺をポケットから出して渡す。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 40, politenessScore: 10, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "片手受取・ポケットから出す、全てNGマナーです。", consequenceVi: "Nhận 1 tay, lấy danh thiếp từ túi quần — tất cả đều sai phép tắc.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "「ありがとうございます」と受け取り、すぐに名刺入れにしまう。自分の名刺は「後でメールします」と伝える。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 50, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "すぐしまうのは失礼。名刺を持参しないのも問題。", consequenceVi: "Cất ngay là bất lịch sự. Không mang danh thiếp theo cũng là lỗi.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "両手で受け取り、「頂戴します」と言う。自分の名刺を相手より高い位置で渡す。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 60, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "相手より高い位置で渡すのは失礼。低い位置が正解。", consequenceVi: "Đưa danh thiếp cao hơn đối phương là bất kính. Phải thấp hơn.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" } },
          ],
        },
      }] },
      rewards: { rankXp: 18, skillGains: { meeting: 5, keigo: 4, customer: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 8 }] },
    },
    {
      slug: "visitor-reception", ja: "来客の案内", vi: "Hướng dẫn khách đến công ty", order: 2, boss: false,
      briefing: { briefingJa: "佐藤様が来社されました。受付から会議室まで案内し、お茶を出します。", briefingVi: "Sato-san đến công ty. Bạn dẫn từ lễ tân đến phòng họp và mời trà.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_visitor_01", scenarioType: "chat", titleJa: "来客案内とお茶出し", titleVi: "Dẫn khách và mời trà",
        contextSummaryVi: "Sato-san đến lễ tân. Bạn cần dẫn đến phòng họp 3F, mời ngồi, rót trà.", goalJa: "お客様を丁寧に案内し、快適にお待ちいただく。", goalVi: "Dẫn khách lịch sự, giúp khách thoải mái chờ.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "visitor" }],
        payload: { chatLog: [{ speaker: "受付", lineJa: "佐藤様がお見えです。" }] },
        question: { id: "q_visitor_01", skillTag: "keigo", difficulty: "standard",
          promptJa: "佐藤様を3階の会議室まで案内する際、正しい対応はどれですか？",
          promptVi: "Khi dẫn Sato-san đến phòng họp tầng 3, cách ứng xử nào đúng?",
          options: [
            { optionKey: "A", textJa: "「佐藤様、お待ちしておりました。3階の会議室にご案内いたします。」→エレベーター前で先に乗り操作盤側に立つ→「こちらでございます。どうぞおかけください。」→上座を勧める→「お飲み物はコーヒーと紅茶がございますが、いかがなさいますか。」", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 92, politenessScore: 95, businessRiskDelta: -3, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "案内→上座→飲み物、全て完璧な対応。", consequenceVi: "Dẫn đường → Mời ngồi thượng tọa → Mời đồ uống. Hoàn hảo.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "「佐藤さん、こんにちは。3階なんでエレベーターで行きましょう。」→適当に席を勧める→「お茶でいいですか？」", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 60, politenessScore: 35, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "敬語不足。上座/下座の意識なし。", consequenceVi: "Thiếu kính ngữ. Không ý thức thượng/hạ tọa.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "「佐藤様、ご案内いたします。」→会議室で「奥のお席にどうぞ」→お茶を無言で置く。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 65, politenessScore: 65, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "お茶を無言で置くのは不親切。一声添えましょう。", consequenceVi: "Đặt trà không nói gì là thiếu chu đáo. Cần nói kèm.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "「佐藤様、お越しいただきありがとうございます。」→先に歩いて案内→会議室のドアを開けて入口近くの席を勧める", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 55, politenessScore: 70, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "入口近くは下座。お客様には奥の上座を勧めます。", consequenceVi: "Ghế gần cửa là hạ tọa. Khách phải mời ngồi trong sâu (thượng tọa).", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 16, skillGains: { keigo: 5, customer: 4, meeting: 2 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 7 }] },
    },
    {
      slug: "seeing-off-guest", ja: "お客様のお見送り", vi: "Tiễn khách", order: 3, boss: false,
      briefing: { briefingJa: "会議が終わりました。佐藤様をエレベーターまでお見送りします。最後の印象が大切です。", briefingVi: "Cuộc họp kết thúc. Tiễn Sato-san đến thang máy. Ấn tượng cuối cùng rất quan trọng.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_seeoff_01", scenarioType: "chat", titleJa: "エレベーター前でのお見送り", titleVi: "Tiễn khách trước thang máy",
        contextSummaryVi: "Họp xong, bạn dẫn Sato-san ra thang máy. Cần chào tạm biệt đúng chuẩn.", goalJa: "気持ちよくお帰りいただく。", goalVi: "Để khách ra về thoải mái, ấn tượng tốt.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "visitor" }],
        payload: { chatLog: [{ speaker: "（状況）", lineJa: "エレベーター前に着いた。" }] },
        question: { id: "q_seeoff_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "佐藤様をエレベーター前でお見送りする際、正しいマナーはどれですか？",
          promptVi: "Khi tiễn Sato-san trước thang máy, cách nào đúng phép tắc?",
          options: [
            { optionKey: "A", textJa: "「本日はお忙しい中お越しいただき、ありがとうございました。今後ともよろしくお願いいたします。」→エレベーターのボタンを押す→ドアが閉まるまでお辞儀を続ける。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 88, politenessScore: 95, businessRiskDelta: 0, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "最後までの丁寧さが信頼に繋がります。", consequenceVi: "Chu đáo đến phút cuối tạo niềm tin.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "「お疲れ様でした！また来てくださいね。」→手を振って戻る。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 50, politenessScore: 25, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社外の方に「お疲れ様」は不適切。カジュアルすぎ。", consequenceVi: "'Otsukare' với khách ngoài là sai. Quá xuề xòa.", affectedNpcSlug: "sato_kokyaku", errorType: "internal_external_tone_mismatch" } },
            { optionKey: "C", textJa: "「ありがとうございました。」→ドアが閉まる前に戻る。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 60, politenessScore: 50, businessRiskDelta: 4, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "ドアが閉まるまで見送るのが基本。先に戻るのは失礼。", consequenceVi: "Phải tiễn đến khi cửa thang máy đóng hẳn. Quay đi trước là bất lịch sự.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "「お帰りの際はお気をつけて。次回は私がお伺いしますから。」", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 55, politenessScore: 60, businessRiskDelta: 5, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "新入社員が一人で訪問を約束するのは越権。", consequenceVi: "Nhân viên mới tự hứa đi thăm khách là vượt quyền.", affectedNpcSlug: "sato_kokyaku", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 12, skillGains: { keigo: 4, customer: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 6 }] },
    },
    {
      slug: "boss-full-visit", ja: "【総合】顧客訪問の全行程", vi: "【Boss】Toàn bộ quy trình tiếp khách", order: 4, boss: true,
      briefing: { briefingJa: "高橋部長が来社予定。受付→案内→名刺交換→会議サポート→お見送りまで一人で対応します。", briefingVi: "GĐ Takahashi đến thăm. Bạn phụ trách từ lễ tân → dẫn đường → danh thiếp → hỗ trợ họp → tiễn.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_fullvisit_01", scenarioType: "meeting", titleJa: "高橋部長来社 — 全行程対応", titleVi: "GĐ Takahashi đến — phụ trách toàn bộ",
        contextSummaryVi: "Takahashi-bucho đến lần đầu. Bạn chưa từng gặp. Sếp Yamada đang ở phòng họp chờ. Bạn phải đón và dẫn vào.",
        goalJa: "初対面の顧客を完璧にもてなし、会議をスムーズに始められるようにする。", goalVi: "Đón tiếp khách lần đầu hoàn hảo, giúp cuộc họp bắt đầu mượt mà.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "visitor" }, { npcSlug: "yamada_bucho", roleInScene: "observer" }],
        payload: { meetingTranscript: [{ speaker: "受付", lineJa: "東京テクノロジーの高橋様がお見えです。初めてのご来社です。" }] },
        question: { id: "q_fullvisit_01", skillTag: "customer", difficulty: "hard",
          promptJa: "初来社の高橋部長を迎え、会議室の山田部長のもとへ案内するまでの正しい手順は？",
          promptVi: "Đón GĐ Takahashi (lần đầu) và dẫn đến phòng họp có sếp Yamada, thủ tục nào đúng?",
          options: [
            { optionKey: "A", textJa: "受付で「高橋様、お待ちしておりました。営業部の○○と申します。」→名刺交換→「3階会議室へご案内いたします。」→エレベーターで先に乗り操作→会議室で上座を案内→「山田がすぐ参りますので、少々お待ちくださいませ。お飲み物はいかがなさいますか。」→山田部長に「高橋様がお見えです」と報告。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 95, businessRiskDelta: -8, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "受付から着席まで、全ステップが完璧。", consequenceVi: "Từ lễ tân đến ngồi ghế — mọi bước đều hoàn hảo.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "「高橋部長、いらっしゃいませ！」→握手→「こっちです」と会議室に案内→「山田部長、高橋部長来ましたよ」", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "タメ口、社内人を敬称付き、握手（名刺が先）、全て不適切。", consequenceVi: "Suồng sã, gọi sếp bằng chức danh trước khách, bắt tay (danh thiếp trước), tất cả sai.", affectedNpcSlug: "takahashi_clienthq", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "「高橋様ですね。○○です。会議室へどうぞ。」→会議室で入口の席を勧める→「部長はもうすぐ来ます」", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 55, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "名刺なし、入口席（下座）、飲み物なし。配慮不足。", consequenceVi: "Không danh thiếp, ghế hạ tọa, không mời nước. Thiếu chu đáo.", affectedNpcSlug: "takahashi_clienthq", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "「高橋様、お待ちしておりました。」→名刺交換→案内→上座に着席→お茶を出す→自分も同席して山田部長を待つ", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 70, politenessScore: 70, businessRiskDelta: 5, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "新入社員が指示なく同席するのは不適切。報告してから指示を仰ぐ。", consequenceVi: "Nhân viên mới tự ngồi cùng mà không có chỉ thị là không phù hợp.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { customer: 8, keigo: 6, meeting: 5 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 12 }, { npcSlug: "yamada_bucho", delta: 8 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "高橋さんの印象も良かったよ。完璧な対応だった。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.meishi-koukan: 4 chapters");
  console.log(`✓ R2 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("03-r2")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR2(client);
  await client.end();
}
