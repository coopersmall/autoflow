import type { AgentManifest, AgentRunState } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { OnStepStartResult } from '@backend/agents/hooks';
import { buildStreamingToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentEvent, AgentId } from '@core/domain/agents';
import type { TextResponse, ToolCallPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { timeout } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildStreamIterationMessages } from '../messages/buildStreamIterationMessages';
import { getAllowedEventTypes } from '../streaming/transformStreamPart';
import { buildAgentResult } from '../utils/buildAgentResult';
import { shouldStop } from '../utils/shouldStop';
import { buildStepResult } from './buildStepResult';
import { handleOutputValidation } from './handleOutputValidation';
import { streamCompletionStep } from './streamCompletionStep';
import { streamExecuteToolCalls } from './streamExecuteToolCalls';

export interface UnifiedAgentLoopDeps {
  readonly completionsGateway: ICompletionsGateway;
}

export interface UnifiedAgentLoopParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly state: AgentRunState;
  readonly previousElapsedMs?: number;
  readonly parentManifestId?: AgentId;
}

/**
 * Unified agent execution loop - always yields events.
 * This is the single source of truth for agent execution.
 *
 * Used by:
 * - executeAgentLoop (consumes generator, returns final result)
 * - streamAgentLoop (yields all events, returns final result)
 * - runAgent via executeAgentLoop
 * - streamAgent via streamAgentLoop
 */
