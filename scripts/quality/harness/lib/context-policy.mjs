// Adaptive context policy: resolves effective operating window and derived
// thresholds from upstream provider metadata + empirically verified profiles.
//
// Layers (never conflate):
//   provider_context_window  = upstream advertised capacity (external metadata)
//   verified_reliable_window = empirical safe ceiling for this profile (repo policy)
//   local_proxy_window       = locally enforced Codex-facing cap (machine config)
//   client_context_window    = Codex configured window (machine config)
//   effective_operating_window = min(all trustworthy caps)
//
// Core invariant (FAIL CLOSED if violated):
//   checkpoint < compact < danger < effective <= min(provider, proxy, client, verified)
//
// Expansion is conservative: effective never grows beyond verified without
// explicit revalidation. Shrink is automatic when any trusted cap decreases.
import path from "node:path";
import { readJson, toolFailure } from "./util.mjs";

export const CONTEXT_POLICY_PATH = "docs/engineering/context-policy.json";
export const CONTEXT_POLICY_SCHEMA = "nihongo-context-policy/1";

export const DEFAULT_RATIOS = Object.freeze({
  checkpoint_ratio: 0.66,
  compact_ratio: 0.75,
  danger_ratio: 0.875,
});

export const CONSERVATIVE_FALLBACK_VERIFIED = 32000;

/** Load and validate the canonical context policy file. */
export function loadContextPolicy(root) {
  const raw = readJson(path.join(root, CONTEXT_POLICY_PATH), CONTEXT_POLICY_PATH);
  return compileContextPolicy(raw);
}

export function compileContextPolicy(raw) {
  const problems = [];
  if (raw?.schema !== CONTEXT_POLICY_SCHEMA) problems.push(`schema must be ${CONTEXT_POLICY_SCHEMA}`);
  if (!raw?.defaults || typeof raw.defaults !== "object") problems.push("missing defaults");
  if (!raw?.profiles || typeof raw.profiles !== "object") problems.push("missing profiles");
  if (problems.length) throw toolFailure(`invalid ${CONTEXT_POLICY_PATH}: ${problems.join("; ")}`);

  const defaults = { ...DEFAULT_RATIOS };
  for (const key of ["checkpoint_ratio", "compact_ratio", "danger_ratio"]) {
    if (typeof raw.defaults[key] === "number") defaults[key] = raw.defaults[key];
    else if (raw.defaults[key] !== undefined) problems.push(`defaults.${key} must be a number`);
  }

  const profiles = new Map();
  for (const [id, profile] of Object.entries(raw.profiles)) {
    if (typeof profile?.verified_reliable_window !== "number" || profile.verified_reliable_window <= 0) {
      problems.push(`profile ${id}: verified_reliable_window must be a positive number`);
      continue;
    }
    profiles.set(id, {
      verified_reliable_window: profile.verified_reliable_window,
      verification_status: profile.verification_status ?? "unverified",
      verification_scope: profile.verification_scope ?? null,
      notes: profile.notes ?? null,
    });
  }

  if (problems.length) throw toolFailure(`invalid ${CONTEXT_POLICY_PATH}: ${problems.join("; ")}`);
  return { raw, defaults, profiles };
}

function profileKey(provider, model) {
  return `${provider}:${model}`;
}

function roundThreshold(value) {
  return Math.floor(value / 100) * 100;
}

