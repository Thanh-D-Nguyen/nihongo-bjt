# Monetization implementation plan

1. Reuse the optional-auth managed-ad API contract on public discovery surfaces.
2. Keep all focused learning, answer, exam, and review screens ad-free.
3. Render only complete, server-approved campaign payloads; never render provider
   placeholders as advertisements.
4. Record an impression only after the creative becomes visible and record
   clicks through the managed endpoint.
5. Add mobile integration tests for anonymous, authenticated-free,
   `ads.reduced`, `ads.remove`, personalized-without-opt-in, and protected
   learning-context cases before enabling any mobile placement.
6. Validate placement frequency, accessibility labels, consent behavior, and
   analytics on a real device before production rollout.
