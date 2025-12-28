import type { AgentState } from '@backend/agents/domain';
import type {
  AgentEvent,
  AgentRunId,
  AgentRunResult,
} from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import type { AppError } from '@core/errors';
import { ok, type Result } from 'neverthrow';
import type {
  StreamAgentFinalResult,
  StreamAgentItem,
} from '../../streamAgent';

/**
 * Collects all items from a streaming agent generator.
 *
 * Handles both:
 * - orchestrateAgentRun: yields Result<AgentEvent, AppError>, returns Result<AgentRunResult, AppError>
 * - streamAgent: yields StreamAgentItem which includes { type: 'final', result: ... }
 *
 * Uses manual iteration to capture the generator's return value (which for-await-of ignores).
 */
export async function collectStreamItems(
  generator: AsyncGenerator<
    Result<AgentEvent, AppError> | StreamAgentItem,
    Result<AgentRunResult, AppError>
  >,
): Promise<{
  events: AgentEvent[];
  errors: AppError[];
  finalResult: StreamAgentFinalResult | undefined;
}> {
  const events: AgentEvent[] = [];
  const errors: AppError[] = [];
  let finalResult: StreamAgentFinalResult | undefined;

  // Manual iteration to capture the return value (for-await-of ignores it)
  while (true) {
    const next = await generator.next();

    if (next.done) {
      // Generator is done - check if it returned a value
      // orchestrateAgentRun returns Result<AgentRunResult, AppError>
      if (next.value && 'isOk' in next.value) {
        finalResult = {
          type: 'final',
          result: next.value as Result<AgentRunResult, AppError>,
        };
      }
      break;
    }

    const item = next.value;

    // Handle StreamAgentFinalResult format (from streamAgent)
    if ('type' in item && item.type === 'final') {
      finalResult = item as StreamAgentFinalResult;
    }

    // Handle Result<AgentEvent, AppError> format
    else if ('isOk' in item) {
      if (item.isOk()) {
        events.push(item.value);
      } else {
        errors.push(item.error);
      }
    }
  }

  return { events, errors, finalResult };
}

/**
 * Collects remaining items from a partially consumed generator.
 */
export async function collectRemainingItems(
  generator: AsyncGenerator<
    Result<AgentEvent, AppError>,
    Result<AgentRunResult, AppError>
  >,
): Promise<{
  events: AgentEvent[];
  errors: AppError[];
  finalResult: StreamAgentFinalResult | undefined;
}> {
  return collectStreamItems(generator);
}

/**
 * Extracts stateId from an agent-started event result.
 * Throws if the event is not an agent-started event.
 */
export function extractStateIdFromStartedEvent(
  eventResult: Result<AgentEvent, AppError>,
): AgentRunId {
  if (eventResult.isErr()) {
    throw new Error(`Expected ok result: ${eventResult.error.message}`);
  }
  const event = eventResult.value;
  if (event.type !== 'agent-started') {
    throw new Error(`Expected agent-started event, got: ${event.type}`);
  }
  return event.stateId;
}

/**
 * Finds and extracts stateId from an agent-started event in a list of events.
 * Throws if no agent-started event is found.
 */
export function findStateIdFromEvents(events: AgentEvent[]): AgentRunId {
  const startedEvent = events.find((e) => e.type === 'agent-started');
  if (!startedEvent || startedEvent.type !== 'agent-started') {
    throw new Error('No agent-started event found in events');
  }
  return startedEvent.stateId;
}

/**
 * Delay utility for testing.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asserts final result exists and is ok, returning the unwrapped result.
 * Throws if finalResult is undefined or contains an error.
 */
export function assertFinalResultOk(
  finalResult: StreamAgentFinalResult | undefined,
): AgentRunResult {
  if (!finalResult) {
    throw new Error('Expected finalResult to be defined');
  }
  if (finalResult.result.isErr()) {
    throw new Error(`Expected ok result: ${finalResult.result.error.message}`);
  }
  return finalResult.result.value;
}

/**
 * Extracts child state IDs from suspension stacks in an agent state.
 * Excludes the parent's own state ID (same logic as extractChildStateIdsFromStacks).
 */
export function extractChildStateIdsFromSuspensionStacks(
  state: AgentState,
): AgentRunId[] {
  const childIds = new Set<AgentRunId>();
  for (const stack of state.suspensionStacks ?? []) {
    for (const entry of stack.agents) {
      // Exclude the parent's own state ID
      if (entry.stateId && entry.stateId !== state.id) {
        childIds.add(entry.stateId);
      }
    }
  }
  return [...childIds];
}

/**
 * Creates a slow completion mock that delays between parts.
 * Useful for testing cancellation during execution.
 */
export function createSlowCompletionMock(
  totalDelayMs: number,
  parts: StreamPart[],
): () => AsyncGenerator<Result<StreamPart, AppError>> {
  const delayPerPart = Math.floor(totalDelayMs / parts.length);
  return async function* () {
    for (const part of parts) {
      await delay(delayPerPart);
      yield ok(part);
    }
  };
}

/**
 * Creates an async generator that yields stream parts with no delay.
 */
export function createMockStreamCompletion(
  parts: StreamPart[],
): () => AsyncGenerator<Result<StreamPart, AppError>> {
  return async function* () {
    for (const part of parts) {
      yield ok(part);
    }
  };
}

/**
 * Creates a mock stream completion that returns multiple sequences.
 * Each call to streamCompletion returns the next sequence.
 */
export function createMockStreamCompletionSequence(
  sequences: StreamPart[][],
): () => AsyncGenerator<Result<StreamPart, AppError>> {
  let callIndex = 0;

  return () => {
    const parts = sequences[callIndex] ?? [];
    callIndex++;

    async function* generate() {
      for (const part of parts) {
        yield ok(part);
      }
    }

    return generate();
  };
}
