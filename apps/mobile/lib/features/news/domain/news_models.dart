import 'package:flutter/foundation.dart';

/// A single vocabulary item extracted from an NHK article.
@immutable
class NewsVocabItem {
  const NewsVocabItem({
    required this.word,
    this.reading,
    this.meaning,
    this.pos,
  });

  final String word;
  final String? reading;
  final String? meaning;
  final String? pos;
}

/// Summary of an NHK news article (`GET /api/nhk-news`).
@immutable
class NewsArticleSummary {
  const NewsArticleSummary({
    required this.id,
    required this.title,
    required this.url,
    required this.sourceType,
    required this.sourceLabel,
    this.titleWithRuby,
    this.publishedAt,
    this.imageUrl,
    this.difficulty,
  });

  final String id;
  final String title;
  final String? titleWithRuby;
  final DateTime? publishedAt;
  final String? imageUrl;
  final String? difficulty;
  final String url;

  /// `easy` (NHK Easy, furigana) or `normal` (standard NHK).
  final String sourceType;
  final String sourceLabel;

  bool get isEasy => sourceType == 'easy';
}

/// Full NHK article detail (`GET /api/nhk-news/:id`).
@immutable
class NewsArticleDetail {
  const NewsArticleDetail({
    required this.summary,
    required this.bodyHtml,
    required this.bodyPlain,
    required this.vocabulary,
    this.audioUrl,
  });

  final NewsArticleSummary summary;
  final String? audioUrl;
  final String bodyHtml;
  final String bodyPlain;
  final List<NewsVocabItem> vocabulary;
}
