import { mock } from 'bun:test';
import { getMockedCacheClient } from '@backend/cache/clients/__mocks__/CacheClient.mock';
import type { ICacheClientFactory } from '@backend/cache/domain/Cache';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

export function getMockedCacheClientFactory(): ExtractMockMethods<ICacheClientFactory> {
  const mockClient = getMockedCacheClient();

  return {
    getCacheClient: mock(() => ok(mockClient)),
  };
}
