# Gen & cập nhật ảnh câu hỏi BJT (xKiro / provider khác)

Runbook cho toàn bộ vòng đời ảnh câu hỏi BJT: sinh ảnh bằng API xKiro (hoặc
provider khác), lưu vào MinIO + DB, rồi đưa lên production.

- Script sinh ảnh: [data/generated/generate-ai-images.ts](../../data/generated/generate-ai-images.ts)
- Adapter provider: [scripts/lib/bjt-image-generation-provider.ts](../../scripts/lib/bjt-image-generation-provider.ts)
- Checkpoint job async: [scripts/lib/bjt-image-job-store.ts](../../scripts/lib/bjt-image-job-store.ts)
- Script sync local → prod: [scripts/sync-bjt-images-to-prod.ts](../../scripts/sync-bjt-images-to-prod.ts)
- Chi tiết sync media: [sync-bjt-question-images.md](./sync-bjt-question-images.md)

---

## 0. Provider nào cũng chạy được

`IMAGE_PROVIDER` chọn provider, không cần sửa code khi đổi nhà cung cấp:

| Provider       | Kiểu API                                       | Key                       | Chi phí                        |
| -------------- | ---------------------------------------------- | ------------------------- | ------------------------------ |
| `xkiro`        | **Job bất đồng bộ** (submit → poll → tải CDN)  | `XKIRO_API_KEY`           | 1 đơn vị / ảnh                 |
| `openai`       | Inline `POST /images/generations` (`b64_json`) | `OPENAI_API_KEY`          | ~$0.011 / ảnh                  |
| `omniroute`    | Inline OpenAI-compatible (gateway local)       | `OPENAI_API_KEY` (tuỳ)    | theo gateway                   |
| `pollinations` | Inline image URL                               | không cần                 | miễn phí                       |

`IMAGE_API_KEY` là key chung, ưu tiên cao nhất. Key **không bị dùng lẫn giữa các
nhà cung cấp**: key OpenAI không bao giờ được gửi sang xKiro và ngược lại.

Thêm provider mới sau này: khai báo trong union `BjtImageProvider`, thêm default
`baseUrl`/`model`, và thêm nhánh trong `fetchOnce`. Nếu provider đó cũng dùng job
bất đồng bộ thì thêm tên vào `ASYNC_JOB_PROVIDERS` — toàn bộ phần poll, resume,
concurrency và retry dùng lại được ngay.

### xKiro chạy kiểu bulk hay từng cái?

xKiro **không có endpoint batch**. Nhưng `POST /v1/images/generations` trả về
`202` kèm job id ngay lập tức, còn ảnh mất *vài chục giây đến vài phút* mới xong.
Vì vậy script gửi **nhiều job song song** (mặc định `IMAGE_CONCURRENCY=3`) rồi
poll từng job — nhanh hơn tuần tự rất nhiều mà vẫn nằm dưới hạn mức "số job
đang chạy đồng thời" của xKiro. Provider inline (`openai`, `pollinations`) giữ
mặc định `IMAGE_CONCURRENCY=1` để không vượt rate limit mỗi request.

### Các lớp chống lỗi

| Cơ chế                | Chi tiết                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Retry có backoff      | `IMAGE_MAX_ATTEMPTS` (mặc định 3), delay `IMAGE_RETRY_DELAY_MS × 2^n`. Chỉ retry 429/502/503/504/timeout.  |
| Job `failed`          | xKiro **không tính phí** → coi là retryable, submit job mới.                                              |
| Job `blocked`         | xKiro **vẫn tính phí** → **không retry**, báo riêng `🚫 blocked` để sửa `imagePrompt` rồi chạy lại.        |
| Checkpoint resume     | Job id được ghi xuống `IMAGE_JOB_CHECKPOINT` ngay khi tạo. Chạy lại → resume job cũ, không trả tiền 2 lần. |
| Hash brief            | Checkpoint chỉ resume khi provider + model + hash của `imagePrompt` khớp. Sửa prompt → job cũ bị bỏ.       |
| Timeout poll          | `IMAGE_POLL_TIMEOUT_MS` (mặc định 10 phút) để không treo vô hạn.                                          |
| Chặn ảnh lỗi          | Chỉ nhận `https`, content-type ảnh, và kích thước ≤ `IMAGE_MAX_BYTES` (mặc định 15MB).                     |
| Idempotent            | Câu đã có `imageUrl` chứa `/ai/` bị bỏ qua, trừ khi `FORCE_REGENERATE=true`.                              |
| Rào an toàn prod      | Ghi vào DB không phải localhost bắt buộc `ALLOW_REMOTE_TARGET=true`.                                       |
| Exit code             | Có lỗi → `process.exitCode = 1`, dùng được trong CI/script.                                               |

---

## 1. Lấy API key và model từ xKiro

