import type { IConversationsService } from '@backend/conversation';
import type { Context } from '@backend/infrastructure/context';
import type { ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface EnsureConversationParams {
  readonly userId: UserId;
  readonly existingConversationId?: ConversationId;
}

export interface EnsureConversationDeps {
  readonly conversationsService: IConversationsService;
}

export interface EnsureConversationResult {
  readonly conversationId: ConversationId;
  readonly isNew: boolean;
}

/**
 * Ensures a conversation exists, either by verifying an existing one or creating a new one.
 *
 * @param ctx - Request context
 * @param params - Parameters including userId and optional existing conversationId
 * @param deps - Dependencies including the conversations service
 * @returns The conversation ID and whether it was newly created
 */
export async function ensureConversation(
  ctx: Context,
  params: EnsureConversationParams,
  deps: EnsureConversationDeps,
): Promise<Result<EnsureConversationResult, AppError>> {
  const { userId, existingConversationId } = params;
  const { conversationsService } = deps;

  if (existingConversationId) {
    // Verify existing conversation exists and belongs to user
    const getResult = await conversationsService.get(
      ctx,
      existingConversationId,
      userId,
    );
    if (getResult.isErr()) {
      return err(getResult.error);
    }
    return ok({
      conversationId: existingConversationId,
      isNew: false,
    });
  }

  // Create new conversation
  const createResult = await conversationsService.create(ctx, userId, {
    title: 'New Conversation',
    status: 'active',
    schemaVersion: 1,
    channel: 'api',
  });
  if (createResult.isErr()) {
    return err(createResult.error);
  }

  return ok({
    conversationId: createResult.value.id,
    isNew: true,
  });
}
