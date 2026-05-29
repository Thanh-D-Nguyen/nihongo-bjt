# OmniVoice TTS — Setup & Usage Guide

Local self-hosted TTS for BJT listening question audio generation.

---

## Overview

| Item | Detail |
|------|--------|
| **Project** | [k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice) |
| **Version** | v0.1.5+ |
| **Model** | Zero-shot voice cloning, 600+ languages |
| **Latency** | ~2–5s per utterance (GPU dependent) |
| **Output** | WAV 24kHz mono |
| **Use case** | Batch pre-generation of BJT listening audio |

### Architecture Fit

```
┌───────────────────┐     ┌────────────────────┐     ┌──────────┐
│ generate-bjt-audio│────▶│ OmniVoice Server   │────▶│  MinIO   │
│ (batch script)    │     │ (Gradio API :8001) │     │ (storage)│
└───────────────────┘     └────────────────────┘     └──────────┘
        │                                                   │
        ▼                                                   ▼
┌───────────────────┐                            ┌──────────────────┐
│   PostgreSQL      │◀───────────────────────────│ audio_url saved  │
│ bjt_question      │                            │ to question row  │
└───────────────────┘                            └──────────────────┘
```

Real-time API flow (optional):
```
Client → NestJS API → TtsService (TTS_PROVIDER=omnivoice) → OmniVoiceTtsProvider → Gradio API
```

---

## 1. Install OmniVoice Server

### Option A: pip install (recommended for local dev)

```bash
# In WSL or Linux with CUDA GPU
pip install omnivoice

# Verify installation
omnivoice-infer --help
```

### Option B: From source (latest features)

```bash
git clone https://github.com/k2-fsa/OmniVoice.git
cd OmniVoice
pip install -e .   # or: uv sync
```

### Option C: Docker (isolated environment)

```bash
docker run --gpus all -p 8001:8001 \
  -v /path/to/ref-audio:/data/ref \
  k2fsa/omnivoice:latest \
  omnivoice-demo --ip 0.0.0.0 --port 8001
```

> **GPU Required**: OmniVoice needs CUDA. CPU-only mode is very slow (~30s+ per utterance). Minimum: NVIDIA GPU with 4GB+ VRAM.

---

## 2. Start the Server

```bash
# Start Gradio web UI (also acts as API server)
omnivoice-demo --ip 0.0.0.0 --port 8001
```

Verify it's running:
```bash
curl http://localhost:8001/api/predict \
  -H "Content-Type: application/json" \
  -d '{"data": ["テスト", "", "", "", 32, 1.0], "fn_index": 0}'
```

The web UI is accessible at `http://localhost:8001` for manual testing.

---

## 3. Prepare Reference Audio

Voice cloning requires a short sample of the target voice.

### Requirements

| Property | Value |
|----------|-------|
| Format | WAV (16kHz or 24kHz, mono) |
| Duration | 3–10 seconds |
| Content | Clear speech, no background noise |
| Style | NHK announcer (formal business Japanese) |

### Where to place

```
data/tts-ref/
├── ja-female-announcer.wav   ← Primary (BJT listening)
├── ja-male-announcer.wav     ← Optional (male voice variant)
└── README.md
```

### Sources for reference audio

1. **NHK NEWS WEB EASY** — Extract clean announcer segments
2. **JLPT official listening samples** — Formal announcer voice
3. **Record a native speaker** — 3-5 formal business Japanese sentences

### Tips

- Clean audio only — no BGM, no room echo
- Formal keigo style for BJT context
- Longer reference (8-10s) = better cloning quality
- The reference transcript (`OMNIVOICE_REF_TEXT`) is optional — Whisper auto-transcribes if empty

---

## 4. Environment Variables

Add to `.env` or export in shell:

```env
# ── OmniVoice TTS ──────────────────────────────────────────
TTS_PROVIDER=omnivoice
OMNIVOICE_URL=http://localhost:8001
OMNIVOICE_REF_AUDIO=./data/tts-ref/ja-female-announcer.wav
OMNIVOICE_REF_TEXT=                        # Optional: transcript of ref audio
OMNIVOICE_NUM_STEPS=32                     # Diffusion steps (higher = better quality, slower)

# ── MinIO (for batch script) ───────────────────────────────
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=19000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=nihongo-bjt
```

---

## 5. Batch Audio Generation

The primary workflow: generate audio for all BJT questions that have `audio_script` populated.

### Prerequisites

1. OmniVoice server running on port 8001
2. PostgreSQL running (port 15432)
3. MinIO running (port 19000)
4. BJT questions with `audio_script` field filled

### Commands

```bash
# Dry run — preview what would be generated
npx tsx scripts/generate-bjt-audio.ts --dry-run

# Generate all (skips questions that already have audio_url)
npx tsx scripts/generate-bjt-audio.ts

# Generate for specific section
npx tsx scripts/generate-bjt-audio.ts --section J1-listening

# Force regenerate (overwrite existing audio)
npx tsx scripts/generate-bjt-audio.ts --force
```

### What the script does

