import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { Context } from '@backend/infrastructure/context';
import type { Conversation, ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface UpdateTitleRequest {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
  readonly title: string;
}

export interface UpdateTitleDeps {
  readonly conversations: IConversationsService;
}

/**
 * Updates the title of a conversation.
 */
export async function updateTitle(
  ctx: Context,
  request: UpdateTitleRequest,
  deps: UpdateTitleDeps,
): Promise<Result<Conversation, AppError>> {
  const { conversationId, userId, title } = request;
  const { conversations } = deps;

  return conversations.update(ctx, conversationId, userId, { title });
}
