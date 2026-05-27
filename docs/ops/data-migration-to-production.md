# Chuyển dữ liệu Local → Production

> Hướng dẫn migrate dữ liệu nội dung (từ vựng, ngữ pháp, kanji, ví dụ câu) và seed data từ môi trường phát triển lên production.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Phân loại dữ liệu](#2-phân-loại-dữ-liệu)
3. [Chuẩn bị trước khi migrate](#3-chuẩn-bị-trước-khi-migrate)
4. [Phương pháp 1: Export/Import toàn bộ content schema](#4-phương-pháp-1-exportimport-toàn-bộ-content-schema)
5. [Phương pháp 2: Chạy seed scripts trực tiếp trên production](#5-phương-pháp-2-chạy-seed-scripts-trực-tiếp-trên-production)
6. [Phương pháp 3: Selective pg_dump theo bảng](#6-phương-pháp-3-selective-pg_dump-theo-bảng)
7. [Post-migration: Đồng bộ Meilisearch](#7-post-migration-đồng-bộ-meilisearch)
8. [Xác minh sau migrate](#8-xác-minh-sau-migrate)
9. [Rollback](#9-rollback)
10. [Quy trình cập nhật nội dung recurring](#10-quy-trình-cập-nhật-nội-dung-recurring)

---

## 1. Tổng quan

Hệ thống NihonGo BJT chia dữ liệu thành 2 nhóm chính:

- **Dữ liệu cấu trúc (schema/migrations)**: Do Prisma quản lý → `prisma migrate deploy`
- **Dữ liệu nội dung (content data)**: Từ vựng, kanji, ngữ pháp, ví dụ câu, bài thi BJT, daily content, radar... → cần migrate riêng

Schema **phải chạy trước**, content data chạy sau.

---

## 2. Phân loại dữ liệu

### 2.1 Content Schema (`content.*`) — Dữ liệu học tập cốt lõi

| Bảng | Mô tả | Ước lượng |
|------|--------|-----------|
| `content.lexeme` | Từ vựng (headword, reading, JLPT level) | 5,000+ |
| `content.lexeme_sense` | Nghĩa của từ (pos, meaning_vi) | 10,000+ |
| `content.lexeme_sense_example` | Link ví dụ cho nghĩa từ | 15,000+ |
| `content.lexeme_reverse_projection` | Từ điển Việt→Nhật | 3,000+ |
| `content.lexeme_reverse_candidate` | Ứng viên dịch ngược | 5,000+ |
| `content.lexeme_reverse_candidate_example` | Ví dụ cho ứng viên dịch ngược | 8,000+ |
| `content.kanji` | Kanji (character, meaning, onyomi, kunyomi) | 2,136+ |
| `content.kanji_example` | Từ ghép kanji (word, reading, meaning_vi) | 10,000+ |
| `content.kanji_component` | Bộ thủ / thành phần kanji | 5,000+ |
| `content.grammar_point` | Ngữ pháp (pattern, meaning_vi, JLPT level) | 800+ |
| `content.grammar_point_detail` | Chi tiết ngữ pháp (explanation, note) | 2,000+ |
| `content.grammar_point_detail_example` | Ví dụ cho chi tiết ngữ pháp | 5,000+ |
| `content.example_sentence` | Câu ví dụ (japanese_text, reading, translation_vi) | 20,000+ |
| `content.lexeme_audio` | Audio phát âm từ vựng | varies |
| `content.example_sentence_audio` | Audio ví dụ câu | varies |
| `content.entity_import_provenance` | Provenance/tracking import batch | varies |

### 2.2 Foundation & Application Data

| Nhóm | Bảng ví dụ | Seed script |
|------|------------|-------------|
| Foundation (i18n, locales) | `locale`, `i18n_namespace`, `i18n_key` | `apps/api/scripts/seed-foundation.ts` |
| Admin accounts | `admin_actor`, Keycloak roles | `apps/api/scripts/seed-admin.ts` |
| BJT Assessment | `bjt_exam`, `bjt_question`, `bjt_section` | `database/scripts/seed-bjt-assessment.ts` |
| BJT Expansion | Thêm đề thi | `database/scripts/seed-bjt-expansion.ts` |
| Daily content | `daily_phrase`, `daily_kanji` | `apps/api/scripts/seed-daily.ts` |
| Daily radar | `daily_radar_article` | `apps/api/scripts/seed-daily-radar.ts` |
| Monetization | `plan`, `entitlement` | `apps/api/scripts/seed-monetization.ts` |
| Ads | `ad_placement` | `apps/api/scripts/seed-ads-defaults.ts` |
| Career RPG | `career_rpg_*` | `apps/api/scripts/seed-career-rpg.ts` |
| Gamification | Badges, levels | `database/scripts/seed-gamification.ts` |
| Quiz | Quiz templates | `apps/api/scripts/seed-quiz.ts` |
| Battle | Battle configs | `database/scripts/seed-battle.ts` |
| Radar articles | 30+ seed scripts | `scripts/seed-radar-*.mjs` |
| Magazine | Magazine content | `scripts/seed-magazine*.mjs` |

---

## 3. Chuẩn bị trước khi migrate

### 3.1 Checklist

- [ ] Production database đã chạy `prisma migrate deploy` thành công
- [ ] Tất cả schemas (`content`, `public`, `learning`, `authz`, `growth`) đã được tạo
- [ ] Có kết nối SSH/tunnel tới production DB
- [ ] Biết chính xác `DATABASE_URL` production
- [ ] Backup production DB trước khi migrate (dù DB mới)

### 3.2 Tạo SSH tunnel (nếu DB không public)

```bash
# Từ máy local → production server → PostgreSQL internal
ssh -N -L 25432:127.0.0.1:5432 user@your-production-server.com

# Giờ có thể connect qua localhost:25432
```

### 3.3 Set biến môi trường

```bash
# Local DB (nguồn)
export LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt"

# Production DB (đích) — qua tunnel hoặc managed DB endpoint
export PROD_DB="postgresql://nihongo_app:<PASSWORD>@127.0.0.1:25432/nihongo_bjt?sslmode=require"
```

---

## 4. Phương pháp 1: Export/Import toàn bộ content schema

**Khuyến nghị khi**: Muốn migrate toàn bộ dữ liệu content đã verified ở local.

### 4.1 Export từ local

```bash
# Export CHỈ content schema (không user data, không auth data)
pg_dump "$LOCAL_DB" \
  --schema=content \
  --data-only \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=content_data_$(date +%Y%m%d).dump

# Kiểm tra size
ls -lh content_data_*.dump
```

### 4.2 Import vào production

```bash
# ⚠️ Đảm bảo schema content đã tồn tại (prisma migrate deploy đã chạy)
pg_restore \
  --dbname="$PROD_DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --verbose \
  content_data_$(date +%Y%m%d).dump
```

### 4.3 Nếu bị conflict (dữ liệu đã tồn tại)

```bash
# Option A: Xóa data cũ trước (CẨNTHẬN — chỉ làm khi production chưa có user)
psql "$PROD_DB" -c "
  TRUNCATE content.example_sentence CASCADE;
  TRUNCATE content.lexeme CASCADE;
  TRUNCATE content.kanji CASCADE;
  TRUNCATE content.grammar_point CASCADE;
  TRUNCATE content.lexeme_reverse_projection CASCADE;
"

# Option B: Dùng --on-conflict-do-nothing (cần pg_restore flag)
# Hoặc import qua SQL COPY với ON CONFLICT
```

---

## 5. Phương pháp 2: Chạy seed scripts trực tiếp trên production

**Khuyến nghị khi**: Deploy lần đầu, muốn kiểm soát từng bước.

### 5.1 Thứ tự chạy seed scripts

```bash
# Set DATABASE_URL trỏ tới production
export DATABASE_URL="$PROD_DB"

# ═══════════════════════════════════════════════════════════════
# BƯỚC 1: Foundation (bắt buộc chạy trước)
# ═══════════════════════════════════════════════════════════════
npx tsx apps/api/scripts/seed-foundation.ts
npx tsx apps/api/scripts/seed-admin.ts
npx tsx apps/api/scripts/seed-monetization.ts
npx tsx apps/api/scripts/seed-ads-defaults.ts

# ═══════════════════════════════════════════════════════════════
# BƯỚC 2: Content cốt lõi (từ vựng, ngữ pháp, kanji, ví dụ)
# ═══════════════════════════════════════════════════════════════
node scripts/seed-content.mjs
node scripts/seed-content-expansion.mjs

# ═══════════════════════════════════════════════════════════════
# BƯỚC 3: BJT Assessment (đề thi)
# ═══════════════════════════════════════════════════════════════
npx tsx database/scripts/seed-bjt-assessment.ts
npx tsx database/scripts/seed-bjt-expansion.ts
npx tsx database/scripts/seed-bjt-expansion-wave2.ts

# ═══════════════════════════════════════════════════════════════
# BƯỚC 4: Learning features
# ═══════════════════════════════════════════════════════════════
npx tsx database/scripts/seed-exercises.ts
npx tsx database/scripts/seed-learning-practice.ts
npx tsx database/scripts/seed-gamification.ts
npx tsx database/scripts/seed-battle.ts
npx tsx apps/api/scripts/seed-quiz.ts
npx tsx apps/api/scripts/seed-growth.ts

# ═══════════════════════════════════════════════════════════════
# BƯỚC 5: Daily content & Radar
# ═══════════════════════════════════════════════════════════════
npx tsx apps/api/scripts/seed-daily.ts
npx tsx apps/api/scripts/seed-daily-radar.ts
node scripts/seed-daily-content.mjs
node scripts/seed-daily-content-vi.mjs

# Radar articles (chạy tất cả — idempotent)
for f in scripts/seed-radar-*.mjs; do
  echo "Running $f..."
  node "$f"
done

# ═══════════════════════════════════════════════════════════════
# BƯỚC 6: Magazine & Career RPG
# ═══════════════════════════════════════════════════════════════
node scripts/seed-magazine.mjs
node scripts/seed-magazine-3months.mjs
npx tsx apps/api/scripts/seed-career-rpg.ts
node scripts/seed-career-rpg.mjs
node scripts/seed-career-rpg-full.mjs

# ═══════════════════════════════════════════════════════════════
# BƯỚC 7: BJT Lessons
# ═══════════════════════════════════════════════════════════════
node scripts/seed-bjt-lessons.mjs
```

### 5.2 Chạy batch cho nhanh (một lệnh)

```bash
# Script chạy tất cả theo đúng thứ tự
export DATABASE_URL="$PROD_DB"

echo "=== Step 1: Foundation ===" && \
npx tsx apps/api/scripts/seed-foundation.ts && \
npx tsx apps/api/scripts/seed-admin.ts && \
npx tsx apps/api/scripts/seed-monetization.ts && \
npx tsx apps/api/scripts/seed-ads-defaults.ts && \
echo "=== Step 2: Content ===" && \
node scripts/seed-content.mjs && \
node scripts/seed-content-expansion.mjs && \
echo "=== Step 3: BJT ===" && \
npx tsx database/scripts/seed-bjt-assessment.ts && \
npx tsx database/scripts/seed-bjt-expansion.ts && \
npx tsx database/scripts/seed-bjt-expansion-wave2.ts && \
echo "=== Step 4: Learning ===" && \
npx tsx database/scripts/seed-exercises.ts && \
npx tsx database/scripts/seed-learning-practice.ts && \
npx tsx database/scripts/seed-gamification.ts && \
npx tsx database/scripts/seed-battle.ts && \
npx tsx apps/api/scripts/seed-quiz.ts && \
npx tsx apps/api/scripts/seed-growth.ts && \
echo "=== Step 5: Daily ===" && \
npx tsx apps/api/scripts/seed-daily.ts && \
npx tsx apps/api/scripts/seed-daily-radar.ts && \
node scripts/seed-daily-content.mjs && \
node scripts/seed-daily-content-vi.mjs && \
echo "=== Step 6: Radar ===" && \
for f in scripts/seed-radar-*.mjs; do node "$f"; done && \
echo "=== Step 7: Magazine & RPG ===" && \
node scripts/seed-magazine.mjs && \
node scripts/seed-magazine-3months.mjs && \
npx tsx apps/api/scripts/seed-career-rpg.ts && \
node scripts/seed-career-rpg.mjs && \
node scripts/seed-career-rpg-full.mjs && \
node scripts/seed-bjt-lessons.mjs && \
echo "=== ALL DONE ==="
```

---

## 6. Phương pháp 3: Selective pg_dump theo bảng

**Khuyến nghị khi**: Chỉ muốn migrate một số bảng cụ thể (ví dụ: chỉ từ vựng + kanji).

### 6.1 Export từng bảng

```bash
# Chỉ từ vựng (lexeme + senses + examples)
pg_dump "$LOCAL_DB" \
  --data-only --no-owner --format=custom \
  --table=content.lexeme \
  --table=content.lexeme_sense \
  --table=content.lexeme_sense_example \
  --table=content.lexeme_audio \
  --file=lexeme_data.dump

# Chỉ kanji
pg_dump "$LOCAL_DB" \
  --data-only --no-owner --format=custom \
  --table=content.kanji \
  --table=content.kanji_example \
  --table=content.kanji_component \
  --file=kanji_data.dump

# Chỉ ngữ pháp
pg_dump "$LOCAL_DB" \
  --data-only --no-owner --format=custom \
  --table=content.grammar_point \
  --table=content.grammar_point_detail \
  --table=content.grammar_point_detail_example \
  --file=grammar_data.dump

# Chỉ ví dụ câu
pg_dump "$LOCAL_DB" \
  --data-only --no-owner --format=custom \
  --table=content.example_sentence \
  --table=content.example_sentence_audio \
  --file=example_sentence_data.dump

# Từ điển ngược (Việt→Nhật)
pg_dump "$LOCAL_DB" \
  --data-only --no-owner --format=custom \
  --table=content.lexeme_reverse_projection \
  --table=content.lexeme_reverse_candidate \
  --table=content.lexeme_reverse_candidate_example \
  --file=reverse_dict_data.dump
```

### 6.2 Import vào production

```bash
# Thứ tự quan trọng (do FK dependencies):
# 1. example_sentence trước (vì lexeme_sense_example tham chiếu)
# 2. lexeme + kanji + grammar
# 3. Các bảng link

pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers example_sentence_data.dump
pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers lexeme_data.dump
pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers kanji_data.dump
pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers grammar_data.dump
pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers reverse_dict_data.dump
```

### 6.3 Export dạng SQL (text) — dễ review

```bash
# Export thành SQL INSERT statements (có thể review trước khi chạy)
pg_dump "$LOCAL_DB" \
  --schema=content \
  --data-only \
  --no-owner \
  --inserts \
  --on-conflict-do-nothing \
  --file=content_inserts.sql

# Review
head -100 content_inserts.sql
wc -l content_inserts.sql

# Import
psql "$PROD_DB" -f content_inserts.sql
```

---

## 7. Post-migration: Đồng bộ Meilisearch

Sau khi data đã vào PostgreSQL production, cần rebuild Meilisearch indexes:

```bash
# Chạy trên production server (hoặc qua SSH)
export DATABASE_URL="$PROD_DB"
export MEILI_HOST="http://127.0.0.1:7700"
export MEILI_MASTER_KEY="<PRODUCTION_MEILI_KEY>"

# Re-index toàn bộ
npx tsx apps/api/scripts/index-search.ts

# Verify
curl -s "http://127.0.0.1:7700/indexes" \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" | jq '.results[] | {uid, numberOfDocuments}'
```

---

## 8. Xác minh sau migrate

### 8.1 Đếm records

```bash
psql "$PROD_DB" -c "
  SELECT 'lexeme' as table_name, count(*) FROM content.lexeme
  UNION ALL SELECT 'lexeme_sense', count(*) FROM content.lexeme_sense
  UNION ALL SELECT 'kanji', count(*) FROM content.kanji
  UNION ALL SELECT 'kanji_example', count(*) FROM content.kanji_example
  UNION ALL SELECT 'grammar_point', count(*) FROM content.grammar_point
  UNION ALL SELECT 'grammar_point_detail', count(*) FROM content.grammar_point_detail
  UNION ALL SELECT 'example_sentence', count(*) FROM content.example_sentence
  UNION ALL SELECT 'lexeme_reverse_projection', count(*) FROM content.lexeme_reverse_projection
  ORDER BY table_name;
"
```

### 8.2 So sánh local vs production

```bash
# Chạy cùng query trên local
psql "$LOCAL_DB" -c "SELECT 'lexeme', count(*) FROM content.lexeme UNION ALL SELECT 'kanji', count(*) FROM content.kanji UNION ALL SELECT 'grammar_point', count(*) FROM content.grammar_point UNION ALL SELECT 'example_sentence', count(*) FROM content.example_sentence;"

# So sánh con số — phải bằng nhau
```

### 8.3 Spot-check nội dung

```bash
# Kiểm tra từ vựng random
psql "$PROD_DB" -c "SELECT headword, reading, jlpt_level, short_meaning_vi FROM content.lexeme ORDER BY random() LIMIT 5;"

# Kiểm tra kanji
psql "$PROD_DB" -c "SELECT character, meaning_vi, onyomi, kunyomi, stroke_count FROM content.kanji ORDER BY random() LIMIT 5;"

# Kiểm tra grammar
psql "$PROD_DB" -c "SELECT pattern, meaning_vi, jlpt_level FROM content.grammar_point ORDER BY random() LIMIT 5;"

# Kiểm tra ví dụ câu
psql "$PROD_DB" -c "SELECT japanese_text, translation_vi FROM content.example_sentence ORDER BY random() LIMIT 5;"
```

### 8.4 Kiểm tra FK integrity

```bash
psql "$PROD_DB" -c "
  -- Lexeme senses pointing to non-existent lexeme
  SELECT count(*) as orphan_senses
  FROM content.lexeme_sense ls
  LEFT JOIN content.lexeme l ON ls.lexeme_id = l.id
  WHERE l.id IS NULL;

  -- Kanji examples pointing to non-existent kanji
  SELECT count(*) as orphan_kanji_examples
  FROM content.kanji_example ke
  LEFT JOIN content.kanji k ON ke.kanji_id = k.id
  WHERE k.id IS NULL;
"
```

### 8.5 API smoke test

```bash
# Verify API returns content
curl -s https://api.nihongo-bjt.com/api/dictionary/search?q=会議 | jq '.total'
curl -s https://api.nihongo-bjt.com/api/kanji/日 | jq '.character, .meaningVi'
curl -s https://api.nihongo-bjt.com/api/grammar?level=N3 | jq '.total'
```

---

## 9. Rollback

### Nếu data bị sai

```bash
# Option A: Restore từ backup (đã tạo ở bước 3)
pg_restore --dbname="$PROD_DB" --clean --no-owner pre_migration_backup.dump

# Option B: Chỉ truncate content và re-import
psql "$PROD_DB" -c "
  TRUNCATE content.lexeme_sense_example CASCADE;
  TRUNCATE content.lexeme_reverse_candidate_example CASCADE;
  TRUNCATE content.grammar_point_detail_example CASCADE;
  TRUNCATE content.lexeme_sense CASCADE;
  TRUNCATE content.lexeme_reverse_candidate CASCADE;
  TRUNCATE content.grammar_point_detail CASCADE;
  TRUNCATE content.lexeme CASCADE;
  TRUNCATE content.kanji CASCADE;
  TRUNCATE content.grammar_point CASCADE;
  TRUNCATE content.example_sentence CASCADE;
  TRUNCATE content.lexeme_reverse_projection CASCADE;
  TRUNCATE content.kanji_example CASCADE;
  TRUNCATE content.kanji_component CASCADE;
"
# Rồi import lại
```

---

## 10. Quy trình cập nhật nội dung recurring

Khi thêm content mới (từ vựng, bài radar, magazine...) ở local và muốn đẩy lên production:

### 10.1 Incremental update (thêm mới, không xóa)

```bash
# Export CHỈ dữ liệu mới (dựa vào created_at)
SINCE="2026-05-01"

psql "$LOCAL_DB" -c "
  COPY (
    SELECT * FROM content.lexeme WHERE created_at >= '$SINCE'
  ) TO STDOUT WITH CSV HEADER
" > new_lexemes.csv

# Import vào production
psql "$PROD_DB" -c "
  COPY content.lexeme FROM STDIN WITH CSV HEADER
" < new_lexemes.csv
```

### 10.2 Re-run seed scripts (idempotent)

Tất cả seed scripts trong project đều được viết idempotent (dùng `ON CONFLICT DO NOTHING` hoặc upsert). Có thể chạy lại an toàn:

```bash
export DATABASE_URL="$PROD_DB"

# Ví dụ: thêm radar articles mới
node scripts/seed-radar-news-4.mjs

# Thêm daily content mới
node scripts/seed-daily-content.mjs
```

### 10.3 Sau mỗi lần update content

```bash
# Re-index Meilisearch
npx tsx apps/api/scripts/index-search.ts

# Verify counts tăng
psql "$PROD_DB" -c "SELECT count(*) FROM content.lexeme;"
```

---

## Lưu ý quan trọng

1. **KHÔNG migrate dữ liệu user** (learning progress, flashcard decks, battle history) — đó là dữ liệu production của user thật.
2. **Audio files** (trong MinIO/S3) cần migrate riêng — xem `docs/ops/backup-restore.md` phần MinIO mirror.
3. **UUID primary keys** — khi export/import, UUID sẽ được giữ nguyên. Không cần lo mapping ID.
4. **Timezone** — tất cả timestamps dùng `timestamptz`. Đảm bảo server production set đúng timezone.
5. **Idempotent scripts** — tất cả seed scripts dùng `ON CONFLICT DO NOTHING` hoặc upsert, chạy lại không gây duplicate.
6. **Sequence reset** — nếu dùng serial/sequence (hầu hết bảng dùng UUID nên không cần), chạy:
   ```sql
   SELECT setval(pg_get_serial_sequence('table_name', 'id'), max(id)) FROM table_name;
   ```

---

## Quick Reference: Lệnh hay dùng

```bash
# Full content export (local → file)
pg_dump "$LOCAL_DB" --schema=content --data-only --no-owner -Fc -f content.dump

# Full content import (file → production)
pg_restore --dbname="$PROD_DB" --data-only --no-owner --disable-triggers content.dump

# Count tất cả content tables
psql "$PROD_DB" -c "
  SELECT schemaname || '.' || relname as table, n_live_tup as rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'content'
  ORDER BY n_live_tup DESC;
"

# Re-index search after import
npx tsx apps/api/scripts/index-search.ts
```
