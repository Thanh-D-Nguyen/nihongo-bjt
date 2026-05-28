/**
 * Career RPG Production Seed — R7 部長 (Director)
 * 3 arcs, 12 chapters: Global partnership + Organizational change + Stakeholder management
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR7(client) {
  /* ═══ Arc 18: 海外パートナー交渉 ═══════════════════════════════════════ */
  const arc18Id = await upsertArc(client, {
    slug: "arc.global-partnership", ja: "海外パートナー交渉", vi: "Đàm phán đối tác quốc tế",
    rank: "R7", order: 18,
    story: { synopsisVi: "Ở cấp 部長, bạn chịu trách nhiệm partnership quốc tế: đàm phán với Miller VP, Kim partner, xử lý khác biệt văn hóa.", npcSlugs: ["miller_vp", "kim_partner", "ito_shachou", "watanabe_global"], artAccent: "#0369A1" },
  });

  await upsertChapters(client, arc18Id, [
    {
      slug: "initial-partnership-meeting", ja: "初回パートナーシップ会議", vi: "Cuộc họp partnership đầu tiên", order: 1, boss: false,
      briefing: { briefingJa: "米国Miller VP との初会合。文化の違いを意識しながら信頼関係を構築します。", briefingVi: "Họp lần đầu với Miller VP (Mỹ). Xây dựng quan hệ tin tưởng xuyên văn hóa.", yourRoleVi: "部長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_global_01", scenarioType: "meeting", titleJa: "Miller VPとの初回会議", titleVi: "Họp lần đầu với Miller VP",
        contextSummaryVi: "Miller (VP Business Dev, công ty Mỹ) muốn partnership. Phong cách: direct, result-oriented, fast decision. Bạn cần balance giữa phong cách Nhật (consensus) và Mỹ (speed).",
        goalJa: "異文化間の信頼構築と、具体的な協業の方向性合意。", goalVi: "Xây tin tưởng xuyên văn hóa + thống nhất hướng hợp tác.",
        characters: [{ npcSlug: "miller_vp", roleInScene: "partner" }, { npcSlug: "watanabe_global", roleInScene: "interpreter" }],
        payload: { meetingTranscript: [{ speaker: "Miller VP", lineJa: "Nice to meet you. Let's skip the formalities and get to the point. What can we do together to make money?" }] },
        question: { id: "q_global_01", skillTag: "customer", difficulty: "hard",
          promptJa: "Miller VPの直接的なアプローチに対する最も効果的な応答は？",
          promptVi: "Với cách tiếp cận thẳng thắn của Miller VP, phản hồi hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "Miller-san, great to meet you too. I appreciate your directness — let me match it.\n\nHere's what I see:\n\n【Synergy Points】\n①Your distribution network in North America + our product quality = untapped market\n②Your tech platform + our manufacturing = cost reduction 20%\n③Combined: potential $5M in new revenue within 18 months\n\n【Proposed Next Steps】\n・Today: align on vision and deal-breakers\n・Week 2: exchange market data (NDA signed today?)\n・Month 1: pilot project scope — small, measurable, low-risk\n\n【Cultural bridge note】\nOur decision process involves internal consensus (稟議), which takes ~2 weeks for major decisions. I'll be transparent about timelines so you're never waiting without information.\n\nOne question for you: what's your ideal outcome from this meeting today?", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 95, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "相手のスタイルに合わせつつ自社の文化も説明。Win-win提案。", consequenceVi: "Thích ứng style đối phương + giải thích văn hóa mình. Đề xuất win-win.", affectedNpcSlug: "miller_vp", errorType: null } },
            { optionKey: "B", textJa: "まず弊社の会社紹介をさせてください。1954年創業で…（30分プレゼン）", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 55, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "相手のスタイルを無視。アメリカ人は本題を求めている。", consequenceVi: "Bỏ qua style đối phương. Người Mỹ muốn vào thẳng vấn đề.", affectedNpcSlug: "miller_vp", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "Let's make a lot of money! I agree to everything. When do we start?", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 40, businessRiskDelta: 15, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "軽率。何に合意したか不明で後々トラブルになる。", consequenceVi: "Khinh suất. Đồng ý mà không rõ gì, sau sẽ gặp vấn đề.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "このような大きな決定は社内で検討してから改めてお返事します。今日は顔合わせということで。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 60, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "初回から消極的。相手は次のステップを求めている。", consequenceVi: "Tiêu cực từ đầu. Đối phương muốn bước tiếp theo.", affectedNpcSlug: "miller_vp", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { customer: 8, meeting: 7, nuance: 5 }, npcTrustGains: [{ npcSlug: "miller_vp", delta: 15 }, { npcSlug: "watanabe_global", delta: 8 }] },
    },
    {
      slug: "contract-negotiation", ja: "国際契約交渉", vi: "Đàm phán hợp đồng quốc tế", order: 2, boss: false,
      briefing: { briefingJa: "金パートナーとの東南アジア合弁契約。利益配分・知的財産・撤退条項を交渉します。", briefingVi: "Đàm phán hợp đồng liên doanh với Kim partner. Phân chia lợi nhuận, IP, điều khoản rút lui.", yourRoleVi: "部長（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_contract_01", scenarioType: "meeting", titleJa: "合弁契約の条件交渉", titleVi: "Đàm phán điều kiện liên doanh",
        contextSummaryVi: "Kim đề xuất: lợi nhuận 50-50, IP chung, không exit clause 5 năm. Bạn muốn: 60-40 (vì đầu tư nhiều hơn), IP riêng, exit clause sau 3 năm.",
        goalJa: "自社に有利な条件を確保しつつ、相手も納得する着地点を見つける。", goalVi: "Đảm bảo điều kiện có lợi + đối phương cũng đồng ý.",
        characters: [{ npcSlug: "kim_partner", roleInScene: "negotiator" }],
        payload: { meetingTranscript: [{ speaker: "金パートナー", lineJa: "利益は50-50、知的財産は共有、5年間は解消不可。これが我々の条件です。" }] },
        question: { id: "q_contract_01", skillTag: "customer", difficulty: "hard",
          promptJa: "金パートナーの条件に対する最も効果的な交渉対応はどれですか？",
          promptVi: "Phản hồi đàm phán hiệu quả nhất với điều kiện của Kim?",
          options: [
            { optionKey: "A", textJa: "金様、ご条件を整理していただきありがとうございます。率直にお話しさせてください。\n\n3点について弊社の考えをお伝えします。\n\n①利益配分：60:40を提案したい。理由は初期投資の70%を弊社が負担するため。ただし、3年目以降は金様の貢献度に応じて見直し条項を入れましょう。\n\n②知的財産：共同開発の新IPは共有に同意。ただし、既存の製品技術（弊社のコア）は各社保有を維持させてください。これは弊社の取締役会マター。\n\n③契約期間：5年はリスクが高い。3年＋自動更新（双方合意）ではいかがでしょう。成功すれば更新しない理由がありませんよね。\n\n全体として、「成功したら双方が得をし、うまくいかなければ早めに修正できる」構造が、長期パートナーシップの基盤になると考えます。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 90, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "各論に根拠→代替案→Win-Winのフレーム。プロの交渉。", consequenceVi: "Mỗi điểm có căn cứ → Phương án thay thế → Khung Win-Win. Đàm phán chuyên nghiệp.", affectedNpcSlug: "kim_partner", errorType: null } },
            { optionKey: "B", textJa: "その条件で合意します。パートナーシップが大事ですから。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 60, businessRiskDelta: 18, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自社に不利な条件を無条件に受諾。取締役会で否決される。", consequenceVi: "Chấp nhận vô điều kiện. HĐQT sẽ bác bỏ.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "全部却下です。60:40、IP完全別、1年でexit可能。これが最低ライン。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 20, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "交渉ではなく一方的要求。パートナーシップ崩壊。", consequenceVi: "Không phải đàm phán mà là yêu cầu một chiều. Phá vỡ partnership.", affectedNpcSlug: "kim_partner", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "社内で検討して、また連絡します。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 25, politenessScore: 55, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "交渉の場で何も言わないのは機会損失。方向性を示すべき。", consequenceVi: "Không nói gì ở bàn đàm phán = mất cơ hội. Cần chỉ hướng.", affectedNpcSlug: "kim_partner", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 42, skillGains: { customer: 9, nuance: 7, meeting: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "kim_partner", delta: 12 }] },
    },
    {
      slug: "cross-cultural-conflict", ja: "異文化間の衝突解決", vi: "Giải quyết xung đột văn hóa", order: 3, boss: false,
      briefing: { briefingJa: "渡辺（海外営業）が米国チームと衝突。「日本式では通用しない」と言われた。仲介します。", briefingVi: "Watanabe (sales quốc tế) xung đột với team Mỹ. Bị nói 'cách Nhật không work'. Trung gian hòa giải.", yourRoleVi: "部長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_cultural_01", scenarioType: "meeting", titleJa: "異文化衝突の仲介", titleVi: "Hòa giải xung đột văn hóa",
        contextSummaryVi: "Watanabe: 'Họ thô lỗ, không tôn trọng hierarchy'. Miller team: 'Japanese side too slow, too vague, never say no directly'. Bạn cần bridge gap.",
        goalJa: "双方の文化的前提を翻訳し、協業のルールを再設定する。", goalVi: "Dịch tiền đề văn hóa 2 bên, thiết lập lại quy tắc hợp tác.",
        characters: [{ npcSlug: "watanabe_global", roleInScene: "party-a" }, { npcSlug: "miller_vp", roleInScene: "party-b" }],
        payload: { meetingTranscript: [{ speaker: "渡辺", lineJa: "部長、向こうは何でも「Yes or No」で答えろと言ってきます。日本のビジネスはそう単純じゃないのに…" }] },
        question: { id: "q_cultural_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "日米チーム間の文化的衝突を解決する最も適切なアプローチは？",
          promptVi: "Giải quyết xung đột văn hóa Nhật-Mỹ, cách nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "渡辺さん、気持ちは分かる。まず両方の立場を整理させて。\n\n【米国側の期待】\n・明確なYes/No→彼らにとって「検討中」は「No」に聞こえる\n・スピード→1週間は「遅い」感覚\n・Issue-based→人格攻撃ではない（direct ≠ rude）\n\n【我々の強み（翻訳すべき点）】\n・深い検討＝高品質な結論\n・全体調和＝実行力（決めたら早い）\n・曖昧さ＝柔軟性のサイン\n\n【解決策：協業ルール再設計】\n①回答期限：72時間以内にYes/No/Pending+理由\n②コミュニケーション：結論→理由→詳細（米国式）で伝える\n③週次sync：15分のstanding meeting for alignment\n④文化説明session：月1で互いのビジネス文化を共有\n\n私がMiller-sanに同じフレームで説明する。渡辺さんは「結論ファースト」を練習してみて。2週間で改善が見えるはず。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "双方の文化を翻訳→具体的ルール→フォローアップ。グローバルリーダー。", consequenceVi: "Dịch văn hóa 2 bên → Quy tắc cụ thể → Follow-up. Global leader.", affectedNpcSlug: "watanabe_global", errorType: null } },
            { optionKey: "B", textJa: "アメリカ式に合わせるしかないよ。相手に合わせないとビジネスは取れない。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一方的な適応は自社の強みを殺す。Bridge roleを果たしていない。", consequenceVi: "Thích ứng một chiều giết sở trường mình. Không làm vai bridge.", affectedNpcSlug: "watanabe_global", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "向こうが日本の文化を理解すべき。我々のやり方を説明して従ってもらおう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 35, politenessScore: 30, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "逆に一方的。グローバルビジネスでは双方歩み寄りが必要。", consequenceVi: "Ngược lại cũng một chiều. Business quốc tế cần cả hai nhượng bộ.", affectedNpcSlug: "miller_vp", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "時間が解決するよ。慣れれば大丈夫。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 15, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "放置は事態を悪化させる。リーダーの介入が必要な段階。", consequenceVi: "Bỏ mặc sẽ tệ hơn. Cần leader can thiệp.", affectedNpcSlug: "watanabe_global", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { nuance: 9, customer: 6, meeting: 5 }, npcTrustGains: [{ npcSlug: "watanabe_global", delta: 12 }, { npcSlug: "miller_vp", delta: 10 }] },
    },
    {
      slug: "boss-global-deal-closing", ja: "【難関】グローバル大型提携の最終交渉", vi: "【Boss】Đàm phán cuối partnership toàn cầu", order: 4, boss: true,
      briefing: { briefingJa: "Miller VP + 金パートナーとの3社提携。最終条件を詰める会議。社長の代理で交渉権限あり。", briefingVi: "Partnership 3 bên với Miller + Kim. Họp chốt điều kiện. Bạn có quyền đàm phán thay CEO.", yourRoleVi: "部長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_globaldeal_01", scenarioType: "meeting", titleJa: "3社提携の最終交渉", titleVi: "Đàm phán cuối partnership 3 bên",
        contextSummaryVi: "Miller muốn exclusivity Bắc Mỹ. Kim muốn exclusivity Đông Nam Á. Bạn muốn giữ quyền mở rộng sau 3 năm. Tổng deal: $10M/3 năm.",
        goalJa: "三者のWin-Win-Winを設計し、合意に導く。", goalVi: "Thiết kế Win-Win-Win 3 bên, dẫn dắt đến thỏa thuận.",
        characters: [{ npcSlug: "miller_vp", roleInScene: "partner-a" }, { npcSlug: "kim_partner", roleInScene: "partner-b" }],
        payload: { meetingTranscript: [{ speaker: "Miller VP", lineJa: "We need North America exclusivity. Non-negotiable." }, { speaker: "金パートナー", lineJa: "東南アジアの独占権は譲れません。" }] },
        question: { id: "q_globaldeal_01", skillTag: "customer", difficulty: "hard",
          promptJa: "両者が独占権を主張する中で、三者合意を導く最も適切な提案は？",
          promptVi: "Cả hai đòi exclusive, đề xuất nào dẫn đến thỏa thuận 3 bên?",
          options: [
            { optionKey: "A", textJa: "Miller-san, Kim-san, both requests are fair. Let me propose a framework that works for everyone.\n\n【Territory Structure】\n・Miller: North America exclusive — agreed ✓\n・Kim: Southeast Asia exclusive — agreed ✓\n・Mirai (us): Japan + expansion rights after Year 3 into other regions\n\n【Conditions for Exclusivity】\n・Minimum revenue commitment: $2M/year per territory\n・If below 80% of target for 2 consecutive quarters → exclusivity converts to preferred-partner\n・Review and renewal every 3 years\n\n【Shared Benefits】\n・Joint marketing fund: each party contributes 2% of territory revenue\n・Technology sharing: improvements by any party → licensed to others at cost\n・Quarterly executive sync: 3-way alignment\n\n【Year 3+ Expansion】\n・New territories (Europe, Middle East): first right of refusal to existing partners\n・If no interest within 90 days → open to new partnerships\n\nThis gives everyone protection AND growth incentive. The performance clause ensures nobody sits on unused territory.\n\nCan we initial this framework today and have legal draft contracts by Friday?", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 92, businessRiskDelta: -15, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "双方の要求を認めつつ→条件付き→共通利益→拡張オプション。三方良し。", consequenceVi: "Chấp nhận yêu cầu 2 bên + điều kiện + lợi ích chung + option mở rộng. Win-Win-Win.", affectedNpcSlug: "miller_vp", errorType: null } },
            { optionKey: "B", textJa: "どちらも独占権は認められません。非独占で行きましょう。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 45, politenessScore: 40, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "両者の核心要求を無視。交渉決裂のリスク。", consequenceVi: "Bỏ qua yêu cầu cốt lõi cả 2. Rủi ro phá vỡ đàm phán.", affectedNpcSlug: "kim_partner", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "Millerさんの要求を優先します。米国市場の方が大きいので。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 40, politenessScore: 30, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "一方に肩入れすると三者合意は不可能。金氏の信頼を失う。", consequenceVi: "Thiên vị 1 bên → không thể thỏa thuận 3 bên. Mất tin tưởng của Kim.", affectedNpcSlug: "kim_partner", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "社長に最終判断を仰ぎます。私の権限では…", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 30, politenessScore: 55, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "代理として交渉権限を得ているのに逃げるのは信頼毀損。", consequenceVi: "Đã có quyền thay CEO mà lùi = mất uy tín.", affectedNpcSlug: "miller_vp", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 60, skillGains: { customer: 10, nuance: 8, meeting: 7, keigo: 4 }, npcTrustGains: [{ npcSlug: "miller_vp", delta: 18 }, { npcSlug: "kim_partner", delta: 18 }, { npcSlug: "ito_shachou", delta: 15 }], npcReactionMontage: [{ npcSlug: "miller_vp", quoteJa: "Impressive framework. You understand how to make deals that last.", sentiment: "positive" }, { npcSlug: "kim_partner", quoteJa: "公正で明快な提案。長いお付き合いができそうです。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.global-partnership: 4 chapters");

  /* ═══ Arc 19: 組織改革推進 ═══════════════════════════════════════════════ */
  const arc19Id = await upsertArc(client, {
    slug: "arc.organizational-change", ja: "組織改革推進", vi: "Thúc đẩy cải cách tổ chức",
    rank: "R7", order: 19,
    story: { synopsisVi: "部長 phải dẫn dắt thay đổi tổ chức: DX transformation, restructuring, culture change.", npcSlugs: ["ito_shachou", "yamada_bucho", "suzuki_kakaricho", "nakamura_hr"], artAccent: "#9333EA" },
  });

  await upsertChapters(client, arc19Id, [
    {
      slug: "dx-transformation", ja: "DX変革の推進", vi: "Thúc đẩy chuyển đổi số (DX)", order: 1, boss: false,
      briefing: { briefingJa: "社長からDX推進の指示。営業プロセスのデジタル化を計画・推進します。", briefingVi: "CEO giao nhiệm vụ DX. Số hóa quy trình kinh doanh.", yourRoleVi: "部長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_dx_01", scenarioType: "meeting", titleJa: "DX推進計画の策定", titleVi: "Lập kế hoạch DX",
        contextSummaryVi: "Hiện tại: 70% quy trình vẫn dùng giấy/Excel. Mục tiêu: số hóa 90% trong 1 năm. Nhân viên cũ (Yamada) phản đối: 'cách cũ vẫn tốt'.",
        goalJa: "抵抗勢力を巻き込みながらDX計画を策定する。", goalVi: "Thu hút phe phản đối, đồng thời lập kế hoạch DX.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "resistor" }, { npcSlug: "suzuki_kakaricho", roleInScene: "champion" }],
        payload: { meetingTranscript: [{ speaker: "山田", lineJa: "今のやり方で30年やってきた。デジタル化して何が良くなるんだ？" }] },
        question: { id: "q_dx_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "DX推進に抵抗する山田への最も効果的な対応はどれですか？",
          promptVi: "Yamada phản đối DX, cách đối ứng hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "山田さんの意見は重要です。30年の経験から見える「変えるべきでないこと」を教えてほしい。\n\nその上で、数字を共有させてください：\n\n【現状の見えないコスト】\n・月次報告作成：1人4時間/月 × 20人 = 80時間（人件費換算160万/月）\n・情報伝達ミス：月平均3件→対応コスト月50万\n・顧客対応遅延：紙ベースの引き継ぎ→平均1日のロス\n\n【DXで変わること】\n・80時間→8時間に（CRM自動レポート）\n・伝達ミス→ゼロに近づく（チャット＋タスク管理）\n・対応速度→当日中（顧客DBリアルタイム共有）\n\n【変えないこと】\n・お客様との信頼関係の作り方\n・営業の基本（ヒアリング力、提案力）\n・山田さんの経験と判断力\n\nデジタルは道具です。山田さんの経験×デジタルの効率＝最強。DX推進のアドバイザーとして参加してもらえませんか？", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 95, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "経験を尊重→データで説得→役割を与える。抵抗を味方に。", consequenceVi: "Tôn trọng kinh nghiệm → Thuyết phục bằng data → Giao vai trò. Biến phản đối thành đồng minh.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "社長の指示なので従ってください。以上。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 20, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "権威で押すと表面的従順→裏で抵抗。DXは失敗する。", consequenceVi: "Ép bằng quyền lực → Vâng bề ngoài → Chống ngầm. DX sẽ thất bại.", affectedNpcSlug: "yamada_bucho", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "山田さんの部門は例外にしましょう。やりたい人だけでいいです。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 35, politenessScore: 55, businessRiskDelta: 15, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "例外を認めるとDXは中途半端に終わる。全社でやる意味がない。", consequenceVi: "Cho ngoại lệ → DX nửa vời. Mất ý nghĩa toàn công ty.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "紙が好きな人は取り残されますよ。時代の流れですから。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 20, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "脅し＋見下し。変革リーダーに必要な共感力ゼロ。", consequenceVi: "Đe dọa + coi thường. Thiếu hoàn toàn năng lực đồng cảm của leader.", affectedNpcSlug: "yamada_bucho", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 42, skillGains: { meeting: 8, nuance: 7, chart: 5 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "suzuki_kakaricho", delta: 10 }] },
    },
    {
      slug: "restructuring-communication", ja: "組織再編の社内伝達", vi: "Truyền đạt tái cơ cấu nội bộ", order: 2, boss: false,
      briefing: { briefingJa: "部門統合で2つの課が1つに。不安を抱える社員に説明し、協力を得ます。", briefingVi: "Hợp nhất 2 phòng thành 1. Giải thích cho nhân viên lo lắng, giành sự hợp tác.", yourRoleVi: "部長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_restructure_01", scenarioType: "meeting", titleJa: "部門統合の全体説明会", titleVi: "Buổi giải thích hợp nhất phòng ban",
        contextSummaryVi: "2 phòng 6+7 người → 1 phòng 13 người. Lo lắng: ai bị sa thải? Ai là boss? Sự thật: không sa thải, Suzuki sẽ lead, Yamada thành advisor.",
        goalJa: "透明性を持って説明し、不安を払拭し、前向きなスタートを切る。", goalVi: "Giải thích minh bạch, xóa lo lắng, khởi đầu tích cực.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "new-leader" }, { npcSlug: "yamada_bucho", roleInScene: "advisor-role" }],
        payload: { meetingTranscript: [{ speaker: "（雰囲気）", lineJa: "社員13名が不安な表情で集まっている。" }] },
        question: { id: "q_restructure_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "部門統合を説明する全体会議での最も適切なスピーチはどれですか？",
          promptVi: "Speech giải thích hợp nhất phòng ban, bài nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "みなさん、今日は大事な話があります。率直にお伝えします。\n\n【何が変わるか】\n営業一課と営業二課を統合し、来月から「営業部」として一つのチームになります。\n\n【何が変わらないか — 一番大事なこと】\n・全員の雇用は維持されます。リストラはありません。\n・現在の給与・待遇は変わりません。\n・担当顧客は原則そのまま。\n\n【新体制】\n・部門長：私\n・課長：鈴木さん（全体統括）\n・アドバイザー：山田さん（経験を活かした後進育成）\n\n【なぜ統合するか】\n①市場の変化に対応するスピードを上げるため\n②2つに分かれていた知見を共有し、全員が成長するため\n③お客様に一貫したサービスを提供するため\n\n不安なことは何でも聞いてください。個別面談も来週全員と行います。質問ある方？", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "変わること→変わらないこと（安心材料先）→理由→フォロー。完璧。", consequenceVi: "Thay đổi → Không đổi (an tâm trước) → Lý do → Follow-up. Hoàn hảo.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "統合します。詳細は追ってメールで。質問は個別に。以上。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 25, politenessScore: 35, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "不安を残す伝え方。噂が広がり混乱する。", consequenceVi: "Để lại lo lắng. Tin đồn lan → hỗn loạn.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "統合で効率が上がるので、成果を出せない人は厳しくなると思ってください。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 40, politenessScore: 15, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "不安を煽る脅し。統合初日で士気崩壊。", consequenceVi: "Đe dọa gây lo lắng. Tinh thần sụp đổ ngay ngày đầu.", affectedNpcSlug: "nakamura_hr", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "実は私もよく分かっていないんですが、社長の決定なので…一緒に頑張りましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 15, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "リーダーが理解していないものを説明するのは不誠実。", consequenceVi: "Leader không hiểu mà giải thích = thiếu thành thật.", affectedNpcSlug: "suzuki_kakaricho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { meeting: 8, nuance: 7, keigo: 4 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 12 }, { npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "culture-change-initiative", ja: "企業文化変革の推進", vi: "Thúc đẩy thay đổi văn hóa doanh nghiệp", order: 3, boss: false,
      briefing: { briefingJa: "「挑戦する文化」を定着させるための施策を立案し実行します。", briefingVi: "Lập và triển khai biện pháp định hình 'văn hóa thử thách'.", yourRoleVi: "部長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_culture_01", scenarioType: "meeting", titleJa: "文化変革プログラムの提案", titleVi: "Đề xuất chương trình thay đổi văn hóa",
        contextSummaryVi: "Hiện tại: nhân viên sợ thất bại, ít đề xuất mới, 'im lặng là vàng'. Mục tiêu: tạo môi trường thử thách, chấp nhận thất bại học hỏi.",
        goalJa: "具体的な仕組みで文化を変える計画を提示する。", goalVi: "Trình bày kế hoạch thay đổi văn hóa bằng cơ chế cụ thể.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "sponsor" }, { npcSlug: "nakamura_hr", roleInScene: "executor" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "挑戦する社風を作りたい。具体的に何をすべきか提案してくれ。" }] },
        question: { id: "q_culture_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "「挑戦する文化」を定着させる施策として最も効果的なものは？",
          promptVi: "Biện pháp nào hiệu quả nhất để định hình 'văn hóa thử thách'?",
          options: [
            { optionKey: "A", textJa: "社長、文化は「仕組み」で変わります。スローガンでは変わりません。\n\n【Phase1: 安全な失敗の許容 — 最初の3ヶ月】\n①「チャレンジ予算」：各課年100万、失敗OK。結果でなく学びをレビュー\n②「失敗共有会」：月1。失敗から学んだことを発表→拍手で終わる\n③評価基準変更：「挑戦回数」を評価項目に追加（中村さんと連携）\n\n【Phase2: 成功体験の創出 — 3-6ヶ月】\n④小さなイノベーション表彰：月間ベストチャレンジ賞（結果問わず）\n⑤「10%ルール」：業務時間の10%を新しいことに使っていい\n⑥メンター制度：挑戦する若手×経験者のペア\n\n【Phase3: 文化の定着 — 6-12ヶ月】\n⑦採用基準に「挑戦マインド」を追加\n⑧マネージャー研修：「部下の失敗を怒らない」ワークショップ\n⑨KPI：部門ごとのチャレンジ件数→可視化\n\n半年後に文化変容度をサーベイで測定します。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 96, politenessScore: 88, businessRiskDelta: -10, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "仕組み→段階的→測定可能。文化変革のプロ。", consequenceVi: "Cơ chế → Từng bước → Đo lường được. Chuyên gia thay đổi văn hóa.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "全社員に「挑戦しよう！」というメールを送りましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "メールで文化は変わらない。行動変容の仕組みがない。", consequenceVi: "Email không thay đổi văn hóa. Thiếu cơ chế thay đổi hành vi.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "挑戦しない人を厳しく評価すればいいと思います。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 30, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "恐怖で文化は作れない。表面的な挑戦（リスクなし）が増えるだけ。", consequenceVi: "Không thể tạo văn hóa bằng nỗi sợ. Chỉ tăng thử thách hình thức.", affectedNpcSlug: "nakamura_hr", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "Googleの20%ルールを真似しましょう。有名ですし。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 40, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "単なる模倣。自社の状況に合わせた設計が必要。", consequenceVi: "Chỉ bắt chước. Cần thiết kế phù hợp tình hình mình.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { meeting: 8, nuance: 6, chart: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }, { npcSlug: "nakamura_hr", delta: 12 }] },
    },
    {
      slug: "boss-turnaround-division", ja: "【難関】赤字部門の建て直し", vi: "【Boss】Vực dậy bộ phận thua lỗ", order: 4, boss: true,
      briefing: { briefingJa: "赤字が3年続く事業部を任された。6ヶ月で黒字転換または撤退判断を求められています。", briefingVi: "Được giao bộ phận lỗ 3 năm. 6 tháng để chuyển lời hoặc quyết định rút.", yourRoleVi: "部長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_turnaround_div_01", scenarioType: "report_chart", titleJa: "赤字事業部の建て直し計画", titleVi: "Kế hoạch vực dậy bộ phận thua lỗ",
        contextSummaryVi: "3 năm lỗ liên tục: -3000 man, -2500 man, -2000 man. Nhân sự: 15 người. Sản phẩm: cũ nhưng có khách trung thành. CEO cho 6 tháng.",
        goalJa: "データに基づく再生計画を立て、6ヶ月のマイルストーンを示す。", goalVi: "Kế hoạch tái sinh dựa trên dữ liệu, milestone 6 tháng.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "decision-maker" }, { npcSlug: "ogawa_finance", roleInScene: "evaluator" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "6ヶ月で答えを出してくれ。黒字化か、撤退か。君に任せる。" }] },
        question: { id: "q_turnaround_div_01", skillTag: "chart", difficulty: "hard",
          promptJa: "赤字事業部の6ヶ月建て直し計画として最も適切なものは？",
          promptVi: "Kế hoạch 6 tháng vực dậy bộ phận lỗ, phương án nào đúng nhất?",
          options: [
            { optionKey: "A", textJa: "【赤字事業部 再生計画 — 6ヶ月ロードマップ】\n\n■ 現状診断：\n赤字推移：-3000万→-2500万→-2000万（改善傾向あり）\nBEP分析：月売上あと500万/月で黒字化（=年6000万増）\n\n■ 強み：既存顧客のロイヤリティ高い（解約率3%/年）\n■ 弱み：新規営業ゼロ/製品アップデート2年停止\n\n■ 6ヶ月計画：\n\n【Month 1-2: 止血】\n①コスト15%削減（外注見直し・不要サブスク解約）：月200万削減\n②価格改定：付加価値サービスを追加して既存顧客に10%値上げ\n③リストラなし。ただし兼務解消で本業集中\n\n【Month 3-4: 攻め】\n④既存顧客へのアップセル（隣接サービス提案）：月300万見込み\n⑤製品ミニアップデート（最小投資で最大改善）\n⑥紹介プログラム：既存顧客→新規1社紹介で手数料\n\n【Month 5-6: 判断】\n⑦BEP達成見込みか月次で判定\n⑧達成→継続＆成長投資の稟議\n⑨未達→撤退シナリオ（顧客引き継ぎ先・人材再配置計画）\n\n■ 判断基準：Month4末時点で赤字50%削減されていなければ撤退勧告\n■ 投資要求：なし（既存リソース内で実行）\n\n月次で社長に進捗報告いたします。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 88, businessRiskDelta: -15, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "診断→強み/弱み→段階的計画→明確な判断基準→投資不要。経営者の信頼を得る計画。", consequenceVi: "Chẩn đoán → Mạnh/Yếu → Kế hoạch từng bước → Tiêu chí rõ → Không cần đầu tư. Kế hoạch đáng tin.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "全員の給与を20%カットして、必死で営業させます。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 20, businessRiskDelta: 15, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "士気崩壊→退職ラッシュ→さらに悪化。負のスパイラル。", consequenceVi: "Tinh thần sụp → Nghỉ hàng loạt → Tệ hơn. Vòng xoáy âm.", affectedNpcSlug: "nakamura_hr", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "6ヶ月は短すぎます。2年ください。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "3年赤字の上に2年追加は経営的に許容されない。", consequenceVi: "3 năm lỗ + 2 năm nữa = không thể chấp nhận về kinh doanh.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "もう撤退すべきです。傷が浅いうちに。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "分析前の撤退判断は早計。改善傾向を無視。", consequenceVi: "Quyết rút trước khi phân tích = quá vội. Bỏ qua xu hướng cải thiện.", affectedNpcSlug: "ogawa_finance", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 58, skillGains: { chart: 10, meeting: 8, nuance: 6, written: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 20 }, { npcSlug: "ogawa_finance", delta: 12 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "投資不要で再生プランを出してくるとは。君に任せて正解だった。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.organizational-change: 4 chapters");

  /* ═══ Arc 20: ステークホルダー管理 ═════════════════════════════════════ */
  const arc20Id = await upsertArc(client, {
    slug: "arc.stakeholder-management", ja: "ステークホルダー管理", vi: "Quản lý các bên liên quan",
    rank: "R7", order: 20,
    story: { synopsisVi: "部長 phải cân bằng lợi ích nhiều bên: cổ đông, nhân viên, khách hàng, đối tác, cộng đồng.", npcSlugs: ["ito_shachou", "miller_vp", "takahashi_clienthq", "nakamura_hr"], artAccent: "#065F46" },
  });

  await upsertChapters(client, arc20Id, [
    {
      slug: "investor-communication", ja: "投資家・株主とのコミュニケーション", vi: "Giao tiếp với nhà đầu tư/cổ đông", order: 1, boss: false,
      briefing: { briefingJa: "四半期決算説明で機関投資家からの厳しい質問。適切に回答します。", briefingVi: "Báo cáo quý gặp câu hỏi khó từ nhà đầu tư. Trả lời phù hợp.", yourRoleVi: "部長（あなた）— IR担当", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_investor_01", scenarioType: "meeting", titleJa: "四半期決算の投資家質問", titleVi: "Câu hỏi nhà đầu tư tại báo cáo quý",
        contextSummaryVi: "Doanh thu tăng 15% nhưng lợi nhuận giảm 5% (do đầu tư DX). Nhà đầu tư hỏi: 'Tại sao đầu tư thêm khi lợi nhuận giảm?'",
        goalJa: "短期の利益減を長期戦略の文脈で説明し、投資家の信頼を維持。", goalVi: "Giải thích giảm lợi nhuận ngắn hạn trong bối cảnh chiến lược dài hạn.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "presenter" }],
        payload: { meetingTranscript: [{ speaker: "投資家", lineJa: "売上は伸びているが利益率が下がっている。DX投資の効果はいつ出るのか？" }] },
        question: { id: "q_investor_01", skillTag: "chart", difficulty: "hard",
          promptJa: "投資家の「DX投資効果」質問に対する最も適切な回答は？",
          promptVi: "Câu hỏi 'hiệu quả đầu tư DX' từ nhà đầu tư, trả lời đúng nhất?",
          options: [
            { optionKey: "A", textJa: "ご質問ありがとうございます。\n\n【現状】営業利益率：前年12%→今期11.4%（-0.6pt）\n投資額：DXに3,000万円（一時費用）\n\n【投資効果の時間軸】\n・Phase1効果（既に出始め）：ペーパーレス化で月160万/年1,920万のコスト削減\n・Phase2効果（来期Q2）：CRM導入による営業効率+30%→売上増見込み5,000万\n・Phase3効果（来期Q4）：データ分析による顧客単価向上+15%\n\n【ROI】\n投資3,000万→2年間累計効果1.2億（ROI 4倍）\n来期Q3に利益率は回復＆向上予定（目標13%）\n\n【同業比較】\nDX投資比率：当社5%、業界平均3%（先行投資型）\nDX未投資の競合：売上横ばい→当社との差は拡大中\n\n短期的な利益率低下は、3年後に業界トップシェアを取るための投資フェーズとご理解ください。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 96, politenessScore: 90, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "数字→時間軸→ROI→業界比較。投資家が求める情報を完璧に提供。", consequenceVi: "Số liệu → Timeline → ROI → So sánh ngành. Cung cấp hoàn hảo thông tin nhà đầu tư cần.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "DXは将来のためです。利益は後からついてきます。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 25, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "具体的なROIと時間軸がない。投資家は数字を求めている。", consequenceVi: "Thiếu ROI và timeline cụ thể. Nhà đầu tư cần con số.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "DXをやめて利益率を元に戻すこともできますが…", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 40, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "戦略に自信がないように聞こえる。投資家の信頼を失う。", consequenceVi: "Nghe như thiếu tự tin với chiến lược. Mất tin tưởng nhà đầu tư.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "その情報は開示できません。次の質問をどうぞ。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 15, politenessScore: 30, businessRiskDelta: 15, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "正当な質問への回答拒否。IR的に大問題。", consequenceVi: "Từ chối trả lời câu hỏi chính đáng. Vấn đề nghiêm trọng về IR.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 42, skillGains: { chart: 9, meeting: 6, nuance: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 15 }] },
    },
    {
      slug: "multi-stakeholder-conflict", ja: "利害関係者間の対立調整", vi: "Điều phối xung đột giữa các bên", order: 2, boss: false,
      briefing: { briefingJa: "顧客の要望（安く早く）と社員の権利（残業削減）と株主の期待（利益増）が衝突。調整します。", briefingVi: "Yêu cầu khách (rẻ+nhanh) vs quyền nhân viên (giảm OT) vs kỳ vọng cổ đông (tăng lợi nhuận). Điều phối.", yourRoleVi: "部長（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_multistake_01", scenarioType: "meeting", titleJa: "三者の利害調整会議", titleVi: "Họp điều phối lợi ích 3 bên",
        contextSummaryVi: "Takahashi: giảm giá 15%. Nhân viên: đã OT max, không thể tăng sản lượng. Cổ đông: margin phải giữ. Bạn phải tìm lời giải.",
        goalJa: "全てを満たす解ではなく、全てが受け入れられる着地点を見つける。", goalVi: "Không phải thỏa mãn tất cả, mà tìm điểm tất cả chấp nhận được.",
        characters: [{ npcSlug: "takahashi_clienthq", roleInScene: "customer-demand" }, { npcSlug: "nakamura_hr", roleInScene: "employee-rep" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "社内で対策会議。全てのステークホルダーを満足させる方法を模索中。" }] },
        question: { id: "q_multistake_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "顧客・社員・株主の三方のニーズを調整する最も適切なアプローチは？",
          promptVi: "Điều phối nhu cầu khách-nhân viên-cổ đông, cách nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "全員が100%満足する解はありません。ただし、全員が80%満足する解は作れます。\n\n【顧客（高橋部長）への提案】\n・値引き15%→7%値引き＋付加サービス（月次レポート提供、優先対応権）\n・実質的な価値は15%以上。「安さ」ではなく「投資対効果」で説得\n\n【社員への対応】\n・残業は増やさない（労務リスク回避）\n・代わりに：業務プロセスの自動化で1人あたり週5時間を創出\n・創出時間を高橋案件のサービス品質向上に振り向け\n\n【株主（利益率維持）】\n・7%値引き→自動化コスト削減5%で実質影響-2%のみ\n・付加サービスの単価利益率は高い（人件費追加なし）\n・顧客維持＝LTV維持→長期的に株主価値向上\n\n【全体最適】\n投資：自動化ツール200万\n効果：顧客維持（年間取引額2億）＋残業削減＋利益率微減（-2%）で済む\n\nPerfectではなく、sustainable（持続可能）な解を選びます。", isCorrect: true, outcome: { trustDelta: 18, clarityScore: 95, politenessScore: 88, businessRiskDelta: -12, satisfactionDelta: 18, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "100%→80%の現実的着地→各ステークホルダーに具体案→全体最適。部長の仕事。", consequenceVi: "100%→80% thực tế → Phương án cụ thể mỗi bên → Tối ưu toàn cục. Công việc 部長.", affectedNpcSlug: "takahashi_clienthq", errorType: null } },
            { optionKey: "B", textJa: "顧客最優先。15%値引き。社員には残業で対応してもらう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 45, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社員を犠牲にする解は持続不可能。離職→品質低下→顧客離脱。", consequenceVi: "Giải pháp hy sinh nhân viên không bền. Nghỉ việc → Chất lượng giảm → Mất khách.", affectedNpcSlug: "nakamura_hr", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "利益率を守る。値引きは一切しない。顧客には品質で勝負と伝える。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 50, businessRiskDelta: 10, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "顧客ニーズを無視すると取引終了リスク。一面的。", consequenceVi: "Bỏ qua nhu cầu khách = rủi ro mất giao dịch. Một chiều.", affectedNpcSlug: "takahashi_clienthq", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "難しい問題ですね…社長に判断を仰ぎましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "部長がこのレベルの判断ができないのは役不足。", consequenceVi: "部長 không quyết được ở mức này = chưa đủ năng lực.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 45, skillGains: { nuance: 9, meeting: 7, chart: 5, customer: 4 }, npcTrustGains: [{ npcSlug: "takahashi_clienthq", delta: 12 }, { npcSlug: "nakamura_hr", delta: 12 }] },
    },
    {
      slug: "media-crisis-response", ja: "メディア対応・広報危機", vi: "Xử lý truyền thông/khủng hoảng PR", order: 3, boss: false,
      briefing: { briefingJa: "SNSで自社製品の問題が拡散。メディアからの問い合わせに対応します。", briefingVi: "Vấn đề sản phẩm lan trên SNS. Trả lời báo chí.", yourRoleVi: "部長（あなた）", estimatedMinutes: 7 },
      scenario: { scenarios: [{ id: "sc_media_01", scenarioType: "email", titleJa: "メディア向けプレスリリース", titleVi: "Thông cáo báo chí",
        contextSummaryVi: "Tweet viral (5000 RT): 'Sản phẩm Mirai bị lỗi, công ty im lặng'. Thực tế: lỗi nhỏ ảnh hưởng 0.5% sản phẩm, đã fix. Cần phản hồi trong 3 giờ.",
        goalJa: "事実を明確にし、過剰反応せず、信頼を回復する声明を出す。", goalVi: "Nêu rõ sự thật, không phản ứng thái quá, phát đi tuyên bố khôi phục niềm tin.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "approver" }],
        payload: { emailThread: [{ from: "広報", to: "あなた", subjectJa: "【至急】SNS拡散への対応案確認", bodyJa: "3時間以内にプレスリリースが必要です。案を作ってください。", timestamp: "2026-08-10T14:00:00Z" }] },
        question: { id: "q_media_01", skillTag: "written", difficulty: "hard",
          promptJa: "SNS拡散に対するプレスリリースとして最も適切なものはどれですか？",
          promptVi: "Thông cáo báo chí cho SNS viral, bản nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "【プレスリリース】\nミライ商事株式会社\n2026年8月10日\n\n当社製品に関するSNS上のご指摘について\n\n平素より当社製品をご愛用いただき、誠にありがとうございます。\n\nSNS上でご指摘いただいた件について、事実関係と対応をご報告いたします。\n\n■ 事実：\n2026年6月製造ロットの一部（全体の0.5%、約200個）に軽微な不具合が確認されました。安全性に影響はございません。\n\n■ 既に実施済みの対応：\n①該当ロットの出荷停止（7月15日実施済み）\n②購入されたお客様への個別連絡と無償交換（7月20日〜実施中）\n③製造ラインの改善完了（8月1日）\n\n■ お客様へ：\n対象製品をお持ちのお客様は、お手数ですが下記窓口にご連絡ください。\n即日交換対応いたします。\n\nSNS上での情報発信が遅れ、お客様にご心配をおかけしたことを深くお詫び申し上げます。\n今後は問題発覚時の情報開示スピードを改善いたします。\n\n代表取締役社長 伊藤\n\n【お問い合わせ窓口】0120-XXX-XXX（9:00-21:00）", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "事実→既対応→連絡先→お詫び→改善。誠実で過不足ない。", consequenceVi: "Sự thật → Đã xử lý → Liên hệ → Xin lỗi → Cải thiện. Thành thật, vừa đủ.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "SNSの情報は事実と異なります。当社製品に問題はありません。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 30, politenessScore: 30, businessRiskDelta: 20, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "事実を否定。証拠が出た瞬間にブランド崩壊。", consequenceVi: "Phủ nhận sự thật. Khi bằng chứng lộ = thương hiệu sụp.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "（沈黙。何も発表しない）", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 0, politenessScore: 0, businessRiskDelta: 15, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "沈黙は最悪。「隠蔽」と解釈される。", consequenceVi: "Im lặng là tệ nhất. Sẽ bị hiểu là 'che giấu'.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "全製品を自主回収します。安全のため。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 60, businessRiskDelta: 18, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "0.5%の問題で全品回収は過剰反応。株価暴落リスク。", consequenceVi: "Lỗi 0.5% mà thu hồi toàn bộ là phản ứng thái quá. Rủi ro giá cổ phiếu.", affectedNpcSlug: "ogawa_finance", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { written: 8, nuance: 7, meeting: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 12 }] },
    },
    {
      slug: "boss-board-presentation", ja: "【難関】取締役会での戦略プレゼン", vi: "【Boss】Thuyết trình chiến lược trước HĐQT", order: 4, boss: true,
      briefing: { briefingJa: "取締役会で3年中期経営計画を発表。社外取締役4名を含む経営陣全員を説得します。", briefingVi: "Trình bày kế hoạch kinh doanh trung hạn 3 năm trước HĐQT. Thuyết phục tất cả, kể cả 4 QT bên ngoài.", yourRoleVi: "部長（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_boardpres_01", scenarioType: "meeting", titleJa: "取締役会戦略プレゼン", titleVi: "Thuyết trình chiến lược trước HĐQT",
        contextSummaryVi: "Kế hoạch 3 năm: doanh thu gấp đôi (10 tỷ → 20 tỷ), qua 3 trụ: (1) DX, (2) global, (3) M&A. QT tài chính hỏi: 'Quá tham vọng. Rủi ro?'",
        goalJa: "野心的かつ現実的。質問を予期し、データで回答する。", goalVi: "Tham vọng nhưng thực tế. Dự đoán câu hỏi, trả lời bằng data.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "chairman" }, { npcSlug: "ogawa_finance", roleInScene: "cfo-perspective" }],
        payload: { meetingTranscript: [{ speaker: "社外取締役（財務）", lineJa: "売上倍増は野心的すぎませんか？失敗したら会社が傾く規模の投資ですが。" }] },
        question: { id: "q_boardpres_01", skillTag: "chart", difficulty: "hard",
          promptJa: "「野心的すぎる」という社外取締役の指摘に対する最も適切な回答は？",
          promptVi: "QT bên ngoài nói 'quá tham vọng'. Trả lời phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "ご指摘ありがとうございます。まさにそのリスク管理を中心に設計しています。\n\n【なぜ倍増が必要か — やらないリスク】\n・業界再編期：3年後には上位5社に集約される予想\n・現規模維持＝市場シェア低下＝買収対象になるリスク\n・「現状維持」が最大のリスクという認識です\n\n【3本柱の独立性（ポートフォリオ設計）】\n①DX（確実性：高）：既存事業の効率化。投資3億→3年で4億回収\n②Global（確実性：中）：パートナー活用で初期リスク極小化\n③M&A（確実性：低）：実行は2年目以降。条件合わなければ見送り\n\n→3本中2本成功で1.7倍。1本でも1.4倍。全滅しても元の規模は維持\n\n【段階的投資ゲート】\n各Phaseに「Go/No-Go」判断ポイント。総投資の70%は成果確認後に実行\n\n【撤退基準（明確に設定済み）】\n各事業：2四半期連続で計画比70%未満→縮小or撤退\n\n野心的な目標を、保守的な実行計画で追う。これが当社のアプローチです。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 90, businessRiskDelta: -15, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "やらないリスク→ポートフォリオ→段階ゲート→撤退基準。完璧なリスクマネジメント。", consequenceVi: "Rủi ro không làm → Portfolio → Stage gate → Exit criteria. Quản lý rủi ro hoàn hảo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "社長が決めた目標なので、やるしかありません。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 20, politenessScore: 40, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "取締役会でのガバナンスを無視した発言。社外取締役の存在意義を否定。", consequenceVi: "Phát biểu bỏ qua governance của HĐQT. Phủ nhận ý nghĩa QT bên ngoài.", affectedNpcSlug: "ogawa_finance", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "ご不安であれば目標を1.5倍に下げましょうか？", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 55, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "質問されて即座に目標を下げるのは自信のなさの表れ。", consequenceVi: "Bị hỏi liền hạ mục tiêu = thể hiện thiếu tự tin.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "他社も同様の成長目標を掲げていますので問題ありません。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "他社がやっている≠自社でできる。リスク分析がない。", consequenceVi: "Người khác làm ≠ mình làm được. Thiếu phân tích rủi ro.", affectedNpcSlug: "ogawa_finance", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 60, skillGains: { chart: 10, meeting: 9, nuance: 7, written: 4 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 20 }, { npcSlug: "ogawa_finance", delta: 15 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "社外取締役を完全に説得した。次期経営幹部として正式に育成プログラムに入ってもらう。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.stakeholder-management: 4 chapters");
  console.log(`✓ R7 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("08-r7")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR7(client);
  await client.end();
}
