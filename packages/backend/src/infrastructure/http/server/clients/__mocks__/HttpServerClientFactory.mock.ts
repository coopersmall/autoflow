import { mock } from 'bun:test';
import { getMockedHttpServerClient } from '@backend/infrastructure/http/server/clients/__mocks__/HttpServerClient.mock';
import type { IHttpServerClientFactory } from '@backend/infrastructure/http/server/domain/HttpServerClient';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

export function getMockedHttpServerClientFactory(): ExtractMockMethods<IHttpServerClientFactory> {
  const mockClient = getMockedHttpServerClient();

  return {
    getServerClient: mock(() => ok(mockClient)),
  };
}
