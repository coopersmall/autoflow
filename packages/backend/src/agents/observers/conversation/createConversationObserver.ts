import type { Context } from '@backend/infrastructure/context';
import type { ConversationId } from '@core/domain/conversation';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { AgentManifestHooks } from '../../hooks/AgentManifestHooks';
import type { AgentObserver } from '../AgentObserver';
import type { AgentObserverContext } from '../AgentObserverContext';
import { buildConversationHooks } from './actions/buildConversationHooks';
import { ensureConversation } from './actions/ensureConversation';
import type { ConversationObserverConfig } from './domain/ConversationObserverConfig';

/**
 * Result from createConversationObserver.
 * Provides the observer instance and immediately-available init values.
 *
 * STATELESS DESIGN:
 * - conversationId is available immediately (from async init)
 * - No getResult() needed - observer has no mutable state to retrieve
 * - Closures capture immutable values; per-manifest state (startedAt) is in hook closures
 * - When run completes and hooks are no longer referenced, closures are GC'd
 */
export interface ConversationObserverHandle {
  /**
   * The conversation ID (created or existing).
   * Available immediately after factory returns.
   */
  readonly conversationId: ConversationId;

  /**
   * The observer instance to pass to AgentRunConfig.observers.
   * Create a fresh handle for each agent run.
   */
  readonly observer: AgentObserver;
}

/**
 * Creates a conversation observer that tracks agent runs as conversation items.
 *
 * STATELESS DESIGN:
 * - Factory performs async init (conversation creation, turn index query)
 * - Observer's createHooks() returns closures that capture immutable init values
 * - Per-manifest state (startedAt) is captured in each hook closure
 * - No cleanup needed - closures are GC'd when hooks are no longer referenced
 *
 * Behavior:
 * - Factory: Creates conversation (if needed) and queries turn index
 * - onAgentStart/onAgentResume: Captures startedAt in closure (per-manifest)
 * - Terminal hooks: Inserts item immediately with startedAt/finishedAt
 *
 * @example
 * ```typescript
 * const handleResult = await createConversationObserver(ctx, {
 *   conversationsService,
 *   userId,
 *   conversationId, // optional - creates new if omitted
 * });
 *
 * if (handleResult.isErr()) {
 *   return err(handleResult.error);
 * }
 *
 * const { observer, conversationId } = handleResult.value;
 *
 * const config: AgentRunConfig = {
 *   rootManifestId,
 *   manifests,
 *   observers: [observer],
 * };
 *
 * await agentService.run(ctx, config, request);
 * ```
 */
export async function createConversationObserver(
  ctx: Context,
  config: ConversationObserverConfig,
): Promise<Result<ConversationObserverHandle, AppError>> {
  const { conversationsService, userId } = config;

  // Initialize conversation upfront - fail fast if this fails
  const convResult = await ensureConversation(
    ctx,
    {
      userId,
      existingConversationId: config.conversationId,
    },
    { conversationsService },
  );

  if (convResult.isErr()) {
    return err(convResult.error);
  }

  const { conversationId } = convResult.value;

  // Get next turn index using the service method
  const turnResult = await conversationsService.getNextTurnIndex(
    ctx,
    conversationId,
    userId,
  );

  if (turnResult.isErr()) {
    return err(turnResult.error);
  }

  const turnIndex = turnResult.value;

  // Create stateless observer - all state is in closures
  const observer: AgentObserver = Object.freeze({
    createHooks(
      observerContext: AgentObserverContext,
    ): Result<Partial<AgentManifestHooks>, AppError> {
      return buildConversationHooks(
        {
          conversationId,
          userId,
          turnIndex,
          observerContext,
        },
        { conversationsService },
      );
    },
  });

  return ok(
    Object.freeze({
      conversationId,
      observer,
    }),
  );
}
