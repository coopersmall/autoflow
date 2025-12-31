import { mock } from 'bun:test';
import type { IAgentRunLock } from '../AgentRunLock';

/**
 * Creates a mock agent run lock for unit tests.
 * Note: Uses type assertion because IAgentRunLock has generic methods
 * that ExtractMockMethods can't preserve.
 */
export function getMockedAgentRunLock(): IAgentRunLock {
  return {
    acquire: mock(),
    withLock: mock(),
    isLocked: mock(),
  } as unknown as IAgentRunLock;
}
