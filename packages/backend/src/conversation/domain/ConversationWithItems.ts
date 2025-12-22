import type { Conversation, ConversationItem } from '@core/domain/conversation';

/**
 * Extended conversation type that includes all conversation items.
 * Used when retrieving a full conversation with its message history.
 */
export type ConversationWithItems = Conversation & {
  items: ConversationItem[];
};
