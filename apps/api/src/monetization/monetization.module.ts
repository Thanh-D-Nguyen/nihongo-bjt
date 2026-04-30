import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { LegalModule } from "../legal/legal.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { AdsAdminController } from "./ads/ads-admin.controller.js";
import { AdsAdminService } from "./ads/ads-admin.service.js";
import { AdsRuntimeController } from "./ads/ads-runtime.controller.js";
import { AdsRuntimeService } from "./ads/ads-runtime.service.js";
import { LocalAdProvider } from "./ads/local-ad.provider.js";
import { BillingWebhookController } from "./billing/billing-webhook.controller.js";
import { BillingWebhookService } from "./billing/billing-webhook.service.js";
import { LocalBillingProvider } from "./billing/local-billing.provider.js";
import { EntitlementGuard } from "./entitlement.guard.js";
import { EntitlementService } from "./entitlement.service.js";
import { LearnerMonetizationController } from "./learner-monetization.controller.js";
import { MonetizationAdminConsoleService } from "./monetization-admin-console.service.js";
import { MonetizationAdminController } from "./monetization-admin.controller.js";
import { MonetizationRepository } from "./monetization.repository.js";
import { QuotaService } from "./quota.service.js";

@Module({
  controllers: [
    AdsAdminController,
    AdsRuntimeController,
    BillingWebhookController,
    LearnerMonetizationController,
    MonetizationAdminController
  ],
  exports: [EntitlementGuard, EntitlementService, MonetizationRepository, QuotaService],
  imports: [AdminModule, LegalModule, OperationsModule],
  providers: [
    AdsAdminService,
    AdsRuntimeService,
    BillingWebhookService,
    EntitlementGuard,
    EntitlementService,
    LocalAdProvider,
    LocalBillingProvider,
    MonetizationAdminConsoleService,
    MonetizationRepository,
    QuotaService
  ]
})
export class MonetizationModule {}
