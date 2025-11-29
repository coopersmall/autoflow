import { mock } from 'bun:test';
import type { ICacheAdapter } from '@backend/cache/domain/CacheAdapter';
import type { ExtractMockMethods } from '@core/types';

export function getMockedCacheAdapter(): ExtractMockMethods<ICacheAdapter> {
  return {
    get: mock(),
    set: mock(),
    del: mock(),
    getClient: mock(),
  };
}
