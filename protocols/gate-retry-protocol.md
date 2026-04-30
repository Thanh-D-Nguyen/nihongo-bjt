# Gate Retry Protocol

When a gate fails, do not repeat the same fix blindly.

Retry strategy:

1. **Targeted retry** — fix the exact failing line/config/test.
2. **Rethink retry** — reassess assumptions and inspect surrounding architecture.
3. **Simplify retry** — reduce scope, isolate minimal failing slice.
4. **Minimal safe retry** — apply the smallest safe change and document remaining risk.

Stop after 4 attempts and produce a blocker report with evidence.
