import type { AgentManifestHooks } from '@backend/agents/hooks/AgentManifestHooks';
import type { AgentObserverContext } from '@backend/agents/observers/AgentObserverContext';
import type { IConversationsService } from '@backend/conversation';
import type { ConversationId } from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

export interface BuildConversationHooksParams {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
  readonly turnIndex: number;
  readonly observerContext: AgentObserverContext;
}

export interface BuildConversationHooksDeps {
  readonly conversationsService: IConversationsService;
}

/**
 * Builds lifecycle hooks for the conversation observer.
 *
 * Each call creates a fresh set of hooks with their own closure-captured state (startedAt).
 * This is called once per manifest when applying observers.
 *
 * Note: Steps are recorded as empty arrays because the AI completion StepResult schema
 * differs from the conversation Step schema. Full step conversion would require mapping
 * between these schemas.
 *
 * @param params - Parameters including conversationId, userId, turnIndex, and observer context
 * @param deps - Dependencies including the conversations service
 * @returns Partial hooks to be merged with manifest hooks
 */
export function buildConversationHooks(
  params: BuildConversationHooksParams,
  deps: BuildConversationHooksDeps,
): Result<Partial<AgentManifestHooks>, AppError> {
  const { conversationId, userId, turnIndex, observerContext } = params;
  const { conversationsService } = deps;
  const { providerConfig } = observerContext;

  // Each manifest gets its own startedAt captured in closure
  let startedAt: Date | undefined;

  return ok({
    onAgentStart: async (_ctx, _hookParams) => {
      startedAt = new Date();
      return ok(undefined);
    },

    onAgentResume: async (_ctx, _hookParams) => {
      startedAt = new Date();
      return ok(undefined);
    },

    onAgentComplete: async (ctx, hookParams) => {
      if (startedAt === undefined) {
        return err(
          internalError(
            'onAgentComplete called before onAgentStart/onAgentResume',
          ),
        );
      }

      const appendResult = await conversationsService.appendItem(
        ctx,
        conversationId,
        userId,
        {
          type: 'agent',
          schemaVersion: 1,
          agentId: String(observerContext.manifestId),
          provider: providerConfig.provider,
          model: providerConfig.model,
          turnIndex,
          startedAt,
          finishedAt: new Date(),
          result: {
            status: 'complete',
            steps: [],
            totalUsage: hookParams.result.totalUsage,
            finishReason: hookParams.result.finishReason,
          },
        },
      );

      if (appendResult.isErr()) {
        return err(appendResult.error);
      }

      return ok(undefined);
    },

    onAgentError: async (ctx, hookParams) => {
      if (startedAt === undefined) {
        return err(
          internalError(
            'onAgentError called before onAgentStart/onAgentResume',
          ),
        );
      }

      const appendResult = await conversationsService.appendItem(
        ctx,
        conversationId,
        userId,
        {
          type: 'agent',
          schemaVersion: 1,
          agentId: String(observerContext.manifestId),
          provider: providerConfig.provider,
          model: providerConfig.model,
          turnIndex,
          startedAt,
          finishedAt: new Date(),
          result: {
            status: 'error',
            steps: [],
            error: {
              message: hookParams.error.message,
              code: hookParams.error.code,
            },
          },
        },
      );

      if (appendResult.isErr()) {
        return err(appendResult.error);
      }

      return ok(undefined);
    },

    onAgentCancelled: async (ctx, _hookParams) => {
      if (startedAt === undefined) {
        return err(
          internalError(
            'onAgentCancelled called before onAgentStart/onAgentResume',
          ),
        );
      }

      const appendResult = await conversationsService.appendItem(
        ctx,
        conversationId,
        userId,
        {
          type: 'agent',
          schemaVersion: 1,
          agentId: String(observerContext.manifestId),
          provider: providerConfig.provider,
          model: providerConfig.model,
          turnIndex,
          startedAt,
          finishedAt: new Date(),
          result: {
            status: 'aborted',
            steps: [],
          },
        },
      );

      if (appendResult.isErr()) {
        return err(appendResult.error);
      }

      return ok(undefined);
    },
  });
}
