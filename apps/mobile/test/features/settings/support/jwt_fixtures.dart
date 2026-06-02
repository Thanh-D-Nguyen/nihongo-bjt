import 'dart:convert';

/// Builds an unsigned JWT (`header.payload.signature`) whose payload is the
/// base64Url-encoded JSON of [claims]. The signature segment is a placeholder —
/// the app decodes the payload for display only and never verifies it here.
String unsignedJwt(Map<String, Object?> claims) =>
    unsignedJwtRaw(jsonEncode(claims));

/// Like [unsignedJwt] but takes an already-encoded JSON [payloadJson] string,
/// so tests can inject non-object payloads.
String unsignedJwtRaw(String payloadJson) {
  final header = base64Url.encode(utf8.encode('{"alg":"none","typ":"JWT"}'));
  final payload = base64Url.encode(utf8.encode(payloadJson));
  return '$header.$payload.signature';
}
