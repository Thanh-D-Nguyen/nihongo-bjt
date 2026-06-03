import 'package:flutter/foundation.dart';

/// The three bookmarkable content kinds exposed by `/api/bookmarks/*`. The
/// learner's saved library is organized into one tab per kind.
enum BookmarkKind {
  word,
  kanji,
  grammar;

  /// Path segment for the list endpoint (`/api/bookmarks/<listSegment>`).
  String get listSegment => switch (this) {
    BookmarkKind.word => 'words',
    BookmarkKind.kanji => 'kanji',
    BookmarkKind.grammar => 'grammar',
  };

  /// Type segment for the toggle endpoint (`/api/bookmarks/<toggleType>/:id`).
  String get toggleType => switch (this) {
    BookmarkKind.word => 'word',
    BookmarkKind.kanji => 'kanji',
    BookmarkKind.grammar => 'grammar',
  };
}

/// One saved bookmark row from `/api/bookmarks/*`. Only the target identity and
/// timestamp are returned; the display title is resolved separately from the
/// canonical content detail endpoints.
@immutable
class BookmarkItem {
  const BookmarkItem({
    required this.id,
    required this.targetId,
    required this.targetType,
    this.createdAt,
  });

  final String id;
  final String targetId;
  final String targetType;
  final DateTime? createdAt;
}
