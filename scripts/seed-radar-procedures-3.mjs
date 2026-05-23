/**
 * Radar Seed: Procedures (Additional) - Driving License, Marriage, Moving
 * Run: node scripts/seed-radar-procedures-3.mjs
 */
import { createClient, runBatch, MODULES } from "./radar-seed-helpers.mjs";

const M_PROC = MODULES.visa_cityhall;

const cards = [
  {
    slug: "driving-license-japan",
    moduleConfigId: M_PROC,
    titleVi: "運転免許 — Bằng lái xe ở Nhật",
    titleJa: "日本の運転免許取得・切替",
    descriptionVi: "Chuyển đổi bằng lái nước ngoài + thi bằng ở Nhật.",
    recommendationReasonVi: "Muốn lái xe Nhật = phải có bằng Nhật. Quy trình phức tạp.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 180,
    metadata: {
      seed: true,
      skills: ["driving_license", "transportation", "legal_procedure"],
      contentGoal: "Biết cách lấy/chuyển bằng lái xe ở Nhật.",
      usageNote: "2 cách: 1) 外免切替 (chuyển bằng nước ngoài): cần bằng gốc + dịch JAF + thi thực hành (khó!). 2) 教習所 (trường lái): 200,000-300,000¥, 1-3 tháng. Việt Nam: không có hiệp định → thi cả lý thuyết + thực hành.",
      japaneseExpressions: [
        {
          word: "外免切替",
          reading: "がいめんきりかえ",
          meaning: "Chuyển đổi bằng lái nước ngoài",
          jlptLevel: "N2",
          example: "外免切替は免許センターで手続きします。",
          exampleReading: "がいめんきりかえはめんきょセンターでてつづきします。",
          exampleMeaning: "Chuyển bằng lái ở trung tâm cấp phép.",
          usageNote: "Cần: bằng gốc + dịch JAF + sống >3 tháng ở nước cấp bằng. Thi: kiến thức + thực hành.",
        },
        {
          word: "仮免許",
          reading: "かりめんきょ",
          meaning: "Bằng tạm (để tập lái trên đường)",
          jlptLevel: "N3",
          example: "仮免許を取ったら、路上教習ができます。",
          exampleReading: "かりめんきょをとったら、ろじょうきょうしゅうができます。",
          exampleMeaning: "Có bằng tạm thì được tập lái trên đường.",
          usageNote: "Trường lái: 第一段階 (trong trường) → 仮免試験 → 第二段階 (trên đường) → 卒検 → 免許.",
        },
        {
          word: "教習所",
          reading: "きょうしゅうじょ",
          meaning: "Trường dạy lái xe",
          jlptLevel: "N3",
          example: "教習所に通って免許を取るのに3ヶ月かかりました。",
          exampleReading: "きょうしゅうじょにかよってめんきょをとるのにさんかげつかかりました。",
          exampleMeaning: "Học trường lái 3 tháng mới lấy bằng.",
          usageNote: "費用: 200,000-350,000¥. 合宿 (ở trọ tập trung) = 2 tuần, rẻ hơn. 通い = đi về.",
        },
        {
          word: "免許更新",
          reading: "めんきょこうしん",
          meaning: "Gia hạn bằng lái",
          jlptLevel: "N3",
          example: "免許の更新はゴールド免許なら5年に一度です。",
          exampleReading: "めんきょのこうしんはゴールドめんきょならごねんにいちどです。",
          exampleMeaning: "Bằng vàng thì 5 năm gia hạn 1 lần.",
          usageNote: "ゴールド (5年, 無事故無違反). ブルー (3年). 更新: 誕生日の前後1ヶ月. 講習 30分-2時間.",
        },
        {
          word: "実技試験",
          reading: "じつぎしけん",
          meaning: "Thi thực hành (lái xe)",
          jlptLevel: "N3",
          example: "外免切替の実技試験は合格率が低いです。",
          exampleReading: "がいめんきりかえのじつぎしけんはごうかくりつがひくいです。",
          exampleMeaning: "Thi thực hành chuyển bằng, tỷ lệ đậu thấp.",
          usageNote: "1 lần ~5,000¥. Trung bình 3-5 lần mới đậu. Điểm cần: 安全確認, 一時停止, 合図.",
        },
      ],
    },
  },
  {
    slug: "marriage-registration-japan",
    moduleConfigId: M_PROC,
    titleVi: "婚姻届 — Đăng ký kết hôn",
    titleJa: "日本での婚姻届の出し方",
    descriptionVi: "Thủ tục đăng ký kết hôn ở Nhật — giấy tờ cần thiết + quy trình.",
    recommendationReasonVi: "Kết hôn ở Nhật = giấy tờ phức tạp (đặc biệt quốc tế). Biết trước = suôn sẻ.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N3-N2",
    estimatedMinutes: 4,
    priority: 175,
    metadata: {
      seed: true,
      skills: ["marriage", "legal_procedure", "international_family"],
      contentGoal: "Biết thủ tục kết hôn ở Nhật + giấy tờ cho người nước ngoài.",
      usageNote: "国際結婚: cần 婚姻要件具備証明書 (giấy đủ điều kiện KH) từ ĐSQ + dịch Nhật. Nộp: 区役所 (quận). 24/7 nhận đơn! Nhiều cặp chọn ngày đẹp (11/22 = いい夫婦の日).",
      japaneseExpressions: [
        {
          word: "婚姻届",
          reading: "こんいんとどけ",
          meaning: "Giấy đăng ký kết hôn",
          jlptLevel: "N2",
          example: "婚姻届を区役所に提出しました。",
          exampleReading: "こんいんとどけをくやくしょにていしゅつしました。",
          exampleMeaning: "Nộp giấy đăng ký kết hôn ở quận.",
          usageNote: "Download free ở quận/online. 証人 2 người (ai cũng OK). Nộp bất kỳ quận nào, 24/7.",
        },
        {
          word: "婚姻要件具備証明書",
          reading: "こんいんようけんぐびしょうめいしょ",
          meaning: "Giấy đủ điều kiện kết hôn (từ ĐSQ)",
          jlptLevel: "N1",
          example: "大使館で婚姻要件具備証明書を取得してください。",
          exampleReading: "たいしかんでこんいんようけんぐびしょうめいしょをしゅとくしてください。",
          exampleMeaning: "Lấy giấy đủ điều kiện KH ở đại sứ quán.",
          usageNote: "Người nước ngoài KH ở Nhật cần giấy này. ĐSQ Việt Nam ở Tokyo cấp. Cần hộ chiếu + giấy độc thân.",
        },
        {
          word: "証人",
          reading: "しょうにん",
          meaning: "Nhân chứng (ký tên trên giấy KH)",
          jlptLevel: "N3",
          example: "婚姻届には証人2名の署名が必要です。",
          exampleReading: "こんいんとどけにはしょうにんにめいのしょめいがひつようです。",
          exampleMeaning: "Giấy KH cần chữ ký 2 nhân chứng.",
          usageNote: "Ai 20+ tuổi đều OK. Bạn bè, đồng nghiệp, gia đình. Chỉ cần ký + đóng dấu.",
        },
        {
          word: "戸籍謄本",
          reading: "こせきとうほん",
          meaning: "Bản sao hộ tịch (toàn bộ)",
          jlptLevel: "N2",
          example: "婚姻届と一緒に戸籍謄本を提出してください。",
          exampleReading: "こんいんとどけといっしょにこせきとうほんをていしゅつしてください。",
          exampleMeaning: "Nộp bản sao hộ tịch cùng giấy KH.",
          usageNote: "Người Nhật cần. Lấy ở 本籍地 (nơi đăng ký gốc) hoặc コンビニ交付. 450¥.",
        },
        {
          word: "在留資格変更",
          reading: "ざいりゅうしかくへんこう",
          meaning: "Đổi tư cách lưu trú (→ visa vợ/chồng)",
          jlptLevel: "N2",
          example: "結婚後に在留資格を配偶者に変更しました。",
          exampleReading: "けっこんごにざいりゅうしかくをはいぐうしゃにへんこうしました。",
          exampleMeaning: "Sau KH đổi visa sang visa vợ/chồng.",
          usageNote: "配偶者ビザ: tự do làm việc, không giới hạn ngành. 変更申請 ở 入管. 2-3 tháng xét.",
        },
      ],
    },
  },
  {
    slug: "moving-transfer-procedures",
    moduleConfigId: M_PROC,
    titleVi: "引っ越し届出 — Thủ tục chuyển nhà",
    titleJa: "引っ越しに必要な届出",
    descriptionVi: "Checklist thủ tục chuyển nhà — quận cũ, quận mới, địa chỉ mới.",
    recommendationReasonVi: "Chuyển nhà Nhật = 10+ thủ tục. Miss 1 = phiền lớn.",
    category: "procedure",
    visualTheme: "purple_procedure",
    levelLabel: "N4-N3",
    estimatedMinutes: 4,
    priority: 178,
    metadata: {
      seed: true,
      skills: ["moving", "address_change", "utilities"],
      contentGoal: "Biết checklist thủ tục chuyển nhà ở Nhật.",
      usageNote: "Chuyển nhà Nhật = complex. Checklist: 1) 転出届 (quận cũ, 14 ngày trước). 2) 転入届 (quận mới, 14 ngày sau). 3) Đổi địa chỉ: 在留カード, 免許証, 銀行, 保険, 郵便転送. 4) Gas/điện/nước: báo huỷ/đăng ký mới. 5) Internet: 1-2 tuần chờ.",
      japaneseExpressions: [
        {
          word: "転出届",
          reading: "てんしゅつとどけ",
          meaning: "Giấy chuyển đi (nộp quận cũ)",
          jlptLevel: "N3",
          example: "引っ越す前に転出届を出してください。",
          exampleReading: "ひっこすまえにてんしゅつとどけをだしてください。",
          exampleMeaning: "Nộp giấy chuyển đi trước khi dọn.",
          usageNote: "14 ngày trước khi đi. Nhận 転出証明書 → mang sang quận mới. Quên = phiền!",
        },
        {
          word: "転入届",
          reading: "てんにゅうとどけ",
          meaning: "Giấy chuyển đến (nộp quận mới)",
          jlptLevel: "N3",
          example: "引っ越しから14日以内に転入届を出してください。",
          exampleReading: "ひっこしからじゅうよっかいないにてんにゅうとどけをだしてください。",
          exampleMeaning: "14 ngày sau chuyển nhà phải nộp giấy chuyển đến.",
          usageNote: "Cần: 転出証明書 + 在留カード + マイナンバーカード. 在留カード cập nhật địa chỉ mặt sau.",
        },
        {
          word: "郵便転送届",
          reading: "ゆうびんてんそうとどけ",
          meaning: "Đăng ký chuyển tiếp thư (1 năm free)",
          jlptLevel: "N3",
          example: "郵便局で転送届を出すと、旧住所の郵便物が届きます。",
          exampleReading: "ゆうびんきょくでてんそうとどけをだすと、きゅうじゅうしょのゆうびんぶつがとどきます。",
          exampleMeaning: "Nộp đơn chuyển tiếp ở bưu điện, thư gửi địa chỉ cũ sẽ chuyển đến.",
          usageNote: "e転居 (online) hoặc 郵便局. 1 năm miễn phí. LUÔN LÀM để không miss thư quan trọng.",
        },
        {
          word: "ライフラインの手続き",
          reading: "ライフラインのてつづき",
          meaning: "Thủ tục điện/gas/nước",
          jlptLevel: "N3",
          example: "ライフラインの手続きは引っ越しの1週間前にしましょう。",
          exampleReading: "ライフラインのてつづきはひっこしのいっしゅうかんまえにしましょう。",
          exampleMeaning: "Thủ tục điện/gas/nước nên làm 1 tuần trước.",
          usageNote: "電気: online 即日OK. ガス: 立会い必要 (phải có mặt). 水道: gọi水道局. Internet: ĐẶT SỚM (2-4 tuần).",
        },
        {
          word: "敷金の返還",
          reading: "しききんのへんかん",
          meaning: "Hoàn tiền đặt cọc",
          jlptLevel: "N3",
          example: "退去時に敷金がどれくらい返ってくるか確認しましょう。",
          exampleReading: "たいきょじにしききんがどれくらいかえってくるかかくにんしましょう。",
          exampleMeaning: "Khi dọn đi, kiểm tra được hoàn bao nhiêu tiền cọc.",
          usageNote: "Dọn sạch = hoàn nhiều. 原状回復 (trả lại nguyên trạng) = trách nhiệm. Chụp ảnh trước khi dọn!",
        },
      ],
    },
  },
];

async function main() {
  const client = createClient();
  await client.connect();
  console.log("📋 Seeding Procedures (Additional)...");
  try {
    const result = await runBatch(client, cards, "Procedures Additional");
    console.log(`\n✅ Done. Total: ${result.success + result.failed} cards processed.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
