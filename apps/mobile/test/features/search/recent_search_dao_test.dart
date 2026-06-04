import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/search/data/local/recent_search_dao.dart';

void main() {
  late AppDatabase db;
  late RecentSearchDao dao;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = db.recentSearchDao;
  });

  tearDown(() => db.close());

  test('records queries most-recent first', () async {
    await dao.record('会議');
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await dao.record('挨拶');

    expect(await dao.list(), ['挨拶', '会議']);
  });

  test('ignores blank queries', () async {
    await dao.record('   ');
    await dao.record('');
    expect(await dao.list(), isEmpty);
  });

  test('de-duplicates and refreshes timestamp on re-search', () async {
    await dao.record('会議');
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await dao.record('挨拶');
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await dao.record('会議');

    expect(await dao.list(), ['会議', '挨拶']);
  });

  test('trims history to maxEntries', () async {
    for (var i = 0; i < RecentSearchDao.maxEntries + 5; i++) {
      await dao.record('q$i');
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
    final list = await dao.list();
    expect(list, hasLength(RecentSearchDao.maxEntries));
    // The most-recent query survives; the oldest overflow is dropped.
    expect(list.first, 'q${RecentSearchDao.maxEntries + 4}');
    expect(list.contains('q0'), isFalse);
  });

  test('remove deletes a single query; clear wipes all', () async {
    await dao.record('会議');
    await dao.record('挨拶');

    await dao.remove('会議');
    expect(await dao.list(), ['挨拶']);

    await dao.clear();
    expect(await dao.list(), isEmpty);
  });
}
