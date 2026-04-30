"use client";

import { FormEvent, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface Deck {
  _count?: { cards: number };
  id: string;
  titleVi: string;
}

interface DeckLabels {
  cards: string;
  create: string;
  error: string;
  eyebrow: string;
  load: string;
  placeholderTitle: string;
  placeholderUser: string;
  subtitle: string;
  title: string;
}

export function DeckAdminClient({ labels }: { labels: DeckLabels }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState(false);
  const [titleVi, setTitleVi] = useState("");
  const [userId, setUserId] = useState("");

  async function loadDecks() {
    const response = await adminApiFetch(
      `/api/flashcards/decks?userId=${encodeURIComponent(userId)}`
    );
    if (!response.ok) {
      throw new Error("Deck list request failed");
    }
    setDecks((await response.json()) as Deck[]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);

    try {
      const response = await adminApiFetch("/api/flashcards/decks", {
        body: JSON.stringify({ titleVi, userId }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Deck create request failed");
      }
      setTitleVi("");
      await loadDecks();
    } catch {
      setError(true);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="admin-card">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p>{labels.subtitle}</p>
        {error ? <p role="alert">{labels.error}</p> : null}
        <form className="deck-form" onSubmit={onSubmit}>
          <input
            onChange={(event) => setUserId(event.target.value)}
            placeholder={labels.placeholderUser}
            required
            type="text"
            value={userId}
          />
          <input
            onChange={(event) => setTitleVi(event.target.value)}
            placeholder={labels.placeholderTitle}
            required
            type="text"
            value={titleVi}
          />
          <button type="submit">{labels.create}</button>
          <button onClick={() => void loadDecks().catch(() => setError(true))} type="button">
            {labels.load}
          </button>
        </form>
        <ul className="deck-list">
          {decks.map((deck) => (
            <li key={deck.id}>
              <strong>{deck.titleVi}</strong>
              <span>
                {deck._count?.cards ?? 0} {labels.cards}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
