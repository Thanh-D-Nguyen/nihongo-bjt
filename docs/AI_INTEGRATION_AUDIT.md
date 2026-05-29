# AI & External Service Integration Audit

> Last updated: 2026-05-29

## Summary

Dự án sử dụng AI/external API ở **4 điểm chính**. Phần còn lại (recommendation, SRS, exercise generation, flashcard gen) là **thuật toán thuần** — không cần API key.

---

## 1. AI-Powered Services (Cần API Key)

### 1.1 Magazine AI Content Generation

| Item | Detail |
|------|--------|
| **File** | `apps/api/src/magazine/providers/ai-content.provider.ts` |
| **Env var** | `OPENAI_API_KEY`, `MAGAZINE_AI_MODEL` (default: `gpt-4o-mini`) |
| **Purpose** | Tự động sinh nội dung học tiếng Nhật hàng ngày (vocab, weather, horoscope, loto, BJT phrase) |
| **Fallback** | ✅ Mock generation khi không có API key — app vẫn hoạt động |
| **Production grade?** | ✅ Yes |

**Điểm mạnh:**
- Graceful fallback to mock khi thiếu key
- Structured JSON response format enforced
- Error handling + logging đầy đủ
- Token usage tracking
- Per-widget prompt templates
- Idempotent generation (check exists trước khi generate)
- Test coverage: `ai-content.provider.spec.ts`

**Cần cải thiện:**
- ⚠️ Không có retry logic khi OpenAI trả lỗi tạm thời (429, 500, 503)
- ⚠️ Không có rate limit cho admin trigger (chỉ admin mới trigger được, nhưng chưa có per-minute cap)
- ⚠️ Không validate JSON response schema từ AI (tin tưởng hoàn toàn output)
- ⚠️ API key đọc trực tiếp từ `process.env` tại construction time (không inject qua ConfigService)

---

### 1.2 Azure TTS (Text-to-Speech)

| Item | Detail |
|------|--------|
| **Files** | `apps/api/src/exercise/tts.service.ts`, `azure-tts.provider.ts` |
| **Env vars** | `TTS_PROVIDER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_SPEECH_DEFAULT_VOICE` |
| **Purpose** | Sinh audio cho từ vựng / câu ví dụ tiếng Nhật |
| **Fallback** | ✅ Browser TTS fallback (client-side Web Speech API) khi không có Azure key |
| **Production grade?** | ✅ Yes |

**Điểm mạnh:**
- Provider abstraction (interface `TtsProvider`) — dễ swap sang Google/Polly
- Graceful fallback to browser
- SSML generation đúng chuẩn
- Error handling + logging

**Cần cải thiện:**
- ⚠️ Không có retry logic cho transient Azure failures
- ⚠️ Không có circuit breaker (nếu Azure down, mỗi request vẫn gọi → latency spike)
- ⚠️ Chưa có cost tracking / daily spending cap

---

### 1.3 Image Search (Unsplash / Pixabay / Google CSE)

| Item | Detail |
|------|--------|
| **File** | `apps/api/src/media/image-search.service.ts` |
| **Env vars** | `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY`, `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` |
| **Purpose** | Tìm hình ảnh minh họa cho nội dung học |
| **Fallback** | ✅ Trả mảng rỗng nếu không có provider nào configured |
| **Production grade?** | ✅ Yes |

**Điểm mạnh:**
- Multi-provider aggregation (Unsplash + Pixabay + Google)
- Daily quota enforcement per user
- Feature flag gate
- Deduplication
- License metadata tracking

**Cần cải thiện:**
- ⚠️ Không có retry cho individual provider failures
- ⚠️ `Promise.allSettled` nuốt lỗi — chỉ log ở debug level

---

### 1.4 AI Image Generation (Dev Tool)

| Item | Detail |
|------|--------|
| **File** | `data/generated/generate-ai-images.ts` |
| **Env var** | `OPENAI_API_KEY` |
| **Purpose** | Script chạy 1 lần để sinh hình ảnh cho BJT questions |
| **Runtime?** | ❌ Chỉ là dev/admin script, không chạy trong production server |
| **Production grade?** | ✅ Acceptable (dev tooling) |

**Điểm mạnh:**
- Interactive mode (xác nhận trước khi chi tiền)
- Dry run mode
- Upload to MinIO (object storage)
- Level/media filtering

---

## 2. Algorithm-Only Services (Không cần API Key)

Các hệ thống sau dùng **thuật toán thuần**, KHÔNG gọi AI API:

### 2.1 Recommendation Engine
| File | Algorithm |
|------|-----------|
| `apps/api/src/recommendation/study-feed.pipeline.ts` | Weighted multi-source scoring (inspired by X/Twitter algorithm) |
| `apps/api/src/recommendation/flashcard-review.pipeline.ts` | Overdue + leeched card prioritization |
| `apps/api/src/recommendation/news-feed.pipeline.ts` | Level match + recency + topic interest scoring |
| `apps/api/src/recommendation/pipeline/components.ts` | WeightedScorer, DiversityScorer, DeduplicateFilter |

→ **100% algorithmic.** Retrieval → Scoring → Diversity → TopK. No AI calls.

### 2.2 Spaced Repetition (SRS)
| File | Algorithm |
|------|-----------|
| `apps/api/src/exercise/exercise-srs.algorithm.ts` | SM-2 algorithm (SuperMemo) |

→ **Standard SM-2.** Pure math: ease factor, interval calculation, lapse handling.

### 2.3 Exercise Generation
| File | Algorithm |
|------|-----------|
| `apps/api/src/exercise/exercise-generator.service.ts` | Template-based generation from DB content |

