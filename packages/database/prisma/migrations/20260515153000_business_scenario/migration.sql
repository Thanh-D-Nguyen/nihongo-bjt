CREATE TABLE "content"."business_scenario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "title_vi" VARCHAR(200) NOT NULL,
    "title_ja" VARCHAR(200),
    "description_vi" VARCHAR(500),
    "difficulty" VARCHAR(20) NOT NULL DEFAULT 'intermediate',
    "category" VARCHAR(30) NOT NULL DEFAULT 'email',
    "icon_emoji" VARCHAR(10) NOT NULL DEFAULT '💼',
    "estimated_min" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_scenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_scenario_slug_key" ON "content"."business_scenario"("slug");
CREATE INDEX "idx_scenario_active" ON "content"."business_scenario"("active", "category", "sort_order");

CREATE TABLE "content"."scenario_step" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scenario_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "situation_vi" TEXT NOT NULL,
    "situation_ja" TEXT,
    "speaker_name" VARCHAR(50),
    "speaker_role" VARCHAR(50),
    CONSTRAINT "scenario_step_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scenario_step_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "content"."business_scenario"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_scenario_step_order" ON "content"."scenario_step"("scenario_id", "step_order");

CREATE TABLE "content"."scenario_choice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "step_id" UUID NOT NULL,
    "choice_key" VARCHAR(5) NOT NULL,
    "text_vi" VARCHAR(500) NOT NULL,
    "text_ja" VARCHAR(500),
    "is_optimal" BOOLEAN NOT NULL DEFAULT false,
    "feedback_vi" VARCHAR(500),
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scenario_choice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scenario_choice_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "content"."scenario_step"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_scenario_choice_step" ON "content"."scenario_choice"("step_id");

CREATE TABLE "content"."user_scenario_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "max_points" INTEGER NOT NULL DEFAULT 0,
    "choices" JSONB NOT NULL DEFAULT '[]',
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_scenario_attempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_scenario_attempt_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "content"."business_scenario"("id")
);
CREATE INDEX "idx_scenario_attempt_user" ON "content"."user_scenario_attempt"("user_id", "scenario_id");

-- Seed: Business email scenario
INSERT INTO "content"."business_scenario" (slug, title_vi, title_ja, description_vi, difficulty, category, icon_emoji, estimated_min, sort_order) VALUES
  ('email-late-meeting', 'Email xin lỗi đến muộn họp', '会議に遅刻のお詫びメール', 'Bạn đến muộn 15 phút cho cuộc họp với khách hàng. Hãy gửi email xin lỗi phù hợp.', 'beginner', 'email', '📧', 3, 1),
  ('phone-complaint', 'Xử lý khiếu nại qua điện thoại', '電話でのクレーム対応', 'Khách hàng gọi phàn nàn về sản phẩm bị lỗi. Hãy xử lý cuộc gọi theo chuẩn keigo.', 'intermediate', 'phone', '📞', 5, 2),
  ('meeting-proposal', 'Trình bày đề xuất trong họp', '会議での提案プレゼン', 'Bạn cần thuyết phục ban quản lý chấp nhận đề xuất cải tiến quy trình. Dùng keigo đúng cấp.', 'advanced', 'meeting', '🏢', 7, 3);

-- Seed steps and choices for first scenario
DO $$
DECLARE
  scenario_id UUID;
  step1_id UUID;
  step2_id UUID;
  step3_id UUID;
BEGIN
  SELECT id INTO scenario_id FROM "content"."business_scenario" WHERE slug = 'email-late-meeting';

  INSERT INTO "content"."scenario_step" (id, scenario_id, step_order, situation_vi, situation_ja, speaker_name, speaker_role) VALUES
    (gen_random_uuid(), scenario_id, 1, 'Bạn đến muộn 15 phút cho cuộc họp với đối tác Tanaka-san từ công ty ABC. Bạn cần gửi email xin lỗi ngay. Hãy chọn dòng tiêu đề phù hợp nhất.', '田中さんとの会議に15分遅刻しました。お詫びのメールを送る必要があります。', 'Hệ thống', 'Narrator')
  RETURNING id INTO step1_id;

  INSERT INTO "content"."scenario_choice" (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded) VALUES
    (step1_id, 'A', '件名: 遅刻のお詫び (Xin lỗi về việc đến muộn)', '件名: 遅刻のお詫び', true, 'Chuẩn keigo! Ngắn gọn, rõ ràng, thể hiện sự xin lỗi ngay từ tiêu đề.', 10),
    (step1_id, 'B', '件名: すみません (Xin lỗi)', '件名: すみません', false, 'Quá chung chung. Trong business email, cần nêu rõ nội dung ở tiêu đề.', 3),
    (step1_id, 'C', '件名: 会議について (Về cuộc họp)', '件名: 会議について', false, 'Không thể hiện được việc xin lỗi. Đối tác có thể nhầm đây là email thông thường.', 5);

  INSERT INTO "content"."scenario_step" (id, scenario_id, step_order, situation_vi, situation_ja, speaker_name, speaker_role) VALUES
    (gen_random_uuid(), scenario_id, 2, 'Tốt lắm! Bây giờ hãy viết phần mở đầu email. Tanaka-san là trưởng phòng kinh doanh (営業部長). Chọn cách xưng hô phù hợp.', '次はメールの書き出しです。田中さんは営業部長です。', 'Hệ thống', 'Narrator')
  RETURNING id INTO step2_id;

  INSERT INTO "content"."scenario_choice" (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded) VALUES
    (step2_id, 'A', 'ABC株式会社 営業部長 田中様 (Công ty ABC, Trưởng phòng KD, Tanaka-sama)', 'ABC株式会社 営業部長 田中様', true, 'Hoàn hảo! Đúng thứ tự: Tên công ty → Chức vụ → Họ + sama.', 10),
    (step2_id, 'B', '田中さんへ (Gửi Tanaka-san)', '田中さんへ', false, 'Quá thân mật cho business email với đối tác ngoài. Cần dùng 様 và nêu chức vụ.', 2),
    (step2_id, 'C', '田中部長殿 (Trưởng phòng Tanaka)', '田中部長殿', false, '殿 ít dùng trong email hiện đại, có thể gây cảm giác kỳ lạ. Nên dùng 様.', 5);

  INSERT INTO "content"."scenario_step" (id, scenario_id, step_order, situation_vi, situation_ja, speaker_name, speaker_role) VALUES
    (gen_random_uuid(), scenario_id, 3, 'Cuối cùng, hãy chọn câu kết thúc email phù hợp nhất.', '最後に、メールの結びの言葉を選んでください。', 'Hệ thống', 'Narrator')
  RETURNING id INTO step3_id;

  INSERT INTO "content"."scenario_choice" (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded) VALUES
    (step3_id, 'A', '今後このようなことがないよう十分注意いたします。何卒よろしくお願い申し上げます。', '今後このようなことがないよう十分注意いたします。何卒よろしくお願い申し上げます。', true, 'Tuyệt vời! Cam kết không tái phạm + kết thúc khiêm nhường.', 10),
    (step3_id, 'B', 'すみませんでした。よろしくお願いします。', 'すみませんでした。よろしくお願いします。', false, 'Quá đơn giản cho business email. Cần thể hiện cam kết cải thiện.', 4),
    (step3_id, 'C', '以上、よろしくお願いいたします。', '以上、よろしくお願いいたします。', false, 'Thiếu phần xin lỗi/cam kết. "以上" nghe quá cộc lốc cho email xin lỗi.', 3);
END $$;
