/// Helpers for building API query strings safely.
///
/// Centralizes encoding so feature repositories never hand-concatenate query
/// parameters (which risks unescaped user input in the URL). Null/empty values
/// are dropped; everything is percent-encoded by [Uri].
library;

/// Builds a `?a=b&c=d` suffix from [params], skipping null/empty values.
///
/// Returns an empty string when no parameters survive, so callers can append
/// the result unconditionally: `'/api/kanji${buildQuery({'q': q})}'`.
String buildQuery(Map<String, Object?> params) {
  final entries = <MapEntry<String, String>>[];
  params.forEach((key, value) {
    if (value == null) return;
    final text = value.toString();
    if (text.isEmpty) return;
    entries.add(MapEntry(key, text));
  });
  if (entries.isEmpty) return '';
  final query = entries
      .map((e) {
        final k = Uri.encodeQueryComponent(e.key);
        final v = Uri.encodeQueryComponent(e.value);
        return '$k=$v';
      })
      .join('&');
  return '?$query';
}

/// A simple limit/offset pagination cursor matching the backend
/// `paginationQuerySchema` (`limit`, `offset`). Immutable; advance with [next].
class PageCursor {
  const PageCursor({this.limit = 20, this.offset = 0});

  /// Page size. The content APIs cap this at 20–50 depending on endpoint.
  final int limit;

  /// Number of records to skip.
  final int offset;

  /// The cursor for the following page (offset advanced by [limit]).
  PageCursor next() => PageCursor(limit: limit, offset: offset + limit);

  /// Query params for this cursor, merged with optional extra [params].
  Map<String, Object?> toQuery([Map<String, Object?> params = const {}]) => {
    ...params,
    'limit': limit,
    'offset': offset,
  };
}
