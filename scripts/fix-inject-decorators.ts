/**
 * Script to add missing @Inject() decorators to NestJS constructor parameters.
 * tsx/esbuild doesn't support emitDecoratorMetadata, so explicit @Inject() is needed.
 *
 * Run with: npx tsx scripts/fix-inject-decorators.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const FILES_TO_FIX: Array<{ file: string; params: Array<{ name: string; type: string }> }> = [
  // Assessment controllers
  { file: 'apps/api/src/admin/i18n-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'I18nAdminRepository' }] },
  { file: 'apps/api/src/assessment/mock-exams-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'MockExamsAdminRepository' }] },
  { file: 'apps/api/src/assessment/question-bank-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'QuestionBankAdminRepository' }] },
  { file: 'apps/api/src/assessment/quiz-sessions-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'QuizSessionsAdminRepository' }] },
  { file: 'apps/api/src/assessment/quiz-templates-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'QuizTemplatesAdminRepository' }] },
  { file: 'apps/api/src/assessment/remediation-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'RemediationAdminRepository' }] },
  // Battle controllers
  { file: 'apps/api/src/battle/battle-abuse-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'BattleAbuseAdminRepository' }] },
  { file: 'apps/api/src/battle/battle-bots-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'BattleBotsAdminRepository' }] },
  { file: 'apps/api/src/battle/battle-configs-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'BattleConfigsAdminRepository' }] },
  { file: 'apps/api/src/battle/battle-leaderboard-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'BattleLeaderboardAdminRepository' }] },
  { file: 'apps/api/src/battle/battle-matches-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'BattleMatchesAdminRepository' }] },
  // Content controllers
  { file: 'apps/api/src/content/content-enrichment-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'ContentEnrichmentAdminRepository' }] },
  { file: 'apps/api/src/content/content-versions-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'ContentVersionsAdminRepository' }] },
  // Daily controllers
  { file: 'apps/api/src/daily/daily-items-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'DailyItemsAdminRepository' }] },
  // Flashcards controller
  { file: 'apps/api/src/flashcards/flashcards-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'FlashcardsAdminRepository' }] },
  // Growth controllers
  { file: 'apps/api/src/growth/growth-campaigns-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'GrowthCampaignsAdminRepository' }] },
  { file: 'apps/api/src/growth/growth-postcards-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'GrowthPostcardsAdminRepository' }] },
  { file: 'apps/api/src/growth/growth-referrals-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'GrowthReferralsAdminRepository' }] },
  { file: 'apps/api/src/growth/growth-social-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'GrowthSocialAdminRepository' }] },
  { file: 'apps/api/src/growth/learner-growth.controller.ts', params: [{ name: 'share', type: 'ShareService' }, { name: 'referral', type: 'ReferralService' }, { name: 'featureGate', type: 'RuntimeFeatureGateService' }] },
  { file: 'apps/api/src/growth/public-growth.controller.ts', params: [{ name: 'share', type: 'ShareService' }, { name: 'referral', type: 'ReferralService' }, { name: 'featureGate', type: 'RuntimeFeatureGateService' }] },
  // Learning controllers
  { file: 'apps/api/src/learning/learning-competencies-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'CompetenciesAdminRepository' }] },
  { file: 'apps/api/src/learning/learning-paths-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'LearningPathsAdminRepository' }] },
  { file: 'apps/api/src/learning/learning-review-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }, { name: 'repo', type: 'LearningReviewAdminRepository' }] },
  // Legal controllers
  { file: 'apps/api/src/legal/legal-consent.controller.ts', params: [{ name: 'legalConsent', type: 'LegalConsentService' }] },
  { file: 'apps/api/src/legal/legal-cookie-category-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }] },
  { file: 'apps/api/src/legal/legal-policy-admin.controller.ts', params: [{ name: 'adminAuth', type: 'AdminAuthService' }, { name: 'legalPolicyAdmin', type: 'LegalPolicyAdminService' }] },
  { file: 'apps/api/src/legal/legal-retention-admin.controller.ts', params: [{ name: 'auth', type: 'AdminAuthService' }] },
  // Monetization controllers
  { file: 'apps/api/src/monetization/ads/ads-runtime.controller.ts', params: [{ name: 'runtime', type: 'AdsRuntimeService' }, { name: 'featureGate', type: 'RuntimeFeatureGateService' }] },
  { file: 'apps/api/src/monetization/billing/billing-webhook.controller.ts', params: [{ name: 'adminAuth', type: 'AdminAuthService' }, { name: 'webhookService', type: 'BillingWebhookService' }] },
  { file: 'apps/api/src/monetization/learner-monetization.controller.ts', params: [{ name: 'billing', type: 'LocalBillingProvider' }, { name: 'ads', type: 'LocalAdProvider' }, { name: 'entitlements', type: 'EntitlementService' }, { name: 'quota', type: 'QuotaService' }, { name: 'featureGate', type: 'RuntimeFeatureGateService' }, { name: 'legalConsent', type: 'LegalConsentService' }] },
  // Privacy controller
  { file: 'apps/api/src/privacy/privacy-request.controller.ts', params: [{ name: 'privacyService', type: 'PrivacyRequestService' }] },
  // Services
  { file: 'apps/api/src/auth/auth.service.ts', params: [{ name: 'referral', type: 'ReferralService' }] },
  { file: 'apps/api/src/health/health.service.ts', params: [{ name: 'keycloakRealmAdmin', type: 'KeycloakRealmAdminService' }] },
  { file: 'apps/api/src/monetization/ads/ads-runtime.service.ts', params: [{ name: 'ads', type: 'LocalAdProvider' }] },
  { file: 'apps/api/src/monetization/entitlement.service.ts', params: [{ name: 'repository', type: 'MonetizationRepository' }] },
  { file: 'apps/api/src/monetization/quota.service.ts', params: [{ name: 'repository', type: 'MonetizationRepository' }] },
  { file: 'apps/api/src/quiz/quiz.service.ts', params: [{ name: 'quizRepository', type: 'QuizRepository' }, { name: 'quotaService', type: 'QuotaService' }] },
  // Guards
  { file: 'apps/api/src/monetization/entitlement.guard.ts', params: [{ name: 'entitlementService', type: 'EntitlementService' }, { name: 'reflector', type: 'Reflector' }] },
];

const ROOT = path.resolve(import.meta.dirname, '..');

let totalFixed = 0;
let totalFiles = 0;

for (const { file, params } of FILES_TO_FIX) {
  const fullPath = path.join(ROOT, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const { name, type } of params) {
    // Match constructor parameter without @Inject
    // Pattern: "private readonly name: Type" without preceding @Inject
    const paramRegex = new RegExp(
      `(\\s+)(private\\s+readonly\\s+${name}:\\s*${type})`,
      'g'
    );

    const match = paramRegex.exec(content);
    if (match) {
      const indent = match[1];
      const paramDecl = match[2];
      // Check if already has @Inject before it
      const beforeMatch = content.substring(0, match.index);
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const linesBefore = beforeMatch.substring(Math.max(0, lastNewline - 100), match.index);
      if (linesBefore.includes(`@Inject(${type})`)) {
        console.log(`  SKIP ${name}: already has @Inject(${type})`);
        continue;
      }

      content = content.replace(match[0], `${indent}@Inject(${type}) ${paramDecl}`);
      changed = true;
      totalFixed++;
      console.log(`  FIXED ${name}: added @Inject(${type})`);
    } else {
      console.log(`  WARN ${name}: pattern not found in ${file}`);
    }
  }

  if (changed) {
    // Ensure Inject is imported from @nestjs/common
    if (!content.includes('Inject') || !content.match(/import\s*\{[^}]*Inject[^}]*\}\s*from\s*["']@nestjs\/common["']/)) {
      // Add Inject to the @nestjs/common import
      content = content.replace(
        /import\s*\{([^}]*)\}\s*from\s*["']@nestjs\/common["']/,
        (match, imports) => {
          if (imports.includes('Inject')) return match;
          // Add Inject after the first import
          const importList = imports.split(',').map((s: string) => s.trim()).filter(Boolean);
          importList.push('Inject');
          importList.sort();
          return `import {\n  ${importList.join(',\n  ')}\n} from "@nestjs/common"`;
        }
      );
    }

    fs.writeFileSync(fullPath, content);
    totalFiles++;
    console.log(`✓ ${file} (${params.length} params fixed)`);
  }
}

console.log(`\nDone: ${totalFixed} @Inject() decorators added across ${totalFiles} files`);