function positiveNumberOrNull(v) {
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * Resolve the adaptive context policy for a given provider/model/runtime.
 *
 * @param {Object} policy - compiled context policy
 * @param {Object} runtime - {
 *   provider, model,
 *   provider_context_window,   // upstream advertised (may be null)
 *   local_proxy_window,        // locally enforced cap (may be null)
 *   client_context_window,     // Codex configured window (may be null)
 * }
 * @returns {Object} resolved policy with status flags and all layer values
 */
export function resolveContextPolicy(policy, runtime) {
  const provider = runtime?.provider ?? null;
  const model = runtime?.model ?? null;
  const providerWindow = positiveNumberOrNull(runtime?.provider_context_window);
  const proxyWindow = positiveNumberOrNull(runtime?.local_proxy_window);
  const clientWindow = positiveNumberOrNull(runtime?.client_context_window);

  const key = provider && model ? profileKey(provider, model) : null;
  const profile = key ? policy.profiles.get(key) : null;
  const verified = profile?.verified_reliable_window ?? null;

  let effective;
  let status;
  const notes = [];

  // Collect all trustworthy caps. Effective must not exceed any of them.
  const caps = [];
  if (providerWindow !== null) caps.push({ name: "provider", value: providerWindow });
  if (proxyWindow !== null) caps.push({ name: "proxy", value: proxyWindow });
  if (clientWindow !== null) caps.push({ name: "client", value: clientWindow });
  if (verified !== null) caps.push({ name: "verified", value: verified });

  if (caps.length === 0) {
    // No trustworthy cap at all: use conservative fallback, mark degraded.
    effective = CONSERVATIVE_FALLBACK_VERIFIED;
    status = "FALLBACK_NO_METADATA";
    notes.push("no trustworthy provider/proxy/client/verified cap available; using conservative fallback");
  } else if (verified === null) {
    // Unverified model: never trust full advertised provider window.
    // Cap effective at min(provider, CONSERVATIVE_FALLBACK_VERIFIED).
    const safeFallback = Math.min(providerWindow ?? Infinity, CONSERVATIVE_FALLBACK_VERIFIED);
    // Also respect proxy/client caps if present.
    const allCaps = [...caps];
    const minCap = allCaps.reduce((a, b) => (b.value < a.value ? b : a));
    effective = Math.min(minCap.value, safeFallback);
    status = "UNVERIFIED_MODEL";
    notes.push(`no verified profile for ${key ?? "unknown"}; capped at ${effective} (provider=${providerWindow ?? "n/a"}, fallback=${CONSERVATIVE_FALLBACK_VERIFIED})`);
  } else if (providerWindow === null) {
    // Provider metadata unavailable: effective bounded by proxy/client/verified.
    const minCap = caps.reduce((a, b) => (b.value < a.value ? b : a));
    effective = minCap.value;
    status = "DEGRADED_NO_PROVIDER_METADATA";
    notes.push(`provider metadata unavailable; effective capped by ${minCap.name} at ${effective}`);
  } else {
    // Both known: conservative expansion, automatic shrink.
    const minCap = caps.reduce((a, b) => (b.value < a.value ? b : a));
    effective = minCap.value;

    if (verified > providerWindow) {
      status = "SAFE_SHRINK";
      notes.push(`provider shrank below verified (${providerWindow} < ${verified}); auto-adjusted`);
    } else if (verified < providerWindow) {
      // Provider expanded beyond verified. Status depends on what binds effective.
      // If a non-verified cap (proxy/client) also binds at verified level, system is CONSISTENT.
      // Only flag REVALIDATION_AVAILABLE if verified is the sole binding cap.
      const otherCaps = [proxyWindow, clientWindow].filter(v => v !== null);
      const otherBindsAtVerified = otherCaps.some(c => c <= verified);
      if (otherBindsAtVerified) {
        status = "CONSISTENT";
        notes.push(`provider expanded to ${providerWindow} but local caps bind at ${effective}; no revalidation needed until local caps change`);
      } else {
        status = "REVALIDATION_AVAILABLE";
        notes.push(`provider expanded to ${providerWindow} but verified remains ${verified}; revalidation required to expand`);
      }
    } else {
      status = "CONSISTENT";
    }
  }

  const ratios = policy.defaults;
  const checkpoint = roundThreshold(effective * ratios.checkpoint_ratio);
  const compact = roundThreshold(effective * ratios.compact_ratio);
  const danger = roundThreshold(effective * ratios.danger_ratio);

  const violations = [];
  if (!(checkpoint < compact)) violations.push(`checkpoint (${checkpoint}) >= compact (${compact})`);
  if (!(compact < danger)) violations.push(`compact (${compact}) >= danger (${danger})`);
  if (!(danger < effective)) violations.push(`danger (${danger}) >= effective (${effective})`);
  if (providerWindow !== null && !(effective <= providerWindow)) {
    violations.push(`effective (${effective}) > provider (${providerWindow})`);
  }
  if (violations.length) {
    throw toolFailure(`context policy invariant violated: ${violations.join("; ")}`);
  }

  return {
    provider,
    model,
    provider_context_window: providerWindow,
    verified_reliable_window: verified,
    local_proxy_window: proxyWindow,
    client_context_window: clientWindow,
    effective_operating_window: effective,
    checkpoint_threshold: checkpoint,
    compact_threshold: compact,
    danger_threshold: danger,
    ratios: { ...ratios },
    status,
    notes,
    profile_key: key,
  };
}

/**
 * Validate that a Codex client configuration matches the resolved policy.
 * Returns an array of mismatch descriptions (empty = consistent).
 */
export function validateClientConsistency(resolved, clientConfig) {
  const mismatches = [];
  if (!clientConfig) {
    mismatches.push("client config not provided");
    return mismatches;
  }
  if (typeof clientConfig.model_context_window === "number" && clientConfig.model_context_window !== resolved.effective_operating_window) {
    mismatches.push(`client model_context_window=${clientConfig.model_context_window} != effective=${resolved.effective_operating_window}`);
  }
  if (typeof clientConfig.model_auto_compact_token_limit === "number" && clientConfig.model_auto_compact_token_limit !== resolved.compact_threshold) {
    mismatches.push(`client model_auto_compact_token_limit=${clientConfig.model_auto_compact_token_limit} != compact=${resolved.compact_threshold}`);
  }
  return mismatches;
}

/**
 * Check consistency between canonical policy and runtime config files.
 * Returns { ok, expected, actual, mismatches }.
 */
export function checkRuntimeSync(resolved, runtimeFiles) {
  const mismatches = [];
  const expected = {
    effective_operating_window: resolved.effective_operating_window,
    compact_threshold: resolved.compact_threshold,
  };
  const actual = {};

  if (runtimeFiles?.codexConfig) {
    const txt = runtimeFiles.codexConfig;
    const mWin = txt.match(/model_context_window\s*=\s*(\d+)/);
    const mCompact = txt.match(/model_auto_compact_token_limit\s*=\s*(\d+)/);
    if (mWin) actual.codex_context_window = parseInt(mWin[1], 10);
    if (mCompact) actual.codex_auto_compact = parseInt(mCompact[1], 10);
    if (actual.codex_context_window !== undefined && actual.codex_context_window !== expected.effective_operating_window) {
      mismatches.push(`codex config model_context_window=${actual.codex_context_window} != effective=${expected.effective_operating_window}`);
    }
    if (actual.codex_auto_compact !== undefined && actual.codex_auto_compact !== expected.compact_threshold) {
      mismatches.push(`codex config model_auto_compact_token_limit=${actual.codex_auto_compact} != compact=${expected.compact_threshold}`);
    }
  }

  if (runtimeFiles?.proxyScript) {
    const txt = runtimeFiles.proxyScript;
    const mSafe = txt.match(/SAFE_CONTEXT_WINDOW\s*=\s*(\d+)/);
    if (mSafe) actual.proxy_safe_window = parseInt(mSafe[1], 10);
    if (actual.proxy_safe_window !== undefined && actual.proxy_safe_window !== expected.effective_operating_window) {
      mismatches.push(`proxy SAFE_CONTEXT_WINDOW=${actual.proxy_safe_window} != effective=${expected.effective_operating_window}`);
    }
  }

  return { ok: mismatches.length === 0, expected, actual, mismatches };
}
