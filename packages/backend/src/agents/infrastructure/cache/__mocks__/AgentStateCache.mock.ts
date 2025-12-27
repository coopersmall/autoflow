import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import type { IAgentStateCache } from '../AgentStateCache';

export function getMockedAgentStateCache(): ExtractMockMethods<IAgentStateCache> {
  return {
    get: mock(),
    set: mock(),
    del: mock(),
  };
}
