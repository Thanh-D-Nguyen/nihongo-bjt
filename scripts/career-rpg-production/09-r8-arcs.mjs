/**
 * Career RPG Production Seed — R8 グローバル幹部候補 (Global Executive Candidate)
 * 2 arcs, 8 chapters: Cross-cultural leadership + Board communication
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR8(client) {
  /* ═══ Arc 21: 異文化マネジメント ════════════════════════════════════════ */
  const arc21Id = await upsertArc(client, {
    slug: "arc.cross-cultural-leadership", ja: "異文化マネジメント", vi: "Quản lý xuyên văn hóa",
    rank: "R8", order: 21,
    story: { synopsisVi: "Cấp cao nhất: quản lý team đa quốc gia, đàm phán cấp C-level quốc tế, xây dựng chiến lược toàn cầu.", npcSlugs: ["miller_vp", "kim_partner", "watanabe_global", "ito_shachou"], artAccent: "#B91C1C" },
  });

  await upsertChapters(client, arc21Id, [
    {
      slug: "global-team-management", ja: "多国籍チームのマネジメント", vi: "Quản lý team đa quốc tịch", order: 1, boss: false,
      briefing: { briefingJa: "日米韓3拠点のバーチャルチーム（15名）を率いる。時差・文化・言語の壁を超えます。", briefingVi: "Lead virtual team 15 người ở 3 nước Nhật-Mỹ-Hàn. Vượt rào cản múi giờ, văn hóa, ngôn ngữ.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_globalteam_01", scenarioType: "meeting", titleJa: "グローバルチーム初回会議", titleVi: "Họp team toàn cầu lần đầu",
        contextSummaryVi: "Team: Nhật 7 người (consensus culture), Mỹ 5 người (individual accountability), Hàn 3 người (hierarchy-respect). Bạn cần set ground rules.",
        goalJa: "全拠点が平等に参加でき、文化差を強みに変えるチーム運営ルールを設定。", goalVi: "Thiết lập quy tắc mà tất cả đều tham gia bình đẳng, biến khác biệt văn hóa thành sức mạnh.",
        characters: [{ npcSlug: "miller_vp", roleInScene: "us-team-rep" }, { npcSlug: "kim_partner", roleInScene: "kr-team-rep" }, { npcSlug: "watanabe_global", roleInScene: "jp-team-rep" }],
        payload: { meetingTranscript: [{ speaker: "Miller VP", lineJa: "So how is this going to work? Three countries, three time zones, three languages?" }] },
        question: { id: "q_globalteam_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "多国籍チームの運営ルール設定として最も効果的なアプローチは？",
          promptVi: "Thiết lập quy tắc team đa quốc gia, cách nào hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "Great question, Miller-san. Here's my proposal for our operating model:\n\n【Communication Charter】\n①Working language: English for all-hands + local language within regional teams\n②Async-first: All decisions documented in writing (Slack/Confluence)\n③Response SLA: 24 hours for non-urgent, 4 hours for urgent (tagged)\n④No-surprise rule: Bad news travels fast. Escalate within 12 hours.\n\n【Meeting Cadence】\n・Weekly all-hands: rotating time zone (fair burden)\n  →Week 1: Asia-friendly | Week 2: US-friendly | Week 3: overlap\n・Regional standups: daily, in local time\n・Quarterly in-person: rotate Tokyo → NYC → Seoul\n\n【Decision-Making Protocol】\n・日本チームのリクエスト：重要事項は48時間の合意形成期間\n・US team request: clear owner + deadline for every action item\n・Korea team request: status updates to flow up before cross-team sharing\n→We honor each culture's process while maintaining team velocity.\n\n【Conflict Resolution】\n・Disagreement → 1:1 first → escalate to me if unresolved\n・Cultural misunderstanding → assume good intent → ask for clarification\n\n私から一つお願い：各チームの「これだけは守ってほしい」を来週までにシェアしてください。このチャーターは一緒に作るものです。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 92, businessRiskDelta: -12, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "言語→会議→意思決定→衝突解決。全文化を尊重しつつ構造化。グローバルリーダー。", consequenceVi: "Ngôn ngữ → Họp → Quyết định → Giải quyết xung đột. Tôn trọng tất cả + cấu trúc hóa. Global leader.", affectedNpcSlug: "miller_vp", errorType: null } },
            { optionKey: "B", textJa: "日本本社のルールに従ってください。日本語メインで行きます。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 35, politenessScore: 20, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "日本中心主義。海外メンバーのエンゲージメント崩壊。", consequenceVi: "Chủ nghĩa Nhật-trung tâm. Engagement member nước ngoài sụp.", affectedNpcSlug: "miller_vp", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "Let's just use common sense and be flexible. No need for rigid rules.", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 50, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "「常識」は文化によって異なる。ルールなしは混乱の元。", consequenceVi: "'Thường thức' khác nhau giữa các văn hóa. Không quy tắc = hỗn loạn.", affectedNpcSlug: "kim_partner", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "とりあえず始めて、問題が起きたら対処しましょう。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 25, politenessScore: 45, businessRiskDelta: 10, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "予防設計なし。衝突が起きてからでは遅い。", consequenceVi: "Không thiết kế phòng ngừa. Khi xung đột nổ ra sẽ quá muộn.", affectedNpcSlug: "watanabe_global", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 50, skillGains: { meeting: 10, nuance: 8, customer: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "miller_vp", delta: 15 }, { npcSlug: "kim_partner", delta: 15 }, { npcSlug: "watanabe_global", delta: 12 }] },
    },
    {
      slug: "global-strategy-formulation", ja: "グローバル戦略の立案", vi: "Lập chiến lược toàn cầu", order: 2, boss: false,
      briefing: { briefingJa: "5年後にグローバル売上比率50%を目指す中長期戦略を策定します。", briefingVi: "Lập chiến lược trung-dài hạn: 5 năm sau tỷ lệ doanh thu quốc tế = 50%.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_globalstrategy_01", scenarioType: "report_chart", titleJa: "5カ年グローバル戦略", titleVi: "Chiến lược toàn cầu 5 năm",
        contextSummaryVi: "Hiện tại: doanh thu quốc tế 10% (2 tỷ/20 tỷ). Mục tiêu 5 năm: 50% (20 tỷ/40 tỷ). Cần kế hoạch phase-by-phase.",
        goalJa: "現実的なマイルストーンと投資計画で5年の成長戦略を描く。", goalVi: "Vẽ chiến lược tăng trưởng 5 năm với milestone thực tế và kế hoạch đầu tư.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "sponsor" }],
        payload: { meetingTranscript: [{ speaker: "伊藤社長", lineJa: "グローバル50%、5年で。実現可能な計画を見せてくれ。" }] },
        question: { id: "q_globalstrategy_01", skillTag: "chart", difficulty: "hard",
          promptJa: "グローバル売上比率50%を達成するための5カ年戦略として最も適切なものは？",
          promptVi: "Chiến lược 5 năm để đạt 50% doanh thu quốc tế, phương án nào tốt nhất?",
          options: [
            { optionKey: "A", textJa: "【グローバル成長戦略 2027-2031】\n\n■ 目標：海外売上比率 10%→50%（2億→20億）\n\n■ Phase 1: Foundation（Year 1-2）\n地域：東南アジア（Kim）+ 北米（Miller）\n目標：海外売上5億（25%）\n施策：\n・既存パートナー経由の販売拡大\n・各地域にカントリーマネージャー1名配置\n・製品のローカライズ（言語・規格・認証）\n投資：3億円\n判断基準：Year 2末で3億超→Phase 2進行\n\n■ Phase 2: Expansion（Year 3-4）\n地域：+欧州（ドイツ拠点）+インド\n目標：海外売上12億（40%）\n施策：\n・欧州：M&Aで現地企業を1社買収（販路獲得）\n・インド：JV（金パートナーのネットワーク活用）\n・各拠点10-15名体制\n投資：8億円（M&A含む）\n判断基準：利益率国内と同等以上を維持\n\n■ Phase 3: Leadership（Year 5）\n地域：全拠点の統合マネジメント\n目標：海外売上20億（50%）\n施策：\n・グローバル本部設置（VP of Global Ops）\n・製品開発の現地化（各拠点で開発→本社で品質管理）\n・グローバルブランド統一\n投資：2億円\n\n■ リスクマトリクス：\n①為替→ヘッジ戦略（50%ヘッジ）\n②地政学→複数地域分散で軽減\n③人材→各フェーズで現地採用＋本社ローテーション\n④M&A失敗→代替はOrganic growth（時間延長で対応）\n\n■ 総投資：13億 / 期待リターン：年間20億の売上（ROI 1.5倍/年）", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 88, businessRiskDelta: -15, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "Phase分け→地域選定→投資→判断基準→リスク。経営戦略の教科書レベル。", consequenceVi: "Chia phase → Chọn vùng → Đầu tư → Tiêu chí → Rủi ro. Level giáo khoa chiến lược kinh doanh.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "世界中に一斉に展開します。スピードが命です。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 40, businessRiskDelta: 20, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一斉展開はリソース分散。一つも成功しないリスク。", consequenceVi: "Mở rộng đồng loạt = phân tán nguồn lực. Rủi ro không thành công cái nào.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "まずは良い製品を作れば、海外は自然についてきます。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 45, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "受動的。グローバル展開には積極的な投資と計画が必要。", consequenceVi: "Thụ động. Mở rộng quốc tế cần đầu tư và kế hoạch chủ động.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "50%は無理です。30%が現実的ラインです。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 50, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "分析前に目標を下げるのは思考放棄。", consequenceVi: "Hạ mục tiêu trước khi phân tích = từ bỏ tư duy.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { chart: 10, meeting: 7, nuance: 5, customer: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 18 }] },
    },
    {
      slug: "international-crisis", ja: "国際的危機への対応", vi: "Đối phó khủng hoảng quốc tế", order: 3, boss: false,
      briefing: { briefingJa: "海外拠点でコンプライアンス違反が発覚。国際法・現地法・本社方針の三重構造で対応します。", briefingVi: "Chi nhánh nước ngoài vi phạm compliance. Đối phó trong cấu trúc 3 tầng: luật quốc tế, luật địa phương, chính sách HQ.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_intlcrisis_01", scenarioType: "deadline", titleJa: "海外拠点のコンプライアンス違反", titleVi: "Vi phạm compliance tại chi nhánh nước ngoài",
        contextSummaryVi: "Chi nhánh Mỹ: nhân viên local bị phát hiện nhận tiền từ supplier (kickback). Luật Mỹ: FCPA áp dụng. Cần xử lý trong 48h trước khi media biết.",
        goalJa: "法的リスクを最小化し、本社・現地・当局の三方向に適切に対応。", goalVi: "Giảm thiểu rủi ro pháp lý, đối ứng đúng 3 hướng: HQ, local, cơ quan.",
        characters: [{ npcSlug: "miller_vp", roleInScene: "local-report" }, { npcSlug: "ito_shachou", roleInScene: "hq-authority" }],
        payload: { meetingTranscript: [{ speaker: "Miller VP", lineJa: "We have a problem. One of our local hires accepted kickbacks from a supplier. Potential FCPA violation. What do we do?" }] },
        question: { id: "q_intlcrisis_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "FCPA違反の疑いがある海外拠点の問題に対する最も適切な初動は？",
          promptVi: "Nghi ngờ vi phạm FCPA tại chi nhánh nước ngoài, bước đầu đúng nhất?",
          options: [
            { optionKey: "A", textJa: "Miller-san, this is serious. Here's our immediate action plan:\n\n【Hour 0-6: Contain】\n①Suspend the employee (paid leave, no termination yet — preserve rights)\n②Freeze their access to all systems immediately\n③Engage external US counsel specialized in FCPA (not our regular firm)\n④Preserve ALL communications and financial records — litigation hold\n\n【Hour 6-24: Assess】\n⑤External counsel preliminary assessment of FCPA applicability\n⑥Internal investigation scope: how widespread? Other employees?\n⑦Inform Tokyo HQ (Ito-shacho) — I'll handle this call personally\n⑧Quantify financial exposure (fines can be 2x gains from violation)\n\n【Hour 24-48: Strategy】\n⑨DOJ voluntary disclosure consideration (reduces penalties 50%+)\n⑩Remediation plan: enhanced compliance training, new approval process\n⑪Supplier relationship: terminate or restructure with audit clause\n⑫Media holding statement ready (not proactive, but prepared)\n\n【Critical rules】\n・No conversations about this without counsel present\n・Nothing in personal email or chat\n・Cooperate fully if authorities ask — do not obstruct\n\nMiller-san, contain and document. I'm on the next flight to NYC.", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 90, businessRiskDelta: -18, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "封じ込め→評価→戦略→ルール。FCPA対応の教科書。", consequenceVi: "Phong tỏa → Đánh giá → Chiến lược → Quy tắc. Giáo khoa đối phó FCPA.", affectedNpcSlug: "miller_vp", errorType: null } },
            { optionKey: "B", textJa: "Fire them immediately and let's move on. Problem solved.", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 30, businessRiskDelta: 20, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "即解雇は証拠隠滅と看做される。DOJ対応を悪化させる。", consequenceVi: "Sa thải ngay bị coi là tiêu hủy chứng cứ. Làm tệ đối ứng DOJ.", affectedNpcSlug: "miller_vp", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "これは現地の問題。Miller-san、そちらで処理してください。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 30, politenessScore: 25, businessRiskDelta: 22, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "FCPA は本社にも責任が及ぶ。「知らなかった」は通用しない。", consequenceVi: "FCPA liên đới cả HQ. 'Không biết' không được chấp nhận.", affectedNpcSlug: "ito_shachou", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "Let's keep this quiet and handle it internally without reporting.", isCorrect: false, outcome: { trustDelta: -20, clarityScore: 30, politenessScore: 20, businessRiskDelta: 30, satisfactionDelta: -20, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "隠蔽はFCPA下で刑事罰対象。会社と個人の両方が起訴される。", consequenceVi: "Che giấu = hình sự theo FCPA. Cả công ty và cá nhân bị truy tố.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { meeting: 10, nuance: 8, written: 6 }, npcTrustGains: [{ npcSlug: "miller_vp", delta: 15 }, { npcSlug: "ito_shachou", delta: 18 }] },
    },
    {
      slug: "boss-global-leadership-summit", ja: "【難関】グローバルリーダーシップサミット", vi: "【Boss】Hội nghị thượng đỉnh lãnh đạo toàn cầu", order: 4, boss: true,
      briefing: { briefingJa: "全拠点のリーダーが集まる年次サミット。3拠点の統一ビジョンを示し、全員の士気を高めます。", briefingVi: "Summit thường niên của leader tất cả chi nhánh. Đưa ra vision thống nhất, nâng tinh thần toàn bộ.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_summit_01", scenarioType: "meeting", titleJa: "年次グローバルサミット基調講演", titleVi: "Diễn văn chính tại Summit toàn cầu",
        contextSummaryVi: "50 leader từ 3 nước. Năm qua: doanh thu +40%, nhưng nhiều xung đột văn hóa, 2 người key resign. Cần acknowledge + inspire cho năm tới.",
        goalJa: "過去を認め、未来を描き、全員を一つのビジョンで結ぶ。", goalVi: "Thừa nhận quá khứ, vẽ tương lai, kết nối tất cả bằng 1 vision.",
        characters: [{ npcSlug: "miller_vp", roleInScene: "audience" }, { npcSlug: "kim_partner", roleInScene: "audience" }, { npcSlug: "watanabe_global", roleInScene: "audience" }, { npcSlug: "ito_shachou", roleInScene: "observer" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "50名のグローバルリーダーがあなたの基調講演を待っている。" }] },
        question: { id: "q_summit_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "グローバルサミットの基調講演として最も効果的なスピーチはどれですか？",
          promptVi: "Diễn văn chính tại Summit toàn cầu, bài nào hiệu quả nhất?",
          options: [
            { optionKey: "A", textJa: "Good morning everyone. おはようございます。안녕하세요。\n\nOne year ago, we sat in this room as three separate teams working toward separate goals. Today, we are one team — with one mission.\n\n【What we achieved together — 数字で語る】\n・Revenue: +40%. Not one country did this alone.\n・US team brought speed. Korea team brought precision. Japan team brought depth.\n・Together: 15 new enterprise clients across 3 continents.\n\n【What we learned — 正直に語る】\n・We lost two great people this year. That's on me. On all of us.\n・Cultural friction slowed us down in Q2. We fixed it, but it cost us.\n・Honest truth: growing fast is painful. And we chose to grow.\n\n【Where we're going — ビジョン】\nIn 3 years, I want someone in this room to be CEO of a global $100M company.\nNot because of one market. Because we built something no competitor can copy:\nA team that thinks globally but acts locally. 和×Speed×精密.\n\n【This year's theme: \"One Team, Three Strengths\"】\n①Japan: 品質の番人 — you set the standard\n②USA: Speed engine — you set the pace  \n③Korea: Growth catalyst — you open new doors\n\nNo one is better. Everyone is essential.\n\n最後に、I have one ask: when you leave this room, find one person from another country. Ask them one question you've never asked. Start there.\n\nLet's build something the world hasn't seen. Together. ありがとうございます。감사합니다。Thank you.", isCorrect: true, outcome: { trustDelta: 25, clarityScore: 98, politenessScore: 95, businessRiskDelta: -15, satisfactionDelta: 25, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "三言語→実績→反省→ビジョン→各拠点の価値→アクション。グローバルリーダーの演説。", consequenceVi: "3 ngôn ngữ → Thành tích → Phản tỉnh → Vision → Giá trị mỗi nơi → Action. Diễn văn global leader.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "今期の売上報告をします。スライド1枚目…（データの羅列）", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 40, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "サミットの基調講演でデータ報告は不適切。インスピレーションが必要。", consequenceVi: "Báo cáo data ở keynote summit không phù hợp. Cần cảm hứng.", affectedNpcSlug: "miller_vp", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "日本語で話します。通訳は後で。（全部日本語で30分スピーチ）", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 25, politenessScore: 15, businessRiskDelta: 12, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "グローバルサミットで日本語のみは排他的。リーダー失格。", consequenceVi: "Summit toàn cầu mà chỉ nói tiếng Nhật = loại trừ. Không xứng leader.", affectedNpcSlug: "miller_vp", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "来年の目標は売上倍増です。達成できない人は入れ替えます。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 15, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "恐怖で動かすのは短期的。サミットの目的は団結。", consequenceVi: "Dùng nỗi sợ chỉ hiệu quả ngắn hạn. Mục đích summit là đoàn kết.", affectedNpcSlug: "kim_partner", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 65, skillGains: { meeting: 12, nuance: 10, customer: 6, keigo: 5 }, npcTrustGains: [{ npcSlug: "miller_vp", delta: 20 }, { npcSlug: "kim_partner", delta: 20 }, { npcSlug: "watanabe_global", delta: 18 }, { npcSlug: "ito_shachou", delta: 20 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "50人が立ち上がって拍手した。これが真のリーダーだ。後任は君に決めた。", sentiment: "positive" }, { npcSlug: "miller_vp", quoteJa: "Best leadership speech I've heard in 20 years. I'm proud to be on this team.", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.cross-cultural-leadership: 4 chapters");

  /* ═══ Arc 22: 役員会コミュニケーション ══════════════════════════════════ */
  const arc22Id = await upsertArc(client, {
    slug: "arc.board-communication", ja: "役員会コミュニケーション", vi: "Giao tiếp cấp hội đồng quản trị",
    rank: "R8", order: 22,
    story: { synopsisVi: "Đỉnh cao career: giao tiếp ở cấp board of directors, ra quyết định ảnh hưởng toàn công ty, mentor thế hệ tiếp theo.", npcSlugs: ["ito_shachou", "ogawa_finance", "nakamura_hr", "miller_vp"], artAccent: "#1E3A5F" },
  });

  await upsertChapters(client, arc22Id, [
    {
      slug: "board-succession-planning", ja: "後継者計画のプレゼン", vi: "Thuyết trình kế hoạch kế nhiệm", order: 1, boss: false,
      briefing: { briefingJa: "取締役会で自社の後継者計画を提案。CEOの伊藤社長を含む幹部の世代交代を設計します。", briefingVi: "Đề xuất succession plan trước HĐQT. Thiết kế chuyển giao thế hệ bao gồm CEO Ito.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_succession_01", scenarioType: "report_chart", titleJa: "後継者計画の策定", titleVi: "Lập kế hoạch kế nhiệm",
        contextSummaryVi: "Ito 62 tuổi, dự kiến nghỉ hưu 5 năm nữa. HĐQT yêu cầu succession plan cho CEO + 3 vị trí C-level. Bạn được giao thiết kế.",
        goalJa: "客観的かつ体系的な後継者計画を提示し、取締役会の承認を得る。", goalVi: "Trình bày succession plan khách quan, có hệ thống, được HĐQT phê duyệt.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "subject" }, { npcSlug: "nakamura_hr", roleInScene: "co-designer" }],
        payload: { meetingTranscript: [{ speaker: "社外取締役", lineJa: "5年以内にトップの世代交代が必要。計画を聞かせてください。" }] },
        question: { id: "q_succession_01", skillTag: "chart", difficulty: "hard",
          promptJa: "後継者計画として取締役会に提示する最も適切な内容はどれですか？",
          promptVi: "Succession plan trình HĐQT, nội dung nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "【後継者計画 — Executive Succession Framework】\n\n■ 対象ポジション：\nCEO（伊藤社長）/ CFO（小川）/ CHRO / CGO（新設：Global Officer）\n\n■ Timeline：\nYear 1-2: 候補者特定＆育成開始\nYear 3-4: 段階的権限移譲＆実績評価\nYear 5: 正式交代＆移行期間（6ヶ月overlap）\n\n■ CEO後継者評価基準：\n①事業成果（P&L責任経験）\n②グローバルリーダーシップ（多拠点管理実績）\n③組織構築力（ゼロ→イチの経験）\n④人望とカルチャーフィット（360度評価）\n⑤外部ネットワーク（業界影響力）\n\n■ 候補者パイプライン（各ポジション2-3名）：\n・内部候補：anonymized scorecard（評価基準×5項目）\n・外部候補：必要に応じてエグゼクティブサーチ併用\n\n■ 育成プログラム：\n・Executive MBA/外部ボード経験\n・他部門ローテーション（1年）\n・社長直轄プロジェクト2件以上\n・メンター：社外取締役1名＋外部エグゼクティブコーチ\n\n■ リスク対策：\n・緊急時承継：各ポジションに暫定代行者を今日指名\n・Key-person保険の見直し\n\n■ ガバナンス：\n・指名委員会で半期ごとにレビュー\n・候補者本人には2年目にintent通知\n\n中村（人事）と連携し、来月中に候補者面談を開始します。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 98, politenessScore: 90, businessRiskDelta: -15, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "対象→Timeline→基準→パイプライン→育成→リスク→ガバナンス。完璧なSuccession Plan。", consequenceVi: "Đối tượng → Timeline → Tiêu chí → Pipeline → Đào tạo → Risk → Governance. Succession Plan hoàn hảo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "社長の後任は私が適任だと思います。理由は…", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 30, politenessScore: 15, businessRiskDelta: 12, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "自薦は取締役会で不適切。客観的な計画が求められている。", consequenceVi: "Tự tiến cử tại HĐQT không phù hợp. Cần kế hoạch khách quan.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "5年後に考えれば十分です。今は事業に集中しましょう。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 45, businessRiskDelta: 12, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "ガバナンス責任の放棄。取締役会は今の計画を求めている。", consequenceVi: "Từ bỏ trách nhiệm governance. HĐQT yêu cầu kế hoạch ngay.", affectedNpcSlug: "nakamura_hr", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "外部からCEOを招聘するのが一番です。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 35, politenessScore: 45, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "内部育成の検討なしで外部ありきは短絡的。両方の比較が必要。", consequenceVi: "Chưa xem xét đào tạo nội bộ mà chỉ muốn bên ngoài = thiển cận. Cần so sánh cả hai.", affectedNpcSlug: "ito_shachou", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { chart: 10, meeting: 8, nuance: 6 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 18 }, { npcSlug: "nakamura_hr", delta: 15 }] },
    },
    {
      slug: "ethical-dilemma", ja: "経営倫理のジレンマ", vi: "Song đề đạo đức kinh doanh", order: 2, boss: false,
      briefing: { briefingJa: "利益を取るか倫理を取るか。短期的に損でも正しい判断を下す覚悟が問われます。", briefingVi: "Lợi nhuận hay đạo đức? Bị hỏi về quyết tâm chọn đúng dù thiệt hại ngắn hạn.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_ethics_01", scenarioType: "meeting", titleJa: "利益vs倫理の経営判断", titleVi: "Quyết định kinh doanh: lợi nhuận vs đạo đức",
        contextSummaryVi: "Phát hiện: supplier chính đang dùng lao động trẻ em ở nhà máy Đông Nam Á. Cắt supplier = mất 3 tỷ doanh thu (30%). Không cắt = ESG scandal nếu lộ.",
        goalJa: "長期的な企業価値と倫理を優先し、ステークホルダーに説明可能な判断を下す。", goalVi: "Ưu tiên giá trị doanh nghiệp dài hạn và đạo đức, ra quyết định giải thích được với stakeholder.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "co-decider" }, { npcSlug: "ogawa_finance", roleInScene: "risk-assessor" }],
        payload: { meetingTranscript: [{ speaker: "小川（財務）", lineJa: "取引打ち切りなら年間3億の売上減。耐えられますが厳しい。黙っていれば分からないという選択肢も…" }] },
        question: { id: "q_ethics_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "サプライヤーの児童労働問題に対する経営判断として最も適切なものは？",
          promptVi: "Quyết định kinh doanh trước vấn đề lao động trẻ em của supplier?",
          options: [
            { optionKey: "A", textJa: "社長、これは利益の問題ではなく、会社の存在意義の問題です。\n\n【判断：取引条件付き継続 + 改善期限】\n\n①即時対応（今週）：\n・サプライヤーCEOに直接連絡。48時間以内に児童労働の停止を要求\n・第三者監査機関による現地調査を2週間以内に実施\n\n②改善猶予（90日）：\n・改善計画の提出を義務化\n・月次モニタリング（抜き打ち監査含む）\n・90日後に第三者認証取得を条件\n\n③並行してリスクヘッジ：\n・代替サプライヤー2社の評価を開始\n・6ヶ月で取引先分散を完了（30%依存→15%×2社）\n\n④90日後の判断：\n・改善確認→取引継続（監査強化）\n・改善不十分→段階的取引終了（3ヶ月で移行）\n\n⑤対外コミュニケーション：\n・ESGレポートに改善取組として開示\n・「発見→対処→改善」のストーリーとして説明\n\n「黙っていれば分からない」は最悪の選択肢です。発覚したときの損害は売上3億の比ではありません。ブランド価値の毀損、訴訟、株価暴落。\n\n正しいことを、正しい方法で。これが私たちの会社のDNAであるべきです。", isCorrect: true, outcome: { trustDelta: 22, clarityScore: 98, politenessScore: 92, businessRiskDelta: -18, satisfactionDelta: 22, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "倫理最優先→但し段階的→リスクヘッジ→開示。経営者の覚悟と知恵。", consequenceVi: "Đạo đức ưu tiên → Nhưng từng bước → Hedge rủi ro → Công khai. Quyết tâm và trí tuệ lãnh đạo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "即座に全取引を打ち切ります。児童労働は許せません。", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 50, politenessScore: 60, businessRiskDelta: 15, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "倫理的だが経営的に無計画。3億の売上を一瞬で失うのは株主への責任問題。", consequenceVi: "Đạo đức nhưng thiếu kế hoạch kinh doanh. Mất 3 tỷ đột ngột = vấn đề trách nhiệm với cổ đông.", affectedNpcSlug: "ogawa_finance", errorType: "priority_misread" } },
            { optionKey: "C", textJa: "小川さんの言う通り、黙っていれば分かりません。事業を守りましょう。", isCorrect: false, outcome: { trustDelta: -20, clarityScore: 30, politenessScore: 25, businessRiskDelta: 30, satisfactionDelta: -20, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "隠蔽は犯罪的。ESG開示義務違反。発覚すれば刑事責任。", consequenceVi: "Che giấu = tội phạm. Vi phạm nghĩa vụ ESG. Phát hiện = trách nhiệm hình sự.", affectedNpcSlug: "ito_shachou", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "「現地の文化では普通」かもしれません。調べてから判断しましょう。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 25, politenessScore: 30, businessRiskDelta: 20, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "児童労働に「文化的相対主義」は適用されない。国際法違反。", consequenceVi: "'Tương đối văn hóa' không áp dụng cho lao động trẻ em. Vi phạm luật quốc tế.", affectedNpcSlug: "ito_shachou", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 55, skillGains: { nuance: 12, meeting: 8, chart: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 20 }, { npcSlug: "ogawa_finance", delta: 10 }] },
    },
    {
      slug: "mentoring-next-gen", ja: "次世代リーダーの育成", vi: "Đào tạo thế hệ leader kế tiếp", order: 3, boss: false,
      briefing: { briefingJa: "自分の経験を次世代に伝える。メンタリングの最終形として後進に道を示します。", briefingVi: "Truyền đạt kinh nghiệm cho thế hệ kế tiếp. Hình thức mentoring cao nhất.", yourRoleVi: "グローバル幹部候補（あなた）", estimatedMinutes: 8 },
      scenario: { scenarios: [{ id: "sc_mentor_01", scenarioType: "meeting", titleJa: "次世代リーダーへのメンタリング", titleVi: "Mentoring cho leader thế hệ mới",
        contextSummaryVi: "Suzuki (tương lai 課長) hỏi: 'Để trở thành leader như anh/chị, điều quan trọng nhất là gì?'",
        goalJa: "本質的なリーダーシップの教訓を、具体的に伝える。", goalVi: "Truyền đạt bài học lãnh đạo bản chất, cụ thể.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "mentee" }],
        payload: { meetingTranscript: [{ speaker: "鈴木", lineJa: "幹部候補として見てきた中で、リーダーに一番大事なものは何ですか？" }] },
        question: { id: "q_mentor_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "次世代リーダーへのメンタリングとして最も適切な回答は？",
          promptVi: "Mentoring cho leader thế hệ mới, câu trả lời nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "鈴木さん、正直に答える。3つある。\n\n①「正直さ」が全ての土台\n・悪い報告を早くする勇気\n・分からないことを「分からない」と言える強さ\n・間違ったら「ごめん」と言える潔さ\n→これで信頼が積み上がる。信頼があれば何でもできる。なくなれば全てが崩れる。\n\n②「人」に投資する意識\n・リーダーの仕事の80%は「人の成長を助けること」\n・自分が成果を出す段階は卒業。チームが出す仕組みを作る段階へ\n・具体的に：毎週30分は部下の成長だけを考える時間を作れ\n\n③「判断の軸」を持つこと\n・毎日100の判断を迫られる。都度考えていたら持たない\n・自分の軸を言語化しておけ。私の軸は：\n 「5年後にこの判断を振り返って恥ずかしくないか？」\n 「この判断で一番影響を受ける人の顔が見えているか？」\n\n最後に一つ。完璧なリーダーはいない。私も今でも毎日失敗する。\n大事なのは「失敗した後にどう動くか」。それが人を見る時に私が一番見ているところ。\n\n鈴木さんは既にその素質がある。自信を持って。", isCorrect: true, outcome: { trustDelta: 20, clarityScore: 95, politenessScore: 95, businessRiskDelta: -5, satisfactionDelta: 20, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "正直さ→人への投資→判断の軸。抽象論でなく具体的。メンターの鑑。", consequenceVi: "Thành thật → Đầu tư vào người → Trục quyết định. Không trừu tượng mà cụ thể. Mẫu mực mentor.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "数字を出すこと。結果が全て。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 40, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "一面的。数字だけのリーダーは長続きしない。", consequenceVi: "Một chiều. Leader chỉ có con số không bền.", affectedNpcSlug: "suzuki_kakaricho", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "とにかく経験を積め。やっていれば分かる。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 15, politenessScore: 35, businessRiskDelta: 5, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "メンタリングの放棄。具体的な指針がない。", consequenceVi: "Từ bỏ mentoring. Không có chỉ dẫn cụ thể.", affectedNpcSlug: "suzuki_kakaricho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "上に気に入られること。政治力がないと上がれない。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 30, politenessScore: 20, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "政治力をリーダーシップと混同。次世代に悪影響。", consequenceVi: "Nhầm lẫn chính trị với lãnh đạo. Ảnh hưởng xấu thế hệ sau.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 45, skillGains: { nuance: 10, meeting: 6, keigo: 4 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 20 }] },
    },
    {
      slug: "boss-ceo-transition", ja: "【最終】CEO就任スピーチ", vi: "【Final Boss】Diễn văn nhậm chức CEO", order: 4, boss: true,
      briefing: { briefingJa: "伊藤社長の後を継ぎ、代表取締役に就任。全社員の前で所信表明。あなたのキャリアの集大成です。", briefingVi: "Kế nhiệm CEO Ito. Diễn văn nhậm chức trước toàn bộ công ty. Đỉnh cao career của bạn.", yourRoleVi: "新CEO（あなた）", estimatedMinutes: 15 },
      scenario: { scenarios: [{ id: "sc_ceo_01", scenarioType: "meeting", titleJa: "CEO就任所信表明", titleVi: "Diễn văn nhậm chức CEO",
        contextSummaryVi: "200 nhân viên + live stream cho 3 chi nhánh quốc tế. Từ intern R1 đến CEO R8 — hành trình hoàn tất. Cần: cảm ơn quá khứ, vision tương lai, cam kết với mọi người.",
        goalJa: "過去への感謝、未来のビジョン、全員へのコミットメントを示す。", goalVi: "Cảm ơn quá khứ, vision tương lai, cam kết với tất cả.",
        characters: [{ npcSlug: "ito_shachou", roleInScene: "predecessor" }, { npcSlug: "yamada_bucho", roleInScene: "audience" }, { npcSlug: "suzuki_kakaricho", roleInScene: "audience" }, { npcSlug: "morita_kouhai", roleInScene: "audience" }, { npcSlug: "tanaka_senpai", roleInScene: "audience" }, { npcSlug: "miller_vp", roleInScene: "global-audience" }, { npcSlug: "kim_partner", roleInScene: "global-audience" }],
        payload: { meetingTranscript: [{ speaker: "（司会）", lineJa: "それでは、新代表取締役社長より所信表明をお願いいたします。" }] },
        question: { id: "q_ceo_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "CEO就任の所信表明として最も適切なスピーチはどれですか？",
          promptVi: "Diễn văn nhậm chức CEO, bài nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "みなさん。Good morning, everyone. 안녕하세요.\n\n今日この場に立てることが、信じられない思いです。\n\n【感謝 — ここに来るまでの道】\n私がこの会社に入ったとき、名刺交換すらまともにできない新人でした。\n\n山田さんが「報連相」を手取り足取り教えてくれた。\n田中さんが隣で営業トークの見本を見せてくれた。\n森田が一緒に悩んでくれた。\n鈴木さんが私の背中を任せてくれた。\n小川さんが「数字で語れ」と鍛えてくれた。\n中村さんが「人を見ろ」と教えてくれた。\n\nそして伊藤社長。私のような若造に機会を与え続けてくれた。\n「正直に話せ」「数字で考えろ」「人を大切にしろ」\nこの3つは、私の経営の軸になります。\n\n【ビジョン — これからの会社】\n3つ約束します。\n\n①この会社を「世界で戦える会社」にする。\n5年で海外売上50%。Miller-san、Kim-san、一緒に作ろう。\n\n②この会社を「人が育つ会社」にする。\n次のCEOはこの中にいる。私がされたように、全力で機会を作る。\n\n③この会社を「誇れる会社」にする。\n利益のために正しさを捨てない。それが我々の価値だ。\n\n【約束 — 全員に】\n・悪いニュースは隠さない\n・決断の理由は必ず説明する\n・ドアは常に開いている\n\n一人では何もできません。200人の力を借りて、伊藤社長が作った会社を、もっと大きく、もっと強く、もっと優しくします。\n\nよろしくお願いいたします。\nLet's build something great together.\n감사합니다.", isCorrect: true, outcome: { trustDelta: 25, clarityScore: 98, politenessScore: 98, businessRiskDelta: -20, satisfactionDelta: 25, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "感謝（具体的に人名）→ビジョン3つ→約束3つ→謙虚さ。完璧なCEO就任演説。", consequenceVi: "Cảm ơn (nêu tên cụ thể) → 3 Vision → 3 Cam kết → Khiêm tốn. Diễn văn nhậm chức CEO hoàn hảo.", affectedNpcSlug: "ito_shachou", errorType: null } },
            { optionKey: "B", textJa: "これからは私のやり方で行きます。改革します。ついてきてください。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 35, politenessScore: 25, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "前任否定＋権威的。就任初日で不安を煽る。", consequenceVi: "Phủ nhận tiền nhiệm + độc đoán. Ngày đầu đã gây bất an.", affectedNpcSlug: "yamada_bucho", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "伊藤社長の路線を100%継続します。何も変えません。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 40, politenessScore: 60, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自分のビジョンがない。CEOとしてのリーダーシップ不足。", consequenceVi: "Không có vision riêng. Thiếu leadership ở vị trí CEO.", affectedNpcSlug: "miller_vp", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "（5分間のスピーチで売上目標と組織図だけ説明）", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 40, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "人の心に触れない就任演説。数字だけでは人はついてこない。", consequenceVi: "Diễn văn nhậm chức không chạm đến lòng người. Chỉ con số không ai theo.", affectedNpcSlug: "morita_kouhai", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 100, skillGains: { meeting: 15, nuance: 12, keigo: 10, customer: 8, chart: 5, written: 5 }, npcTrustGains: [{ npcSlug: "ito_shachou", delta: 25 }, { npcSlug: "yamada_bucho", delta: 20 }, { npcSlug: "suzuki_kakaricho", delta: 20 }, { npcSlug: "morita_kouhai", delta: 20 }, { npcSlug: "tanaka_senpai", delta: 20 }, { npcSlug: "miller_vp", delta: 20 }, { npcSlug: "kim_partner", delta: 20 }], npcReactionMontage: [{ npcSlug: "ito_shachou", quoteJa: "あの新人が…こんなに立派に。この会社を任せられる。ありがとう。", sentiment: "positive" }, { npcSlug: "yamada_bucho", quoteJa: "名前を出してくれて嬉しかった。この人について行こう。", sentiment: "positive" }, { npcSlug: "morita_kouhai", quoteJa: "僕もいつかあの場所に立ちたい。頑張ろう。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.board-communication: 4 chapters");
  console.log(`✓ R8 complete: 2 arcs, 8 chapters`);
  console.log(`\n🎉 CAREER RPG COMPLETE: R1→R8, from 内定者 to CEO.`);
}

if (process.argv[1]?.includes("09-r8")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR8(client);
  await client.end();
}
