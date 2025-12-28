import { mock } from 'bun:test';
import type {
  StreamAgentFinalResult,
  StreamAgentItem,
} from '@backend/agents/actions/streamAgent';
import type { AgentState } from '@backend/agents/domain';
import { getMockedAgentCancellationCache } from '@backend/agents/infrastructure/cache/__mocks__/AgentCancellationCache.mock';
import { getMockedAgentStateCache } from '@backend/agents/infrastructure/cache/__mocks__/AgentStateCache.mock';
import { getMockedAgentRunLock } from '@backend/agents/infrastructure/lock/__mocks__/AgentRunLock.mock';
import { getMockedCompletionsGateway } from '@backend/ai/completions/__mocks__/CompletionsGateway.mock';
import { getMockedMCPService } from '@backend/ai/mcp/services/__mocks__/MCPService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { getMockedStorageService } from '@backend/storage/__mocks__/StorageService.mock';
import type { AgentRunId, AgentRunResult } from '@core/domain/agents';
import { notFound } from '@core/errors';
import { err, ok } from 'neverthrow';

/**
 * Creates mock dependencies for resumeFromSuspensionStack.
 */
export function createMockDeps() {
  return {
    stateCache: getMockedAgentStateCache(),
    storageService: getMockedStorageService(),
    logger: getMockedLogger(),
    completionsGateway: getMockedCompletionsGateway(),
    mcpService: getMockedMCPService(),
    agentRunLock: getMockedAgentRunLock(),
    cancellationCache: getMockedAgentCancellationCache(),
  };
}

/**
 * Creates a mock runAgent action that returns the specified result.
 * @deprecated Use createMockStreamAgent instead for streaming architecture
 */
export function createMockRunAgent(returnValue: AgentRunResult) {
  return mock().mockResolvedValue(ok(returnValue));
}

/**
 * Creates a mock runAgent that returns different results for each call.
 * @deprecated Use createMockStreamAgentSequence instead for streaming architecture
 */
export function createMockRunAgentSequence(results: AgentRunResult[]) {
  const mockFn = mock();
  for (const result of results) {
    mockFn.mockResolvedValueOnce(ok(result));
  }
  return mockFn;
}

/**
 * Creates a mock state cache that returns states from a map.
 */
export function setupStateCacheWithStates(states: Map<AgentRunId, AgentState>) {
  const cache = getMockedAgentStateCache();

  cache.get.mockImplementation((_ctx, id: AgentRunId) => {
    const state = states.get(id);
    if (state) {
      return Promise.resolve(ok(state));
    }
    return Promise.resolve(err(notFound('Agent state not found')));
  });

  cache.set.mockImplementation((_ctx, id: AgentRunId, state: AgentState) => {
    states.set(id, state);
    return Promise.resolve(ok(undefined));
  });

  return cache;
}

/**
 * Creates a mock streamAgent action that returns the specified result.
 * This is an async generator that yields the final result.
 */
export function createMockStreamAgent(returnValue: AgentRunResult) {
  const mockFn = mock();

  async function* mockStreamAgent(): AsyncGenerator<StreamAgentItem, void> {
    const finalResult: StreamAgentFinalResult = {
      type: 'final',
      result: ok(returnValue),
    };
    yield finalResult;
  }

  // Store the return value on the mock for test assertions
  mockFn.mockImplementation(() => mockStreamAgent());

  return mockFn;
}

/**
 * Creates a mock streamAgent that returns different results for each call.
 */
export function createMockStreamAgentSequence(results: AgentRunResult[]) {
  let callIndex = 0;

  const mockFn = mock();

  mockFn.mockImplementation(() => {
    async function* mockStreamAgent(): AsyncGenerator<StreamAgentItem, void> {
      const result = results[callIndex];
      callIndex++;
      const finalResult: StreamAgentFinalResult = {
        type: 'final',
        result: ok(result),
      };
      yield finalResult;
    }
    return mockStreamAgent();
  });

  return mockFn;
}
