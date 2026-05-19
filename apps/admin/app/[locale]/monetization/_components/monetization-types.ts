export type Subscription = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  provider: string;
  providerRef: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; displayName: string };
  plan: { slug: string; nameKey: string };
};

export type EntitlementDef = {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  _count: { plans: number };
};

export type QuotaPolicy = {
  id: string;
  key: string;
  windowCode: string;
  description: string | null;
  warnThresholdPercent: number | null;
  createdAt: string;
};

export type PlanQuota = {
  id: string;
  planId: string;
  quotaPolicyId: string;
  limitValue: number;
  plan: { id: string; slug: string };
  quotaPolicy: QuotaPolicy;
};

export type QuotaOverride = {
  id: string;
  userId: string;
  quotaKey: string;
  limitValue: number;
  reason: string;
  expiresAt: string | null;
  createdByActorId: string | null;
  createdAt: string;
  user: { id: string; email: string; displayName: string };
};

export type Coupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  allowedPlanSlugs: string[];
  maxRedemptions: number | null;
  redemptionCount: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  signatureVerified: boolean;
  status: string;
  meta: unknown;
  retryCount: number;
  lastError?: string;
  receivedAt: string;
  processedAt: string | null;
};

export type AdPlacement = {
  id: string;
  code: string;
  labelKey: string | null;
  config: unknown;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorId?: string;
  userId?: string;
  actorKind?: string;
  targetId?: string;
  targetType?: string;
  payload?: unknown;
  at: string;
  source: string;
};

export type AnalyticsData = {
  billingProviderConnected: boolean;
  windowDays: number;
  eventsByName: Array<{ name: string; count: number }>;
  revenuePlaceholder: null;
};

export type TabCommonProps = {
  common: { error: string; loading: string; records: string; status: string; updatedAt: string };
  canRead: boolean;
  canManage: boolean;
};
