// Machine-readable policy: classification -> required gates, path rules.
// Source: docs/engineering/engineering-policy.json (canonical prose lives in
// docs/engineering/ENGINEERING_POLICY.md).
import path from "node:path";

import { compileGlobs, matchesAny, readJson, toolFailure } from "./util.mjs";

export const POLICY_PATH = "docs/engineering/engineering-policy.json";
export const POLICY_SCHEMA = "nihongo-engineering-policy/1";

export function loadPolicy(root) {
  const raw = readJson(path.join(root, POLICY_PATH), POLICY_PATH);
  return compilePolicy(raw);
}

/** Validate the policy shape and pre-compile globs. Any inconsistency is a tool failure. */
export function compilePolicy(raw) {
  const problems = [];
  if (raw?.schema !== POLICY_SCHEMA) problems.push(`schema must be ${POLICY_SCHEMA}`);
  for (const key of ["classes", "change_kinds", "red_exceptions", "gates", "path_rules", "area_rules", "risk_rules", "harness", "runners"]) {
    if (!raw?.[key]) problems.push(`missing ${key}`);
  }
  if (problems.length) throw toolFailure(`invalid ${POLICY_PATH}: ${problems.join("; ")}`);

  const gateIds = new Set(Object.keys(raw.gates));
  const classIds = new Set(Object.keys(raw.classes));
  const checkGates = (where, gates = []) => {
    for (const g of gates) if (!gateIds.has(g)) problems.push(`${where} references unknown gate ${g}`);
  };
  const checkClasses = (where, classes = []) => {
    for (const c of classes) if (!classIds.has(c)) problems.push(`${where} references unknown class ${c}`);
  };
  for (const [id, c] of Object.entries(raw.classes)) checkGates(`class ${id}`, c.gates);
  for (const [id, k] of Object.entries(raw.change_kinds)) {
    checkGates(`change_kind ${id}`, k.gates);
    checkClasses(`change_kind ${id}`, k.allowed_classes);
    checkClasses(`change_kind ${id}`, k.requires_classes);
  }
  for (const [id, e] of Object.entries(raw.red_exceptions)) {
    checkGates(`red_exception ${id}`, e.replacement_gates);
    checkClasses(`red_exception ${id}`, e.allowed_classes);
  }
  for (const [id, g] of Object.entries(raw.gates)) {
    if (g.type === "suite" && !Array.isArray(g.command)) problems.push(`suite gate ${id} has no command`);
    if (g.blockable && !Array.isArray(g.known_alternatives)) problems.push(`blockable gate ${id} must list known_alternatives`);
  }
  const pathRules = raw.path_rules.map((rule) => {
    if (rule.requires_any && rule.requires_any !== "*") checkClasses(`path rule ${rule.kind}`, rule.requires_any);
    return { ...rule, regexps: compileGlobs(rule.globs) };
  });
  if (!pathRules.length || !pathRules.at(-1).globs.includes("**")) problems.push("the last path rule must be a ** catch-all");
  const areaRules = raw.area_rules.map((rule) => {
    checkGates(`area rule`, [rule.suite]);
    return { ...rule, regexps: compileGlobs(rule.globs) };
  });
  const riskRules = raw.risk_rules.map((rule) => ({
    ...rule,
    regexps: rule.globs ? compileGlobs(rule.globs) : null,
    addedLine: rule.added_line ? new RegExp(rule.added_line) : null,
    assertionLine: rule.assertion_line ? new RegExp(rule.assertion_line) : null
  }));
  const vitestConfigs = (raw.runners.vitest?.configs ?? []).map((c) => ({ ...c, regexps: compileGlobs(c.globs) }));
  const volatile = compileGlobs(raw.volatile_paths?.globs ?? []);
  if (problems.length) throw toolFailure(`invalid ${POLICY_PATH}: ${problems.join("; ")}`);
  return { raw, pathRules, areaRules, riskRules, vitestConfigs, volatile, gateIds, classIds };
}

/** First matching path rule (the policy ends with a catch-all). */
export function pathRule(policy, relPath) {
  return policy.pathRules.find((rule) => matchesAny(relPath, rule.regexps));
}

export const isTaskRecord = (policy, relPath) => pathRule(policy, relPath).kind === "task_record";

/** Tracked build artifacts rewritten by the gate tools (policy volatile_paths): never owned, never fingerprinted. */
export const isVolatile = (policy, relPath) => matchesAny(relPath, policy.volatile ?? []);

export function suitesFor(policy, paths) {
  const suites = new Set();
  for (const p of paths) for (const rule of policy.areaRules) if (matchesAny(p, rule.regexps)) suites.add(rule.suite);
  return suites;
}

/** Paths that need a task record at all (everything but pure docs and task records). */
export function needsTask(policy, relPath) {
  if (isVolatile(policy, relPath)) return false;
  const kind = pathRule(policy, relPath).kind;
  return kind !== "task_record" && !(policy.raw.exempt_from_task ?? []).includes(kind);
}

