import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';

/// Defensive parsers for the `/api/bookmarks/*` API surface. Fields are coerced
/// so malformed payloads degrade gracefully instead of throwing.
abstract final class SavedDto {
  static Map<String, dynamic> asMap(Object? value) =>
      value is Map<String, dynamic> ? value : const {};

  static List<Map<String, dynamic>> asMapList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  static String _str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static DateTime? _dateOrNull(Object? value) {
    if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
    return null;
  }

  /// The list endpoint wraps rows in `{ items: [...] }`; tolerate a bare list.
  static List<Map<String, dynamic>> items(Object? json) {
    if (json is Map<String, dynamic>) return asMapList(json['items']);
    return asMapList(json);
  }

  static BookmarkItem item(Map<String, dynamic> json) => BookmarkItem(
    id: _str(json['id']),
    targetId: _str(json['targetId']),
    targetType: _str(json['targetType']),
    createdAt: _dateOrNull(json['createdAt']),
  );

  /// `{ bookmarked: bool, ... }` from the toggle/check endpoints.
  static bool bookmarked(Object? json) {
    final map = asMap(json);
    return map['bookmarked'] == true;
  }
}
