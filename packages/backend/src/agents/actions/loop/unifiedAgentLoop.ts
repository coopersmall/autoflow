import type { AgentRunState } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import { buildStreamingToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentId,
  AgentManifest,
  StreamableEventType,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type {
  FinishReason,
  PrepareStepResult,
  RequestToolResultPart,
  StepResult,
  StreamPart,
  TextResponse,
  ToolCallPart,
  Usage,
} from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { timeout } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildStreamIterationMessages } from '../messages/buildStreamIterationMessages';
import {
  getAllowedEventTypes,
  type TransformContext,
  transformStreamPart,
} from '../streaming/transformStreamPart';
import { buildAgentResult } from '../utils/buildAgentResult';
import { shouldStop } from '../utils/shouldStop';
import { handleOutputValidation } from './handleOutputValidation';
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

// LoopResult is now imported from domain (see imports at top of file)

/**
 * Unified agent execution loop - always yields events.
 * This is the single source of truth for agent execution.
 *
 * Used by:
 * - executeAgentLoop (consumes generator, returns final result)
 * - streamAgentLoop (yields all events, returns final result)
 * - runAgent via executeAgentLoop
 * - streamAgent via streamAgentLoop
 *
 * Key differences from the old separate implementations:
 * - Always uses streamCompletion (not completion) internally
 * - Always uses streamExecuteToolCalls for tool execution
 * - Yields events during both LLM streaming and tool execution
 * - Non-streaming callers simply consume and discard events
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

  const { startTime, timeoutMs, tools, toolsMap } = state;
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

    // 2. Call prepareStep hook (can modify messages, toolChoice, activeTools)
    let prepareResult: PrepareStepResult | undefined;
    if (manifest.hooks.prepareStep) {
      prepareResult = await manifest.hooks.prepareStep({
        stepNumber,
        steps,
        messages,
        provider: manifest.config.provider.provider,
        model: manifest.config.provider.model,
      });
      if (prepareResult?.messages) {
        messages = prepareResult.messages;
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
      prepareResult,
      allowedEventTypes,
      deps,
    });

    if (streamResult.isErr()) {
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
      parentManifestId,
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
    // Note: handleOutputValidation only uses response.text, response.toolCalls, and response.reasoning
    // We construct a minimal object with these fields to avoid duplicating validation logic
    const validationAction = handleOutputValidation({
      response: buildMinimalTextResponse({
        text,
        toolCalls,
      }),
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
    if (manifest.hooks.onStepFinish) {
      await manifest.hooks.onStepFinish(stepResult, ctx);
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
// Helper functions
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
 * This avoids duplicating output validation logic between streaming and non-streaming paths.
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

interface StreamCompletionStepParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly manifestId: AgentId;
  readonly parentManifestId: AgentId | undefined;
  readonly stepNumber: number;
  readonly messages: AgentRunState['messages'];
  readonly tools: AgentRunState['tools'];
  readonly prepareResult: PrepareStepResult | undefined;
  readonly allowedEventTypes: Set<StreamableEventType>;
  readonly deps: UnifiedAgentLoopDeps;
}

interface StreamCompletionStepResult {
  readonly toolCalls: ToolCallPart[];
  readonly finishReason: FinishReason;
  readonly approvalRequests: ToolApprovalSuspension[];
  readonly text: string;
  readonly usage: Usage;
}

/**
 * Streams a single LLM completion step, yielding events as they arrive.
 * Returns the accumulated state after the step completes.
 */
async function* streamCompletionStep(
  params: StreamCompletionStepParams,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<StreamCompletionStepResult, AppError>
> {
  const {
    ctx,
    manifest,
    manifestId,
    parentManifestId,
    stepNumber,
    messages,
    tools,
    prepareResult,
    allowedEventTypes,
    deps,
  } = params;

  const transformContext: TransformContext = {
    manifestId,
    parentManifestId,
    stepNumber,
    allowedEventTypes,
  };

  // Accumulated state during streaming
  const toolCalls: ToolCallPart[] = [];
  const approvalRequests: ToolApprovalSuspension[] = [];
  let finishReason: FinishReason = 'unknown';
  let text = '';
  let usage: Usage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  // Stream the completion
  const stream = deps.completionsGateway.streamCompletion(
    ctx,
    manifest.config.provider,
    {
      messages,
      tools,
      stopWhen: [{ type: 'stepCount', stepCount: 1 }],
      toolChoice: prepareResult?.toolChoice,
      activeTools: prepareResult?.activeTools,
      mcpServers: manifest.config.mcpServers,
    },
  );

  for await (const partResult of stream) {
    if (partResult.isErr()) {
      return err(partResult.error);
    }

    const part = partResult.value;

    // Transform and yield as AgentEvent if applicable
    const event = transformStreamPart(part, transformContext);
    if (event) {
      yield ok(event);
    }

    // Accumulate state based on part type
    accumulateStreamPart(part, {
      toolCalls,
      approvalRequests,
      onFinishReason: (reason) => {
        finishReason = reason;
      },
      onText: (delta) => {
        text += delta;
      },
      onUsage: (u) => {
        usage = u;
      },
    });
  }

  return ok({
    toolCalls,
    finishReason,
    approvalRequests,
    text,
    usage,
  });
}

interface AccumulateCallbacks {
  readonly toolCalls: ToolCallPart[];
  readonly approvalRequests: ToolApprovalSuspension[];
  readonly onFinishReason: (reason: FinishReason) => void;
  readonly onText: (delta: string) => void;
  readonly onUsage: (usage: Usage) => void;
}

/**
 * Accumulates stream part data into the provided collections and callbacks.
 */
function accumulateStreamPart(
  part: StreamPart,
  callbacks: AccumulateCallbacks,
): void {
  switch (part.type) {
    case 'tool-call':
      callbacks.toolCalls.push(part);
      break;

    case 'tool-approval-request':
      callbacks.approvalRequests.push({
        type: 'tool-approval',
        approvalId: part.approvalId,
        toolName: part.toolCall.toolName,
        toolArgs: part.toolCall.input,
        description: `Tool ${part.toolCall.toolName} requires approval`,
      });
      break;

    case 'text-delta':
      callbacks.onText(part.text);
      break;

    case 'finish-step':
      callbacks.onFinishReason(part.finishReason);
      callbacks.onUsage(part.usage);
      break;

    // Other parts don't affect accumulated state
    default:
      break;
  }
}

interface BuildStepResultParams {
  readonly text: string;
  readonly toolCalls: readonly ToolCallPart[];
  readonly toolResults: readonly RequestToolResultPart[];
  readonly finishReason: FinishReason;
  readonly usage: Usage;
}

/**
 * Builds a StepResult from streaming accumulated state.
 */
function buildStepResult(params: BuildStepResultParams): StepResult {
  const { text, toolCalls, toolResults, finishReason, usage } = params;

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
    toolResults: toolResults.map((tr) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      result: tr.output,
    })),
    finishReason,
    usage,
    request: {
      body: undefined,
    },
    response: {
      timestamp: now,
      id: `step-${now.getTime()}`,
      modelId: '',
      isContinued: false,
    },
  };
}

// =============================================================================
// Utility functions
// =============================================================================
