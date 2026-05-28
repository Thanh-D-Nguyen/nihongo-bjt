/**
 * Career RPG Production Seed — R3 一般社員 (Regular Employee)
 * 3 arcs, 12 chapters: Client email + Meeting participation + Deadline management
 */
import { upsertArc, upsertChapters } from "./_helpers.mjs";

export async function seedR3(client) {
  /* ═══ Arc 6: 取引先メール ══════════════════════════════════════════════ */
  const arc6Id = await upsertArc(client, {
    slug: "arc.client-email", ja: "取引先メール", vi: "Email gửi đối tác kinh doanh",
    rank: "R3", order: 6,
    story: { synopsisVi: "Viết email chuyên nghiệp cho khách hàng bên ngoài: báo giá, theo dõi, từ chối khéo, thông báo tăng giá. Mỗi từ đều quan trọng.", npcSlugs: ["sato_kokyaku", "yamada_bucho", "tanaka_senpai"], artAccent: "#1B2A4A" },
  });

  await upsertChapters(client, arc6Id, [
    {
      slug: "first-quote-send", ja: "初めての見積もり送付", vi: "Lần đầu gửi báo giá", order: 1, boss: false,
      briefing: { briefingJa: "佐藤様に見積書を初めて送付します。添付ファイル付きメールの書き方を学びます。", briefingVi: "Gửi báo giá lần đầu cho Sato-san. Học cách viết email kèm file đính kèm.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_quote_01", scenarioType: "email", titleJa: "見積書送付メール", titleVi: "Email gửi báo giá",
        contextSummaryVi: "Sato-san yêu cầu báo giá cho 1000 sản phẩm A. Bạn đã chuẩn bị file PDF. Cần viết email đính kèm gửi đi.",
        goalJa: "添付資料の説明を明確にし、次のアクションを示すメール。", goalVi: "Email giải thích rõ tài liệu đính kèm, nêu bước tiếp theo.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "cc" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "【お見積もり】製品A 1000個の件", bodyJa: "（選ぶ）", timestamp: "2026-05-10T10:00:00Z" }] },
        question: { id: "q_quote_01", skillTag: "written", difficulty: "standard",
          promptJa: "見積書送付メールとして最も適切なものはどれですか？",
          promptVi: "Email gửi báo giá nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "東京テクノロジー株式会社\n佐藤様\n\nいつもお世話になっております。\n株式会社ミライ商事 営業部○○でございます。\n\n先日ご依頼いただきました製品A 1,000個のお見積もりを\n添付にてお送りいたします。\n\n■ 有効期限：2026年6月10日まで\n■ 納期：ご発注後2週間\n■ 備考：500個以上で5%割引適用済み\n\nご不明点がございましたら、お気軽にお問い合わせください。\nご検討のほど、よろしくお願い申し上げます。\n\n株式会社ミライ商事 営業部\n○○", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 90, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "要件・有効期限・備考が明確。プロフェッショナル。", consequenceVi: "Yêu cầu, thời hạn, ghi chú đều rõ ràng. Chuyên nghiệp.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n見積もり送ります。添付ご確認ください。\n○○", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 30, politenessScore: 40, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "あいさつ・概要説明・署名が不十分。", consequenceVi: "Thiếu chào hỏi, giải thích tổng quan, chữ ký.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "佐藤様\nいつもお世話になっております。\n見積書を添付いたしました。ご確認ください。\nよろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 50, politenessScore: 75, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "有効期限・条件の記載なし。添付だけでは親切でない。", consequenceVi: "Không ghi thời hạn, điều kiện. Chỉ nói 'xem đính kèm' thì chưa đủ.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様\nいつもお世話になっております。\n見積書をお送りします。今回は特別に大幅値引きしましたので、\n是非この機会にご発注ください！期間限定です！\n○○", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 55, politenessScore: 40, businessRiskDelta: 8, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "押し売り感が強い。ビジネスメールにふさわしくない。", consequenceVi: "Gây cảm giác ép mua. Không phù hợp email kinh doanh.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 20, skillGains: { written: 6, customer: 4 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 8 }] },
    },
    {
      slug: "follow-up-after-quote", ja: "見積もり後のフォローアップ", vi: "Theo dõi sau khi gửi báo giá", order: 2, boss: false,
      briefing: { briefingJa: "見積もりを送って3日。まだ返事がありません。フォローアップメールを送ります。", briefingVi: "3 ngày sau gửi báo giá, chưa có phản hồi. Gửi email theo dõi.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_followup_01", scenarioType: "email", titleJa: "佐藤様へのフォローアップメール", titleVi: "Email follow-up gửi Sato-san",
        contextSummaryVi: "Đã 3 ngày chưa có hồi âm. Sếp Yamada hỏi tình hình. Bạn cần follow-up mà không gây áp lực.",
        goalJa: "催促にならず、自然にフォローする。", goalVi: "Theo dõi tự nhiên, không gây áp lực.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "Re: 【お見積もり】製品A 1000個の件", bodyJa: "（選ぶ）", timestamp: "2026-05-13T10:00:00Z" }] },
        question: { id: "q_followup_01", skillTag: "written", difficulty: "standard",
          promptJa: "3日経って返信がありません。フォローアップメールとして最も適切なのは？",
          promptVi: "3 ngày chưa có phản hồi. Email follow-up nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様\n\nいつもお世話になっております。\n先日お送りしましたお見積もりの件、ご確認いただけましたでしょうか。\n\nもしご不明点やご要望がございましたら、遠慮なくお申し付けください。\n条件面での調整も可能でございますので、お気軽にご相談いただければ幸いです。\n\nお忙しいところ恐れ入りますが、ご検討のほどよろしくお願いいたします。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 88, politenessScore: 92, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "押しつけがましくなく、相手への配慮がある。", consequenceVi: "Không ép buộc, thể hiện sự chu đáo với đối phương.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n見積もりの返事まだでしょうか？有効期限がありますので早めにお願いします。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 60, politenessScore: 25, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "催促・プレッシャーが強すぎます。", consequenceVi: "Quá giục giã, gây áp lực lớn.", affectedNpcSlug: "sato_kokyaku", errorType: "implied_meaning_error" } },
            { optionKey: "C", textJa: "佐藤様\nお世話になっております。その後いかがでしょうか。\nよろしくお願いいたします。", isCorrect: false, outcome: { trustDelta: -2, clarityScore: 35, politenessScore: 70, businessRiskDelta: 3, satisfactionDelta: -3, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "何の件か不明確。件名だけが頼り。本文で触れましょう。", consequenceVi: "Không rõ việc gì. Cần nhắc lại nội dung trong body.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様\nお見積もりの件、ご回答期限を過ぎておりますので、一旦この案件はクローズとさせていただきます。再度ご検討の際はお申し付けください。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 70, politenessScore: 45, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "3日で勝手にクローズは非常識。関係が悪化します。", consequenceVi: "3 ngày đã tự đóng hồ sơ là vô lý. Phá hỏng quan hệ.", affectedNpcSlug: "sato_kokyaku", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { written: 5, customer: 5, nuance: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 10 }] },
    },
    {
      slug: "polite-decline", ja: "丁寧な断り方", vi: "Cách từ chối lịch sự", order: 3, boss: false,
      briefing: { briefingJa: "佐藤様から無理な納期短縮を依頼されました。丁寧に断りながら代替案を提示します。", briefingVi: "Sato-san yêu cầu rút ngắn deadline bất khả thi. Từ chối lịch sự và đưa phương án thay thế.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_decline_01", scenarioType: "email", titleJa: "納期短縮を断るメール", titleVi: "Email từ chối rút ngắn deadline",
        contextSummaryVi: "Sato-san muốn giao hàng trong 3 ngày (bình thường 14 ngày). Không thể đáp ứng. Cần từ chối khéo + đưa lựa chọn.",
        goalJa: "相手の要望を尊重しつつ、できない理由と代替案を示す。", goalVi: "Tôn trọng yêu cầu, giải thích lý do không thể, đưa phương án thay thế.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "佐藤 様", to: "あなた", subjectJa: "納期のご相談", bodyJa: "急ぎの案件が入り、3日以内に納品いただけないでしょうか。", timestamp: "2026-05-15T09:00:00Z" }] },
        question: { id: "q_decline_01", skillTag: "customer", difficulty: "standard",
          promptJa: "3日納期の依頼を断る際、最も適切なメールはどれですか？",
          promptVi: "Khi từ chối yêu cầu giao trong 3 ngày, email nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様\n\nいつもお世話になっております。\nご連絡ありがとうございます。ご事情、承知いたしました。\n\n誠に恐れ入りますが、3日以内の納品は製造工程上、対応が難しい状況でございます。\n\nつきましては、下記の代替案をご提案させていただきます。\n①一部（200個）を5日後に先行納品＋残り800個を10日後\n②全量を7日後に特急対応（追加費用5%）\n\nご都合に合わせて調整いたしますので、ご検討いただけますと幸いです。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 92, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "理解→理由→代替案の流れが完璧。相手も選びやすい。", consequenceVi: "Hiểu → Lý do → Phương án thay thế. Hoàn hảo, khách dễ chọn.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n3日は無理です。通常通り14日でお願いします。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 50, politenessScore: 20, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "ぶっきらぼう。相手の事情への配慮ゼロ。", consequenceVi: "Cộc lốc. Không quan tâm hoàn cảnh đối phương.", affectedNpcSlug: "sato_kokyaku", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "佐藤様\n承知いたしました。3日で対応いたします。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 60, politenessScore: 80, businessRiskDelta: 20, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "できないことを引き受けるのは最悪の対応。後で信頼を失います。", consequenceVi: "Nhận việc không thể làm là tồi tệ nhất. Sau này mất uy tín.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "D", textJa: "佐藤様\n申し訳ございませんが、3日は対応できかねます。\nご了承くださいますようお願い申し上げます。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 55, politenessScore: 75, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "断るだけで代替案なし。相手は困ったままです。", consequenceVi: "Chỉ từ chối mà không đưa phương án thay thế. Khách vẫn bế tắc.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 24, skillGains: { customer: 6, written: 4, nuance: 4 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 10 }] },
    },
    {
      slug: "boss-price-increase", ja: "【難関】値上げ通知メール", vi: "【Boss】Email thông báo tăng giá", order: 4, boss: true,
      briefing: { briefingJa: "原材料高騰により、来月から全商品10%値上げ。既存顧客への通知メールを書きます。最も難しいビジネスメールの一つ。", briefingVi: "Nguyên liệu tăng, tháng sau tăng giá 10% toàn bộ. Viết email thông báo cho khách hàng hiện tại. Một trong những email khó nhất.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_priceup_01", scenarioType: "email", titleJa: "値上げ通知メールの書き方", titleVi: "Cách viết email thông báo tăng giá",
        contextSummaryVi: "Công ty quyết định tăng giá 10% từ tháng 7. Lý do: nguyên liệu tăng 25%. Sếp yêu cầu bạn soạn email gửi Sato-san.",
        goalJa: "関係を維持しつつ、値上げを受け入れてもらう。", goalVi: "Duy trì quan hệ, đồng thời để khách chấp nhận tăng giá.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }, { npcSlug: "yamada_bucho", roleInScene: "reviewer" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "【重要】製品価格改定のお知らせ", bodyJa: "（選ぶ）", timestamp: "2026-06-01T10:00:00Z" }] },
        question: { id: "q_priceup_01", skillTag: "nuance", difficulty: "hard",
          promptJa: "10%値上げ通知メールとして最も適切なものはどれですか？",
          promptVi: "Email thông báo tăng giá 10%, phương án nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様\n\nいつもお世話になっております。\n平素より弊社製品をご愛顧いただき、厚く御礼申し上げます。\n\nさて、誠に心苦しいお願いでございますが、昨今の原材料価格高騰（前年比25%増）に伴い、弊社努力だけでは吸収が困難な状況となりました。\n\nつきましては、2026年7月1日ご注文分より、下記の通り価格を改定させていただきたく存じます。\n\n■ 改定率：現行価格の10%アップ\n■ 適用日：2026年7月1日ご注文分より\n■ 備考：6月中のご発注は現行価格にて承ります\n\n今後も品質維持・向上に努めてまいりますので、何卒ご理解賜りますようお願い申し上げます。\nご不明点がございましたら、お気軽にお問い合わせください。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 95, businessRiskDelta: -5, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "感謝→理由→具体的条件→移行期間→今後の約束。完璧な構成。", consequenceVi: "Cảm ơn → Lý do → Điều kiện cụ thể → Kỳ chuyển tiếp → Cam kết. Cấu trúc hoàn hảo.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n来月から10%値上げします。原材料が高くなったので仕方ありません。よろしくお願いします。", isCorrect: false, outcome: { trustDelta: -15, clarityScore: 50, politenessScore: 15, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "一方的で配慮ゼロ。取引先を失うリスク大。", consequenceVi: "Một chiều, không chu đáo. Rủi ro mất đối tác rất cao.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "佐藤様\n大変申し訳ございませんが、やむを得ず値上げをお願いしたく…具体的にはまた改めてご連絡します。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 70, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "具体情報なし。相手は不安になるだけ。", consequenceVi: "Không có thông tin cụ thể. Chỉ gây bất an cho đối phương.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様\n弊社の業績悪化により、価格改定を実施いたします。\n今回は特別に佐藤様のみ5%に抑えます。他社には10%を適用しますので、ご内密にお願いいたします。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 55, politenessScore: 50, businessRiskDelta: 18, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "「業績悪化」は信頼低下。特別扱い発言は不正のリスク。", consequenceVi: "'Kết quả kinh doanh xấu' làm giảm uy tín. Đối xử đặc biệt là rủi ro vi phạm.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 40, skillGains: { nuance: 8, written: 6, customer: 5 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 8 }, { npcSlug: "yamada_bucho", delta: 12 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "このメールなら佐藤さんも納得してくれるだろう。よく書けている。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.client-email: 4 chapters");

  /* ═══ Arc 7: 会議参加者として ══════════════════════════════════════════ */
  const arc7Id = await upsertArc(client, {
    slug: "arc.kaigi-sankanka", ja: "会議参加者として", vi: "Vai trò người tham gia cuộc họp",
    rank: "R3", order: 7,
    story: { synopsisVi: "Tham gia họp không chỉ là ngồi nghe. Học cách phát biểu, ghi biên bản, theo dõi action items, và hành xử đúng trong các loại cuộc họp.", npcSlugs: ["yamada_bucho", "suzuki_kakaricho", "tanaka_senpai"], artAccent: "#059669" },
  });

  await upsertChapters(client, arc7Id, [
    {
      slug: "meeting-minutes", ja: "議事録の書き方", vi: "Cách viết biên bản họp", order: 1, boss: false,
      briefing: { briefingJa: "部署会議の議事録を任されました。何を記録し、どう共有するか学びます。", briefingVi: "Được giao viết biên bản cuộc họp phòng. Học cách ghi chép và chia sẻ.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_minutes_01", scenarioType: "email", titleJa: "議事録メールの送付", titleVi: "Gửi email biên bản họp",
        contextSummaryVi: "Cuộc họp 30 phút vừa xong. Nội dung: (1) Review doanh số tháng trước, (2) Kế hoạch tháng này, (3) Phân công nhiệm vụ. Bạn cần gửi biên bản cho team.",
        goalJa: "要点を簡潔にまとめ、アクションアイテムを明確にする。", goalVi: "Tóm tắt ngắn gọn, nêu rõ action items.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "reviewer" }, { npcSlug: "suzuki_kakaricho", roleInScene: "attendee" }],
        payload: { emailThread: [{ from: "あなた", to: "営業部メンバー全員", subjectJa: "【議事録】5/20 営業部定例会議", bodyJa: "（選ぶ）", timestamp: "2026-05-20T11:00:00Z" }] },
        question: { id: "q_minutes_01", skillTag: "written", difficulty: "standard",
          promptJa: "議事録メールとして最も適切な構成はどれですか？",
          promptVi: "Email biên bản họp, cấu trúc nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "営業部各位\nお疲れ様です。本日の定例会議の議事録をお送りします。\n\n■ 日時：5/20（月）10:00-10:30\n■ 出席者：山田部長、鈴木係長、田中、○○\n■ 議題と決定事項：\n  1. 先月実績レビュー → 目標比95%（要因：大型案件の後ズレ）\n  2. 今月計画 → 新規3件獲得目標\n  3. 担当分け：\n    ・鈴木係長：A社フォロー（5/25まで）\n    ・田中：新規リスト作成（5/22まで）\n    ・○○：見積もり2件送付（5/23まで）\n■ 次回：6/3（月）10:00\n\n内容に修正がございましたらお知らせください。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 95, politenessScore: 85, businessRiskDelta: -5, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "日時・出席者・決定事項・アクション・期限、全て完備。", consequenceVi: "Ngày giờ, người dự, quyết định, action, deadline — đầy đủ.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "みなさん\n今日の会議のまとめです。先月は目標未達。今月はがんばりましょう。以上。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 35, businessRiskDelta: 10, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "議事録ではなく感想文。具体性ゼロ。", consequenceVi: "Đây là cảm tưởng, không phải biên bản. Không có gì cụ thể.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "営業部各位\n議事録：\n・売上の話\n・今月の計画\n・担当分け\nよろしくお願いします。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 30, politenessScore: 55, businessRiskDelta: 6, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "議題だけで決定事項・期限がない。", consequenceVi: "Chỉ có tiêu đề, không có quyết định hay deadline.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "営業部各位\n会議議事録を共有します。\n（会議の発言を一言一句全て記録した2ページの文書を添付）", isCorrect: false, outcome: { trustDelta: -3, clarityScore: 40, politenessScore: 70, businessRiskDelta: 4, satisfactionDelta: -4, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "逐語録は要点が埋もれます。要約＋アクションが重要。", consequenceVi: "Ghi nguyên văn khiến điểm chính bị chìm. Cần tóm tắt + action.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 20, skillGains: { written: 6, meeting: 4 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 8 }] },
    },
    {
      slug: "speaking-in-meeting", ja: "会議での発言", vi: "Phát biểu trong cuộc họp", order: 2, boss: false,
      briefing: { briefingJa: "会議で意見を求められました。簡潔かつ説得力のある発言の仕方を学びます。", briefingVi: "Được yêu cầu phát biểu ý kiến trong cuộc họp. Học cách nói ngắn gọn, thuyết phục.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_speak_01", scenarioType: "meeting", titleJa: "新規顧客アプローチの提案", titleVi: "Đề xuất cách tiếp cận khách mới",
        contextSummaryVi: "Sếp hỏi ý kiến về cách tìm khách hàng mới. Bạn có ý tưởng dùng LinkedIn nhưng cần trình bày cho cả team.",
        goalJa: "論理的に、簡潔に自分の意見を述べる。", goalVi: "Trình bày ý kiến logic, ngắn gọn.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "chair" }, { npcSlug: "suzuki_kakaricho", roleInScene: "attendee" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "新規開拓の方法、何かアイデアある人？○○さん、どう思う？" }] },
        question: { id: "q_speak_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "会議で新規顧客開拓の意見を求められました。最も適切な発言はどれですか？",
          promptVi: "Được hỏi ý kiến về cách tìm khách mới. Cách phát biểu nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "はい、一つ提案がございます。LinkedInを活用した製造業ターゲットのアプローチです。理由は3つあります。第一に、意思決定者に直接リーチできること。第二に、コストが展示会の1/10程度であること。第三に、先月のテストで反応率が従来の2倍だったことです。具体的には、週5件のメッセージ送信から始め、1ヶ月後に効果測定してはいかがでしょうか。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 88, businessRiskDelta: -5, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "結論→理由3つ→具体案。論理的で説得力あり。", consequenceVi: "Kết luận → 3 lý do → Phương án cụ thể. Logic, thuyết phục.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "えーっと、SNSとか使ったらいいんじゃないですかね…", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 20, politenessScore: 45, businessRiskDelta: 5, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "曖昧で自信がない。具体性なし。", consequenceVi: "Mơ hồ, thiếu tự tin. Không cụ thể.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "今の飛び込み営業は効率が悪いと思います。もっとデジタルを活用すべきです。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 45, politenessScore: 50, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "批判だけで代替案がない。建設的でない。", consequenceVi: "Chỉ phê phán, không có phương án thay thế. Không mang tính xây dựng.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "特に思いつきません。鈴木係長のご意見をお聞きしたいです。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 10, politenessScore: 65, businessRiskDelta: 4, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "意見を求められて何も言わないのは消極的すぎ。", consequenceVi: "Được hỏi ý kiến mà không nói gì là quá thụ động.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { meeting: 7, nuance: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "disagreeing-politely", ja: "反対意見の伝え方", vi: "Cách nêu ý kiến phản đối lịch sự", order: 3, boss: false,
      briefing: { briefingJa: "鈴木係長の提案に問題点を感じます。角を立てずに反対意見を伝える技術を学びます。", briefingVi: "Bạn thấy vấn đề trong đề xuất của Suzuki-kakaricho. Học cách phản đối mà không gây xung đột.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_disagree_01", scenarioType: "meeting", titleJa: "会議での建設的な反論", titleVi: "Phản biện mang tính xây dựng trong họp",
        contextSummaryVi: "Suzuki đề xuất giảm giá 20% cho toàn bộ khách hàng. Bạn nghĩ điều này sẽ giảm lợi nhuận mà không tăng doanh số.",
        goalJa: "相手を否定せず、データに基づいて別の視点を提示する。", goalVi: "Không phủ nhận đối phương, đưa góc nhìn khác dựa trên dữ liệu.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "proposer" }, { npcSlug: "yamada_bucho", roleInScene: "chair" }],
        payload: { meetingTranscript: [{ speaker: "鈴木係長", lineJa: "全顧客に20%割引キャンペーンをやりましょう。これで売上が上がるはずです。" }] },
        question: { id: "q_disagree_01", skillTag: "nuance", difficulty: "standard",
          promptJa: "鈴木係長の提案に反対する際、最も適切な発言はどれですか？",
          promptVi: "Khi phản đối đề xuất của Suzuki-kakaricho, cách nói nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "鈴木係長のおっしゃる通り、売上拡大は重要ですね。一点確認させていただきたいのですが、前回の15%割引キャンペーンでは売上は10%増でしたが、利益率は12%減少しました。今回20%だと利益への影響がさらに大きいのではと懸念しております。例えば、新規顧客限定10%割引にすれば、利益を守りつつ新規開拓もできるかと思いますが、いかがでしょうか。", isCorrect: true, outcome: { trustDelta: 10, clarityScore: 92, politenessScore: 90, businessRiskDelta: -8, satisfactionDelta: 10, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "相手を立てつつ、データで根拠を示し、代替案も提示。", consequenceVi: "Tôn trọng đối phương, đưa dữ liệu chứng minh, đề xuất thay thế.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "それは利益が減るだけだと思います。反対です。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 50, politenessScore: 25, businessRiskDelta: 6, satisfactionDelta: -8, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "直接的すぎ。根拠も代替案もなし。", consequenceVi: "Quá thẳng thừng. Không có căn cứ lẫn phương án thay thế.", affectedNpcSlug: "suzuki_kakaricho", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "（黙って何も言わない）", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 0, politenessScore: 50, businessRiskDelta: 8, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "問題に気づいても言わないのは組織にとってリスク。", consequenceVi: "Biết có vấn đề mà im lặng là rủi ro cho tổ chức.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "鈴木係長、その案はちょっと甘いと思います。そんな単純じゃないですよ、営業って。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 40, politenessScore: 10, businessRiskDelta: 10, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "上司を見下す発言。人間関係を壊します。", consequenceVi: "Coi thường cấp trên. Phá hoại mối quan hệ.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 24, skillGains: { nuance: 7, meeting: 5, keigo: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }, { npcSlug: "suzuki_kakaricho", delta: 3 }] },
    },
    {
      slug: "boss-cross-dept-meeting", ja: "【難関】他部署合同会議での発表", vi: "【Boss】Phát biểu tại họp liên phòng ban", order: 4, boss: true,
      briefing: { briefingJa: "経理部の小川課長も参加する四半期レビュー。数字を使って営業実績を報告し、質問にも答えます。", briefingVi: "Họp review quý có cả trưởng phòng kế toán Ogawa. Báo cáo kết quả bằng số liệu và trả lời câu hỏi.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 10 },
      scenario: { scenarios: [{ id: "sc_crossdept_01", scenarioType: "meeting", titleJa: "四半期レビュー — 営業実績報告", titleVi: "Review quý — Báo cáo kết quả kinh doanh",
        contextSummaryVi: "Trước mặt sếp Yamada và trưởng phòng kế toán Ogawa. Doanh số quý: 85% mục tiêu. Lý do: mất 2 khách lớn. Kế hoạch quý tới: bù đắp bằng 5 khách mới.",
        goalJa: "数字に基づく報告をし、質問にも論理的に対応する。", goalVi: "Báo cáo dựa trên số liệu, trả lời câu hỏi bằng logic.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "attendee" }, { npcSlug: "ogawa_finance", roleInScene: "questioner" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "では○○、第2四半期の実績報告をどうぞ。" }] },
        question: { id: "q_crossdept_01", skillTag: "chart", difficulty: "hard",
          promptJa: "四半期実績報告と、小川課長からの質問への対応として最も適切なのは？",
          promptVi: "Báo cáo quý và trả lời câu hỏi từ trưởng phòng Ogawa, cách nào tốt nhất?",
          options: [
            { optionKey: "A", textJa: "【報告】第2四半期の売上は目標比85%、4,250万円でした。\n未達要因：主要取引先2社の取引終了（計800万円減）\n一方、新規顧客3社を獲得し、500万円の純増を達成しました。\n\n第3四半期計画：新規5社開拓（パイプライン確保済み3社）+既存顧客の単価アップ提案\nにより、目標100%達成を見込んでおります。\n\n【小川課長からの質問「利益率は？」に対して】\n利益率は前期比2ポイント低下の18%です。要因は新規開拓の初期コストですが、第3四半期以降は正常化する見込みです。詳細データは後日メールでお送りします。", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 88, businessRiskDelta: -8, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "数字・要因分析・計画・質問対応、全て高品質。", consequenceVi: "Số liệu, phân tích nguyên nhân, kế hoạch, trả lời câu hỏi — đều chất lượng cao.", affectedNpcSlug: "ogawa_finance", errorType: null } },
            { optionKey: "B", textJa: "今期は85%でした。来期はがんばります。…利益率ですか？ちょっと今手元にないです。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 25, politenessScore: 45, businessRiskDelta: 12, satisfactionDelta: -12, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "分析なし・計画なし・質問にも答えられない。準備不足。", consequenceVi: "Không phân tích, không kế hoạch, không trả lời được. Thiếu chuẩn bị.", affectedNpcSlug: "ogawa_finance", errorType: "action_item_miss" } },
            { optionKey: "C", textJa: "目標未達はA社とB社の離脱が原因です。彼らが悪いのではなく市場環境の問題です。来期の見通しは不透明ですが、最善を尽くします。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 45, politenessScore: 60, businessRiskDelta: 8, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "言い訳っぽく、具体的な対策がない。数字も不足。", consequenceVi: "Nghe như bao biện, thiếu đối sách cụ thể. Thiếu số liệu.", affectedNpcSlug: "yamada_bucho", errorType: "business_context_error" } },
            { optionKey: "D", textJa: "素晴らしい結果を出しました！新規3社獲得は私の個人成果です。来期は倍の10社を獲得してみせます。利益？営業の仕事は売上です。", isCorrect: false, outcome: { trustDelta: -12, clarityScore: 40, politenessScore: 20, businessRiskDelta: 15, satisfactionDelta: -15, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "目標未達を隠し、個人主張が強い。利益軽視は問題。", consequenceVi: "Giấu việc không đạt mục tiêu, tự đề cao. Coi nhẹ lợi nhuận.", affectedNpcSlug: "ogawa_finance", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 38, skillGains: { chart: 8, meeting: 6, written: 3, nuance: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 12 }, { npcSlug: "ogawa_finance", delta: 10 }], npcReactionMontage: [{ npcSlug: "ogawa_finance", quoteJa: "数字がしっかりしてて助かる。後で詳細データ待ってるよ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.kaigi-sankanka: 4 chapters");

  /* ═══ Arc 8: 納期管理と調整 ════════════════════════════════════════════ */
  const arc8Id = await upsertArc(client, {
    slug: "arc.deadline-management", ja: "納期管理と調整", vi: "Quản lý và điều phối deadline",
    rank: "R3", order: 8,
    story: { synopsisVi: "Khi quản lý nhiều dự án, deadline chồng chéo là chuyện bình thường. Học cách ưu tiên, điều phối, và giao tiếp khi deadline gặp rủi ro.", npcSlugs: ["yamada_bucho", "sato_kokyaku", "suzuki_kakaricho"], artAccent: "#DC2626" },
  });

  await upsertChapters(client, arc8Id, [
    {
      slug: "priority-setting", ja: "優先順位の決め方", vi: "Cách sắp xếp ưu tiên", order: 1, boss: false,
      briefing: { briefingJa: "3つの案件が同時に締め切り。山田部長に相談し、優先順位を決めます。", briefingVi: "3 dự án cùng deadline. Tham vấn sếp Yamada để sắp xếp ưu tiên.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 5 },
      scenario: { scenarios: [{ id: "sc_priority_01", scenarioType: "meeting", titleJa: "3案件の優先順位相談", titleVi: "Tham vấn ưu tiên 3 dự án",
        contextSummaryVi: "A: báo giá cho Sato (nhỏ, nhưng quan hệ lâu). B: proposal cho khách mới (lớn, deadline cứng). C: báo cáo nội bộ (sếp cần).",
        goalJa: "判断基準を示し、上司の承認を得る。", goalVi: "Trình bày tiêu chí quyết định, xin sếp phê duyệt.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "manager" }],
        payload: { meetingTranscript: [{ speaker: "山田部長", lineJa: "今週中に全部は無理だろう。どう優先する？" }] },
        question: { id: "q_priority_01", skillTag: "meeting", difficulty: "standard",
          promptJa: "3案件の優先順位を提案する際、最も適切な説明はどれですか？",
          promptVi: "Khi đề xuất thứ tự ưu tiên 3 dự án, cách giải thích nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "はい、影響度と緊急性で整理しました。\n第一優先：B社プロポーザル（金曜締切＋金額大＋延期不可）\n第二優先：佐藤様見積もり（金額は小さいが信頼維持のため木曜に提出）\n第三優先：社内レポート（部長に相談の上、月曜まで延長をお願いしたい）\nこの順番でいかがでしょうか。", isCorrect: true, outcome: { trustDelta: 12, clarityScore: 95, politenessScore: 85, businessRiskDelta: -8, satisfactionDelta: 12, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "基準明確＋具体的スケジュール＋相談姿勢。", consequenceVi: "Tiêu chí rõ + lịch cụ thể + thái độ tham vấn.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "全部がんばります。徹夜すればなんとかなると思います。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 20, politenessScore: 55, businessRiskDelta: 10, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "精神論は解決策ではない。品質低下のリスクも。", consequenceVi: "Tinh thần luận không phải giải pháp. Rủi ro chất lượng giảm.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "どれを先にやればいいですか？部長に決めていただきたいです。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 15, politenessScore: 60, businessRiskDelta: 5, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "自分の考えなし。受け身すぎる。", consequenceVi: "Không có suy nghĩ riêng. Quá thụ động.", affectedNpcSlug: "yamada_bucho", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様が長い付き合いなので最優先。新規は待ってもらいましょう。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 50, politenessScore: 55, businessRiskDelta: 12, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "金額と締切無視。ビジネス判断として不適切。", consequenceVi: "Bỏ qua số tiền và deadline. Quyết định kinh doanh không phù hợp.", affectedNpcSlug: "yamada_bucho", errorType: "priority_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { meeting: 5, chart: 4, nuance: 3 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 10 }] },
    },
    {
      slug: "delay-notification", ja: "納期遅延の事前連絡", vi: "Thông báo trễ deadline trước", order: 2, boss: false,
      briefing: { briefingJa: "製造トラブルで3日遅延確定。佐藤様への事前連絡メールを書きます。", briefingVi: "Sự cố sản xuất, chắc chắn trễ 3 ngày. Viết email thông báo trước cho Sato-san.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_delay_01", scenarioType: "email", titleJa: "納期遅延のお詫びメール", titleVi: "Email xin lỗi trễ deadline",
        contextSummaryVi: "Máy sản xuất hỏng, sửa mất 2 ngày. Deadline 5/25 sẽ thành 5/28. Sếp đã approve thông báo.",
        goalJa: "誠意を示し、具体的な対策を提示する。", goalVi: "Thể hiện thành ý, đưa đối sách cụ thể.",
        characters: [{ npcSlug: "sato_kokyaku", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "佐藤 様", subjectJa: "【お詫び】納品日変更のご連絡", bodyJa: "（選ぶ）", timestamp: "2026-05-22T09:00:00Z" }] },
        question: { id: "q_delay_01", skillTag: "customer", difficulty: "standard",
          promptJa: "納期遅延のお詫びメールとして最も適切なものはどれですか？",
          promptVi: "Email xin lỗi trễ deadline nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "佐藤様\n\nいつもお世話になっております。\n製品Aの納品についてお詫びとご連絡がございます。\n\n弊社製造ラインの設備トラブルにより、当初の5月25日の納品が困難な状況となりました。大変申し訳ございません。\n\n■ 変更後納品日：5月28日（水）\n■ 原因：製造設備の緊急修理（現在復旧作業中）\n■ 対応策：修理完了後、優先ラインで生産を開始いたします\n\nお客様にはご迷惑をおかけし、重ねてお詫び申し上げます。\n今後このようなことがないよう、設備管理を強化してまいります。\n\nご不明点がございましたら、お気軽にお問い合わせください。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 95, politenessScore: 92, businessRiskDelta: -5, satisfactionDelta: 6, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "謝罪→事実→新日程→対策→再発防止。信頼を保てる。", consequenceVi: "Xin lỗi → Sự thật → Lịch mới → Đối sách → Phòng tái phát. Giữ được uy tín.", affectedNpcSlug: "sato_kokyaku", errorType: null } },
            { optionKey: "B", textJa: "佐藤様\n納品が3日遅れます。すみません。28日になります。よろしくお願いします。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 45, politenessScore: 35, businessRiskDelta: 8, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "理由なし、対策なし、誠意が感じられない。", consequenceVi: "Không có lý do, không đối sách, thiếu thành ý.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
            { optionKey: "C", textJa: "佐藤様\n大変申し訳ございません。設備の問題で遅れる可能性があります。分かり次第ご連絡します。", isCorrect: false, outcome: { trustDelta: -4, clarityScore: 40, politenessScore: 70, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "「可能性」ではなく確定情報を伝えるべき。日程も不明。", consequenceVi: "Đã xác định rồi, không nên nói 'có thể'. Thiếu ngày cụ thể.", affectedNpcSlug: "sato_kokyaku", errorType: "action_item_miss" } },
            { optionKey: "D", textJa: "佐藤様\n製造設備が壊れました。古い設備を使い続けた経営判断の問題で、現場は悪くありません。復旧を急いでいますが、正直いつになるか…", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 35, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "社内事情の暴露。顧客に言うべきでない内容。", consequenceVi: "Phơi bày vấn đề nội bộ. Không nên nói với khách hàng.", affectedNpcSlug: "sato_kokyaku", errorType: "business_context_error" } },
          ],
        },
      }] },
      rewards: { rankXp: 22, skillGains: { customer: 6, written: 5, nuance: 3 }, npcTrustGains: [{ npcSlug: "sato_kokyaku", delta: 6 }] },
    },
    {
      slug: "schedule-adjustment", ja: "スケジュール再調整", vi: "Điều chỉnh lại lịch trình", order: 3, boss: false,
      briefing: { briefingJa: "複数案件のスケジュールが崩れました。関係者と再調整の交渉をします。", briefingVi: "Lịch trình nhiều dự án bị xáo trộn. Thương lượng điều chỉnh với các bên liên quan.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 6 },
      scenario: { scenarios: [{ id: "sc_adjust_01", scenarioType: "email", titleJa: "関係者へのスケジュール再調整依頼", titleVi: "Email yêu cầu điều chỉnh lịch với các bên",
        contextSummaryVi: "Dự án A trễ → ảnh hưởng dự án B. Cần xin Suzuki-kakaricho dời deadline review nội bộ từ thứ 4 sang thứ 6.",
        goalJa: "影響を最小限にする再調整案を提示し、合意を得る。", goalVi: "Đề xuất điều chỉnh giảm thiểu ảnh hưởng, đạt đồng thuận.",
        characters: [{ npcSlug: "suzuki_kakaricho", roleInScene: "recipient" }],
        payload: { emailThread: [{ from: "あなた", to: "鈴木 係長", subjectJa: "B案件レビューの日程変更お願い", bodyJa: "（選ぶ）", timestamp: "2026-05-22T14:00:00Z" }] },
        question: { id: "q_adjust_01", skillTag: "written", difficulty: "standard",
          promptJa: "鈴木係長にレビュー日程の変更を依頼する際、最も適切なメールは？",
          promptVi: "Khi xin Suzuki-kakaricho dời ngày review, email nào phù hợp nhất?",
          options: [
            { optionKey: "A", textJa: "鈴木係長\nお疲れ様です。B案件のレビュー日程について、ご相談があります。\n\nA案件の納期対応が入り、水曜日までにB案件の資料準備が間に合わない状況です。\n大変恐縮ですが、レビューを金曜日に変更していただくことは可能でしょうか。\n\n金曜日であれば完成度の高い資料でご報告できます。\nご都合が悪い場合は、他の日程も検討いたしますので、お知らせください。\n\nお手数をおかけしますが、よろしくお願いいたします。", isCorrect: true, outcome: { trustDelta: 8, clarityScore: 90, politenessScore: 88, businessRiskDelta: -4, satisfactionDelta: 8, nextActionCorrect: true, npcReactionTag: "nod", consequenceJa: "理由→提案→メリット→代替対応。スムーズな交渉。", consequenceVi: "Lý do → Đề xuất → Lợi ích → Phương án dự phòng. Thương lượng mượt.", affectedNpcSlug: "suzuki_kakaricho", errorType: null } },
            { optionKey: "B", textJa: "鈴木係長、水曜のレビュー、金曜にしてもらっていいですか？忙しくて。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 45, politenessScore: 35, businessRiskDelta: 5, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "理由が曖昧で軽い。相手の予定への配慮なし。", consequenceVi: "Lý do mơ hồ, nhẹ nhàng. Không quan tâm lịch của đối phương.", affectedNpcSlug: "suzuki_kakaricho", errorType: "keigo_misunderstanding" } },
            { optionKey: "C", textJa: "鈴木係長、A案件が大変なのでB案件は来週にしてください。", isCorrect: false, outcome: { trustDelta: -5, clarityScore: 50, politenessScore: 40, businessRiskDelta: 6, satisfactionDelta: -5, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一方的な通告。「お願い」の姿勢がない。", consequenceVi: "Thông báo một chiều. Không có thái độ 'xin phép'.", affectedNpcSlug: "suzuki_kakaricho", errorType: "implied_meaning_error" } },
            { optionKey: "D", textJa: "（何も連絡せず、水曜のレビューに未完成の資料で出席する）", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 0, politenessScore: 30, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "escalate", consequenceJa: "事前連絡なしは最悪。相手の時間も無駄にします。", consequenceVi: "Không báo trước là tệ nhất. Lãng phí thời gian người khác.", affectedNpcSlug: "suzuki_kakaricho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 20, skillGains: { written: 5, nuance: 4, meeting: 3 }, npcTrustGains: [{ npcSlug: "suzuki_kakaricho", delta: 6 }] },
    },
    {
      slug: "boss-multi-deadline-crisis", ja: "【難関】複数案件の同時危機管理", vi: "【Boss】Quản lý khủng hoảng nhiều dự án cùng lúc", order: 4, boss: true,
      briefing: { briefingJa: "3案件同時にトラブル発生。各方面への連絡、優先判断、エスカレーションを同時にこなします。", briefingVi: "3 dự án cùng gặp sự cố. Liên lạc các bên, phán đoán ưu tiên, leo thang — tất cả cùng lúc.", yourRoleVi: "一般社員（あなた）", estimatedMinutes: 12 },
      scenario: { scenarios: [{ id: "sc_multicrisis_01", scenarioType: "deadline", titleJa: "トリプル・デッドライン危機", titleVi: "Khủng hoảng 3 deadline cùng lúc",
        contextSummaryVi: "A: khách hàng đổi spec gấp (Sato). B: nhà cung cấp thông báo thiếu hàng. C: sếp cần số liệu cho họp ban giám đốc chiều nay. Bạn có 3 giờ.",
        goalJa: "限られた時間で最大の成果を出す判断と行動。", goalVi: "Ra quyết định và hành động tối ưu trong thời gian có hạn.",
        characters: [{ npcSlug: "yamada_bucho", roleInScene: "manager" }, { npcSlug: "sato_kokyaku", roleInScene: "stakeholder" }],
        payload: { meetingTranscript: [{ speaker: "（状況）", lineJa: "9:00。メールを開くと3件の緊急案件。午後の会議まで3時間。" }] },
        question: { id: "q_multicrisis_01", skillTag: "meeting", difficulty: "hard",
          promptJa: "3件同時の危機。最も適切な対応順序と行動はどれですか？",
          promptVi: "3 sự cố cùng lúc. Thứ tự và hành động nào tối ưu nhất?",
          options: [
            { optionKey: "A", textJa: "①まず山田部長に3件の状況を5分で報告（全体像共有）\n②C:部長用数字を30分で作成（午後会議は動かせない）\n③A:佐藤様に「本日中に回答」のメール（期待値コントロール）\n④B:仕入先に電話で代替品と最短納期を確認\n⑤A:spec変更の影響を整理し佐藤様に回答\n→全件を部長に完了報告", isCorrect: true, outcome: { trustDelta: 15, clarityScore: 95, politenessScore: 85, businessRiskDelta: -10, satisfactionDelta: 15, nextActionCorrect: true, npcReactionTag: "smile", consequenceJa: "報告→固定期限から→期待値管理→並行処理。危機管理の教科書。", consequenceVi: "Báo cáo → Deadline cứng trước → Quản lý kỳ vọng → Xử lý song song. Giáo khoa quản lý khủng hoảng.", affectedNpcSlug: "yamada_bucho", errorType: null } },
            { optionKey: "B", textJa: "3件とも同時に処理する。マルチタスクで。", isCorrect: false, outcome: { trustDelta: -8, clarityScore: 20, politenessScore: 50, businessRiskDelta: 15, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "マルチタスクは全て中途半端になるリスク大。", consequenceVi: "Multitask = rủi ro tất cả đều dở dang.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
            { optionKey: "C", textJa: "一番怒りそうな佐藤様を最優先で対応する。他は後で。", isCorrect: false, outcome: { trustDelta: -6, clarityScore: 40, politenessScore: 55, businessRiskDelta: 10, satisfactionDelta: -6, nextActionCorrect: false, npcReactionTag: "silence", consequenceJa: "感情ベースの判断。午後の社長会議に間に合わない。", consequenceVi: "Quyết định dựa trên cảm xúc. Sẽ không kịp họp ban GĐ chiều nay.", affectedNpcSlug: "yamada_bucho", errorType: "priority_misread" } },
            { optionKey: "D", textJa: "パニックになり、田中先輩に全部助けてもらう。", isCorrect: false, outcome: { trustDelta: -10, clarityScore: 10, politenessScore: 40, businessRiskDelta: 12, satisfactionDelta: -10, nextActionCorrect: false, npcReactionTag: "frown", consequenceJa: "一般社員として自立的に動く力が問われています。", consequenceVi: "Ở level nhân viên chính thức, bạn cần tự chủ hành động.", affectedNpcSlug: "yamada_bucho", errorType: "responsibility_misread" } },
          ],
        },
      }] },
      rewards: { rankXp: 42, skillGains: { meeting: 8, customer: 5, chart: 4, nuance: 4 }, npcTrustGains: [{ npcSlug: "yamada_bucho", delta: 15 }, { npcSlug: "sato_kokyaku", delta: 8 }], npcReactionMontage: [{ npcSlug: "yamada_bucho", quoteJa: "冷静に全部さばいたな。主任への昇格、考えてもいい頃だ。", sentiment: "positive" }] },
    },
  ]);
  console.log("  ✓ arc.deadline-management: 4 chapters");
  console.log(`✓ R3 complete: 3 arcs, 12 chapters`);
}

if (process.argv[1]?.includes("04-r3")) {
  const { createClient } = await import("./_helpers.mjs");
  const client = await createClient();
  await seedR3(client);
  await client.end();
}
