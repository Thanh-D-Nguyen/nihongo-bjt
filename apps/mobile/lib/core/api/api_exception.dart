/// Failure raised by `ApiClient` when a request cannot be completed.
///
/// Sealed so callers can exhaustively distinguish a transport failure
/// ([NetworkApiException]) from a server-side error response
/// ([HttpApiException]). Messages are diagnostic (for logs), not UI copy.
sealed class ApiException implements Exception {
  const ApiException(this.message);

  /// Non-localized diagnostic message describing the failure.
  final String message;

  @override
  String toString() => 'ApiException: $message';
}

/// The request never produced an HTTP response (offline, DNS, TLS, timeout).
class NetworkApiException extends ApiException {
  const NetworkApiException(super.message);

  @override
  String toString() => 'NetworkApiException: $message';
}

/// The server responded with a non-2xx status code.
class HttpApiException extends ApiException {
  const HttpApiException({
    required this.statusCode,
    required String message,
    this.body,
  }) : super(message);

  /// HTTP status code returned by the server.
  final int statusCode;

  /// Raw response body, when present, for diagnostics.
  final String? body;

  @override
  String toString() => 'HttpApiException($statusCode): $message';
}
