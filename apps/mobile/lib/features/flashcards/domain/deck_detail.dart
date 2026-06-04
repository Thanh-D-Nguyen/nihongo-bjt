import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

/// One card as it appears inside a deck's detail view.
///
/// Carries the stable identifiers needed for editing (the per-deck
/// `deckCardId` link and the shared `cardId`) alongside the display content.
class DeckCard {
  const DeckCard({
    required this.deckCardId,
    required this.cardId,
    required this.position,
    required this.frontText,
    required this.backText,
    this.reading = '',
    this.imageUrl,
    this.audioUrl,
  });

  /// Id of the `deck_card` link row (unique within the deck).
  final String deckCardId;

  /// Id of the shared `card` row (stable across decks).
  final String cardId;

  /// Zero-based order of the card within the deck.
  final int position;

  /// Front side — Japanese term/expression.
  final String frontText;

  /// Back side — Vietnamese meaning.
  final String backText;

  /// Optional reading (furigana / kana). Empty when the card has none.
  final String reading;

  /// Resolved primary image URL, when the card has one.
  final String? imageUrl;

  /// Resolved primary audio URL, when the card has one.
  final String? audioUrl;
}

/// Full detail of a single deck: metadata plus its ordered cards.
class DeckDetail {
  const DeckDetail({
    required this.id,
    required this.titleVi,
    required this.cards,
    this.titleJa,
    this.descriptionVi,
    this.descriptionJa,
    this.visibility = DeckVisibility.private,
  });

  final String id;

  /// Vietnamese title (always present per contract).
  final String titleVi;

  /// Japanese title; null for decks without a Japanese label.
  final String? titleJa;

  /// Vietnamese description; null when the deck has none.
  final String? descriptionVi;

  /// Japanese description; null when the deck has none.
  final String? descriptionJa;

  /// Whether the deck is private to the learner or publicly shared.
  final DeckVisibility visibility;

  /// Ordered cards in the deck.
  final List<DeckCard> cards;

  /// Number of cards in the deck.
  int get cardCount => cards.length;

  /// Display title: Japanese-first, falling back to the Vietnamese title.
  String get displayTitle =>
      (titleJa != null && titleJa!.isNotEmpty) ? titleJa! : titleVi;

  /// Display description: Vietnamese-first, falling back to Japanese, then ''.
  String get displayDescription {
    if (descriptionVi != null && descriptionVi!.isNotEmpty) {
      return descriptionVi!;
    }
    if (descriptionJa != null && descriptionJa!.isNotEmpty) {
      return descriptionJa!;
    }
    return '';
  }
}
