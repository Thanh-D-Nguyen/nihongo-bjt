# Đồng bộ media câu hỏi BJT từ Local lên Production

Hướng dẫn sync ảnh và audio câu hỏi BJT từ local lên production. Metadata ảnh
được tách rõ: `imageAlt` là mô tả ngắn hỗ trợ người học/screen reader,
`imagePrompt` là brief chi tiết dành riêng cho bộ sinh ảnh AI. Không dùng
`imageAlt` thay cho `imagePrompt`. Schema chưa có cột `videoUrl`.

## 1. Vì sao prod bị mất ảnh?

Mỗi file media câu hỏi BJT tồn tại ở **2 nơi tách biệt**, phải sync **cả hai**:

| Thành phần                        | Lưu ở đâu                                  | Vấn đề trên prod                                                                 |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| **File ảnh/audio**                | object trong bucket MinIO (`MINIO_BUCKET`) | Prod MinIO **chưa có** object                                                    |
| **Con trỏ `imageUrl`/`audioUrl`** | cột trên bảng `BjtQuestion` (PostgreSQL)   | Prod DB chưa có, hoặc có nhưng host là local → browser người dùng không tải được |

Script gen ảnh lưu **URL đầy đủ có host cứng** (vd `http://localhost:19000/<bucket>/<key>`).
Vì vậy dù copy DB sang prod, ảnh vẫn hỏng vì host `localhost` vô nghĩa với người dùng.

→ Sync phải làm **3 việc**:

1. Copy **file object** từ MinIO local → MinIO prod.
2. Ghi `imageUrl` + `imageAlt` + `imagePrompt` + `audioUrl` vào **prod DB**.
3. **Đổi host** `localhost:19000` → domain public của prod.

---

## 2. Cách 1 (khuyến nghị): chạy script tự động

Script: [scripts/sync-bjt-images-to-prod.ts](../../scripts/sync-bjt-images-to-prod.ts)

Script đọc các câu hỏi có ảnh/audio từ **local DB**, tải object từ **local
MinIO**, đẩy lên **prod MinIO**, đặt bucket policy public-read chỉ cho
`GetObject`, rồi ghi URL đã đổi host vào **prod DB**. Idempotent — chạy lại
nhiều lần an toàn.

### Bước 1 — Khai báo biến môi trường

Tạo file `.env.sync` (hoặc export trực tiếp). Thay giá trị prod thật vào:

```bash
# ── LOCAL (nguồn) ──
LOCAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt
LOCAL_MINIO_ENDPOINT=127.0.0.1
LOCAL_MINIO_PORT=19000
LOCAL_MINIO_ACCESS_KEY=minioadmin
LOCAL_MINIO_SECRET_KEY=minioadmin
LOCAL_MINIO_USE_SSL=false

# ── PRODUCTION (đích) ──
PROD_DATABASE_URL=postgresql://USER:PASS@PROD_DB_HOST:5432/nihongo_bjt
PROD_MINIO_ENDPOINT=PROD_MINIO_HOST          # host script có thể kết nối tới (nội bộ được)
PROD_MINIO_PORT=9000
PROD_MINIO_ACCESS_KEY=...
PROD_MINIO_SECRET_KEY=...
PROD_MINIO_USE_SSL=false

# ── Chung ──
MINIO_BUCKET=nihongo-bjt-media               # phải khớp cả 2 bên

# Host browser người dùng dùng để tải ảnh (KHÔNG dấu / cuối, KHÔNG kèm bucket)
PROD_PUBLIC_BASE_URL=https://media.your-prod.com
```