1. Mở <https://xkiro.com/dashboard/models>, chọn model ảnh muốn dùng, copy
   **model id** (ví dụ `gpt-image`).
2. Tạo API key trong dashboard.
3. Kiểm tra key + model bằng 1 request thật (rẻ — 1 ảnh):

```bash
curl -sS https://api.xkiro.com/v1/images/generations \
  -H "Authorization: Bearer $XKIRO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-image","prompt":"A lighthouse on a rocky shore at dawn","n":1,"size":"1024x1024"}'
```

Trả về `{"id":"...","status":"processing"}`. Poll tiếp:

```bash
curl -sS https://api.xkiro.com/v1/images/generations/<JOB_ID> \
  -H "Authorization: Bearer $XKIRO_API_KEY"
```

Khi `status` = `succeeded` thì ảnh nằm ở `data[0].url`.

---

## 2. Cấu hình môi trường

Thêm vào `.env` (hoặc file env riêng cho lần chạy):

```bash
IMAGE_PROVIDER="xkiro"
IMAGE_MODEL="gpt-image"          # copy từ dashboard xKiro
XKIRO_API_KEY="xk-..."

# Tuỳ chọn — mặc định đã hợp lý cho xKiro
IMAGE_CONCURRENCY="3"            # số job song song
IMAGE_POLL_INTERVAL_MS="5000"    # poll mỗi 5s
IMAGE_POLL_TIMEOUT_MS="600000"   # bỏ job sau 10 phút
IMAGE_JOB_CHECKPOINT="tmp/bjt-image-jobs.json"
IMAGE_WIDTH="1024"
IMAGE_HEIGHT="1024"
```

Prompt tiếng Nhật nên được dịch sang tiếng Anh trước khi gửi cho model ảnh
(chất lượng tốt hơn rõ rệt). Thêm một model text (miễn phí cũng được):

```bash
IMAGE_PROMPT_TRANSLATION_BASE_URL="http://localhost:20128/v1"
IMAGE_PROMPT_TRANSLATION_MODEL="nvidia/meta/llama-3.1-8b-instruct"
```

---

## 3. Dry-run trước (bắt buộc, không tốn tiền)

Dry-run không cần API key, không gọi provider, không ghi MinIO/DB. Nó xác thực
`imageAlt` + `imagePrompt` và in prompt thật sẽ được gửi đi:

```bash
pnpm exec tsx data/generated/generate-ai-images.ts --dry-run
```

Đọc kỹ banner đầu output — nó in **đích thật sự** sẽ bị ghi:

```
   Mode:        async job queue
   Concurrency: 3
   Target DB:   127.0.0.1:15432/nihongo_bjt (local)
   Target MinIO: http://localhost:9000/nihongo-bjt-media
```

Exit code ≠ 0 nghĩa là có câu thiếu `imageAlt` hoặc `imagePrompt` → sửa dữ liệu
trước, đừng generate.

> `imageAlt` là copy cho người học / screen reader. `imagePrompt` là brief cho bộ
> sinh ảnh. **Không được dùng cái này thay cái kia.**

---

## 4. Generate thật (local trước)

Chạy thử số lượng nhỏ trước để soi chất lượng:

```bash
LIMIT=5 MEDIA_FILTER=photo pnpm exec tsx data/generated/generate-ai-images.ts
```

Hài lòng rồi thì chạy cả bộ:

```bash
MEDIA_FILTER=photo \
TEST_TYPE_FILTER=official \
YES=true \
pnpm exec tsx data/generated/generate-ai-images.ts
```

`MEDIA_FILTER=photo` là **hàng rào chất lượng bắt buộc** cho batch tự động.
Không dùng model sinh ảnh để render biểu đồ, tài liệu, biển báo hay sơ đồ có
số/chữ cần chính xác — `chart`, `document`, `diagram` phải dùng renderer xác định
hoặc review tay.

Các filter khác: `LEVEL_FILTER=J3,J4`, `TEST_SLUG_FILTER=<slug>`, `LIMIT=n`,
`FORCE_REGENERATE=true`.

Nếu run bị kill giữa đường: cứ chạy lại **đúng lệnh cũ**. Câu đã xong bị bỏ qua,
job xKiro còn dở được resume từ checkpoint (`♻️ resume job ...`).

---

## 5. Cập nhật ảnh trên PRODUCTION

Có 2 cách. **Cách A khuyến nghị** vì được soi ảnh ở local trước khi lên prod.

### Cách A — generate ở local rồi sync lên prod

```bash
# 1. Generate ở local (mục 4)
# 2. Xem trước sẽ đổi gì trên prod
DOTENV_CONFIG_PATH=.env.sync pnpm exec tsx scripts/sync-bjt-images-to-prod.ts --dry-run
# 3. Chạy thật
DOTENV_CONFIG_PATH=.env.sync pnpm exec tsx scripts/sync-bjt-images-to-prod.ts
```

