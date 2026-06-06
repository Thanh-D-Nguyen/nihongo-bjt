import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';

/// Row-level outcome of parsing one pasted import line. `null` means the row is
/// valid and ready to become a card.
enum ImportRowError {
  /// The front (term) field was empty after trimming.
  missingFront,

  /// The back (definition) field was empty after trimming.
  missingBack,

  /// The front field exceeded [DeckCardLimits.frontMaxLength].
  frontTooLong,

  /// The back field exceeded [DeckCardLimits.backMaxLength].
  backTooLong,

  /// The reading field exceeded [DeckCardLimits.readingMaxLength].
  readingTooLong,
}

/// One parsed import row: the extracted fields plus any [error]. Invalid rows
/// are kept (never silently dropped) so the learner can fix the source.
class ImportRow {
  const ImportRow({
    required this.front,
    required this.back,
    this.reading,
    this.error,
  });

  final String front;
  final String back;
  final String? reading;
  final ImportRowError? error;

  bool get isValid => error == null;
}

/// Result of parsing a pasted import block: the ordered [rows] (valid and
/// invalid) plus whether the 200-row cap was exceeded.
class DeckCardImportResult {
  const DeckCardImportResult({
    required this.rows,
    this.exceededLimit = false,
  });

  /// Empty result for blank input.
  static const DeckCardImportResult empty = DeckCardImportResult(rows: []);

  /// Parsed rows in source order (kept including invalid ones).
  final List<ImportRow> rows;

  /// True when the input had more than [DeckCardLimits.maxCards] non-blank
  /// rows; [rows] is then truncated to the cap.
  final bool exceededLimit;

  int get validCount => rows.where((r) => r.isValid).length;

  int get errorCount => rows.where((r) => !r.isValid).length;

  bool get hasRows => rows.isNotEmpty;

  /// Valid rows mapped to normalized card inputs, ready for the editor / save.
  List<DeckCardInput> toCardInputs() {
    return rows
        .where((r) => r.isValid)
        .map(
          (r) => DeckCardInput.fromRaw(
            frontText: r.front,
            backText: r.back,
            reading: r.reading ?? '',
          ),
        )
        .toList();
  }
}

/// Term/definition separators tried in order. Tab and pipe match the web
/// importer; comma and a space-padded dash are common flashcard formats.
const List<String> _fieldSeparators = ['\t', '|', ',', ' - '];

/// Pure parser for pasted flashcard import text.
///
/// - Rows are split on newlines, or on `;` when the text has no newline
///   (single-line paste). Blank rows are skipped (not errors).
/// - Each row splits on the first present separator in [_fieldSeparators] into
///   `front`, `back`, and (when [hasReadingColumn]) `reading`. Extra separators
///   are folded back into `back` so definitions containing the separator are
///   not truncated.
/// - Rows are validated against [DeckCardLimits]; invalid rows are kept with an
///   [ImportRowError]. More than [DeckCardLimits.maxCards] non-blank rows sets
///   [DeckCardImportResult.exceededLimit] and truncates to the cap.
DeckCardImportResult parseDeckCardImport(
  String raw, {
  bool hasReadingColumn = false,
}) {
  final text = raw.trim();
  if (text.isEmpty) return DeckCardImportResult.empty;

  final lineSeparator = text.contains('\n') ? '\n' : ';';
  final lines = text
      .split(lineSeparator)
      .map((l) => l.trim())
      .where((l) => l.isNotEmpty)
      .toList();

  final exceeded = lines.length > DeckCardLimits.maxCards;
  final capped = exceeded ? lines.sublist(0, DeckCardLimits.maxCards) : lines;

  final rows = capped.map((line) => _parseRow(line, hasReadingColumn)).toList();
  return DeckCardImportResult(rows: rows, exceededLimit: exceeded);
}

ImportRow _parseRow(String line, bool hasReadingColumn) {
  final separator = _fieldSeparators.firstWhere(
    line.contains,
    orElse: () => '',
  );

  String front;
  String back;
  String? reading;

  if (separator.isEmpty) {
    // No separator: the whole line is the front; back is missing.
    front = line.trim();
    back = '';
  } else {
    final parts = line.split(separator);
    front = parts[0].trim();
    if (hasReadingColumn) {
      back = parts.length > 1 ? parts[1].trim() : '';
      reading = parts.length > 2
          ? parts.sublist(2).join(separator).trim()
          : null;
      if (reading != null && reading.isEmpty) reading = null;
    } else {
      back = parts.length > 1 ? parts.sublist(1).join(separator).trim() : '';
    }
  }

  final error = _validate(front, back, reading);
  return ImportRow(front: front, back: back, reading: reading, error: error);
}

ImportRowError? _validate(String front, String back, String? reading) {
  if (front.isEmpty) return ImportRowError.missingFront;
  if (front.length > DeckCardLimits.frontMaxLength) {
    return ImportRowError.frontTooLong;
  }
  if (back.isEmpty) return ImportRowError.missingBack;
  if (back.length > DeckCardLimits.backMaxLength) {
    return ImportRowError.backTooLong;
  }
  if (reading != null && reading.length > DeckCardLimits.readingMaxLength) {
    return ImportRowError.readingTooLong;
  }
  return null;
}
