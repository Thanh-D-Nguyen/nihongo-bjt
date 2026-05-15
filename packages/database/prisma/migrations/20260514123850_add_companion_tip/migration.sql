-- AlterTable
ALTER TABLE "learning"."battle_bot" ALTER COLUMN "bot_key" SET DEFAULT 'bot_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text);

-- CreateTable
CREATE TABLE "content"."companion_tip" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" VARCHAR(32) NOT NULL,
    "content_ja" TEXT NOT NULL,
    "content_vi" TEXT NOT NULL,
    "example_ja" TEXT,
    "example_vi" TEXT,
    "jlpt_level" VARCHAR(8),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_tip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_companion_tip_category_active" ON "content"."companion_tip"("category", "active");

-- Seed initial tips
INSERT INTO "content"."companion_tip" ("category", "content_ja", "content_vi", "sort_order") VALUES
('keigo', '「お疲れ様です」は同僚に使い、「ご苦労様です」は目上から目下に使います。', '"Otsukaresama desu" dùng với đồng nghiệp, "Gokurosama desu" dùng từ trên xuống dưới.', 1),
('business', 'ビジネスメールでは「お世話になっております」から始めましょう。', 'Email công việc nên bắt đầu bằng "Osewa ni natte orimasu".', 2),
('keigo', '「承知しました」は「わかりました」のビジネス版です。', '"Shouchi shimashita" là phiên bản công việc của "Wakarimashita".', 4),
('culture', '名刺交換は両手で、相手の方を向いて渡しましょう。', 'Trao danh thiếp bằng hai tay, hướng mặt về phía đối phương.', 5),
('business', '「検討させていただきます」は断りの意味で使われることが多いです。', '"Kentou sasete itadakimasu" thường mang ý từ chối lịch sự.', 6),
('grammar', '敬語の3種類：尊敬語、謙譲語、丁寧語を使い分けましょう。', '3 loại kính ngữ: Sonkeigo (tôn kính), Kenjougo (khiêm nhường), Teineigo (lịch sự).', 7),
('keigo', '「申し訳ございません」は最もフォーマルな謝罪表現です。', '"Moushiwake gozaimasen" là cách xin lỗi trang trọng nhất.', 8),
('business', '「よろしくお願いいたします」は文末の締めに必須です。', '"Yoroshiku onegai itashimasu" là câu kết bắt buộc ở cuối email/văn bản.', 9),
('grammar', '「させていただく」の乱用に注意。必要な場面でだけ使いましょう。', 'Cẩn thận lạm dụng "sasete itadaku". Chỉ dùng khi thực sự cần.', 10),
('culture', '会議で「なるほど」を連発すると失礼になることがあります。', 'Nói "Naruhodo" liên tục trong cuộc họp có thể bị coi là thiếu lịch sự.', 11),
('vocab', '「打ち合わせ」(うちあわせ) = ミーティング。ビジネスでよく使います。', '"Uchiawase" = cuộc họp. Dùng rất nhiều trong công việc.', 12),
('vocab', '「納期」(のうき) = deadline。「納期に間に合う」= kịp deadline.', '"Nouki" = deadline. "Nouki ni maniau" = kịp deadline.', 13),
('keigo', '電話では「〇〇でございます」と名乗りましょう。', 'Khi nghe điện thoại, hãy nói "〇〇 de gozaimasu" để tự giới thiệu.', 14),
('business', '報告は「結論→理由→詳細」の順で。日本のビジネス基本です。', 'Báo cáo theo thứ tự "Kết luận → Lý do → Chi tiết". Đây là cơ bản trong kinh doanh Nhật.', 15);

-- Seed tip with example
INSERT INTO "content"."companion_tip" ("category", "content_ja", "content_vi", "example_ja", "example_vi", "sort_order") VALUES
('grammar', '「〜ていただけますか」は「〜てください」より丁寧です。', '"~te itadakemasu ka" lịch sự hơn "~te kudasai".', '資料を送っていただけますか？', 'Bạn có thể gửi tài liệu được không?', 3);
