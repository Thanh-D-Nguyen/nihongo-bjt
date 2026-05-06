/** Deck row from GET /api/flashcards/decks (Prisma JSON). */
export interface DeckApiRow {
  id: string;
  ownerUserId: string | null;
  titleVi: string;
  titleJa: string | null;
  descriptionVi: string | null;
  descriptionJa: string | null;
  visibility: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: { cards: number };
}
