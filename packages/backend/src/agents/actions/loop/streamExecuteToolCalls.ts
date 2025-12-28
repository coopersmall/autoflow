import type { SuspendedBranch } from '@backend/agents/domain/execution';
import type { StreamingToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentId,
  AgentRunId,
  AgentToolResult,
  CompletedAgentToolResult,
  Suspension,
  SuspensionStack,
} from '@core/domain/agents';
import type {
  Message,
  RequestToolResultPart,
  ToolCall,
  ToolWithExecution,
} from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { convertAgentToolResultForLLM } from '../tools/convertAgentToolResultForLLM';
import type { ExecuteToolCallsResult } from './executeToolCalls';

/**
 * Parameters for streaming tool execution.
 */
export interface StreamExecuteToolCallsParams {
  /** Tool calls from the LLM response */
  readonly toolCalls: ToolCall[];
  /** Map of tool name to tool definition for lookup */
  readonly toolsMap: Map<string, ToolWithExecution>;
  /** Streaming tool execution harness (with middleware) */
  readonly harness: StreamingToolExecutionHarness;
  /** Request context for cancellation */
  readonly ctx: Context;
  /** Current conversation messages */
  readonly messages: Message[];
  /** Current step number in the agent loop */
  readonly stepNumber: number;
  /** ID of the agent executing these tools (for event attribution) */
  readonly manifestId: AgentId;
  /** ID of the parent agent if this is a sub-agent (for event attribution) */
  readonly parentManifestId?: AgentId;
}

/**
 * Internal state for tracking a generator during parallel interleaving.
 */
interface GeneratorState {
  readonly toolCall: ToolCall;
  readonly generator: AsyncGenerator<
    Result<AgentEvent, AppError>,
    AgentToolResult
  >;
  done: boolean;
  result?: AgentToolResult;
}

/**
 * Result of a single tool call execution.
 */
type StreamToolCallResult =
  | {
      type: 'completed';
      toolCall: ToolCall;
      result: CompletedAgentToolResult;
    }
  | {
      type: 'suspended';
      toolCallId: string;
      childStateId: AgentRunId;
      childManifestId: AgentId;
      childManifestVersion: string;
      suspensions: Suspension[];
      childStacks: SuspensionStack[];
    }
  | {
      type: 'unknown-tool';
      toolCall: ToolCall;
    };

/**
 * Streaming tool execution - yields events from tool execution.
 * Runs tools in parallel and interleaves their events as they arrive.
 *
 * This function:
 * 1. Creates generators for each tool call
 * 2. Polls all active generators in parallel
 * 3. Yields events as they arrive from any generator
 * 4. Collects final results when generators complete
 * 5. Returns the same ExecuteToolCallsResult structure as executeToolCalls
 */
export async function* streamExecuteToolCalls(
  params: StreamExecuteToolCallsParams,
): AsyncGenerator<Result<AgentEvent, AppError>, ExecuteToolCallsResult> {
  const {
    toolCalls,
    toolsMap,
    harness,
    ctx,
    messages,
    stepNumber,
    manifestId,
    parentManifestId,
  } = params;

  // Handle empty tool calls case
  if (toolCalls.length === 0) {
    return {
      type: 'completed',
      toolResultParts: [],
    };
  }

  // Create generator states for each tool call
  const states: GeneratorState[] = [];

  for (const toolCall of toolCalls) {
    const tool = toolsMap.get(toolCall.toolName);

    if (!tool) {
      // Unknown tool - no generator needed, we'll handle this in results
      states.push({
        toolCall,
        generator: createUnknownToolGenerator(),
        done: true,
        result: undefined,
      });
    } else {
      states.push({
        toolCall,
        generator: harness.execute(tool, toolCall, {
          ctx,
          messages,
          stepNumber,
          manifestId,
          parentManifestId,
        }),
        done: false,
      });
    }
  }

  // Interleave events from all generators, passing ctx for abort detection
  const { aborted } = yield* interleaveGenerators(states, ctx);

  // Build results from completed generators, marking incomplete ones as cancelled if aborted
  return buildStreamingResults(states, aborted);
}

/**
 * Creates a dummy generator for unknown tools.
 * This allows us to handle unknown tools uniformly with other tools.
 */
async function* createUnknownToolGenerator(): AsyncGenerator<
  Result<AgentEvent, AppError>,
  AgentToolResult
> {
  // No events to yield for unknown tools
  return {
    type: 'error',
    error: 'Unknown tool',
    code: 'UnknownTool',
    retryable: false,
  };
}

// Sentinel symbol to identify abort - cannot be confused with real results
const ABORTED = Symbol('aborted');

/**
 * Creates a promise that resolves when the abort signal fires.
 * Returns a sentinel value instead of rejecting for graceful handling.
 */
function createAbortPromise<T>(signal: AbortSignal, sentinel: T): Promise<T> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(sentinel);
    } else {
      signal.addEventListener('abort', () => resolve(sentinel), { once: true });
    }
  });
}

