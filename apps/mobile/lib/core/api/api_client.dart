import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/api/api_exception.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';

/// Thin HTTP client for the KotobaWorks API.
///
/// Owns base-URL resolution, JSON decoding, and error normalization so feature
/// repositories depend on a small, testable surface instead of `package:http`
/// directly. Authentication is optional: when [accessTokenProvider] is supplied
/// and returns a non-null token, a `Bearer` header is attached per request.
class ApiClient {
  ApiClient({
    required this.environment,
    required this.httpClient,
    this.accessTokenProvider,
    this.requestTimeout = const Duration(seconds: 15),
  });

  /// Resolved environment configuration (base URL, etc.).
  final AppEnvironment environment;

  /// Underlying HTTP transport; injectable so tests can supply a fake.
  final http.Client httpClient;

  /// Optional source of the current access token. Returning `null` sends an
  /// unauthenticated request; omitting the callback keeps the client
  /// auth-agnostic (backward compatible).
  final Future<String?> Function()? accessTokenProvider;

  /// Maximum time one API request may spend preparing headers and waiting for
  /// the transport. Prevents Riverpod loaders from staying pending forever when
  /// auth refresh or the network stalls.
  final Duration requestTimeout;

  /// Performs a GET request and returns the decoded JSON body.
  ///
  /// [path] is appended to [AppEnvironment.apiBaseUrl] and must start with `/`.
  /// Returns `null` for an empty response body. Throws [HttpApiException] on a
  /// non-2xx response and [NetworkApiException] when the request fails before a
  /// response is received.
  Future<Object?> getJson(String path) async {
    final uri = Uri.parse('${environment.apiBaseUrl}$path');

    final http.Response response;
    try {
      response = await _withTimeout(
        () async => httpClient.get(uri, headers: await _headers()),
        method: 'GET',
        uri: uri,
      );
    } on Exception catch (error) {
      throw NetworkApiException('GET $uri failed: $error');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HttpApiException(
        statusCode: response.statusCode,
        message: 'GET $uri returned ${response.statusCode}',
        body: response.body.isEmpty ? null : response.body,
      );
    }

    if (response.body.isEmpty) {
      return null;
    }
    return jsonDecode(response.body);
  }

  /// Performs a POST request with an optional JSON [body] and returns the
  /// decoded JSON response.
  ///
  /// [path] is appended to [AppEnvironment.apiBaseUrl] and must start with `/`.
  /// Returns `null` for an empty response body. Throws [HttpApiException] on a
  /// non-2xx response and [NetworkApiException] when the request fails before a
  /// response is received.
  Future<Object?> postJson(String path, {Object? body}) async {
    final uri = Uri.parse('${environment.apiBaseUrl}$path');

    final http.Response response;
    try {
      response = await _withTimeout(
        () async => httpClient.post(
          uri,
          headers: await _headers(withJsonContentType: true),
          body: body == null ? null : jsonEncode(body),
        ),
        method: 'POST',
        uri: uri,
      );
    } on Exception catch (error) {
      throw NetworkApiException('POST $uri failed: $error');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HttpApiException(
        statusCode: response.statusCode,
        message: 'POST $uri returned ${response.statusCode}',
        body: response.body.isEmpty ? null : response.body,
      );
    }

    if (response.body.isEmpty) {
      return null;
    }
    return jsonDecode(response.body);
  }

  /// Performs a PATCH request with an optional JSON [body] and returns the
  /// decoded JSON response.
  ///
  /// [path] is appended to [AppEnvironment.apiBaseUrl] and must start with `/`.
  /// Returns `null` for an empty response body. Throws [HttpApiException] on a
  /// non-2xx response and [NetworkApiException] when the request fails before a
  /// response is received.
  Future<Object?> patchJson(String path, {Object? body}) async {
    final uri = Uri.parse('${environment.apiBaseUrl}$path');

    final http.Response response;
    try {
      response = await _withTimeout(
        () async => httpClient.patch(
          uri,
          headers: await _headers(withJsonContentType: true),
          body: body == null ? null : jsonEncode(body),
        ),
        method: 'PATCH',
        uri: uri,
      );
    } on Exception catch (error) {
      throw NetworkApiException('PATCH $uri failed: $error');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HttpApiException(
        statusCode: response.statusCode,
        message: 'PATCH $uri returned ${response.statusCode}',
        body: response.body.isEmpty ? null : response.body,
      );
    }

    if (response.body.isEmpty) {
      return null;
    }
    return jsonDecode(response.body);
  }

  Future<http.Response> _withTimeout(
    Future<http.Response> Function() request, {
    required String method,
    required Uri uri,
  }) {
    return request().timeout(
      requestTimeout,
      onTimeout: () {
        throw NetworkApiException(
          '$method $uri timed out after ${requestTimeout.inSeconds}s',
        );
      },
    );
  }

  /// Builds request headers, attaching a bearer token when one is available.
  ///
  /// Sets a JSON `content-type` only when [withJsonContentType] is true (i.e.
  /// for requests that carry a body).
  Future<Map<String, String>> _headers({
    bool withJsonContentType = false,
  }) async {
    final headers = <String, String>{'accept': 'application/json'};
    if (withJsonContentType) {
      headers['content-type'] = 'application/json; charset=utf-8';
    }
    final token = await accessTokenProvider?.call();
    if (token != null) {
      headers['authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// Releases the underlying HTTP resources.
  void close() => httpClient.close();
}
