import 'package:flutter/foundation.dart';

/// Sentinel the backend uses to mark an effectively-unlimited quota.
const int kUnlimitedQuota = 999999;

/// A per-window usage allowance attached to a plan (e.g. flashcard reviews
/// per day). Mirrors the `{ key, limit, window }` shape returned by
/// `/api/learner/monetization/{subscription,plans}`.
@immutable
class PlanQuota {
  const PlanQuota({
    required this.key,
    required this.limit,
    required this.window,
  });

  final String key;
  final int limit;
  final String window;

  /// Whether the limit is high enough that we should present it as unlimited
  /// rather than a raw number.
  bool get isUnlimited => limit >= kUnlimitedQuota;
}

/// Source of the learner's resolved plan: an actual paid subscription, or the
/// implicit default (free) plan.
enum PlanSource { subscription, defaultPlan }

/// The learner's current subscription, as returned by
/// `GET /api/learner/monetization/subscription`.
@immutable
class SubscriptionView {
  const SubscriptionView({
    required this.planSlug,
    required this.planName,
    required this.source,
    required this.cancelAtPeriodEnd,
    required this.entitlements,
    required this.quotas,
    this.planNameVi,
    this.planNameJa,
    this.status,
    this.currentPeriodEnd,
  });

  final String planSlug;
  final String planName;
  final String? planNameVi;
  final String? planNameJa;
  final PlanSource source;
  final String? status;
  final DateTime? currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final List<String> entitlements;
  final List<PlanQuota> quotas;

  /// On the implicit default plan there is no paid subscription to manage.
  bool get isFree => source == PlanSource.defaultPlan;

  /// True when there is an active, non-cancelled paid subscription that the
  /// learner can choose to cancel.
  bool get canCancel => !isFree && status != null && !cancelAtPeriodEnd;

  /// Localized plan name, preferring the locale-specific field and falling
  /// back to the generic name.
  String localizedName(String localeCode) {
    if (localeCode == 'ja') {
      return planNameJa ?? planName;
    }
    return planNameVi ?? planName;
  }
}

/// A purchasable plan from `GET /api/learner/monetization/plans`.
@immutable
class PlanView {
  const PlanView({
    required this.id,
    required this.slug,
    required this.nameKey,
    required this.price,
    required this.recommended,
    required this.entitlements,
    required this.quotas,
    this.displayName,
    this.displayNameVi,
    this.displayNameJa,
  });

  final String id;
  final String slug;
  final String nameKey;
  final int price;
  final bool recommended;
  final String? displayName;
  final String? displayNameVi;
  final String? displayNameJa;
  final List<String> entitlements;
  final List<PlanQuota> quotas;

  bool get isFree => slug == 'free' || price <= 0;

  String localizedName(String localeCode) {
    final name = localeCode == 'ja'
        ? (displayNameJa ?? displayName)
        : (displayNameVi ?? displayName);
    return name ?? slug;
  }
}