1. Queries `assessment.bjt_question` where `audio_script IS NOT NULL`
2. For each question:
   - Calls OmniVoice Gradio API (fallback: `omnivoice-infer` CLI)
   - Receives WAV buffer
   - Uploads to MinIO at `bjt-audio/{questionId}.wav`
   - Updates `audio_url` in PostgreSQL
3. Prints summary of success/failure counts

### Output

```
╔═══════════════════════════════════════════════════════════╗
║  BJT Question Audio Generator (OmniVoice)                ║
╚═══════════════════════════════════════════════════════════╝

  OmniVoice URL:    http://localhost:8001
  Reference audio:  data/tts-ref/ja-female-announcer.wav
  Mode:             Normal (skip existing)
  Section filter:   ALL

Found 120 questions to process.

  [J1-L1] 次のお知らせを聞いてください。会議は...
  [J1-L1] 田中さんが電話に出られない理由は...
  ... and 115 more

[1/120] Generating: 次のお知らせを聞いてください。会議は...
  ✅ Done → http://127.0.0.1:19000/nihongo-bjt/bjt-audio/abc123.wav

═══════════════════════════════════════════════════════════
  ✅ Success:  118
  ❌ Failed:   2
  ⏭️  Skipped:  0
  📊 Total:    120
═══════════════════════════════════════════════════════════
```

---

## 6. Real-Time API Usage (Optional)

The `OmniVoiceTtsProvider` is integrated into the NestJS TtsService. When `TTS_PROVIDER=omnivoice`, the API serves audio on-demand.

### How it works

```
POST /exercise/tts  { text: "日本語テキスト" }
  → TtsService.pickProvider() → OmniVoiceTtsProvider
  → Gradio API → base64 WAV response
```

### Trade-offs for real-time

| Aspect | Azure TTS | OmniVoice |
|--------|-----------|-----------|
| Latency | ~500ms | ~2-5s |
| Cost | ¥/request | Free |
| Quality | Good | Excellent (with voice cloning) |
| Reliability | 99.9% SLA | Self-managed |

**Recommendation**: Use OmniVoice for batch pre-generation, Azure for real-time fallback.

---

## 7. Populating `audio_script`

Currently **0/480** BJT questions have `audio_script`. You need to populate this field for listening sections.

### Which questions need audio?

- **Section 1** (聴解): All questions — these ARE the listening comprehension
- **Section 2** (聴読解): Questions with audio component
- **Section 3** (読解): Typically no audio needed

### How to populate

Option 1: Admin UI (when available) — edit each question's audio script field

Option 2: Migration script — bulk update from structured content:
```sql
UPDATE assessment.bjt_question
SET audio_script = prompt  -- or a specific listening_text column
WHERE section_id IN (
  SELECT id FROM assessment.bjt_test_section
  WHERE code LIKE '%listening%'
)
AND audio_script IS NULL;
```

Option 3: Import from structured JSON/CSV with correct listening scripts

---

## 8. Troubleshooting

### Server won't start

```bash
# Check CUDA availability
python -c "import torch; print(torch.cuda.is_available())"

# If no GPU, use CPU mode (slow but works for testing)
CUDA_VISIBLE_DEVICES="" omnivoice-demo --ip 0.0.0.0 --port 8001
```

### API returns error 500

- Check OmniVoice server logs
- Verify reference audio path is accessible from the server
- Try with empty reference (no voice cloning) to isolate the issue

### Audio quality is poor

- Use longer reference audio (8-10s)
- Increase `OMNIVOICE_NUM_STEPS` to 64 (slower but higher quality)
- Ensure reference audio is clean WAV without compression artifacts

### Script can't connect to MinIO

```bash
# Verify MinIO is running (in WSL Docker)
curl http://127.0.0.1:19000/minio/health/live

# Check port — project uses 19000 (not default 9000)
```

### Script can't connect to PostgreSQL

```bash
# Verify Postgres is running
curl http://127.0.0.1:15432  # Will error but confirms port is open

# Ensure DATABASE_URL is set
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt"
```

---

## 9. Files Reference

| File | Purpose |
|------|---------|
| `apps/api/src/exercise/omnivoice-tts.provider.ts` | NestJS TTS provider (Gradio API client) |
| `apps/api/src/exercise/tts.service.ts` | TTS orchestrator (`TTS_PROVIDER` routing) |
| `scripts/generate-bjt-audio.ts` | Batch generation script |
| `data/tts-ref/README.md` | Reference audio guide |
| `data/tts-ref/*.wav` | Voice cloning reference files |

---

## 10. Performance Estimates

| Questions | GPU | Estimated Time |
|-----------|-----|----------------|
| 100 | RTX 3060 | ~5-8 min |
| 100 | RTX 4090 | ~2-3 min |
| 480 | RTX 3060 | ~25-40 min |
| 480 | RTX 4090 | ~10-15 min |

The script processes sequentially with 500ms delay between requests to avoid GPU memory issues. For faster throughput, reduce the delay or run multiple OmniVoice instances behind a load balancer.
