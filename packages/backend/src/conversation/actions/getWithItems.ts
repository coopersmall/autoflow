import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { ConversationWithItems } from '@backend/conversation/domain/ConversationWithItems';
import type { IConversationItemsRepo } from '@backend/conversation/repos/ConversationItemsRepo';
import type { Context } from '@backend/infrastructure/context';
import type { ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { getItems } from './getItems';

export interface GetWithItemsRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
}

export interface GetWithItemsDeps {
  readonly conversations: IConversationsService;
  readonly itemsRepo: IConversationItemsRepo;
}

export interface GetWithItemsActions {
  readonly getItems: typeof getItems;
}

const defaultActions: GetWithItemsActions = {
  getItems,
};

/**
 * Gets a conversation with all its items.
 * Combines the conversation entity with its items into a single object.
 */
export async function getWithItems(
  ctx: Context,
  request: GetWithItemsRequest,
  deps: GetWithItemsDeps,
  actions: GetWithItemsActions = defaultActions,
): Promise<Result<ConversationWithItems, AppError>> {
  const { conversationId, userId } = request;
  const { conversations, itemsRepo } = deps;

  // Get the conversation
  const conversationResult = await conversations.get(
    ctx,
    conversationId,
    userId,
  );
  if (conversationResult.isErr()) {
    return err(conversationResult.error);
  }

  // Get the items
  const itemsResult = await actions.getItems(
    ctx,
    { conversationId, userId },
    { itemsRepo },
  );
  if (itemsResult.isErr()) {
    return err(itemsResult.error);
  }

  // Combine into ConversationWithItems
  const conversationWithItems: ConversationWithItems = {
    ...conversationResult.value,
    items: itemsResult.value,
  };

  return ok(conversationWithItems);
}
