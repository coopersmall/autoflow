import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { Context } from '@backend/infrastructure/context';
import type { Conversation, ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface CloseConversationRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
}

export interface CloseConversationDeps {
  readonly conversations: IConversationsService;
}

/**
 * Closes a conversation by setting its status to 'closed'.
 */
export async function closeConversation(
  ctx: Context,
  request: CloseConversationRequest,
  deps: CloseConversationDeps,
): Promise<Result<Conversation, AppError>> {
  const { conversationId, userId } = request;
  const { conversations } = deps;

  return conversations.update(ctx, conversationId, userId, {
    status: 'closed',
  });
}
