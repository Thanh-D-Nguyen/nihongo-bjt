import 'package:flutter/material.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Localized label for a [LessonLevel].
/// Keeps display strings out of the domain.
String lessonLevelLabel(AppLocalizations l10n, LessonLevel level) {
  switch (level) {
    case LessonLevel.foundational:
      return l10n.levelFoundational;
    case LessonLevel.practical:
      return l10n.levelPractical;
    case LessonLevel.advanced:
      return l10n.levelAdvanced;
  }
}

/// Outlined icon representing a lesson category. Falls back to a generic study
/// icon for unknown categories so a new category never renders blank.
IconData lessonCategoryIcon(String categoryId) {
  switch (categoryId) {
    case 'workplace-comms':
      return Icons.handshake_outlined;
    case 'meetings-email':
      return Icons.forum_outlined;
    default:
      return Icons.menu_book_outlined;
  }
}