export async function* unifiedAgentLoop(
  params: UnifiedAgentLoopParams,
  deps: UnifiedAgentLoopDeps,
): AsyncGenerator<Result<AgentEvent, AppError>, Result<LoopResult, AppError>> {
  const {
    ctx,
    manifest,
    state,
    previousElapsedMs = 0,
    parentManifestId,
  } = params;

  const { runId: stateId, startTime, timeoutMs, tools, toolsMap } = state;
  let { messages, steps, stepNumber, outputValidationRetries } = state;

  // Build streaming harness (handles all tool types including streaming sub-agents)
  const harness = buildStreamingToolExecutionHarness(manifest.config);

  // Get allowed event types from manifest config
  const allowedEventTypes = getAllowedEventTypes(
    manifest.config.streaming?.events,
  );
  const manifestId = manifest.config.id;

  // Main agent execution loop
  while (true) {
    // 0. Check for cancellation via abort signal
    if (ctx.signal.aborted) {
      return ok({
        status: 'cancelled',
        finalState: buildFinalState(
          state,
          messages,
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    // 1. Check timeout (includes elapsed time from previous runs)
    const currentElapsed = previousElapsedMs + (Date.now() - startTime);
    if (currentElapsed > timeoutMs) {
      return ok({
        status: 'error',
        error: timeout('Agent execution timeout', {
          metadata: { elapsedMs: currentElapsed, timeoutMs },
        }),
        finalState: buildFinalState(
          state,
          messages,
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    stepNumber++;

    // 2. Call onStepStart hook (can modify messages, toolChoice, activeTools)
    let stepStartResult: OnStepStartResult | undefined;
    if (manifest.hooks?.onStepStart) {
      const hookResult = await manifest.hooks.onStepStart(ctx, {
        stepNumber,
        steps,
        messages,
        provider: manifest.config.provider.provider,
        model: manifest.config.provider.model,
      });

      // Handle Result return - errors abort the run
      if (hookResult.isErr()) {
        return ok({
          status: 'error',
          error: hookResult.error,
          finalState: buildFinalState(
            state,
            messages,
            steps,
            stepNumber,
            outputValidationRetries,
          ),
        });
      }

      stepStartResult = hookResult.value;
      if (stepStartResult?.messages) {
        messages = [...stepStartResult.messages];
      }
    }

    // 3. Stream completion and yield events
    const streamResult = yield* streamCompletionStep({
      ctx,
      manifest,
      manifestId,
      parentManifestId,
      stepNumber,
      messages,
      tools,
      stepStartResult,
      allowedEventTypes,
      deps,
    });

    if (streamResult.isErr()) {
      // Check if error was due to cancellation (abort)
      if (ctx.signal.aborted) {
        return ok({
          status: 'cancelled',
          finalState: buildFinalState(
            state,
            messages,
            steps,
            stepNumber,
            outputValidationRetries,
          ),
        });
      }

      return ok({
        status: 'error',
        error: streamResult.error,
        finalState: buildFinalState(
          state,
          messages,
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    const { toolCalls, finishReason, approvalRequests, text, usage } =
      streamResult.value;

    // 4. Check for tool-approval-request (current agent's HITL)
    if (approvalRequests.length > 0) {
      const iterationMessages = buildStreamIterationMessages({
        text,
        toolCalls,
        toolResultParts: [],
      });

      return ok({
        status: 'suspended',
        suspensions: approvalRequests,
        subAgentBranches: [],
        completedToolResults: [],
        finalState: buildFinalState(
          state,
          [...messages, ...iterationMessages],
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    // 5. Execute tool calls via streaming harness (yields events from sub-agents)
    const execResult = yield* streamExecuteToolCalls({
      toolCalls,
      toolsMap,
      harness,
      ctx,
      messages,
      stepNumber,
      manifestId,
      manifestVersion: manifest.config.version,
      parentManifestId,
      stateId,
    });

    // 6. Yield tool-result events for completed tools
    const completedToolResults =
      execResult.type === 'completed'
        ? execResult.toolResultParts
        : execResult.completedToolResultParts;

    for (const toolResult of completedToolResults) {
      if (allowedEventTypes.has('tool-result')) {
        yield ok({
          type: 'tool-result',
          manifestId,
          parentManifestId,
          timestamp: Date.now(),
          stepNumber,
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          input: undefined, // RequestToolResultPart doesn't have input
          output: toolResult.output,
        });
      }
    }

    // 7. Handle sub-agent suspension (recursive signal from nested runAgent)
    if (execResult.type === 'suspended') {
      const iterationMessages = buildStreamIterationMessages({
        text,
        toolCalls,
        toolResultParts: [],
      });

      return ok({
        status: 'suspended',
        suspensions: [],
        subAgentBranches: execResult.branches,
        completedToolResults: execResult.completedToolResultParts,
        finalState: buildFinalState(
          state,
          [...messages, ...iterationMessages],
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    // 8. Validate output tool if called
    const validationAction = handleOutputValidation({
      response: buildMinimalTextResponse({ text, toolCalls }),
      outputToolConfig: manifest.config.outputTool,
      currentRetries: outputValidationRetries,
    });

    if (validationAction.action === 'error') {
      return err(validationAction.error);
    }

    if (validationAction.action === 'retry') {
      messages = [...messages, ...validationAction.retryMessages];
      outputValidationRetries++;
      continue;
    }

    // 9. Build step result for the steps array
    const stepResult = buildStepResult({
      text,
      toolCalls,
      toolResults: completedToolResults,
      finishReason,
      usage,
    });
    steps = [...steps, stepResult];

    // 10. Call onStepFinish hook
    if (manifest.hooks?.onStepFinish) {
      const finishResult = await manifest.hooks.onStepFinish(ctx, stepResult);
      if (finishResult.isErr()) {
        return ok({
          status: 'error',
          error: finishResult.error,
          finalState: buildFinalState(
            state,
            messages,
            steps,
            stepNumber,
            outputValidationRetries,
          ),
        });
      }
    }

    // 11. Check stopWhen conditions
    if (
      shouldStop({
        manifest,
        finishReason,
        steps,
        currentStepNumber: stepNumber,
      })
    ) {
      const iterationMessages = buildStreamIterationMessages({
        text,
        toolCalls,
        toolResultParts: completedToolResults,
      });

      return ok({
        status: 'complete',
        result: buildAgentResult(manifest, steps, finishReason),
        finalState: buildFinalState(
          state,
          [...messages, ...iterationMessages],
          steps,
          stepNumber,
          outputValidationRetries,
        ),
      });
    }

    // 12. Add assistant response and tool results to messages for next iteration
    const iterationMessages = buildStreamIterationMessages({
      text,
      toolCalls,
      toolResultParts: completedToolResults,
    });
    messages = [...messages, ...iterationMessages];
  }
}

// =============================================================================
// Local helpers (not extracted - only used here)
// =============================================================================

interface BuildMinimalTextResponseParams {
  readonly text: string;
  readonly toolCalls: readonly ToolCallPart[];
}

/**
 * Builds a minimal TextResponse for handleOutputValidation.
 *
 * handleOutputValidation only uses response.text, response.toolCalls, and response.reasoning,
 * so we construct a minimal object with these fields plus required fields with defaults.
 */
function buildMinimalTextResponse(
  params: BuildMinimalTextResponseParams,
): TextResponse {
  const { text, toolCalls } = params;
  const now = new Date();

  return {
    text,
    reasoning: [],
    files: [],
    sources: [],
    toolCalls: toolCalls.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      input: tc.input,
    })),
    toolResults: [],
    finishReason: 'unknown',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    totalUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    request: {
      body: undefined,
    },
    response: {
      timestamp: now,
      id: `validation-${now.getTime()}`,
      modelId: '',
      isContinued: false,
    },
    steps: [],
    content: [],
  };
}

/**
 * Builds final state for persistence (reduces duplication).
 */
function buildFinalState(
  state: AgentRunState,
  messages: AgentRunState['messages'],
  steps: AgentRunState['steps'],
  stepNumber: number,
  outputValidationRetries: number,
): AgentRunState {
  return {
    ...state,
    messages,
    steps,
    stepNumber,
    outputValidationRetries,
  };
}
