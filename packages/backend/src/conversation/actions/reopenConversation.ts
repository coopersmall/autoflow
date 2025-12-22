import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { Context } from '@backend/infrastructure/context';
import type { Conversation, ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface ReopenConversationRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
}

export interface ReopenConversationDeps {
  readonly conversations: IConversationsService;
}

/**
 * Reopens a conversation by setting its status to 'reopened'.
 */
export async function reopenConversation(
  ctx: Context,
  request: ReopenConversationRequest,
  deps: ReopenConversationDeps,
): Promise<Result<Conversation, AppError>> {
  const { conversationId, userId } = request;
  const { conversations } = deps;

  return conversations.update(ctx, conversationId, userId, {
    status: 'reopened',
  });
}
