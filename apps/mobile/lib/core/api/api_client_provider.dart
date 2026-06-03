import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';

/// Shared, app-wide [ApiClient] wired to the auth seam.
///
/// Attaches the current learner's bearer token (or sends none → server 401)
/// via [AuthController.currentAccessToken]. Every feature repository depends on
/// this single provider instead of constructing its own HTTP client, so auth,
/// base-URL resolution, and JSON handling stay consistent. Public/content
/// endpoints simply ignore the (possibly null) token.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    environment: ref.watch(appEnvironmentProvider),
    httpClient: http.Client(),
    accessTokenProvider: () =>
        ref.read(authControllerProvider.notifier).currentAccessToken(),
  );
  ref.onDispose(client.close);
  return client;
});
