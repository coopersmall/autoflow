import type { AgentRunOptions, AgentRunState } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentEvent,
  AgentManifest,
  AgentRunId,
  AgentRunResult,
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
    return ok({ status: 'already-running', runId: stateId });
  }

  try {
    // 2. Emit agent-started event immediately (provides stateId to consumers)
    yield ok({
      type: 'agent-started',
      manifestId,
      parentManifestId: undefined,
      timestamp: Date.now(),
      stateId,
    });

    // 3. Create or update running state
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

    // 4. Execute loop, yielding events
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

            yield ok({
              type: 'agent-error',
              manifestId,
              parentManifestId: undefined,
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

    // 5. Clear cancellation signal (best effort - ignore errors)
    await clearCancellation(ctx, stateId, deps);

    // 6. Finalize state
    const finalizeResult = await finalizeAgentState(
      { ctx, stateId, manifest, context, loopResult, previousElapsedMs },
      deps,
      options,
    );
    if (finalizeResult.isErr()) {
      return err(finalizeResult.error);
    }

    // 7. Yield lifecycle event based on outcome
    if (loopResult.status === 'complete') {
      yield ok({
        type: 'agent-done',
        manifestId,
        parentManifestId: undefined,
        timestamp: Date.now(),
        result: loopResult.result,
      });
    } else if (loopResult.status === 'suspended') {
      for (const suspension of loopResult.suspensions) {
        yield ok({
          type: 'agent-suspended',
          manifestId,
          parentManifestId: undefined,
          timestamp: Date.now(),
          suspension,
          stateId,
        });
      }
    } else if (loopResult.status === 'cancelled') {
      yield ok({
        type: 'agent-cancelled',
        manifestId,
        parentManifestId: undefined,
        timestamp: Date.now(),
      });
    } else if (loopResult.status === 'error') {
      yield ok({
        type: 'agent-error',
        manifestId,
        parentManifestId: undefined,
        timestamp: Date.now(),
        error: {
          code: loopResult.error.code,
          message: loopResult.error.message,
        },
      });
    }

    // 8. Return final result
    return buildAgentRunResult(loopResult, stateId, manifest);
  } finally {
    // 9. Release lock (best effort - TTL is safety net for client disconnect)
    await handle.release();
  }
}
