import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/settings/data/local/user_settings_dao.dart';
import 'package:nihongo_bjt/features/settings/data/user_settings_repository.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/user_settings.dart';

void main() {
  late AppDatabase db;
  late UserSettingsRepository repository;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = UserSettingsRepository(UserSettingsDao(db));
  });

  tearDown(() => db.close());

  test('load returns defaults when nothing is stored', () async {
    expect(await repository.load(), UserSettings.defaults);
  });

  test('saved locale option persists and reloads', () async {
    await repository.saveLocaleOption(AppLocaleOption.japanese);

    final loaded = await repository.load();
    expect(loaded.localeOption, AppLocaleOption.japanese);
    // Furigana keeps its default when only the locale was set.
    expect(loaded.furiganaEnabled, isTrue);
  });

  test('furigana preference persists both true and false', () async {
    await repository.saveFuriganaEnabled(enabled: false);
    expect((await repository.load()).furiganaEnabled, isFalse);

    await repository.saveFuriganaEnabled(enabled: true);
    expect((await repository.load()).furiganaEnabled, isTrue);
  });

  test('writes are last-write-wins (no duplicate rows)', () async {
    await repository.saveLocaleOption(AppLocaleOption.vietnamese);
    await repository.saveLocaleOption(AppLocaleOption.japanese);

    expect((await repository.load()).localeOption, AppLocaleOption.japanese);
  });

  test('a corrupt stored value falls back to its default', () async {
    // Simulate a corrupt row written outside the repository contract.
    await UserSettingsDao(db).write('locale_override', 'klingon');
    await UserSettingsDao(db).write('furigana_enabled', 'maybe');

    final loaded = await repository.load();
    expect(loaded.localeOption, AppLocaleOption.system);
    expect(loaded.furiganaEnabled, isTrue);
  });
}
