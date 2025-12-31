import type {
  AgentManifest,
  AgentRunOptions,
  AgentRunState,
  ParentAgentContext,
} from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentEvent,
  AgentRunId,
  AgentRunResult,
  Suspension,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { clearCancellation } from '../cancellation/clearCancellation';
import {
  type CreateAgentStateDeps,
  createAgentState,
} from '../state/createAgentState';
import {
  type FinalizeAgentStateDeps,
  finalizeAgentState,
} from '../state/finalizeAgentState';
import { updateToRunningState } from '../state/updateToRunningState';
import { buildAgentRunResult } from './buildAgentRunResult';
import { streamAgentLoop } from './streamAgentLoop';

export interface ExecuteAgentParams {
  readonly ctx: Context;
  readonly stateId: AgentRunId;
  readonly manifest: AgentManifest;
  readonly state: AgentRunState;
  readonly context?: Record<string, unknown>;
  readonly previousElapsedMs: number;
  /** true for 'start' (new state), false for 'continue' (existing state) */
  readonly isNewState: boolean;
  /** Parent agent context when invoked as a sub-agent */
  readonly parentContext?: ParentAgentContext;
  /** Resolved suspensions when resuming from suspension */
  readonly resolvedSuspensions?: readonly Suspension[];
  /**
   * Cleanup function to release resources (e.g., MCP clients) after execution.
   * Called in finally block - should not throw.
   */
  readonly cleanup?: () => Promise<void>;
}

export interface ExecuteAgentDeps
  extends CreateAgentStateDeps,
    FinalizeAgentStateDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
  readonly agentRunLock: IAgentRunLock;
  readonly cancellationCache: IAgentCancellationCache;
}

/**
 * Core agent execution with state management.
 *
 * Handles:
 * - Lock acquisition/release
 * - Emits agent-started event (with stateId for consumers)
 * - Create or update running state
 * - Delegates to streamAgentLoop for actual execution
 * - Clears cancellation signal
 * - Finalizes state
 * - Yields lifecycle events (agent-started, agent-done, agent-error, agent-cancelled, agent-suspended)
 *
 * This is the state management layer that sits between the orchestration layer
 * (orchestrateAgentRun) and the pure execution layer (streamAgentLoop).
 */
