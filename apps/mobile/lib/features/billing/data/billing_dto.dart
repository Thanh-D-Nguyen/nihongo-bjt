import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';

/// Defensive parsers for the `/api/learner/monetization/*` surface. Every field
/// is coerced so malformed payloads degrade gracefully instead of throwing.
abstract final class BillingDto {
  static Map<String, dynamic> asMap(Object? value) =>
      value is Map<String, dynamic> ? value : const {};

  static List<Map<String, dynamic>> asMapList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  static String _str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static String? _strOrNull(Object? value) =>
      value is String && value.isNotEmpty ? value : null;

  static int _int(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static bool _bool(Object? value) => value is bool && value;

  static DateTime? _dateOrNull(Object? value) {
    if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
    return null;
  }

  static List<String> _stringList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<String>().toList(growable: false);
  }

  static PlanQuota quota(Map<String, dynamic> json) => PlanQuota(
        key: _str(json['key']),
        limit: _int(json['limit']),
        window: _str(json['window']),
      );

  static List<PlanQuota> _quotas(Object? value) =>
      asMapList(value).map(quota).toList(growable: false);

  static SubscriptionView subscription(Object? json) {
    final map = asMap(json);
    final source = _str(map['source']) == 'subscription'
        ? PlanSource.subscription
        : PlanSource.defaultPlan;
    return SubscriptionView(
      planSlug: _str(map['planSlug']),
      planName: _str(map['planName'], _str(map['planSlug'])),
      planNameVi: _strOrNull(map['planNameVi']),
      planNameJa: _strOrNull(map['planNameJa']),
      source: source,
      status: _strOrNull(map['status']),
      currentPeriodEnd: _dateOrNull(map['currentPeriodEnd']),
      cancelAtPeriodEnd: _bool(map['cancelAtPeriodEnd']),
      entitlements: _stringList(map['entitlements']),
      quotas: _quotas(map['quotas']),
    );
  }

  static List<PlanView> plans(Object? json) =>
      asMapList(json).map(plan).toList(growable: false);

  static PlanView plan(Map<String, dynamic> json) {
    final config = asMap(json['config']);
    return PlanView(
      id: _str(json['id']),
      slug: _str(json['slug']),
      nameKey: _str(json['nameKey']),
      price: _int(config['price']),
      recommended: _bool(config['recommended']),
      displayName: _strOrNull(config['displayName']),
      displayNameVi: _strOrNull(config['displayNameVi']),
      displayNameJa: _strOrNull(config['displayNameJa']),
      entitlements: _stringList(json['entitlements']),
      quotas: _quotas(json['quotas']),
    );
  }

  /// Whether a cancel response confirms the subscription will end at period
  /// end. Tolerates either `{ ok, cancelAtPeriodEnd }` or a bare boolean.
  static bool cancelConfirmed(Object? json) {
    final map = asMap(json);
    return _bool(map['cancelAtPeriodEnd']) || _bool(map['ok']);
  }
}
