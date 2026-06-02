import 'package:drift/drift.dart';

/// Drift table holding device-scoped learner preferences as a small key/value
/// store (Phase 10.2).
///
/// These are presentation preferences (app language override, furigana display)
/// — not account/business data. They persist locally in the existing on-device
/// SQLite database so a relaunch keeps the learner's choices. Cross-device sync
/// is intentionally **not** implemented here: it requires a backend
/// `/me/preferences` contract that does not exist yet, and no fake sync is
/// fabricated.
@DataClassName('UserSettingRow')
class UserSettings extends Table {
  /// Stable preference key (e.g. `locale_override`, `furigana_enabled`).
  TextColumn get key => text()();

  /// Serialized preference value (plain string; callers own encoding).
  TextColumn get value => text()();

  @override
  Set<Column<Object>> get primaryKey => {key};
}
