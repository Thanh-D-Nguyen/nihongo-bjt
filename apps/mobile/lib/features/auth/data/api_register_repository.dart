import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/register_repository.dart';

/// [RegisterRepository] backed by the first-party backend endpoint
/// `POST {API_BASE_URL}/auth/register`.
///
/// The endpoint performs the Keycloak Admin user-creation server-side so no
/// admin credentials ever ship in the app. When the endpoint is not deployed or
/// its Keycloak admin client is not configured the backend returns 404/503 and
/// this repository surfaces [RegisterFailureCode.unavailable] — it never fakes
/// success. See `docs/mobile/MOBILE_AUTH_GAP_REPORT.md`.
class ApiRegisterRepository implements RegisterRepository {
  const ApiRegisterRepository({
    required this.environment,
    this.httpClient,
  });

  final AppEnvironment environment;

  /// Injectable transport so tests can supply a fake client.
  final http.Client? httpClient;

  @override
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/auth/register');
    final http.Response response;
    try {
      response = await (httpClient?.post ?? http.post)(
        uri,
        headers: const {'content-type': 'application/json'},
        body: jsonEncode({
          'displayName': displayName.trim(),
          'email': email.trim().toLowerCase(),
          'password': password,
        }),
      );
    } on Exception catch (error) {
      throw RegisterException(
        'registration network failure',
        code: RegisterFailureCode.network,
        cause: error,
      );
    }

    final status = response.statusCode;
    if (status >= 200 && status < 300) {
      return;
    }

    throw _exceptionFor(status, _decodeBody(response));
  }

  Map<String, Object?> _decodeBody(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, Object?>) return decoded;
    } on Object {
      // Status code still drives the failure category.
    }
    return const {};
  }

  RegisterException _exceptionFor(int status, Map<String, Object?> body) {
    final error = body['error']?.toString();

    if (status == 409 || error == 'user_exists') {
      return const RegisterException(
        'an account already exists for this email',
        code: RegisterFailureCode.emailAlreadyRegistered,
      );
    }
    if (status == 400 && error == 'validation') {
      final field = body['field']?.toString();
      return RegisterException(
        'registration validation failed ($field)',
        code: switch (field) {
          'email' => RegisterFailureCode.invalidEmail,
          'password' => RegisterFailureCode.invalidPassword,
          'displayName' => RegisterFailureCode.invalidDisplayName,
          _ => RegisterFailureCode.unknown,
        },
      );
    }
    if (status == 404 ||
        status == 503 ||
        error == 'registration_unavailable' ||
        error == 'not_configured') {
      return const RegisterException(
        'self-service registration is not enabled on this server',
        code: RegisterFailureCode.unavailable,
      );
    }
    return RegisterException('registration failed with HTTP $status');
  }
}
