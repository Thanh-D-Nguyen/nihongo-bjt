import 'package:flutter/foundation.dart';

/// A vocabulary word attached to a magazine article.
@immutable
class MagazineVocab {
  const MagazineVocab({required this.word, this.reading, this.meaning});

  final String word;
  final String? reading;
  final String? meaning;
}

/// A single answer option for a magazine quiz.
@immutable
class MagazineQuizOption {
  const MagazineQuizOption({required this.label, required this.isCorrect});

  final String label;
  final bool isCorrect;
}

/// A mini-quiz question attached to a magazine article.
@immutable
class MagazineQuiz {
  const MagazineQuiz({
    required this.questionJp,
    required this.options,
    this.questionVi,
    this.explanationJp,
    this.explanationVi,
  });

  final String questionJp;
  final String? questionVi;
  final List<MagazineQuizOption> options;
  final String? explanationJp;
  final String? explanationVi;
}

/// Magazine article model (`GET /api/magazine`, `GET /api/magazine/:slug`).
@immutable
class MagazineArticle {
  const MagazineArticle({
    required this.slug,
    required this.widgetKind,
    required this.titleJp,
    required this.titleVi,
    required this.vocab,
    required this.quizzes,
    required this.paragraphsJp,
    required this.paragraphsVi,
    this.summaryJp,
    this.summaryVi,
    this.coverImageUrl,
    this.jlptLevel,
    this.publishDate,
  });

  final String slug;
  final String widgetKind;
  final String titleJp;
  final String titleVi;
  final String? summaryJp;
  final String? summaryVi;
  final String? coverImageUrl;
  final String? jlptLevel;
  final DateTime? publishDate;
  final List<String> paragraphsJp;
  final List<String> paragraphsVi;
  final List<MagazineVocab> vocab;
  final List<MagazineQuiz> quizzes;
}
