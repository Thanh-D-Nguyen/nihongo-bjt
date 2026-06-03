import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/billing/data/billing_dto.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';

/// Read + manage access to the learner monetization surface
/// (`/api/learner/monetization/*`).
///
/// These endpoints require an authenticated session: the shared [ApiClient]
/// attaches the bearer token and the backend resolves the learner from it, so
/// no `userId` is ever sent from the client. Failures are normalized to
/// [RepositoryException]; the repository never fabricates a plan or status.
class BillingRepository {
  const BillingRepository(this._client);

  final ApiClient _client;

  /// The learner's current resolved subscription (or the default free plan).
  Future<SubscriptionView> subscription() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/learner/monetization/subscription'),
    );
    return BillingDto.subscription(json);
  }

  /// Active plans available for the learner pricing surface.
  Future<List<PlanView>> plans() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/learner/monetization/plans'),
    );
    return BillingDto.plans(json);
  }

  /// Requests cancellation of the active subscription at period end. Returns
  /// whether the server confirmed the pending cancellation.
  Future<bool> cancelSubscription() async {
    final json = await guardApiCall(
      () => _client.postJson(
        '/api/learner/monetization/subscription/cancel',
      ),
    );
    return BillingDto.cancelConfirmed(json);
  }
}
