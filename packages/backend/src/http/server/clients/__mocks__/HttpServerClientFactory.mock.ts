import { mock } from 'bun:test';
import { getMockedHttpServerClient } from '@backend/http/server/clients/__mocks__/HttpServerClient.mock';
import type { IHttpServerClientFactory } from '@backend/http/server/domain/HttpServerClient';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

export function getMockedHttpServerClientFactory(): ExtractMockMethods<IHttpServerClientFactory> {
  const mockClient = getMockedHttpServerClient();

  return {
    getServerClient: mock(() => ok(mockClient)),
  };
}
