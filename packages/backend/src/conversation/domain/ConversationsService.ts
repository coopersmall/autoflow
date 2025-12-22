import type { Context } from '@backend/infrastructure/context';
import type { IStandardService } from '@backend/infrastructure/services/StandardService';
import type {
  Conversation,
  ConversationId,
  ConversationItem,
} from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { AppendItemData } from './AppendItemData';
import type { ConversationWithItems } from './ConversationWithItems';

/**
 * Service interface for managing conversations and their items.
 * Extends StandardService for CRUD operations on Conversation entities
 * and provides additional methods for managing ConversationItem entities.
 */
export type IConversationsService = Readonly<
  IStandardService<ConversationId, Conversation> & {
    /**
     * Gets all items for a conversation, sorted by turnIndex.
     */
    getItems(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
    ): Promise<Result<ConversationItem[], AppError>>;

    /**
     * Appends a new item to a conversation.
     */
    appendItem(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
      item: AppendItemData,
    ): Promise<Result<ConversationItem, AppError>>;

    /**
     * Gets a conversation with all its items.
     */
    getWithItems(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
    ): Promise<Result<ConversationWithItems, AppError>>;

    /**
     * Closes a conversation by setting status to 'closed'.
     */
    close(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
    ): Promise<Result<Conversation, AppError>>;

    /**
     * Reopens a conversation by setting status to 'reopened'.
     */
    reopen(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
    ): Promise<Result<Conversation, AppError>>;

    /**
     * Updates the title of a conversation.
     */
    updateTitle(
      ctx: Context,
      conversationId: ConversationId,
      userId: UserId,
      title: string,
    ): Promise<Result<Conversation, AppError>>;
  }
>;
