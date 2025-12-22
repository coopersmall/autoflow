import type { IConversationItemsRepo } from '@backend/conversation/repos/ConversationItemsRepo';
import type { Context } from '@backend/infrastructure/context';
import type {
  ConversationId,
  ConversationItem,
} from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetItemsRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
}

export interface GetItemsDeps {
  readonly itemsRepo: IConversationItemsRepo;
}

/**
 * Gets all items for a conversation, sorted by turnIndex.
 */
export async function getItems(
  ctx: Context,
  request: GetItemsRequest,
  deps: GetItemsDeps,
): Promise<Result<ConversationItem[], AppError>> {
  const { conversationId, userId } = request;
  const { itemsRepo } = deps;

  return itemsRepo.getByConversationId(ctx, conversationId, userId);
}
