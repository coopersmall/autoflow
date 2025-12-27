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

  // Interleave events from all generators
  yield* interleaveGenerators(states);

  // Build results from completed generators
  return buildStreamingResults(states);
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

/**
 * Interleaves events from multiple generators, yielding as they arrive.
 *
 * Uses Promise.race to poll all active generators simultaneously,
 * yielding events from whichever generator produces one first.
 * Continues until all generators are done.
 */
async function* interleaveGenerators(
  states: GeneratorState[],
): AsyncGenerator<Result<AgentEvent, AppError>, void> {
  // Get initial active states (not already done)
  const activeStates = states.filter((s) => !s.done);

  if (activeStates.length === 0) {
    return;
  }

  // Map to track pending promises for each state
  type PendingResult = {
    state: GeneratorState;
    result: IteratorResult<Result<AgentEvent, AppError>, AgentToolResult>;
  };

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
    // Wait for any generator to produce a value
    const { state, result } = await Promise.race(pendingPromises.values());

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
}

/**
 * Builds ExecuteToolCallsResult from the completed generator states.
 */
function buildStreamingResults(
  states: GeneratorState[],
): ExecuteToolCallsResult {
  const results: StreamToolCallResult[] = states.map((state) => {
    const { toolCall, result } = state;

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
