/**
 * Career RPG Production Seed — R4 主任 (Specialist)
 * 3 arcs, 12 chapters: Complaint handling + Negotiation + Team coordination
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR4(client) {
  /* ═══ Arc 9: クレーム対応 ══════════════════════════════════════════════ */
  const arc9Id = await upsertArc(client, {
    slug: "arc.complaint-handling", ja: "クレーム対応", vi: "Xử lý khiếu nại khách hàng",
    rank: "R4", order: 9,
    story: { synopsisVi: "Xử lý khiếu nại trực tiếp: lắng nghe, xác nhận sự thật, xin lỗi đúng mực, đề xuất giải pháp, leo thang khi cần.", npcSlugs: ["takahashi_clienthq", "yamada_bucho", "sato_kokyaku"], artAccent: "#9F1239" },
  });

  await upsertChapters(client, arc9Id, [
    {
      slug: "complaint-receipt", ja: "クレーム受付と初期ヒアリング", vi: "Tiếp nhận khiếu nại và lắng nghe ban đầu", order: 1, boss: false,
      briefing: { briefingJa: "高橋部長から直接クレーム。製品不良が取引先の生産ラインを止めた。冷静に事実確認します。", briefingVi: "GĐ Takahashi khiếu nại trực tiếp. Sản phẩm lỗi đã dừng dây chuyền khách. Bình tĩnh xác nhận sự thật.", yourRoleVi: "主任（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_complaint_01", scenarioType: "complaint", titleJa: "高橋部長からのクレーム対応", titleVi: "Ứng phó khiếu nại từ GĐ Takahashi",
        contextSummaryVi: "Lô hàng 500 sản phẩm giao tuần trước có 25 sản phẩm lỗi (5%). Dây chuyền khách bị dừng 2 giờ. Thiệt hại ước tính 200 man.",
        goalJa: "感情を受け止め、事実を正確に把握する。", goalVi: "Tiếp nhận cảm xúc, xác nhận sự thật chính xác.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "complainant" }],
        payload: { meetingTranscript: [{ speaker: "高橋部長", lineJa: "おたくの製品のせいでうちの生産ラインが2時間止まったんだ！どうしてくれるんだ！" }] },
        question: { id: "q_complaint_01", skillTag: "customer", difficulty: "standard",
          promptJa: "激怒している高橋部長への最初の対応として最も適切なのは？",
          promptVi: "Đối mặt GĐ Takahashi đang giận dữ, phản ứng đầu tiên nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、大変申し訳ございません。御社の生産ラインが停止し、多大なご迷惑をおかけしたこと、深くお詫び申し上げます。\nまず状況を正確に把握させていただきたいのですが、不良品の具体的な症状と、発見されたタイミングをお教えいただけますでしょうか。必ず原因究明し、本日中に報告書をお送りいたします。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 90, politenessScore: 95, businessRiskDelta: -8, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "共感→謝罪→事実確認→約束。完璧な初動。", consequenceVi: "Đồng cảm → Xin lỗi → Xác nhận sự thật → Cam kết. Bước đầu hoàn hảo.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "5%ですか…弊社の許容範囲は3%なので確かに問題ですね。調べてみます。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 30, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "謝罪なし。冷静すぎて相手の怒りを無視。", consequenceVi: "Không xin lỗi. Quá lạnh lùng, phớt lờ cảm xúc đối phương.", affectedNpcSlug: "takahashi_clienthq", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "申し訳ございません！すぐに全品交換します！損害も全額弁償します！", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 70, businessRiskDelta: 18, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "事実確認前に全額弁償の約束は危険。権限も確認していない。", consequenceVi: "Hứa bồi thường toàn bộ trước khi xác nhận sự thật là nguy hiểm. Chưa xác nhận quyền hạn.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "お気持ちは分かりますが、まず契約書の品質保証条項を確認させてください。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 55, politenessScore: 20, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "怒っている相手に契約書を持ち出すのは火に油。", consequenceVi: "Đưa hợp đồng ra khi đối phương đang giận = đổ dầu vào lửa.", affectedNpcSlug: "takahashi_clienthq", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 28, skillGains: { customer: 7, keigo: 5, nuance: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 8 }] },
    },
    {
      slug: "root-cause-report", ja: "原因分析と報告書", vi: "Phân tích nguyên nhân và báo cáo", order: 2, boss: false,
      briefing: { briefingJa: "不良品の原因が判明。検品工程の人的ミス。報告書を作成し高橋部長に提出します。", briefingVi: "Đã xác định nguyên nhân: lỗi con người trong khâu kiểm tra. Viết báo cáo gửi GĐ Takahashi.", yourRoleVi: "主任（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_rootcause_01", scenarioType: "email", titleJa: "クレーム報告書のメール送付", titleVi: "Email gửi báo cáo khiếu nại",
        contextSummaryVi: "Nguyên nhân: nhân viên kiểm tra mới, chưa được đào tạo đủ trên lô hàng lớn. Đối sách: double-check + training lại.",
        goalJa: "事実・原因・対策を論理的にまとめ、再発防止の誠意を示す。", goalVi: "Trình bày sự thật, nguyên nhân, đối sách logic. Thể hiện thành ý phòng tái phát.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "cc" }],
        payload: { emailThread: [{ from: "あなた", to: "高橋 部長", subjectJa: "【ご報告】製品不良の原因と対策について", bodyJa: "（選ぶ）", timestamp: "2026-06-01T17:00:00Z" }] },
        question: { id: "q_rootcause_01", skillTag: "written", difficulty: "hard",
          promptJa: "クレーム報告書メールとして最も適切なものはどれですか？",
          promptVi: "Email báo cáo khiếu nại nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様\n\n先日は弊社製品の不良により多大なるご迷惑をおかけし、改めてお詫び申し上げます。\n原因調査の結果をご報告いたします。\n\n■ 事実経過：\n  5/28納品ロット500個中25個（5%）に寸法誤差\n  →貴社ラインで5/29 10:00-12:00停止\n\n■ 原因：\n  検品工程の人員配置ミス（経験3ヶ月未満の社員単独配置）\n  大ロット時のダブルチェック体制が未整備\n\n■ 再発防止策：\n  ①即日対応：不良品全数交換完了（本日発送済み）\n  ②短期（1週間）：大ロット出荷時のダブルチェック義務化\n  ③中期（1ヶ月）：検品員の再教育プログラム実施\n  ④長期：品質管理体制の定期監査導入\n\n■ 今後の報告：\n  2週間後に改善状況の中間報告を差し上げます。\n\nご質問等ございましたら、いつでもご連絡ください。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 98, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "謝罪→事実→原因→即時/短期/中期/長期対策→フォロー約束。教科書的。", consequenceVi: "Xin lỗi → Sự thật → Nguyên nhân → Đối sách tức thì/ngắn/trung/dài hạn → Cam kết follow-up. Giáo khoa.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "高橋様\n不良品の件、調べました。検品ミスでした。今後気をつけます。交換品送ります。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 35, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体性ゼロ。「気をつけます」は対策ではない。", consequenceVi: "Không cụ thể. 'Sẽ cẩn thận' không phải đối sách.", affectedNpcSlug: "takahashi_clienthq", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "高橋様\n原因は新入社員のミスです。厳重注意し、今後は経験者のみ配置します。ご容赦ください。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 45, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "個人のせいにしている。組織的対策が見えない。", consequenceVi: "Đổ lỗi cá nhân. Không thấy đối sách tổ chức.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "高橋様\n原因報告書を添付しました。ご確認ください。\nよろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 35, politenessScore: 60, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "メール本文に要点なし。添付だけでは不親切。", consequenceVi: "Nội dung email trống. Chỉ đính kèm thì thiếu chu đáo.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 30, skillGains: { written: 7, customer: 5, chart: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 12 }, { npcSlug: "yamada_bucho", delta: 8 }] },
    },
    {
      slug: "escalation-decision", ja: "エスカレーション判断", vi: "Quyết định leo thang (escalation)", order: 3, boss: false,
      briefing: { briefingJa: "高橋部長が損害賠償を要求。自分の権限を超える。山田部長にエスカレーションします。", briefingVi: "Takahashi yêu cầu bồi thường thiệt hại. Vượt quyền hạn bạn. Cần leo thang cho sếp Yamada.", yourRoleVi: "主任（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_escalate_01", scenarioType: "meeting", titleJa: "山田部長へのエスカレーション報告", titleVi: "Báo cáo leo thang cho sếp Yamada",
        contextSummaryVi: "Takahashi yêu cầu bồi thường 200万円. Bạn chỉ có quyền quyết định đến 50万円. Cần brief sếp rõ ràng để sếp quyết định.",
        goalJa: "必要情報を整理し、上司の迅速な判断を助ける。", goalVi: "Sắp xếp thông tin, giúp sếp quyết nhanh.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "decision-maker" }],
        payload: { meetingTranscript: [{ speaker: "あなた", lineJa: "（山田部長のデスクへ急ぐ）" }] },
        question: { id: "q_escalate_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "山田部長にエスカレーションする際、最も適切な報告の仕方はどれですか？",
          promptVi: "Khi leo thang cho sếp Yamada, cách báo cáo nào tốt nhất?",
          options: [
            { optionKey: "A", textJa: "部長、緊急でご判断いただきたい件があります。\n\n【状況】高橋部長より製品不良の損害賠償200万円を要求されています。\n【経緯】不良率5%→ライン2時間停止→生産損失\n【当方の対応】原因報告＋全品交換は完了済み。相手は金銭補償を求めています。\n【私の権限】50万円まで。200万円は部長決裁が必要です。\n【私の意見】全額は過大。実損100万円＋今後の値引き5%の複合案が妥当かと。\n\nご判断をお願いいたします。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "状況/経緯/権限/意見を全て示し、判断しやすい。", consequenceVi: "Tình hình/kinh quá/quyền hạn/ý kiến — đều trình bày, dễ quyết định.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "部長、高橋さんが怒ってます。200万払えって言ってます。どうしましょう。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "背景情報と自分の分析がない。丸投げ。", consequenceVi: "Thiếu bối cảnh và phân tích. Đẩy hết cho sếp.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "（自分で200万円の支払いを約束し、後から部長に報告する）", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 40, politenessScore: 30, businessRiskDelta: 20, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "権限逸脱。コンプライアンス違反の可能性。", consequenceVi: "Vượt quyền. Có thể vi phạm quy định.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "部長、200万の件ですが、法務部に確認してから対応でいいですか？", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 50, politenessScore: 60, businessRiskDelta: 6, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "法務確認は良いが、まず上司に全体像を報告すべき。", consequenceVi: "Hỏi pháp vụ tốt, nhưng trước hết cần báo toàn cảnh cho sếp.", affectedNpcSlug: "yamada_bucho", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 26, skillGains: { meeting: 6, nuance: 5, customer: 4 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "boss-trust-recovery", ja: "【難関】信頼回復の交渉", vi: "【Boss】Đàm phán khôi phục niềm tin", order: 4, boss: true,
      briefing: { briefingJa: "クレーム処理後、高橋部長との関係修復会議。今後の取引継続をかけた重要場面。", briefingVi: "Sau xử lý khiếu nại, họp khôi phục quan hệ với GĐ Takahashi. Quyết định tiếp tục hợp tác.", yourRoleVi: "主任（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_recovery_01", scenarioType: "meeting", titleJa: "高橋部長との関係修復ミーティング", titleVi: "Họp khôi phục quan hệ với GĐ Takahashi",
        contextSummaryVi: "2 tuần sau khiếu nại. Đã thực hiện cải thiện: tỷ lệ lỗi giảm từ 5% xuống 0.02%. Cần thuyết phục Takahashi tiếp tục hợp tác.",
        goalJa: "データに基づく改善実績を示し、継続取引の信頼を勝ち取る。", goalVi: "Trình bày cải thiện bằng dữ liệu, giành lại niềm tin tiếp tục giao dịch.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "decision-maker" }, { npcSlug: "yamada_bucho", roleInScene: "supporter" }],
        payload: { meetingTranscript: [{ speaker: "高橋部長", lineJa: "で、具体的に何が変わったのか、データで見せてくれ。" }] },
        question: { id: "q_recovery_01", skillTag: "customer", difficulty: "hard",
          promptJa: "高橋部長に改善実績を報告し信頼回復を図る、最も効果的なプレゼンは？",
          promptVi: "Báo cáo cải thiện cho GĐ Takahashi, cách thuyết trình hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、改めましてこの度は大変ご迷惑をおかけいたしました。\n\nこの2週間で実施した改善と結果をご報告させていただきます。\n\n①検品体制：ダブルチェック導入 → 不良率5.0%→0.02%（250分の1）\n②人員配置：品質管理専任者を新設\n③設備投資：自動検査機を発注（来月稼働開始）\n\n今後のご提案として：\n・四半期ごとの品質報告会の実施\n・初回ロットの無償サンプル事前提供\n・専用品質ホットラインの開設\n\nデータでお示しした通り、確実に改善しております。\n引き続きお取引いただける機会を頂戴できますと幸いです。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 94, businessRiskDelta: -15, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "データ→対策→提案の流れ。説得力十分。", consequenceVi: "Dữ liệu → Đối sách → Đề xuất. Thuyết phục.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "本当にすみませんでした。二度とこのようなことがないよう全力で取り組みます。お取引を続けていただけませんか。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 70, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "感情に訴えるだけ。データも具体策もなし。", consequenceVi: "Chỉ kêu gọi cảm xúc. Không dữ liệu, không đối sách.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "弊社としては価格を10%引き下げる用意があります。品質の件はお許しいただけますか。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 50, politenessScore: 60, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "品質問題を値引きで解決しようとする。本末転倒。", consequenceVi: "Dùng giảm giá giải quyết vấn đề chất lượng. Sai bản chất.", affectedNpcSlug: "takahashi_clienthq", errorType: "priority_misread" } },
            { optionKey: "D", textJa: "今回の件は品質管理部門の問題です。該当部門には厳しく指導しました。今後は問題ないかと存じます。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 45, politenessScore: 50, businessRiskDelta: 14, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "他部門のせいにしている。組織の責任感が見えない。", consequenceVi: "Đổ lỗi bộ phận khác. Thiếu trách nhiệm tổ chức.", affectedNpcSlug: "takahashi_clienthq", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 45, skillGains: { customer: 10, meeting: 7, chart: 5, nuance: 5 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 18 }, { npcSlug: "yamada_bucho", delta: 15 }], npcReactionMontage: [{ npcSlug: "takahashi_clienthq", quoteJa: "具体的なデータ、説得力がある。検討させていただく。", sentiment: "positive" }, { npcSlug: "yamada_bucho", quoteJa: "よくやった。高橋さんの表情も和らいでいたな。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.complaint-handling: 4 chapters");

  /* ═══ Arc 10: 価格交渉 基礎 ════════════════════════════════════════════ */
  const arc10Id = await upsertArc(client, {
    slug: "arc.negotiation-basics", ja: "価格交渉 基礎", vi: "Đàm phán giá cơ bản",
    rank: "R4", order: 10,
    story: { synopsisVi: "Đàm phán giá với khách hàng: hiểu lợi ích đôi bên, tìm win-win, biết khi nào nhượng bộ và khi nào giữ vững.", npcSlugs: ["sato_kokyaku", "yamada_bucho", "suzuki_kakaricho"], artAccent: "#B45309" },
  });

  await upsertChapters(client, arc10Id, [
    {
      slug: "discount-request", ja: "値引き依頼への対応", vi: "Ứng phó yêu cầu giảm giá", order: 1, boss: false,
      briefing: { briefingJa: "佐藤様から「来年度の契約を考えたいので、15%値引きしてほしい」と言われました。", briefingVi: "Sato-san nói: 'Muốn ký hợp đồng năm tới, xin giảm 15%'. Bạn cần ứng phó.", yourRoleVi: "主任（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_discount_01", scenarioType: "meeting", titleJa: "佐藤様の値引き要求への回答", titleVi: "Trả lời yêu cầu giảm giá của Sato-san",
        contextSummaryVi: "Sato-san muốn giảm 15%. Lợi nhuận biên hiện tại 20%. Giảm 15% = lỗ. Cần tìm phương án win-win.",
        goalJa: "相手の要求を尊重しつつ、自社の利益を守るカウンター提案。", goalVi: "Tôn trọng yêu cầu đối phương, bảo vệ lợi nhuận, đề xuất counter.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "negotiator" }],
        payload: { meetingTranscript: [{ speaker: "佐藤様", lineJa: "来年度の年間契約を前提に、15%のお値引きは可能でしょうか？" }] },
        question: { id: "q_discount_01", skillTag: "customer", difficulty: "standard",
          promptJa: "15%値引き要求に対して、最も適切な回答はどれですか？",
          promptVi: "Đối với yêu cầu giảm 15%, câu trả lời nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様、年間契約をご検討いただきありがとうございます。15%は正直なところ厳しい水準ですが、長期的なパートナーシップとして、いくつかご提案させてください。\n\n①年間数量2000個以上の場合：8%割引＋送料無料\n②年間数量3000個以上の場合：10%割引＋優先納品\n③四半期一括前払いの場合：さらに2%追加割引\n\n御社のご予算感に合わせて調整可能ですので、ご希望をお聞かせいただけますか。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 92, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "条件付き段階的提案。Win-winを目指す姿勢。", consequenceVi: "Đề xuất có điều kiện theo bậc. Hướng tới win-win.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "15%ですか…ちょっと厳しいですが、上に相談してみます。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 35, politenessScore: 60, businessRiskDelta: 8, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "主体性なし。自分の判断で提案すべきレベル。", consequenceVi: "Thiếu chủ động. Ở level chuyên viên cần tự đề xuất.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "15%は無理です。5%が限界です。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 50, politenessScore: 30, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "交渉の余地を示さず、関係悪化リスク。", consequenceVi: "Không cho thấy dư địa đàm phán, rủi ro phá hỏng quan hệ.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "はい、15%で承知しました。年間契約でしたら問題ございません。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 60, politenessScore: 75, businessRiskDelta: 18, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "利益率を考慮せず安易に承諾。経営判断として失格。", consequenceVi: "Chấp nhận dễ dàng không xét lợi nhuận. Quyết định kinh doanh sai.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 28, skillGains: { customer: 7, nuance: 5, meeting: 4 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 10 }] },
    },
    {
      slug: "counter-proposal", ja: "カウンター提案の作成", vi: "Soạn counter-proposal", order: 2, boss: false,
      briefing: { briefingJa: "佐藤様が条件①に興味あり。正式な提案書メールを作成します。", briefingVi: "Sato-san quan tâm phương án ①. Viết email đề xuất chính thức.", yourRoleVi: "主任（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_counter_01", scenarioType: "email", titleJa: "正式カウンター提案メール", titleVi: "Email counter-proposal chính thức",
        contextSummaryVi: "Sato-san muốn 2500 sản phẩm/năm, hỏi chi tiết phương án 8% + free shipping. Cần email chuyên nghiệp.",
        goalJa: "具体的な条件を明示し、合意に向けた次のステップを示す。", goalVi: "Nêu rõ điều kiện, chỉ ra bước tiếp theo hướng tới ký kết.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "【ご提案】年間契約条件のご案内", bodyJa: "（選ぶ）", timestamp: "2026-06-05T10:00:00Z" }] },
        question: { id: "q_counter_01", skillTag: "written", difficulty: "standard",
          promptJa: "正式なカウンター提案メールとして最も適切なものは？",
          promptVi: "Email counter-proposal chính thức nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様\n\nいつもお世話になっております。\n先日ご相談いただきました年間契約の件、下記条件にてご提案申し上げます。\n\n■ 年間契約条件（案）\n  対象：製品A\n  数量：2,500個/年（四半期625個×4回納品）\n  割引：定価より8%引き\n  送料：全回無料\n  支払条件：月末締め翌月末払い\n  有効期間：2026年7月〜2027年6月（1年間）\n\n■ 双方のメリット\n  御社：安定供給＋コスト削減（年間約160万円の節約）\n  弊社：計画生産による品質安定化\n\n■ 次のステップ\n  ご了解いただけましたら、正式契約書を来週中にお送りします。\n  条件面で調整事項がございましたら、お気軽にご相談ください。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "条件明確＋メリット提示＋次ステップ。プロ。", consequenceVi: "Điều kiện rõ + Lợi ích cho cả hai + Bước tiếp. Chuyên nghiệp.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n8%割引で送料無料です。ご検討ください。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "正式提案として情報不足。数量・期間・支払い条件なし。", consequenceVi: "Thiếu thông tin cho đề xuất chính thức. Không có số lượng, kỳ hạn.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "佐藤様\n添付の提案書をご確認ください。何卒よろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 35, politenessScore: 65, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "メール本文に要点なし。忙しい相手は添付を開かないかも。", consequenceVi: "Body trống. Người bận có thể không mở đính kèm.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "佐藤様\n年間契約、8%引きOKです！いつから始めますか？早い方がいいですよ！", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "押し売り感。ビジネス文書として不適切。", consequenceVi: "Gây cảm giác ép. Không phù hợp văn bản kinh doanh.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 26, skillGains: { written: 6, customer: 5, chart: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 10 }] },
    },
    {
      slug: "negotiation-deadlock", ja: "交渉の行き詰まり打開", vi: "Phá vỡ bế tắc đàm phán", order: 3, boss: false,
      briefing: { briefingJa: "佐藤様が「10%以下は社内稟議が通らない」と主張。妥協点を探ります。", briefingVi: "Sato-san nói: 'Dưới 10% thì không qua được phê duyệt nội bộ'. Tìm điểm thỏa hiệp.", yourRoleVi: "主任（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_deadlock_01", scenarioType: "meeting", titleJa: "交渉の妥協点を探る", titleVi: "Tìm điểm thỏa hiệp trong đàm phán",
        contextSummaryVi: "Bạn: tối đa 8%. Sato: tối thiểu 10%. Gap 2%. Cần creative solution.", goalJa: "金銭以外の価値で差額を埋める創造的提案。", goalVi: "Dùng giá trị phi tiền tệ để lấp khoảng cách.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "negotiator" }],
        payload: { meetingTranscript: [{ speaker: "佐藤様", lineJa: "10%は譲れないんです。うちの購買部門のルールで、それ以下だと稟議が通らない。" }] },
        question: { id: "q_deadlock_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "「10%以下は無理」と言う佐藤様に対して、最も効果的な打開策は？",
          promptVi: "Sato-san nói 'dưới 10% không được'. Cách phá vỡ bế tắc hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様のお立場、よく理解いたしました。稟議が通る形を一緒に考えさせてください。\n\nたとえば、製品本体は8%割引のまま、下記をパッケージに含めることで実質10%相当の経費削減になります：\n①技術サポート年2回無料（通常1回15万円）\n②急ぎ案件の特急料金免除（通常5%割増）\n③四半期レビュー会議の実施（品質コスト削減効果）\n\n稟議書に「総合コスト削減効果10%以上」と記載いただける形かと存じます。いかがでしょうか。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 92, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "相手の制約を理解し、別の切り口で解決。クリエイティブ。", consequenceVi: "Hiểu ràng buộc đối phương, giải quyết bằng góc độ khác. Sáng tạo.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "分かりました。10%でいいです。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 50, politenessScore: 70, businessRiskDelta: 15, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自社の利益を守れていない。安易な妥協。", consequenceVi: "Không bảo vệ được lợi nhuận. Nhượng bộ dễ dãi.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "8%が限界です。これ以上は本当に無理です。ご理解ください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 50, politenessScore: 55, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "平行線のまま。創造的な解決策を提案すべき。", consequenceVi: "Bế tắc tiếp tục. Cần đề xuất giải pháp sáng tạo.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様の稟議の問題は御社の社内事情ですので、弊社としては対応しかねます。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 55, politenessScore: 25, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "パートナーシップの姿勢ゼロ。取引終了リスク。", consequenceVi: "Không có tinh thần đối tác. Rủi ro mất giao dịch.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 32, skillGains: { nuance: 8, customer: 6, meeting: 4 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 12 }] },
    },
    {
      slug: "boss-closing-deal", ja: "【難関】年間契約のクロージング", vi: "【Boss】Chốt hợp đồng năm", order: 4, boss: true,
      briefing: { briefingJa: "佐藤様と高橋部長の最終承認会議。全ての条件を整理し、合意を勝ち取ります。", briefingVi: "Họp phê duyệt cuối cùng với Sato-san và GĐ Takahashi. Chốt deal.", yourRoleVi: "主任（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_closing_01", scenarioType: "meeting", titleJa: "年間契約クロージング", titleVi: "Chốt hợp đồng năm",
        contextSummaryVi: "Cả Sato và Takahashi có mặt. Điều kiện đã thống nhất qua email. Cần confirm chính thức và xử lý câu hỏi cuối.",
        goalJa: "合意内容を確認し、正式締結に導く。最後の疑問にも答える。", goalVi: "Xác nhận nội dung thỏa thuận, dẫn dắt đến ký kết. Trả lời câu hỏi cuối.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "buyer" }, { npcSlug: "takahashi_clienthq", roleInScene: "approver" }, { npcSlug: "yamada_bucho", roleInScene: "supporter" }],
        payload: { meetingTranscript: [{ speaker: "高橋部長", lineJa: "では最終確認させてもらう。万が一また品質問題が起きた場合の保証はどうなっている？" }] },
        question: { id: "q_closing_01", skillTag: "customer", difficulty: "hard",
          promptJa: "高橋部長の最終質問「品質保証はどうなっている？」に対する最も適切な回答は？",
          promptVi: "Câu hỏi cuối của GĐ Takahashi: 'Bảo đảm chất lượng thế nào?'. Trả lời đúng nhất?",
          options: [
            { optionKey: "A", textJa: "高橋様、大変重要なポイントです。契約書第7条に品質保証条項を設けております。\n\n具体的には：\n①納品ロットの不良率0.5%以上の場合：全数無償交換＋特急便\n②不良に起因する御社損害：上限500万円の損害補償\n③品質管理体制：四半期監査レポートの提出義務\n④専用窓口：私が一次対応し、24時間以内に状況報告\n\n前回の経験を踏まえ、御社にご安心いただける体制を構築しております。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 95, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "具体的な数字付き保証。前回の学びを活かしている。", consequenceVi: "Bảo đảm có con số cụ thể. Rút kinh nghiệm từ lần trước.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "品質には自信がありますので、ご心配には及びません。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 25, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "前回の件を忘れたのか？具体的保証なし。", consequenceVi: "Quên vụ lần trước rồi sao? Không có bảo đảm cụ thể.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "その点は契約書に書いてありますので、ご確認ください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 40, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "質問を受け流している。誠意が感じられない。", consequenceVi: "Lảng tránh câu hỏi. Thiếu thành ý.", affectedNpcSlug: "takahashi_clienthq", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "万が一の場合は、その都度ご相談させていただきます。ケースバイケースで対応いたします。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 35, politenessScore: 60, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "具体性ゼロ。相手は安心できない。", consequenceVi: "Không cụ thể. Đối phương không thể yên tâm.", affectedNpcSlug: "takahashi_clienthq", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 48, skillGains: { customer: 10, nuance: 8, meeting: 6, chart: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 18 }, { npcSlug: "sato_kokyaku", delta: 15 }, { npcSlug: "yamada_bucho", delta: 12 }], npcReactionMontage: [{ npcSlug: "takahashi_clienthq", quoteJa: "ここまで準備してくれたなら、安心してお任せできるよ。契約しよう。", sentiment: "positive" }, { npcSlug: "yamada_bucho", quoteJa: "見事だ。係長昇進の推薦、書かせてもらうよ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.negotiation-basics: 4 chapters");

  /* ═══ Arc 11: チーム内調整 ═════════════════════════════════════════════ */
  const arc11Id = await upsertArc(client, {
    slug: "arc.team-coordination", ja: "チーム内調整", vi: "Điều phối nội bộ team",
    rank: "R4", order: 11,
    story: { synopsisVi: "Ở level 主任, bạn bắt đầu phải điều phối công việc giữa các thành viên. Phân công, theo dõi, hỗ trợ khi cần.", npcSlugs: ["suzuki_kakaricho", "tanaka_senpai", "morita_kouhai"], artAccent: "#7C3AED" },
  });

  await upsertChapters(client, arc11Id, [
    {
      slug: "task-delegation", ja: "後輩への業務依頼", vi: "Giao việc cho hậu bối", order: 1, boss: false,
      briefing: { briefingJa: "森田後輩に資料作成を依頼します。明確な指示の出し方を学びます。", briefingVi: "Giao việc làm tài liệu cho hậu bối Morita. Học cách ra chỉ thị rõ ràng.", yourRoleVi: "主任（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_delegate_01", scenarioType: "chat", titleJa: "森田への資料作成依頼", titleVi: "Giao Morita làm tài liệu",
        contextSummaryVi: "Cần Morita làm bảng so sánh sản phẩm cho cuộc họp khách hàng thứ 5. Hiện là thứ 2.", goalJa: "5W1Hで明確に依頼し、質問しやすい雰囲気を作る。", goalVi: "Giao việc rõ ràng theo 5W1H, tạo không khí dễ hỏi.",
        characters: [{ npcSlug: "morita_kouhai", roleInScene: "assignee" }],
        payload: { chatLog: [{ speaker: "あなた", lineJa: "（森田に声をかける）", timestamp: "2026-06-10T10:00:00Z" }] },
        question: { id: "q_delegate_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "森田後輩に資料作成を依頼する際、最も適切な伝え方はどれですか？",
          promptVi: "Khi giao Morita làm tài liệu, cách truyền đạt nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "森田さん、今少し時間いい？木曜の佐藤様向け打ち合わせ用の製品比較表を作ってほしいんだ。\n\n目的：A製品とB製品の性能・価格比較\n期限：水曜15時（チェック時間確保のため）\nフォーマット：前回の比較表をベースに\nポイント：価格差よりも性能優位を強調したい\n\n分からないことがあったらいつでも聞いてね。水曜午前にドラフト見せてもらってもいい？", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 85, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "目的・期限・フォーマット・ポイント・中間チェック。完璧な依頼。", consequenceVi: "Mục đích, deadline, format, trọng tâm, check giữa chừng. Giao việc hoàn hảo.", affectedNpcSlug: "morita_kouhai", errorType: null } },
            { optionKey: "B", textJa: "森田、比較表作っといて。木曜までに。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 25, politenessScore: 30, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "情報不足。何の比較表か、誰向けか不明。", consequenceVi: "Thiếu thông tin. So sánh gì, cho ai không rõ.", affectedNpcSlug: "morita_kouhai", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "森田さん、時間ある時でいいんだけど、できれば比較表みたいなの作ってくれると嬉しいな…", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 20, politenessScore: 70, businessRiskDelta: 6, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "曖昧すぎ。期限も優先度も伝わらない。", consequenceVi: "Quá mơ hồ. Deadline và độ ưu tiên không rõ.", affectedNpcSlug: "morita_kouhai", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "森田さん、自分で考えて比較表を作ってみて。内容は任せるから。木曜に見せて。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 35, politenessScore: 50, businessRiskDelta: 10, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "方向性なし。後輩が迷走するリスク大。", consequenceVi: "Không có định hướng. Hậu bối sẽ bị lạc.", affectedNpcSlug: "morita_kouhai", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 24, skillGains: { meeting: 6, nuance: 4 }, npcTrustGains: [{ npcSlug: "morita_kouhai", delta: 8 }] },
    },
    {
      slug: "feedback-to-junior", ja: "後輩へのフィードバック", vi: "Feedback cho hậu bối", order: 2, boss: false,
      briefing: { briefingJa: "森田の資料にミスが多い。モチベーションを下げずに改善を促します。", briefingVi: "Tài liệu Morita nhiều lỗi. Cần feedback mà không làm giảm động lực.", yourRoleVi: "主任（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_feedback_01", scenarioType: "chat", titleJa: "森田へのフィードバック面談", titleVi: "Phiên feedback cho Morita",
        contextSummaryVi: "Tài liệu Morita có 3 lỗi số liệu và format không theo mẫu. Cần sửa trước thứ 5 nhưng không muốn Morita mất tự tin.",
        goalJa: "具体的に問題点を示し、成長につなげる。", goalVi: "Chỉ ra vấn đề cụ thể, kết nối với sự phát triển.",
        characters: [{ npcSlug: "morita_kouhai", roleInScene: "recipient" }],
        payload: { chatLog: [{ speaker: "あなた", lineJa: "森田さん、資料ありがとう。少しフィードバックいいかな？" }] },
        question: { id: "q_feedback_01", skillTag: "nuance", difficulty: "standard",
          promptJa: "森田へのフィードバックとして最も適切なものはどれですか？",
          promptVi: "Feedback cho Morita, cách nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "まず、短期間でここまで形にしてくれてありがとう。構成はいい方向だよ。\n\n3点だけ修正してほしいところがあるんだけど：\n①3ページ目の価格データ、去年の数字になってる。最新版はこのフォルダに。\n②比較項目の並び順、お客様目線だと性能→価格の順の方が効果的かも。\n③フォントサイズ、前回の資料に揃えてもらえる？\n\n明日15時までに直せそう？何か迷ったらいつでも聞いてね。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 92, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "認める→具体的指摘→理由→期限→サポート姿勢。理想的。", consequenceVi: "Công nhận → Chỉ ra cụ thể → Lý do → Deadline → Hỗ trợ. Lý tưởng.", affectedNpcSlug: "morita_kouhai", errorType: null } },
            { optionKey: "B", textJa: "森田さん、ミスが多いね。ちゃんと確認した？作り直して。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 20, businessRiskDelta: 6, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "人格否定に近い。具体的な改善指示もない。", consequenceVi: "Gần như phủ nhận năng lực. Không có hướng dẫn cải thiện cụ thể.", affectedNpcSlug: "morita_kouhai", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "うん、いい感じだね！大丈夫大丈夫。このまま出しちゃおう。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 10, politenessScore: 70, businessRiskDelta: 15, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "ミスを放置。お客様に出せない品質。", consequenceVi: "Bỏ qua lỗi. Chất lượng không đạt để gửi khách.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "（自分で全部直して、森田には何も言わない）", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 0, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "後輩の成長機会を奪っている。同じミスが繰り返される。", consequenceVi: "Tước cơ hội phát triển của hậu bối. Lỗi sẽ lặp lại.", affectedNpcSlug: "morita_kouhai", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 24, skillGains: { nuance: 6, meeting: 4 }, npcTrustGains: [{ npcSlug: "morita_kouhai", delta: 10 }] },
    },
    {
      slug: "conflict-between-members", ja: "メンバー間の対立仲裁", vi: "Hòa giải mâu thuẫn giữa thành viên", order: 3, boss: false,
      briefing: { briefingJa: "鈴木係長と田中先輩の担当エリアが重なり、対立発生。主任として仲裁します。", briefingVi: "Khu vực phụ trách của Suzuki và Tanaka chồng chéo, xung đột. Bạn với vai chuyên viên hòa giải.", yourRoleVi: "主任（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_conflict_01", scenarioType: "meeting", titleJa: "担当エリア重複の仲裁", titleVi: "Hòa giải chồng chéo khu vực",
        contextSummaryVi: "Suzuki và Tanaka đều claim khách hàng X thuộc khu vực mình. Bạn cần đề xuất phương án công bằng.",
        goalJa: "両者の面子を立てつつ、チーム利益を最大化する解決案。", goalVi: "Giữ thể diện cả hai, tối đa lợi ích team.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "party_a" }, { npcSlug: "tanaka_senpai", roleInScene: "party_b" }],
        payload: { meetingTranscript: [{ speaker: "鈴木係長", lineJa: "X社は明らかに私の担当エリアだ。" }, { speaker: "田中先輩", lineJa: "いや、前任者から引き継いだのは私ですよ。" }] },
        question: { id: "q_conflict_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "担当エリアの対立を仲裁する際、最も適切なアプローチはどれですか？",
          promptVi: "Khi hòa giải xung đột khu vực, cách tiếp cận nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "お二方のご意見、どちらも理解できます。一つ提案させていただいていいですか。\n\nX社は案件の規模が大きいので、二人で協力する形はいかがでしょう。\n具体的には：\n・メイン担当：鈴木係長（エリア責任者として）\n・技術サポート：田中先輩（過去の関係性を活かし）\n・成果配分：案件売上の60:40で按分\n\nチームとして最大の成果を出せる形だと思います。部長にも相談して正式に決めましょう。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 90, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "両者を立てつつ、合理的な分担を提案。", consequenceVi: "Tôn trọng cả hai, đề xuất phân công hợp lý.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "鈴木係長が上なんだから、係長に従いましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "力関係だけで解決するのはチームワークを壊す。", consequenceVi: "Giải quyết chỉ bằng quyền lực phá hỏng teamwork.", affectedNpcSlug: "tanaka_senpai", errorType: "priority_misread" } },
            { optionKey: "C", textJa: "お二人で話し合って決めてください。私は口出ししません。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 15, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "主任としてのリーダーシップ放棄。", consequenceVi: "Từ bỏ vai trò lãnh đạo của chuyên viên.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "どっちも自分のエリアだと言ってるなら、じゃんけんで決めましょう。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 20, politenessScore: 25, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "ビジネス上の問題を運に任せるのは論外。", consequenceVi: "Quyết định kinh doanh bằng may rủi là vô lý.", affectedNpcSlug: "suzuki_kakaricho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 28, skillGains: { nuance: 7, meeting: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 8 }, { npcSlug: "tanaka_senpai", delta: 8 }] },
    },
    {
      slug: "boss-team-project", ja: "【難関】チームプロジェクトの危機管理", vi: "【Boss】Quản lý khủng hoảng dự án team", order: 4, boss: true,
      briefing: { briefingJa: "チーム3人で進めるプロジェクト。森田が体調不良で離脱、鈴木係長は別件で忙殺中。一人で立て直します。", briefingVi: "Dự án 3 người. Morita ốm nghỉ, Suzuki bận rộn. Bạn phải một mình vực dậy.", yourRoleVi: "主任（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_teamcrisis_01", scenarioType: "deadline", titleJa: "プロジェクト危機への対応", titleVi: "Ứng phó khủng hoảng dự án",
        contextSummaryVi: "Deadline 5 ngày nữa. Morita nghỉ 3 ngày (ốm). Suzuki chỉ có thể giúp 1 giờ/ngày. Khối lượng còn lại: 60%.",
        goalJa: "リソース不足を認識し、現実的な対策を打つ。", goalVi: "Nhận diện thiếu nguồn lực, đưa đối sách thực tế.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "escalation-target" }, { npcSlug: "morita_kouhai", roleInScene: "absent" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "月曜朝。森田から「体調不良で3日休みます」のメール。締切は金曜。" }] },
        question: { id: "q_teamcrisis_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "チームメンバー離脱時の最も適切な対応はどれですか？",
          promptVi: "Khi thành viên rời team, cách ứng phó tốt nhất?",
          options: [
            { optionKey: "A", textJa: "①即座に山田部長に報告：「森田離脱で人員不足。金曜納期にリスクあり」\n②残タスクの棚卸し：優先度A/B/Cに分類\n③対策案を部長に提示：\n  案1:優先度A（顧客向け部分）のみ金曜に。B/Cは来週月曜\n  案2:他チームから1名サポートを木曜に（部長承認要）\n  案3:自分が残業で80%まではカバー可能\n④鈴木係長に1日1時間のレビューだけ依頼\n⑤森田にはゆっくり休むよう伝え、引き継ぎメモをもらう", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 85, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "報告→分析→複数案→関係者配慮。リーダーシップ発揮。", consequenceVi: "Báo cáo → Phân tích → Nhiều phương án → Quan tâm các bên. Thể hiện leadership.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "一人で全部やります。徹夜してでも間に合わせます。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "ヒーロー症候群。品質低下・体調リスク。報告義務も無視。", consequenceVi: "Hội chứng anh hùng. Rủi ro chất lượng & sức khỏe. Bỏ qua nghĩa vụ báo cáo.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "森田に「できるだけ早く戻ってきて」と連絡する。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "病気の人に出勤を促すのはパワハラリスク。", consequenceVi: "Ép người ốm đi làm = rủi ro power harassment.", affectedNpcSlug: "morita_kouhai", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "部長に「金曜は無理なので来週にします」と一方的にメールする。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "対策案なしで延期通告は無責任。顧客への影響も未確認。", consequenceVi: "Thông báo dời không đối sách là vô trách nhiệm. Chưa xét ảnh hưởng khách.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 42, skillGains: { meeting: 8, nuance: 6, written: 4, customer: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "morita_kouhai", delta: 5 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "冷静な判断だった。リーダーの資質がある。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.team-coordination: 4 chapters");
  console.log(`✓ R4 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("05-r4")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR4(client);
  await client.end();
}
