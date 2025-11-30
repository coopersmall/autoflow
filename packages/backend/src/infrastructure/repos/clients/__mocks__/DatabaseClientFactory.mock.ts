import { mock } from 'bun:test';
import { getMockedDatabaseClient } from '@backend/infrastructure/repos/clients/__mocks__/DatabaseClient.mock';
import type { IDatabaseClientFactory } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

export function getMockedDatabaseClientFactory(): ExtractMockMethods<IDatabaseClientFactory> {
  const mockClient = getMockedDatabaseClient();

  return {
    getDatabase: mock(() => ok(mockClient)),
  };
}
