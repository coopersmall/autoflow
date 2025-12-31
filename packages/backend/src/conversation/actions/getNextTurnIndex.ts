import type { IConversationItemsRepo } from '@backend/conversation/repos/ConversationItemsRepo';
import type { Context } from '@backend/infrastructure/context';
import type { ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface GetNextTurnIndexRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
}

export interface GetNextTurnIndexDeps {
  readonly itemsRepo: IConversationItemsRepo;
}

/**
 * Gets the next turn index for a conversation.
 * This is the latest turn index + 1, or 0 if no items exist.
 */
export async function getNextTurnIndex(
  ctx: Context,
  request: GetNextTurnIndexRequest,
  deps: GetNextTurnIndexDeps,
): Promise<Result<number, AppError>> {
  const { conversationId, userId } = request;
  const { itemsRepo } = deps;

  const latestResult = await itemsRepo.getLatestTurnIndex(
    ctx,
    conversationId,
    userId,
  );

  if (latestResult.isErr()) {
    return err(latestResult.error);
  }

  return ok(latestResult.value + 1);
}
