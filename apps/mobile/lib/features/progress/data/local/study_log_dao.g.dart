// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'study_log_dao.dart';

// ignore_for_file: type=lint
mixin _$StudyLogDaoMixin on DatabaseAccessor<AppDatabase> {
  $StudyEventsTable get studyEvents => attachedDatabase.studyEvents;
  StudyLogDaoManager get managers => StudyLogDaoManager(this);
}

class StudyLogDaoManager {
  final _$StudyLogDaoMixin _db;
  StudyLogDaoManager(this._db);
  $$StudyEventsTableTableManager get studyEvents =>
      $$StudyEventsTableTableManager(_db.attachedDatabase, _db.studyEvents);
}
