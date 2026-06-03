import 'package:flutter/foundation.dart';

/// Immutable domain models for the canonical content API
/// (`/dictionary`, `/kanji`, `/grammar`, `/search`). Field names mirror the
/// backend Prisma models (camelCase JSON). All optional fields are nullable so
/// partial rows never crash the UI.

/// A single example sentence (`content.example_sentence`).
@immutable
class ContentExample {
  const ContentExample({
    required this.id,
    required this.japaneseText,
    this.reading,
    this.translationVi,
  });

  final String id;
  final String japaneseText;
  final String? reading;
  final String? translationVi;
}

/// One sense (meaning) of a dictionary word (`content.lexeme_sense`).
@immutable
class LexemeSense {
  const LexemeSense({
    required this.id,
    required this.position,
    required this.meaningVi,
    this.partOfSpeech,
    this.examples = const [],
  });

  final String id;
  final int position;
  final String meaningVi;
  final String? partOfSpeech;
  final List<ContentExample> examples;
}

/// A dictionary word / lexeme (`content.lexeme`).
@immutable
class Lexeme {
  const Lexeme({
    required this.id,
    required this.headword,
    this.reading,
    this.jlptLevel,
    this.shortMeaningVi,
    this.kanjiMeaningVi,
    this.senses = const [],
  });

  final String id;
  final String headword;
  final String? reading;
  final String? jlptLevel;
  final String? shortMeaningVi;
  final String? kanjiMeaningVi;
  final List<LexemeSense> senses;

  /// Best one-line gloss for list rows: short meaning, else first sense.
  String? get primaryGloss =>
      shortMeaningVi ?? (senses.isNotEmpty ? senses.first.meaningVi : null);
}

/// A radical/component of a kanji (`content.kanji_component`).
@immutable
class KanjiComponent {
  const KanjiComponent({
    required this.id,
    required this.position,
    required this.character,
    this.hanViet,
  });

  final String id;
  final int position;
  final String character;
  final String? hanViet;
}

/// A compound word example for a kanji (`content.kanji_example`).
@immutable
class KanjiExample {
  const KanjiExample({
    required this.id,
    required this.position,
    required this.word,
    this.reading,
    this.meaningVi,
    this.hanViet,
  });

  final String id;
  final int position;
  final String word;
  final String? reading;
  final String? meaningVi;
  final String? hanViet;
}

/// A kanji character (`content.kanji`).
@immutable
class KanjiEntry {
  const KanjiEntry({
    required this.id,
    required this.character,
    this.meaningVi,
    this.onyomi,
    this.kunyomi,
    this.strokeCount,
    this.level,
    this.frequency,
    this.detail,
    this.tip,
    this.hasStrokeDiagram = false,
    this.components = const [],
    this.examples = const [],
  });

  final String id;
  final String character;
  final String? meaningVi;
  final String? onyomi;
  final String? kunyomi;
  final int? strokeCount;
  final int? level;
  final int? frequency;
  final String? detail;
  final String? tip;

  /// True when the server has a stroke-order SVG available at
  /// `/api/kanji/{id}/stroke`.
  final bool hasStrokeDiagram;
  final List<KanjiComponent> components;
  final List<KanjiExample> examples;
}

/// One detailed explanation of a grammar point
/// (`content.grammar_point_detail`).
@immutable
class GrammarDetail {
  const GrammarDetail({
    required this.id,
    required this.position,
    this.meaningVi,
    this.explanation,
    this.note,
    this.synopsis,
    this.examples = const [],
  });

  final String id;
  final int position;
  final String? meaningVi;
  final String? explanation;
  final String? note;
  final String? synopsis;
  final List<ContentExample> examples;
}

/// A grammar point (`content.grammar_point`).
@immutable
class GrammarEntry {
  const GrammarEntry({
    required this.id,
    required this.pattern,
    required this.meaningVi,
    this.jlptLevel,
    this.category,
    this.details = const [],
  });

  final String id;
  final String pattern;
  final String meaningVi;
  final String? jlptLevel;
  final String? category;
  final List<GrammarDetail> details;
}

/// The kind of content a search hit points to (`/search` result `kind`).
enum SearchHitKind { lexeme, kanji, grammar, example, unknown }

/// One result row from the Meilisearch-backed `/search` endpoint.
@immutable
class SearchHit {
  const SearchHit({
    required this.id,
    required this.kind,
    required this.title,
    this.reading,
    this.description,
    this.jlptLevel,
  });

  final String id;
  final SearchHitKind kind;
  final String title;
  final String? reading;
  final String? description;
  final String? jlptLevel;
}