export async function* executeAgent(
  params: ExecuteAgentParams,
  deps: ExecuteAgentDeps,
  options?: AgentRunOptions,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  const {
    ctx,
    stateId,
    manifest,
    state,
    context,
    previousElapsedMs,
    isNewState,
    parentContext,
    resolvedSuspensions,
    cleanup,
  } = params;
  const manifestId = manifest.config.id;

  // 1. Acquire lock
  const handleResult = await deps.agentRunLock.acquire(ctx, stateId);
  if (handleResult.isErr()) {
    return err(handleResult.error);
  }

  const handle = handleResult.value;
  if (handle === null) {
    // Lock not acquired - agent is already running
    // Note: No hooks are called in this case
    return ok({ status: 'already-running', runId: stateId });
  }

  try {
    // 2. Create or update running state FIRST (before hooks)
    // This ensures state exists when onAgentStart/onAgentResume hook fires
    if (isNewState) {
      const createResult = await createAgentState(
        { ctx, stateId, manifest, messages: state.messages, context },
        deps,
        options,
      );
      if (createResult.isErr()) {
        return err(createResult.error);
      }
    } else {
      const updateResult = await updateToRunningState(
        ctx,
        stateId,
        deps,
        options,
      );
      if (updateResult.isErr()) {
        return err(updateResult.error);
      }
    }

    // 3. Call appropriate lifecycle hook (state now exists and can be looked up)
    if (isNewState) {
      // Fresh start - call onAgentStart
      if (manifest.hooks?.onAgentStart) {
        const startResult = await manifest.hooks.onAgentStart(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (startResult.isErr()) {
          // Hook failed - emit error and return
          yield ok({
            type: 'agent-error',
            manifestId,
            parentManifestId: parentContext?.parentManifestId,
            timestamp: Date.now(),
            error: {
              code: startResult.error.code,
              message: startResult.error.message,
            },
          });
          return err(startResult.error);
        }
      }
    } else {
      // Resume from suspension - call onAgentResume
      if (manifest.hooks?.onAgentResume) {
        const resumeResult = await manifest.hooks.onAgentResume(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          resolvedSuspensions: [...(resolvedSuspensions ?? [])],
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (resumeResult.isErr()) {
          // Hook failed - emit error and return
          yield ok({
            type: 'agent-error',
            manifestId,
            parentManifestId: parentContext?.parentManifestId,
            timestamp: Date.now(),
            error: {
              code: resumeResult.error.code,
              message: resumeResult.error.message,
            },
          });
          return err(resumeResult.error);
        }
      }
    }

    // 4. Emit agent-started event (after hook, so hook can veto)
    yield ok({
      type: 'agent-started',
      manifestId,
      parentManifestId: parentContext?.parentManifestId,
      timestamp: Date.now(),
      stateId,
    });

    // 5. Execute loop, yielding events
    let loopResult: LoopResult;
    const loopGenerator = streamAgentLoop(
      { ctx, manifest, state, previousElapsedMs },
      { completionsGateway: deps.completionsGateway },
    );

    while (true) {
      const next = await loopGenerator.next();
      if (next.done) {
        if (next.value.isErr()) {
          // Check if this was an abort (cancellation)
          if (ctx.signal.aborted) {
            loopResult = {
              status: 'cancelled',
              finalState: state,
            };
          } else {
            // Finalize with error state
            await finalizeAgentState(
              {
                ctx,
                stateId,
                manifest,
                context,
                loopResult: {
                  status: 'error',
                  error: next.value.error,
                  finalState: state,
                },
                previousElapsedMs,
              },
              deps,
              options,
            );

            // Call onAgentError hook
            if (manifest.hooks?.onAgentError) {
              await manifest.hooks.onAgentError(ctx, {
                manifestId,
                manifestVersion: manifest.config.version,
                stateId,
                error: {
                  code: next.value.error.code,
                  message: next.value.error.message,
                },
                parentManifestId: parentContext?.parentManifestId,
                parentManifestVersion: parentContext?.parentManifestVersion,
                toolCallId: parentContext?.toolCallId,
              });
            }

            yield ok({
              type: 'agent-error',
              manifestId,
              parentManifestId: parentContext?.parentManifestId,
              timestamp: Date.now(),
              error: {
                code: next.value.error.code,
                message: next.value.error.message,
              },
            });

            return err(next.value.error);
          }
        } else {
          loopResult = next.value.value;
        }
        break;
      }
      yield next.value; // Pass through streaming events
    }

    // 6. Clear cancellation signal (best effort - ignore errors)
    await clearCancellation(ctx, stateId, deps);

    // 7. Finalize state
    const finalizeResult = await finalizeAgentState(
      { ctx, stateId, manifest, context, loopResult, previousElapsedMs },
      deps,
      options,
    );
    if (finalizeResult.isErr()) {
      return err(finalizeResult.error);
    }

    // 8. Call terminal lifecycle hooks and yield events based on outcome
    if (loopResult.status === 'complete') {
      // Call onAgentComplete hook
      if (manifest.hooks?.onAgentComplete) {
        const hookResult = await manifest.hooks.onAgentComplete(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          result: loopResult.result,
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (hookResult.isErr()) {
          return err(hookResult.error);
        }
      }

      yield ok({
        type: 'agent-done',
        manifestId,
        parentManifestId: parentContext?.parentManifestId,
        timestamp: Date.now(),
        result: loopResult.result,
      });
    } else if (loopResult.status === 'suspended') {
      // Call onAgentSuspend hook
      if (manifest.hooks?.onAgentSuspend) {
        const hookResult = await manifest.hooks.onAgentSuspend(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          suspensions: loopResult.suspensions,
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (hookResult.isErr()) {
          return err(hookResult.error);
        }
      }

      for (const suspension of loopResult.suspensions) {
        yield ok({
          type: 'agent-suspended',
          manifestId,
          parentManifestId: parentContext?.parentManifestId,
          timestamp: Date.now(),
          suspension,
          stateId,
        });
      }
    } else if (loopResult.status === 'cancelled') {
      // Call onAgentCancelled hook
      if (manifest.hooks?.onAgentCancelled) {
        const hookResult = await manifest.hooks.onAgentCancelled(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          reason: 'User cancelled',
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (hookResult.isErr()) {
          return err(hookResult.error);
        }
      }

      yield ok({
        type: 'agent-cancelled',
        manifestId,
        parentManifestId: parentContext?.parentManifestId,
        timestamp: Date.now(),
      });
    } else if (loopResult.status === 'error') {
      // Call onAgentError hook
      if (manifest.hooks?.onAgentError) {
        const hookResult = await manifest.hooks.onAgentError(ctx, {
          manifestId,
          manifestVersion: manifest.config.version,
          stateId,
          error: {
            code: loopResult.error.code,
            message: loopResult.error.message,
          },
          parentManifestId: parentContext?.parentManifestId,
          parentManifestVersion: parentContext?.parentManifestVersion,
          toolCallId: parentContext?.toolCallId,
        });
        if (hookResult.isErr()) {
          return err(hookResult.error);
        }
      }

      yield ok({
        type: 'agent-error',
        manifestId,
        parentManifestId: parentContext?.parentManifestId,
        timestamp: Date.now(),
        error: {
          code: loopResult.error.code,
          message: loopResult.error.message,
        },
      });
    }

    // 9. Return final result
    return buildAgentRunResult(loopResult, stateId, manifest);
  } finally {
    // 10. Cleanup resources (e.g., close MCP clients)
    if (cleanup) {
      await cleanup();
    }

    // 11. Release lock (best effort - TTL is safety net for client disconnect)
    await handle.release();
  }
}
