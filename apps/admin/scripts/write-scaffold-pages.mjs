import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../app/[locale]");

const pairs = [
  ["system/health", "ov.systemHealth"],
  ["system/queue-health", "ov.queueHealth"],
  ["system/search-sync", "ov.searchSync"],
  ["system/release", "ov.release"],
  ["content/versions", "cm.versions"],
  ["content/enrichment", "cm.enrichment"],
  ["i18n", "cm.i18n"],
  ["flashcards/templates", "ln.templates"],
  ["flashcards/generated", "ln.generated"],
  ["learning/paths", "ln.paths"],
  ["learning/competencies", "ln.competencies"],
  ["assessment/quiz-templates", "as.quizTemplates"],
  ["assessment/question-bank", "as.qbank"],
  ["assessment/quiz-sessions", "as.sessions"],
  ["assessment/mock-exams", "as.mock"],
  ["assessment/remediation", "as.remediation"],
  ["battle/configs", "bt.configs"],
  ["battle/bots", "bt.bots"],
  ["battle/matches", "bt.matches"],
  ["battle/leaderboard", "bt.leader"],
  ["battle/abuse", "bt.abuse"],
  ["users/360", "u.360"],
  ["support/notes", "u.notes"],
  ["privacy/requests", "u.privacy"],
  ["privacy/data-requests", "u.export"],
  ["analytics/growth", "an.growth"],
  ["analytics/bjt", "an.bjt"],
  ["analytics/flashcards", "an.fc"],
  ["analytics/battle", "an.battle"],
  ["analytics/system", "an.sys"],
  ["monetization/plans", "mo.plans"],
  ["monetization/entitlements", "mo.ent"],
  ["monetization/quotas", "mo.quo"],
  ["monetization/subscriptions", "mo.sub"],
  ["monetization/billing-events", "mo.bill"],
  ["monetization/refunds", "mo.ref"],
  ["monetization/provider-config", "mo.prov"],
  ["monetization/webhook-dlq", "mo.dlq"],
  ["growth/social", "gr.social"],
  ["growth/referrals", "gr.ref"],
  ["growth/postcards", "gr.pc"],
  ["growth/campaigns", "gr.camp"],
  ["ops/feature-flags", "op.ff"],
  ["ops/kill-switches", "op.kill"],
  ["ops/dead-letters", "op.dl"],
  ["import/manifests", "op.manifests"],
  ["import/failed", "op.failed"],
  ["ops/notifications", "op.notif"],
  ["ops/security", "op.sec"],
  ["legal/documents", "lg.doc"],
  ["legal/terms", "lg.terms"],
  ["legal/consent", "lg.consent"],
  ["legal/cookies", "lg.cookies"],
  ["legal/tokushoho", "lg.tt"],
  ["legal/retention", "lg.ret"],
  ["iam/roles", "iam.roles"],
  ["iam/permissions", "iam.permissions"],
  ["iam/admins", "iam.admins"],
  ["iam/role-audit", "iam.roleAudit"]
];

const body = (id) => `import { renderAdminScaffoldForId } from "@/lib/render-admin-scaffold";
import type { AdminScaffoldId } from "@/lib/admin-scaffold-spec";

const MODULE_ID = "${id}" as const satisfies AdminScaffoldId;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderAdminScaffoldForId(MODULE_ID, locale);
}
`;

for (const [p, id] of pairs) {
  const dir = path.join(root, p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), body(id), "utf8");
}
console.log("wrote", pairs.length, "pages");