> **Lưu ý mạng**: Script cần kết nối được **đồng thời** local DB/MinIO và prod
> DB/MinIO. Nếu prod chỉ truy cập được từ trong server, hãy chạy script **trên
> server prod** và trỏ `LOCAL_*` về máy local qua VPN/SSH tunnel — hoặc dùng
> [Cách 2](#3-cách-2-thủ-công-mc--sql) bên dưới.

### Bước 2 — Chạy thử (không ghi gì)

```bash
DOTENV_CONFIG_PATH=.env.sync npx tsx scripts/sync-bjt-images-to-prod.ts --dry-run
```

> Trên Windows PowerShell:
> `$env:DOTENV_CONFIG_PATH=".env.sync"; npx tsx scripts/sync-bjt-images-to-prod.ts --dry-run`

Kiểm tra danh sách object sẽ upload và `imageUrl` mới. Nếu đúng → chạy thật.
Dry-run không ghi bucket/database và sẽ báo rõ hai trường metadata ảnh được giữ
nguyên.

### Bước 3 — Chạy thật

```bash
DOTENV_CONFIG_PATH=.env.sync npx tsx scripts/sync-bjt-images-to-prod.ts
```

Tùy chọn:

- `--dry-run` : chỉ in, không ghi.
- `--force` : upload lại object kể cả khi prod đã có.

### Bước 4 — Kiểm tra

```sql
-- Trên prod DB: phải = 0
SELECT count(*) FROM "BjtQuestion" WHERE "imageUrl" LIKE '%localhost%';
```

Mở thử 1 `imageUrl` hoặc `audioUrl` prod trên browser → phải tải được media.

---

## 3. Cách 2 (thủ công): `mc` + SQL

Dùng khi không chạy được script (mạng tách biệt). Cần [MinIO Client `mc`].

### 3.1 — Copy file: local MinIO → prod MinIO

```bash
mc alias set localminio http://localhost:19000      <LOCAL_KEY> <LOCAL_SECRET>
mc alias set prodminio  https://minio.your-prod.com <PROD_KEY>  <PROD_SECRET>

# Mirror bucket (chỉ thêm/ghi đè, không xoá)
mc mirror --overwrite localminio/nihongo-bjt-media prodminio/nihongo-bjt-media
```

### 3.2 — Sync `imageUrl` + `imageAlt` + `imagePrompt` vào prod DB (đổi host luôn)

```bash
# Dump từ local
PGPASSWORD=postgres psql -h 127.0.0.1 -p 15432 -U postgres -d nihongo_bjt -At -F$'\t' -c \
"SELECT id, \"imageUrl\", COALESCE(\"imageAlt\",''), COALESCE(\"imagePrompt\",'') FROM \"BjtQuestion\" WHERE \"imageUrl\" IS NOT NULL;" \
> /tmp/bjt_images.tsv
```

Trên prod:

```sql
CREATE TEMP TABLE bjt_img(id text, image_url text, image_alt text, image_prompt text);
\COPY bjt_img FROM '/tmp/bjt_images.tsv' WITH (FORMAT text, DELIMITER E'\t');

UPDATE "BjtQuestion" q
SET "imageUrl" = replace(b.image_url,
                         'http://localhost:19000',
                         'https://media.your-prod.com'),
    "imageAlt" = NULLIF(b.image_alt, ''),
    "imagePrompt" = NULLIF(b.image_prompt, '')
FROM bjt_img b
WHERE q.id = b.id;
```

---

## 4. Sửa gốc (để lần sau không lặp lại)

Trước khi sinh ảnh thật, luôn chạy validation/dry-run:

```bash
DATABASE_URL=postgresql://... npx tsx data/generated/generate-ai-images.ts --dry-run
```

Lệnh này không cần `OPENAI_API_KEY`, không gọi/ghi MinIO, dùng `imagePrompt` để
preview prompt thật và trả exit code khác 0 nếu câu cần sinh ảnh thiếu
`imageAlt` hoặc `imagePrompt`.

Generator đọc trực tiếp `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_BUCKET`,
`MINIO_PUBLIC_*`, access key và secret từ environment; không có bucket/port
hard-code riêng. Mỗi ảnh sinh thật đồng thời upsert một `media.asset` chứa
checksum, object key, model/provider, prompt hash, thời điểm tạo, license,
accessibility alt và `rightsStatus=cleared`. Script sync giữ metadata này trên
production và cập nhật `qualityFlags.imageGeneration.mediaAssetId` theo asset id
của production.

Nguyên nhân thật sự: **lưu full URL có host cứng vào DB**. Khuyến nghị:

- **Tốt nhất**: script gen chỉ lưu **object key** (vd `bjt/questions/abc.png`) vào
  `imageUrl`, để API tự dựng URL theo `MINIO_PUBLIC_ENDPOINT` của từng môi trường
  (giống pattern `presignedGetForObjectKey` đang dùng cho flashcards/media).
- **Tối thiểu**: script đọc host từ env (`MINIO_PUBLIC_ENDPOINT`) thay vì hardcode
  `localhost:19000`, và chạy script trỏ thẳng vào prod thay vì sync thủ công.

[MinIO Client `mc`]: https://min.io/docs/minio/linux/reference/minio-mc.html
