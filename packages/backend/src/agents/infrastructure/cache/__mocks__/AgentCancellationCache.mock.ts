import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import type { IAgentCancellationCache } from '../AgentCancellationCache';

export function getMockedAgentCancellationCache(): ExtractMockMethods<IAgentCancellationCache> {
  return {
    get: mock(),
    set: mock(),
    del: mock(),
  };
}
