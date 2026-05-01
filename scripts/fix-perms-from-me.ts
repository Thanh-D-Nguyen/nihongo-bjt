/**
 * Script to replace local permsFromMe/permissionCodesFromMe + MePayload
 * with imports from @/app/_components/admin-client-utils
 *
 * Run: npx tsx scripts/fix-perms-from-me.ts
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// Files that have local permsFromMe
const permsFromMeFiles = [
  "apps/admin/app/[locale]/settings/settings-admin-client.tsx",
  "apps/admin/app/[locale]/privacy/data-requests/privacy-data-requests-client.tsx",
  "apps/admin/app/[locale]/flashcards/generated/flashcard-decks-admin-client.tsx",
  "apps/admin/app/[locale]/flashcards/templates/flashcard-variants-admin-client.tsx",
  "apps/admin/app/[locale]/content/versions/content-versions-client.tsx",
  "apps/admin/app/[locale]/content/enrichment/content-enrichment-client.tsx",
  "apps/admin/app/[locale]/assessment/quiz-sessions/quiz-sessions-client.tsx",
  "apps/admin/app/[locale]/assessment/mock-exams/mock-exams-client.tsx",
  "apps/admin/app/[locale]/assessment/question-bank/question-bank-client.tsx",
  "apps/admin/app/[locale]/assessment/quiz-templates/quiz-templates-client.tsx",
  "apps/admin/app/[locale]/assessment/remediation/remediation-client.tsx",
  "apps/admin/app/[locale]/growth/referrals/growth-referrals-client.tsx",
  "apps/admin/app/[locale]/growth/postcards/growth-postcards-client.tsx",
  "apps/admin/app/[locale]/growth/social/growth-social-client.tsx",
  "apps/admin/app/[locale]/growth/campaigns/growth-campaigns-client.tsx",
  "apps/admin/app/[locale]/system/queue-health/queue-health-client.tsx",
  "apps/admin/app/[locale]/system/search-sync/search-sync-client.tsx",
  "apps/admin/app/[locale]/system/release/release-client.tsx",
  "apps/admin/app/[locale]/i18n/i18n-admin-client.tsx",
  "apps/admin/app/[locale]/legal/_components/legal-policy-admin-client.tsx",
  "apps/admin/app/[locale]/import/failed/import-failed-client.tsx",
  "apps/admin/app/[locale]/import/manifests/import-manifests-client.tsx",
  "apps/admin/app/[locale]/media/media-admin-client.tsx",
];

// Files that have permissionCodesFromMe (battle pages)
const permCodesFromMeFiles = [
  "apps/admin/app/[locale]/battle/bots/battle-bots-client.tsx",
  "apps/admin/app/[locale]/battle/matches/battle-matches-client.tsx",
  "apps/admin/app/[locale]/battle/configs/battle-configs-client.tsx",
  "apps/admin/app/[locale]/battle/abuse/battle-abuse-client.tsx",
];

// Files that only have MePayload but no permsFromMe (they use inline code)
const mePayloadOnlyFiles = [
  "apps/admin/app/[locale]/daily-hub/daily-items-client.tsx",
  "apps/admin/app/[locale]/learning/paths/learning-paths-client.tsx",
  "apps/admin/app/[locale]/learning/competencies/competencies-client.tsx",
  "apps/admin/app/[locale]/learning/review/learning-review-client.tsx",
];

const IMPORT_LINE = `import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";`;

// Pattern A: multi-line function with expanded for-loops
const MULTILINE_PERMS_RE = /type MePayload = \{[^}]+\};\nfunction permsFromMe\(me: MePayload\): Set<string> \{\n  const out = new Set<string>\(\);\n  for \(const r of me\.roles \?\? \[\]\) \{\n    for \(const link of r\.role\?\.permissions \?\? \[\]\) \{\n      const code = link\.permission\?\.code;\n      if \(code\) out\.add\(code\);\n    \}\n  \}\n  return out;\n\}/;

// Pattern B: compact single-line for-loops (assessment, system, import pages)
const COMPACT_PERMS_RE = /type MePayload = \{[^}]+\};\nfunction permsFromMe\(me: MePayload\): Set<string> \{\n  const out = new Set<string>\(\);\n  for \(const r of me\.roles \?\? \[\]\) for \(const link of r\.role\?\.permissions \?\? \[\]\) \{\n    const c = link\.permission\?\.code; if \(c\) out\.add\(c\);\n  \}\n  return out;\n\}/;

// Pattern C: permissionCodesFromMe (battle pages)
const PERM_CODES_RE = /type MePayload = \{[^}]+\};\nfunction permissionCodesFromMe\(me: MePayload\): Set<string> \{\n  const out = new Set<string>\(\);\n  for \(const r of me\.roles \?\? \[\]\) \{\n    for \(const link of r\.role\?\.permissions \?\? \[\]\) \{\n      const code = link\.permission\?\.code;\n      if \(code\) out\.add\(code\);\n    \}\n  \}\n  return out;\n\}/;

function addImport(content: string, importLine: string): string {
  // Check if already imported
  if (content.includes('from "@/app/_components/admin-client-utils"')) {
    // Already has import from this module, maybe update it
    const existing = content.match(/import \{([^}]+)\} from "@\/app\/_components\/admin-client-utils"/);
    if (existing) {
      const imports = existing[1].split(",").map(s => s.trim());
      if (!imports.includes("permsFromMe")) {
        imports.push("permsFromMe");
      }
      if (!imports.some(s => s.includes("MePayload"))) {
        imports.push("type MePayload");
      }
      const newImport = `import { ${imports.join(", ")} } from "@/app/_components/admin-client-utils"`;
      return content.replace(existing[0], newImport);
    }
    return content;
  }
  // Add after the last import line
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ") || lines[i].match(/^} from "/)) {
      lastImportIdx = i;
    }
    // Stop scanning after first non-import, non-blank line after imports
    if (lastImportIdx >= 0 && i > lastImportIdx + 2 && lines[i].trim() && !lines[i].startsWith("import ")) break;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    // Fallback: add after "use client" or at top
    const useClientIdx = lines.findIndex(l => l.includes('"use client"'));
    lines.splice(useClientIdx >= 0 ? useClientIdx + 1 : 0, 0, "", importLine);
  }
  return lines.join("\n");
}

let totalFixed = 0;

// Process permsFromMe files
for (const rel of permsFromMeFiles) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, "utf8");
  const orig = content;

  // Try pattern A (multiline)
  if (MULTILINE_PERMS_RE.test(content)) {
    content = content.replace(MULTILINE_PERMS_RE, "");
  } else if (COMPACT_PERMS_RE.test(content)) {
    content = content.replace(COMPACT_PERMS_RE, "");
  } else {
    // Fallback: try to remove the type and function lines manually
    const lines = content.split("\n");
    const meIdx = lines.findIndex(l => l.startsWith("type MePayload = {"));
    const fnIdx = lines.findIndex(l => l.startsWith("function permsFromMe("));
    if (meIdx >= 0 && fnIdx >= 0) {
      // Find end of function (next line that is just "}")
      let endIdx = fnIdx;
      for (let i = fnIdx + 1; i < lines.length; i++) {
        if (lines[i] === "}") { endIdx = i; break; }
      }
      // Remove from meIdx to endIdx (inclusive)
      const startRemove = meIdx;
      const endRemove = endIdx;
      lines.splice(startRemove, endRemove - startRemove + 1);
      content = lines.join("\n");
    } else {
      console.log(`WARN: could not find pattern in ${rel}`);
      continue;
    }
  }

  // Clean up extra blank lines left behind
  content = content.replace(/\n{3,}/g, "\n\n");

  // Add import
  content = addImport(content, IMPORT_LINE);

  if (content !== orig) {
    fs.writeFileSync(fp, content);
    console.log(`FIXED: ${rel}`);
    totalFixed++;
  }
}

// Process permissionCodesFromMe files (battle)
for (const rel of permCodesFromMeFiles) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, "utf8");
  const orig = content;

  if (PERM_CODES_RE.test(content)) {
    content = content.replace(PERM_CODES_RE, "");
  } else {
    // Manual removal
    const lines = content.split("\n");
    const meIdx = lines.findIndex(l => l.startsWith("type MePayload = {"));
    const fnIdx = lines.findIndex(l => l.startsWith("function permissionCodesFromMe("));
    if (meIdx >= 0 && fnIdx >= 0) {
      let endIdx = fnIdx;
      for (let i = fnIdx + 1; i < lines.length; i++) {
        if (lines[i] === "}") { endIdx = i; break; }
      }
      lines.splice(meIdx, endIdx - meIdx + 1);
      content = lines.join("\n");
    } else {
      console.log(`WARN: could not find pattern in ${rel}`);
      continue;
    }
  }

  content = content.replace(/\n{3,}/g, "\n\n");

  // Replace all usages of permissionCodesFromMe with permsFromMe
  content = content.replace(/permissionCodesFromMe/g, "permsFromMe");

  // Add import
  content = addImport(content, IMPORT_LINE);

  if (content !== orig) {
    fs.writeFileSync(fp, content);
    console.log(`FIXED (battle): ${rel}`);
    totalFixed++;
  }
}

// Process files with MePayload only (they have inline permission extraction)
for (const rel of mePayloadOnlyFiles) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, "utf8");
  const orig = content;

  // Check if it has its own permsFromMe or permissionCodesFromMe
  const hasFn = /function (permsFromMe|permissionCodesFromMe)\(/.test(content);

  if (hasFn) {
    // Remove the function + type
    const lines = content.split("\n");
    const meIdx = lines.findIndex(l => l.startsWith("type MePayload = {"));
    const fnIdx = lines.findIndex(l => /^function (permsFromMe|permissionCodesFromMe)\(/.test(l));
    if (meIdx >= 0 && fnIdx >= 0) {
      let endIdx = fnIdx;
      for (let i = fnIdx + 1; i < lines.length; i++) {
        if (lines[i] === "}") { endIdx = i; break; }
      }
      lines.splice(meIdx, endIdx - meIdx + 1);
      content = lines.join("\n");
    }
  } else {
    // Just remove the type and add import
    content = content.replace(/type MePayload = \{[^}]+\};\n?/, "");
  }

  // Check if this file has inline permission extraction we need to replace
  // Pattern: set permissions inline like `const out = new Set<string>(); for (...) out.add(...)`
  // These need manual review - just add import for now
  
  content = content.replace(/\n{3,}/g, "\n\n");
  content = addImport(content, IMPORT_LINE);

  if (content !== orig) {
    fs.writeFileSync(fp, content);
    console.log(`FIXED (MePayload only): ${rel}`);
    totalFixed++;
  }
}

console.log(`\nTotal files fixed: ${totalFixed}`);
