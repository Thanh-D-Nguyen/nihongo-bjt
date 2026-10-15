import { describe, expect, it } from "vitest";
import {
  compileContextPolicy,
  CONSERVATIVE_FALLBACK_VERIFIED,
  DEFAULT_RATIOS,
  resolveContextPolicy,
  validateClientConsistency,
  checkRuntimeSync,
} from "./lib/context-policy.mjs";

const validRaw = () => ({
  schema: "nihongo-context-policy/1",
  defaults: { ...DEFAULT_RATIOS },
  profiles: {
    "ghostcli:claude-fable-5.1": {
      verified_reliable_window: 160000,
      verification_status: "verified",
      verification_scope: "local-provider-path",
      notes: "empirical baseline",
    },
  },
});

describe("adaptive context policy — hardened layers", () => {
  it("CASE 1 — current policy: provider=256K, proxy=160K, client=160K → effective=160K", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 256000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    expect(resolved.effective_operating_window).toBe(160000);
    expect(resolved.provider_context_window).toBe(256000);
    expect(resolved.local_proxy_window).toBe(160000);
    expect(resolved.client_context_window).toBe(160000);
    expect(resolved.checkpoint_threshold).toBe(Math.floor(160000 * 0.66 / 100) * 100);
    expect(resolved.compact_threshold).toBe(120000);
    expect(resolved.danger_threshold).toBe(140000);
    expect(resolved.status).toBe("CONSISTENT");
  });

  it("CASE 2 — provider expansion to 1M with proxy/client at 160K keeps effective=160K CONSISTENT", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 1000000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    expect(resolved.effective_operating_window).toBe(160000);
    expect(resolved.provider_context_window).toBe(1000000);
    // proxy and client still bind at 160K; verified also 160K → CONSISTENT
    expect(resolved.status).toBe("CONSISTENT");
  });

  it("CASE 2b — provider expansion with NO proxy/client cap triggers REVALIDATION_AVAILABLE", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 1000000,
    });
    expect(resolved.effective_operating_window).toBe(160000);
    expect(resolved.provider_context_window).toBe(1000000);
    expect(resolved.status).toBe("REVALIDATION_AVAILABLE");
  });

  it("CASE 3 — empirical revalidation expands effective when all caps allow", () => {
    const raw = validRaw();
    raw.profiles["ghostcli:claude-fable-5.1"].verified_reliable_window = 400000;
    const policy = compileContextPolicy(raw);
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 1000000,
      local_proxy_window: 400000,
      client_context_window: 400000,
    });
    expect(resolved.effective_operating_window).toBe(400000);
    expect(resolved.compact_threshold).toBe(300000);
    expect(resolved.danger_threshold).toBe(350000);
  });

  it("CASE 4 — provider shrink automatically reduces effective", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 128000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    expect(resolved.effective_operating_window).toBe(128000);
    expect(resolved.status).toBe("SAFE_SHRINK");
    expect(resolved.checkpoint_threshold).toBe(Math.floor(128000 * 0.66 / 100) * 100);
    expect(resolved.compact_threshold).toBe(Math.floor(128000 * 0.75 / 100) * 100);
    expect(resolved.danger_threshold).toBe(Math.floor(128000 * 0.875 / 100) * 100);
  });

  it("CASE 5 — invalid compact config fails closed", () => {
    const raw = validRaw();
    raw.defaults.compact_ratio = 5;
    const policy = compileContextPolicy(raw);
    expect(() =>
      resolveContextPolicy(policy, {
        provider: "ghostcli",
        model: "claude-fable-5.1",
        provider_context_window: 160000,
      }),
    ).toThrow(/invariant violated/i);
  });

  it("CASE 6 — invalid ordering (checkpoint >= compact) fails closed", () => {
    const raw = validRaw();
    raw.defaults.checkpoint_ratio = 0.9;
    raw.defaults.compact_ratio = 0.5;
    const policy = compileContextPolicy(raw);
    expect(() =>
      resolveContextPolicy(policy, {
        provider: "ghostcli",
        model: "claude-fable-5.1",
        provider_context_window: 160000,
      }),
    ).toThrow(/invariant violated/i);
  });

  it("CASE 7 — unverified new model caps at min(provider, conservative fallback)", () => {
    const policy = compileContextPolicy(validRaw());
    // Provider advertises 256K but no verified profile exists.
    // Effective = min(256000, CONSERVATIVE_FALLBACK_VERIFIED=32000) = 32000.
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-opus-5-5",
      provider_context_window: 256000,
    });
    expect(resolved.effective_operating_window).toBe(CONSERVATIVE_FALLBACK_VERIFIED);
    expect(resolved.status).toBe("UNVERIFIED_MODEL");
  });

  it("CASE 7b — unverified model with provider below fallback uses provider", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-opus-5-5",
      provider_context_window: 16000,
    });
    expect(resolved.effective_operating_window).toBe(16000);
    expect(resolved.status).toBe("UNVERIFIED_MODEL");
  });

  it("CASE 8 — no metadata at all uses conservative fallback", () => {
    const raw = { schema: "nihongo-context-policy/1", defaults: { ...DEFAULT_RATIOS }, profiles: {} };
    const policy = compileContextPolicy(raw);
    const resolved = resolveContextPolicy(policy, {
      provider: "unknown",
      model: "unknown",
    });
    expect(resolved.effective_operating_window).toBe(CONSERVATIVE_FALLBACK_VERIFIED);
    expect(resolved.status).toBe("FALLBACK_NO_METADATA");
  });

  it("CASE 8b — verified exists but no runtime caps uses verified as DEGRADED ceiling", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: null,
      local_proxy_window: null,
      client_context_window: null,
    });
    expect(resolved.effective_operating_window).toBe(160000);
    expect(resolved.status).toBe("DEGRADED_NO_PROVIDER_METADATA");
  });

  it("client consistency detects mismatched codex config", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 256000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    const mismatches = validateClientConsistency(resolved, {
      model_context_window: 650000,
      model_auto_compact_token_limit: 120000,
    });
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.some((m) => /model_context_window/.test(m))).toBe(true);
  });

  it("runtime sync detects proxy/config drift", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 256000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    const result = checkRuntimeSync(resolved, {
      codexConfig: 'model_context_window = 650000\nmodel_auto_compact_token_limit = 120000',
      proxyScript: 'const SAFE_CONTEXT_WINDOW = 160000;',
    });
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => /codex config model_context_window=650000/.test(m))).toBe(true);
    expect(result.mismatches.some((m) => /proxy/.test(m))).toBe(false);
  });

  it("runtime sync passes when everything matches", () => {
    const policy = compileContextPolicy(validRaw());
    const resolved = resolveContextPolicy(policy, {
      provider: "ghostcli",
      model: "claude-fable-5.1",
      provider_context_window: 256000,
      local_proxy_window: 160000,
      client_context_window: 160000,
    });
    const result = checkRuntimeSync(resolved, {
      codexConfig: 'model_context_window = 160000\nmodel_auto_compact_token_limit = 120000',
      proxyScript: 'const SAFE_CONTEXT_WINDOW = 160000;',
    });
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });
});