→ **DB query + shuffle + template.** Pulls lexemes/grammar from DB, creates exercises with random distractors. No AI involved.

### 2.4 Flashcard Auto-Generation (CardGen)
| File | Algorithm |
|------|-----------|
| `apps/api/src/flashcards/flashcard-gen.service.ts` | Content selection by level/topic/weak-area |
| `apps/api/src/cardgen/cardgen.service.ts` | Rule-based deck creation |

→ **Query + selection logic.** Entitlement-gated, quota-enforced, but no AI calls.

### 2.5 Bot Chat Responder (Battle)
| File | Algorithm |
|------|-----------|
| `apps/api/src/battle/template-bot-chat-responder.ts` | Template + keyword classification |
| `apps/api/src/battle/bot-chat-responder.port.ts` | Port interface (ready for AI swap) |

→ **Template-based.** Classifies message keywords → picks response template. Port interface designed for future AI provider swap.

### 2.6 Revenge Mode
| File | Algorithm |
|------|-----------|
| `apps/api/src/quiz/revenge-mode.service.ts` | Recent wrong answers re-served |

→ **Simple filtering.** Wrong answers from last 7 days, filter out already-revenged, shuffle.

---

## 3. Environment Variables — Complete Reference

```env
# ─── AI / External Services ───────────────────────────────────────

# OpenAI (Magazine content gen + image gen script)
OPENAI_API_KEY=sk-...
MAGAZINE_AI_MODEL=gpt-4o-mini          # or gpt-4o for higher quality

# Azure TTS (Exercise audio)
TTS_PROVIDER=azure                     # or "browser" for client-side fallback
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=japaneast          # or eastasia, southeastasia
AZURE_SPEECH_DEFAULT_VOICE=ja-JP-NanamiNeural

# Image Search (Media library)
UNSPLASH_ACCESS_KEY=
PIXABAY_API_KEY=
GOOGLE_CSE_KEY=
GOOGLE_CSE_CX=
```

---

## 4. Production Readiness Matrix

| Service | Fallback | Retry | Circuit Breaker | Rate Limit | Cost Track | Tests | Verdict |
|---------|----------|-------|-----------------|------------|------------|-------|---------|
| Magazine AI Gen | ✅ Mock | ❌ | ❌ | ⚠️ Admin-only | ✅ Tokens | ✅ | **Ready** (minor gaps) |
| Azure TTS | ✅ Browser | ❌ | ❌ | N/A (per-request) | ❌ | ❌ | **Ready** (needs retry) |
| Image Search | ✅ Empty | ❌ | ❌ | ✅ Quota/day | N/A | ✅ | **Ready** |
| AI Image Gen | ❌ Script | N/A | N/A | N/A (manual) | ✅ Confirm | N/A | **Dev tool** |
| Recommendation | N/A | N/A | N/A | N/A | N/A | ❌ | **Ready** (algorithm) |
| SRS (SM-2) | N/A | N/A | N/A | N/A | N/A | ❌ | **Ready** (algorithm) |
| Exercise Gen | N/A | N/A | N/A | N/A | N/A | ❌ | **Ready** (algorithm) |
| Bot Chat | N/A | N/A | N/A | N/A | N/A | ❌ | **Ready** (template) |

---

## 5. Recommendations for Production Hardening

### Priority 1 — Should fix before heavy traffic

1. **Add retry with exponential backoff** cho Magazine AI Gen:
   - 3 retries, backoff 1s → 2s → 4s
   - Retry on 429 (rate limit), 500, 502, 503

2. **Validate AI response schema** — dùng Zod parse `JSON.parse(content)` trước khi trust:
   ```typescript
   const parsed = generatedArticleSchema.safeParse(JSON.parse(content));
   if (!parsed.success) return this.generateMock(ctx);
   ```

3. **Inject config via NestJS ConfigService** thay vì `process.env` trực tiếp:
   ```typescript
   constructor(@Inject(ConfigService) private readonly config: ConfigService) {
     this.apiKey = config.get('OPENAI_API_KEY');
   }
   ```

### Priority 2 — Should fix before paid plan launch

4. **Circuit breaker cho Azure TTS** — nếu 5 lỗi liên tiếp trong 60s, switch sang browser fallback tạm 5 phút

5. **Daily cost cap cho OpenAI** — theo dõi tổng tokens/day, alert khi vượt threshold

6. **Add retry cho Azure TTS** — transient failures phổ biến với cloud speech APIs

### Priority 3 — Nice to have

7. **Unit tests cho SRS algorithm** và recommendation pipeline components
8. **OpenTelemetry spans** cho mỗi external API call (tracing latency)
9. **Admin dashboard widget** hiển thị AI usage/cost real-time

---

## 6. Architecture Decision

| Question | Answer |
|----------|--------|
| Nếu không có OPENAI_API_KEY, app có chạy được không? | ✅ Có — mock content generation |
| Nếu không có AZURE_SPEECH_KEY, app có chạy được không? | ✅ Có — browser TTS fallback |
| Nếu không có image search keys, app có chạy được không? | ✅ Có — trả empty results |
| Có chỗ nào app CRASH nếu thiếu API key? | ❌ Không — tất cả đều graceful degrade |
| Recommendation/SRS/Exercise gen có cần AI không? | ❌ Không — 100% algorithmic |

**Kết luận:** Hệ thống thiết kế tốt — AI là enhancement layer, không phải dependency. App chạy hoàn toàn OK trong dev mode không cần bất kỳ API key nào.
