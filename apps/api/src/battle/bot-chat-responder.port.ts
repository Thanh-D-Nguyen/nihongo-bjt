/**
 * Port interface for bot chat response generation.
 * Default: template-based responder using DB vocabulary/tips.
 * Future: swap to AI provider (OpenAI, Claude, etc.) without changing consumers.
 */
export abstract class BotChatResponderPort {
  abstract generateResponse(context: BotChatContext): Promise<string | null>;
}

export type BotChatContext = {
  botKey: string;
  botDisplayName: string;
  botPersona: string | null;
  botDifficulty: string;
  botVocabularyLevel: string;
  userMessage: string;
  userDisplayName: string;
  recentMessages: Array<{ message: string; userId: string; kind: string }>;
};
