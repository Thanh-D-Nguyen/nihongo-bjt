import 'package:drift/drift.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/settings/data/local/user_settings_table.dart';

part 'user_settings_dao.g.dart';

/// Data-access object for the device-scoped [UserSettings] key/value store.
///
/// Pure persistence: typed get/set over string values. Higher layers own the
/// meaning of each key and the encoding of each value.
@DriftAccessor(tables: [UserSettings])
class UserSettingsDao extends DatabaseAccessor<AppDatabase>
    with _$UserSettingsDaoMixin {
  UserSettingsDao(super.attachedDatabase);

  /// Reads all stored settings as a `{key: value}` map (empty when none set).
  Future<Map<String, String>> readAll() async {
    final rows = await select(userSettings).get();
    return {for (final row in rows) row.key: row.value};
  }

  /// Reads a single setting, or `null` when the key was never written.
  Future<String?> read(String key) async {
    final row = await (select(
      userSettings,
    )..where((tbl) => tbl.key.equals(key))).getSingleOrNull();
    return row?.value;
  }

  /// Upserts [key] = [value] (idempotent; last write wins).
  Future<void> write(String key, String value) async {
    await into(userSettings).insertOnConflictUpdate(
      UserSettingsCompanion.insert(key: key, value: value),
    );
  }

  /// Removes [key] if present (no-op when absent).
  Future<void> remove(String key) async {
    await (delete(userSettings)..where((tbl) => tbl.key.equals(key))).go();
  }
}
