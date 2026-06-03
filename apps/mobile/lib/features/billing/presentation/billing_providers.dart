import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/billing/data/billing_repository.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';

/// Riverpod wiring for the learner monetization surface
/// (`/api/learner/monetization/*`).

// The list providers expose verbose generated types; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Single shared [BillingRepository] on the auth-aware API client.
final billingRepositoryProvider = Provider<BillingRepository>(
  (ref) => BillingRepository(ref.watch(apiClientProvider)),
);

/// The learner's current resolved subscription (or default free plan).
final subscriptionProvider = FutureProvider.autoDispose<SubscriptionView>((
  ref,
) {
  ref.keepAlive();
  return ref.watch(billingRepositoryProvider).subscription();
});

/// Active plans available on the pricing surface.
final plansProvider = FutureProvider.autoDispose<List<PlanView>>((ref) {
  ref.keepAlive();
  return ref.watch(billingRepositoryProvider).plans();
});