Script sync copy object từ MinIO local → MinIO prod, đổi host trong `imageUrl`,
ghi `imageAlt` / `imagePrompt` / provenance `MediaAsset` vào prod DB. Biến môi
trường `.env.sync` xem [sync-bjt-question-images.md](./sync-bjt-question-images.md).

### Cách B — generate trực tiếp vào production

Dùng khi prod chưa có ảnh và không muốn qua bước copy object. Trỏ `DATABASE_URL`
+ `MINIO_*` vào prod, và `MINIO_PUBLIC_*` vào domain media công khai:

```bash
DATABASE_URL="postgresql://USER:PASS@PROD_DB_HOST:5432/nihongo_bjt?schema=content" \
MINIO_ENDPOINT="PROD_MINIO_HOST" \
MINIO_PORT="9000" \
MINIO_USE_SSL="false" \
MINIO_ACCESS_KEY="..." \
MINIO_SECRET_KEY="..." \
MINIO_BUCKET="nihongo-bjt-media" \
MINIO_PUBLIC_ENDPOINT="media.your-prod.com" \
MINIO_PUBLIC_PORT="443" \
MINIO_PUBLIC_USE_SSL="true" \
IMAGE_PROVIDER="xkiro" \
IMAGE_MODEL="gpt-image" \
XKIRO_API_KEY="xk-..." \
MEDIA_FILTER=photo \
ALLOW_REMOTE_TARGET=true \
pnpm exec tsx data/generated/generate-ai-images.ts --dry-run
```

`ALLOW_REMOTE_TARGET=true` là bắt buộc khi DB không phải localhost — bỏ nó ra thì
script từ chối chạy. Bỏ `--dry-run` khi đã xác nhận banner in đúng host prod.
`MINIO_PUBLIC_*` quyết định host được lưu vào `imageUrl`; đặt sai là ảnh hỏng
trên browser người dùng.

---

## 6. Kiểm tra sau khi chạy

```sql
-- Trên prod DB: phải = 0
SELECT count(*) FROM "BjtQuestion" WHERE "imageUrl" LIKE '%localhost%';

-- Số ảnh AI đã có
SELECT count(*) FROM "BjtQuestion" WHERE "imageUrl" LIKE '%/ai/%';

-- Câu cần ảnh mà vẫn chưa có
SELECT count(*) FROM "BjtQuestion"
WHERE "imagePrompt" IS NOT NULL AND ("imageUrl" IS NULL OR "imageUrl" NOT LIKE '%/ai/%');

-- Provenance/bản quyền phải "cleared"
SELECT "rightsStatus", count(*) FROM "MediaAsset" GROUP BY 1;
```

Mở thử 1 `imageUrl` prod trên browser → phải tải được ảnh.

Checkpoint sau khi mọi thứ xong phải rỗng:

```bash
cat tmp/bjt-image-jobs.json   # {"version":1,"jobs":{}}
```

---

## 7. Xử lý sự cố

| Hiện tượng                                   | Nguyên nhân / cách xử lý                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `IMAGE_API_KEY or XKIRO_API_KEY is required` | Chưa set key cho `IMAGE_PROVIDER=xkiro`.                                                              |
| `🚫 blocked`                                  | Provider từ chối nội dung. Sửa `imagePrompt` cho trung tính hơn rồi chạy lại. Job này **đã bị tính phí**. |
| `did not finish within ...ms`                | Job quá lâu. Tăng `IMAGE_POLL_TIMEOUT_MS`, hoặc chạy lại để resume từ checkpoint.                     |
| 429 liên tục                                 | Vượt hạn mức job đồng thời. Giảm `IMAGE_CONCURRENCY`, tăng `IMAGE_PACE_MS`.                            |
| `Refusing to write to non-local database`    | Đúng như thiết kế. Thêm `ALLOW_REMOTE_TARGET=true` nếu thật sự muốn ghi vào prod.                      |
| `unsupported content type`                   | CDN trả về không phải ảnh. Chạy lại; nếu lặp lại thì kiểm tra model id.                                |
| Ảnh có chữ/số sai                            | Model ảnh không render text đáng tin. Chỉ chạy `MEDIA_FILTER=photo`; loại chart/document/diagram.      |
| Ảnh hỏng trên prod nhưng OK ở local          | `MINIO_PUBLIC_*` sai → `imageUrl` trỏ `localhost`. Xem mục 6 và script sync.                           |

---

## 8. Test

```bash
npx vitest run scripts/lib/bjt-image-generation-provider.test.ts scripts/lib/bjt-image-job-store.test.ts
```

Bao gồm: submit job xKiro có bearer auth, poll đến `succeeded` rồi tải CDN,
`blocked` không retry, `failed` retry bằng job mới, timeout poll, chặn URL không
https, và checkpoint resume/parse an toàn.
