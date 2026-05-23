/**
 * Career RPG Production Seed — R1 内定者 (Pre-hire)
 * 2 arcs, 8 chapters: Business manner basics + Self-introduction
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR1(client) {
  /* ═══ Arc 1: ビジネスマナー入門 ═══════════════════════════════════════ */
  const arc1Id = await upsertArc(client, {
    slug: "arc.business-manner-basics", ja: "ビジネスマナー入門", vi: "Nhập môn phép tắc công sở Nhật",
    rank: "R1", order: 1,
    story: { synopsisVi: "Trước khi vào công ty, bạn cần nắm những quy tắc cơ bản nhất: cách chào, cách viết email đầu tiên, cách xưng hô trong công ty Nhật.", npcSlugs: ["tanaka_senpai"], artAccent: "#059669" },
  });

  await upsertChapters(client, arc1Id, [
    {
      slug: "greeting-basics", ja: "正しい挨拶の基本", vi: "Cách chào hỏi cơ bản đúng chuẩn", order: 1, boss: false,
      briefing: { briefingJa: "入社前研修の初日。まずは基本的な挨拶から学びましょう。「おはようございます」「お疲れ様です」の使い分けを覚えます。", briefingVi: "Ngày đầu training trước nhập xã. Học cách chào cơ bản: phân biệt 'Ohayou gozaimasu' và 'Otsukare-sama desu'.", yourRoleVi: "内定者（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_greeting_01", scenarioType: "chat", titleJa: "朝の挨拶 — 誰に何と言う？", titleVi: "Chào buổi sáng — nói gì với ai?",
        contextSummaryVi: "9:00 sáng, bạn vừa đến văn phòng. Senpai Tanaka đã có mặt từ sớm.", goalJa: "時間帯と相手に合った挨拶を選ぶ。", goalVi: "Chọn lời chào phù hợp với thời điểm và đối tượng.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "colleague" }],
        payload: { chatLog: [{ speaker: "あなた", lineJa: "（朝、オフィスに着いた）", timestamp: "2026-04-01T09:00:00Z" }] },
        question: { id: "q_greeting_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "朝9時に出社し、田中先輩に最初に声をかけます。最も適切な挨拶はどれですか？",
          promptVi: "Đến công ty lúc 9h sáng, bạn chào senpai Tanaka. Câu nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "おはようございます。本日もよろしくお願いいたします。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 90, politenessScore: 92, businessRiskDelta: 0, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "朝の挨拶として完璧です。", consequenceVi: "Lời chào buổi sáng hoàn hảo.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "お疲れ様です。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 60, politenessScore: 65, businessRiskDelta: 2, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "「お疲れ様です」は朝一番には不自然です。午後以降に使います。", consequenceVi: "'Otsukare-sama' không tự nhiên lúc sáng sớm. Dùng từ chiều trở đi.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "おはよう！今日もがんばろう！", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 70, politenessScore: 30, businessRiskDelta: 4, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "先輩にタメ口は失礼です。", consequenceVi: "Nói suồng sã với senpai là bất lịch sự.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
            { optionKey: "D", textJa: "いつもお世話になっております。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 50, politenessScore: 70, businessRiskDelta: 2, satisfactionDelta: -2, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社外向けの表現です。社内では使いません。", consequenceVi: "Đây là cách nói dùng với người ngoài công ty, không dùng nội bộ.", affectedNpcSlug: "tanaka_senpai", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 10, skillGains: { keigo: 4 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 5 }] },
    },
    {
      slug: "email-subject-line", ja: "件名の書き方", vi: "Cách viết tiêu đề email", order: 2, boss: false,
      briefing: { briefingJa: "田中先輩から「明日の研修スケジュールをメールで送って」と頼まれました。件名の書き方を学びましょう。", briefingVi: "Senpai Tanaka nhờ bạn gửi email lịch training ngày mai. Học cách viết tiêu đề email.", yourRoleVi: "内定者（あなた）", estimatedMinutes: 4 },
      scenario: { scenarios: [{ id: "sc_subject_01", scenarioType: "email", titleJa: "メール件名の基本ルール", titleVi: "Quy tắc cơ bản tiêu đề email",
        contextSummaryVi: "Bạn cần gửi email cho đồng nghiệp nhóm training về lịch ngày mai. Nội dung: phòng họp A, 10:00-12:00, mang laptop.",
        goalJa: "内容が一目で分かる件名を書く。", goalVi: "Viết tiêu đề giúp người nhận hiểu ngay nội dung.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "observer" }],
        payload: { emailThread: [{ from: "あなた", to: "研修グループ全員", subjectJa: "（あなたが書く件名）", bodyJa: "（本文は既に書いた）", timestamp: "2026-04-01T14:00:00Z" }] },
        question: { id: "q_subject_01", skillTag: "written", difficulty: "easy",
          promptJa: "明日の研修スケジュール共有メールの件名として最も適切なものはどれですか？",
          promptVi: "Tiêu đề nào phù hợp nhất cho email chia sẻ lịch training ngày mai?",
          options: [
            { optionKey: "A", textJa: "【研修】4/2（水）スケジュールのご連絡", isCorrect: true, outcome: { trustDelta: 6, clarityScore: 95, politenessScore: 85, businessRiskDelta: 0, satisfactionDelta: 6, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "カテゴリ・日付・内容が明確です。", consequenceVi: "Rõ ràng: thể loại, ngày, nội dung.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "明日の件", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 20, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "何の件か全くわかりません。", consequenceVi: "Không ai biết 'việc ngày mai' là việc gì.", affectedNpcSlug: "tanaka_senpai", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "研修について", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 40, politenessScore: 60, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "日付がなく、具体性に欠けます。", consequenceVi: "Thiếu ngày cụ thể, quá chung chung.", affectedNpcSlug: "tanaka_senpai", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "お疲れ様です。明日の研修のスケジュールを送ります", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 55, politenessScore: 60, businessRiskDelta: 2, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "件名に挨拶文を入れるのはNGです。", consequenceVi: "Không nên đặt câu chào vào tiêu đề email.", affectedNpcSlug: "tanaka_senpai", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 10, skillGains: { written: 4 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 4 }] },
    },
    {
      slug: "honorific-titles", ja: "敬称の使い分け", vi: "Cách dùng kính xưng (様/さん/部長)", order: 3, boss: false,
      briefing: { briefingJa: "社内と社外で敬称の使い方が異なります。「様」「さん」「役職名」をいつ使うか整理しましょう。", briefingVi: "Cách xưng hô khác nhau giữa nội bộ và bên ngoài. Học khi nào dùng 'sama', 'san', hay chức danh.", yourRoleVi: "内定者（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_honorific_01", scenarioType: "email", titleJa: "社外メールでの敬称", titleVi: "Kính xưng trong email gửi bên ngoài",
        contextSummaryVi: "Bạn viết email gửi khách hàng Sato (課長 - trưởng phòng) tại Tokyo Technology. Senpai Tanaka kiểm tra trước khi gửi.",
        goalJa: "社外の方への正しい敬称を選ぶ。", goalVi: "Chọn kính xưng đúng khi viết cho người ngoài công ty.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "tanaka_senpai", roleInScene: "observer" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 ？？？", subjectJa: "お見積もりの件", bodyJa: "（宛名の書き方を選ぶ）", timestamp: "2026-04-02T10:00:00Z" }] },
        question: { id: "q_honorific_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "社外の佐藤課長にメールを送る際、宛名として最も適切なものはどれですか？",
          promptVi: "Khi gửi email cho trưởng phòng Sato (bên ngoài), cách viết tên người nhận nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "東京テクノロジー株式会社\n購買部 佐藤様", isCorrect: true, outcome: { trustDelta: 6, clarityScore: 90, politenessScore: 92, businessRiskDelta: 0, satisfactionDelta: 6, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "社外の方には「様」が基本。会社名＋部署も明記で完璧。", consequenceVi: "Dùng 'sama' cho người ngoài + ghi rõ công ty & phòng ban là chuẩn.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "佐藤課長様", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 60, politenessScore: 55, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "「課長様」は二重敬称でNGです。役職か「様」どちらか一つ。", consequenceVi: "'Kachō-sama' là dùng kép kính xưng, sai. Chọn một: chức danh HOẶC 'sama'.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "佐藤さん", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 70, politenessScore: 40, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社外の方に「さん」は馴れ馴れしい印象です。", consequenceVi: "Dùng 'san' với người ngoài công ty gây ấn tượng suồng sã.", affectedNpcSlug: "tanaka_senpai", errorType: "internal_external_tone_mismatch" } },
            { optionKey: "D", textJa: "佐藤殿", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 65, politenessScore: 50, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "「殿」は現代ビジネスではほぼ使いません。古い印象を与えます。", consequenceVi: "'Dono' gần như không dùng trong kinh doanh hiện đại, gây ấn tượng cổ lỗ.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
          ],
        },
      }] },
      rewards: { rankXp: 12, skillGains: { keigo: 5, written: 2 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 5 }] },
    },
    {
      slug: "boss-manner-assessment", ja: "【確認】ビジネスマナー総合テスト", vi: "【Boss】Kiểm tra tổng hợp phép tắc công sở", order: 4, boss: true,
      briefing: { briefingJa: "入社前研修の最終日。田中先輩が総合確認を行います。挨拶・敬称・メールの基本を全て活用する場面です。", briefingVi: "Ngày cuối training trước nhập xã. Senpai Tanaka kiểm tra tổng hợp: chào hỏi, kính xưng, email cơ bản.", yourRoleVi: "内定者（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_manner_boss_01", scenarioType: "email", titleJa: "社外初メールの全要素確認", titleVi: "Kiểm tra tất cả yếu tố email đầu tiên gửi bên ngoài",
        contextSummaryVi: "Bạn cần viết email đầu tiên gửi khách hàng Sato, tự giới thiệu bản thân là nhân viên mới phụ trách. Senpai Tanaka review trước.",
        goalJa: "宛名・挨拶・自己紹介・締めの全てが正しいメールを選ぶ。", goalVi: "Chọn email có đầy đủ: người nhận, chào, giới thiệu, kết thúc đều đúng chuẩn.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "tanaka_senpai", roleInScene: "reviewer" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "【ご挨拶】新担当のご連絡", bodyJa: "（全文を選ぶ）", timestamp: "2026-04-03T10:00:00Z" }] },
        question: { id: "q_manner_boss_01", skillTag: "written", difficulty: "standard",
          promptJa: "佐藤様への着任挨拶メールとして、全ての要素が正しいものはどれですか？",
          promptVi: "Email chào nhận nhiệm vụ gửi Sato-san, phương án nào có TẤT CẢ yếu tố đều đúng?",
          options: [
            { optionKey: "A", textJa: "東京テクノロジー株式会社\n購買部 佐藤様\n\nいつもお世話になっております。\n株式会社ミライ商事 営業部の○○と申します。\n\nこの度、前任の田中に代わり、貴社を担当させていただくことになりました。\nまだまだ未熟ではございますが、精一杯務めてまいりますので、\n何卒よろしくお願い申し上げます。\n\n近日中にご挨拶に伺えればと存じますが、\nご都合のよろしい日時をお教えいただけますと幸いです。\n\n株式会社ミライ商事 営業部\n○○（氏名）\nTEL: 03-XXXX-XXXX", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 95, businessRiskDelta: -5, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "宛名・挨拶・自己紹介・依頼・署名、全ての要素が完璧です。", consequenceVi: "Người nhận, chào hỏi, giới thiệu, yêu cầu, chữ ký — tất cả hoàn hảo.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n\nお疲れ様です。新しく担当になりました○○です。\nよろしくお願いします。\n近々お伺いします。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社外に「お疲れ様です」はNG。署名もなく、一方的な連絡です。", consequenceVi: "Dùng 'Otsukare' với bên ngoài là sai. Thiếu chữ ký, thông báo một chiều.", affectedNpcSlug: "tanaka_senpai", errorType: "internal_external_tone_mismatch" } },
            { optionKey: "C", textJa: "東京テクノロジー株式会社\n佐藤課長様\n\nいつもお世話になっております。\nミライ商事の○○と申します。田中の後任です。\nよろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 55, politenessScore: 60, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "二重敬称「課長様」、署名なし、次のアクションも不明確。", consequenceVi: "Kép kính xưng 'kachō-sama', thiếu chữ ký, không rõ bước tiếp theo.", affectedNpcSlug: "tanaka_senpai", errorType: "keigo_misunderstanding" } },
            { optionKey: "D", textJa: "佐藤様\n\n初めまして。○○と申します。\n今後、貴社の営業を担当することになりました。\n前任の田中から引き継ぎましたので、ご安心ください。\n何かあればいつでもご連絡ください。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 60, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "「ご安心ください」は上から目線。会社名・署名もなし。", consequenceVi: "'Hãy yên tâm' gây ấn tượng trịch thượng. Thiếu tên công ty & chữ ký.", affectedNpcSlug: "tanaka_senpai", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 20, skillGains: { keigo: 6, written: 5 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 8 }, { npcSlug: "sato_kokyaku", delta: 3 }], npcReactionMontage: [{ npcSlug: "tanaka_senpai", quoteJa: "基本がしっかりしてるね。入社が楽しみだ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.business-manner-basics: 4 chapters");

  /* ═══ Arc 2: 自己紹介と挨拶 ════════════════════════════════════════════ */
  const arc2Id = await upsertArc(client, {
    slug: "arc.jiko-shoukai", ja: "自己紹介と挨拶", vi: "Tự giới thiệu và chào hỏi trong công ty",
    rank: "R1", order: 2,
    story: { synopsisVi: "Nhập xã ngày đầu: tự giới thiệu trước phòng ban, chào hỏi các đồng nghiệp, viết email giới thiệu bản thân cho toàn công ty.", npcSlugs: ["yamada_bucho", "tanaka_senpai", "suzuki_kakaricho"], artAccent: "#1B2A4A" },
  });

  await upsertChapters(client, arc2Id, [
    {
      slug: "department-introduction", ja: "部署での自己紹介", vi: "Tự giới thiệu trước phòng ban", order: 1, boss: false,
      briefing: { briefingJa: "入社初日。営業部のメンバー全員の前で自己紹介をします。第一印象が大切です。", briefingVi: "Ngày đầu nhập xã. Tự giới thiệu trước toàn bộ thành viên phòng kinh doanh. Ấn tượng đầu tiên rất quan trọng.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_jiko_01", scenarioType: "meeting", titleJa: "営業部朝礼での自己紹介", titleVi: "Tự giới thiệu tại họp sáng phòng kinh doanh",
        contextSummaryVi: "Buổi họp sáng (朝礼), sếp Yamada giới thiệu bạn là nhân viên mới. Có khoảng 15 người nghe.",
        goalJa: "簡潔で好印象な自己紹介をする。", goalVi: "Giới thiệu ngắn gọn, tạo ấn tượng tốt.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "introducer" }, { npcSlug: "suzuki_kakaricho", roleInScene: "audience" }, { npcSlug: "tanaka_senpai", roleInScene: "audience" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "では、本日から営業部に配属の○○さん、一言ご挨拶をどうぞ。" }] },
        question: { id: "q_jiko_01", skillTag: "meeting", difficulty: "easy",
          promptJa: "部署の朝礼で自己紹介する際、最も適切な内容はどれですか？",
          promptVi: "Khi tự giới thiệu tại họp sáng phòng ban, nội dung nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "本日より営業部に配属になりました○○と申します。大学ではマーケティングを専攻しておりました。一日も早く戦力になれるよう努力いたしますので、ご指導のほどよろしくお願いいたします。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 92, politenessScore: 90, businessRiskDelta: 0, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "簡潔・謙虚・前向き。完璧な自己紹介です。", consequenceVi: "Ngắn gọn, khiêm tốn, tích cực. Giới thiệu hoàn hảo.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "○○です。よろしくお願いします。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 30, politenessScore: 50, businessRiskDelta: 3, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "短すぎて印象に残りません。", consequenceVi: "Quá ngắn, không tạo được ấn tượng.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "○○です！営業成績トップを目指します！バリバリ稼ぎましょう！", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 60, politenessScore: 20, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "自信は良いですが、新入社員として生意気に聞こえます。", consequenceVi: "Tự tin tốt nhưng với nhân viên mới thì gây ấn tượng hỗn.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "○○と申します。正直、緊張しています。何も分からないので、色々教えてください。お手柔らかにお願いします。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 50, politenessScore: 65, businessRiskDelta: 4, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "謙虚すぎて頼りない印象。「戦力になる」意欲を見せましょう。", consequenceVi: "Quá khiêm tốn đến mức thiếu tin cậy. Nên thể hiện ý chí đóng góp.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 12, skillGains: { meeting: 4, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 5 }, { npcSlug: "suzuki_kakaricho", delta: 3 }] },
    },
    {
      slug: "elevator-greeting", ja: "エレベーターでの挨拶", vi: "Chào hỏi trong thang máy", order: 2, boss: false,
      briefing: { briefingJa: "エレベーターで他部署の上司に偶然会いました。短い時間での適切な挨拶を学びましょう。", briefingVi: "Tình cờ gặp sếp phòng khác trong thang máy. Học cách chào phù hợp trong thời gian ngắn.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 3 },
      scenario: { scenarios: [{ id: "sc_elevator_01", scenarioType: "chat", titleJa: "エレベーターで中村人事部長に遭遇", titleVi: "Gặp giám đốc nhân sự Nakamura trong thang máy",
        contextSummaryVi: "Thang máy, bạn gặp GĐ nhân sự Nakamura. Bạn đã gặp ông ấy 1 lần lúc training nhưng chưa nói chuyện trực tiếp.",
        goalJa: "短い時間で印象良く挨拶する。", goalVi: "Chào tạo ấn tượng tốt trong thời gian ngắn.",
        characters: [{ npcSlug: "nakamura_hr", roleInScene: "superior" }],
        payload: { chatLog: [{ speaker: "（状況）", lineJa: "エレベーターのドアが開き、中村人事部長が乗っている。", timestamp: "2026-04-07T12:30:00Z" }] },
        question: { id: "q_elevator_01", skillTag: "keigo", difficulty: "easy",
          promptJa: "エレベーターで中村人事部長に会った時、最も適切な対応はどれですか？",
          promptVi: "Gặp GĐ nhân sự Nakamura trong thang máy, cách ứng xử nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "（軽く会釈して）お疲れ様です。営業部に配属になりました○○です。研修の際はありがとうございました。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 85, politenessScore: 88, businessRiskDelta: 0, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "簡潔に所属を名乗り、接点にも触れる好印象な挨拶です。", consequenceVi: "Ngắn gọn giới thiệu phòng ban, nhắc lại điểm quen biết. Ấn tượng tốt.", affectedNpcSlug: "nakamura_hr", errorType: null } },
            { optionKey: "B", textJa: "（目を合わせずスマホを見る）", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 0, politenessScore: 10, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "挨拶をしないのは社会人として致命的です。", consequenceVi: "Không chào là lỗi chí mạng của người đi làm.", affectedNpcSlug: "nakamura_hr", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "あ、中村部長！研修楽しかったです！今度飲みに行きましょう！", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 60, politenessScore: 15, businessRiskDelta: 7, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "距離感が近すぎます。新入社員として不適切。", consequenceVi: "Quá thân mật, không phù hợp với vai nhân viên mới.", affectedNpcSlug: "nakamura_hr", errorType: "keigo_misunderstanding" } },
            { optionKey: "D", textJa: "（深々とお辞儀）大変お世話になっております。本日は良いお天気ですね。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 40, politenessScore: 70, businessRiskDelta: 2, satisfactionDelta: -2, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "社内で「お世話になっております」は不自然。天気の話も唐突。", consequenceVi: "'Osewa ni' là cho bên ngoài. Nói chuyện thời tiết cũng đột ngột.", affectedNpcSlug: "nakamura_hr", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 10, skillGains: { keigo: 4, meeting: 2 }, npcTrustGains: [{ npcSlug: "nakamura_hr", delta: 6 }] },
    },
    {
      slug: "company-wide-email", ja: "全社メールでの着任挨拶", vi: "Email giới thiệu bản thân gửi toàn công ty", order: 3, boss: false,
      briefing: { briefingJa: "山田部長から「全社向けに着任挨拶メールを送ってください」と指示がありました。全社メールの書き方を学びます。", briefingVi: "Sếp Yamada yêu cầu gửi email giới thiệu cho toàn công ty. Học cách viết email toàn thể.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_companymail_01", scenarioType: "email", titleJa: "全社着任メールの書き方", titleVi: "Cách viết email nhận việc gửi toàn công ty",
        contextSummaryVi: "Email gửi cho tất cả nhân viên (~200 người). Cần ngắn gọn, lịch sự, tạo ấn tượng chuyên nghiệp.",
        goalJa: "全社に向けた簡潔で好印象な着任メールを書く。", goalVi: "Viết email nhận việc ngắn gọn, chuyên nghiệp, ấn tượng tốt cho toàn công ty.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "reviewer" }],
        payload: { emailThread: [{ from: "あなた", to: "社員各位", subjectJa: "【着任のご挨拶】営業部 ○○", bodyJa: "（全文を選ぶ）", timestamp: "2026-04-07T15:00:00Z" }] },
        question: { id: "q_companymail_01", skillTag: "written", difficulty: "standard",
          promptJa: "全社向け着任メールとして最も適切なものはどれですか？",
          promptVi: "Email nhận việc gửi toàn công ty, phương án nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "社員各位\n\nお疲れ様です。\n本日より営業部に配属になりました○○と申します。\n\n前職では3年間メーカーで法人営業を担当しておりました。\nまだまだ不慣れなことも多いかと存じますが、\n一日も早く会社に貢献できるよう精進してまいります。\n\nお見かけの際はお気軽にお声がけいただけますと嬉しいです。\nどうぞよろしくお願いいたします。\n\n営業部 ○○", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 88, businessRiskDelta: 0, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "適切な長さ、経歴紹介、謙虚さ、親しみやすさのバランスが良い。", consequenceVi: "Độ dài phù hợp, giới thiệu kinh nghiệm, khiêm tốn, dễ gần — cân bằng tốt.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "皆さんこんにちは！新入りの○○です！\n趣味は釣りとサウナです。飲み会大歓迎！\n気軽に声かけてくださいね〜。よろしく！", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 15, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "社内メールとしてカジュアルすぎます。ビジネスの場を忘れています。", consequenceVi: "Quá suồng sã cho email công ty. Quên rằng đây là môi trường công sở.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "各位\n\n○○と申します。本日付けで営業部に着任いたしました。\nよろしくお願いいたします。\n\n以上", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 45, politenessScore: 70, businessRiskDelta: 3, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "短すぎて人柄が伝わりません。もう少し情報を。", consequenceVi: "Quá ngắn, không truyền tải được con người bạn.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "社員各位\n\nいつもお世話になっております。\n本日より営業部に配属の○○でございます。\n前職では大手商社にて10年の経験を積んでまいりました。\n貴社の営業力強化に必ずや貢献できるものと確信しております。\nご期待ください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 65, politenessScore: 55, businessRiskDelta: 5, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "自信過剰で傲慢に見えます。「貴社」は社外表現です。", consequenceVi: "Quá tự tin đến kiêu ngạo. 'Kisha' (quý công ty) là dùng cho bên ngoài.", affectedNpcSlug: "yamada_bucho", errorType: "internal_external_tone_mismatch" } },
          ],
        },
      }] },
      rewards: { rankXp: 14, skillGains: { written: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 6 }] },
    },
    {
      slug: "boss-first-week-review", ja: "【確認】初週の振り返り面談", vi: "【Boss】Họp đánh giá tuần đầu tiên", order: 4, boss: true,
      briefing: { briefingJa: "入社1週間。山田部長との初めての1on1面談です。これまで学んだマナーを実践しながら、自分の業務目標を伝えます。", briefingVi: "Sau 1 tuần nhập xã, họp 1:1 đầu tiên với sếp Yamada. Thực hành phép tắc đã học, trình bày mục tiêu công việc.", yourRoleVi: "新入社員（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_firstweek_boss_01", scenarioType: "meeting", titleJa: "山田部長との1on1：目標設定", titleVi: "1:1 với sếp Yamada: đặt mục tiêu",
        contextSummaryVi: "Sếp hỏi bạn muốn đạt được gì trong 3 tháng đầu. Đây là cơ hội thể hiện thái độ và năng lực giao tiếp.",
        goalJa: "具体的で測定可能な目標を、謙虚かつ前向きに伝える。", goalVi: "Trình bày mục tiêu cụ thể, đo lường được, với thái độ khiêm tốn và tích cực.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "manager" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "入社1週間、どうだ？3ヶ月後の目標を聞かせてくれ。" }] },
        question: { id: "q_firstweek_boss_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "山田部長に3ヶ月後の目標を聞かれました。最も適切な回答はどれですか？",
          promptVi: "Sếp Yamada hỏi mục tiêu sau 3 tháng. Câu trả lời nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "はい、ありがとうございます。3ヶ月後の目標として、3点考えております。\n第一に、既存顧客10社の担当引き継ぎを完了すること。\n第二に、社内システムを一人で操作できるようになること。\n第三に、田中先輩の同行なしで顧客訪問を1件実施すること。\nまだまだ学ぶことが多いですが、ご指導いただきながら着実に進めてまいります。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 90, businessRiskDelta: -5, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "具体的・測定可能・現実的。上司が評価しやすい回答です。", consequenceVi: "Cụ thể, đo lường được, thực tế. Sếp dễ đánh giá.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "頑張ります！何でも任せてください！", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 15, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体性ゼロ。意気込みだけでは評価できません。", consequenceVi: "Không có gì cụ thể. Chỉ có nhiệt huyết thì sếp không đánh giá được.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "正直まだよく分かりません。先輩方に教えていただきながら、徐々に慣れていきたいです。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 25, politenessScore: 65, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "受け身すぎます。自分なりの目標を持つ姿勢が必要です。", consequenceVi: "Quá thụ động. Cần thể hiện chủ động đặt mục tiêu cho mình.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "3ヶ月で売上1000万を達成します。前職の経験があるので問題ありません。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 60, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "非現実的で傲慢です。入社1週間で市場を理解していないはず。", consequenceVi: "Phi thực tế và kiêu ngạo. Mới 1 tuần chưa thể hiểu thị trường.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { meeting: 6, keigo: 4, written: 2 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 12 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "具体的でいいね。その調子で進めてくれ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.jiko-shoukai: 4 chapters");
  console.log(`✓ R1 complete: 2 arcs, 8 chapters`);
}

if (process.argv[1]?.includes("02-r1")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR1(client);
  await client.end();
}