/**
 * Derive the gate set a task must satisfy from its declared classification,
 * the paths it changes and the risk findings in its diff. The agent never
 * picks gates; it can only add classes, and paths can force classes.
 *
 * Returns { gates: Map<gate, string[] reasons>, errors: string[] }.
 */
export function requiredGates(policy, task, ownedPaths, findings = []) {
  const { raw } = policy;
  const errors = [];
  const gates = new Map();
  const add = (gate, reason) => gates.set(gate, [...(gates.get(gate) ?? []), reason]);

  const classification = task.classification;
  if (!classification || !Array.isArray(classification.classes) || !classification.classes.length) {
    return { gates, errors: ["task is not classified (pnpm quality classify)"] };
  }
  const classes = classification.classes;
  const kindId = classification.change_kind;
  const kind = raw.change_kinds[kindId];
  for (const c of classes) if (!raw.classes[c]) errors.push(`unknown class ${c}`);
  if (!kind) errors.push(`unknown change_kind ${JSON.stringify(kindId)} (one of ${Object.keys(raw.change_kinds).join(", ")})`);
  if (errors.length) return { gates, errors };

  add("acceptance", "always");

  // Paths force classes: a realtime file cannot hide behind DOMAIN_LOGIC.
  for (const p of ownedPaths) {
    const rule = pathRule(policy, p);
    if (Array.isArray(rule.requires_any) && !rule.requires_any.some((c) => classes.includes(c))) {
      errors.push(`misclassified: ${p} is ${rule.kind} and requires one of [${rule.requires_any.join(", ")}]`);
    }
  }

  const behaviorClasses = classes.filter((c) => raw.classes[c].behavior);
  if (kind.requires_behavior_class && !behaviorClasses.length) {
    errors.push(`change_kind ${kindId} requires a behavior class (declared: ${classes.join(", ")})`);
  }
  if (kind.allowed_classes) {
    const bad = classes.filter((c) => !kind.allowed_classes.includes(c));
    if (bad.length) errors.push(`change_kind ${kindId} cannot be used with ${bad.join(", ")} (behavior changes need add/modify/bugfix/delete/characterization/refactor)`);
  }
  for (const required of kind.requires_classes ?? []) {
    if (!classes.includes(required)) errors.push(`change_kind ${kindId} requires class ${required}`);
  }
  if (classes.includes("FUNCTION_DELETION") && kindId !== "delete") {
    errors.push("FUNCTION_DELETION requires change_kind delete");
  }

  for (const c of classes) {
    for (const g of raw.classes[c].gates) add(g, `class ${c}`);
    if (raw.classes[c].high_risk) add("review", `high-risk class ${c}`);
  }
  for (const g of kind.gates ?? []) add(g, `change_kind ${kindId}`);

  const exception = task.red_exception;
  if (kind.red) {
    if (exception) {
      const def = raw.red_exceptions[exception.category];
      if (!def) {
        errors.push(`unknown red_exception category ${JSON.stringify(exception.category)} (one of ${Object.keys(raw.red_exceptions).join(", ")})`);
      } else {
        if (!String(exception.reason ?? "").trim()) errors.push("red_exception.reason is required");
        const bad = def.allowed_classes ? behaviorClasses.filter((c) => !def.allowed_classes.includes(c)) : [];
        if (bad.length) errors.push(`red_exception ${exception.category} is not allowed for ${bad.join(", ")}`);
        if (def.allowed_kinds && !def.allowed_kinds.includes(kindId)) errors.push(`red_exception ${exception.category} is only allowed for change_kind ${def.allowed_kinds.join("/")}`);
        if (def.forbid_revertible_production) {
          const code = ownedPaths.filter((p) => pathRule(policy, p).replay_revert);
          if (code.length) errors.push(`red_exception ${exception.category} cannot cover revertible code (a RED is possible there): ${code.slice(0, 5).join(", ")}`);
        }
        if (def.allowed_production_globs) {
          const allowed = compileGlobs(def.allowed_production_globs);
          const code = ownedPaths.filter((p) => pathRule(policy, p).production && !matchesAny(p, allowed));
          if (code.length) errors.push(`red_exception ${exception.category} only covers canonical schema/migration files: ${code.slice(0, 5).join(", ")}`);
        }
        for (const g of def.replacement_gates) add(g, `red_exception ${exception.category}`);
      }
    } else {
      add("red", `change_kind ${kindId}`);
      add("green", `change_kind ${kindId}`);
    }
  } else if (exception) {
    errors.push(`red_exception is only meaningful for add/modify/bugfix/delete (change_kind is ${kindId})`);
  }

  for (const suite of suitesFor(policy, ownedPaths)) add(suite, "changed paths");

  for (const f of findings) {
    if (f.severity === "high") add("review", `risk finding ${f.id}`);
  }
  return { gates, errors };
}

/** Whether production edits must wait for VALID_RED (used by the write guard). */
export function redRequired(policy, task) {
  const kind = policy.raw.change_kinds[task?.classification?.change_kind];
  return Boolean(kind?.red) && !task.red_exception;
}
