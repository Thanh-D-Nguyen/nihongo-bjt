import 'package:nihongo_bjt/core/api/api_exception.dart';

/// Stable, localizable categories of repository failure.
///
/// Repositories translate low-level [ApiException]s into one of these kinds so
/// the UI can show a localized (JA/VI) message via l10n instead of a baked-in
/// string. This keeps user-facing copy in the ARB files, not in data code.
enum RepositoryErrorKind {
  /// Missing/expired session (HTTP 401/403). The learner must sign in.
  unauthorized,

  /// The requested resource does not exist (HTTP 404).
  notFound,

  /// The server responded with another non-2xx status.
  server,

  /// The request never reached the server (offline, DNS, TLS, timeout).
  network,

  /// The response was 2xx but its shape was unexpected.
  invalidResponse,
}

/// Failure surfaced by feature repositories.
///
/// Carries a [kind] for localized UI messaging and the underlying [cause]
/// (never tokens) for diagnostics. Repositories must not fabricate data on
/// failure — they throw this instead.
class RepositoryException implements Exception {
  const RepositoryException(this.kind, {this.statusCode, this.cause});

  /// Localizable category of the failure.
  final RepositoryErrorKind kind;

  /// HTTP status code when the failure was an HTTP error.
  final int? statusCode;

  /// Originating error for logs.
  final Object? cause;

  /// True when the failure was a connectivity problem (drives the offline UI).
  bool get isOffline => kind == RepositoryErrorKind.network;

  @override
  String toString() {
    final code = statusCode == null ? '' : ', $statusCode';
    return 'RepositoryException(${kind.name}$code)';
  }
}

/// Runs an `ApiClient` call and normalizes failures to [RepositoryException].
///
/// Shared by every feature repository so error mapping is consistent. 401/403 →
/// [RepositoryErrorKind.unauthorized], 404 → notFound, other HTTP → server,
/// transport failure → network.
Future<T> guardApiCall<T>(Future<T> Function() request) async {
  try {
    return await request();
  } on HttpApiException catch (error) {
    final kind = switch (error.statusCode) {
      401 || 403 => RepositoryErrorKind.unauthorized,
      404 => RepositoryErrorKind.notFound,
      _ => RepositoryErrorKind.server,
    };
    throw RepositoryException(kind, statusCode: error.statusCode, cause: error);
  } on NetworkApiException catch (error) {
    throw RepositoryException(RepositoryErrorKind.network, cause: error);
  }
}
