import 'package:drift/drift.dart';

/// Drift table recording on-device study activity (Phase 02 Progress).
///
/// One row per completed learning event (currently: a graded flashcard
/// review). This is a real, local activity log — the honest source for the
/// Progress screen's counts and streak. It is device-scoped; there is no
/// fabricated cross-device history. When a backend analytics contract exists
/// these events can be forwarded, but nothing here invents data.
@DataClassName('StudyEventRow')
class StudyEvents extends Table {
  /// Local autoincrement id.
  IntColumn get id => integer().autoIncrement()();

  /// Event kind (e.g. `flashcard_review`). Stored as a stable string so new
  /// kinds can be added without a schema change.
  TextColumn get kind => text()();

  /// SRS grade for review events, stored as the enum name
  /// (`again|hard|good|easy`); null for kinds that have no grade.
  TextColumn get rating => text().nullable()();

  /// When the event happened (UTC).
  DateTimeColumn get occurredAt => dateTime()();
}
