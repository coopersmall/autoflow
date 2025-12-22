import type { AppendItemData } from '@backend/conversation/domain/AppendItemData';
import type { IConversationItemsRepo } from '@backend/conversation/repos/ConversationItemsRepo';
import type { Context } from '@backend/infrastructure/context';
import type {
  ConversationId,
  ConversationItem,
  ConversationItemId,
} from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface AppendItemRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
  readonly item: AppendItemData;
}

export interface AppendItemDeps {
  readonly itemsRepo: IConversationItemsRepo;
  readonly newId: () => ConversationItemId;
}

/**
 * Appends a new item to a conversation.
 * Generates a new ID and sets the conversationId.
 */
export async function appendItem(
  ctx: Context,
  request: AppendItemRequest,
  deps: AppendItemDeps,
): Promise<Result<ConversationItem, AppError>> {
  const { conversationId, userId, item } = request;
  const { itemsRepo, newId } = deps;

  const id = newId();

  // Create the item data with conversationId
  const itemData = {
    ...item,
    conversationId,
  };

  return itemsRepo.create(ctx, id, userId, itemData);
}
