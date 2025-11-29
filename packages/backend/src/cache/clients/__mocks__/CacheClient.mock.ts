import { mock } from 'bun:test';
import type { ICacheClient } from '@backend/cache/domain/Cache';
import type { ExtractMockMethods } from '@core/types';

export function getMockedCacheClient(): ExtractMockMethods<ICacheClient> {
  return {
    get: mock(),
    set: mock(),
    del: mock(),
  };
}
