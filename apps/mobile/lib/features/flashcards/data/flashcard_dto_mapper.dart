import 'package:nihongo_bjt/features/flashcards/data/dto/deck_detail_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_deck_dto.dart';
import 'package:nihongo_bjt/features/flashcards/data/dto/flashcard_review_item_dto.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

/// Pure mappings from API wire DTOs to the flashcard domain model.
///
/// Kept separate from the DTOs so the generated serialization layer stays
/// dependency-free, and from the repository so the mapping is unit-testable in
/// isolation.

/// Maps a deck wire model to the domain [FlashcardDeck].
extension FlashcardDeckDtoMapper on FlashcardDeckDto {
  FlashcardDeck toDomain() {
    final japanese = titleJa?.trim();
    return FlashcardDeck(
      id: id,
      // The deck-list title is Japanese-first; fall back to the Vietnamese
      // title when the deck has no Japanese label.
      title: (japanese != null && japanese.isNotEmpty) ? japanese : titleVi,
      description: descriptionVi ?? '',
      cardCount: count.cards,
      visibility: DeckVisibility.fromWire(visibility),
    );
  }
}

/// Maps a deck-detail wire model to the domain [DeckDetail].
extension DeckDetailDtoMapper on DeckDetailDto {
  DeckDetail toDomain() {
    return DeckDetail(
      id: id,
      titleVi: titleVi,
      titleJa: titleJa?.trim().isNotEmpty ?? false ? titleJa!.trim() : null,
      descriptionVi: descriptionVi,
      descriptionJa: descriptionJa,
      visibility: DeckVisibility.fromWire(visibility),
      cards: cards.map((row) => row.toDomain()).toList(),
    );
  }
}

/// Maps a single `deck_card` row to the domain [DeckCard].
extension DeckCardRowDtoMapper on DeckCardRowDto {
  DeckCard toDomain() {
    return DeckCard(
      deckCardId: id,
      cardId: cardId,
      position: position,
      frontText: card.frontText,
      backText: card.backText,
      reading: card.reading ?? '',
      imageUrl: primaryImage?.readUrl,
      audioUrl: primaryAudio?.readUrl,
    );
  }
}

/// Maps a due-review wire model to the domain [Flashcard].
extension FlashcardReviewItemDtoMapper on FlashcardReviewItemDto {
  Flashcard toDomain() {
    return Flashcard(
      // Display identity is the stable card id; the per-learner review row id
      // (`id`) is carried separately for SRS grade submission.
      id: cardId,
      userFlashcardId: id,
      front: card.frontText,
      reading: card.reading ?? '',
      back: card.backText,
    );
  }
}
