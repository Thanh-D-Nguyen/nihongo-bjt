/**
 * Career RPG Production Seed — R5 係長 (Team Lead)
 * 3 arcs, 12 chapters: Team leadership + Client presentation + Budget reporting
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR5(client) {
  /* ═══ Arc 12: チームリーダーシップ ═══════════════════════════════════════ */
  const arc12Id = await upsertArc(client, {
    slug: "arc.team-leadership", ja: "チームリーダーシップ", vi: "Lãnh đạo team",
    rank: "R5", order: 12,
    story: { synopsisVi: "Trở thành trưởng nhóm: xây dựng mục tiêu team, quản lý performance, coaching, và 1-on-1 hiệu quả.", npcSlugs: ["yamada_bucho", "morita_kouhai", "tanaka_senpai", "suzuki_kakaricho"], artAccent: "#2563EB" },
  });

  await upsertChapters(client, arc12Id, [
    {
      slug: "team-goal-setting", ja: "チーム目標の設定と共有", vi: "Thiết lập và chia sẻ mục tiêu team", order: 1, boss: false,
      briefing: { briefingJa: "係長就任初日。チーム3名に四半期目標を提示し、意欲を引き出す。", briefingVi: "Ngày đầu nhậm chức team lead. Trình bày mục tiêu quý cho 3 thành viên.", yourRoleVi: "係長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_teamgoal_01", scenarioType: "meeting", titleJa: "四半期キックオフ", titleVi: "Kickoff quý",
        contextSummaryVi: "Mục tiêu: doanh thu +15%, khách mới 5 hãng, NPS >80. Team: Tanaka (senior), Morita (junior), bạn (lead).",
        goalJa: "数字だけでなくチームのビジョンを示し、各人の役割を明確にする。", goalVi: "Không chỉ con số mà cả tầm nhìn team, vai trò rõ ràng cho từng người.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "member" }, { npcSlug: "morita_kouhai", roleInScene: "member" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "四半期キックオフミーティング。全員があなたの言葉を待っている。" }] },
        question: { id: "q_teamgoal_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "チームキックオフでの最も効果的なリーダーの言葉はどれですか？",
          promptVi: "Ở kickoff team, lời nào của leader hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "みなさん、今期もよろしくお願いします。まず、このチームで何を実現したいか共有させてください。\n\n【ビジョン】お客様から『ミライ商事に相談すれば安心』と言われるチームに。\n\n【目標】\n①売上：前期比+15%（5,750万円）\n②新規：5社獲得\n③顧客満足：NPS 80以上\n\n【各人への期待】\n田中さん：大型顧客のアップセル（あなたの関係構築力が鍵）\n森田さん：新規開拓5社中3社を担当（成長のチャンス）\n私：全体調整と大型案件サポート\n\n二週間ごとに振り返りミーティングしましょう。困ったことは早めに共有してください。一人で抱えないで。\n\n何か意見やアイデアある人？", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 88, businessRiskDelta: -8, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "ビジョン→数字→個別期待→サポート姿勢→双方向。優秀。", consequenceVi: "Vision → Số liệu → Kỳ vọng cá nhân → Hỗ trợ → Hai chiều. Xuất sắc.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "今期の目標は売上+15%です。全員頑張ってください。以上。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "数字の押し付けだけ。人の心は動かない。", consequenceVi: "Chỉ áp đặt con số. Không lay động lòng người.", affectedNpcSlug: "morita_kouhai", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "僕も新任なので分からないことだらけです。みんなで相談しながらやっていきましょう。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 20, politenessScore: 65, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "謙虚すぎ。リーダーとしての方向性を示すべき。", consequenceVi: "Quá khiêm tốn. Leader cần chỉ ra phương hướng.", affectedNpcSlug: "tanaka_senpai", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "前のチームリーダーは甘かったから今期から厳しくいきます。気合い入れてください。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 15, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "前任否定＋威圧。チームの信頼を最初から壊す。", consequenceVi: "Phủ nhận người tiền nhiệm + đe dọa. Phá tin tưởng từ đầu.", affectedNpcSlug: "morita_kouhai", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 30, skillGains: { meeting: 7, nuance: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 10 }, { npcSlug: "morita_kouhai", delta: 10 }] },
    },
    {
      slug: "one-on-one-coaching", ja: "1on1コーチング", vi: "Coaching 1-on-1", order: 2, boss: false,
      briefing: { briefingJa: "森田が最近元気がない。1on1で本音を引き出し、サポートします。", briefingVi: "Morita gần đây thiếu năng lượng. Phiên 1-on-1 để hiểu tâm tư, hỗ trợ.", yourRoleVi: "係長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_1on1_01", scenarioType: "meeting", titleJa: "森田との1on1面談", titleVi: "1-on-1 với Morita",
        contextSummaryVi: "Morita 3 tháng làm việc, số liệu đạt nhưng thái độ kém hứng khởi. Có thể stress hoặc không thấy career path.",
        goalJa: "傾聴し、本人が自分で答えを見つけるよう導く。", goalVi: "Lắng nghe, dẫn dắt để bản thân tìm ra câu trả lời.",
        characters: [{ npcSlug: "morita_kouhai", roleInScene: "coachee" }],
        payload: { meetingTranscript: [{ speaker: "森田", lineJa: "最近…なんか自分がこのチームで何の役に立ってるのか分からなくなって…" }] },
        question: { id: "q_1on1_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "「役に立っているか分からない」と言う森田への最も適切なコーチング対応は？",
          promptVi: "Morita nói 'không biết mình có ích gì'. Cách coaching nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "そう感じてたんだ。話してくれてありがとう。\n\nまず聞かせて。森田さんが「役に立った」と実感できたのは、最近でいつだった？\n\n…なるほど。実は先週の佐藤様からの問い合わせ対応、社内で評価されてたの知ってた？高橋部長も「的確だった」って。\n\nもう一つ聞いていい？半年後、どんな仕事ができるようになりたい？…じゃあ、そこに向けて次の四半期で一つ新規案件をメインで任せてみようと思うけど、どう？", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 88, politenessScore: 92, businessRiskDelta: -5, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "共感→事実で自信回復→将来像→具体的成長機会。傾聴のプロ。", consequenceVi: "Đồng cảm → Khôi phục tự tin bằng sự thật → Tương lai → Cơ hội cụ thể. Nghệ thuật lắng nghe.", affectedNpcSlug: "morita_kouhai", errorType: null } },
            { optionKey: "B", textJa: "そんなことないよ！森田さんはすごく役に立ってるよ！", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 25, politenessScore: 65, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "表面的な励まし。具体性がなく響かない。", consequenceVi: "Khích lệ hời hợt. Không cụ thể, không lay động.", affectedNpcSlug: "morita_kouhai", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "仕事は結果だよ。数字出してるなら問題ないでしょ。気にしすぎ。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 25, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "感情を否定。本音を聞く姿勢ゼロ。", consequenceVi: "Phủ nhận cảm xúc. Không có thái độ lắng nghe.", affectedNpcSlug: "morita_kouhai", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "じゃあ何がしたいの？やりたいこと言ってくれればできるだけ対応するけど。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 35, politenessScore: 50, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "コーチングではなく要求聴取。本人が答えを持てない状態を無視。", consequenceVi: "Hỏi yêu cầu, không phải coaching. Bỏ qua việc đối phương chưa có câu trả lời.", affectedNpcSlug: "morita_kouhai", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 32, skillGains: { nuance: 8, meeting: 5 }, npcTrustGains: [{ npcSlug: "morita_kouhai", delta: 15 }] },
    },
    {
      slug: "performance-review", ja: "業績評価面談", vi: "Đánh giá hiệu suất", order: 3, boss: false,
      briefing: { briefingJa: "田中先輩の半期評価面談。良い点も課題もバランスよく伝えます。", briefingVi: "Phiên đánh giá nửa năm cho Tanaka. Cân bằng điểm tốt và cần cải thiện.", yourRoleVi: "係長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_review_01", scenarioType: "meeting", titleJa: "田中先輩の半期評価", titleVi: "Đánh giá nửa năm cho Tanaka",
        contextSummaryVi: "Tanaka: doanh số 120% mục tiêu nhưng hợp tác team kém, không chia sẻ know-how, báo cáo trễ. Cần nói thẳng mà vẫn tôn trọng.",
        goalJa: "強みを認めつつ、改善点を具体的に伝える。", goalVi: "Công nhận sở trường, đồng thời nêu cụ thể điểm cần cải thiện.",
        characters: [{ npcSlug: "tanaka_senpai", roleInScene: "evaluee" }],
        payload: { meetingTranscript: [{ speaker: "田中先輩", lineJa: "数字は出してますよね。評価はAで問題ないですか？" }] },
        question: { id: "q_review_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "数字は出しているが協調性に課題がある田中先輩への評価フィードバックは？",
          promptVi: "Tanaka đạt số nhưng thiếu hợp tác. Feedback đánh giá thế nào?",
          options: [
            { optionKey: "A", textJa: "田中さん、まず売上120%達成、素晴らしい成果です。チームの柱として感謝しています。\n\n評価ですが、総合B+とさせてください。理由を説明します。\n\n【S: 売上】文句なしのA。大型案件2件を単独で受注。\n【A: 顧客対応】高い品質。リピート率も部内トップ。\n【B: チーム貢献】ここが課題。具体的に：\n ・月次会議の知見共有が2回不参加\n ・森田からの相談に「忙しい」で終わるケースが3回\n ・週報の提出遅延が月4回\n\n田中さんの経験とスキルはチームの宝です。それを共有することで、チーム全体の売上が上がり、田中さん自身も管理職への道が開けます。\n\n来期は「チーム売上を自分の売上と同じ重みで見る」ことを目標にしませんか？", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 88, businessRiskDelta: -8, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "認める→根拠ある評価→具体的課題→キャリアと紐づけ。公正。", consequenceVi: "Công nhận → Đánh giá có căn cứ → Vấn đề cụ thể → Liên kết career. Công bằng.", affectedNpcSlug: "tanaka_senpai", errorType: null } },
            { optionKey: "B", textJa: "数字がいいのでAですね。引き続きよろしく。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 60, businessRiskDelta: 10, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "課題を指摘できないリーダーはチームを壊す。", consequenceVi: "Leader không chỉ ra vấn đề sẽ phá hỏng team.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "田中さん、正直に言います。チームワークが全然ダメです。数字だけ追うのはプロじゃない。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 15, businessRiskDelta: 8, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "攻撃的すぎ。良い点を認めず人格否定に聞こえる。", consequenceVi: "Quá khích. Không công nhận điểm tốt, nghe như phủ nhận nhân cách.", affectedNpcSlug: "tanaka_senpai", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "数字はいいんですが…みんなもう少し助けてほしいと言ってまして…できれば…", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 30, politenessScore: 55, businessRiskDelta: 6, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "曖昧で伝わらない。リーダーの責任放棄。", consequenceVi: "Mơ hồ, không truyền đạt được. Leader thoái thác trách nhiệm.", affectedNpcSlug: "tanaka_senpai", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 32, skillGains: { nuance: 8, meeting: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "tanaka_senpai", delta: 8 }] },
    },
    {
      slug: "boss-team-turnaround", ja: "【難関】チーム成績回復の立て直し", vi: "【Boss】Vực dậy thành tích team", order: 4, boss: true,
      briefing: { briefingJa: "チーム目標の達成率が60%に低下。山田部長から報告を求められ、立て直し策を提示します。", briefingVi: "Tỷ lệ đạt mục tiêu team giảm xuống 60%. Sếp Yamada yêu cầu báo cáo và kế hoạch vực dậy.", yourRoleVi: "係長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_turnaround_01", scenarioType: "meeting", titleJa: "チーム立て直し策の報告", titleVi: "Báo cáo kế hoạch vực dậy team",
        contextSummaryVi: "Quý 2: đạt 60% mục tiêu. Nguyên nhân: mất 2 khách lớn, Morita ốm 2 tuần, thị trường giảm. Sếp muốn kế hoạch cụ thể.",
        goalJa: "原因分析と具体的な回復計画を示し、部長の信頼を維持する。", goalVi: "Phân tích nguyên nhân + kế hoạch phục hồi cụ thể, giữ niềm tin của sếp.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "evaluator" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "60%は深刻だ。何が起きた？どう立て直す？" }] },
        question: { id: "q_turnaround_01", skillTag: "chart", difficulty: "hard",
          promptJa: "チーム成績60%について部長に報告し立て直し策を提示する際、最も適切な内容は？",
          promptVi: "Báo cáo thành tích 60% và kế hoạch vực dậy, nội dung nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "部長、率直にご報告します。\n\n【結果】Q2達成率60%（目標5,750万に対し3,450万）\n\n【要因分析】\n①外部要因（40%）：A社・B社の予算凍結（計1,200万減）市場全体で-8%\n②内部要因（60%）：\n ・森田2週間離脱で新規活動停滞\n ・既存顧客フォローが手薄に（私のマネジメント不足）\n\n【Q3回復計画】\n①即効策（今月）：既存顧客30社に一斉フォロー→アップセル3件想定\n②中期策（2ヶ月）：パイプライン確保済み5社への集中営業\n③構造改善：田中の知見共有→チーム全体の受注率向上\n\n【目標】Q3で120%達成し、上半期の遅れを回復\n\n申し訳ありません。私の力不足です。Q3で必ず挽回します。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 96, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "数字→要因（外部/内部）→3段階対策→責任の引き受け。リーダー。", consequenceVi: "Số liệu → Phân tích (ngoại/nội) → 3 bước đối sách → Nhận trách nhiệm. Leader.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "市場環境が悪くて…森田も休んで…仕方なかったです。Q3は頑張ります。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "言い訳ばかりで具体策なし。リーダー失格。", consequenceVi: "Toàn biện hộ, không đối sách. Không xứng leader.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "田中が自分のことだけやってチーム貢献しないのが主因です。指導を強化します。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "メンバーのせいにするリーダーは信頼されない。", consequenceVi: "Leader đổ lỗi cho member sẽ mất tin tưởng.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "挽回は難しいかもしれません。目標を下方修正していただけませんか。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 55, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "早々に諦めるのはリーダーの姿勢でない。まず改善策を示すべき。", consequenceVi: "Bỏ cuộc sớm không phải tư thế leader. Phải đưa đối sách trước.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 48, skillGains: { chart: 8, meeting: 7, nuance: 5, written: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 12 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "正直な分析と具体策。信じて任せる。Q3の結果を楽しみにしてるぞ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.team-leadership: 4 chapters");

  /* ═══ Arc 13: 顧客プレゼン ══════════════════════════════════════════════ */
  const arc13Id = await upsertArc(client, {
    slug: "arc.client-presentation", ja: "顧客プレゼン", vi: "Thuyết trình cho khách hàng",
    rank: "R5", order: 13,
    story: { synopsisVi: "Thuyết trình trước khách hàng lớn: chuẩn bị, kỹ năng trình bày, xử lý Q&A, close the deal.", npcSlugs: ["takahashi_clienthq", "kim_partner", "yamada_bucho"], artAccent: "#D97706" },
  });

  await upsertChapters(client, arc13Id, [
    {
      slug: "presentation-prep", ja: "プレゼン資料の準備と構成", vi: "Chuẩn bị và cấu trúc slide", order: 1, boss: false,
      briefing: { briefingJa: "来週の高橋部長向けプレゼン。ストーリーラインと資料構成を決めます。", briefingVi: "Thuyết trình tuần sau cho GĐ Takahashi. Quyết định storyline và cấu trúc.", yourRoleVi: "係長（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_prep_01", scenarioType: "meeting", titleJa: "プレゼン構成の検討", titleVi: "Xem xét cấu trúc thuyết trình",
        contextSummaryVi: "Mục đích: đề xuất gói dịch vụ mới trị giá 2000 man/năm. Audience: GĐ Takahashi + team 3 người. Thời gian: 30 phút.",
        goalJa: "聴衆に合わせた説得力ある構成を設計する。", goalVi: "Thiết kế cấu trúc thuyết phục phù hợp người nghe.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "reviewer" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "高橋さん向けのプレゼン構成、見せてくれ。" }] },
        question: { id: "q_prep_01", skillTag: "chart", difficulty: "standard",
          promptJa: "30分プレゼンの構成として最も効果的なものはどれですか？",
          promptVi: "Cấu trúc slide 30 phút nào hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "【構成案】\n1. 課題提起（3分）：御社の現状と業界トレンドから見える課題\n2. 解決策（10分）：弊社サービスの3つの価値提案\n3. 実績データ（5分）：同業他社での導入効果（具体的数字）\n4. 投資対効果（5分）：2000万円投資→年間3200万円のコスト削減効果\n5. 導入ステップ（4分）：具体的なスケジュールとサポート体制\n6. Q&A（3分）\n\nポイント：高橋部長は数字重視の方なので、ROIを厚めに。\n想定質問5つと回答も準備します。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 85, businessRiskDelta: -5, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "課題→解決→実績→ROI→行動→Q&A。論理的で聴衆意識もある。", consequenceVi: "Vấn đề → Giải pháp → Thực tế → ROI → Hành động → Q&A. Logic, ý thức audience.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "弊社の会社概要→サービス一覧→価格表→お願い、の流れでいきます。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "自社中心で顧客課題に触れていない。カタログ営業。", consequenceVi: "Tập trung vào mình, không đề cập vấn đề khách. Bán catalogue.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "スライドは当日の雰囲気で調整します。柔軟に対応しましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 15, politenessScore: 40, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "2000万の提案でノープランは論外。", consequenceVi: "Đề xuất 2000 man mà không có kế hoạch là vô lý.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "50枚のスライドで弊社の全サービスを網羅的に紹介します。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "30分で50枚は聞く側の負担大。焦点が定まっていない。", consequenceVi: "50 slide trong 30 phút là quá tải. Thiếu trọng tâm.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 28, skillGains: { chart: 7, meeting: 4, written: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "handling-tough-questions", ja: "厳しい質問への対応", vi: "Xử lý câu hỏi khó", order: 2, boss: false,
      briefing: { briefingJa: "プレゼン中に金パートナーから予想外の質問。冷静に対応します。", briefingVi: "Giữa buổi thuyết trình, Kim-partner hỏi câu khó bất ngờ. Xử lý bình tĩnh.", yourRoleVi: "係長（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_tough_01", scenarioType: "meeting", titleJa: "プレゼン中の想定外質問", titleVi: "Câu hỏi bất ngờ giữa buổi thuyết trình",
        contextSummaryVi: "Kim-partner (đối tác Hàn Quốc) hỏi: 'Đối thủ cạnh tranh đang offer giải pháp tương tự với giá rẻ hơn 30%. Sao chúng tôi nên chọn bạn?'",
        goalJa: "動揺せず、自社の差別化ポイントを論理的に説明する。", goalVi: "Không dao động, giải thích điểm khác biệt logic.",
        characters: [{ npcSlug: "kim_partner", roleInScene: "questioner" }, { npcSlug: "takahashi_clienthq", roleInScene: "observer" }],
        payload: { meetingTranscript: [{ speaker: "金パートナー", lineJa: "ちなみに、X社さんが30%安い価格で同様のサービスを提案してきましたが、御社の優位性はどこですか？" }] },
        question: { id: "q_tough_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "「競合が30%安い」という質問への最も効果的な回答は？",
          promptVi: "Câu hỏi 'đối thủ rẻ hơn 30%', trả lời hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "金様、率直なご質問ありがとうございます。\n\n価格差30%は事実として重要ですね。ただ、3点ご確認いただきたいのですが：\n\n①総所有コスト：X社は追加オプションが別料金。弊社は全込み。3年間のTCOでは弊社が12%安くなります。\n②品質実績：弊社の稼働率99.9%に対し、X社は97%（年間11日の差）。ダウンタイムコストを計算すると…\n③サポート体制：24時間日本語対応＋専任担当。X社は本国対応のみ。\n\n「安い」と「お得」は違います。投資回収期間でご比較いただけると、ご納得いただけるかと存じます。\n\n詳細な比較資料を追って送付いたします。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "感謝→価格差認める→3つのデータで反論→追加資料約束。完璧。", consequenceVi: "Cảm ơn → Thừa nhận giá chênh → 3 dữ liệu phản biện → Hứa gửi thêm. Hoàn hảo.", affectedNpcSlug: "kim_partner", errorType: null } },
            { optionKey: "B", textJa: "X社さんは価格は安いですが品質が…正直あまりお勧めしません。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 40, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "競合の悪口はプロフェッショナルでない。データもなし。", consequenceVi: "Nói xấu đối thủ không chuyên nghiệp. Thiếu dữ liệu.", affectedNpcSlug: "kim_partner", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "え…30%ですか…。ちょっと社に持ち帰って検討させてください。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 20, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "プレゼンの場で自信喪失。信頼性ゼロ。", consequenceVi: "Mất tự tin giữa buổi thuyết trình. Uy tín bằng 0.", affectedNpcSlug: "takahashi_clienthq", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "価格で選ぶなら確かにX社でしょうね。でも安かろう悪かろうですよ。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 20, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "相手を見下す発言。相手がX社の提案も検討中なのに。", consequenceVi: "Coi thường đối phương. Họ đang xem xét cả X.", affectedNpcSlug: "kim_partner", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 32, skillGains: { meeting: 7, customer: 5, chart: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "kim_partner", delta: 12 }, { npcSlug: "takahashi_clienthq", delta: 8 }] },
    },
    {
      slug: "closing-presentation", ja: "クロージングプレゼン", vi: "Thuyết trình chốt deal", order: 3, boss: false,
      briefing: { briefingJa: "最終プレゼン。決裁者を前に最後の一押し。", briefingVi: "Thuyết trình cuối. Trước mặt người quyết định, đẩy nốt.", yourRoleVi: "係長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_close_01", scenarioType: "meeting", titleJa: "最終意思決定の場面", titleVi: "Khoảnh khắc quyết định cuối cùng",
        contextSummaryVi: "Takahashi nói: 'Hiểu rồi. Nhưng timing khó. Có thể đợi quý sau không?' Bạn biết đợi = mất deal.",
        goalJa: "押しすぎず引きすぎず、今決める理由を提示する。", goalVi: "Không ép quá, không lùi quá, đưa lý do quyết ngay.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "decision-maker" }],
        payload: { meetingTranscript: [{ speaker: "高橋部長", lineJa: "良い提案だと思う。ただ、今は忙しくて…来期からじゃダメかな。" }] },
        question: { id: "q_close_01", skillTag: "customer", difficulty: "hard",
          promptJa: "「来期にしたい」という高橋部長を今期に引き寄せる最も効果的な対応は？",
          promptVi: "GĐ Takahashi nói 'quý sau'. Cách kéo về quý này hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、お忙しい中ご検討いただきありがとうございます。\nもちろん御社のタイミングが最優先です。ただ一点、今期スタートのメリットをお伝えさせてください。\n\n①Q4の繁忙期に間に合う：今月導入→3ヶ月の定着期間→10月の繁忙期から効果発揮\n②初期費用の特別対応：今月契約で導入支援費200万円→0円\n③先行者優位：御社が業界初導入となり、事例企業としてメディア露出もご提供\n\n逆に来期の場合、繁忙期に間に合わず効果測定がQ2以降になります。\n\nもしご決裁のハードルがありましたら、お手伝いできることは何でもいたします。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 92, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "尊重→時間軸のメリット→具体的特典→サポート姿勢。", consequenceVi: "Tôn trọng → Lợi ích timeline → Ưu đãi cụ thể → Sẵn sàng hỗ trợ.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "来期だと価格が上がりますよ。今がチャンスです！", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 45, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "恐怖マーケティング。信頼を失う。", consequenceVi: "Marketing bằng nỗi sợ. Mất uy tín.", affectedNpcSlug: "takahashi_clienthq", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "分かりました。来期お声がけください。お待ちしています。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 40, politenessScore: 70, businessRiskDelta: 10, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "あっさり引きすぎ。来期には他社に取られるリスク。", consequenceVi: "Rút quá dễ. Quý sau có thể bị đối thủ lấy mất.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "高橋様が今決めないと、この話は白紙に戻りますが…", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 15, businessRiskDelta: 14, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "脅し。長期関係を破壊する最悪のクロージング。", consequenceVi: "Đe dọa. Closing tệ nhất, phá hủy quan hệ dài hạn.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 34, skillGains: { customer: 8, nuance: 6, meeting: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 12 }] },
    },
    {
      slug: "boss-major-pitch", ja: "【難関】大型案件の最終ピッチ", vi: "【Boss】Pitch cuối cho dự án lớn", order: 4, boss: true,
      briefing: { briefingJa: "5000万円案件。伊藤社長も同席する最終ピッチ。会社の命運がかかっています。", briefingVi: "Dự án 5000 man. CEO Ito cũng tham dự. Quyết định vận mệnh công ty.", yourRoleVi: "係長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_majorpitch_01", scenarioType: "meeting", titleJa: "伊藤社長同席の最終ピッチ", titleVi: "Pitch cuối có CEO Ito tham dự",
        contextSummaryVi: "5000 man → 3 năm contract. CEO hỏi: 'Nếu không đạt KPI cam kết, bạn chịu trách nhiệm thế nào?'",
        goalJa: "経営者の言語で話し、信頼と責任を示す。", goalVi: "Nói bằng ngôn ngữ của lãnh đạo, thể hiện tin tưởng và trách nhiệm.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "evaluator" }, { npcSlug: "takahashi_clienthq", roleInScene: "supporter" }, { npcSlug: "yamada_bucho", roleInScene: "backup" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "もしKPIが達成できなかった場合、責任はどう取るの？" }] },
        question: { id: "q_majorpitch_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "伊藤社長の「KPI未達時の責任」質問に対する最も適切な回答は？",
          promptVi: "CEO Ito hỏi 'trách nhiệm khi không đạt KPI'. Trả lời đúng nhất?",
          options: [
            { optionKey: "A", textJa: "伊藤社長、重要なご質問ありがとうございます。\n\n弊社は成果にコミットいたします。具体的に：\n\n①四半期ごとのKPIレビュー会議を設定\n②KPI未達が2四半期連続の場合：追加サポートチーム投入（弊社負担）\n③1年経過時点でROIマイナスの場合：2年目のサービス費用を50%減額\n\nただし、正直に申し上げると、これは過去12社の導入実績で一度も発動されていない条項です。\n平均で契約額の1.6倍のROIを実現しています。\n\n数字でお示しする自信があるからこそ、このコミットメントが可能です。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "具体的保証→実績データ→自信の裏付け。経営者を説得する力。", consequenceVi: "Bảo đảm cụ thể → Dữ liệu thực tế → Cơ sở tự tin. Sức thuyết phục lãnh đạo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "絶対にKPIは達成しますのでご安心ください。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 20, politenessScore: 55, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "根拠のない断言。経営者は信用しない。", consequenceVi: "Khẳng định vô căn cứ. Lãnh đạo không tin.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "KPIは御社の努力も必要ですので、弊社だけの責任ではないかと…", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 45, politenessScore: 35, businessRiskDelta: 15, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "責任を回避する姿勢。売り込む側として最悪。", consequenceVi: "Né tránh trách nhiệm. Tệ nhất cho bên bán.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "全額返金保証をお付けします。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 60, businessRiskDelta: 20, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "5000万の全額返金は経営判断を超える。権限逸脱。", consequenceVi: "Hoàn toàn bộ 5000 man vượt quyền quyết định kinh doanh. Vượt thẩm quyền.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 52, skillGains: { meeting: 10, customer: 8, chart: 6, nuance: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }, { npcSlug: "takahashi_clienthq", delta: 12 }, { npcSlug: "yamada_bucho", delta: 10 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "具体的で自信がある。この係長は将来有望だ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.client-presentation: 4 chapters");

  /* ═══ Arc 14: 予算報告と数字分析 ════════════════════════════════════════ */
  const arc14Id = await upsertArc(client, {
    slug: "arc.budget-reporting", ja: "予算報告と数字分析", vi: "Báo cáo ngân sách và phân tích số liệu",
    rank: "R5", order: 14,
    story: { synopsisVi: "Quản lý ngân sách team: lập budget, theo dõi chi tiêu, báo cáo lên cấp trên bằng biểu đồ và số liệu.", npcSlugs: ["yamada_bucho", "ogawa_finance", "ito_shachou"], artAccent: "#166534" },
  });

  await upsertChapters(client, arc14Id, [
    {
      slug: "budget-proposal", ja: "予算案の作成と申請", vi: "Lập và xin duyệt ngân sách", order: 1, boss: false,
      briefing: { briefingJa: "来期のチーム予算案（人件費・交通費・ツール費）を山田部長に提出します。", briefingVi: "Lập budget quý tới (nhân sự, đi lại, công cụ) nộp cho sếp Yamada.", yourRoleVi: "係長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_budget_01", scenarioType: "email", titleJa: "予算案のメール提出", titleVi: "Email nộp ngân sách",
        contextSummaryVi: "Team 3 người. Budget yêu cầu: nhân sự 900 man, đi lại 50 man, tool 30 man. Tổng 980 man (tăng 8% so với quý trước).",
        goalJa: "数字の根拠を示し、投資対効果を明確にする。", goalVi: "Nêu căn cứ con số, ROI rõ ràng.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "approver" }],
        payload: { emailThread: [{ from: "あなた", to: "山田 部長", subjectJa: "【承認依頼】Q3チーム予算案", bodyJa: "（選ぶ）", timestamp: "2026-06-20T09:00:00Z" }] },
        question: { id: "q_budget_01", skillTag: "chart", difficulty: "standard",
          promptJa: "予算案メールとして最も適切なものはどれですか？",
          promptVi: "Email ngân sách nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "山田部長\nお疲れ様です。Q3のチーム予算案をご確認いただきたく、ご送付いたします。\n\n■ 予算総額：980万円（前期比+8%）\n■ 内訳：\n  ・人件費：900万（田中＋森田＋新規派遣1名）\n  ・交通費：50万（新規営業の訪問増加分+10万）\n  ・ツール：30万（CRM年額＋新規分析ツール月5万×6ヶ月）\n\n■ 増額理由：\n  ①新規分析ツール導入→見込み客発掘の効率50%向上\n  ②訪問増→新規5社獲得を支える活動費\n\n■ 投資対効果：\n  ツール投資30万→新規2社分の受注見込み（推定売上800万）\n  ROI: 投資の26倍\n\nご不明点があればご説明いたします。ご承認をお願いいたします。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 85, businessRiskDelta: -5, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "総額→内訳→増額理由→ROI。承認しやすい。", consequenceVi: "Tổng → Chi tiết → Lý do tăng → ROI. Dễ duyệt.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "部長、来期980万でお願いします。詳細は添付です。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "本文に情報なし。忙しい上司は添付を開かない。", consequenceVi: "Body trống. Sếp bận không mở đính kèm.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "部長、予算ですが去年と同じでいいですか？変更ないです。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 25, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "8%増なのに「変更なし」は嘘。また計画性もない。", consequenceVi: "Tăng 8% mà nói 'không thay đổi' là sai. Thiếu kế hoạch.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "部長、予算を大幅に増やしたいです。2000万くらい。大きく攻めましょう！", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "根拠なき倍増要求。経営感覚がない。", consequenceVi: "Yêu cầu gấp đôi không căn cứ. Thiếu tư duy kinh doanh.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 28, skillGains: { chart: 7, written: 5, meeting: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "variance-analysis", ja: "予実差異分析", vi: "Phân tích chênh lệch thực tế vs kế hoạch", order: 2, boss: false,
      briefing: { briefingJa: "交通費が予算を20%超過。原因分析と対策を小川課長に報告します。", briefingVi: "Chi phí đi lại vượt 20% ngân sách. Phân tích nguyên nhân và báo cáo cho Ogawa.", yourRoleVi: "係長（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_variance_01", scenarioType: "email", titleJa: "予算超過の分析報告", titleVi: "Báo cáo phân tích vượt ngân sách",
        contextSummaryVi: "Dự kiến: 50 man. Thực tế: 60 man (+20%). Nguyên nhân: 3 chuyến đi tỉnh bất thường (3 khách hàng khẩn cấp). Cần giải trình cho Ogawa.",
        goalJa: "事実と原因を明確にし、今後の管理策を示す。", goalVi: "Sự thật và nguyên nhân rõ, nêu biện pháp quản lý.",
        characters: [{ npcSlug: "ogawa_finance", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "小川 課長", subjectJa: "【報告】Q2交通費予算超過の分析", bodyJa: "（選ぶ）", timestamp: "2026-07-05T10:00:00Z" }] },
        question: { id: "q_variance_01", skillTag: "chart", difficulty: "standard",
          promptJa: "予算超過の分析報告として最も適切なものはどれですか？",
          promptVi: "Báo cáo phân tích vượt ngân sách nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "小川課長\nお疲れ様です。Q2の交通費予算超過についてご報告いたします。\n\n■ 実績：60万円（予算50万円、超過10万円/+20%）\n■ 超過原因の内訳：\n  ①大阪A社緊急訪問（クレーム対応）：3.5万\n  ②名古屋B社契約締結（期日指定）：3.2万\n  ③福岡C社新規プレゼン（競合対策で急遽）：3.3万\n  →全て売上に直結する営業活動による超過\n\n■ 成果：3件で計1,200万円の売上を確保\n■ 投資効率：10万円の超過→1,200万円の売上（120倍）\n\n■ Q3の管理策：\n  ・月次で予実確認し、超過見込み時は事前承認を得る\n  ・オンライン商談を第一選択とし、対面は必要時のみ\n\nご確認のほどよろしくお願いいたします。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 85, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実→原因→成果と紐づけ→管理策。完璧。", consequenceVi: "Sự thật → Nguyên nhân → Liên kết kết quả → Biện pháp. Hoàn hảo.", affectedNpcSlug: "ogawa_finance", errorType: null } },
            { optionKey: "B", textJa: "小川課長、交通費10万オーバーしました。すみません。気をつけます。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 25, politenessScore: 45, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "分析なし、対策なし、ただ謝るだけ。", consequenceVi: "Không phân tích, không đối sách, chỉ xin lỗi.", affectedNpcSlug: "ogawa_finance", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "小川課長、予算設定が少なすぎたと思います。来期は80万に増額してください。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "予算不足のせいにして管理責任を放棄。", consequenceVi: "Đổ lỗi ngân sách thiếu, từ bỏ trách nhiệm quản lý.", affectedNpcSlug: "ogawa_finance", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "予算超過は営業部全体の問題なので、全体で対策を検討すべきです。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 35, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自チームの問題を全体に転嫁。責任感なし。", consequenceVi: "Đẩy vấn đề team mình ra toàn bộ. Thiếu trách nhiệm.", affectedNpcSlug: "ogawa_finance", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 26, skillGains: { chart: 7, written: 5 }, npcTrustGains: [{ npcSlug: "ogawa_finance", delta: 10 }] },
    },
    {
      slug: "quarterly-report-to-exec", ja: "経営会議用レポート", vi: "Báo cáo cho họp ban giám đốc", order: 3, boss: false,
      briefing: { briefingJa: "伊藤社長も出る経営会議用のレポートを作成。数字と戦略の両方を盛り込みます。", briefingVi: "Lập báo cáo cho họp BĐ có CEO Ito. Cần cả số liệu và chiến lược.", yourRoleVi: "係長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_execreport_01", scenarioType: "report_chart", titleJa: "経営会議用レポートの構成", titleVi: "Cấu trúc báo cáo cho họp BĐ",
        contextSummaryVi: "Team đạt 120% Q3. CEO muốn thấy: (1) kết quả, (2) why, (3) Q4 plan. Format: 1 trang A4 + biểu đồ.",
        goalJa: "エグゼクティブが3分で理解できるレポート構成。", goalVi: "Báo cáo mà lãnh đạo hiểu trong 3 phút.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "reader" }, { npcSlug: "yamada_bucho", roleInScene: "reviewer" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "社長向けレポート、A4一枚で。数字と次の戦略を入れて。" }] },
        question: { id: "q_execreport_01", skillTag: "chart", difficulty: "hard",
          promptJa: "経営会議用の1ページレポートとして最も適切な構成はどれですか？",
          promptVi: "Báo cáo 1 trang cho họp BĐ, cấu trúc nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "【ヘッダー】Q3営業部実績サマリー\n\n【KPIダッシュボード】（数字3つ大きく）\n売上：6,900万円（目標比120%）↑\n新規顧客：7社（目標5社）↑\nNPS：82（目標80）↑\n\n【成功要因】（箇条書き3点）\n①CRM分析ツール導入→見込み客精度50%向上\n②チーム内知見共有の仕組み化→全員の受注率向上\n③重点顧客5社の集中フォロー→アップセル成功\n\n【Q4戦略】（3行）\n①年間契約の推進（5社→8社へ拡大）\n②海外パートナー連携の準備（金氏と協議中）\n③チーム増員1名で体制強化\n\n【リスク】市場環境変化に備え、パイプライン常に15件以上を維持", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 98, politenessScore: 85, businessRiskDelta: -8, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "KPI大→成功要因→次の戦略→リスク。経営者の視点で完璧。", consequenceVi: "KPI lớn → Yếu tố thành công → Chiến lược tiếp → Rủi ro. Góc nhìn lãnh đạo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "（5ページの詳細レポートを作成）", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "1ページの指示を無視。経営者の時間を無駄にする。", consequenceVi: "Bỏ qua chỉ thị 1 trang. Lãng phí thời gian lãnh đạo.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "Q3は120%達成しました。Q4もこの調子で行きます。以上です。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "分析なし、戦略なし。社長に失礼。", consequenceVi: "Không phân tích, không chiến lược. Thất lễ với CEO.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "（各メンバーの個別成績と日次データの一覧表を添付）", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 30, politenessScore: 50, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "経営レベルでは個人の日次データは不要。視座が低い。", consequenceVi: "Ở level kinh doanh không cần data cá nhân hàng ngày. Tầm nhìn thấp.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 34, skillGains: { chart: 9, written: 5, meeting: 3 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 10 }, { npcSlug: "yamada_bucho", delta: 8 }] },
    },
    {
      slug: "boss-budget-defense", ja: "【難関】予算削減への防衛交渉", vi: "【Boss】Đàm phán chống cắt ngân sách", order: 4, boss: true,
      briefing: { briefingJa: "経営方針で全部門15%削減要請。チームの成果を守りながら対応します。", briefingVi: "Chính sách cắt giảm 15% toàn bộ phòng ban. Bảo vệ thành quả team.", yourRoleVi: "係長（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_budgetdefense_01", scenarioType: "meeting", titleJa: "予算削減交渉", titleVi: "Đàm phán chống cắt giảm",
        contextSummaryVi: "Tổng giám đốc yêu cầu cắt 15% (= 147 man). Bạn cần thuyết phục giữ CRM tool (30 man) vì nó đang tạo ra 800 man doanh thu.",
        goalJa: "データで投資価値を証明し、代替削減案を提示する。", goalVi: "Chứng minh giá trị đầu tư bằng dữ liệu, đưa phương án cắt thay thế.",
        characters: [{ npcSlug: "ogawa_finance", roleInScene: "budget-controller" }, { npcSlug: "yamada_bucho", roleInScene: "supporter" }],
        payload: { meetingTranscript: [{ speaker: "小川課長", lineJa: "営業部も15%カットです。CRMツールも含めて見直してください。" }] },
        question: { id: "q_budgetdefense_01", skillTag: "chart", difficulty: "hard",
          promptJa: "CRMツール予算を守りながら15%削減要請に応える最も適切な対応は？",
          promptVi: "Bảo vệ ngân sách CRM + đáp ứng yêu cầu cắt 15%, cách nào tốt nhất?",
          options: [
            { optionKey: "A", textJa: "小川課長、ご方針は理解しております。15%（147万円）の削減、対案をご提案させてください。\n\n【守りたい予算】CRMツール30万円\n理由：ROI 26倍（30万投資→800万売上）。カットすると売上減リスク大。\n\n【代替削減案】計150万円削減で15%超を達成\n①出張費20%カット（オンライン化推進）：10万円削減\n②外部セミナー参加を社内研修に代替：8万円削減\n③消耗品・印刷費の見直し：5万円削減\n④新規派遣の開始を1ヶ月後ろ倒し：75万円削減\n⑤残業を月10時間削減（効率化）：52万円削減\n合計：150万円（15.3%削減）\n\nCRMを残したまま目標を超える削減が可能です。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 96, politenessScore: 88, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "方針尊重→守る理由（ROI）→代替案で目標超。経営的センス。", consequenceVi: "Tôn trọng chính sách → Lý do giữ (ROI) → Phương án thay thế vượt mục tiêu. Tư duy kinh doanh.", affectedNpcSlug: "ogawa_finance", errorType: null } },
            { optionKey: "B", textJa: "CRMは絶対に切れません。売上が下がりますよ。他のところで探してください。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "反発するだけで代替案なし。協力姿勢ゼロ。", consequenceVi: "Chỉ phản đối, không phương án thay thế. Không hợp tác.", affectedNpcSlug: "ogawa_finance", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "分かりました。15%カットします。CRM含めて全部一律に減らします。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 45, politenessScore: 60, businessRiskDelta: 15, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "一律カットは戦略性ゼロ。成果を生む投資まで切る愚策。", consequenceVi: "Cắt đều = không chiến lược. Cắt cả đầu tư sinh lợi là sai lầm.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "うちの部門は120%達成してるのに削減は不公平です。未達部門から削るべきです。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "他部門攻撃は組織的に問題。全社方針への反抗。", consequenceVi: "Tấn công phòng khác gây vấn đề tổ chức. Chống lại chính sách chung.", affectedNpcSlug: "ogawa_finance", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 50, skillGains: { chart: 10, meeting: 6, nuance: 5, written: 3 }, npcTrustGains: [{ npcSlug: "ogawa_finance", delta: 12 }, { npcSlug: "yamada_bucho", delta: 12 }], npcReactionMontage: [{ npcSlug: "ogawa_finance", quoteJa: "ROI付きの代替案、説得力がある。CRM継続で了承します。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.budget-reporting: 4 chapters");
  console.log(`✓ R5 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("06-r5")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR5(client);
  await client.end();
}
