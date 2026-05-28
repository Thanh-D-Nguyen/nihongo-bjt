/**
 * Career RPG Production Seed — R6 課長 (Manager)
 * 3 arcs, 12 chapters: Crisis management + Subordinate coaching + Executive reporting
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR6(client) {
  /* ═══ Arc 15: 危機管理対応 ══════════════════════════════════════════════ */
  const arc15Id = await upsertArc(client, {
    slug: "arc.crisis-management", ja: "危機管理対応", vi: "Quản lý khủng hoảng",
    rank: "R6", order: 15,
    story: { synopsisVi: "Ở vị trí 課長, bạn phải xử lý các tình huống khủng hoảng ảnh hưởng toàn bộ phòng ban: rò rỉ thông tin, scandal, khách hàng lớn đe dọa rút.", npcSlugs: ["ito_shachou", "takahashi_clienthq", "nakamura_hr", "yamada_bucho"], artAccent: "#DC2626" },
  });

  await upsertChapters(client, arc15Id, [
    {
      slug: "info-leak-response", ja: "情報漏洩の初動対応", vi: "Xử lý ban đầu khi rò rỉ thông tin", order: 1, boss: false,
      briefing: { briefingJa: "顧客リストが社外に漏洩した可能性。初動対応として何をするか。", briefingVi: "Danh sách khách hàng có thể bị rò rỉ ra ngoài. Bước đầu xử lý.", yourRoleVi: "課長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_leak_01", scenarioType: "deadline", titleJa: "顧客情報漏洩の疑い", titleVi: "Nghi ngờ rò rỉ thông tin khách",
        contextSummaryVi: "Sáng nay, đối thủ cạnh tranh đã liên lạc 5 khách hàng của bạn bằng thông tin nội bộ. Chỉ nhân viên nội bộ mới có. Sếp Ito hỏi hành động.",
        goalJa: "事実確認→影響範囲特定→関係者連絡→再発防止。", goalVi: "Xác nhận sự thật → Xác định phạm vi → Liên lạc các bên → Phòng tái phát.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "escalation" }, { npcSlug: "nakamura_hr", roleInScene: "investigator" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "顧客リストが漏れた可能性があるそうだ。すぐに対応を考えてくれ。" }] },
        question: { id: "q_leak_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "情報漏洩の疑いに対する初動として最も適切なのはどれですか？",
          promptVi: "Bước đầu xử lý nghi ngờ rò rỉ, hành động nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "社長、以下の順で対応します。\n\n【即時（今日中）】\n①事実確認：該当5社に連絡し、どのような情報が使われたか特定\n②影響範囲：漏洩した可能性のあるデータの範囲を絞り込む\n③アクセスログ確認：顧客DBのアクセス履歴を中村（人事）に依頼\n④関係者の行動制限：調査完了まで顧客DB権限を一時凍結\n\n【短期（48時間以内）】\n⑤影響のあった顧客5社に社長名のお詫びレター送付\n⑥社内調査委員会の立ち上げ（人事・法務・営業）\n⑦個人情報保護委員会への報告要否を法務に確認\n\n私が全体統括し、2時間ごとに進捗報告いたします。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 88, businessRiskDelta: -15, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "即時/短期に分けた具体的手順。法的義務も意識。管理職レベル。", consequenceVi: "Chia tức thì/ngắn hạn cụ thể. Ý thức nghĩa vụ pháp lý. Cấp quản lý.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "犯人を見つけてすぐクビにしましょう。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 25, politenessScore: 20, businessRiskDelta: 15, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "証拠なしの懲戒は法的リスク。手順無視。", consequenceVi: "Kỷ luật không bằng chứng = rủi ro pháp lý. Bỏ qua quy trình.", affectedNpcSlug: "nakamura_hr", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "まだ確定ではないので、様子を見ましょう。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 20, politenessScore: 50, businessRiskDelta: 18, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "情報漏洩で「様子見」は最悪。被害が拡大する。", consequenceVi: "Rò rỉ thông tin mà 'chờ xem' là tệ nhất. Thiệt hại sẽ lan.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "全社員にメールして「リストを外部に渡した人は自首してください」と送ります。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "パニックを煽り、証拠隠滅のリスクも。プロの対応でない。", consequenceVi: "Gây hoảng loạn, rủi ro tiêu hủy chứng cứ. Không chuyên nghiệp.", affectedNpcSlug: "nakamura_hr", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { meeting: 8, nuance: 6, written: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }] },
    },
    {
      slug: "client-retention-crisis", ja: "主要顧客離脱の危機", vi: "Khủng hoảng khách hàng lớn rời bỏ", order: 2, boss: false,
      briefing: { briefingJa: "年間売上の30%を占める高橋部長の会社が「取引終了を検討」と通達。緊急対応。", briefingVi: "Công ty của GĐ Takahashi (30% doanh thu năm) thông báo 'đang xem xét chấm dứt giao dịch'.", yourRoleVi: "課長（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_retention_01", scenarioType: "meeting", titleJa: "取引終了回避の緊急会議", titleVi: "Họp khẩn tránh chấm dứt giao dịch",
        contextSummaryVi: "Takahashi nói: 'Chất lượng gần đây kém, giá tăng, đối thủ đang đề xuất tốt hơn. Cho 2 tuần để đưa ra lý do nên tiếp tục.'",
        goalJa: "相手の本音を探り、失うものの大きさを示しつつ、具体的改善案を提示。", goalVi: "Tìm hiểu tâm tư thật, cho thấy thiệt hại nếu rời, đề xuất cải thiện.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "decision-maker" }, { npcSlug: "yamada_bucho", roleInScene: "supporter" }],
        payload: { meetingTranscript: [{ speaker: "高橋部長", lineJa: "正直に言うと、他社からいい提案が来てるんだ。2週間で理由を見せてくれ。" }] },
        question: { id: "q_retention_01", skillTag: "customer", difficulty: "hard",
          promptJa: "取引終了を検討している高橋部長を引き止める最も効果的な対応は？",
          promptVi: "GĐ Takahashi xem xét chấm dứt. Cách giữ chân hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、率直なお話をいただきありがとうございます。2週間のお時間、必ず意味のある提案をお持ちします。\n\nまず確認させてください：\n①品質で具体的にお困りの点は何でしょうか？\n②価格面で、どの水準なら継続をご検討いただけますか？\n③他社さんの提案で特に魅力的な点はどこですか？\n\nこれらを踏まえて、来週木曜までに：\n・品質改善の具体的プラン（データ付き）\n・新価格体系のご提案\n・6年間のパートナーシップで積み上げた相互理解の価値の整理\nをお持ちいたします。\n\n6年間のお付き合いで培った信頼を、この2週間で証明します。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 92, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "感謝→具体的ヒアリング→具体的コミット→関係性の価値。", consequenceVi: "Cảm ơn → Hỏi cụ thể → Cam kết cụ thể → Giá trị mối quan hệ.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "高橋様、うちを切ったら御社も困りますよ。他社は実績がないでしょう。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 40, politenessScore: 15, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "脅し＋傲慢。即座に取引終了されるレベル。", consequenceVi: "Đe dọa + kiêu ngạo. Sẽ bị chấm dứt ngay.", affectedNpcSlug: "takahashi_clienthq", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "分かりました。価格を20%下げます。それでどうでしょうか。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 55, businessRiskDelta: 18, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "品質の問題を値引きで解決しない。ヒアリングもせず即値引き。", consequenceVi: "Giảm giá không giải quyết vấn đề chất lượng. Không hỏi mà đã giảm.", affectedNpcSlug: "yamada_bucho", errorType: "priority_misread" } },
            { optionKey: "D", textJa: "残念ですが、御社の判断を尊重します。今までありがとうございました。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 60, businessRiskDelta: 20, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "30%の売上を戦わずに手放すのは職務怠慢。", consequenceVi: "Buông 30% doanh thu mà không chiến đấu = lơ là nhiệm vụ.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { customer: 9, meeting: 6, nuance: 5 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 12 }, { npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "team-scandal-handling", ja: "部下の不祥事対応", vi: "Xử lý scandal của nhân viên", order: 3, boss: false,
      briefing: { briefingJa: "田中が顧客の接待費を水増し請求していた疑い。管理者として適切に対応します。", briefingVi: "Tanaka bị nghi kê khống chi phí tiếp khách. Quản lý xử lý thích hợp.", yourRoleVi: "課長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_scandal_01", scenarioType: "meeting", titleJa: "田中の経費不正疑惑への対応", titleVi: "Xử lý nghi vấn gian lận kinh phí của Tanaka",
        contextSummaryVi: "Ogawa phát hiện 3 hóa đơn tiếp khách bất thường (tổng 45 man). Tanaka claim là tiếp Sato-san nhưng ngày đó Sato đi công tác.",
        goalJa: "事実に基づき公正に対応し、組織としての信頼を守る。", goalVi: "Xử lý công bằng dựa trên sự thật, bảo vệ uy tín tổ chức.",
        characters: [{ npcSlug: "nakamura_hr", roleInScene: "advisor" }, { npcSlug: "tanaka_senpai", roleInScene: "subject" }],
        payload: { meetingTranscript: [{ speaker: "中村（人事）", lineJa: "経理から報告があり、田中さんの接待費3件に不審な点があります。どう対応しますか？" }] },
        question: { id: "q_scandal_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "部下の不正疑惑に対する管理者として最も適切な対応はどれですか？",
          promptVi: "Với nghi vấn gian lận của nhân viên, quản lý nên xử lý thế nào?",
          options: [
            { optionKey: "A", textJa: "中村さん、ありがとうございます。以下の手順で進めます。\n\n①事実確認（今日中）：\n ・該当3件の領収書原本を確認\n ・佐藤様の出張記録と突合\n ・田中のその日のスケジュール確認\n\n②田中本人への聴取（事実確認後）：\n ・まず弁明の機会を与える（推定無罪の原則）\n ・聴取は人事同席で記録を取る\n ・感情的にならず事実に基づいて質問\n\n③判断：\n ・故意の不正→就業規則に基づく処分＋本人への説明\n ・記載ミス→是正と再発防止（経費精算ルールの再確認）\n\n④調査期間中は田中の経費精算を私の事前承認制に変更\n\nまず事実を集めます。決めつけずに進めましょう。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 88, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "手順明確・公正・推定無罪・記録。管理職としての模範。", consequenceVi: "Quy trình rõ, công bằng, giả định vô tội, lưu hồ sơ. Mẫu mực quản lý.", affectedNpcSlug: "nakamura_hr", errorType: null } },
            { optionKey: "B", textJa: "田中を今すぐ呼んで問い詰めます。証拠は揃ってるんですから。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 45, politenessScore: 30, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "事実確認不十分で問い詰めはパワハラリスク。", consequenceVi: "Chưa xác nhận đủ sự thật mà ép hỏi = rủi ro power harassment.", affectedNpcSlug: "nakamura_hr", errorType: "priority_misread" } },
            { optionKey: "C", textJa: "田中は優秀な営業マンだし、穏便に済ませましょう。本人に注意だけして。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 30, politenessScore: 40, businessRiskDelta: 18, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "不正を見逃すのは管理者の義務違反。組織腐敗の始まり。", consequenceVi: "Bỏ qua gian lận = vi phạm nghĩa vụ quản lý. Khởi đầu suy thoái tổ chức.", affectedNpcSlug: "nakamura_hr", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "これは人事の問題ですので、中村さんに全てお任せします。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "直属上司の責任を放棄。管理者として不適格。", consequenceVi: "Từ bỏ trách nhiệm cấp trên trực tiếp. Không đủ tư cách quản lý.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { nuance: 8, meeting: 6, keigo: 4 }, npcTrustGains: [{ npcSlug: "nakamura_hr", delta: 12 }, { npcSlug: "ito_shachou", delta: 8 }] },
    },
    {
      slug: "boss-company-wide-crisis", ja: "【難関】全社的危機への対応", vi: "【Boss】Xử lý khủng hoảng toàn công ty", order: 4, boss: true,
      briefing: { briefingJa: "主力製品にリコール級の欠陥。社長から「24時間で対応策を出せ」。", briefingVi: "Sản phẩm chính có lỗi cấp recall. CEO yêu cầu '24 giờ đưa ra đối sách'.", yourRoleVi: "課長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_companycrisis_01", scenarioType: "deadline", titleJa: "24時間以内の危機対応", titleVi: "Xử lý khủng hoảng trong 24 giờ",
        contextSummaryVi: "Sản phẩm A (50% doanh thu) phát hiện lỗi an toàn. 10,000 sản phẩm đã bán. Cần: (1) kế hoạch recall, (2) thông báo khách, (3) đối sách truyền thông.",
        goalJa: "安全最優先で、ステークホルダー全てへの対応を24時間で立案。", goalVi: "An toàn ưu tiên, lên kế hoạch đối ứng tất cả stakeholder trong 24h.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "decision-maker" }, { npcSlug: "takahashi_clienthq", roleInScene: "affected" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "安全が最優先だ。24時間で対応策を見せてくれ。費用は問わない。" }] },
        question: { id: "q_companycrisis_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "24時間以内に提出すべき危機対応プランとして最も適切なものは？",
          promptVi: "Kế hoạch xử lý khủng hoảng cần nộp trong 24h, phương án nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "【24時間対応プラン】\n\n【Phase 1: 0-6時間 — 即時停止と事実確認】\n①出荷即時停止（製造ライン停止指示済み）\n②不具合の再現テスト＆影響範囲確定\n③対策本部設置（営業・製造・品質・法務・広報）\n\n【Phase 2: 6-12時間 — ステークホルダー対応】\n④顧客通知文面作成（安全注意喚起＋使用中止推奨）\n⑤主要顧客（高橋部長含む）に直接電話で説明\n⑥消費者庁への報告書準備（法務確認済み）\n\n【Phase 3: 12-18時間 — リコール計画】\n⑦回収ルート設計（全国300拠点の回収ポイント設定）\n⑧代替品or返金の判断基準策定\n⑨コスト試算（回収＋交換＋損害賠償見込み）\n\n【Phase 4: 18-24時間 — 社長承認と公表】\n⑩プレスリリース文面（社長名義）\n⑪社内全体周知（FAQ付き）\n⑫お客様相談窓口の臨時設置\n\n安全最優先。ブランドの長期信頼を守る対応を貫きます。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 90, businessRiskDelta: -18, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "Phase分け＋全ステークホルダー網羅＋法的対応＋ブランド意識。危機管理の教科書。", consequenceVi: "Chia phase + bao phủ tất cả stakeholder + pháp lý + ý thức thương hiệu. Giáo khoa quản lý khủng hoảng.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "まず全品回収して、あとは弁護士に任せましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 50, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "顧客通知・広報・消費者庁対応が抜けている。", consequenceVi: "Thiếu thông báo khách, PR, báo cáo cơ quan bảo vệ người tiêu dùng.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "問題が大きくなる前に、静かに回収しましょう。公表は避けたい。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 35, politenessScore: 40, businessRiskDelta: 25, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "隠蔽は法律違反。発覚すればブランド崩壊。", consequenceVi: "Che giấu là vi phạm pháp luật. Bị phát hiện = sụp đổ thương hiệu.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "24時間は短すぎます。1週間ください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "安全問題に1週間は遅い。消費者に被害が出るリスク。", consequenceVi: "1 tuần cho vấn đề an toàn là quá chậm. Người tiêu dùng có thể bị hại.", affectedNpcSlug: "ito_shachou", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { meeting: 10, nuance: 8, written: 5, customer: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 20 }, { npcSlug: "takahashi_clienthq", delta: 10 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "これだけの危機対応プランを24時間で出してきたか。頼もしい。部長への道が見えてきたぞ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.crisis-management: 4 chapters");

  /* ═══ Arc 16: 部下育成 ═════════════════════════════════════════════════ */
  const arc16Id = await upsertArc(client, {
    slug: "arc.subordinate-coaching", ja: "部下育成", vi: "Đào tạo và phát triển nhân viên",
    rank: "R6", order: 16,
    story: { synopsisVi: "課長 phải phát triển đội ngũ: xây dựng career path, training, ủy quyền, và xử lý nhân viên underperform.", npcSlugs: ["suzuki_kakaricho", "morita_kouhai", "tanaka_senpai", "nakamura_hr"], artAccent: "#7C3AED" },
  });

  await upsertChapters(client, arc16Id, [
    {
      slug: "career-path-design", ja: "部下のキャリアパス設計", vi: "Thiết kế career path cho nhân viên", order: 1, boss: false,
      briefing: { briefingJa: "鈴木係長が「次のステップが見えない」と相談。課長としてキャリアパスを提示します。", briefingVi: "Suzuki-kakaricho hỏi 'không thấy bước tiếp'. Bạn trình bày career path.", yourRoleVi: "課長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_careerpath_01", scenarioType: "meeting", titleJa: "鈴木係長のキャリア面談", titleVi: "Phiên career cho Suzuki",
        contextSummaryVi: "Suzuki 5 năm kinh nghiệm, team lead 2 năm. Muốn biết: thăng tiến hay chuyên gia? Điều kiện thăng 課長 là gì?",
        goalJa: "本人の志向を聞き、具体的なロードマップを提示する。", goalVi: "Nghe nguyện vọng, đưa lộ trình cụ thể.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "coachee" }],
        payload: { meetingTranscript: [{ speaker: "鈴木係長", lineJa: "もう係長2年なんですが、次のステップが見えなくて…課長への道って具体的に何が必要ですか？" }] },
        question: { id: "q_careerpath_01", skillTag: "nuance", difficulty: "standard",
          promptJa: "鈴木係長のキャリア相談への最も適切な対応は？",
          promptVi: "Phản hồi câu hỏi career của Suzuki, cách nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "鈴木さん、率直に話してくれてありがとう。まず聞かせて。管理職コース（課長→部長）とスペシャリストコース、どっちに興味がある？\n\n…管理職か。正直に現状を伝えるね。\n\n【今のレベル：8/10】\n✓ チーム管理 ✓ 顧客対応 ✓ 数値管理\n△ 部門横断プロジェクト経験（これが次のカギ）\n△ 後進育成の実績\n\n【課長への具体的ステップ】\n①来期：部門横断プロジェクト1件のリーダー（私がアサインする）\n②半年後：後輩2名の育成メンター担当\n③1年後：私の業務30%を委譲（課長代理的な動き）\n④評価面談で管理職推薦の条件を満たす\n\n私が推薦書を書ける状態を一緒に作ろう。月1で進捗確認しよう。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 90, businessRiskDelta: -5, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "志向確認→現状フィードバック→具体ステップ→コミットメント。育成の鑑。", consequenceVi: "Xác nhận nguyện vọng → Feedback hiện tại → Bước cụ thể → Cam kết. Mẫu mực đào tạo.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "課長になるには実力があればなれるよ。頑張って。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 15, politenessScore: 40, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体性ゼロ。何を頑張ればいいか不明。", consequenceVi: "Không cụ thể. Không biết cố gắng gì.", affectedNpcSlug: "suzuki_kakaricho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "うーん、正直今の状況だとポストが空かないと難しいかも…", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "やる気を削ぐだけ。管理職の育成責任を果たしていない。", consequenceVi: "Chỉ làm mất động lực. Không hoàn thành trách nhiệm đào tạo.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "まだ早いんじゃない？5年目でしょ。10年くらいでちょうどいいよ。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 25, politenessScore: 25, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "年功序列的発想。能力のある人材を腐らせる。", consequenceVi: "Tư duy thâm niên. Lãng phí nhân tài có năng lực.", affectedNpcSlug: "suzuki_kakaricho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 32, skillGains: { nuance: 7, meeting: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 15 }] },
    },
    {
      slug: "underperformer-management", ja: "パフォーマンス不足者への対応", vi: "Xử lý nhân viên kém hiệu suất", order: 2, boss: false,
      briefing: { briefingJa: "森田の業績が3ヶ月連続で目標の50%以下。改善計画を立てて対話します。", briefingVi: "Morita 3 tháng liên tiếp dưới 50% mục tiêu. Lập kế hoạch cải thiện.", yourRoleVi: "課長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_underperf_01", scenarioType: "meeting", titleJa: "森田へのPIP（業績改善計画）面談", titleVi: "Phiên PIP (kế hoạch cải thiện) với Morita",
        contextSummaryVi: "3 tháng: 45%, 40%, 48%. Lý do: kỹ năng prospecting yếu, ít gọi điện, hay từ chối khách mới. Cần PIP 90 ngày.",
        goalJa: "本人の尊厳を守りつつ、明確な改善目標と支援を示す。", goalVi: "Giữ nhân phẩm, nêu rõ mục tiêu cải thiện và hỗ trợ.",
        characters: [{ npcSlug: "morita_kouhai", roleInScene: "subject" }, { npcSlug: "nakamura_hr", roleInScene: "observer" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "人事の中村も同席。森田と業績改善面談を始める。" }] },
        question: { id: "q_underperf_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "業績不振の森田へのPIP面談で最も適切な進め方はどれですか？",
          promptVi: "Phiên PIP với Morita kém hiệu suất, cách tiến hành đúng nhất?",
          options: [
            { optionKey: "A", textJa: "森田さん、今日は今後のことを一緒に考えたくて時間をもらいました。\n\nまず状況の共有です。直近3ヶ月の達成率が45%、40%、48%となっています。森田さん自身、この数字についてどう感じていますか？\n\n…ありがとう。私も原因を一緒に考えたい。\n\n分析すると、アポイント数が他のメンバーの1/3。ここが一番の改善ポイントだと思っています。\n\n【90日改善計画】として：\n月1：毎日3件のアポ電話（私が横で最初の5日はサポート）\n月2：週1件の新規訪問（田中が同行でフォロー）\n月3：達成率70%以上を目標\n\n週1の進捗面談で必ずフォローします。これは処分ではなく成長のための計画です。一緒にやろう。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 92, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実共有→本人の声→具体的計画→サポート約束→前向き姿勢。", consequenceVi: "Chia sẻ sự thật → Lắng nghe → Kế hoạch cụ thể → Cam kết hỗ trợ → Tích cực.", affectedNpcSlug: "morita_kouhai", errorType: null } },
            { optionKey: "B", textJa: "森田、3ヶ月連続未達だ。次も未達なら異動か退職勧奨になる。分かってるよね。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 15, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "脅迫的。パワハラと受け取られる可能性大。", consequenceVi: "Đe dọa. Có thể bị coi là power harassment.", affectedNpcSlug: "morita_kouhai", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "まあ、環境が悪い時もあるよ。焦らなくていいから。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 15, politenessScore: 65, businessRiskDelta: 10, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "問題を直視していない。改善計画なし。", consequenceVi: "Không đối mặt vấn đề. Không có kế hoạch cải thiện.", affectedNpcSlug: "nakamura_hr", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "人事からPIPの書類をもらったから、ここにサインして。内容は読んでおいて。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 25, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一方的。対話なし。本人の意欲を完全に無視。", consequenceVi: "Một chiều. Không đối thoại. Hoàn toàn bỏ qua ý chí đương sự.", affectedNpcSlug: "morita_kouhai", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 35, skillGains: { nuance: 8, meeting: 5, keigo: 4 }, npcTrustGains: [{ npcSlug: "morita_kouhai", delta: 10 }, { npcSlug: "nakamura_hr", delta: 8 }] },
    },
    {
      slug: "delegation-and-empowerment", ja: "権限委譲と人材育成", vi: "Ủy quyền và phát triển nhân lực", order: 3, boss: false,
      briefing: { briefingJa: "鈴木係長に大型案件を一任。失敗リスクを受け入れつつ成長機会を与えます。", briefingVi: "Giao toàn quyền dự án lớn cho Suzuki. Chấp nhận rủi ro thất bại để tạo cơ hội phát triển.", yourRoleVi: "課長（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_delegate_02", scenarioType: "meeting", titleJa: "鈴木への大型案件委譲", titleVi: "Giao dự án lớn cho Suzuki",
        contextSummaryVi: "Dự án 1000 man cho khách hàng mới. Suzuki đủ năng lực 80%, nhưng chưa từng lead quy mô này. Rủi ro: mất deal 1000 man.",
        goalJa: "任せつつ、セーフティネットを設定する。", goalVi: "Giao quyền nhưng thiết lập lưới an toàn.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "delegate" }],
        payload: { meetingTranscript: [{ speaker: "あなた", lineJa: "鈴木さん、今日は新しいチャレンジの提案がある。" }] },
        question: { id: "q_delegate_02", skillTag: "meeting", difficulty: "standard",
          promptJa: "大型案件を委譲する際の最も適切な伝え方はどれですか？",
          promptVi: "Khi giao dự án lớn, cách truyền đạt nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "鈴木さん、C社の1000万案件、メイン担当をお願いしたい。\n\n率直に言うと、これは鈴木さんにとってストレッチ案件。でも私はできると思っている。理由は：\n①前回の500万案件を単独で成功させたこと\n②顧客折衝のセンスがチーム一番\n③課長への昇格に必要な経験がこれ\n\n【サポート体制】\n・週次で30分の1on1（私）\n・提案書の最終レビューは私が入る\n・商談クリティカルフェーズは同席可能\n・判断に迷ったら即相談OK（24時間以内に返答する）\n\n失敗しても責任は私が取る。思い切ってやってみて。どう？", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 92, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "信頼→根拠→サポート体制→責任は上が取る。理想的な委譲。", consequenceVi: "Tin tưởng → Căn cứ → Hỗ trợ → Trách nhiệm ở trên. Ủy quyền lý tưởng.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "C社の案件やって。大丈夫でしょ。何かあったら言って。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 30, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "サポートなしの丸投げ。失敗確率が上がる。", consequenceVi: "Đẩy hết không hỗ trợ. Tăng xác suất thất bại.", affectedNpcSlug: "suzuki_kakaricho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "C社は大事だから、私がメインで鈴木さんはサブね。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 50, politenessScore: 55, businessRiskDelta: 3, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "成長機会を与えていない。課長自身が手放せていない。", consequenceVi: "Không tạo cơ hội phát triển. Quản lý không buông tay.", affectedNpcSlug: "suzuki_kakaricho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "C社案件任せたいけど、失敗したら鈴木さんの評価に響くよ。覚悟ある？", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 45, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "プレッシャーをかけて委縮させる。育成でなく試練。", consequenceVi: "Gây áp lực khiến co cụm. Đây là thử thách, không phải đào tạo.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 30, skillGains: { meeting: 6, nuance: 6, keigo: 3 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 15 }] },
    },
    {
      slug: "boss-organizational-talent", ja: "【難関】組織の人材戦略", vi: "【Boss】Chiến lược nhân tài tổ chức", order: 4, boss: true,
      briefing: { briefingJa: "社長から「来期の組織体制と人材育成計画を出してくれ」。部門全体の人的資本戦略を立案。", briefingVi: "CEO yêu cầu 'đưa kế hoạch tổ chức và đào tạo kỳ tới'. Lập chiến lược nhân lực toàn phòng.", yourRoleVi: "課長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_talent_01", scenarioType: "report_chart", titleJa: "人材戦略レポートの提出", titleVi: "Nộp báo cáo chiến lược nhân tài",
        contextSummaryVi: "Phòng 8 người. Cần: (1) đánh giá nhân lực hiện tại, (2) gap analysis, (3) kế hoạch tuyển dụng/đào tạo cho growth 30%.",
        goalJa: "現状分析→ギャップ→採用/育成計画を数字で示す。", goalVi: "Phân tích hiện tại → Gap → Kế hoạch tuyển/đào tạo bằng số liệu.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "reader" }, { npcSlug: "nakamura_hr", roleInScene: "collaborator" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "来期30%成長するには、今の人員体制じゃ足りないだろ。計画を出してくれ。" }] },
        question: { id: "q_talent_01", skillTag: "chart", difficulty: "hard",
          promptJa: "30%成長に向けた人材戦略として最も適切なプランはどれですか？",
          promptVi: "Chiến lược nhân tài cho growth 30%, kế hoạch nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "【人材戦略レポート】30%成長に向けた体制設計\n\n■ 現状：8名（課長1/係長2/一般5）→ 売上7,500万\n■ 目標：売上9,750万（+30%）→ 必要戦力：10.5名相当\n\n■ ギャップ分析：\n  ①量的：2.5名分の戦力不足\n  ②質的：デジタル営業スキル/海外対応力が弱い\n\n■ 対策プラン：\n【採用】（+2名）\n  ・中途1名：デジタルマーケ経験者（Q1）\n  ・新卒1名：海外大学卒バイリンガル（Q2）\n  コスト：採用費200万＋年俸1,200万\n\n【育成】（0.5名分の生産性向上）\n  ・鈴木→課長候補研修（外部）30万\n  ・田中→デジタルツール研修（内部）5万\n  ・全員：月1のナレッジシェア会\n  効果：1人当たり生産性6%向上（=0.5名相当）\n\n■ ROI：投資1,435万 → 売上+2,250万 → ROI 1.57倍\n■ リスク：採用遅延時は派遣で暫定対応（月40万）\n\n中村（人事）と連携し、来週中にJD作成に入れます。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 98, politenessScore: 85, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "現状→Gap→量的/質的対策→ROI→リスク対策。経営視点の人材計画。", consequenceVi: "Hiện tại → Gap → Đối sách lượng/chất → ROI → Phòng rủi ro. Kế hoạch nhân sự tầm kinh doanh.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "3人採用すれば30%いけると思います。人事にお願いします。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "分析なし・育成視点なし・コスト意識なし。", consequenceVi: "Không phân tích, không đào tạo, không ý thức chi phí.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "30%は今の8人で残業を増やせばなんとか…", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 25, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "働き方改革に逆行。離職リスク増大。持続不可能。", consequenceVi: "Đi ngược cải cách lao động. Tăng rủi ro nghỉ việc. Không bền vững.", affectedNpcSlug: "nakamura_hr", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "目標30%は高すぎます。20%に修正してもらえませんか。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "分析前に目標を下げようとする姿勢は管理職失格。", consequenceVi: "Chưa phân tích đã muốn hạ mục tiêu = quản lý thiếu năng lực.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 50, skillGains: { chart: 9, meeting: 6, nuance: 5, written: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 18 }, { npcSlug: "nakamura_hr", delta: 12 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "数字で語れる管理職は貴重だ。この計画で進めてくれ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.subordinate-coaching: 4 chapters");

  /* ═══ Arc 17: 経営層への報告 ═══════════════════════════════════════════ */
  const arc17Id = await upsertArc(client, {
    slug: "arc.executive-reporting", ja: "経営層への報告", vi: "Báo cáo lên ban giám đốc",
    rank: "R6", order: 17,
    story: { synopsisVi: "Báo cáo cho C-level: ngôn ngữ khác, format khác, kỳ vọng khác. Học cách communicate với executives.", npcSlugs: ["ito_shachou", "yamada_bucho", "ogawa_finance"], artAccent: "#1E40AF" },
  });

  await upsertChapters(client, arc17Id, [
    {
      slug: "board-meeting-prep", ja: "取締役会資料の作成", vi: "Chuẩn bị tài liệu cho hội đồng quản trị", order: 1, boss: false,
      briefing: { briefingJa: "来週の取締役会で営業部門の報告。社外取締役にも分かりやすい資料を作成。", briefingVi: "Tuần sau báo cáo phòng kinh doanh cho HĐQT. Tài liệu phải dễ hiểu cho cả QT bên ngoài.", yourRoleVi: "課長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_board_01", scenarioType: "report_chart", titleJa: "取締役会向け報告書", titleVi: "Báo cáo cho HĐQT",
        contextSummaryVi: "HĐQT gồm CEO + 3 QT bên ngoài (tài chính, pháp lý, tech). Cần: (1) kết quả, (2) phân tích thị trường, (3) chiến lược, (4) rủi ro. Tối đa 3 trang.",
        goalJa: "経営判断に必要な情報を構造化して提示する。", goalVi: "Cấu trúc thông tin cần thiết cho quyết định kinh doanh.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "presenter" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "取締役会の資料、社外の人にも分かるように作ってくれ。" }] },
        question: { id: "q_board_01", skillTag: "chart", difficulty: "hard",
          promptJa: "取締役会向け報告として最も適切な構成はどれですか？",
          promptVi: "Cấu trúc báo cáo HĐQT nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "【P1: エグゼクティブサマリー】\n売上YoY +18%（業界平均+5%を大幅に上回る）\nKPIトラフィックライト：売上🟢/利益🟡/顧客満足🟢/人材🟡\n\n【P2: 詳細分析】\n市場環境：競合動向・規制変化・技術トレンド\n当社ポジション：シェア推移・差別化ポイント\n重要指標推移（グラフ3つ）\n\n【P3: 戦略と決議事項】\n次期戦略（投資判断を含む決議事項2件）\nリスクマトリクス（影響度×確率）\n必要リソース（予算承認依頼）\n\n【補足】詳細データは別冊Appendix参照\n\n社外取締役向けに：業界用語の注釈付き、比較対象を明示。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 98, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "サマリー→詳細→決議→補足。取締役会の標準構成を理解。", consequenceVi: "Summary → Chi tiết → Quyết nghị → Bổ sung. Hiểu cấu trúc HĐQT tiêu chuẩn.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "日々の営業活動の詳細レポートを20ページ出します。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 25, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "取締役が求めるレベルの情報ではない。戦略的視点不足。", consequenceVi: "Không phải thông tin mà QT cần. Thiếu tầm chiến lược.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "「順調です」のスライド1枚でOKです。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 10, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "取締役会を舐めている。ガバナンスへの意識ゼロ。", consequenceVi: "Coi thường HĐQT. Ý thức governance bằng 0.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "前回と同じテンプレートで数字だけ更新します。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 40, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "状況が変わっているのにテンプレ更新だけでは不十分。", consequenceVi: "Tình hình thay đổi mà chỉ cập nhật template thì không đủ.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 35, skillGains: { chart: 9, written: 6, meeting: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 12 }] },
    },
    {
      slug: "executive-bad-news", ja: "経営陣への悪い報告", vi: "Báo cáo tin xấu cho lãnh đạo", order: 2, boss: false,
      briefing: { briefingJa: "四半期目標を確実に外す見込み。早めに伊藤社長に報告し、対策を相談します。", briefingVi: "Chắc chắn không đạt mục tiêu quý. Báo sớm cho CEO Ito, xin ý kiến đối sách.", yourRoleVi: "課長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_badnews_01", scenarioType: "meeting", titleJa: "社長への業績未達報告", titleVi: "Báo cáo không đạt mục tiêu cho CEO",
        contextSummaryVi: "Còn 1 tháng, chỉ đạt 60%. Dự kiến cuối quý: 75%. Cần báo ngay, không đợi hết quý.",
        goalJa: "早期に悪い情報を共有し、対策を示し、信頼を維持する。", goalVi: "Chia sẻ tin xấu sớm, đưa đối sách, giữ niềm tin.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "recipient" }],
        payload: { meetingTranscript: [{ speaker: "あなた", lineJa: "社長、お時間いただきたい件があります。業績について早めにご報告です。" }] },
        question: { id: "q_badnews_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "社長への業績未達の報告として最も適切な伝え方はどれですか？",
          promptVi: "Cách báo cáo không đạt mục tiêu cho CEO phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "社長、Q3の見通しについて率直にご報告します。\n\n【現状】達成率60%（残1ヶ月）→着地予想75%（目標未達確定）\n\n【要因】\n①市場：主要顧客2社が投資凍結（業界全体で-8%）\n②内部：新人2名の立ち上がりが想定より2ヶ月遅延\n③機会損失：大型案件1件の決裁が来期にズレ\n\n【残1ヶ月のリカバリー策】\n①既存顧客15社に追加提案（+500万見込み）\n②パイプラインの前倒し3件（+300万見込み）\n→最善で80%まで回復可能\n\n【来期に向けた構造改善】\n①新人育成プログラムの前倒し\n②リスク分散（特定顧客依存度の低減）\n\n早めにお伝えしたかったのは、対策の時間を確保するためです。ご指示があればお願いします。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実→要因→リカバリー→構造改善→報告の意図。信頼される。", consequenceVi: "Sự thật → Nguyên nhân → Phục hồi → Cải thiện cấu trúc → Lý do báo sớm. Đáng tin.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "社長、今期は75%で着地しそうです。来期で挽回します。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "分析なし・リカバリー策なし。「来期で」は無計画。", consequenceVi: "Không phân tích, không phục hồi. 'Quý sau' = vô kế hoạch.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "（期末まで報告せず、最後に「外部環境が厳しかった」と説明する）", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 20, politenessScore: 30, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "悪い報告を隠す管理職は即座に信頼を失う。", consequenceVi: "Quản lý che giấu tin xấu sẽ mất uy tín ngay lập tức.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "申し訳ありません。私の力不足です。進退伺いをお出しすべきでしょうか。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 60, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "対策ではなく責任逃避。社長が欲しいのは解決策。", consequenceVi: "Không phải đối sách mà là trốn trách nhiệm. CEO cần giải pháp.", affectedNpcSlug: "ito_shachou", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 35, skillGains: { meeting: 8, chart: 5, nuance: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }] },
    },
    {
      slug: "strategic-proposal", ja: "経営戦略の提言", vi: "Đề xuất chiến lược kinh doanh", order: 3, boss: false,
      briefing: { briefingJa: "社長に新規事業の提案。データに基づいた説得力ある戦略提言を行います。", briefingVi: "Đề xuất mảng kinh doanh mới cho CEO. Thuyết phục bằng dữ liệu.", yourRoleVi: "課長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_strategy_01", scenarioType: "meeting", titleJa: "新規事業提案プレゼン", titleVi: "Thuyết trình đề xuất kinh doanh mới",
        contextSummaryVi: "Đề xuất: mở rộng sang thị trường Đông Nam Á (bắt đầu từ Việt Nam). Dữ liệu thị trường + partner sẵn (Kim-partner).",
        goalJa: "リスクとリターンを明確にし、経営判断を仰ぐ。", goalVi: "Nêu rõ rủi ro và lợi nhuận, xin quyết định từ lãnh đạo.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "decision-maker" }, { npcSlug: "kim_partner", roleInScene: "partner" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "東南アジア進出の件、プレゼンを聞かせてくれ。" }] },
        question: { id: "q_strategy_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "新規事業として東南アジア進出を提案する際、最も説得力のあるプレゼンは？",
          promptVi: "Khi đề xuất mở rộng Đông Nam Á, thuyết trình nào thuyết phục nhất?",
          options: [
            { optionKey: "A", textJa: "社長、東南アジア・ベトナム市場への進出をご提案します。\n\n【Why Now?】\n①市場規模：ベトナム製造業の日系取引額 年間2.3兆円（YoY+12%）\n②競合：日系サプライヤーで当社製品カテゴリは進出3社のみ\n③パートナー：金氏の現地ネットワーク活用可能（初期コスト大幅削減）\n\n【計画】\nPhase1（6ヶ月）：金氏経由で現地3社にテスト販売。投資500万\nPhase2（6-12ヶ月）：反応次第で現地法人設立検討\n撤退基準：Phase1で受注ゼロなら中止\n\n【期待リターン】\n成功シナリオ：3年後年間売上1億円（現在の国内売上+13%に相当）\nBEP：18ヶ月\n\n【リスクと対策】\n①為替リスク→円建て契約を基本\n②品質管理→初期は国内生産・直送\n③法規制→現地法律事務所と契約済み\n\nまずPhase1の500万のご承認をいただけますか。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "Why Now→計画→リターン→リスク→撤退基準→小さく始める。経営者が判断しやすい。", consequenceVi: "Why Now → Kế hoạch → Return → Risk → Exit criteria → Bắt đầu nhỏ. Lãnh đạo dễ quyết.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "東南アジアは将来性があると思うので進出しましょう！", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 15, politenessScore: 40, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "データなし・計画なし・リスク分析なし。思いつきレベル。", consequenceVi: "Không data, không kế hoạch, không phân tích rủi ro. Ý tưởng thoáng qua.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "他社がやっているので、うちもやらないと遅れます。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "「他社がやっている」は戦略的根拠にならない。", consequenceVi: "'Người khác làm rồi' không phải căn cứ chiến lược.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "5億投資して、いきなり現地法人を作りましょう。大きく出ないと勝てません。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 35, businessRiskDelta: 20, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "リスク過大。段階的アプローチなし。経営判断として危険。", consequenceVi: "Rủi ro quá lớn. Không tiếp cận từng bước. Nguy hiểm về kinh doanh.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { meeting: 8, chart: 7, customer: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }, { npcSlug: "kim_partner", delta: 10 }] },
    },
    {
      slug: "boss-ceo-1on1", ja: "【難関】社長との1on1", vi: "【Boss】1-on-1 với CEO", order: 4, boss: true,
      briefing: { briefingJa: "伊藤社長から「ランチしながら話そう」。非公式だが、あなたの将来と会社の方向性を語る重要な場。", briefingVi: "CEO Ito mời 'ăn trưa nói chuyện'. Không chính thức nhưng rất quan trọng — tương lai bạn và hướng đi công ty.", yourRoleVi: "課長（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_ceo1on1_01", scenarioType: "meeting", titleJa: "社長ランチ1on1", titleVi: "Lunch 1-on-1 với CEO",
        contextSummaryVi: "CEO hỏi: 'Nếu anh là tôi, anh sẽ thay đổi gì ở công ty này?' — câu hỏi test tầm nhìn và bản lĩnh.",
        goalJa: "率直かつ建設的に、経営レベルの視座で答える。", goalVi: "Trả lời thẳng thắn, xây dựng, ở tầm kinh doanh.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "questioner" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "もし君が社長なら、この会社の何を変える？遠慮なく言ってくれ。" }] },
        question: { id: "q_ceo1on1_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "社長の「何を変える？」という質問に対する最も適切な回答は？",
          promptVi: "CEO hỏi 'sẽ thay đổi gì?'. Trả lời đúng nhất?",
          options: [
            { optionKey: "A", textJa: "社長、率直にお答えします。3つ変えたいことがあります。\n\n①意思決定スピード：現状、稟議に平均12日。競合は3日。デジタル稟議＋権限委譲レベルの見直しで半分にできます。\n\n②若手の抜擢：能力のある人間が年功で待たされている。成果ベースの昇進基準を作れば、鈴木のような人材が3年は早く活躍できます。\n\n③海外比率：現在5%→3年で20%にすべき。国内市場は頭打ち。先ほどの東南アジア案はその第一歩です。\n\nこれらは批判ではなく、この会社をもっと強くするための提言です。私にできることがあれば何でもやります。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 95, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "具体的3点→データ→実行可能→忠誠心。経営者の右腕の素質。", consequenceVi: "3 điểm cụ thể → Data → Khả thi → Trung thành. Tố chất cánh tay phải CEO.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "今のままで十分素晴らしいと思います。社長のリーダーシップのおかげです。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 10, politenessScore: 70, businessRiskDelta: 5, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "お世辞は求められていない。思考力がないと見なされる。", consequenceVi: "Không hỏi nịnh. Sẽ bị đánh giá thiếu tư duy.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "給料を上げてほしいです。あと、残業を減らしたい。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 25, businessRiskDelta: 8, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "個人的要望。経営の質問に個人利益で答えるのは視座が低い。", consequenceVi: "Yêu cầu cá nhân. Trả lời câu hỏi kinh doanh bằng lợi ích riêng = tầm thấp.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "正直、上の人たちが変わらないと何も変わりません。現場は頑張ってるんですが…", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "社長本人を前に「上が悪い」は自殺行為。建設的でもない。", consequenceVi: "Nói 'trên sai' trước mặt CEO = tự hủy. Không mang tính xây dựng.", affectedNpcSlug: "ito_shachou", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { nuance: 10, meeting: 8, chart: 5, keigo: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 20 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "その視座、部長候補として正式に検討する。これからの会社を一緒に作ろう。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.executive-reporting: 4 chapters");
  console.log(`✓ R6 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("07-r6")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR6(client);
  await client.end();
}
