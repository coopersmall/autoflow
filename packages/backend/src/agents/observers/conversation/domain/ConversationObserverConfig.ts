import type { IConversationsService } from '@backend/conversation';
import type { ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';

/**
 * Configuration for creating a conversation observer.
 */
export interface ConversationObserverConfig {
  /** The conversations service for persistence */
  readonly conversationsService: IConversationsService;

  /** The user ID for the conversation */
  readonly userId: UserId;

  /** Optional existing conversation ID. If omitted, a new conversation is created. */
  readonly conversationId?: ConversationId;
}
