// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recent_search_dao.dart';

// ignore_for_file: type=lint
mixin _$RecentSearchDaoMixin on DatabaseAccessor<AppDatabase> {
  $RecentSearchesTable get recentSearches => attachedDatabase.recentSearches;
  RecentSearchDaoManager get managers => RecentSearchDaoManager(this);
}

class RecentSearchDaoManager {
  final _$RecentSearchDaoMixin _db;
  RecentSearchDaoManager(this._db);
  $$RecentSearchesTableTableManager get recentSearches =>
      $$RecentSearchesTableTableManager(
        _db.attachedDatabase,
        _db.recentSearches,
      );
}
