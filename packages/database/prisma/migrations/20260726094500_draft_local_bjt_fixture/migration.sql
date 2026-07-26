UPDATE "assessment"."bjt_mock_test"
SET
  "description" = 'Development-only canonical-content fixture; never publish to learners.',
  "status" = 'draft',
  "title_vi" = 'Bài luyện nội dung nền tảng (development)',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'local-bjt-practice-01';
