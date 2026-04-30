# Media Quality Gate

Use for audio, image, video, color, motion, upload, generated assets, and postcards.

## Pass checklist

- Images have useful alt text where user-facing.
- License/provenance is stored for external/generated assets.
- Audio/video does not autoplay in study, quiz, or exam flows.
- Audio/video has captions/transcripts where applicable.
- Motion respects reduced-motion preferences.
- Color contrast is acceptable.
- Color is not the only source of meaning.
- Postcards do not leak private learner data.
- Uploads validate type, size, content, and dimensions where relevant.
- Malware scan and SSRF guards exist for upload/external media flows.
- Media fallback/degraded state exists.

## Evidence

- asset schema/provider path
- UI path
- accessibility check
- security check
- known gaps and owner

## Blockers

- autoplay in exam/study
- missing media provenance
- unsafe upload/external fetch
- postcard privacy leak
- inaccessible critical media