/**
 * Interleaves events from multiple generators, yielding as they arrive.
 *
 * Uses Promise.race to poll all active generators simultaneously,
 * yielding events from whichever generator produces one first.
 * Continues until all generators are done or abort is signaled.
 *
 * Abort detection is immediate via an abort promise in the race,
 * not polling-based. When abort is signaled:
 * 1. This function returns immediately with { aborted: true }
 * 2. Sub-agent contexts are aborted via linked abort signals
 * 3. In-flight tool operations continue until they check their signal
 */
async function* interleaveGenerators(
  states: GeneratorState[],
  ctx: Context,
): AsyncGenerator<Result<AgentEvent, AppError>, { aborted: boolean }> {
  // Get initial active states (not already done)
  const activeStates = states.filter((s) => !s.done);

  if (activeStates.length === 0) {
    return { aborted: false };
  }

  // Map to track pending promises for each state
  type PendingResult = {
    state: GeneratorState;
    result: IteratorResult<Result<AgentEvent, AppError>, AgentToolResult>;
  };

  // Create abort promise that resolves (not rejects) with sentinel
  const abortPromise = createAbortPromise(ctx.signal, ABORTED);

  // Create initial promises for all active generators
  const pendingPromises = new Map<GeneratorState, Promise<PendingResult>>();

  for (const state of activeStates) {
    pendingPromises.set(
      state,
      state.generator.next().then((result) => ({ state, result })),
    );
  }

  // Continue while there are pending promises
  while (pendingPromises.size > 0) {
    // Race between tool generators and abort signal
    const raceResult = await Promise.race([
      ...pendingPromises.values(),
      abortPromise,
    ]);

    // Check for abort sentinel
    if (raceResult === ABORTED) {
      // Exit immediately - sub-agents will detect abort via linked signals
      return { aborted: true };
    }

    // TypeScript narrowing: raceResult is PendingResult
    const { state, result } = raceResult;

    // Remove the completed promise
    pendingPromises.delete(state);

    if (result.done) {
      // Generator finished - store result and mark as done
      state.done = true;
      state.result = result.value;
    } else {
      // Yield the event
      yield result.value;

      // Create a new promise for the next value from this generator
      pendingPromises.set(
        state,
        state.generator.next().then((r) => ({ state, result: r })),
      );
    }
  }

  return { aborted: false };
}

/**
 * Builds ExecuteToolCallsResult from the completed generator states.
 *
 * @param states - Generator states with results
 * @param aborted - Whether execution was aborted (incomplete generators marked as cancelled)
 */
function buildStreamingResults(
  states: GeneratorState[],
  aborted: boolean,
): ExecuteToolCallsResult {
  const results: StreamToolCallResult[] = states.map((state) => {
    const { toolCall, result } = state;

    // Handle generators that didn't complete due to abort
    if (!state.done && aborted) {
      return {
        type: 'completed',
        toolCall,
        result: {
          type: 'error',
          error: 'Operation cancelled',
          code: 'Cancelled',
          retryable: false,
        } satisfies CompletedAgentToolResult,
      };
    }

    // Handle unknown tool case (generator was never started)
    if (result === undefined) {
      return {
        type: 'unknown-tool',
        toolCall,
      };
    }

    // Handle suspended tool
    if (result.type === 'suspended') {
      return {
        type: 'suspended',
        toolCallId: toolCall.toolCallId,
        childStateId: result.runId,
        childManifestId: result.manifestId,
        childManifestVersion: result.manifestVersion,
        suspensions: result.suspensions,
        childStacks: result.childStacks,
      };
    }

    // Handle completed tool (success or error)
    return {
      type: 'completed',
      toolCall,
      result,
    };
  });

  // Build the final result structure (same as executeToolCalls)
  const toolResultParts: RequestToolResultPart[] = [];
  const branches: SuspendedBranch[] = [];

  for (const result of results) {
    switch (result.type) {
      case 'unknown-tool':
        toolResultParts.push({
          type: 'tool-result',
          toolCallId: result.toolCall.toolCallId,
          toolName: result.toolCall.toolName,
          output: {
            type: 'error-text',
            value: `Unknown tool: ${result.toolCall.toolName}`,
          },
          isError: true,
        });
        break;

      case 'suspended':
        branches.push({
          toolCallId: result.toolCallId,
          childStateId: result.childStateId,
          childManifestId: result.childManifestId,
          childManifestVersion: result.childManifestVersion,
          suspensions: result.suspensions,
          childStacks: result.childStacks,
        });
        break;

      case 'completed':
        toolResultParts.push(
          convertAgentToolResultForLLM(result.toolCall, result.result),
        );
        break;
    }
  }

  if (branches.length > 0) {
    return {
      type: 'suspended',
      branches,
      completedToolResultParts: toolResultParts,
    };
  }

  return {
    type: 'completed',
    toolResultParts,
  };
}
