import type { CompanionTip } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";

/**
 * Hardcoded tips for now — will be migrated to DB (companion_tip table) later.
 * This is a rule-based provider that can be swapped with an LLM provider.
 */

const TIPS: CompanionTip[] = [
  { id: "tip_keigo_01", category: "keigo", contentJa: "「お疲れ様です」は同僚に使い、「ご苦労様です」は目上から目下に使います。", contentVi: "\"Otsukaresama desu\" dùng với đồng nghiệp, \"Gokurosama desu\" dùng từ trên xuống dưới." },
  { id: "tip_business_01", category: "business", contentJa: "ビジネスメールでは「お世話になっております」から始めましょう。", contentVi: "Email công việc nên bắt đầu bằng \"Osewa ni natte orimasu\"." },
  { id: "tip_grammar_01", category: "grammar", contentJa: "「〜ていただけますか」は「〜てください」より丁寧です。", contentVi: "\"~te itadakemasu ka\" lịch sự hơn \"~te kudasai\".", exampleJa: "資料を送っていただけますか？", exampleVi: "Bạn có thể gửi tài liệu được không?" },
  { id: "tip_keigo_02", category: "keigo", contentJa: "「承知しました」は「わかりました」のビジネス版です。", contentVi: "\"Shouchi shimashita\" là phiên bản công việc của \"Wakarimashita\"." },
  { id: "tip_culture_01", category: "culture", contentJa: "名刺交換は両手で、相手の方を向いて渡しましょう。", contentVi: "Trao danh thiếp bằng hai tay, hướng mặt về phía đối phương." },
  { id: "tip_business_02", category: "business", contentJa: "「検討させていただきます」は断りの意味で使われることが多いです。", contentVi: "\"Kentou sasete itadakimasu\" thường mang ý từ chối lịch sự." },
  { id: "tip_grammar_02", category: "grammar", contentJa: "敬語の3種類：尊敬語、謙譲語、丁寧語を使い分けましょう。", contentVi: "3 loại kính ngữ: Sonkeigo (tôn kính), Kenjougo (khiêm nhường), Teineigo (lịch sự)." },
  { id: "tip_keigo_03", category: "keigo", contentJa: "「申し訳ございません」は最もフォーマルな謝罪表現です。", contentVi: "\"Moushiwake gozaimasen\" là cách xin lỗi trang trọng nhất." },
  { id: "tip_business_03", category: "business", contentJa: "「よろしくお願いいたします」は文末の締めに必須です。", contentVi: "\"Yoroshiku onegai itashimasu\" là câu kết bắt buộc ở cuối email/văn bản." },
  { id: "tip_grammar_03", category: "grammar", contentJa: "「させていただく」の乱用に注意。必要な場面でだけ使いましょう。", contentVi: "Cẩn thận lạm dụng \"sasete itadaku\". Chỉ dùng khi thực sự cần." },
  { id: "tip_culture_02", category: "culture", contentJa: "会議で「なるほど」を連発すると失礼になることがあります。", contentVi: "Nói \"Naruhodo\" liên tục trong cuộc họp có thể bị coi là thiếu lịch sự." },
  { id: "tip_vocab_01", category: "vocab", contentJa: "「打ち合わせ」(うちあわせ) = ミーティング。ビジネスでよく使います。", contentVi: "\"Uchiawase\" = cuộc họp. Dùng rất nhiều trong công việc." },
  { id: "tip_vocab_02", category: "vocab", contentJa: "「納期」(のうき) = deadline。「納期に間に合う」= kịp deadline.", contentVi: "\"Nouki\" = deadline. \"Nouki ni maniau\" = kịp deadline." },
  { id: "tip_keigo_04", category: "keigo", contentJa: "電話では「〇〇でございます」と名乗りましょう。", contentVi: "Khi nghe điện thoại, hãy nói \"〇〇 de gozaimasu\" để tự giới thiệu." },
  { id: "tip_business_04", category: "business", contentJa: "報告は「結論→理由→詳細」の順で。日本のビジネス基本です。", contentVi: "Báo cáo theo thứ tự \"Kết luận → Lý do → Chi tiết\". Đây là cơ bản trong kinh doanh Nhật." },
];

const CATEGORIES = ["grammar", "vocab", "keigo", "culture", "business"] as const;

@Injectable()
export class CompanionTipService {
  getRandomTip(category?: string): CompanionTip {
    let pool = TIPS;
    if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      pool = TIPS.filter((t) => t.category === category);
    }
    if (pool.length === 0) pool = TIPS;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx]!;
  }

  getCategories(): string[] {
    return [...CATEGORIES];
  }
}
