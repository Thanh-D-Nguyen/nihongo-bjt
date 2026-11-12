"use client";

import type { CompanionMessage } from "@nihongo-bjt/shared";

import { learnerApiFetch } from "./learner-api";

export type CompanionChatTurn = { role: "user" | "assistant"; content: string };

export type CompanionChatRequest = {
  message: string;
  history: CompanionChatTurn[];
  locale: string;
};

const MAX_HISTORY_TURNS = 20;

/** Pick the text a learner actually saw for a bot message in this locale. */
function botTextForLocale(message: CompanionMessage, locale: string): string {
  if (locale === "ja") return message.textJa;
  if (locale === "en") return message.textEn ?? message.textJa;
  return message.textVi;
}

/**
 * Build the LLM history from the companion engine's message list.
 * Only conversational turns are sent: learner messages (raw text is
 * stored in textJa) and Shiba's chat replies (type "hint"). Greetings,
 * tips, nudges and celebrations are UI chrome, not conversation.
 * Capped at the most recent MAX_HISTORY_TURNS turns.
 */
export function buildCompanionChatHistory(
  messages: CompanionMessage[],
  locale: string,
): CompanionChatTurn[] {
  const turns: CompanionChatTurn[] = [];
  for (const message of messages) {
    if (message.sender === "user") {
      const content = message.textJa.trim();
      if (content) turns.push({ role: "user", content });
    } else if (message.type === "hint") {
      const content = botTextForLocale(message, locale).trim();
      if (content) turns.push({ role: "assistant", content });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

export function buildCompanionChatRequest(
  messages: CompanionMessage[],
  locale: string,
  text: string,
): CompanionChatRequest {
  return {
    message: text.trim(),
    history: buildCompanionChatHistory(messages, locale),
    locale,
  };
}

/**
 * Ask the Go API for an LLM-backed Shiba reply. Returns null on any
 * failure (not configured, offline, HTTP error) so the caller can fall
 * back to the built-in rule-based replies.
 */
export async function requestCompanionChat(
  request: CompanionChatRequest,
): Promise<string | null> {
  try {
    const res = await learnerApiFetch("/api/companion/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string") return null;
    const reply = data.reply.trim();
    return reply ? reply : null;
  } catch {
    return null;
  }
}
