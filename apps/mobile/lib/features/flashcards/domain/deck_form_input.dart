import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

/// Field-level validation outcome for a deck create/edit form.
///
/// Mirrors the backend Zod `createDeckSchema`/`updateDeckSchema` so the mobile
/// form rejects the same input the server would reject — no fake client-only
/// rules, no silently-different limits.
enum DeckFieldError {
  /// A required value was empty after trimming.
  required,

  /// The trimmed value exceeded its maximum length.
  tooLong,
}

/// Validated, normalized payload for creating or updating a deck's metadata.
///
/// Construct via [DeckFormInput.fromRaw] which trims values and collapses blank
/// optionals to `null`, matching the server's `z.string().trim()...optional()`
/// behavior. Only build this from input that has passed [DeckFormValidator].
class DeckFormInput {
  const DeckFormInput({
    required this.titleVi,
    required this.visibility,
    this.titleJa,
    this.descriptionVi,
    this.descriptionJa,
  });

  /// Builds a normalized input from raw form text.
  ///
  /// Trims every field and turns blank optionals into `null` so the request
  /// body omits them (the server treats absent and empty the same for
  /// optionals, but `titleJa` has a `min(1)` rule, so blanks must not be sent).
  factory DeckFormInput.fromRaw({
    required String titleVi,
    required String titleJa,
    required String descriptionVi,
    required String descriptionJa,
    required DeckVisibility visibility,
  }) {
    String? optional(String value) {
      final trimmed = value.trim();
      return trimmed.isEmpty ? null : trimmed;
    }

    return DeckFormInput(
      titleVi: titleVi.trim(),
      titleJa: optional(titleJa),
      descriptionVi: optional(descriptionVi),
      descriptionJa: optional(descriptionJa),
      visibility: visibility,
    );
  }

  /// Vietnamese title — required, 1..[DeckFormLimits.titleMaxLength].
  final String titleVi;

  /// Optional Japanese title — when present,
  /// 1..[DeckFormLimits.titleMaxLength].
  final String? titleJa;

  /// Optional Vietnamese description — up to
  /// [DeckFormLimits.descriptionMaxLength].
  final String? descriptionVi;

  /// Optional Japanese description — up to
  /// [DeckFormLimits.descriptionMaxLength].
  final String? descriptionJa;

  /// Whether the deck is private to the learner or publicly shared.
  final DeckVisibility visibility;

  /// JSON request body for the deck create/update endpoints.
  ///
  /// Omits blank optionals and never includes `userId` (the server derives the
  /// learner from the bearer token). `cards` is intentionally absent so a
  /// metadata update never replaces the deck's card set.
  Map<String, Object?> toRequestBody() {
    return <String, Object?>{
      'titleVi': titleVi,
      if (titleJa != null) 'titleJa': titleJa,
      if (descriptionVi != null) 'descriptionVi': descriptionVi,
      if (descriptionJa != null) 'descriptionJa': descriptionJa,
      'visibility': visibility.wire,
    };
  }
}

/// Length limits shared by the deck form and its validator, mirroring the
/// backend schema exactly.
abstract final class DeckFormLimits {
  /// Max length of either title (server: `max(120)`).
  static const int titleMaxLength = 120;

  /// Max length of either description (server: `max(500)`).
  static const int descriptionMaxLength = 500;
}

/// Per-field validation errors for a deck form. All `null` means valid.
class DeckFormErrors {
  const DeckFormErrors({
    this.titleVi,
    this.titleJa,
    this.descriptionVi,
    this.descriptionJa,
  });

  final DeckFieldError? titleVi;
  final DeckFieldError? titleJa;
  final DeckFieldError? descriptionVi;
  final DeckFieldError? descriptionJa;

  /// Whether the form passed every field rule.
  bool get isValid =>
      titleVi == null &&
      titleJa == null &&
      descriptionVi == null &&
      descriptionJa == null;
}

/// Pure validator mirroring the backend deck schema.
abstract final class DeckFormValidator {
  /// Validates raw form text against the server's rules.
  static DeckFormErrors validate({
    required String titleVi,
    required String titleJa,
    required String descriptionVi,
    required String descriptionJa,
  }) {
    return DeckFormErrors(
      titleVi: _requiredTitle(titleVi),
      titleJa: _optionalTitle(titleJa),
      descriptionVi: _optionalDescription(descriptionVi),
      descriptionJa: _optionalDescription(descriptionJa),
    );
  }

  static DeckFieldError? _requiredTitle(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return DeckFieldError.required;
    if (trimmed.length > DeckFormLimits.titleMaxLength) {
      return DeckFieldError.tooLong;
    }
    return null;
  }

  static DeckFieldError? _optionalTitle(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.length > DeckFormLimits.titleMaxLength) {
      return DeckFieldError.tooLong;
    }
    return null;
  }

  static DeckFieldError? _optionalDescription(String value) {
    final trimmed = value.trim();
    if (trimmed.length > DeckFormLimits.descriptionMaxLength) {
      return DeckFieldError.tooLong;
    }
    return null;
  }
}
