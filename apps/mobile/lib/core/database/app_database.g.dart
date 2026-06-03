// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $FlashcardDecksTable extends FlashcardDecks
    with TableInfo<$FlashcardDecksTable, FlashcardDeckRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FlashcardDecksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cardCountMeta = const VerificationMeta(
    'cardCount',
  );
  @override
  late final GeneratedColumn<int> cardCount = GeneratedColumn<int>(
    'card_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    title,
    description,
    cardCount,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'flashcard_decks';
  @override
  VerificationContext validateIntegrity(
    Insertable<FlashcardDeckRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_descriptionMeta);
    }
    if (data.containsKey('card_count')) {
      context.handle(
        _cardCountMeta,
        cardCount.isAcceptableOrUnknown(data['card_count']!, _cardCountMeta),
      );
    } else if (isInserting) {
      context.missing(_cardCountMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  FlashcardDeckRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FlashcardDeckRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      )!,
      cardCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}card_count'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $FlashcardDecksTable createAlias(String alias) {
    return $FlashcardDecksTable(attachedDatabase, alias);
  }
}

class FlashcardDeckRow extends DataClass
    implements Insertable<FlashcardDeckRow> {
  /// Server deck id (primary key).
  final String id;

  /// Display title (Japanese-first, already resolved by the mapper).
  final String title;

  /// Vietnamese description; empty string when the deck has none.
  final String description;

  /// Number of cards in the deck.
  final int cardCount;

  /// When this row was last written to the cache (UTC).
  final DateTime cachedAt;
  const FlashcardDeckRow({
    required this.id,
    required this.title,
    required this.description,
    required this.cardCount,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title'] = Variable<String>(title);
    map['description'] = Variable<String>(description);
    map['card_count'] = Variable<int>(cardCount);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  FlashcardDecksCompanion toCompanion(bool nullToAbsent) {
    return FlashcardDecksCompanion(
      id: Value(id),
      title: Value(title),
      description: Value(description),
      cardCount: Value(cardCount),
      cachedAt: Value(cachedAt),
    );
  }

  factory FlashcardDeckRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FlashcardDeckRow(
      id: serializer.fromJson<String>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      description: serializer.fromJson<String>(json['description']),
      cardCount: serializer.fromJson<int>(json['cardCount']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'title': serializer.toJson<String>(title),
      'description': serializer.toJson<String>(description),
      'cardCount': serializer.toJson<int>(cardCount),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  FlashcardDeckRow copyWith({
    String? id,
    String? title,
    String? description,
    int? cardCount,
    DateTime? cachedAt,
  }) => FlashcardDeckRow(
    id: id ?? this.id,
    title: title ?? this.title,
    description: description ?? this.description,
    cardCount: cardCount ?? this.cardCount,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  FlashcardDeckRow copyWithCompanion(FlashcardDecksCompanion data) {
    return FlashcardDeckRow(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      description: data.description.present
          ? data.description.value
          : this.description,
      cardCount: data.cardCount.present ? data.cardCount.value : this.cardCount,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardDeckRow(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('cardCount: $cardCount, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, title, description, cardCount, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FlashcardDeckRow &&
          other.id == this.id &&
          other.title == this.title &&
          other.description == this.description &&
          other.cardCount == this.cardCount &&
          other.cachedAt == this.cachedAt);
}

class FlashcardDecksCompanion extends UpdateCompanion<FlashcardDeckRow> {
  final Value<String> id;
  final Value<String> title;
  final Value<String> description;
  final Value<int> cardCount;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const FlashcardDecksCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.description = const Value.absent(),
    this.cardCount = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FlashcardDecksCompanion.insert({
    required String id,
    required String title,
    required String description,
    required int cardCount,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       title = Value(title),
       description = Value(description),
       cardCount = Value(cardCount),
       cachedAt = Value(cachedAt);
  static Insertable<FlashcardDeckRow> custom({
    Expression<String>? id,
    Expression<String>? title,
    Expression<String>? description,
    Expression<int>? cardCount,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (cardCount != null) 'card_count': cardCount,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FlashcardDecksCompanion copyWith({
    Value<String>? id,
    Value<String>? title,
    Value<String>? description,
    Value<int>? cardCount,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return FlashcardDecksCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      cardCount: cardCount ?? this.cardCount,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (cardCount.present) {
      map['card_count'] = Variable<int>(cardCount.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardDecksCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('cardCount: $cardCount, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FlashcardReviewCardsTable extends FlashcardReviewCards
    with TableInfo<$FlashcardReviewCardsTable, FlashcardReviewCardRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FlashcardReviewCardsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _deckIdMeta = const VerificationMeta('deckId');
  @override
  late final GeneratedColumn<String> deckId = GeneratedColumn<String>(
    'deck_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userFlashcardIdMeta = const VerificationMeta(
    'userFlashcardId',
  );
  @override
  late final GeneratedColumn<String> userFlashcardId = GeneratedColumn<String>(
    'user_flashcard_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cardIdMeta = const VerificationMeta('cardId');
  @override
  late final GeneratedColumn<String> cardId = GeneratedColumn<String>(
    'card_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _frontMeta = const VerificationMeta('front');
  @override
  late final GeneratedColumn<String> front = GeneratedColumn<String>(
    'front',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _readingMeta = const VerificationMeta(
    'reading',
  );
  @override
  late final GeneratedColumn<String> reading = GeneratedColumn<String>(
    'reading',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _backMeta = const VerificationMeta('back');
  @override
  late final GeneratedColumn<String> back = GeneratedColumn<String>(
    'back',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    deckId,
    userFlashcardId,
    cardId,
    front,
    reading,
    back,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'flashcard_review_cards';
  @override
  VerificationContext validateIntegrity(
    Insertable<FlashcardReviewCardRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('deck_id')) {
      context.handle(
        _deckIdMeta,
        deckId.isAcceptableOrUnknown(data['deck_id']!, _deckIdMeta),
      );
    } else if (isInserting) {
      context.missing(_deckIdMeta);
    }
    if (data.containsKey('user_flashcard_id')) {
      context.handle(
        _userFlashcardIdMeta,
        userFlashcardId.isAcceptableOrUnknown(
          data['user_flashcard_id']!,
          _userFlashcardIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_userFlashcardIdMeta);
    }
    if (data.containsKey('card_id')) {
      context.handle(
        _cardIdMeta,
        cardId.isAcceptableOrUnknown(data['card_id']!, _cardIdMeta),
      );
    } else if (isInserting) {
      context.missing(_cardIdMeta);
    }
    if (data.containsKey('front')) {
      context.handle(
        _frontMeta,
        front.isAcceptableOrUnknown(data['front']!, _frontMeta),
      );
    } else if (isInserting) {
      context.missing(_frontMeta);
    }
    if (data.containsKey('reading')) {
      context.handle(
        _readingMeta,
        reading.isAcceptableOrUnknown(data['reading']!, _readingMeta),
      );
    } else if (isInserting) {
      context.missing(_readingMeta);
    }
    if (data.containsKey('back')) {
      context.handle(
        _backMeta,
        back.isAcceptableOrUnknown(data['back']!, _backMeta),
      );
    } else if (isInserting) {
      context.missing(_backMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {deckId, userFlashcardId};
  @override
  FlashcardReviewCardRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FlashcardReviewCardRow(
      deckId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}deck_id'],
      )!,
      userFlashcardId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_flashcard_id'],
      )!,
      cardId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}card_id'],
      )!,
      front: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}front'],
      )!,
      reading: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}reading'],
      )!,
      back: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}back'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $FlashcardReviewCardsTable createAlias(String alias) {
    return $FlashcardReviewCardsTable(attachedDatabase, alias);
  }
}

class FlashcardReviewCardRow extends DataClass
    implements Insertable<FlashcardReviewCardRow> {
  /// Deck id this snapshot was fetched for.
  final String deckId;

  /// Per-learner review row id (`userFlashcard.id`), used to submit grades.
  final String userFlashcardId;

  /// Underlying card id (stable display identity).
  final String cardId;

  /// Japanese prompt shown first.
  final String front;

  /// Kana reading; empty string when unavailable.
  final String reading;

  /// Vietnamese meaning, revealed after answering.
  final String back;

  /// When this row was last written to the cache (UTC).
  final DateTime cachedAt;
  const FlashcardReviewCardRow({
    required this.deckId,
    required this.userFlashcardId,
    required this.cardId,
    required this.front,
    required this.reading,
    required this.back,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['deck_id'] = Variable<String>(deckId);
    map['user_flashcard_id'] = Variable<String>(userFlashcardId);
    map['card_id'] = Variable<String>(cardId);
    map['front'] = Variable<String>(front);
    map['reading'] = Variable<String>(reading);
    map['back'] = Variable<String>(back);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  FlashcardReviewCardsCompanion toCompanion(bool nullToAbsent) {
    return FlashcardReviewCardsCompanion(
      deckId: Value(deckId),
      userFlashcardId: Value(userFlashcardId),
      cardId: Value(cardId),
      front: Value(front),
      reading: Value(reading),
      back: Value(back),
      cachedAt: Value(cachedAt),
    );
  }

  factory FlashcardReviewCardRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FlashcardReviewCardRow(
      deckId: serializer.fromJson<String>(json['deckId']),
      userFlashcardId: serializer.fromJson<String>(json['userFlashcardId']),
      cardId: serializer.fromJson<String>(json['cardId']),
      front: serializer.fromJson<String>(json['front']),
      reading: serializer.fromJson<String>(json['reading']),
      back: serializer.fromJson<String>(json['back']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'deckId': serializer.toJson<String>(deckId),
      'userFlashcardId': serializer.toJson<String>(userFlashcardId),
      'cardId': serializer.toJson<String>(cardId),
      'front': serializer.toJson<String>(front),
      'reading': serializer.toJson<String>(reading),
      'back': serializer.toJson<String>(back),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  FlashcardReviewCardRow copyWith({
    String? deckId,
    String? userFlashcardId,
    String? cardId,
    String? front,
    String? reading,
    String? back,
    DateTime? cachedAt,
  }) => FlashcardReviewCardRow(
    deckId: deckId ?? this.deckId,
    userFlashcardId: userFlashcardId ?? this.userFlashcardId,
    cardId: cardId ?? this.cardId,
    front: front ?? this.front,
    reading: reading ?? this.reading,
    back: back ?? this.back,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  FlashcardReviewCardRow copyWithCompanion(FlashcardReviewCardsCompanion data) {
    return FlashcardReviewCardRow(
      deckId: data.deckId.present ? data.deckId.value : this.deckId,
      userFlashcardId: data.userFlashcardId.present
          ? data.userFlashcardId.value
          : this.userFlashcardId,
      cardId: data.cardId.present ? data.cardId.value : this.cardId,
      front: data.front.present ? data.front.value : this.front,
      reading: data.reading.present ? data.reading.value : this.reading,
      back: data.back.present ? data.back.value : this.back,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardReviewCardRow(')
          ..write('deckId: $deckId, ')
          ..write('userFlashcardId: $userFlashcardId, ')
          ..write('cardId: $cardId, ')
          ..write('front: $front, ')
          ..write('reading: $reading, ')
          ..write('back: $back, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    deckId,
    userFlashcardId,
    cardId,
    front,
    reading,
    back,
    cachedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FlashcardReviewCardRow &&
          other.deckId == this.deckId &&
          other.userFlashcardId == this.userFlashcardId &&
          other.cardId == this.cardId &&
          other.front == this.front &&
          other.reading == this.reading &&
          other.back == this.back &&
          other.cachedAt == this.cachedAt);
}

class FlashcardReviewCardsCompanion
    extends UpdateCompanion<FlashcardReviewCardRow> {
  final Value<String> deckId;
  final Value<String> userFlashcardId;
  final Value<String> cardId;
  final Value<String> front;
  final Value<String> reading;
  final Value<String> back;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const FlashcardReviewCardsCompanion({
    this.deckId = const Value.absent(),
    this.userFlashcardId = const Value.absent(),
    this.cardId = const Value.absent(),
    this.front = const Value.absent(),
    this.reading = const Value.absent(),
    this.back = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FlashcardReviewCardsCompanion.insert({
    required String deckId,
    required String userFlashcardId,
    required String cardId,
    required String front,
    required String reading,
    required String back,
    required DateTime cachedAt,
    this.rowid = const Value.absent(),
  }) : deckId = Value(deckId),
       userFlashcardId = Value(userFlashcardId),
       cardId = Value(cardId),
       front = Value(front),
       reading = Value(reading),
       back = Value(back),
       cachedAt = Value(cachedAt);
  static Insertable<FlashcardReviewCardRow> custom({
    Expression<String>? deckId,
    Expression<String>? userFlashcardId,
    Expression<String>? cardId,
    Expression<String>? front,
    Expression<String>? reading,
    Expression<String>? back,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (deckId != null) 'deck_id': deckId,
      if (userFlashcardId != null) 'user_flashcard_id': userFlashcardId,
      if (cardId != null) 'card_id': cardId,
      if (front != null) 'front': front,
      if (reading != null) 'reading': reading,
      if (back != null) 'back': back,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FlashcardReviewCardsCompanion copyWith({
    Value<String>? deckId,
    Value<String>? userFlashcardId,
    Value<String>? cardId,
    Value<String>? front,
    Value<String>? reading,
    Value<String>? back,
    Value<DateTime>? cachedAt,
    Value<int>? rowid,
  }) {
    return FlashcardReviewCardsCompanion(
      deckId: deckId ?? this.deckId,
      userFlashcardId: userFlashcardId ?? this.userFlashcardId,
      cardId: cardId ?? this.cardId,
      front: front ?? this.front,
      reading: reading ?? this.reading,
      back: back ?? this.back,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (deckId.present) {
      map['deck_id'] = Variable<String>(deckId.value);
    }
    if (userFlashcardId.present) {
      map['user_flashcard_id'] = Variable<String>(userFlashcardId.value);
    }
    if (cardId.present) {
      map['card_id'] = Variable<String>(cardId.value);
    }
    if (front.present) {
      map['front'] = Variable<String>(front.value);
    }
    if (reading.present) {
      map['reading'] = Variable<String>(reading.value);
    }
    if (back.present) {
      map['back'] = Variable<String>(back.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardReviewCardsCompanion(')
          ..write('deckId: $deckId, ')
          ..write('userFlashcardId: $userFlashcardId, ')
          ..write('cardId: $cardId, ')
          ..write('front: $front, ')
          ..write('reading: $reading, ')
          ..write('back: $back, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FlashcardReviewQueueTable extends FlashcardReviewQueue
    with TableInfo<$FlashcardReviewQueueTable, FlashcardReviewQueueRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FlashcardReviewQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _userFlashcardIdMeta = const VerificationMeta(
    'userFlashcardId',
  );
  @override
  late final GeneratedColumn<String> userFlashcardId = GeneratedColumn<String>(
    'user_flashcard_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<String> rating = GeneratedColumn<String>(
    'rating',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _answeredAtMeta = const VerificationMeta(
    'answeredAt',
  );
  @override
  late final GeneratedColumn<DateTime> answeredAt = GeneratedColumn<DateTime>(
    'answered_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idempotencyKeyMeta = const VerificationMeta(
    'idempotencyKey',
  );
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
    'idempotency_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptCountMeta = const VerificationMeta(
    'attemptCount',
  );
  @override
  late final GeneratedColumn<int> attemptCount = GeneratedColumn<int>(
    'attempt_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    userFlashcardId,
    rating,
    answeredAt,
    idempotencyKey,
    status,
    attemptCount,
    lastError,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'flashcard_review_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<FlashcardReviewQueueRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('user_flashcard_id')) {
      context.handle(
        _userFlashcardIdMeta,
        userFlashcardId.isAcceptableOrUnknown(
          data['user_flashcard_id']!,
          _userFlashcardIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_userFlashcardIdMeta);
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    } else if (isInserting) {
      context.missing(_ratingMeta);
    }
    if (data.containsKey('answered_at')) {
      context.handle(
        _answeredAtMeta,
        answeredAt.isAcceptableOrUnknown(data['answered_at']!, _answeredAtMeta),
      );
    } else if (isInserting) {
      context.missing(_answeredAtMeta);
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
        _idempotencyKeyMeta,
        idempotencyKey.isAcceptableOrUnknown(
          data['idempotency_key']!,
          _idempotencyKeyMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_idempotencyKeyMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempt_count')) {
      context.handle(
        _attemptCountMeta,
        attemptCount.isAcceptableOrUnknown(
          data['attempt_count']!,
          _attemptCountMeta,
        ),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  FlashcardReviewQueueRow map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FlashcardReviewQueueRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      userFlashcardId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_flashcard_id'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}rating'],
      )!,
      answeredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}answered_at'],
      )!,
      idempotencyKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}idempotency_key'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attemptCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempt_count'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $FlashcardReviewQueueTable createAlias(String alias) {
    return $FlashcardReviewQueueTable(attachedDatabase, alias);
  }
}

class FlashcardReviewQueueRow extends DataClass
    implements Insertable<FlashcardReviewQueueRow> {
  /// Local autoincrement id.
  final int id;

  /// Per-learner review row id (`userFlashcard.id`) the grade applies to.
  final String userFlashcardId;

  /// SRS grade, stored as the enum name (`again|hard|good|easy`).
  final String rating;

  /// When the learner graded the card (UTC).
  final DateTime answeredAt;

  /// Locally generated idempotency key; unique to prevent duplicate enqueues.
  final String idempotencyKey;

  /// `pending` (needs sync) or `synced`.
  final String status;

  /// Number of failed sync attempts (incremented by `markFailed`).
  final int attemptCount;

  /// Last sync error message; null until a sync attempt fails.
  final String? lastError;

  /// When this row was first enqueued (UTC).
  final DateTime createdAt;

  /// When this row was last updated (UTC).
  final DateTime updatedAt;
  const FlashcardReviewQueueRow({
    required this.id,
    required this.userFlashcardId,
    required this.rating,
    required this.answeredAt,
    required this.idempotencyKey,
    required this.status,
    required this.attemptCount,
    this.lastError,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['user_flashcard_id'] = Variable<String>(userFlashcardId);
    map['rating'] = Variable<String>(rating);
    map['answered_at'] = Variable<DateTime>(answeredAt);
    map['idempotency_key'] = Variable<String>(idempotencyKey);
    map['status'] = Variable<String>(status);
    map['attempt_count'] = Variable<int>(attemptCount);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  FlashcardReviewQueueCompanion toCompanion(bool nullToAbsent) {
    return FlashcardReviewQueueCompanion(
      id: Value(id),
      userFlashcardId: Value(userFlashcardId),
      rating: Value(rating),
      answeredAt: Value(answeredAt),
      idempotencyKey: Value(idempotencyKey),
      status: Value(status),
      attemptCount: Value(attemptCount),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory FlashcardReviewQueueRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FlashcardReviewQueueRow(
      id: serializer.fromJson<int>(json['id']),
      userFlashcardId: serializer.fromJson<String>(json['userFlashcardId']),
      rating: serializer.fromJson<String>(json['rating']),
      answeredAt: serializer.fromJson<DateTime>(json['answeredAt']),
      idempotencyKey: serializer.fromJson<String>(json['idempotencyKey']),
      status: serializer.fromJson<String>(json['status']),
      attemptCount: serializer.fromJson<int>(json['attemptCount']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'userFlashcardId': serializer.toJson<String>(userFlashcardId),
      'rating': serializer.toJson<String>(rating),
      'answeredAt': serializer.toJson<DateTime>(answeredAt),
      'idempotencyKey': serializer.toJson<String>(idempotencyKey),
      'status': serializer.toJson<String>(status),
      'attemptCount': serializer.toJson<int>(attemptCount),
      'lastError': serializer.toJson<String?>(lastError),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  FlashcardReviewQueueRow copyWith({
    int? id,
    String? userFlashcardId,
    String? rating,
    DateTime? answeredAt,
    String? idempotencyKey,
    String? status,
    int? attemptCount,
    Value<String?> lastError = const Value.absent(),
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => FlashcardReviewQueueRow(
    id: id ?? this.id,
    userFlashcardId: userFlashcardId ?? this.userFlashcardId,
    rating: rating ?? this.rating,
    answeredAt: answeredAt ?? this.answeredAt,
    idempotencyKey: idempotencyKey ?? this.idempotencyKey,
    status: status ?? this.status,
    attemptCount: attemptCount ?? this.attemptCount,
    lastError: lastError.present ? lastError.value : this.lastError,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  FlashcardReviewQueueRow copyWithCompanion(
    FlashcardReviewQueueCompanion data,
  ) {
    return FlashcardReviewQueueRow(
      id: data.id.present ? data.id.value : this.id,
      userFlashcardId: data.userFlashcardId.present
          ? data.userFlashcardId.value
          : this.userFlashcardId,
      rating: data.rating.present ? data.rating.value : this.rating,
      answeredAt: data.answeredAt.present
          ? data.answeredAt.value
          : this.answeredAt,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      status: data.status.present ? data.status.value : this.status,
      attemptCount: data.attemptCount.present
          ? data.attemptCount.value
          : this.attemptCount,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardReviewQueueRow(')
          ..write('id: $id, ')
          ..write('userFlashcardId: $userFlashcardId, ')
          ..write('rating: $rating, ')
          ..write('answeredAt: $answeredAt, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('status: $status, ')
          ..write('attemptCount: $attemptCount, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    userFlashcardId,
    rating,
    answeredAt,
    idempotencyKey,
    status,
    attemptCount,
    lastError,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FlashcardReviewQueueRow &&
          other.id == this.id &&
          other.userFlashcardId == this.userFlashcardId &&
          other.rating == this.rating &&
          other.answeredAt == this.answeredAt &&
          other.idempotencyKey == this.idempotencyKey &&
          other.status == this.status &&
          other.attemptCount == this.attemptCount &&
          other.lastError == this.lastError &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class FlashcardReviewQueueCompanion
    extends UpdateCompanion<FlashcardReviewQueueRow> {
  final Value<int> id;
  final Value<String> userFlashcardId;
  final Value<String> rating;
  final Value<DateTime> answeredAt;
  final Value<String> idempotencyKey;
  final Value<String> status;
  final Value<int> attemptCount;
  final Value<String?> lastError;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  const FlashcardReviewQueueCompanion({
    this.id = const Value.absent(),
    this.userFlashcardId = const Value.absent(),
    this.rating = const Value.absent(),
    this.answeredAt = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.status = const Value.absent(),
    this.attemptCount = const Value.absent(),
    this.lastError = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
  });
  FlashcardReviewQueueCompanion.insert({
    this.id = const Value.absent(),
    required String userFlashcardId,
    required String rating,
    required DateTime answeredAt,
    required String idempotencyKey,
    this.status = const Value.absent(),
    this.attemptCount = const Value.absent(),
    this.lastError = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
  }) : userFlashcardId = Value(userFlashcardId),
       rating = Value(rating),
       answeredAt = Value(answeredAt),
       idempotencyKey = Value(idempotencyKey),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<FlashcardReviewQueueRow> custom({
    Expression<int>? id,
    Expression<String>? userFlashcardId,
    Expression<String>? rating,
    Expression<DateTime>? answeredAt,
    Expression<String>? idempotencyKey,
    Expression<String>? status,
    Expression<int>? attemptCount,
    Expression<String>? lastError,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (userFlashcardId != null) 'user_flashcard_id': userFlashcardId,
      if (rating != null) 'rating': rating,
      if (answeredAt != null) 'answered_at': answeredAt,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (status != null) 'status': status,
      if (attemptCount != null) 'attempt_count': attemptCount,
      if (lastError != null) 'last_error': lastError,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
    });
  }

  FlashcardReviewQueueCompanion copyWith({
    Value<int>? id,
    Value<String>? userFlashcardId,
    Value<String>? rating,
    Value<DateTime>? answeredAt,
    Value<String>? idempotencyKey,
    Value<String>? status,
    Value<int>? attemptCount,
    Value<String?>? lastError,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
  }) {
    return FlashcardReviewQueueCompanion(
      id: id ?? this.id,
      userFlashcardId: userFlashcardId ?? this.userFlashcardId,
      rating: rating ?? this.rating,
      answeredAt: answeredAt ?? this.answeredAt,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      status: status ?? this.status,
      attemptCount: attemptCount ?? this.attemptCount,
      lastError: lastError ?? this.lastError,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (userFlashcardId.present) {
      map['user_flashcard_id'] = Variable<String>(userFlashcardId.value);
    }
    if (rating.present) {
      map['rating'] = Variable<String>(rating.value);
    }
    if (answeredAt.present) {
      map['answered_at'] = Variable<DateTime>(answeredAt.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attemptCount.present) {
      map['attempt_count'] = Variable<int>(attemptCount.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FlashcardReviewQueueCompanion(')
          ..write('id: $id, ')
          ..write('userFlashcardId: $userFlashcardId, ')
          ..write('rating: $rating, ')
          ..write('answeredAt: $answeredAt, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('status: $status, ')
          ..write('attemptCount: $attemptCount, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }
}

class $UserSettingsTable extends UserSettings
    with TableInfo<$UserSettingsTable, UserSettingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $UserSettingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'user_settings';
  @override
  VerificationContext validateIntegrity(
    Insertable<UserSettingRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  UserSettingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return UserSettingRow(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $UserSettingsTable createAlias(String alias) {
    return $UserSettingsTable(attachedDatabase, alias);
  }
}

class UserSettingRow extends DataClass implements Insertable<UserSettingRow> {
  /// Stable preference key (e.g. `locale_override`, `furigana_enabled`).
  final String key;

  /// Serialized preference value (plain string; callers own encoding).
  final String value;
  const UserSettingRow({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  UserSettingsCompanion toCompanion(bool nullToAbsent) {
    return UserSettingsCompanion(key: Value(key), value: Value(value));
  }

  factory UserSettingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return UserSettingRow(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  UserSettingRow copyWith({String? key, String? value}) =>
      UserSettingRow(key: key ?? this.key, value: value ?? this.value);
  UserSettingRow copyWithCompanion(UserSettingsCompanion data) {
    return UserSettingRow(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('UserSettingRow(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is UserSettingRow &&
          other.key == this.key &&
          other.value == this.value);
}

class UserSettingsCompanion extends UpdateCompanion<UserSettingRow> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const UserSettingsCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  UserSettingsCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<UserSettingRow> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  UserSettingsCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return UserSettingsCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('UserSettingsCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $StudyEventsTable extends StudyEvents
    with TableInfo<$StudyEventsTable, StudyEventRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StudyEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<String> rating = GeneratedColumn<String>(
    'rating',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _occurredAtMeta = const VerificationMeta(
    'occurredAt',
  );
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
    'occurred_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, kind, rating, occurredAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'study_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<StudyEventRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
        _occurredAtMeta,
        occurredAt.isAcceptableOrUnknown(data['occurred_at']!, _occurredAtMeta),
      );
    } else if (isInserting) {
      context.missing(_occurredAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StudyEventRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StudyEventRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}rating'],
      ),
      occurredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}occurred_at'],
      )!,
    );
  }

  @override
  $StudyEventsTable createAlias(String alias) {
    return $StudyEventsTable(attachedDatabase, alias);
  }
}

class StudyEventRow extends DataClass implements Insertable<StudyEventRow> {
  /// Local autoincrement id.
  final int id;

  /// Event kind (e.g. `flashcard_review`). Stored as a stable string so new
  /// kinds can be added without a schema change.
  final String kind;

  /// SRS grade for review events, stored as the enum name
  /// (`again|hard|good|easy`); null for kinds that have no grade.
  final String? rating;

  /// When the event happened (UTC).
  final DateTime occurredAt;
  const StudyEventRow({
    required this.id,
    required this.kind,
    this.rating,
    required this.occurredAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['kind'] = Variable<String>(kind);
    if (!nullToAbsent || rating != null) {
      map['rating'] = Variable<String>(rating);
    }
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    return map;
  }

  StudyEventsCompanion toCompanion(bool nullToAbsent) {
    return StudyEventsCompanion(
      id: Value(id),
      kind: Value(kind),
      rating: rating == null && nullToAbsent
          ? const Value.absent()
          : Value(rating),
      occurredAt: Value(occurredAt),
    );
  }

  factory StudyEventRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StudyEventRow(
      id: serializer.fromJson<int>(json['id']),
      kind: serializer.fromJson<String>(json['kind']),
      rating: serializer.fromJson<String?>(json['rating']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'kind': serializer.toJson<String>(kind),
      'rating': serializer.toJson<String?>(rating),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
    };
  }

  StudyEventRow copyWith({
    int? id,
    String? kind,
    Value<String?> rating = const Value.absent(),
    DateTime? occurredAt,
  }) => StudyEventRow(
    id: id ?? this.id,
    kind: kind ?? this.kind,
    rating: rating.present ? rating.value : this.rating,
    occurredAt: occurredAt ?? this.occurredAt,
  );
  StudyEventRow copyWithCompanion(StudyEventsCompanion data) {
    return StudyEventRow(
      id: data.id.present ? data.id.value : this.id,
      kind: data.kind.present ? data.kind.value : this.kind,
      rating: data.rating.present ? data.rating.value : this.rating,
      occurredAt: data.occurredAt.present
          ? data.occurredAt.value
          : this.occurredAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StudyEventRow(')
          ..write('id: $id, ')
          ..write('kind: $kind, ')
          ..write('rating: $rating, ')
          ..write('occurredAt: $occurredAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, kind, rating, occurredAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StudyEventRow &&
          other.id == this.id &&
          other.kind == this.kind &&
          other.rating == this.rating &&
          other.occurredAt == this.occurredAt);
}

class StudyEventsCompanion extends UpdateCompanion<StudyEventRow> {
  final Value<int> id;
  final Value<String> kind;
  final Value<String?> rating;
  final Value<DateTime> occurredAt;
  const StudyEventsCompanion({
    this.id = const Value.absent(),
    this.kind = const Value.absent(),
    this.rating = const Value.absent(),
    this.occurredAt = const Value.absent(),
  });
  StudyEventsCompanion.insert({
    this.id = const Value.absent(),
    required String kind,
    this.rating = const Value.absent(),
    required DateTime occurredAt,
  }) : kind = Value(kind),
       occurredAt = Value(occurredAt);
  static Insertable<StudyEventRow> custom({
    Expression<int>? id,
    Expression<String>? kind,
    Expression<String>? rating,
    Expression<DateTime>? occurredAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (kind != null) 'kind': kind,
      if (rating != null) 'rating': rating,
      if (occurredAt != null) 'occurred_at': occurredAt,
    });
  }

  StudyEventsCompanion copyWith({
    Value<int>? id,
    Value<String>? kind,
    Value<String?>? rating,
    Value<DateTime>? occurredAt,
  }) {
    return StudyEventsCompanion(
      id: id ?? this.id,
      kind: kind ?? this.kind,
      rating: rating ?? this.rating,
      occurredAt: occurredAt ?? this.occurredAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (rating.present) {
      map['rating'] = Variable<String>(rating.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StudyEventsCompanion(')
          ..write('id: $id, ')
          ..write('kind: $kind, ')
          ..write('rating: $rating, ')
          ..write('occurredAt: $occurredAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $FlashcardDecksTable flashcardDecks = $FlashcardDecksTable(this);
  late final $FlashcardReviewCardsTable flashcardReviewCards =
      $FlashcardReviewCardsTable(this);
  late final $FlashcardReviewQueueTable flashcardReviewQueue =
      $FlashcardReviewQueueTable(this);
  late final $UserSettingsTable userSettings = $UserSettingsTable(this);
  late final $StudyEventsTable studyEvents = $StudyEventsTable(this);
  late final FlashcardCacheDao flashcardCacheDao = FlashcardCacheDao(
    this as AppDatabase,
  );
  late final ReviewQueueDao reviewQueueDao = ReviewQueueDao(
    this as AppDatabase,
  );
  late final UserSettingsDao userSettingsDao = UserSettingsDao(
    this as AppDatabase,
  );
  late final StudyLogDao studyLogDao = StudyLogDao(this as AppDatabase);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    flashcardDecks,
    flashcardReviewCards,
    flashcardReviewQueue,
    userSettings,
    studyEvents,
  ];
}

typedef $$FlashcardDecksTableCreateCompanionBuilder =
    FlashcardDecksCompanion Function({
      required String id,
      required String title,
      required String description,
      required int cardCount,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$FlashcardDecksTableUpdateCompanionBuilder =
    FlashcardDecksCompanion Function({
      Value<String> id,
      Value<String> title,
      Value<String> description,
      Value<int> cardCount,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$FlashcardDecksTableFilterComposer
    extends Composer<_$AppDatabase, $FlashcardDecksTable> {
  $$FlashcardDecksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cardCount => $composableBuilder(
    column: $table.cardCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FlashcardDecksTableOrderingComposer
    extends Composer<_$AppDatabase, $FlashcardDecksTable> {
  $$FlashcardDecksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cardCount => $composableBuilder(
    column: $table.cardCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FlashcardDecksTableAnnotationComposer
    extends Composer<_$AppDatabase, $FlashcardDecksTable> {
  $$FlashcardDecksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<int> get cardCount =>
      $composableBuilder(column: $table.cardCount, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$FlashcardDecksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FlashcardDecksTable,
          FlashcardDeckRow,
          $$FlashcardDecksTableFilterComposer,
          $$FlashcardDecksTableOrderingComposer,
          $$FlashcardDecksTableAnnotationComposer,
          $$FlashcardDecksTableCreateCompanionBuilder,
          $$FlashcardDecksTableUpdateCompanionBuilder,
          (
            FlashcardDeckRow,
            BaseReferences<
              _$AppDatabase,
              $FlashcardDecksTable,
              FlashcardDeckRow
            >,
          ),
          FlashcardDeckRow,
          PrefetchHooks Function()
        > {
  $$FlashcardDecksTableTableManager(
    _$AppDatabase db,
    $FlashcardDecksTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FlashcardDecksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FlashcardDecksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FlashcardDecksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> description = const Value.absent(),
                Value<int> cardCount = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FlashcardDecksCompanion(
                id: id,
                title: title,
                description: description,
                cardCount: cardCount,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String title,
                required String description,
                required int cardCount,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => FlashcardDecksCompanion.insert(
                id: id,
                title: title,
                description: description,
                cardCount: cardCount,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FlashcardDecksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FlashcardDecksTable,
      FlashcardDeckRow,
      $$FlashcardDecksTableFilterComposer,
      $$FlashcardDecksTableOrderingComposer,
      $$FlashcardDecksTableAnnotationComposer,
      $$FlashcardDecksTableCreateCompanionBuilder,
      $$FlashcardDecksTableUpdateCompanionBuilder,
      (
        FlashcardDeckRow,
        BaseReferences<_$AppDatabase, $FlashcardDecksTable, FlashcardDeckRow>,
      ),
      FlashcardDeckRow,
      PrefetchHooks Function()
    >;
typedef $$FlashcardReviewCardsTableCreateCompanionBuilder =
    FlashcardReviewCardsCompanion Function({
      required String deckId,
      required String userFlashcardId,
      required String cardId,
      required String front,
      required String reading,
      required String back,
      required DateTime cachedAt,
      Value<int> rowid,
    });
typedef $$FlashcardReviewCardsTableUpdateCompanionBuilder =
    FlashcardReviewCardsCompanion Function({
      Value<String> deckId,
      Value<String> userFlashcardId,
      Value<String> cardId,
      Value<String> front,
      Value<String> reading,
      Value<String> back,
      Value<DateTime> cachedAt,
      Value<int> rowid,
    });

class $$FlashcardReviewCardsTableFilterComposer
    extends Composer<_$AppDatabase, $FlashcardReviewCardsTable> {
  $$FlashcardReviewCardsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get deckId => $composableBuilder(
    column: $table.deckId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cardId => $composableBuilder(
    column: $table.cardId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get front => $composableBuilder(
    column: $table.front,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get reading => $composableBuilder(
    column: $table.reading,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get back => $composableBuilder(
    column: $table.back,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FlashcardReviewCardsTableOrderingComposer
    extends Composer<_$AppDatabase, $FlashcardReviewCardsTable> {
  $$FlashcardReviewCardsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get deckId => $composableBuilder(
    column: $table.deckId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cardId => $composableBuilder(
    column: $table.cardId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get front => $composableBuilder(
    column: $table.front,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get reading => $composableBuilder(
    column: $table.reading,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get back => $composableBuilder(
    column: $table.back,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FlashcardReviewCardsTableAnnotationComposer
    extends Composer<_$AppDatabase, $FlashcardReviewCardsTable> {
  $$FlashcardReviewCardsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get deckId =>
      $composableBuilder(column: $table.deckId, builder: (column) => column);

  GeneratedColumn<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get cardId =>
      $composableBuilder(column: $table.cardId, builder: (column) => column);

  GeneratedColumn<String> get front =>
      $composableBuilder(column: $table.front, builder: (column) => column);

  GeneratedColumn<String> get reading =>
      $composableBuilder(column: $table.reading, builder: (column) => column);

  GeneratedColumn<String> get back =>
      $composableBuilder(column: $table.back, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$FlashcardReviewCardsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FlashcardReviewCardsTable,
          FlashcardReviewCardRow,
          $$FlashcardReviewCardsTableFilterComposer,
          $$FlashcardReviewCardsTableOrderingComposer,
          $$FlashcardReviewCardsTableAnnotationComposer,
          $$FlashcardReviewCardsTableCreateCompanionBuilder,
          $$FlashcardReviewCardsTableUpdateCompanionBuilder,
          (
            FlashcardReviewCardRow,
            BaseReferences<
              _$AppDatabase,
              $FlashcardReviewCardsTable,
              FlashcardReviewCardRow
            >,
          ),
          FlashcardReviewCardRow,
          PrefetchHooks Function()
        > {
  $$FlashcardReviewCardsTableTableManager(
    _$AppDatabase db,
    $FlashcardReviewCardsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FlashcardReviewCardsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FlashcardReviewCardsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$FlashcardReviewCardsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> deckId = const Value.absent(),
                Value<String> userFlashcardId = const Value.absent(),
                Value<String> cardId = const Value.absent(),
                Value<String> front = const Value.absent(),
                Value<String> reading = const Value.absent(),
                Value<String> back = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FlashcardReviewCardsCompanion(
                deckId: deckId,
                userFlashcardId: userFlashcardId,
                cardId: cardId,
                front: front,
                reading: reading,
                back: back,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String deckId,
                required String userFlashcardId,
                required String cardId,
                required String front,
                required String reading,
                required String back,
                required DateTime cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => FlashcardReviewCardsCompanion.insert(
                deckId: deckId,
                userFlashcardId: userFlashcardId,
                cardId: cardId,
                front: front,
                reading: reading,
                back: back,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FlashcardReviewCardsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FlashcardReviewCardsTable,
      FlashcardReviewCardRow,
      $$FlashcardReviewCardsTableFilterComposer,
      $$FlashcardReviewCardsTableOrderingComposer,
      $$FlashcardReviewCardsTableAnnotationComposer,
      $$FlashcardReviewCardsTableCreateCompanionBuilder,
      $$FlashcardReviewCardsTableUpdateCompanionBuilder,
      (
        FlashcardReviewCardRow,
        BaseReferences<
          _$AppDatabase,
          $FlashcardReviewCardsTable,
          FlashcardReviewCardRow
        >,
      ),
      FlashcardReviewCardRow,
      PrefetchHooks Function()
    >;
typedef $$FlashcardReviewQueueTableCreateCompanionBuilder =
    FlashcardReviewQueueCompanion Function({
      Value<int> id,
      required String userFlashcardId,
      required String rating,
      required DateTime answeredAt,
      required String idempotencyKey,
      Value<String> status,
      Value<int> attemptCount,
      Value<String?> lastError,
      required DateTime createdAt,
      required DateTime updatedAt,
    });
typedef $$FlashcardReviewQueueTableUpdateCompanionBuilder =
    FlashcardReviewQueueCompanion Function({
      Value<int> id,
      Value<String> userFlashcardId,
      Value<String> rating,
      Value<DateTime> answeredAt,
      Value<String> idempotencyKey,
      Value<String> status,
      Value<int> attemptCount,
      Value<String?> lastError,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
    });

class $$FlashcardReviewQueueTableFilterComposer
    extends Composer<_$AppDatabase, $FlashcardReviewQueueTable> {
  $$FlashcardReviewQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get answeredAt => $composableBuilder(
    column: $table.answeredAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FlashcardReviewQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $FlashcardReviewQueueTable> {
  $$FlashcardReviewQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get answeredAt => $composableBuilder(
    column: $table.answeredAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FlashcardReviewQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $FlashcardReviewQueueTable> {
  $$FlashcardReviewQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get userFlashcardId => $composableBuilder(
    column: $table.userFlashcardId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<DateTime> get answeredAt => $composableBuilder(
    column: $table.answeredAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$FlashcardReviewQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FlashcardReviewQueueTable,
          FlashcardReviewQueueRow,
          $$FlashcardReviewQueueTableFilterComposer,
          $$FlashcardReviewQueueTableOrderingComposer,
          $$FlashcardReviewQueueTableAnnotationComposer,
          $$FlashcardReviewQueueTableCreateCompanionBuilder,
          $$FlashcardReviewQueueTableUpdateCompanionBuilder,
          (
            FlashcardReviewQueueRow,
            BaseReferences<
              _$AppDatabase,
              $FlashcardReviewQueueTable,
              FlashcardReviewQueueRow
            >,
          ),
          FlashcardReviewQueueRow,
          PrefetchHooks Function()
        > {
  $$FlashcardReviewQueueTableTableManager(
    _$AppDatabase db,
    $FlashcardReviewQueueTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FlashcardReviewQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FlashcardReviewQueueTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$FlashcardReviewQueueTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> userFlashcardId = const Value.absent(),
                Value<String> rating = const Value.absent(),
                Value<DateTime> answeredAt = const Value.absent(),
                Value<String> idempotencyKey = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attemptCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
              }) => FlashcardReviewQueueCompanion(
                id: id,
                userFlashcardId: userFlashcardId,
                rating: rating,
                answeredAt: answeredAt,
                idempotencyKey: idempotencyKey,
                status: status,
                attemptCount: attemptCount,
                lastError: lastError,
                createdAt: createdAt,
                updatedAt: updatedAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String userFlashcardId,
                required String rating,
                required DateTime answeredAt,
                required String idempotencyKey,
                Value<String> status = const Value.absent(),
                Value<int> attemptCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                required DateTime createdAt,
                required DateTime updatedAt,
              }) => FlashcardReviewQueueCompanion.insert(
                id: id,
                userFlashcardId: userFlashcardId,
                rating: rating,
                answeredAt: answeredAt,
                idempotencyKey: idempotencyKey,
                status: status,
                attemptCount: attemptCount,
                lastError: lastError,
                createdAt: createdAt,
                updatedAt: updatedAt,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FlashcardReviewQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FlashcardReviewQueueTable,
      FlashcardReviewQueueRow,
      $$FlashcardReviewQueueTableFilterComposer,
      $$FlashcardReviewQueueTableOrderingComposer,
      $$FlashcardReviewQueueTableAnnotationComposer,
      $$FlashcardReviewQueueTableCreateCompanionBuilder,
      $$FlashcardReviewQueueTableUpdateCompanionBuilder,
      (
        FlashcardReviewQueueRow,
        BaseReferences<
          _$AppDatabase,
          $FlashcardReviewQueueTable,
          FlashcardReviewQueueRow
        >,
      ),
      FlashcardReviewQueueRow,
      PrefetchHooks Function()
    >;
typedef $$UserSettingsTableCreateCompanionBuilder =
    UserSettingsCompanion Function({
      required String key,
      required String value,
      Value<int> rowid,
    });
typedef $$UserSettingsTableUpdateCompanionBuilder =
    UserSettingsCompanion Function({
      Value<String> key,
      Value<String> value,
      Value<int> rowid,
    });

class $$UserSettingsTableFilterComposer
    extends Composer<_$AppDatabase, $UserSettingsTable> {
  $$UserSettingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$UserSettingsTableOrderingComposer
    extends Composer<_$AppDatabase, $UserSettingsTable> {
  $$UserSettingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$UserSettingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $UserSettingsTable> {
  $$UserSettingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$UserSettingsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $UserSettingsTable,
          UserSettingRow,
          $$UserSettingsTableFilterComposer,
          $$UserSettingsTableOrderingComposer,
          $$UserSettingsTableAnnotationComposer,
          $$UserSettingsTableCreateCompanionBuilder,
          $$UserSettingsTableUpdateCompanionBuilder,
          (
            UserSettingRow,
            BaseReferences<_$AppDatabase, $UserSettingsTable, UserSettingRow>,
          ),
          UserSettingRow,
          PrefetchHooks Function()
        > {
  $$UserSettingsTableTableManager(_$AppDatabase db, $UserSettingsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$UserSettingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$UserSettingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$UserSettingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UserSettingsCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => UserSettingsCompanion.insert(
                key: key,
                value: value,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$UserSettingsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $UserSettingsTable,
      UserSettingRow,
      $$UserSettingsTableFilterComposer,
      $$UserSettingsTableOrderingComposer,
      $$UserSettingsTableAnnotationComposer,
      $$UserSettingsTableCreateCompanionBuilder,
      $$UserSettingsTableUpdateCompanionBuilder,
      (
        UserSettingRow,
        BaseReferences<_$AppDatabase, $UserSettingsTable, UserSettingRow>,
      ),
      UserSettingRow,
      PrefetchHooks Function()
    >;
typedef $$StudyEventsTableCreateCompanionBuilder =
    StudyEventsCompanion Function({
      Value<int> id,
      required String kind,
      Value<String?> rating,
      required DateTime occurredAt,
    });
typedef $$StudyEventsTableUpdateCompanionBuilder =
    StudyEventsCompanion Function({
      Value<int> id,
      Value<String> kind,
      Value<String?> rating,
      Value<DateTime> occurredAt,
    });

class $$StudyEventsTableFilterComposer
    extends Composer<_$AppDatabase, $StudyEventsTable> {
  $$StudyEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StudyEventsTableOrderingComposer
    extends Composer<_$AppDatabase, $StudyEventsTable> {
  $$StudyEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StudyEventsTableAnnotationComposer
    extends Composer<_$AppDatabase, $StudyEventsTable> {
  $$StudyEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
    column: $table.occurredAt,
    builder: (column) => column,
  );
}

class $$StudyEventsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $StudyEventsTable,
          StudyEventRow,
          $$StudyEventsTableFilterComposer,
          $$StudyEventsTableOrderingComposer,
          $$StudyEventsTableAnnotationComposer,
          $$StudyEventsTableCreateCompanionBuilder,
          $$StudyEventsTableUpdateCompanionBuilder,
          (
            StudyEventRow,
            BaseReferences<_$AppDatabase, $StudyEventsTable, StudyEventRow>,
          ),
          StudyEventRow,
          PrefetchHooks Function()
        > {
  $$StudyEventsTableTableManager(_$AppDatabase db, $StudyEventsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StudyEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StudyEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StudyEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String?> rating = const Value.absent(),
                Value<DateTime> occurredAt = const Value.absent(),
              }) => StudyEventsCompanion(
                id: id,
                kind: kind,
                rating: rating,
                occurredAt: occurredAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String kind,
                Value<String?> rating = const Value.absent(),
                required DateTime occurredAt,
              }) => StudyEventsCompanion.insert(
                id: id,
                kind: kind,
                rating: rating,
                occurredAt: occurredAt,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StudyEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $StudyEventsTable,
      StudyEventRow,
      $$StudyEventsTableFilterComposer,
      $$StudyEventsTableOrderingComposer,
      $$StudyEventsTableAnnotationComposer,
      $$StudyEventsTableCreateCompanionBuilder,
      $$StudyEventsTableUpdateCompanionBuilder,
      (
        StudyEventRow,
        BaseReferences<_$AppDatabase, $StudyEventsTable, StudyEventRow>,
      ),
      StudyEventRow,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$FlashcardDecksTableTableManager get flashcardDecks =>
      $$FlashcardDecksTableTableManager(_db, _db.flashcardDecks);
  $$FlashcardReviewCardsTableTableManager get flashcardReviewCards =>
      $$FlashcardReviewCardsTableTableManager(_db, _db.flashcardReviewCards);
  $$FlashcardReviewQueueTableTableManager get flashcardReviewQueue =>
      $$FlashcardReviewQueueTableTableManager(_db, _db.flashcardReviewQueue);
  $$UserSettingsTableTableManager get userSettings =>
      $$UserSettingsTableTableManager(_db, _db.userSettings);
  $$StudyEventsTableTableManager get studyEvents =>
      $$StudyEventsTableTableManager(_db, _db.studyEvents);
}
